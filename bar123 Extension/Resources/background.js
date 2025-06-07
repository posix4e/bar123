/**
 * background.js - Safari Extension Background Script
 * Manages history tracking, WebRTC connections, and native messaging
 */

// Configuration
const config = {
    signalingServerUrl: 'ws://localhost:8080',
    roomId: 'history-sync-default',
    sharedSecret: null,
    isConnected: false
};

// History cache
const historyCache = new Map();

// Native messaging helper
async function sendNativeMessage(message) {
    try {
        const response = await browser.runtime.sendNativeMessage('application.id', message);
        if (!response.success) {
            throw new Error(response.error || 'Native message failed');
        }
        return response.data;
    } catch (error) {
        console.error('Native message error:', error);
        throw error;
    }
}

// Initialize extension
async function initialize() {
    // Load saved configuration
    const saved = await browser.storage.local.get(['signalingServerUrl', 'roomId', 'sharedSecret']);
    if (saved.signalingServerUrl) config.signalingServerUrl = saved.signalingServerUrl;
    if (saved.roomId) config.roomId = saved.roomId;
    if (saved.sharedSecret) config.sharedSecret = saved.sharedSecret;
    
    // Auto-connect if we have a shared secret
    if (config.sharedSecret) {
        await connect();
    }
}

// Connect to P2P network
async function connect() {
    if (!config.sharedSecret) {
        throw new Error('No shared secret configured');
    }
    
    try {
        await sendNativeMessage({
            type: 'connect',
            roomId: config.roomId,
            sharedSecret: config.sharedSecret,
            serverUrl: config.signalingServerUrl
        });
        
        config.isConnected = true;
        
        // Update extension icon
        browser.action.setBadgeText({ text: '✓' });
        browser.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        
    } catch (error) {
        console.error('Connection failed:', error);
        config.isConnected = false;
        
        browser.action.setBadgeText({ text: '!' });
        browser.action.setBadgeBackgroundColor({ color: '#F44336' });
        
        throw error;
    }
}

// Disconnect from P2P network
async function disconnect() {
    try {
        await sendNativeMessage({ type: 'disconnect' });
        config.isConnected = false;
        
        browser.action.setBadgeText({ text: '' });
    } catch (error) {
        console.error('Disconnect failed:', error);
    }
}

// Track page visit
async function trackVisit(url, title) {
    // Filter out certain URLs
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('safari-extension://')) {
        return;
    }
    
    try {
        await sendNativeMessage({
            type: 'track_visit',
            url: url,
            title: title
        });
        
        // Cache locally
        const entry = {
            url,
            title,
            timestamp: new Date().toISOString()
        };
        historyCache.set(url, entry);
        
    } catch (error) {
        console.error('Failed to track visit:', error);
    }
}

// Search history
async function searchHistory(query) {
    try {
        const result = await sendNativeMessage({
            type: 'search_history',
            query: query
        });
        return result.results || [];
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
}

// Get connected devices
async function getDevices() {
    try {
        const result = await sendNativeMessage({
            type: 'get_devices'
        });
        return result.devices || [];
    } catch (error) {
        console.error('Failed to get devices:', error);
        return [];
    }
}

// Get history for specific device
async function getHistory(deviceId = null) {
    try {
        const message = { type: 'get_history' };
        if (deviceId) message.deviceId = deviceId;
        
        const result = await sendNativeMessage(message);
        return result.history || [];
    } catch (error) {
        console.error('Failed to get history:', error);
        return [];
    }
}

// Add new shared secret
async function addSecret(name, secret) {
    try {
        await sendNativeMessage({
            type: 'add_secret',
            name: name,
            secret: secret
        });
        
        // Auto-connect with new secret
        config.sharedSecret = secret;
        await browser.storage.local.set({ sharedSecret: secret });
        await connect();
        
    } catch (error) {
        console.error('Failed to add secret:', error);
        throw error;
    }
}

// Get saved secrets
async function getSecrets() {
    try {
        const result = await sendNativeMessage({
            type: 'get_secrets'
        });
        return result.secrets || [];
    } catch (error) {
        console.error('Failed to get secrets:', error);
        return [];
    }
}

// Message handler
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received request:', request);
    
    switch (request.type) {
        case 'page_visit':
            // Track visit from content script
            trackVisit(request.url, request.title);
            sendResponse({ success: true });
            break;
            
        case 'connect':
            connect().then(() => {
                sendResponse({ success: true, connected: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Will respond asynchronously
            
        case 'disconnect':
            disconnect().then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'search':
            searchHistory(request.query).then(results => {
                sendResponse({ success: true, results });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'get_devices':
            getDevices().then(devices => {
                sendResponse({ success: true, devices });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'get_history':
            getHistory(request.deviceId).then(history => {
                sendResponse({ success: true, history });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'add_secret':
            addSecret(request.name, request.secret).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'get_config':
            sendResponse({
                success: true,
                config: {
                    ...config,
                    sharedSecret: config.sharedSecret ? '***' : null
                }
            });
            break;
            
        case 'update_config':
            Object.assign(config, request.config);
            browser.storage.local.set(request.config).then(() => {
                sendResponse({ success: true });
            });
            return true;
            
        default:
            sendResponse({ success: false, error: 'Unknown request type' });
    }
});

// Initialize on load
initialize().catch(console.error);
