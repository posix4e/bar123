// Import Trystero - Safari extension style (bundled locally)
importScripts('trystero-bundle.js');

class HistorySyncService {
    constructor() {
        this.isConnected = false;
        this.websocket = null;
        this.peers = new Map();
        this.localHistory = [];
        this.deviceId = this.generateDeviceId();
        this.roomId = null;
        this.sharedSecret = null;
        this.lastSyncTime = null;
        this.clearTombstones = new Map(); // Track clear operations with expiration
        
        this.init();
    }

    init() {
        this.loadLocalHistory();
        this.setupMessageHandlers();
        // Clean up expired tombstones every 5 minutes
        setInterval(() => this.cleanupExpiredTombstones(), 5 * 60 * 1000);
    }

    generateDeviceId() {
        // Use a persistent device ID so reconnections work
        const stored = localStorage.getItem('deviceId');
        if (stored) return stored;
        
        const newId = 'ios_safari_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('deviceId', newId);
        return newId;
    }

    cleanupExpiredTombstones() {
        const now = Date.now();
        const TOMBSTONE_TTL = 10 * 60 * 1000; // 10 minutes
        
        for (const [clearId, timestamp] of this.clearTombstones.entries()) {
            if (now - timestamp > TOMBSTONE_TTL) {
                this.clearTombstones.delete(clearId);
            }
        }
        
        if (this.clearTombstones.size > 0) {
            this.saveLocalHistory(); // Save updated tombstones
        }
    }

