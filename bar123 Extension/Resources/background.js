// Safari extension background script using Trystero for P2P connections
// Trystero is loaded via manifest.json scripts array

class HistorySyncService {
    constructor() {
        this.isConnected = false;
        this.peers = new Map();
        this.localHistory = [];
        this.deviceId = this.generateDeviceId();
        this.roomId = null;
        this.sharedSecret = null;
        this.lastSyncTime = null;
        this.room = null;
        this.sendHistory = null;
        this.sendDelete = null;
        
        this.init();
    }

    init() {
        this.loadLocalHistory();
        this.setupMessageHandlers();
    }

    generateDeviceId() {
        // Use a persistent device ID so reconnections work
        const stored = localStorage.getItem('deviceId');
        if (stored) return stored;
        
        const newId = 'ios_safari_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('deviceId', newId);
        return newId;
    }

    async loadLocalHistory() {
        try {
            const stored = await browser.storage.local.get(['localHistory', 'lastSyncTime']);
            this.localHistory = stored.localHistory || [];
            this.lastSyncTime = stored.lastSyncTime || null;
        } catch (error) {
            console.error('Failed to load local history:', error);
            this.localHistory = [];
            this.lastSyncTime = null;
        }
    }

    async saveLocalHistory() {
        try {
            await browser.storage.local.set({
                localHistory: this.localHistory,
                lastSyncTime: this.lastSyncTime,
                localHistoryCount: this.localHistory.length
            });
        } catch (error) {
            console.error('Failed to save local history:', error);
        }
    }

    setupMessageHandlers() {
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 Received message:', request);
            
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
            await this.initializeTrystero();
            console.log('Connected to Trystero');
            this.isConnected = true;
            this.updateStorageAndUI();
        } catch (error) {
            throw new Error('Failed to connect to Trystero: ' + error.message);
        }
    }

    async hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    async initializeTrystero() {
        try {
            console.log('Initializing Trystero...');
            console.log('Trystero available:', typeof trystero);
            
            // Check if trystero is available (loaded via manifest.json)
            if (typeof trystero === 'undefined') {
                throw new Error('Trystero not loaded - check manifest.json scripts');
            }
            
            console.log('Connecting to Trystero room:', this.roomId);
            
            // Use Nostr strategy (default, serverless)
            this.room = trystero.joinRoom({ appId: 'history-sync-safari' }, this.roomId);
            console.log('Room created:', this.room);
        
            // Set up peer connection handlers
            this.room.onPeerJoin(peerId => {
                console.log('🎉 Peer joined:', peerId);
                this.peers.set(peerId, { connected: true });
                this.updateStorageAndUI();
                
                // Send current history to new peer
                if (this.sendHistory && this.localHistory.length > 0) {
                    console.log(`📤 Sending ${this.localHistory.length} history entries to new peer`);
                    this.sendHistory({
                        entries: this.localHistory,
                        deviceId: this.deviceId,
                        timestamp: Date.now()
                    });
                }
            });
            
            this.room.onPeerLeave(peerId => {
                console.log('👋 Peer left:', peerId);
                this.peers.delete(peerId);
                this.updateStorageAndUI();
            });
            
            // Set up history sync channels
            const [sendHistory, getHistory] = this.room.makeAction('history-sync');
            const [sendDelete, getDelete] = this.room.makeAction('delete-item');
            
            this.sendHistory = sendHistory;
            this.sendDelete = sendDelete;
            
            getHistory((historyData, peerId) => {
                console.log('📥 Received history from', peerId, historyData);
                this.handleReceivedHistory(historyData);
            });
            
            getDelete((deleteData, peerId) => {
                console.log('🗑️ Received delete from', peerId, deleteData);
                this.handleReceivedDelete(deleteData);
            });
            
            console.log('✅ Trystero room joined successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('❌ Trystero initialization error:', error);
            throw error;
        }
    }

    disconnect() {
        console.log('🔌 Disconnecting from Trystero...');
        
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        
        this.peers.clear();
        this.isConnected = false;
        this.sendHistory = null;
        this.sendDelete = null;
        this.updateStorageAndUI();
        console.log('✅ Disconnected from Trystero');
    }
    
    handleReceivedHistory(historyData) {
        // Merge received history with local history
        const existingUrls = new Set(this.localHistory.map(h => h.url + h.visitTime));
        
        for (const entry of historyData.entries || []) {
            const key = entry.url + entry.visitTime;
            if (!existingUrls.has(key)) {
                this.localHistory.push({
                    ...entry,
                    sourceDevice: historyData.deviceId,
                    synced: true
                });
            }
        }
        
        // Sort by visit time (newest first)
        this.localHistory.sort((a, b) => b.visitTime - a.visitTime);
        
        // Save merged history
        this.lastSyncTime = Date.now();
        this.saveLocalHistory();
        this.updateStorageAndUI();
        
        console.log('📚 History synchronized, total entries:', this.localHistory.length);
    }
    
    handleReceivedDelete(deleteData) {
        const { url, timestamp } = deleteData;
        
        // Remove from local history
        const initialLength = this.localHistory.length;
        this.localHistory = this.localHistory.filter(h => h.url !== url);
        
        if (this.localHistory.length < initialLength) {
            // Save updated history
            this.lastSyncTime = Date.now();
            this.saveLocalHistory();
            this.updateStorageAndUI();
            
            console.log('🗑️ History entry deleted via sync:', url);
        }
    }

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
        
        // Broadcast to peers
        if (this.sendHistory && this.peers.size > 0) {
            console.log(`📡 Broadcasting history update to ${this.peers.size} peers`);
            this.sendHistory({
                entries: [historyEntry],
                deviceId: this.deviceId,
                timestamp: Date.now()
            });
        }
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

    clearLocalHistory() {
        this.localHistory = [];
        this.saveLocalHistory();
        this.updateStorageAndUI();
        
        // Broadcast clear to peers
        if (this.sendDelete && this.peers.size > 0) {
            console.log(`📢 Broadcasting history clear to ${this.peers.size} peers`);
            // Send a special "clear all" message
            this.sendDelete({
                url: '*CLEAR_ALL*',
                deviceId: this.deviceId,
                timestamp: Date.now()
            });
        }
    }

    deleteRemoteHistory() {
        // Same as clearing local history - clears everywhere
        this.clearLocalHistory();
    }

    async updateStorageAndUI() {
        try {
            await browser.storage.local.set({
                isConnected: this.isConnected,
                deviceCount: this.peers.size,
                localHistoryCount: this.localHistory.length,
                lastSyncTime: this.lastSyncTime
            });

            // Try to notify popup of status change (may fail if popup not open)
            try {
                await browser.runtime.sendMessage({
                    action: 'statusUpdate',
                    isConnected: this.isConnected,
                    deviceCount: this.peers.size
                });
            } catch (error) {
                // Popup not open, ignore
            }
        } catch (error) {
            console.error('Failed to update storage:', error);
        }
    }
}

// Initialize the service
const historySyncService = new HistorySyncService();