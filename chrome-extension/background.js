/**
 * background.js - Chrome Extension Background Service Worker
 * Manages WebRTC connections, history tracking, and P2P sync
 */

// Import crypto for HMAC and discovery interface
importScripts('crypto-js.js');
importScripts('connectionShare.js');
importScripts('discoveryInterface.js');
importScripts('cloudflareDiscovery.js');

// Configuration
const config = {
    discoveryMethod: 'websocket', // 'websocket' or 'stun-only'
    signalingServerUrl: 'ws://localhost:8080',
    roomId: 'history-sync-default',
    sharedSecret: null,
    isConnected: false,
    deviceId: null,
    deviceName: 'Chrome Browser',
    stunServers: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302'
    ],
    fallbackMethods: [
        {
            method: 'stun-only',
            config: {
                stunServers: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302'
                ]
            }
        }
    ]
};

// WebRTC configuration
const webRTCConfig = {
    iceServers: config.stunServers.map(url => ({ urls: url }))
};

// State
const discoveryManager = new DiscoveryManager();
let activeDiscovery = null;
const peerConnections = new Map();
const dataChannels = new Map();
const historyCache = new Map();
const connectedDevices = new Map();

// Initialize
async function initialize() {
    // Generate or load device ID
    const stored = await chrome.storage.local.get([
        'deviceId', 
        'discoveryMethod',
        'signalingServerUrl', 
        'roomId', 
        'sharedSecret',
        'stunServers'
    ]);
    
    if (stored.deviceId) {
        config.deviceId = stored.deviceId;
    } else {
        config.deviceId = generateDeviceId();
        await chrome.storage.local.set({ deviceId: config.deviceId });
    }
    
    // Load saved config
    if (stored.discoveryMethod) config.discoveryMethod = stored.discoveryMethod;
    if (stored.signalingServerUrl) config.signalingServerUrl = stored.signalingServerUrl;
    if (stored.roomId) config.roomId = stored.roomId;
    if (stored.sharedSecret) config.sharedSecret = stored.sharedSecret;
    if (stored.stunServers) config.stunServers = stored.stunServers;
    
    // Update WebRTC config with loaded STUN servers
    webRTCConfig.iceServers = config.stunServers.map(url => ({ urls: url }));
    
    // Setup history listener
    chrome.history.onVisited.addListener(handleHistoryVisit);
    
    // Auto-connect if configured
    if (config.sharedSecret || config.discoveryMethod === 'stun-only') {
        await connect();
    }
}

// Generate device ID
function generateDeviceId() {
    return 'chrome-' + Math.random().toString(36).substr(2, 9);
}

// Generate HMAC (for WebSocket discovery)
function generateHMAC(message, secret) {
    return CryptoJS.HmacSHA256(message, secret).toString();
}

// Connect using configured discovery method
async function connect() {
    try {
        // Initialize discovery with appropriate config
        const discoveryConfig = {
            signalingServerUrl: config.signalingServerUrl,
            roomId: config.roomId,
            sharedSecret: config.sharedSecret,
            deviceInfo: {
                id: config.deviceId,
                name: config.deviceName,
                type: 'chrome'
            },
            stunServers: config.stunServers,
            fallbackMethods: config.fallbackMethods
        };
        
        // Add HMAC generation for WebSocket discovery
        if (config.discoveryMethod === 'websocket') {
            discoveryConfig.generateHMAC = generateHMAC;
            discoveryConfig.verifyHMAC = (message, secret) => {
                const expectedHmac = generateHMAC(message.payload, secret);
                return message.hmac === expectedHmac;
            };
        } else if (config.discoveryMethod === 'cloudflare-dns') {
            // Add Cloudflare-specific config
            discoveryConfig.cloudflareApiToken = config.cloudflareApiToken;
            discoveryConfig.cloudflareZoneId = config.cloudflareZoneId;
            discoveryConfig.domain = config.cloudflareDomain;
            discoveryConfig.roomId = config.cloudflareRoomId || config.roomId;
            discoveryConfig.recordPrefix = '_p2psync';
        }
        
        activeDiscovery = await discoveryManager.initialize(config.discoveryMethod, discoveryConfig);
        
        // Set up discovery event handlers
        activeDiscovery.onPeerDiscovered = handlePeerDiscovered;
        activeDiscovery.onPeerLost = handlePeerLost;
        activeDiscovery.onSignalingMessage = handleSignalingMessage;
        activeDiscovery.onError = handleDiscoveryError;
        
        // Start discovery
        await discoveryManager.start();
        
        config.isConnected = true;
        updateBadge(true);
        
        console.log(`Connected using ${config.discoveryMethod} discovery`);
    } catch (error) {
        console.error('Connection failed:', error);
        config.isConnected = false;
        updateBadge(false);
        throw error;
    }
}

