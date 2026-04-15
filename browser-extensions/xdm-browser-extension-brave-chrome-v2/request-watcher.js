"use strict";
import Logger from './logger.js';

/**
 * XDM Request Watcher - Monitors network requests for downloadable media
 * 
 * Intercepts HTTP requests using the webRequest API and filters them
 * based on file extensions, MIME types, URL patterns, and host matching.
 * Matching requests are forwarded to the XDM desktop app for download.
 */
export default class RequestWatcher {
    constructor(callback) {
        this.logger = new Logger();
        this.blockedHosts = [];
        this.mediaExts = [];
        this.fileExts = [];
        this.requestMap = new Map();
        this.callback = callback;
        this.matchingHosts = [];
        this.mediaTypes = [];
        this.onSendHeadersEventCallback = this.onSendHeadersEvent.bind(this);
        this.onHeadersReceivedEventCallback = this.onHeadersReceivedEvent.bind(this);
        this.onErrorOccurredEventCallback = this.onErrorOccurredEvent.bind(this);
        this.urlPatterns = [];
        this.requestFileExts = [];
    }

    /**
     * Update configuration from XDM desktop app
     */
    updateConfig(config) {
        if (config.blockedHosts) this.blockedHosts = config.blockedHosts;
        if (config.fileExts) this.fileExts = config.fileExts;
        if (config.mediaExts) this.mediaExts = config.mediaExts;
        if (config.matchingHosts) this.matchingHosts = config.matchingHosts;
        if (config.mediaTypes) this.mediaTypes = config.mediaTypes;
        if (config.requestFileExts) this.requestFileExts = config.requestFileExts;

        if (config.urlPatterns) {
            this.urlPatterns = config.urlPatterns
                .map(pattern => {
                    try {
                        return new RegExp(pattern, "i");
                    } catch (e) {
                        return null;
                    }
                })
                .filter(Boolean);
        }

        this.logger.log(`Config updated: ${this.blockedHosts.length} blocked hosts, ` +
            `${this.mediaExts.length} media exts, ${this.fileExts.length} file exts`);
    }

    /**
     * Check if a response matches our download criteria
     */
    isMatchingRequest(res) {
        try {
            let u = new URL(res.url);
            let hostName = u.host;

            // Skip blocked hosts
            if (this.blockedHosts.some(h => hostName.indexOf(h) >= 0)) {
                return false;
            }

            let path = u.pathname;
            let upath = path.toUpperCase();

            // Check media extensions
            if (this.mediaExts.some(e => upath.endsWith(e))) {
                return true;
            }

            // Check request file extensions
            if (this.requestFileExts.some(e => upath.endsWith(e))) {
                return true;
            }

            // Check URL patterns
            if (this.urlPatterns.some(re => re.test(res.url))) {
                return true;
            }

            // Check Content-Type header
            let mediaType = res.responseHeaders?.find(
                h => h.name.toUpperCase() === "CONTENT-TYPE"
            );
            if (mediaType && this.mediaTypes.some(m => mediaType.value.indexOf(m) >= 0)) {
                return true;
            }

            // Check file extensions
            if (this.fileExts.some(e => upath.endsWith("." + e))) {
                return true;
            }

            // Check Content-Disposition header
            let contentDisposition = res.responseHeaders?.find(
                h => h.name.toUpperCase() === "CONTENT-DISPOSITION"
            );
            if (contentDisposition && this.fileExts.some(
                ext => contentDisposition.value.toUpperCase().indexOf("." + ext) >= 0
            )) {
                return true;
            }

            // Check matching hosts
            if (this.matchingHosts.some(h => hostName.indexOf(h) >= 0)) {
                return true;
            }

            return false;
        } catch (err) {
            this.logger.log("Error in isMatchingRequest: " + err);
            return false;
        }
    }

    /**
     * Track outgoing requests (onSendHeaders)
     */
    onSendHeadersEvent(info) {
        // Only track GET requests unless it's a matching host
        if (info.method !== "GET" && !(this.matchingHosts?.some(
            matchingHost => info.url.indexOf(matchingHost) > 0
        ))) {
            return;
        }
        this.requestMap.set(info.requestId, info);
    }

    /**
     * Process incoming responses (onHeadersReceived)
     */
    onHeadersReceivedEvent(res) {
        let reqId = res.requestId;
        let req = this.requestMap.get(reqId);
        
        if (!req) return;
        
        this.requestMap.delete(reqId);

        if (this.callback && this.isMatchingRequest(res)) {
            if (req.tabId !== -1 && req.tabId !== undefined) {
                chrome.tabs.get(req.tabId, tab => {
                    this.callback(this.createRequestData(req, res, tab?.title, tab?.url, req.tabId));
                });
            } else {
                this.callback(this.createRequestData(req, res, null, null, req.tabId));
            }
        }
    }

    /**
     * Clean up on request errors
     */
    onErrorOccurredEvent(info) {
        this.requestMap.delete(info.requestId);
    }

    /**
     * Register all webRequest listeners
     */
    register() {
        chrome.webRequest.onSendHeaders.addListener(
            this.onSendHeadersEventCallback,
            { urls: ["http://*/*", "https://*/*"] },
            ["extraHeaders", "requestHeaders"]
        );

        chrome.webRequest.onHeadersReceived.addListener(
            this.onHeadersReceivedEventCallback,
            { urls: ["http://*/*", "https://*/*"] },
            ["extraHeaders", "responseHeaders"]
        );

        chrome.webRequest.onErrorOccurred.addListener(
            this.onErrorOccurredEventCallback,
            { urls: ["http://*/*", "https://*/*"] }
        );
    }

    /**
     * Unregister all webRequest listeners
     */
    unRegister() {
        chrome.webRequest.onSendHeaders.removeListener(this.onSendHeadersEventCallback);
        chrome.webRequest.onHeadersReceived.removeListener(this.onHeadersReceivedEventCallback);
        chrome.webRequest.onErrorOccurred.removeListener(this.onErrorOccurredEventCallback);
    }

    /**
     * Build the request data object to send to XDM
     */
    createRequestData(req, res, title, tabUrl, tabId) {
        let data = {
            url: res.url,
            file: title,
            requestHeaders: {},
            responseHeaders: {},
            cookie: undefined,
            method: req.method,
            userAgent: navigator.userAgent,
            tabUrl: tabUrl,
            tabId: tabId + ""
        };

        let cookies = [];

        // Extract cookies and headers from request
        this.extractHeaders(req.extraHeaders, data.requestHeaders, cookies);
        this.extractHeaders(req.requestHeaders, data.requestHeaders, cookies);

        // Extract response headers
        if (res.responseHeaders) {
            res.responseHeaders.forEach(h => {
                this.addToDict(data.responseHeaders, h.name, h.value);
            });
        }

        if (cookies.length > 0) {
            data.cookie = cookies.join(";");
        }

        return data;
    }

    /**
     * Extract headers and cookies from a header array
     */
    extractHeaders(headers, targetDict, cookies) {
        if (!headers) return;
        headers.forEach(h => {
            if (h.name === 'Cookie' || h.name === 'cookie') {
                cookies.push(h.value);
            }
            this.addToDict(targetDict, h.name, h.value);
        });
    }

    /**
     * Add a key-value pair to a multi-value dictionary
     */
    addToDict(dict, key, value) {
        let values = dict[key];
        if (values) {
            values.push(value);
        } else {
            dict[key] = [value];
        }
    }
}
