"use strict";
import App from './app.js';

/**
 * XDM Browser Monitor - Service Worker Entry Point
 * 
 * This is the background service worker for the XDM browser extension.
 * It initializes the main App class which handles:
 * - Connection to the XDM desktop application via HTTP
 * - Monitoring downloads and capturing media streams
 * - Context menu integration
 * - Badge and icon state management
 */
const app = new App();
app.start();

// Keep the service worker alive for connection management
chrome.runtime.onInstalled.addListener((details) => {
    console.log(`[XDM] Extension installed/updated: ${details.reason}`);
    if (details.reason === 'install') {
        // Set default options on first install
        chrome.storage.local.set({
            xdmServerUrl: 'http://127.0.0.1:8597',
            monitoringEnabled: true,
            showNotifications: true,
            minimumFileSize: 1048576 // 1MB default minimum
        });
    }
});

// Handle extension icon click (when no popup is needed)
chrome.action.onClicked.addListener((tab) => {
    // If popup is set, this won't fire. Kept as fallback.
    console.log('[XDM] Action clicked on tab:', tab.id);
});
