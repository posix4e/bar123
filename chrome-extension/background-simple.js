/**
 * background.js - Simplified Chrome Extension Background Service Worker
 * Uses only Cloudflare DNS for peer discovery
 */

importScripts('cloudflareDiscovery.js');

// Configuration
const config = {
    roomId: 'default-room',
    deviceId: null,
    deviceName: 'Chrome Browser',
    isConnected: false,
    
    // Cloudflare settings
    cloudflareApiToken: '',
    cloudflareZoneId: '',
    cloudflareDomain: '',
    cloudflareEnabled: false
};

// WebRTC configuration (only STUN, no signaling)
const webRTCConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// State
let discovery = null;
const peerConnections = new Map();
const dataChannels = new Map();
const historyCache = new Map();
const connectedDevices = new Map();

// Initialize
async function initialize() {
    // Generate or load device ID
    const stored = await chrome.storage.local.get([
        'deviceId',
        'roomId',
        'cloudflareApiToken',
        'cloudflareZoneId',
        'cloudflareDomain',
        'cloudflareEnabled'
    ]);

    if (stored.deviceId) {
        config.deviceId = stored.deviceId;
    } else {
        config.deviceId = 'chrome-' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ deviceId: config.deviceId });
    }

    // Load saved config
    Object.keys(stored).forEach(key => {
        if (stored[key] !== undefined) {
            config[key] = stored[key];
        }
    });

    // Setup history listener
    chrome.history.onVisited.addListener(handleHistoryVisit);

    // Auto-connect if configured
    if (config.cloudflareEnabled && config.cloudflareApiToken) {
        await connect();
    }
}

// Connect using Cloudflare DNS
async function connect() {
    try {
        // Initialize Cloudflare discovery
        discovery = new CloudflareDNSDiscovery({
            apiToken: config.cloudflareApiToken,
            zoneId: config.cloudflareZoneId,
            domain: config.cloudflareDomain,
            roomId: config.roomId,
            deviceInfo: {
                id: config.deviceId,
                name: config.deviceName,
                type: 'chrome'
            }
        });

        // Set up event handlers
        discovery.onPeerDiscovered = handlePeerDiscovered;
        discovery.onPeerLost = handlePeerLost;
        discovery.onSignalingMessage = handleSignalingMessage;

        // Start discovery
        await discovery.start();

        config.isConnected = true;
        updateBadge(true);

        console.log('Connected using Cloudflare DNS discovery');
    } catch (error) {
        console.error('Connection failed:', error);
        config.isConnected = false;
        updateBadge(false);
        throw error;
    }
}

// Disconnect
async function disconnect() {
    if (discovery) {
        await discovery.stop();
        discovery = null;
    }

    // Clean up peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    dataChannels.clear();
    connectedDevices.clear();

    config.isConnected = false;
    updateBadge(false);
}

// Handle peer discovered
async function handlePeerDiscovered(peerId, peerInfo) {
    console.log(`Peer discovered: ${peerId}`, peerInfo);

    // Create peer connection and offer
    const pc = createPeerConnection(peerId);

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await discovery.sendSignalingMessage(peerId, {
            type: 'offer',
            offer: offer.toJSON()
        });
    } catch (error) {
        console.error(`Failed to create offer for ${peerId}:`, error);
    }
}

// Handle peer lost
function handlePeerLost(peerId) {
    console.log(`Peer lost: ${peerId}`);

    const pc = peerConnections.get(peerId);
    if (pc) {
        pc.close();
        peerConnections.delete(peerId);
        dataChannels.delete(peerId);
        connectedDevices.delete(peerId);
    }
}

// Handle signaling message
async function handleSignalingMessage(fromPeerId, message) {
    switch (message.type) {
    case 'offer':
        await handleOffer(fromPeerId, message.offer);
        break;
    case 'answer':
        await handleAnswer(fromPeerId, message.answer);
        break;
    case 'ice-candidate':
        await handleIceCandidate(fromPeerId, message.candidate);
        break;
    }
}

