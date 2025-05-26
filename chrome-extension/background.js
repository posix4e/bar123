// Chrome extension background service worker
// WebRTC operations are delegated to content scripts/popup

class HistorySyncService {
    constructor() {
        this.isConnected = false;
        this.peers = new Map();
        this.localHistory = [];
        this.deviceId = this.generateDeviceId();
        this.roomId = null;
        this.sharedSecret = null;
        this.lastSyncTime = null;
        this.connectionTab = null;
        
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
                    
                case 'peerJoined':
                    console.log('Peer joined:', request.peerId);
                    this.peers.set(request.peerId, { connected: true });
                    break;
                    
                case 'peerLeft':
                    console.log('Peer left:', request.peerId);
                    this.peers.delete(request.peerId);
                    break;
                    
                case 'receivedHistory':
                    this.handleReceivedHistory(request.historyData);
                    break;
                    
                case 'receivedDelete':
                    this.handleReceivedDelete(request.deleteData);
                    break;
                    
                case 'trackHistory':
                    // Handle history tracking from content script
                    this.localHistory.push(request.entry);
                    chrome.storage.local.set({ localHistory: this.localHistory });
                    break;
                    
                case 'connectionPageReady':
                    console.log('Connection page is ready');
                    if (this.pendingConnection) {
                        console.log('Sending pending connection request');
                        chrome.tabs.sendMessage(sender.tab.id, this.pendingConnection);
                        this.pendingConnection = null;
                    }
                    break;
            }
        });
    }

    async connect(sharedSecret) {
        this.sharedSecret = sharedSecret;
        this.roomId = await this.hashSecret(sharedSecret);
        
        try {
            // Create a connection page tab
            const connectionUrl = chrome.runtime.getURL('connection.html');
            const tab = await chrome.tabs.create({ url: connectionUrl, active: false });
            this.connectionTab = tab.id;
            
            // Store the connection request to send when page is ready
            this.pendingConnection = {
                action: 'initConnection',
                roomId: this.roomId,
                sharedSecret: sharedSecret
            };
            
            console.log('Connection page created, waiting for ready signal');
            this.isConnected = true;
        } catch (error) {
            throw new Error('Failed to connect: ' + error.message);
        }
    }

    async hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    // Trystero initialization moved to content script due to WebRTC restrictions in service workers

    disconnect() {
        if (this.connectionTab) {
            // Send disconnect message to content script
            chrome.tabs.sendMessage(this.connectionTab, {
                action: 'disconnect'
            }).catch(() => {
                // Tab might be closed, ignore error
            });
            this.connectionTab = null;
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