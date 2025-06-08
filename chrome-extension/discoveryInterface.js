// Base interface for peer discovery mechanisms
class PeerDiscovery {
    constructor(config) {
        this.config = config;
        this.peers = new Map();
        this.onPeerDiscovered = null;
        this.onPeerLost = null;
        this.onSignalingMessage = null;
        this.onError = null;
    }

    // Abstract methods that must be implemented by subclasses
    async start() {
        throw new Error('start() must be implemented by subclass');
    }

    async stop() {
        throw new Error('stop() must be implemented by subclass');
    }

    async sendSignalingMessage(peerId, message) {
        throw new Error('sendSignalingMessage() must be implemented by subclass');
    }

    // Common helper methods
    addPeer(peerId, peerInfo) {
        this.peers.set(peerId, peerInfo);
        if (this.onPeerDiscovered) {
            this.onPeerDiscovered(peerId, peerInfo);
        }
    }

    removePeer(peerId) {
        const peerInfo = this.peers.get(peerId);
        this.peers.delete(peerId);
        if (this.onPeerLost) {
            this.onPeerLost(peerId, peerInfo);
        }
    }

    handleSignalingMessage(fromPeerId, message) {
        if (this.onSignalingMessage) {
            this.onSignalingMessage(fromPeerId, message);
        }
    }

    handleError(error) {
        console.error('Discovery error:', error);
        if (this.onError) {
            this.onError(error);
        }
    }

    getPeers() {
        return Array.from(this.peers.entries());
    }

    getPeer(peerId) {
        return this.peers.get(peerId);
    }
}

// WebSocket-based discovery (existing implementation)
class WebSocketDiscovery extends PeerDiscovery {
    constructor(config) {
        super(config);
        this.ws = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
    }

    async start() {
        try {
            await this.connect();
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async stop() {
        this.clearTimers();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.peers.clear();
    }

    async connect() {
        const { signalingServerUrl, roomId, sharedSecret, deviceInfo } = this.config;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(signalingServerUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to signaling server');
                this.sendAuthenticatedMessage({
                    type: 'join',
                    roomId: roomId,
                    deviceInfo: deviceInfo
                });
                this.startHeartbeat();
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (!this.verifyHMAC(message, sharedSecret)) {
                    console.error('Invalid HMAC signature');
                    return;
                }
                
                this.handleServerMessage(message);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.handleError(error);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from signaling server');
                this.peers.clear();
                this.scheduleReconnect();
            };
            
            // Set a timeout for initial connection
            setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    this.ws.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    async sendSignalingMessage(peerId, message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to signaling server');
        }
        
        this.sendAuthenticatedMessage({
            type: 'signal',
            to: peerId,
            signal: message
        });
    }

    sendAuthenticatedMessage(data) {
        const { sharedSecret } = this.config;
        const timestamp = Date.now();
        const payload = JSON.stringify({ ...data, timestamp });
        const hmac = this.generateHMAC(payload, sharedSecret);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ payload, hmac }));
        }
    }

    handleServerMessage(message) {
        const data = JSON.parse(message.payload);
        
        switch (data.type) {
            case 'peers':
                // Initial peer list when joining room
                data.peers.forEach(peer => {
                    this.addPeer(peer.id, peer.deviceInfo);
                });
                break;
                
            case 'peer_joined':
                this.addPeer(data.peerId, data.deviceInfo);
                break;
                
            case 'peer_left':
                this.removePeer(data.peerId);
                break;
                
            case 'signal':
                this.handleSignalingMessage(data.from, data.signal);
                break;
                
            case 'error':
                this.handleError(new Error(data.message));
                break;
        }
    }

    generateHMAC(message, secret) {
        // This would use Web Crypto API in real implementation
        // Placeholder for now - should match server implementation
        return 'hmac_placeholder';
    }

    verifyHMAC(message, secret) {
        // This would use Web Crypto API in real implementation
        // Placeholder for now - should match server implementation
        return true;
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendAuthenticatedMessage({ type: 'ping' });
        }, 30000);
    }

    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    scheduleReconnect() {
        this.clearTimers();
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                this.scheduleReconnect();
            });
        }, 5000);
    }
}

// Import connection sharing utilities
if (typeof ConnectionShare === 'undefined' && typeof importScripts !== 'undefined') {
    importScripts('connectionShare.js');
}

