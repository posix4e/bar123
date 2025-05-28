// Safari extension background script using Trystero for P2P connections
// Trystero is loaded via manifest.json scripts array

class HistorySyncService {
  constructor() {
    this.isConnected = false;
    this.peers = new Map();
    this.localHistory = [];
    this.sharedFiles = [];
    this.sharedPasswords = [];
    this.deviceId = this.generateDeviceId();
    this.roomId = null;
    this.sharedSecret = null;
    this.lastSyncTime = null;
    this.room = null;
    this.sendHistory = null;
    this.sendDelete = null;
    this.sendFile = null;
    this.sendPassword = null;
        
    this.init();
  }

  init() {
    this.loadLocalHistory();
    this.setupMessageHandlers();
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
      const stored = await browser.storage.local.get(['localHistory', 'sharedFiles', 'sharedPasswords', 'lastSyncTime']);
      this.localHistory = stored.localHistory || [];
      this.sharedFiles = stored.sharedFiles || [];
      this.sharedPasswords = stored.sharedPasswords || [];
      this.lastSyncTime = stored.lastSyncTime || null;
      
      // Clean expired items
      this.cleanExpiredItems();
    } catch (error) {
      console.error('Failed to load local history:', error);
      this.localHistory = [];
      this.sharedFiles = [];
      this.sharedPasswords = [];
      this.lastSyncTime = null;
    }
  }

  cleanExpiredItems() {
    const now = Date.now();
    
    // Clean expired files
    this.sharedFiles = this.sharedFiles.filter(file => {
      return !file.expiresAt || file.expiresAt > now;
    });
    
    // Clean expired passwords
    this.sharedPasswords = this.sharedPasswords.filter(password => {
      return !password.expiresAt || password.expiresAt > now;
    });
    
    // Save cleaned data
    this.saveSharedItems();
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

  async saveSharedItems() {
    try {
      await browser.storage.local.set({
        sharedFiles: this.sharedFiles,
        sharedPasswords: this.sharedPasswords
      });
    } catch (error) {
      console.error('Failed to save shared items:', error);
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

      case 'shareFile':
        this.handleShareFile(request.fileData, request.expiresAt)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'sharePassword':
        this.handleSharePassword(request.passwordData, request.expiresAt)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getSharedItems':
        this.cleanExpiredItems(); // Clean before returning
        sendResponse({
          success: true,
          files: this.sharedFiles,
          passwords: this.sharedPasswords
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
      const [sendFile, getFile] = this.room.makeAction('file-share');
      const [sendPassword, getPassword] = this.room.makeAction('password-share');
            
      this.sendHistory = sendHistory;
      this.sendDelete = sendDelete;
      this.sendFile = sendFile;
      this.sendPassword = sendPassword;
            
      getHistory((historyData, peerId) => {
        console.log('📥 Received history from', peerId, historyData);
        this.handleReceivedHistory(historyData);
      });
            
      getDelete((deleteData, peerId) => {
        console.log('🗑️ Received delete from', peerId, deleteData);
        this.handleReceivedDelete(deleteData);
      });

      getFile((fileData, peerId) => {
        console.log('📁 Received file from', peerId, ':', fileData.name);
        this.handleReceivedFile(fileData);
      });

      getPassword((passwordData, peerId) => {
        console.log('🔒 Received password from', peerId, ':', passwordData.title);
        this.handleReceivedPassword(passwordData);
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
        lastSyncTime: this.lastSyncTime
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

  async handleShareFile(fileData, expiresAt) {
    if (!this.isConnected) {
      throw new Error('Not connected to any peers');
    }

    const fileEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: fileData.name,
      content: fileData.content,
      type: fileData.type,
      size: fileData.size,
      sharedAt: Date.now(),
      expiresAt: expiresAt,
      sourceDevice: this.deviceId
    };

    // Add to local storage
    this.sharedFiles.push(fileEntry);
    await this.saveSharedItems();

    // Send to peers
    if (this.sendFile && this.peers.size > 0) {
      this.sendFile(fileEntry);
    }

    console.log('📁 File shared:', fileEntry.name);
  }

  async handleSharePassword(passwordData, expiresAt) {
    if (!this.isConnected) {
      throw new Error('Not connected to any peers');
    }

    const passwordEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: passwordData.title,
      username: passwordData.username,
      password: passwordData.password,
      website: passwordData.website,
      notes: passwordData.notes,
      sharedAt: Date.now(),
      expiresAt: expiresAt,
      sourceDevice: this.deviceId
    };

    // Add to local storage
    this.sharedPasswords.push(passwordEntry);
    await this.saveSharedItems();

    // Send to peers
    if (this.sendPassword && this.peers.size > 0) {
      this.sendPassword(passwordEntry);
    }

    console.log('🔒 Password shared:', passwordEntry.title);
  }

  handleReceivedFile(fileData) {
    // Check if file already exists
    const existingIndex = this.sharedFiles.findIndex(f => f.id === fileData.id);
    if (existingIndex === -1) {
      this.sharedFiles.push(fileData);
      
      // Save to storage
      this.saveSharedItems();

      // Show notification
      this.showNotification('New File Shared', `${fileData.name} was shared by ${fileData.sourceDevice.split('_')[0]}`);

      console.log('📁 Received new shared file:', fileData.name);
    }
  }

  handleReceivedPassword(passwordData) {
    // Check if password already exists
    const existingIndex = this.sharedPasswords.findIndex(p => p.id === passwordData.id);
    if (existingIndex === -1) {
      this.sharedPasswords.push(passwordData);
      
      // Save to storage
      this.saveSharedItems();

      // Show notification
      this.showNotification('New Password Shared', `${passwordData.title} was shared by ${passwordData.sourceDevice.split('_')[0]}`);

      console.log('🔒 Received new shared password:', passwordData.title);
    }
  }

  showNotification(title, message) {
    if (browser.notifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('images/icon-48.png'),
        title: title,
        message: message
      });
    }
  }
}

// Initialize the service
new HistorySyncService();