// Create peer connection
function createPeerConnection(remotePeerId) {
    const pc = new RTCPeerConnection(webRTCConfig);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate && discovery) {
            discovery.sendSignalingMessage(remotePeerId, {
                type: 'ice-candidate',
                candidate: event.candidate.toJSON()
            }).catch(error => {
                console.error('Failed to send ICE candidate:', error);
            });
        }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${remotePeerId}: ${pc.connectionState}`);
        
        if (pc.connectionState === 'connected') {
            sendDeviceInfo(remotePeerId);
        }
    };

    // Create data channel
    const dataChannel = pc.createDataChannel('history-sync', {
        ordered: true
    });

    setupDataChannel(dataChannel, remotePeerId);

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, remotePeerId);
    };

    peerConnections.set(remotePeerId, pc);
    return pc;
}

// Setup data channel
function setupDataChannel(channel, remotePeerId) {
    channel.onopen = () => {
        console.log(`Data channel opened with ${remotePeerId}`);
        dataChannels.set(remotePeerId, channel);

        // Request sync
        sendMessage({
            type: 'sync_request',
            timestamp: new Date().toISOString(),
            deviceId: config.deviceId
        }, remotePeerId);
    };

    channel.onmessage = (event) => {
        handleDataChannelMessage(event.data, remotePeerId);
    };

    channel.onclose = () => {
        console.log(`Data channel closed with ${remotePeerId}`);
        dataChannels.delete(remotePeerId);
    };
}

// Handle WebRTC offers/answers/candidates
async function handleOffer(remotePeerId, offer) {
    let pc = peerConnections.get(remotePeerId);
    if (!pc) {
        pc = createPeerConnection(remotePeerId);
    }

    try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await discovery.sendSignalingMessage(remotePeerId, {
            type: 'answer',
            answer: answer.toJSON()
        });
    } catch (error) {
        console.error(`Failed to handle offer from ${remotePeerId}:`, error);
    }
}

async function handleAnswer(remotePeerId, answer) {
    const pc = peerConnections.get(remotePeerId);
    if (pc) {
        try {
            await pc.setRemoteDescription(answer);
        } catch (error) {
            console.error(`Failed to handle answer from ${remotePeerId}:`, error);
        }
    }
}

async function handleIceCandidate(remotePeerId, candidate) {
    const pc = peerConnections.get(remotePeerId);
    if (pc) {
        try {
            await pc.addIceCandidate(candidate);
        } catch (error) {
            console.error(`Failed to add ICE candidate from ${remotePeerId}:`, error);
        }
    }
}

// Handle data channel messages
function handleDataChannelMessage(data, remotePeerId) {
    try {
        const message = JSON.parse(data);

        switch (message.type) {
        case 'device_info':
            connectedDevices.set(remotePeerId, message.data);
            break;
        case 'full_sync':
            handleFullSync(message);
            break;
        case 'incremental_update':
            handleIncrementalUpdate(message);
            break;
        case 'sync_request':
            handleSyncRequest(remotePeerId);
            break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

// Send message
function sendMessage(message, remotePeerId = null) {
    const messageString = JSON.stringify(message);

    if (remotePeerId) {
        const channel = dataChannels.get(remotePeerId);
        if (channel && channel.readyState === 'open') {
            channel.send(messageString);
        }
    } else {
        // Broadcast to all
        dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                channel.send(messageString);
            }
        });
    }
}

// Send device info
function sendDeviceInfo(remotePeerId) {
    sendMessage({
        type: 'device_info',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: {
            id: config.deviceId,
            name: config.deviceName,
            type: 'chrome',
            lastSeen: new Date().toISOString()
        }
    }, remotePeerId);
}

// Handle history visit
async function handleHistoryVisit(historyItem) {
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

    // Send to peers
    sendMessage({
        type: 'incremental_update',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: [entry]
    });
}

// Handle sync request
async function handleSyncRequest(remotePeerId) {
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

    sendMessage({
        type: 'full_sync',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: entries
    }, remotePeerId);
}

// Handle full sync
function handleFullSync(message) {
    const entries = message.data || [];
    entries.forEach(entry => {
        historyCache.set(entry.id, entry);
    });
    console.log(`Received ${entries.length} history entries from ${message.deviceId}`);
}

// Handle incremental update
function handleIncrementalUpdate(message) {
    const entries = message.data || [];
    entries.forEach(entry => {
        historyCache.set(entry.id, entry);
    });
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

    results.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    return results;
}

// Update badge
function updateBadge(connected) {
    if (connected) {
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
    case 'connect':
        connect().then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;

    case 'disconnect':
        disconnect().then(() => {
            sendResponse({ success: true });
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
            devices: Array.from(connectedDevices.values()) 
        });
        break;

    case 'get_config':
        sendResponse({
            success: true,
            config: {
                ...config,
                cloudflareApiToken: config.cloudflareApiToken ? '***' : null
            }
        });
        break;

    case 'update_config':
        Object.assign(config, request.config);
        chrome.storage.local.set(request.config).then(() => {
            sendResponse({ success: true });
        });
        return true;

    default:
        sendResponse({ success: false, error: 'Unknown request type' });
    }
});

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

// Initialize immediately
initialize();