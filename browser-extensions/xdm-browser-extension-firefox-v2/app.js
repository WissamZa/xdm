"use strict";
import Logger from './logger.js';
import RequestWatcher from './request-watcher.js';
import Connector from './connector.js';

/**
 * XDM Browser Monitor - Firefox App Class (Manifest V3)
 * 
 * Firefox-specific version of the main application class.
 * Uses browser.* APIs where available for better Firefox compatibility.
 * Includes download interception via webRequest blocking.
 */
export default class App {
    constructor() {
        this.logger = new Logger();
        this.videoList = [];
        this.blockedHosts = [];
        this.fileExts = [];
        this.requestWatcher = new RequestWatcher(
            this.onRequestDataReceived.bind(this),
            this.isMonitoringEnabled.bind(this)
        );
        this.tabsWatcher = [];
        this.userDisabled = false;
        this.appEnabled = false;
        this.onTabUpdateCallback = this.onTabUpdate.bind(this);
        this.activeTabId = -1;
        this.connector = new Connector(this.onMessage.bind(this), this.onDisconnect.bind(this));
        this.settings = {
            serverUrl: 'http://127.0.0.1:8597',
            monitoringEnabled: true,
            showNotifications: true,
            minimumFileSize: 1048576
        };
    }

    async start() {
        this.logger.log("XDM Browser Monitor (Firefox) starting...");
        await this.loadSettings();
        this.startAppConnector();
        this.register();
        this.logger.log("XDM Browser Monitor (Firefox) started.");
    }

    async loadSettings() {
        try {
            const data = await browser.storage.local.get([
                'xdmServerUrl', 'monitoringEnabled', 'showNotifications', 'minimumFileSize'
            ]);
            if (data.xdmServerUrl) this.settings.serverUrl = data.xdmServerUrl;
            if (data.monitoringEnabled !== undefined) this.settings.monitoringEnabled = data.monitoringEnabled;
            if (data.showNotifications !== undefined) this.settings.showNotifications = data.showNotifications;
            if (data.minimumFileSize !== undefined) this.settings.minimumFileSize = data.minimumFileSize;
            this.connector.setServerUrl(this.settings.serverUrl);
        } catch (err) {
            this.logger.log("Could not load settings, using defaults");
        }
    }

    startAppConnector() {
        this.connector.connect();
    }

    onMessage(msg) {
        this.logger.log("Configuration received from XDM desktop app");
        this.appEnabled = msg.enabled === true;
        this.fileExts = msg.fileExts || [];
        this.blockedHosts = msg.blockedHosts || [];
        this.tabsWatcher = msg.tabsWatcher || [];
        this.videoList = msg.videoList || [];

        this.requestWatcher.updateConfig({
            mediaExts: msg.requestFileExts,
            blockedHosts: msg.blockedHosts,
            matchingHosts: msg.matchingHosts,
            mediaTypes: msg.mediaTypes
        });
        this.updateActionIcon();
    }

    onDisconnect() {
        this.logger.log("Disconnected from XDM desktop app");
        this.updateActionIcon();
    }

    isMonitoringEnabled() {
        return this.appEnabled === true
            && this.userDisabled === false
            && this.connector.isConnected()
            && this.settings.monitoringEnabled;
    }

    onRequestDataReceived(data) {
        this.logger.log("Streaming media data captured");
        if (this.isMonitoringEnabled() && this.connector.isConnected()) {
            if (data.download) {
                this.connector.postMessage("/download", data);
            } else {
                this.connector.postMessage("/media", data);
            }
        }
    }

    onTabUpdate(tabId, changeInfo, tab) {
        if (!this.isMonitoringEnabled()) return;

        if (changeInfo.title && this.tabsWatcher.length > 0) {
            if (this.tabsWatcher.some(t => tab.url.indexOf(t) > 0)) {
                this.logger.log("Tab changed: " + changeInfo.title + " => " + tab.url);
                try {
                    this.connector.postMessage("/tab-update", {
                        tabUrl: tab.url,
                        tabTitle: changeInfo.title
                    });
                } catch (ex) {
                    this.logger.log("Tab update error: " + ex);
                }
            }
        }
    }

    register() {
        browser.tabs.onUpdated.addListener(this.onTabUpdateCallback);
        browser.runtime.onMessage.addListener(this.onPopupMessage.bind(this));
        this.requestWatcher.register();
        this.attachContextMenu();
        browser.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    }

