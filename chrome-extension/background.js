/**
 * background.js - Chrome Extension Background Service Worker
 * P2P history sync without signaling server
 */

// Import dependencies
importScripts('lib/crypto-js.min.js');
importScripts('lib/p2p-core.js');

// Configuration
const config = {
    roomId: 'history-sync-default',
    deviceId: null,
    deviceName: 'Chrome Browser'
};

// P2P Manager instance
let p2pManager = null;

// History cache
const historyCache = new Map();
const connectedDevices = new Map();

// Initialize
async function initialize() {
    // Generate or load device ID
    const stored = await chrome.storage.local.get(['deviceId', 'sharedSecret']);
    
    if (stored.deviceId) {
        config.deviceId = stored.deviceId;
    } else {
        config.deviceId = generateDeviceId();
        await chrome.storage.local.set({ deviceId: config.deviceId });
    }
    
    // Initialize P2P manager
    p2pManager = new P2PConnectionManager({
        sharedSecret: stored.sharedSecret,
        deviceId: config.deviceId,
        deviceInfo: {
            name: config.deviceName,
            type: 'chrome'
        },
        onPeerConnected: handlePeerConnected,
        onPeerDisconnected: handlePeerDisconnected,
        onDataReceived: handleDataReceived
    });
    
    // Override HMAC calculation with CryptoJS
    p2pManager.calculateHMAC = (data, secret) => {
        return CryptoJS.HmacSHA256(data, secret).toString();
    };
    
    // Setup history listener
    chrome.history.onVisited.addListener(handleHistoryVisit);
    
    // Load cached history
    await loadHistoryFromStorage();
}

// Generate device ID
function generateDeviceId() {
    return 'chrome-' + Math.random().toString(36).substr(2, 9);
}

// Handle peer connected
function handlePeerConnected(peerId, deviceInfo) {
    console.log(`Peer connected: ${peerId}`, deviceInfo);
    connectedDevices.set(peerId, deviceInfo);
    
    // Send device info
    sendDeviceInfo(peerId);
    
    // Request full sync
    p2pManager.sendData({
        type: 'sync_request',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId
    }, peerId);
    
    updateBadge();
}

// Handle peer disconnected
function handlePeerDisconnected(peerId) {
    console.log(`Peer disconnected: ${peerId}`);
    connectedDevices.delete(peerId);
    updateBadge();
}

// Handle received data
function handleDataReceived(message, fromPeerId) {
    switch (message.type) {
        case 'device_info':
            handleDeviceInfo(message, fromPeerId);
            break;
        case 'full_sync':
            handleFullSync(message);
            break;
        case 'incremental_update':
            handleIncrementalUpdate(message);
            break;
        case 'sync_request':
            handleSyncRequest(fromPeerId);
            break;
    }
}

// Send device info
function sendDeviceInfo(toPeerId) {
    const deviceInfo = {
        id: config.deviceId,
        name: config.deviceName,
        type: 'chrome',
        lastSeen: new Date().toISOString()
    };
    
    p2pManager.sendData({
        type: 'device_info',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: deviceInfo
    }, toPeerId);
}

// Handle device info
function handleDeviceInfo(message, fromPeerId) {
    connectedDevices.set(fromPeerId, message.data);
}

// Handle history visit
async function handleHistoryVisit(historyItem) {
    // Get page details
    const visits = await chrome.history.getVisits({ url: historyItem.url });
    const lastVisit = visits[visits.length - 1];
    
    const entry = {
        id: crypto.randomUUID(),
        url: historyItem.url,
        title: historyItem.title || '',
        visitDate: new Date(lastVisit.visitTime).toISOString(),
        deviceId: config.deviceId,
        deviceName: config.deviceName
    };
    
    // Cache locally
    historyCache.set(entry.id, entry);
    await saveHistoryToStorage();
    
    // Send to peers
    p2pManager.sendData({
        type: 'incremental_update',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: [entry]
    });
}