    generateClearId() {
        return `${this.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    async loadLocalHistory() {
        const stored = await browser.storage.local.get(['localHistory', 'lastSyncTime', 'clearTombstones']);
        this.localHistory = stored.localHistory || [];
        this.lastSyncTime = stored.lastSyncTime || null;
        this.clearTombstones = new Map(stored.clearTombstones || []);
        this.cleanupExpiredTombstones();
    }

    async saveLocalHistory() {
        await browser.storage.local.set({
            localHistory: this.localHistory,
            lastSyncTime: this.lastSyncTime,
            localHistoryCount: this.localHistory.length,
            clearTombstones: Array.from(this.clearTombstones.entries())
        });
    }

    setupMessageHandlers() {
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'connect':
                    this.connect(request.sharedSecret)
                        .then(() => sendResponse({ success: true }))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;

                case 'disconnect':
                    this.disconnect();
                    sendResponse({ success: true });
                    break;

                case 'trackHistory':
                    console.log('📝 Tracking history entry:', request.entry);
                    this.addHistoryEntry(request.entry);
                    sendResponse({ success: true });
                    break;

                case 'updateDuration':
                    this.updateEntryDuration(request.url, request.duration);
                    sendResponse({ success: true });
                    break;

                case 'clearLocal':
                    this.clearLocalHistory();
                    sendResponse({ success: true });
                    break;

                case 'deleteRemote':
                    this.deleteRemoteHistory();
                    sendResponse({ success: true });
                    break;

                case 'getStats':
                    sendResponse({
                        isConnected: this.isConnected,
                        deviceCount: this.peers.size,
                        localHistoryCount: this.localHistory.length,
                        lastSyncTime: this.lastSyncTime
                    });
                    break;

                case 'debugSync':
                    console.log('🔧 Debug sync requested');
                    console.log(`Connected peers: ${this.peers.size}`);
                    this.peers.forEach((peer, peerId) => {
                        console.log(`Peer ${peerId}: connection=${!!peer.connection}, open=${peer.connection?.open}`);
                        if (peer.connection?.open) {
                            console.log(`Triggering manual sync with ${peerId}`);
                            this.syncHistoryWithPeer(peerId);
                        }
                    });
                    sendResponse({ success: true, peerCount: this.peers.size });
                    break;

                case 'getHistory':
                    sendResponse({ 
                        success: true, 
                        history: this.localHistory.slice(0, 50) // Return last 50 entries
                    });
                    break;
            }
        });
    }

    async connect(sharedSecret) {
        this.sharedSecret = sharedSecret;
        this.roomId = await this.hashSecret(sharedSecret);
        
        try {
            await this.loadPeerJS();
            await this.initializePeerJS();
            
            console.log('Connected to PeerJS');
            this.isConnected = true;
            this.updateStorageAndUI();
        } catch (error) {
            throw new Error('Failed to connect to PeerJS: ' + error.message);
        }
    }

    async loadPeerJS() {
        // PeerJS is now bundled locally via manifest.json
        if (typeof Peer !== 'undefined') return;
        throw new Error('PeerJS not loaded - check manifest.json');
    }

    async initializePeerJS() {
        // Create both a unique peer ID and try to be a "hub" peer
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        this.myPeerId = `${this.roomId}_${timestamp}_${random}`;
        this.hubPeerId = `${this.roomId}_hub`;
        
        console.log('🆔 My peer ID:', this.myPeerId);
        console.log('🌟 Hub peer ID:', this.hubPeerId);
        
        // First, try to become the hub
        await this.tryToBeHub();
        
        // Try multiple PeerJS servers in order
        const servers = [
            { host: '0.peerjs.com', port: 443, path: '/', secure: true },
            { host: '1.peerjs.com', port: 443, path: '/', secure: true },
            { key: 'peerjs', secure: true } // Use default PeerJS cloud
        ];

        for (let i = 0; i < servers.length; i++) {
            try {
                console.log(`Trying PeerJS server ${i + 1}/${servers.length}:`, servers[i]);
                
                const peerId = this.isHub ? this.hubPeerId : this.myPeerId;
                console.log(`Creating peer with ID: ${peerId} (isHub: ${this.isHub})`);
                
                this.peer = new Peer(peerId, {
                    ...servers[i],
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });

                await this.waitForPeerConnection();
                console.log('✅ Successfully connected to PeerJS');
                return;
                
            } catch (error) {
                console.log(`❌ Server ${i + 1} failed:`, error.message);
                
                if (error.message === 'retry_as_client') {
                    console.log('🔄 Retrying as client...');
                    if (this.peer) {
                        this.peer.destroy();
                        this.peer = null;
                    }
                    i--; // Retry the same server
                    continue;
                }
                
                if (this.peer) {
                    this.peer.destroy();
                    this.peer = null;
                }
                
                if (i === servers.length - 1) {
                    throw new Error(`All PeerJS servers failed. Last error: ${error.message}`);
                }
            }
        }
    }

    async waitForPeerConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('PeerJS connection timeout'));
            }, 8000);

            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('PeerJS connected with ID:', id);
                this.discoverPeers();
                resolve();
            });

            this.peer.on('connection', (conn) => {
                console.log('Incoming connection from:', conn.peer);
                this.setupPeerConnection(conn);
            });

            this.peer.on('error', (error) => {
                clearTimeout(timeout);
                console.error('PeerJS error:', error);
                
                // If we tried to be hub but ID was taken, become a client
                if (error.type === 'unavailable-id' && this.isHub) {
                    console.log('🔄 Hub ID taken, becoming client...');
                    this.isHub = false;
                    // Retry with client ID
                    setTimeout(() => {
                        reject(new Error('retry_as_client'));
                    }, 1000);
                } else {
                    reject(error);
                }
            });

            this.peer.on('disconnected', () => {
                console.log('PeerJS disconnected, attempting to reconnect...');
                this.peer.reconnect();
            });
        });
    }

    async tryToBeHub() {
        // Always try to be hub first - PeerJS will give error if ID is taken
        this.isHub = true;
        console.log('🌟 Attempting to become hub peer...');
    }

    async discoverPeers() {
        if (this.isHub) {
            console.log('🌟 I am the hub - waiting for other peers to connect to me');
            return;
        }
        
        console.log(`🔍 Looking for hub peer: ${this.hubPeerId}`);
        
        // Try to connect to the hub
        setTimeout(() => {
            try {
                console.log(`📡 Connecting to hub: ${this.hubPeerId}`);
                const conn = this.peer.connect(this.hubPeerId);
                if (conn) {
                    this.setupPeerConnection(conn);
                } else {
                    console.log('❌ Failed to create connection to hub');
                }
            } catch (error) {
                console.log(`❌ Hub connection error:`, error);
                // If we can't connect to hub, maybe we should become the hub
                this.becomeHub();
            }
        }, 1000);
    }

    async becomeHub() {
        console.log('🔄 Becoming hub since no hub found...');
        this.disconnect();
        this.isHub = true;
        
        // Reconnect as hub
        setTimeout(() => {
            this.connect(this.sharedSecret);
        }, 2000);
    }

    setupPeerConnection(conn) {
        // Avoid duplicate connections
        if (this.peers.has(conn.peer)) {
            console.log('⚠️ Already connected to:', conn.peer);
            conn.close();
            return;
        }

        console.log('🔗 Setting up connection with:', conn.peer);

        conn.on('open', () => {
            console.log('✅ Data connection opened with:', conn.peer);
            this.peers.set(conn.peer, { connection: conn });
            
            console.log(`🎉 Now connected to ${this.peers.size} peer(s)`);
            this.syncHistoryWithPeer(conn.peer);
            this.updateStorageAndUI();
        });

        conn.on('data', (data) => {
            console.log('📨 Received data from:', conn.peer, data);
            this.handlePeerMessage(conn.peer, data);
        });

        conn.on('close', () => {
            console.log('👋 Connection closed with:', conn.peer);
            this.peers.delete(conn.peer);
            this.updateStorageAndUI();
        });

        conn.on('error', (error) => {
            console.error('❌ Connection error with', conn.peer, error);
            this.peers.delete(conn.peer);
            this.updateStorageAndUI();
        });
    }

    disconnect() {
        console.log('🔌 Disconnecting from PeerJS...');
        
        // Close all peer connections first
        this.peers.forEach((peer, peerId) => {
            if (peer.connection) {
                peer.connection.close();
            }
        });
        this.peers.clear();
        
        // Then destroy the main peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.isConnected = false;
        this.updateStorageAndUI();
        console.log('✅ Disconnected successfully');
    }

    async hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    // PeerJS handles all WebRTC signaling internally

    syncHistoryWithPeer(peerId) {
        const peer = this.peers.get(peerId);
        console.log(`🔄 Attempting to sync with ${peerId}. Peer exists: ${!!peer}`);
        
        if (peer && peer.connection) {
            console.log(`Connection state: ${peer.connection.readyState}, Open: ${peer.connection.open}`);
            
            if (peer.connection.open) {
                const syncMessage = {
                    type: 'history-sync',
                    history: this.localHistory,
                    deviceId: this.deviceId,
                    timestamp: Date.now()
                };
                
                console.log(`📤 Sending ${this.localHistory.length} history entries to ${peerId}`);
                peer.connection.send(syncMessage);
            } else {
                console.log(`❌ Connection to ${peerId} not open yet`);
            }
        } else {
            console.log(`❌ No connection found for peer ${peerId}`);
        }
    }

    handlePeerMessage(peerId, message) {
        console.log(`📨 Received message from ${peerId}:`, message);
        
        switch (message.type) {
            case 'history-sync':
                console.log(`🔄 Syncing ${message.history.length} history entries from ${message.deviceId}`);
                this.mergeRemoteHistory(message.history, message.deviceId);
                break;

            case 'history-update':
                console.log(`📝 Received history update from ${message.deviceId}:`, message.entry);
                this.addRemoteHistoryEntry(message.entry, message.deviceId);
                break;

            case 'history-clear':
                if (message.clearId && !this.clearTombstones.has(message.clearId)) {
                    console.log(`🗑️ Clearing history due to remote clear from ${message.deviceId} (ID: ${message.clearId})`);
                    this.clearTombstones.set(message.clearId, Date.now());
                    this.clearLocalHistoryInternal(false); // Don't broadcast again
                    this.saveLocalHistory();
                } else if (message.clearId) {
                    console.log(`⚠️ Ignoring duplicate clear operation ${message.clearId}`);
                }
                break;
                
            default:
                console.log(`❓ Unknown message type: ${message.type}`);
        }
    }

    mergeRemoteHistory(remoteHistory, sourceDeviceId) {
        const existingUrls = new Set(this.localHistory.map(entry => entry.url + entry.visitTime));
        
        remoteHistory.forEach(entry => {
            const key = entry.url + entry.visitTime;
            if (!existingUrls.has(key)) {
                this.localHistory.push({
                    ...entry,
                    sourceDevice: sourceDeviceId,
                    synced: true
                });
            }
        });

        this.localHistory.sort((a, b) => b.visitTime - a.visitTime);
        this.lastSyncTime = Date.now();
        this.saveLocalHistory();
        this.updateStorageAndUI();
    }

    addRemoteHistoryEntry(entry, sourceDeviceId) {
        const remoteEntry = {
            ...entry,
            sourceDevice: sourceDeviceId,
            synced: true
        };
        
        this.localHistory.unshift(remoteEntry);
        console.log(`📥 Added remote history entry. Total entries: ${this.localHistory.length}`);
        this.saveLocalHistory();
        this.updateStorageAndUI();
    }

    // PeerJS handles connection cleanup automatically

    addHistoryEntry(entry) {
        const historyEntry = {
            ...entry,
            id: this.generateEntryId(),
            sourceDevice: this.deviceId,
            synced: false
        };
        
        this.localHistory.unshift(historyEntry);
        console.log(`📚 Added to local history. Total entries: ${this.localHistory.length}`);
        
        this.saveLocalHistory();
        
        const message = {
            type: 'history-update',
            entry: historyEntry,
            deviceId: this.deviceId
        };
        
        console.log(`📡 Broadcasting to ${this.peers.size} peers:`, message);
        this.broadcastToAllPeers(message);
    }

    updateEntryDuration(url, duration) {
        const entry = this.localHistory.find(e => e.url === url && !e.synced);
        if (entry) {
            entry.duration = duration;
            this.saveLocalHistory();
        }
    }

    generateEntryId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    broadcastToAllPeers(message) {
        this.peers.forEach((peer) => {
            if (peer.connection && peer.connection.open) {
                peer.connection.send(message);
            }
        });
    }

    clearLocalHistory() {
        this.clearLocalHistoryInternal(true);
    }

    clearLocalHistoryInternal(shouldBroadcast = true) {
        this.localHistory = [];
        
        if (shouldBroadcast) {
            const clearId = this.generateClearId();
            this.clearTombstones.set(clearId, Date.now());
            
            this.broadcastToAllPeers({
                type: 'history-clear',
                deviceId: this.deviceId,
                clearId: clearId,
                timestamp: Date.now()
            });
            
            console.log(`📢 Broadcasting history clear with ID: ${clearId}`);
        }
        
        this.saveLocalHistory();
        this.updateStorageAndUI();
    }

    deleteRemoteHistory() {
        // This is the same as clearing local history - both clear all history everywhere
        this.clearLocalHistory();
    }

    async updateStorageAndUI() {
        await browser.storage.local.set({
            isConnected: this.isConnected,
            deviceCount: this.peers.size,
            localHistoryCount: this.localHistory.length,
            lastSyncTime: this.lastSyncTime
        });

        try {
            await browser.runtime.sendMessage({
                action: 'statusUpdate',
                isConnected: this.isConnected,
                deviceCount: this.peers.size
            });
        } catch (error) {
        }
    }
}

const historySyncService = new HistorySyncService();
