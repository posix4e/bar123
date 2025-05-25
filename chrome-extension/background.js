// Import Trystero - Chrome extension service worker style (bundled locally)
importScripts('trystero-bundle.js');

class HistorySyncService {
    constructor() {
        this.isConnected = false;
        this.peers = new Map();
        this.localHistory = [];
        this.deviceId = this.generateDeviceId();
        this.roomId = null;
        this.sharedSecret = null;
        this.lastSyncTime = null;
        
        this.init();
    }

    init() {
        this.loadLocalHistory();
        this.setupMessageHandlers();
    }

    generateDeviceId() {
        // Use chrome.storage instead of localStorage for service workers
        return new Promise(async (resolve) => {
            const stored = await chrome.storage.local.get(['deviceId']);
            if (stored.deviceId) {
                resolve(stored.deviceId);
                return;
            }
            
            const newId = 'chrome_desktop_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            await chrome.storage.local.set({ deviceId: newId });
            resolve(newId);
        });
    }

    async loadLocalHistory() {
        // Initialize deviceId first
        this.deviceId = await this.generateDeviceId();
        
        const stored = await chrome.storage.local.get(['localHistory', 'lastSyncTime']);
        this.localHistory = stored.localHistory || [];
        this.lastSyncTime = stored.lastSyncTime || null;
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

                case 'getStats':
                    sendResponse({
                        isConnected: this.isConnected,
                        deviceCount: this.peers.size,
                        localHistoryCount: this.localHistory.length
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
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 6);
            this.myPeerId = `${await this.deviceId}_${timestamp}_${random}`;
            
            console.log('Connecting to Trystero room:', this.roomId);
            console.log('Trystero available:', typeof trystero);
            console.log('Trystero object:', trystero);
            
            // Check if trystero is available
            if (typeof trystero === 'undefined') {
                throw new Error('Trystero is not loaded');
            }
            
            // Use Nostr strategy (default, serverless)
            this.room = trystero.joinRoom({ appId: 'history-sync' }, this.roomId);
            console.log('Room created:', this.room);
        
        // Set up peer connection handlers
        this.room.onPeerJoin(peerId => {
            console.log('Peer joined:', peerId);
            this.peers.set(peerId, { connected: true });
        });
        
        this.room.onPeerLeave(peerId => {
            console.log('Peer left:', peerId);
            this.peers.delete(peerId);
        });
        
        // Set up history sync channels
        const [sendHistory, getHistory] = this.room.makeAction('history-sync');
        const [sendDelete, getDelete] = this.room.makeAction('delete-item');
        
        getHistory((historyData, peerId) => {
            console.log('Received history from', peerId, historyData);
            this.handleReceivedHistory(historyData);
        });
        
        getDelete((deleteData, peerId) => {
            console.log('Received delete from', peerId, deleteData);
            this.handleReceivedDelete(deleteData);
        });
        
        this.sendHistory = sendHistory;
        this.sendDelete = sendDelete;
        
            console.log('Trystero room joined successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('Trystero initialization error:', error);
            throw error;
        }
    }

    disconnect() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        this.peers.clear();
        this.isConnected = false;
        console.log('Disconnected from Trystero');
    }
    
    handleReceivedHistory(historyData) {
        // Merge received history with local history
        for (const entry of historyData.entries || []) {
            const existingIndex = this.localHistory.findIndex(h => h.url === entry.url);
            if (existingIndex === -1) {
                this.localHistory.push(entry);
            } else {
                // Update if received entry is newer
                if (entry.visitTime > this.localHistory[existingIndex].visitTime) {
                    this.localHistory[existingIndex] = entry;
                }
            }
        }
        
        // Save merged history
        chrome.storage.local.set({ 
            localHistory: this.localHistory,
            lastSyncTime: Date.now()
        });
        
        console.log('History synchronized, total entries:', this.localHistory.length);
    }
    
    handleReceivedDelete(deleteData) {
        const { url, timestamp } = deleteData;
        
        // Remove from local history
        const index = this.localHistory.findIndex(h => h.url === url);
        if (index !== -1) {
            this.localHistory.splice(index, 1);
            
            // Save updated history
            chrome.storage.local.set({ 
                localHistory: this.localHistory,
                lastSyncTime: Date.now()
            });
            
            console.log('History entry deleted via sync:', url);
        }
    }
}

const historySyncService = new HistorySyncService();