// Disconnect
async function disconnect() {
    if (activeDiscovery) {
        await activeDiscovery.stop();
        activeDiscovery = null;
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
        
        await activeDiscovery.sendSignalingMessage(peerId, {
            type: 'offer',
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        });
    } catch (error) {
        console.error(`Failed to create offer for ${peerId}:`, error);
    }
}

// Handle peer lost
function handlePeerLost(peerId, peerInfo) {
    console.log(`Peer lost: ${peerId}`);
    
    const pc = peerConnections.get(peerId);
    if (pc) {
        pc.close();
        peerConnections.delete(peerId);
        dataChannels.delete(peerId);
        connectedDevices.delete(peerId);
    }
}

// Handle signaling message from discovery
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

// Handle discovery error
function handleDiscoveryError(error) {
    console.error('Discovery error:', error);
    config.isConnected = false;
    updateBadge(false);
}

// Create peer connection
function createPeerConnection(remotePeerId) {
    const pc = new RTCPeerConnection(webRTCConfig);
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate && activeDiscovery) {
            activeDiscovery.sendSignalingMessage(remotePeerId, {
                type: 'ice-candidate',
                candidate: {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid
                }
            }).catch(error => {
                console.error('Failed to send ICE candidate:', error);
            });
        }
    };
    
    // Handle connection state
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${remotePeerId}: ${pc.connectionState}`);
        
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

// Handle offer
async function handleOffer(remotePeerId, offer) {
    let pc = peerConnections.get(remotePeerId);
    
    if (!pc) {
        pc = createPeerConnection(remotePeerId);
    }
    
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        await activeDiscovery.sendSignalingMessage(remotePeerId, {
            type: 'answer',
            answer: {
                type: answer.type,
                sdp: answer.sdp
            }
        });
    } catch (error) {
        console.error(`Failed to handle offer from ${remotePeerId}:`, error);
    }
}

// Handle answer
async function handleAnswer(remotePeerId, answer) {
    const pc = peerConnections.get(remotePeerId);
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error(`Failed to handle answer from ${remotePeerId}:`, error);
        }
    }
}

// Handle ICE candidate
async function handleIceCandidate(remotePeerId, candidate) {
    const pc = peerConnections.get(remotePeerId);
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error(`Failed to add ICE candidate from ${remotePeerId}:`, error);
        }
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
            
        case 'create_connection_offer':
            // Create a connection offer for STUN-only mode
            if (activeDiscovery && activeDiscovery.createConnectionOffer) {
                activeDiscovery.createConnectionOffer()
                    .then(result => {
                        sendResponse({ success: true, ...result });
                    })
                    .catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                return true;
            } else {
                sendResponse({ success: false, error: 'Not in STUN-only mode' });
            }
            break;
            
        case 'process_connection':
            // Process a connection offer or response
            if (activeDiscovery && activeDiscovery.processConnectionOffer) {
                const data = request.data.trim();
                
                // Detect if it's an offer or response
                try {
                    const decoded = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/')));
                    const isOffer = !!decoded.offer;
                    
                    if (isOffer) {
                        activeDiscovery.processConnectionOffer(data)
                            .then(result => {
                                sendResponse({ success: true, isOffer: true, ...result });
                            })
                            .catch(error => {
                                sendResponse({ success: false, error: error.message });
                            });
                    } else {
                        activeDiscovery.processConnectionResponse(data)
                            .then(result => {
                                sendResponse({ success: true, isOffer: false, ...result });
                            })
                            .catch(error => {
                                sendResponse({ success: false, error: error.message });
                            });
                    }
                } catch (error) {
                    sendResponse({ success: false, error: 'Invalid connection data' });
                }
                return true;
            } else {
                sendResponse({ success: false, error: 'Not in STUN-only mode' });
            }
            break;
            
        case 'get_connection_stats':
            // Get connection statistics for STUN-only mode
            if (activeDiscovery && activeDiscovery.getConnectionStats) {
                const stats = activeDiscovery.getConnectionStats();
                sendResponse({ success: true, stats });
            } else {
                sendResponse({ success: false, error: 'Not in STUN-only mode' });
            }
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