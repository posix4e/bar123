/**
 * background.js - Safari Extension Background Script
 * Manages history tracking and native messaging with serverless P2P
 */

// Configuration
const config = {
    isConnected: false,
    hasSharedSecret: false
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
    // Initialize P2P manager in native app
    try {
        await sendNativeMessage({ type: 'initialize_p2p' });
        
        // Check connection status
        const status = await getConnectionStatus();
        config.isConnected = status.connected;
        config.hasSharedSecret = status.hasSharedSecret;
        
        updateBadge();
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
}

// Update badge based on connection status
function updateBadge() {
    if (config.isConnected) {
        browser.action.setBadgeText({ text: '✓' });
        browser.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else if (config.hasSharedSecret) {
        browser.action.setBadgeText({ text: '•' });
        browser.action.setBadgeBackgroundColor({ color: '#FFC107' });
    } else {
        browser.action.setBadgeText({ text: '' });
    }
}

// Get connection status
async function getConnectionStatus() {
    try {
        const result = await sendNativeMessage({ type: 'get_connection_status' });
        return {
            connected: result.connected || false,
            hasSharedSecret: result.hasSharedSecret || false,
            peerCount: result.peerCount || 0
        };
    } catch (error) {
        console.error('Failed to get connection status:', error);
        return { connected: false, hasSharedSecret: false, peerCount: 0 };
    }
}

// Create connection offer
async function createOffer() {
    try {
        const result = await sendNativeMessage({ type: 'create_offer' });
        return result.offer;
    } catch (error) {
        console.error('Failed to create offer:', error);
        throw error;
    }
}

// Process connection offer
async function processOffer(offer) {
    try {
        const result = await sendNativeMessage({ 
            type: 'process_offer',
            offer: offer 
        });
        return result.answer;
    } catch (error) {
        console.error('Failed to process offer:', error);
        throw error;
    }
}

// Complete connection with answer
async function completeConnection(answer) {
    try {
        await sendNativeMessage({ 
            type: 'complete_connection',
            answer: answer 
        });
        
        // Update connection status
        const status = await getConnectionStatus();
        config.isConnected = status.connected;
        updateBadge();
        
    } catch (error) {
        console.error('Failed to complete connection:', error);
        throw error;
    }
}

// Disconnect from all peers
async function disconnect() {
    try {
        await sendNativeMessage({ type: 'disconnect' });
        config.isConnected = false;
        updateBadge();
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

// Update shared secret
async function updateSharedSecret(secret) {
    try {
        await sendNativeMessage({
            type: 'update_shared_secret',
            secret: secret
        });
        
        config.hasSharedSecret = true;
        updateBadge();
        
    } catch (error) {
        console.error('Failed to update shared secret:', error);
        throw error;
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
            
        case 'create_offer':
            createOffer().then(offer => {
                sendResponse({ success: true, offer });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Will respond asynchronously
            
        case 'process_offer':
            processOffer(request.offer).then(answer => {
                sendResponse({ success: true, answer });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'complete_connection':
            completeConnection(request.answer).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
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
            
        case 'update_shared_secret':
            updateSharedSecret(request.secret).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'get_connection_status':
            getConnectionStatus().then(status => {
                sendResponse({ 
                    success: true, 
                    ...status,
                    isConnected: status.connected
                });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        default:
            sendResponse({ success: false, error: 'Unknown request type' });
    }
});

// Initialize on load
initialize().catch(console.error);