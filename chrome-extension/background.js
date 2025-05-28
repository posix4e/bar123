// Chrome extension background service worker
// WebRTC operations are delegated to content scripts/popup

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
        
    const stored = await chrome.storage.local.get(['localHistory', 'sharedFiles', 'sharedPasswords', 'lastSyncTime']);
    this.localHistory = stored.localHistory || [];
    this.sharedFiles = stored.sharedFiles || [];
    this.sharedPasswords = stored.sharedPasswords || [];
    this.lastSyncTime = stored.lastSyncTime || null;
    
    // Clean expired items
    this.cleanExpiredItems();
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
    chrome.storage.local.set({
      sharedFiles: this.sharedFiles,
      sharedPasswords: this.sharedPasswords
    });
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
        break;
                    
      case 'receivedHistory':
        this.handleReceivedHistory(request.historyData);
        break;
                    
      case 'receivedDelete':
        this.handleReceivedDelete(request.deleteData);
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

      case 'receivedFile':
        this.handleReceivedFile(request.fileData);
        break;

      case 'receivedPassword':
        this.handleReceivedPassword(request.passwordData);
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
      // Create offscreen document for WebRTC (Chrome MV3 compatible)
      await this.createOffscreenDocument();
            
      console.log('Connecting to Trystero room:', this.roomId);
            
      // Send connection request to offscreen document
      const response = await chrome.runtime.sendMessage({
        action: 'initConnection',
        roomId: this.roomId,
        sharedSecret: sharedSecret
      });
            
      if (response.success) {
        this.isConnected = true;
        console.log('✅ Connection initiated successfully');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      throw new Error('Failed to connect: ' + error.message);
    }
  }
    
  async createOffscreenDocument() {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
        
    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return;
    }
        
    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS', 'DOM_SCRAPING'], // Required reasons for offscreen document
      justification: 'Required for WebRTC P2P connections using Trystero'
    });
        
    console.log('Offscreen document created');
  }

  async hashSecret(secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  // Trystero initialization moved to content script due to WebRTC restrictions in service workers

  async disconnect() {
    console.log('Disconnecting from Trystero...');
        
    try {
      // Send disconnect message to offscreen document
      await chrome.runtime.sendMessage({ action: 'disconnect' });
    } catch (error) {
      console.log('Failed to send disconnect to offscreen:', error.message);
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
    await chrome.storage.local.set({ sharedFiles: this.sharedFiles });

    // Send to peers via offscreen document
    await chrome.runtime.sendMessage({
      action: 'sendFile',
      fileData: fileEntry
    });

    console.log('File shared:', fileEntry.name);
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
    await chrome.storage.local.set({ sharedPasswords: this.sharedPasswords });

    // Send to peers via offscreen document
    await chrome.runtime.sendMessage({
      action: 'sendPassword',
      passwordData: passwordEntry
    });

    console.log('Password shared:', passwordEntry.title);
  }

  handleReceivedFile(fileData) {
    // Check if file already exists
    const existingIndex = this.sharedFiles.findIndex(f => f.id === fileData.id);
    if (existingIndex === -1) {
      this.sharedFiles.push(fileData);
      
      // Save to storage
      chrome.storage.local.set({ sharedFiles: this.sharedFiles });

      // Show notification
      this.showNotification('New File Shared', `${fileData.name} was shared by ${fileData.sourceDevice.split('_')[0]}`);

      console.log('Received new shared file:', fileData.name);
    }
  }

  handleReceivedPassword(passwordData) {
    // Check if password already exists
    const existingIndex = this.sharedPasswords.findIndex(p => p.id === passwordData.id);
    if (existingIndex === -1) {
      this.sharedPasswords.push(passwordData);
      
      // Save to storage
      chrome.storage.local.set({ sharedPasswords: this.sharedPasswords });

      // Show notification
      this.showNotification('New Password Shared', `${passwordData.title} was shared by ${passwordData.sourceDevice.split('_')[0]}`);

      console.log('Received new shared password:', passwordData.title);
    }
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-48.png'),
      title: title,
      message: message
    });
  }
}

new HistorySyncService();