// Handle sync request
async function handleSyncRequest(fromPeerId) {
    // Get all history from the last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const historyItems = await chrome.history.search({
        text: '',
        startTime: thirtyDaysAgo,
        maxResults: 1000
    });
    
    const entries = historyItems.map(item => ({
        id: crypto.randomUUID(),
        url: item.url,
        title: item.title || '',
        visitDate: new Date(item.lastVisitTime).toISOString(),
        deviceId: config.deviceId,
        deviceName: config.deviceName
    }));
    
    p2pManager.sendData({
        type: 'full_sync',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: entries
    }, fromPeerId);
}

// Handle full sync
async function handleFullSync(message) {
    const entries = message.data || [];
    
    entries.forEach(entry => {
        historyCache.set(entry.id, entry);
    });
    
    await saveHistoryToStorage();
    console.log(`Received ${entries.length} history entries from ${message.deviceId}`);
}

// Handle incremental update
async function handleIncrementalUpdate(message) {
    const entries = message.data || [];
    
    entries.forEach(entry => {
        historyCache.set(entry.id, entry);
    });
    
    await saveHistoryToStorage();
}

// Search history
async function searchHistory(query) {
    const results = [];
    const lowercaseQuery = query.toLowerCase();
    
    historyCache.forEach(entry => {
        if (entry.url.toLowerCase().includes(lowercaseQuery) ||
            (entry.title && entry.title.toLowerCase().includes(lowercaseQuery))) {
            results.push(entry);
        }
    });
    
    // Sort by date
    results.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    
    return results;
}

// Get all history
async function getAllHistory(deviceId = null) {
    const results = [];
    
    historyCache.forEach(entry => {
        if (!deviceId || entry.deviceId === deviceId) {
            results.push(entry);
        }
    });
    
    // Sort by date
    results.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    
    return results;
}

// Get connected devices
function getConnectedDevices() {
    return Array.from(connectedDevices.values());
}

// Update badge
function updateBadge() {
    const peerCount = connectedDevices.size;
    
    if (peerCount > 0) {
        chrome.action.setBadgeText({ text: peerCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Storage helpers
async function saveHistoryToStorage() {
    const entries = Array.from(historyCache.values());
    await chrome.storage.local.set({ historyCache: entries });
}

async function loadHistoryFromStorage() {
    const stored = await chrome.storage.local.get(['historyCache']);
    if (stored.historyCache) {
        stored.historyCache.forEach(entry => {
            historyCache.set(entry.id, entry);
        });
    }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'create_offer':
            p2pManager.createConnectionOffer().then(offer => {
                // Also save shared secret after creating offer
                chrome.storage.local.set({ sharedSecret: p2pManager.sharedSecret });
                sendResponse({ success: true, offer });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'process_offer':
            p2pManager.processConnectionOffer(request.offer).then(answer => {
                // Save shared secret from offer
                chrome.storage.local.set({ sharedSecret: p2pManager.sharedSecret });
                sendResponse({ success: true, answer });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'complete_connection':
            p2pManager.completeConnection(request.answer).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'search':
            searchHistory(request.query).then(results => {
                sendResponse({ success: true, results });
            });
            return true;
            
        case 'get_history':
            getAllHistory(request.deviceId).then(history => {
                sendResponse({ success: true, history });
            });
            return true;
            
        case 'get_devices':
            sendResponse({ 
                success: true, 
                devices: getConnectedDevices(),
                peerCount: connectedDevices.size
            });
            break;
            
        case 'get_config':
            sendResponse({
                success: true,
                config: {
                    deviceId: config.deviceId,
                    deviceName: config.deviceName,
                    hasSharedSecret: !!p2pManager.sharedSecret,
                    peerCount: connectedDevices.size
                }
            });
            break;
            
        case 'disconnect_peer':
            p2pManager.disconnectPeer(request.peerId);
            sendResponse({ success: true });
            break;
            
        case 'disconnect_all':
            p2pManager.disconnectAll();
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown request type' });
    }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    initialize();
});

// Initialize immediately
initialize();