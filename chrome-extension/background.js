// Import PeerJS - Chrome extension service worker style
importScripts('peerjs.min.js');

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
            await this.initializePeerJS();
            console.log('Connected to PeerJS');
            this.isConnected = true;
        } catch (error) {
            throw new Error('Failed to connect to PeerJS: ' + error.message);
        }
    }

    async hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    async initializePeerJS() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        this.myPeerId = `${this.roomId}_${timestamp}_${random}`;
        
        this.peer = new Peer(this.myPeerId, {
            key: 'peerjs',
            secure: true,
            debug: 1
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log('PeerJS connected with ID:', id);
                resolve();
            });

            this.peer.on('error', (error) => {
                console.error('PeerJS error:', error);
                reject(error);
            });
        });
    }

    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.isConnected = false;
        console.log('Disconnected from PeerJS');
    }
}

const historySyncService = new HistorySyncService();