    isSupportedProtocol(url) {
        if (!url) return false;
        try {
            let u = new URL(url);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    }

    updateActionIcon() {
        browser.browserAction.setIcon({ path: this.getActionIcon() });

        let badgeText = "";
        if (this.videoList && this.videoList.length > 0) {
            let len = this.videoList.filter(vid => {
                if (!vid.tabId || vid.tabId == '-1') return true;
                return (vid.tabId == this.activeTabId);
            }).length;
            if (len > 0) badgeText = Math.min(len, 99).toString();
        }
        browser.browserAction.setBadgeText({ text: badgeText });
        browser.browserAction.setBadgeBackgroundColor({ color: "#FF6600" });

        if (!this.connector.isConnected()) {
            browser.browserAction.setPopup({ popup: "./error.html" });
        } else if (!this.appEnabled) {
            browser.browserAction.setPopup({ popup: "./disabled.html" });
        } else {
            browser.browserAction.setPopup({ popup: "./popup.html" });
        }
    }

    getActionIconName(icon) {
        return this.isMonitoringEnabled() ? `${icon}.png` : `${icon}-mono.png`;
    }

    getActionIcon() {
        return {
            "16": this.getActionIconName("icon16"),
            "48": this.getActionIconName("icon48"),
            "128": this.getActionIconName("icon128")
        };
    }

    triggerDownload(url, file, referer, size, mime) {
        browser.cookies.getAll({ "url": url }).then(cookies => {
            let cookieStr = undefined;
            if (cookies && cookies.length > 0) {
                cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
            }

            let requestHeaders = { "User-Agent": [navigator.userAgent] };
            if (referer) requestHeaders["Referer"] = [referer];

            let responseHeaders = {};
            if (size) {
                let fz = +size;
                if (fz > 0) responseHeaders["Content-Length"] = [fz];
            }
            if (mime) responseHeaders["Content-Type"] = [mime];

            let data = {
                url, cookie: cookieStr, requestHeaders, responseHeaders,
                filename: file, fileSize: size, mimeType: mime
            };

            this.logger.log("Sending download to XDM:", data);
            this.connector.postMessage("/download", data);
        });
    }

    onPopupMessage(request, sender, sendResponse) {
        switch (request.type) {
            case "stat":
                sendResponse({
                    enabled: this.isMonitoringEnabled(),
                    connected: this.connector.isConnected(),
                    serverUrl: this.settings.serverUrl,
                    list: this.videoList.filter(vid => {
                        if (!vid.tabId || vid.tabId == '-1') return true;
                        return (vid.tabId == this.activeTabId);
                    })
                });
                break;

            case "cmd":
                this.userDisabled = request.enabled === false;
                if (request.enabled && !this.connector.isConnected()) {
                    this.connector.reconnect();
                }
                this.updateActionIcon();
                sendResponse({ success: true });
                break;

            case "vid":
                this.connector.postMessage("/vid", { vid: request.itemId + "" });
                sendResponse({ success: true });
                break;

            case "clear":
                this.connector.postMessage("/clear", {});
                this.videoList = [];
                this.updateActionIcon();
                sendResponse({ success: true });
                break;

            case "settings":
                if (request.serverUrl) {
                    this.settings.serverUrl = request.serverUrl;
                    this.connector.setServerUrl(request.serverUrl);
                    browser.storage.local.set({ xdmServerUrl: request.serverUrl });
                }
                if (request.monitoringEnabled !== undefined) {
                    this.settings.monitoringEnabled = request.monitoringEnabled;
                    browser.storage.local.set({ monitoringEnabled: request.monitoringEnabled });
                }
                if (request.showNotifications !== undefined) {
                    this.settings.showNotifications = request.showNotifications;
                    browser.storage.local.set({ showNotifications: request.showNotifications });
                }
                this.updateActionIcon();
                sendResponse({ success: true, settings: this.settings });
                break;

            case "getSettings":
                sendResponse({ success: true, settings: this.settings });
                break;

            default:
                sendResponse({ success: false, error: "Unknown command" });
        }
        return true; // Keep message channel open for async response
    }

    attachContextMenu() {
        browser.menus.create({
            id: 'download-any-link',
            title: "Download Link with XDM",
            contexts: ["link"]
        });
        browser.menus.create({
            id: 'download-image-link',
            title: "Download Image with XDM",
            contexts: ["image"]
        });
        browser.menus.create({
            id: 'download-video-link',
            title: "Download Media with XDM",
            contexts: ["video", "audio"]
        });
        browser.menus.create({
            id: 'download-page-link',
            title: "Download Page URL with XDM",
            contexts: ["page", "frame"]
        });
        browser.menus.onClicked.addListener(this.onMenuClicked.bind(this));
    }

    onMenuClicked(info, tab) {
        let url;
        switch (info.menuItemId) {
            case "download-any-link":
                url = info.linkUrl;
                break;
            case "download-image-link":
                url = info.srcUrl || info.linkUrl;
                break;
            case "download-video-link":
                url = info.srcUrl || info.linkUrl;
                break;
            case "download-page-link":
                url = info.pageUrl;
                break;
            default:
                return;
        }
        if (!this.isSupportedProtocol(url)) return;
        this.triggerDownload(url, null, info.pageUrl, null, null);
    }

    onTabActivated(activeInfo) {
        this.activeTabId = activeInfo.tabId + "";
        this.updateActionIcon();
    }
}
