/**
 * background.js - Chrome Extension Background Service Worker
 * Manages WebRTC connections, history tracking, and P2P sync
 */

// Import crypto for HMAC
importScripts('crypto-js.js');

// Configuration
const config = {
    signalingServerUrl: 'ws://localhost:8080',
    roomId: 'history-sync-default',
    sharedSecret: null,
    isConnected: false,
    deviceId: null,
    deviceName: 'Chrome Browser'
};

// WebRTC configuration
const webRTCConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// State
let webSocket = null;
const peerConnections = new Map();
const dataChannels = new Map();
const historyCache = new Map();
const connectedDevices = new Map();

// Initialize
async function initialize() {
    // Generate or load device ID
    const stored = await chrome.storage.local.get(['deviceId', 'signalingServerUrl', 'roomId', 'sharedSecret']);
    
    if (stored.deviceId) {
        config.deviceId = stored.deviceId;
    } else {
        config.deviceId = generateDeviceId();
        await chrome.storage.local.set({ deviceId: config.deviceId });
    }
    
    // Load saved config
    if (stored.signalingServerUrl) config.signalingServerUrl = stored.signalingServerUrl;
    if (stored.roomId) config.roomId = stored.roomId;
    if (stored.sharedSecret) config.sharedSecret = stored.sharedSecret;
    
    // Setup history listener
    chrome.history.onVisited.addListener(handleHistoryVisit);
    
    // Auto-connect if configured
    if (config.sharedSecret) {
        await connect();
    }
}

// Generate device ID
function generateDeviceId() {
    return 'chrome-' + Math.random().toString(36).substr(2, 9);
}

// Generate HMAC
function generateHMAC(data) {
    const dataString = JSON.stringify(data);
    return CryptoJS.HmacSHA256(dataString, config.sharedSecret).toString();
}

// Verify HMAC
function verifyHMAC(message) {
    if (!message.hmac || !message.data) return false;
    
    const dataString = JSON.stringify(message.data);
    const expectedHmac = CryptoJS.HmacSHA256(dataString, config.sharedSecret).toString();
    
    return message.hmac === expectedHmac;
}

// Connect to signaling server
async function connect() {
    if (!config.sharedSecret) {
        throw new Error('No shared secret configured');
    }
    
    return new Promise((resolve, reject) => {
        webSocket = new WebSocket(config.signalingServerUrl);
        
        webSocket.onopen = () => {
            console.log('Connected to signaling server');
            
            // Send join message
            sendSignalingMessage({
                type: 'join',
                roomId: config.roomId,
                peerId: config.deviceId,
                deviceInfo: {
                    name: config.deviceName,
                    type: 'chrome'
                }
            });
            
            config.isConnected = true;
            updateBadge(true);
            resolve();
        };
        
        webSocket.onmessage = (event) => {
            handleSignalingMessage(event.data);
        };
        
        webSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            config.isConnected = false;
            updateBadge(false);
            reject(error);
        };
        
        webSocket.onclose = () => {
            console.log('Disconnected from signaling server');
            config.isConnected = false;
            updateBadge(false);
            
            // Clean up peer connections
            peerConnections.forEach(pc => pc.close());
            peerConnections.clear();
            dataChannels.clear();
        };
    });
}

// Disconnect
async function disconnect() {
    if (webSocket) {
        webSocket.close();
        webSocket = null;
    }
    
    config.isConnected = false;
    updateBadge(false);
}

// Send signaling message
function sendSignalingMessage(data) {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        return;
    }
    
    const message = {
        data: data,
        hmac: generateHMAC(data)
    };
    
    webSocket.send(JSON.stringify(message));
}

// Handle signaling message
function handleSignalingMessage(messageText) {
    try {
        const message = JSON.parse(messageText);
        
        if (!verifyHMAC(message)) {
            console.error('Invalid HMAC');
            return;
        }
        
        const data = message.data;
        
        switch (data.type) {
            case 'room-peers':
                handleRoomPeers(data);
                break;
            case 'peer-joined':
                handlePeerJoined(data);
                break;
            case 'offer':
                handleOffer(data);
                break;
            case 'answer':
                handleAnswer(data);
                break;
            case 'ice-candidate':
                handleIceCandidate(data);
                break;
            case 'peer-left':
                handlePeerLeft(data);
                break;
        }
    } catch (error) {
        console.error('Error handling signaling message:', error);
    }
}

