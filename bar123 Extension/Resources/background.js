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

      // Native app signaling bridge messages
      case 'startTrysteroSignaling':
        this.startSignalingForNative(request.roomId, request.deviceId)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'stopTrysteroSignaling':
        this.stopSignalingForNative();
        sendResponse({ success: true });
        break;

      case 'sendSignalingMessage':
        this.relaySignalingMessage(request.targetPeerId, request.signalingMessage);
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
      console.log('Joining Trystero room with config:', { appId: 'history-sync' });
      console.log('Trystero version:', trystero.version || 'unknown');
            
      // Use Nostr strategy (default, serverless) - MUST match Chrome extension
      this.room = trystero.joinRoom({ appId: 'history-sync' }, this.roomId);
      console.log('Room created, waiting for peers...', this.room);
        
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
            
      // Log room activity
      console.log('🔍 Room setup complete. Actively looking for peers...');
      console.log('💡 Make sure both devices use the same shared secret!');
            
      // Timeout warning
      setTimeout(() => {
        if (this.peers.size === 0) {
          console.warn('⚠️  No peers found after 30 seconds. Check:');
          console.warn('   1. Same shared secret on both devices');
          console.warn('   2. Network connectivity');
          console.warn('   3. Browser console for errors');
        }
      }, 30000);
            
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
    // Check if this is a WebRTC signaling message
    if (historyData.type === 'webrtc-signaling' && historyData.fromNativeApp !== true) {
      console.log('📥 Received WebRTC signaling for native app:', historyData);
      
      // Forward to native app
      this.notifyNativeApp({
        type: 'signalingMessage',
        fromPeerId: historyData.deviceId,
        signalingData: historyData.signalingData
      });
      
      return; // Don't process as history
    }

    // Handle history request from iOS app
    if (historyData.type === 'historyRequest') {
      console.log(`📤 Received history request from ${historyData.deviceId}, sending ${this.localHistory.length} entries`);
      console.log('📋 Sample local history entries:', this.localHistory.slice(0, 3));
      
      if (this.sendHistory && this.localHistory.length > 0) {
        console.log(`✅ Sending history response with ${this.localHistory.length} entries`);
        this.sendHistory({
          type: 'historyResponse',
          entries: this.localHistory,
          deviceId: this.deviceId,
          timestamp: Date.now(),
          responseToRequest: historyData.deviceId
        });
        console.log('📤 History response sent successfully');
      } else {
        console.log(`❌ Cannot send history: sendHistory=${!!this.sendHistory}, historyLength=${this.localHistory.length}`);
      }
      return;
    }

    // Handle peer discovery notifications for native app
    if (this.signalingMode === 'native-bridge') {
      this.notifyNativeApp({
        type: 'peerDiscovered',
        peerId: historyData.deviceId
      });
    }

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
    const { url } = deleteData;
        
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
        lastSyncTime: this.lastSyncTime,
        sharedSecret: this.sharedSecret,
        currentRoomId: this.roomId
      });

      // Update App Group so iOS app can see the real data
      try {
        await browser.runtime.sendNativeMessage('bar123.extension', {
          type: 'updateAppGroupStatus',
          isConnected: this.isConnected,
          peerCount: this.peers.size,
          historyCount: this.localHistory.length,
          roomId: this.roomId
        });
        console.log('✅ Updated App Group with status:', { 
          connected: this.isConnected, 
          peers: this.peers.size, 
          history: this.localHistory.length 
        });
      } catch (error) {
        console.log('ℹ️ Could not update App Group (extension may not be available):', error);
      }

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

  // MARK: - Native App Signaling Bridge

  async startSignalingForNative(roomId, nativeDeviceId) {
    console.log('🔗 Starting signaling bridge for native app:', nativeDeviceId, 'room:', roomId);
    
    this.nativeDeviceId = nativeDeviceId;
    this.signalingMode = 'native-bridge';
    
    // Start Trystero signaling (similar to connect but for signaling only)
    this.roomId = roomId;
    
    try {
      await this.initializeTrystero();
      console.log('✅ Signaling bridge established for native app');
      
      // Notify native app that signaling is ready
      this.notifyNativeApp({
        type: 'signalingReady',
        roomId: roomId
      });
      
    } catch (error) {
      console.error('❌ Failed to start signaling bridge:', error);
      throw error;
    }
  }

  stopSignalingForNative() {
    console.log('🔌 Stopping signaling bridge for native app');
    
    this.signalingMode = null;
    this.nativeDeviceId = null;
    this.disconnect();
    
    // Notify native app that signaling stopped
    this.notifyNativeApp({
      type: 'signalingStopped'
    });
  }

  relaySignalingMessage(targetPeerId, signalingMessage) {
    console.log('📡 Relaying signaling message to peer:', targetPeerId);
    
    if (this.room && this.sendHistory) {
      // Use existing Trystero channels to relay WebRTC signaling
      this.sendHistory({
        type: 'webrtc-signaling',
        targetPeer: targetPeerId,
        signalingData: signalingMessage,
        fromNativeApp: true,
        deviceId: this.nativeDeviceId,
        timestamp: Date.now()
      });
    } else {
      console.error('Cannot relay signaling message: Trystero not connected');
    }
  }

  notifyNativeApp(message) {
    console.log('📱 Notifying native app:', message.type);
    
    // Send message to native app via browser.runtime.sendNativeMessage
    try {
      browser.runtime.sendNativeMessage('xyz.foo.bar123.Extension', {
        type: 'extensionToApp',
        message: message
      });
    } catch (error) {
      console.error('Failed to notify native app:', error);
    }
  }


  // Override initializeTrystero to support native app notifications
  async initializeTrysteroOriginal() {
    return this.initializeTrystero();
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
      console.log('Joining Trystero room with config:', { appId: 'history-sync' });
      console.log('Trystero version:', trystero.version || 'unknown');
            
      // Use Nostr strategy (default, serverless) - MUST match Chrome extension
      this.room = trystero.joinRoom({ appId: 'history-sync' }, this.roomId);
      console.log('Room created, waiting for peers...', this.room);
        
      // Set up peer connection handlers
      this.room.onPeerJoin(peerId => {
        console.log('🎉 Peer joined:', peerId);
        this.peers.set(peerId, { connected: true });
        this.updateStorageAndUI();
        
        // Notify native app of peer discovery
        if (this.signalingMode === 'native-bridge') {
          this.notifyNativeApp({
            type: 'peerDiscovered',
            peerId: peerId
          });
        }
                
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
        
        // Notify native app of peer loss
        if (this.signalingMode === 'native-bridge') {
          this.notifyNativeApp({
            type: 'peerLost',
            peerId: peerId
          });
        }
      });
            
      // Log room activity
      console.log('🔍 Room setup complete. Actively looking for peers...');
      console.log('💡 Make sure both devices use the same shared secret!');
            
      // Timeout warning
      setTimeout(() => {
        if (this.peers.size === 0) {
          console.warn('⚠️  No peers found after 30 seconds. Check:');
          console.warn('   1. Same shared secret on both devices');
          console.warn('   2. Network connectivity');
          console.warn('   3. Browser console for errors');
        }
      }, 30000);
            
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
}

// Initialize the service
new HistorySyncService();