// STUN-only discovery (serverless, using STUN for public IP discovery)
class STUNOnlyDiscovery extends PeerDiscovery {
    constructor(config) {
        super(config);
        this.stunServers = config.stunServers || [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
        ];
        this.pendingConnections = new Map();
        this.activeConnections = new Map();
        this.connectionOffers = new Map();
    }

    async start() {
        try {
            console.log('STUN-only discovery started. Manual peer exchange required.');
            
            // Listen for connection links in the URL
            if (typeof window !== 'undefined') {
                window.addEventListener('hashchange', () => this.handleConnectionLink());
                this.handleConnectionLink(); // Check current URL
            }
            
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async stop() {
        // Close all connections
        for (const [peerId, connection] of this.activeConnections) {
            if (connection.pc) {
                connection.pc.close();
            }
        }
        this.activeConnections.clear();
        this.pendingConnections.clear();
        this.connectionOffers.clear();
        this.peers.clear();
    }

    async sendSignalingMessage(peerId, message) {
        // Store the message for the connection flow
        if (!this.pendingConnections.has(peerId)) {
            this.pendingConnections.set(peerId, []);
        }
        this.pendingConnections.get(peerId).push(message);
    }

    // Create a connection offer for sharing
    async createConnectionOffer() {
        const localInfo = {
            deviceId: this.config.deviceInfo.id,
            deviceName: this.config.deviceInfo.name,
            stunServers: this.stunServers
        };
        
        try {
            const offerData = await ConnectionShare.createOffer(localInfo);
            const offerId = offerData.id;
            
            // Store the offer
            this.connectionOffers.set(offerId, {
                data: offerData,
                created: Date.now(),
                localInfo
            });
            
            // Clean up old offers after 5 minutes
            setTimeout(() => {
                this.connectionOffers.delete(offerId);
            }, 5 * 60 * 1000);
            
            return {
                offer: offerData,
                shareText: ConnectionShare.format(offerData, true),
                encoded: ConnectionShare.encode(offerData),
                link: ConnectionShare.createLink(offerData)
            };
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    // Process a connection offer received from another peer
    async processConnectionOffer(encodedOffer) {
        try {
            const offerData = ConnectionShare.decode(encodedOffer);
            
            if (!ConnectionShare.validateConnectionData(offerData)) {
                throw new Error('Invalid connection offer');
            }
            
            // Check if offer is expired (older than 5 minutes)
            if (Date.now() - offerData.ts > 5 * 60 * 1000) {
                throw new Error('Connection offer has expired');
            }
            
            const localInfo = {
                deviceId: this.config.deviceInfo.id,
                deviceName: this.config.deviceInfo.name,
                stunServers: this.stunServers
            };
            
            // Create response
            const responseData = await ConnectionShare.createResponse(offerData, localInfo);
            
            // Establish connection with the response
            const { pc, remoteId, remoteName } = await this.completeResponseConnection(responseData, offerData);
            
            // Add peer
            const peerInfo = {
                id: remoteId,
                name: remoteName,
                type: 'manual'
            };
            
            this.activeConnections.set(remoteId, { pc, info: peerInfo });
            this.addPeer(remoteId, peerInfo);
            
            // Set up data channel handlers
            this.setupDataChannel(pc, remoteId);
            
            return {
                response: responseData,
                shareText: ConnectionShare.format(responseData, false),
                encoded: ConnectionShare.encode(responseData),
                peerId: remoteId
            };
            
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    // Process a connection response
    async processConnectionResponse(encodedResponse) {
        try {
            const responseData = ConnectionShare.decode(encodedResponse);
            
            if (!ConnectionShare.validateConnectionData(responseData)) {
                throw new Error('Invalid connection response');
            }
            
            // Complete the connection
            const { pc, remoteId, remoteName } = await ConnectionShare.completeConnection(responseData);
            
            // Add peer
            const peerInfo = {
                id: remoteId,
                name: remoteName,
                type: 'manual'
            };
            
            this.activeConnections.set(remoteId, { pc, info: peerInfo });
            this.addPeer(remoteId, peerInfo);
            
            // Set up data channel handlers
            this.setupDataChannel(pc, remoteId);
            
            // Process any pending messages
            if (this.pendingConnections.has(remoteId)) {
                const messages = this.pendingConnections.get(remoteId);
                this.pendingConnections.delete(remoteId);
                
                for (const message of messages) {
                    this.handleSignalingMessage(message, remoteId);
                }
            }
            
            return {
                success: true,
                peerId: remoteId,
                peerName: remoteName
            };
            
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    // Helper to complete connection from response side
    async completeResponseConnection(responseData, offerData) {
        return new Promise((resolve, reject) => {
            const pc = ConnectionShare.pendingConnection.pc;
            
            pc.ondatachannel = (event) => {
                const channel = event.channel;
                channel.onopen = () => {
                    resolve({
                        pc,
                        remoteId: offerData.id,
                        remoteName: offerData.name
                    });
                };
            };
            
            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 30000);
        });
    }

    // Set up data channel event handlers
    setupDataChannel(pc, remoteId) {
        // Handle incoming data channels
        pc.ondatachannel = (event) => {
            const channel = event.channel;
            
            channel.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleSignalingMessage(message, remoteId);
                } catch (error) {
                    console.error('Failed to parse data channel message:', error);
                }
            };
            
            channel.onerror = (error) => {
                console.error('Data channel error:', error);
            };
            
            channel.onclose = () => {
                this.removePeer(remoteId);
                this.activeConnections.delete(remoteId);
            };
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                this.removePeer(remoteId);
                this.activeConnections.delete(remoteId);
            }
        };
    }

    // Handle connection links from URL
    handleConnectionLink() {
        if (typeof window === 'undefined') return;
        
        const connectionData = ConnectionShare.parseLink(window.location.href);
        if (connectionData) {
            // Clear the hash to prevent reprocessing
            window.location.hash = '';
            
            // Notify about the connection offer
            if (this.onConnectionOffer) {
                this.onConnectionOffer(ConnectionShare.encode(connectionData));
            }
        }
    }

    // Get connection statistics
    getConnectionStats() {
        const stats = {
            active: this.activeConnections.size,
            pending: this.pendingConnections.size,
            offers: this.connectionOffers.size,
            peers: []
        };
        
        for (const [peerId, connection] of this.activeConnections) {
            stats.peers.push({
                id: peerId,
                name: connection.info.name,
                state: connection.pc.connectionState
            });
        }
        
        return stats;
    }
}

// Discovery manager to handle multiple discovery methods
class DiscoveryManager {
    constructor() {
        this.activeDiscovery = null;
        this.fallbackDiscoveries = [];
    }

    async initialize(method, config) {
        // Stop any existing discovery
        if (this.activeDiscovery) {
            await this.activeDiscovery.stop();
        }

        // Create the appropriate discovery instance
        switch (method) {
            case 'websocket':
                this.activeDiscovery = new WebSocketDiscovery(config);
                break;
            case 'stun-only':
                this.activeDiscovery = new STUNOnlyDiscovery(config);
                break;
            case 'cloudflare-dns':
                this.activeDiscovery = new CloudflareDNSDiscovery(config);
                break;
            default:
                throw new Error(`Unknown discovery method: ${method}`);
        }

        // Set up fallback chain if configured
        if (config.fallbackMethods) {
            this.fallbackDiscoveries = config.fallbackMethods.map(fallback => {
                switch (fallback.method) {
                    case 'websocket':
                        return new WebSocketDiscovery(fallback.config);
                    case 'stun-only':
                        return new STUNOnlyDiscovery(fallback.config);
                    case 'cloudflare-dns':
                        return new CloudflareDNSDiscovery(fallback.config);
                    default:
                        return null;
                }
            }).filter(d => d !== null);
        }

        return this.activeDiscovery;
    }

    async start() {
        if (!this.activeDiscovery) {
            throw new Error('Discovery not initialized');
        }

        try {
            await this.activeDiscovery.start();
        } catch (error) {
            // Try fallback methods
            for (const fallback of this.fallbackDiscoveries) {
                try {
                    console.log('Primary discovery failed, trying fallback...');
                    await this.activeDiscovery.stop();
                    this.activeDiscovery = fallback;
                    await this.activeDiscovery.start();
                    break;
                } catch (fallbackError) {
                    console.error('Fallback discovery failed:', fallbackError);
                }
            }
            
            if (!this.activeDiscovery) {
                throw error;
            }
        }
    }

    getActiveDiscovery() {
        return this.activeDiscovery;
    }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PeerDiscovery, WebSocketDiscovery, STUNOnlyDiscovery, DiscoveryManager };
}