// Create peer connection
function createPeerConnection(remotePeerId) {
    const pc = new RTCPeerConnection(webRTCConfig);
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage({
                type: 'ice-candidate',
                targetPeerId: remotePeerId,
                candidate: {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid
                }
            });
        }
    };
    
    // Handle connection state
    pc.onconnectionstatechange = () => {
        console.log(`Connection state: ${pc.connectionState}`);
        
        if (pc.connectionState === 'connected') {
            // Peer connected, send device info
            sendDeviceInfo(remotePeerId);
        }
    };
    
    // Create data channel
    const dataChannel = pc.createDataChannel('history-sync', {
        ordered: true
    });
    
    dataChannel.onopen = () => {
        console.log(`Data channel opened with ${remotePeerId}`);
        dataChannels.set(remotePeerId, dataChannel);
        
        // Request full sync
        sendSyncMessage({
            type: 'sync_request',
            timestamp: new Date().toISOString(),
            deviceId: config.deviceId
        }, remotePeerId);
    };
    
    dataChannel.onmessage = (event) => {
        handleDataChannelMessage(event.data, remotePeerId);
    };
    
    dataChannel.onclose = () => {
        console.log(`Data channel closed with ${remotePeerId}`);
        dataChannels.delete(remotePeerId);
    };
    
    // Handle incoming data channel
    pc.ondatachannel = (event) => {
        const channel = event.channel;
        
        channel.onopen = () => {
            console.log(`Incoming data channel opened from ${remotePeerId}`);
            dataChannels.set(remotePeerId, channel);
        };
        
        channel.onmessage = (event) => {
            handleDataChannelMessage(event.data, remotePeerId);
        };
        
        channel.onclose = () => {
            dataChannels.delete(remotePeerId);
        };
    };
    
    peerConnections.set(remotePeerId, pc);
    return pc;
}

// Handle room peers
async function handleRoomPeers(data) {
    const peers = data.peers || [];
    
    for (const peer of peers) {
        const pc = createPeerConnection(peer.peerId);
        
        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignalingMessage({
            type: 'offer',
            targetPeerId: peer.peerId,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        });
    }
}

// Handle peer joined
function handlePeerJoined(data) {
    console.log(`Peer joined: ${data.peerId}`);
    // Wait for their offer
}

// Handle offer
async function handleOffer(data) {
    const remotePeerId = data.fromPeerId;
    const pc = createPeerConnection(remotePeerId);
    
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    sendSignalingMessage({
        type: 'answer',
        targetPeerId: remotePeerId,
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    });
}

// Handle answer
async function handleAnswer(data) {
    const pc = peerConnections.get(data.fromPeerId);
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
}

// Handle ICE candidate
async function handleIceCandidate(data) {
    const pc = peerConnections.get(data.fromPeerId);
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

// Handle peer left
function handlePeerLeft(data) {
    const pc = peerConnections.get(data.peerId);
    if (pc) {
        pc.close();
        peerConnections.delete(data.peerId);
        dataChannels.delete(data.peerId);
        connectedDevices.delete(data.peerId);
    }
}

// Handle data channel message
function handleDataChannelMessage(data, remotePeerId) {
    try {
        const message = JSON.parse(data);
        
        switch (message.type) {
            case 'device_info':
                handleDeviceInfo(message, remotePeerId);
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
        console.error('Error handling data channel message:', error);
    }
}

// Send device info
function sendDeviceInfo(remotePeerId) {
    const deviceInfo = {
        id: config.deviceId,
        name: config.deviceName,
        type: 'chrome',
        lastSeen: new Date().toISOString(),
        isConnected: true
    };
    
    sendSyncMessage({
        type: 'device_info',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: deviceInfo
    }, remotePeerId);
}

// Handle device info
function handleDeviceInfo(message, remotePeerId) {
    connectedDevices.set(remotePeerId, message.data);
}

// Send sync message
function sendSyncMessage(message, remotePeerId = null) {
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
    
    // Send to peers
    sendSyncMessage({
        type: 'incremental_update',
        timestamp: new Date().toISOString(),
        deviceId: config.deviceId,
        data: [entry]
    });
}

// Handle sync request
async function handleSyncRequest(remotePeerId) {
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
    
    sendSyncMessage({
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
            sendResponse({ success: true, devices: getConnectedDevices() });
            break;
            
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
            chrome.storage.local.set(request.config).then(() => {
                sendResponse({ success: true });
            });
            return true;
            
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