"use strict";
import Logger from './logger.js';
import RequestWatcher from './request-watcher.js';
import Connector from './connector.js';

/**
 * XDM Browser Monitor - Main Application Class
 * 
 * Core orchestration class that manages the connection to XDM desktop app,
 * browser event listeners, download interception, and video capture.
 */
export default class App {
    constructor() {
        this.logger = new Logger();
        this.videoList = [];
        this.blockedHosts = [];
        this.fileExts = [];
        this.requestWatcher = new RequestWatcher(this.onRequestDataReceived.bind(this));
        this.tabsWatcher = [];
        this.userDisabled = false;
        this.appEnabled = false;
        this.onDownloadCreatedCallback = this.onDownloadCreated.bind(this);
        this.onDeterminingFilenameCallback = this.onDeterminingFilename.bind(this);
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
        this.logger.log("XDM Browser Monitor starting...");
        
        // Load saved settings
        await this.loadSettings();
        
        // Start the connection to XDM desktop app
        this.startAppConnector();
        
        // Register all browser event listeners
        this.register();
        
        this.logger.log("XDM Browser Monitor started successfully.");
    }

    async loadSettings() {
        try {
            const data = await chrome.storage.local.get([
                'xdmServerUrl',
                'monitoringEnabled',
                'showNotifications',
                'minimumFileSize'
            ]);
            
            if (data.xdmServerUrl) this.settings.serverUrl = data.xdmServerUrl;
            if (data.monitoringEnabled !== undefined) this.settings.monitoringEnabled = data.monitoringEnabled;
            if (data.showNotifications !== undefined) this.settings.showNotifications = data.showNotifications;
            if (data.minimumFileSize !== undefined) this.settings.minimumFileSize = data.minimumFileSize;
            
            // Update connector with server URL
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
        this.logger.log(data);
        if (this.isMonitoringEnabled() && this.connector.isConnected()) {
            this.connector.postMessage("/media", data);
        }
    }

    onDeterminingFilename(download, suggest) {
        if (!this.isMonitoringEnabled()) {
            return;
        }

        let url = download.finalUrl || download.url;

        if (this.shouldTakeOver(url, download.filename)) {
            // Cancel the browser's native download
            chrome.downloads.cancel(download.id, () => {
                chrome.downloads.erase({ id: download.id });
            });

            let referrer = download.referrer;
            if (!referrer && download.finalUrl !== download.url) {
                referrer = download.url;
            }

            this.triggerDownload(url, download.filename, referrer, download.fileSize, download.mime);

            if (this.settings.showNotifications) {
                this.showNotification("Download captured by XDM", download.filename);
            }
        }
    }

    onDownloadCreated(download) {
        this.logger.log(`Download created: ${download.filename} - ${download.url}`);
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
        chrome.downloads.onCreated.addListener(this.onDownloadCreatedCallback);
        chrome.downloads.onDeterminingFilename.addListener(this.onDeterminingFilenameCallback);
        chrome.tabs.onUpdated.addListener(this.onTabUpdateCallback);
        chrome.runtime.onMessage.addListener(this.onPopupMessage.bind(this));
        chrome.runtime.onConnect.addListener(this.onDevToolsConnect.bind(this));
        this.requestWatcher.register();
        this.attachContextMenu();
        chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    }

    onDevToolsConnect(port) {
        this.logger.log("DevTools panel connected");
        port.onMessage.addListener((msg) => {
            if (msg.type === 'getStats') {
                port.postMessage({
                    type: 'stats',
                    connected: this.connector.isConnected(),
                    enabled: this.isMonitoringEnabled(),
                    videoCount: this.videoList.length,
                    downloadsIntercepted: this.connector.getMessageCount()
                });
            }
        });
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

    shouldTakeOver(url, file) {
        if (!this.isSupportedProtocol(url)) return false;

        try {
            let u = new URL(url);
            let hostName = u.host;

            // Skip if host is blocked
            if (this.blockedHosts.some(item => hostName.indexOf(item) >= 0)) {
                return false;
            }

            // Check file extension
            let path = file || u.pathname;
            let upath = path.toUpperCase();
            if (this.fileExts.some(ext => upath.endsWith(ext))) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    updateActionIcon() {
        // Set appropriate icon based on connection state
        chrome.action.setIcon({ path: this.getActionIcon() });

        // Show video count badge
        let badgeText = "";
        if (this.videoList && this.videoList.length > 0) {
            badgeText = Math.min(this.videoList.length, 99).toString();
        }
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: "#FF6600" });

        // Set appropriate popup
        if (!this.connector.isConnected()) {
            chrome.action.setPopup({ popup: "./error.html" });
        } else if (!this.appEnabled) {
            chrome.action.setPopup({ popup: "./disabled.html" });
        } else {
            chrome.action.setPopup({ popup: "./popup.html" });
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
        chrome.cookies.getAll({ "url": url }, cookies => {
            let cookieStr = undefined;
            if (cookies && cookies.length > 0) {
                cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
            }

            let requestHeaders = { "User-Agent": [navigator.userAgent] };
            if (referer) {
                requestHeaders["Referer"] = [referer];
            }

            let responseHeaders = {};
            if (size) {
                let fz = +size;
                if (fz > 0) {
                    responseHeaders["Content-Length"] = [fz];
                }
            }
            if (mime) {
                responseHeaders["Content-Type"] = [mime];
            }

            let data = {
                url: url,
                cookie: cookieStr,
                requestHeaders: requestHeaders,
                responseHeaders: responseHeaders,
                filename: file,
                fileSize: size,
                mimeType: mime
            };

            this.logger.log("Sending download to XDM:", data);
            this.connector.postMessage("/download", data);
        });
    }

    showNotification(title, message) {
        try {
            chrome.notifications?.create({
                type: 'basic',
                iconUrl: 'icon128.png',
                title: title,
                message: message
            });
        } catch {
            // Notifications API may not be available in all contexts
        }
    }

    onPopupMessage(request, sender, sendResponse) {
        switch (request.type) {
            case "stat":
                sendResponse({
                    enabled: this.isMonitoringEnabled(),
                    connected: this.connector.isConnected(),
                    serverUrl: this.settings.serverUrl,
                    list: this.videoList
                });
                break;

            case "cmd":
                this.userDisabled = request.enabled === false;
                this.logger.log(`Monitoring ${request.enabled ? 'enabled' : 'disabled'} by user`);
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
                    chrome.storage.local.set({ xdmServerUrl: request.serverUrl });
                }
                if (request.monitoringEnabled !== undefined) {
                    this.settings.monitoringEnabled = request.monitoringEnabled;
                    chrome.storage.local.set({ monitoringEnabled: request.monitoringEnabled });
                }
                if (request.showNotifications !== undefined) {
                    this.settings.showNotifications = request.showNotifications;
                    chrome.storage.local.set({ showNotifications: request.showNotifications });
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
    }

    sendLinkToXDM(info, tab) {
        let url = info.linkUrl || info.srcUrl || info.pageUrl;
        if (!this.isSupportedProtocol(url)) return;
        this.triggerDownload(url, null, info.pageUrl, null, null);
    }

    sendImageToXDM(info, tab) {
        let url = info.srcUrl || info.linkUrl || info.pageUrl;
        if (!this.isSupportedProtocol(url)) return;
        this.triggerDownload(url, null, info.pageUrl, null, null);
    }

    sendVideoToXDM(info, tab) {
        let url = info.srcUrl || info.linkUrl || info.pageUrl;
        if (!this.isSupportedProtocol(url)) return;
        this.triggerDownload(url, null, info.pageUrl, null, null);
    }

    sendPageToXDM(info, tab) {
        let url = info.pageUrl || info.linkUrl;
        if (!this.isSupportedProtocol(url)) return;
        this.triggerDownload(url, null, info.pageUrl, null, null);
    }

    onMenuClicked(info, tab) {
        switch (info.menuItemId) {
            case "download-any-link":
                this.sendLinkToXDM(info, tab);
                break;
            case "download-image-link":
                this.sendImageToXDM(info, tab);
                break;
            case "download-video-link":
                this.sendVideoToXDM(info, tab);
                break;
            case "download-page-link":
                this.sendPageToXDM(info, tab);
                break;
        }
    }

    attachContextMenu() {
        // Download link with XDM
        chrome.contextMenus.create({
            id: 'download-any-link',
            title: "Download Link with XDM",
            contexts: ["link"]
        });

        // Download image with XDM
        chrome.contextMenus.create({
            id: 'download-image-link',
            title: "Download Image with XDM",
            contexts: ["image"]
        });

        // Download video/audio with XDM
        chrome.contextMenus.create({
            id: 'download-video-link',
            title: "Download Media with XDM",
            contexts: ["video", "audio"]
        });

        // Download current page
        chrome.contextMenus.create({
            id: 'download-page-link',
            title: "Download Page URL with XDM",
            contexts: ["page", "frame"]
        });

        chrome.contextMenus.onClicked.addListener(this.onMenuClicked.bind(this));
    }

    onTabActivated(activeInfo) {
        this.activeTabId = activeInfo.tabId + "";
        this.logger.log("Active tab changed: " + this.activeTabId);
        this.updateActionIcon();
    }
}
