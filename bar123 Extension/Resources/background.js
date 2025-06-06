// Safari extension background script using native Swift P2P implementation
// All P2P operations are now handled by SafariWebExtensionHandler

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
    this.loadSharedSecret();
  }

  generateDeviceId() {
    // Use a persistent device ID so reconnections work
    const stored = localStorage.getItem('deviceId');
    if (stored) {return stored;}
        
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

  async loadSharedSecret() {
    try {
      console.log('🔍 Loading shared secret from iOS app...');
      
      // Primary: Try to get secret from iOS App Group storage via native messaging
      try {
        console.log('🔄 Attempting native message to get shared secret...');
        const response = await browser.runtime.sendNativeMessage({
          type: 'getSharedSecret'
        });
        
        console.log('📱 Native message response:', response);
        
        if (response && response.secret !== undefined) {
          const newSecret = response.secret.trim();
          
          if (newSecret) {
            // Check if this is a different secret than current
            if (this.sharedSecret && this.sharedSecret !== newSecret) {
              console.log('🔄 Secret changed, disconnecting and reconnecting...');
              await this.disconnect();
            }
            
            if (!this.isConnected || this.sharedSecret !== newSecret) {
              console.log('✅ Found shared secret from iOS app, connecting...');
              await this.connect(newSecret);
            }
            return;
          } else {
            // Empty secret means it was cleared
            console.log('📱 Empty secret from iOS app - secret was cleared');
            if (this.isConnected) {
              console.log('🔄 Disconnecting due to cleared secret...');
              await this.disconnect();
              // Clear stored secret
              await browser.storage.local.remove(['sharedSecret', 'currentRoomId']);
              this.sharedSecret = null;
              this.roomId = null;
              this.updateStorageAndUI();
            }
          }
        }
      } catch (error) {
        console.error('Native messaging failed:', error);
        // Continue to fallback
      }
      
      // Fallback: check extension storage
      console.log('🔄 Checking extension storage for shared secret...');
      const stored = await browser.storage.local.get(['sharedSecret']);
      if (stored.sharedSecret && stored.sharedSecret.trim()) {
        const newSecret = stored.sharedSecret.trim();
        
        if (!this.isConnected || this.sharedSecret !== newSecret) {
          console.log('✅ Found shared secret in extension storage, connecting...');
          await this.connect(newSecret);
        }
      } else {
        console.log('ℹ️ No shared secret found anywhere');
        // If we were connected but now there's no secret, disconnect
        if (this.isConnected) {
          console.log('🔄 No secret found, disconnecting...');
          await this.disconnect();
        }
      }
    } catch (error) {
      console.error('Failed to load shared secret:', error);
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
        // Get stats from native layer
        this.getConnectionStats()
          .then(stats => sendResponse(stats))
          .catch(error => sendResponse({
            isConnected: false,
            deviceCount: 0,
            localHistoryCount: this.localHistory.length,
            lastSyncTime: this.lastSyncTime,
            error: error.message
          }));
        return true;

      case 'getHistory':
        sendResponse({ 
          success: true, 
          history: this.localHistory.slice(0, 50) // Return last 50 entries
        });
        break;
        
      case 'refreshSecret':
        this.loadSharedSecret();
        sendResponse({ success: true });
        break;
      }
    });
  }

  async connect(sharedSecret) {
    this.sharedSecret = sharedSecret;
    this.roomId = await this.hashSecret(sharedSecret);
        
    try {
      // Use native messaging to connect via Swift
      const response = await browser.runtime.sendNativeMessage({
        type: 'saveSharedSecret',
        secret: sharedSecret
      });
      
      if (response && response.success) {
        console.log('Connected via native Swift P2P');
        this.isConnected = true;
        this.updateStorageAndUI();
      } else {
        throw new Error('Failed to connect via native layer');
      }
    } catch (error) {
      throw new Error('Failed to connect to P2P network: ' + error.message);
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
    console.log('🔌 Disconnecting from P2P...');
        
    try {
      // Clear secret via native messaging
      await browser.runtime.sendNativeMessage({
        type: 'saveSharedSecret',
        secret: ''
      });
    } catch (error) {
      console.error('Failed to disconnect via native messaging:', error);
    }
        
    this.isConnected = false;
    this.sharedSecret = null;
    this.roomId = null;
    this.peers.clear();
    this.updateStorageAndUI();
    console.log('✅ Disconnected from P2P');
  }

  async getConnectionStats() {
    try {
      const response = await browser.runtime.sendNativeMessage({
        type: 'getConnectionStats'
      });
      
      if (response && response.type === 'connectionStatsResponse') {
        return {
          isConnected: response.isConnected,
          deviceCount: response.peerCount,
          localHistoryCount: response.localHistoryCount,
          lastSyncTime: this.lastSyncTime,
          deviceId: response.deviceId
        };
      }
    } catch (error) {
      console.error('Failed to get connection stats:', error);
    }
    
    // Fallback to local state
    return {
      isConnected: this.isConnected,
      deviceCount: this.peers.size,
      localHistoryCount: this.localHistory.length,
      lastSyncTime: this.lastSyncTime
    };
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
        
    // Send to native layer for P2P broadcasting
    if (this.isConnected) {
      this.sendToNativeLayer('trackHistory', historyEntry);
    }
  }

  async sendToNativeLayer(action, data) {
    try {
      const response = await browser.runtime.sendNativeMessage({
        type: action,
        ...data
      });
      console.log('📤 Sent to native layer:', action, response);
    } catch (error) {
      console.error('Failed to send to native layer:', error);
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
        lastSyncTime: this.lastSyncTime,
        sharedSecret: this.sharedSecret,
        currentRoomId: this.roomId
      });

      // Try to notify popup of status change (may fail if popup not open)
      try {
        await browser.runtime.sendMessage({
          action: 'statusUpdate',
          isConnected: this.isConnected,
          deviceCount: this.peers.size
        });
      } catch {
        // Popup not open, ignore
      }
    } catch (error) {
      console.error('Failed to update storage:', error);
    }
  }
}

// Initialize the service
new HistorySyncService();