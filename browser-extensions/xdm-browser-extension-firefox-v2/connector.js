"use strict";
import Logger from './logger.js';

/**
 * XDM Connector - HTTP-based connection to XDM desktop application
 * 
 * Communicates with the XDM desktop app via HTTP on localhost:8597.
 * Uses chrome.alarms for periodic sync to maintain connection status.
 * This replaces the legacy native messaging approach with a simpler
 * HTTP-based protocol that works reliably across all Chromium browsers.
 */
const DEFAULT_SERVER_URL = "http://127.0.0.1:8597";

export default class Connector {
    constructor(onMessage, onDisconnect) {
        this.logger = new Logger();
        this.onMessage = onMessage;
        this.onDisconnect = onDisconnect;
        this.connected = undefined;
        this.serverUrl = DEFAULT_SERVER_URL;
        this.messageCount = 0;
        this.retryCount = 0;
        this.maxRetries = 12;
        this.reconnectDelay = 5000;
    }

    /**
     * Set a custom server URL (e.g., for remote XDM instances)
     */
    setServerUrl(url) {
        this.serverUrl = url;
        this.logger.log(`Server URL updated to: ${url}`);
    }

    /**
     * Get the total number of messages sent
     */
    getMessageCount() {
        return this.messageCount;
    }

    /**
     * Start the connection using chrome.alarms for periodic sync
     */
    connect() {
        this.logger.log("Starting connection to XDM at " + this.serverUrl);
        
        // Create staggered alarms for initial rapid connection attempts
        for (let i = 0; i < 12; i++) {
            chrome.alarms.create("xdm-sync-" + i, {
                periodInMinutes: 1,
                when: Date.now() + 1000 + ((i + 1) * 3000)
            });
        }

        // Create a persistent sync alarm
        chrome.alarms.create("xdm-sync-persistent", {
            periodInMinutes: 0.5 // Sync every 30 seconds
        });

        chrome.alarms.onAlarm.addListener(this.onAlarm.bind(this));

        // Immediate first attempt
        this.onTimer();
    }

    /**
     * Force reconnect attempt
     */
    reconnect() {
        this.retryCount = 0;
        this.onTimer();
    }

    onAlarm(alarm) {
        if (alarm.name.startsWith("xdm-sync")) {
            this.onTimer();
        }
    }

    onTimer() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        fetch(this.serverUrl + "/sync", {
            signal: controller.signal
        })
        .then(res => {
            clearTimeout(timeoutId);
            this.onResponse(res);
        })
        .catch(err => {
            clearTimeout(timeoutId);
            this.handleDisconnect();
        });
    }

    handleDisconnect() {
        this.connected = false;
        this.retryCount++;
        this.onDisconnect();
    }

    disconnect() {
        this.connected = false;
        this.onDisconnect();
    }

    isConnected() {
        return this.connected === true;
    }

    onResponse(res) {
        if (!res.ok) {
            this.handleDisconnect();
            return;
        }

        this.connected = true;
        this.retryCount = 0;

        res.json()
            .then(json => this.onMessage(json))
            .catch(err => {
                this.logger.log("Failed to parse sync response");
            });
    }

    /**
     * Send a message to XDM desktop app via HTTP POST
     */
    postMessage(url, data) {
        this.messageCount++;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        fetch(this.serverUrl + url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data),
            signal: controller.signal
        })
        .then(res => {
            clearTimeout(timeoutId);
            this.onResponse(res);
        })
        .catch(err => {
            clearTimeout(timeoutId);
            this.logger.log("Post message failed: " + err.message);
            this.handleDisconnect();
        });
    }

    /**
     * Launch XDM desktop application (not available in MV3 service workers)
     */
    launchApp() {
        this.logger.log("Auto-launch not available in Manifest V3. Please start XDM manually.");
    }
}
