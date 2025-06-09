/**
 * background-minimal.js - Minimal background script for Safari Extension
 * Routes messages between content/popup and native Swift handler
 * Maintains cache of last 10 sent items for display
 */

// Cache for last 10 sent history items
let recentHistory = [];

// Message handler for content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'page_visit') {
        // Add to recent history cache
        const historyItem = {
            ...message,
            id: crypto.randomUUID(),
            deviceName: 'This Device',
            visitDate: message.timestamp
        };
        
        recentHistory.unshift(historyItem);
        recentHistory = recentHistory.slice(0, 10);
        
        // Forward to native Swift handler
        browser.runtime.sendNativeMessage('com.bar123.Extension', {
            type: 'track_visit',
            data: historyItem
        }).catch(err => {
            console.error('Failed to send to native:', err);
        });
    } else if (message.type === 'get_recent_history') {
        // Popup requesting recent history
        sendResponse({ success: true, history: recentHistory });
    } else {
        // Forward all other messages to native
        browser.runtime.sendNativeMessage('com.bar123.Extension', message)
            .then(response => sendResponse(response))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Will respond asynchronously
    }
});

// Update extension badge with connection status from native
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type === 'update_badge') {
        if (message.connected) {
            browser.browserAction.setBadgeText({ text: '✓' });
            browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50' });
        } else {
            browser.browserAction.setBadgeText({ text: '' });
        }
    }
});