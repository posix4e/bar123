// Chrome extension background service worker
// P2P operations using js-libp2p

/* global importScripts, LibP2PBundle */

// Import bundled libp2p
importScripts('libp2p-bundle.js');

class HistorySyncService {
  constructor() {
    this.isConnected = false;
    this.peers = new Map();
    this.localHistory = [];
    this.deviceId = this.generateDeviceId();
    this.roomId = null;
    this.sharedSecret = null;
    this.lastSyncTime = null;
    this.p2pClient = null;
        
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
      try {
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
                    
        case 'getHistory':
          sendResponse({
            success: true,
            history: this.localHistory.slice(0, 50) // Return last 50 entries
          });
          break;
                    
        case 'peerJoined':
          console.log('Peer joined:', request.peerId);
          this.peers.set(request.peerId, { connected: true });
          break;
                    
        case 'peerLeft':
          console.log('Peer left:', request.peerId);
          this.peers.delete(request.peerId);
        
          // If all peers have left and we still want to be connected, attempt reconnection
          if (this.peers.size === 0 && this.isConnected && this.sharedSecret) {
            console.log('All peers disconnected, scheduling reconnection attempt...');
            setTimeout(() => this.attemptReconnection(), 5000);
          }
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
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  }

  async connect(sharedSecret) {
    this.sharedSecret = sharedSecret;
    this.roomId = await this.hashSecret(sharedSecret);
        
    try {
      console.log('Chrome extension connecting to room:', this.roomId);
      
      // Initialize libp2p client
      this.p2pClient = new LibP2PBundle.LibP2PClient();
      
      // Set up event handlers
      this.p2pClient.onPeerJoin((peerId) => {
        console.log('Peer joined:', peerId);
        this.peers.set(peerId, { connected: true });
        this.updateStorageAndUI();
        
        // Send current history to new peer
        if (this.localHistory.length > 0) {
          this.sendHistoryToPeers();
        }
      });
      
      this.p2pClient.onPeerLeave((peerId) => {
        console.log('Peer left:', peerId);
        this.peers.delete(peerId);
        this.updateStorageAndUI();
      });
      
      this.p2pClient.onData((data, peerId) => {
        console.log('Received data from', peerId, ':', data);
        if (data.type === 'history_sync') {
          this.handleReceivedHistory(data);
        } else if (data.type === 'history_delete') {
          this.handleReceivedDelete(data);
        }
      });
      
      this.p2pClient.onDisconnected(() => {
        console.log('Disconnected from relay');
        this.isConnected = false;
        this.updateStorageAndUI();
        
        // Attempt reconnection
        if (this.sharedSecret) {
          setTimeout(() => this.attemptReconnection(), 5000);
        }
      });
      
      // Connect to P2P network (no relay needed)
      await this.p2pClient.connect(null, this.roomId);
      
      this.isConnected = true;
      console.log('✅ Chrome extension connected via libp2p');
      
      // Store connection details
      await chrome.storage.local.set({
        lastSharedSecret: sharedSecret,
        lastRoomId: this.roomId
      });
      
      this.updateStorageAndUI();
      
    } catch (error) {
      console.error('Connection failed:', error);
      this.isConnected = false;
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

  async disconnect() {
    console.log('Chrome extension disconnecting...');
    
    // Disconnect libp2p client
    if (this.p2pClient) {
      this.p2pClient.disconnect();
      this.p2pClient = null;
    }
        
    this.peers.clear();
    this.isConnected = false;
    this.sharedSecret = null;
    this.roomId = null;
    
    // Clear stored connection details
    await chrome.storage.local.remove(['lastSharedSecret', 'lastRoomId']);
    
    this.updateStorageAndUI();
    console.log('Chrome extension disconnected');
  }
  
  // Add reconnection attempt method
  async attemptReconnection() {
    if (this.isConnected || !this.sharedSecret) {
      return;
    }
    
    console.log('Attempting to reconnect...');
    try {
      await this.connect(this.sharedSecret);
    } catch (error) {
      console.error('Reconnection failed:', error);
      // Schedule another reconnection attempt in 30 seconds
      setTimeout(() => this.attemptReconnection(), 30000);
    }
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
    const { url } = deleteData;
        
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
  
  // Send history to all connected peers
  sendHistoryToPeers() {
    if (!this.p2pClient || !this.isConnected) {
      return;
    }
    
    const message = {
      type: 'history_sync',
      entries: this.localHistory,
      deviceId: this.deviceId,
      timestamp: Date.now()
    };
    
    console.log(`📤 Sending ${this.localHistory.length} history entries to peers`);
    this.p2pClient.publish(message);
  }
  
  // Update storage and UI state
  async updateStorageAndUI() {
    await chrome.storage.local.set({
      isConnected: this.isConnected,
      peerCount: this.peers.size,
      lastUpdate: Date.now()
    });
    
    // Notify popup if it's open
    chrome.runtime.sendMessage({
      type: 'connectionStateChanged',
      isConnected: this.isConnected,
      peerCount: this.peers.size
    }).catch(() => {
      // Popup might not be open
    });
  }
}

new HistorySyncService();