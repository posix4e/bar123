// Safari extension background script for local history management
// P2P functionality is now handled natively by iOS app

class LocalHistoryService {
  constructor() {
    this.localHistory = [];
    this.deviceId = this.generateDeviceId();
    this.lastSyncTime = null;
        
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

  async notifyNativeAppOfHistory() {
    try {
      console.log('📱 Notifying iOS app of history changes...');
      
      const response = await browser.runtime.sendNativeMessage({
        type: 'updateHistory',
        history: this.localHistory,
        deviceId: this.deviceId,
        lastSyncTime: this.lastSyncTime
      });
      
      console.log('📱 Native message response:', response);
    } catch (error) {
      console.log('ℹ️ Could not notify iOS app (extension may not be available):', error);
    }
  }

  setupMessageHandlers() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Received message:', request);
            
      switch (request.action) {
      // P2P connection handling is now done by iOS app
      case 'syncWithNative':
        this.notifyNativeAppOfHistory()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

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
          localHistoryCount: this.localHistory.length,
          lastSyncTime: this.lastSyncTime,
          deviceId: this.deviceId
        });
        break;

      case 'getHistory':
        sendResponse({ 
          success: true, 
          history: this.localHistory.slice(0, 50) // Return last 50 entries
        });
        break;
        
      case 'refreshFromNative':
        this.loadHistoryFromNative();
        sendResponse({ success: true });
        break;
      }
    });
  }

  async loadHistoryFromNative() {
    try {
      console.log('📱 Loading history from iOS app...');
      
      const response = await browser.runtime.sendNativeMessage({
        type: 'getHistory'
      });
      
      if (response && response.history) {
        // Merge with local history
        this.mergeHistoryFromNative(response.history);
        console.log('✅ History loaded from iOS app:', response.history.length, 'entries');
      }
    } catch (error) {
      console.log('ℹ️ Could not load history from iOS app:', error);
    }
  }

  mergeHistoryFromNative(nativeHistory) {
    const existingUrls = new Set(this.localHistory.map(h => h.url + h.visitTime));
    
    for (const entry of nativeHistory) {
      const key = entry.url + entry.visitTime;
      if (!existingUrls.has(key)) {
        this.localHistory.push({
          ...entry,
          sourceDevice: entry.deviceId || 'native',
          synced: true
        });
      }
    }
    
    // Sort by visit time (newest first)
    this.localHistory.sort((a, b) => b.visitTime - a.visitTime);
    this.saveLocalHistory();
  }
    
  // P2P history handling is now done by iOS app natively

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
        
    // Notify iOS app of new entry
    this.notifyNativeAppOfHistory();
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
        
    // Notify iOS app of history clear
    this.notifyNativeAppOfHistory();
  }

  deleteRemoteHistory() {
    // Same as clearing local history - clears everywhere
    this.clearLocalHistory();
  }

  async updateStorageAndUI() {
    try {
      await browser.storage.local.set({
        localHistoryCount: this.localHistory.length,
        lastSyncTime: this.lastSyncTime,
        deviceId: this.deviceId
      });

      // Update App Group so iOS app can see the real data
      try {
        await browser.runtime.sendNativeMessage('bar123.extension', {
          type: 'updateLocalHistoryData',
          historyCount: this.localHistory.length,
          lastSyncTime: this.lastSyncTime,
          deviceId: this.deviceId
        });
        console.log('✅ Updated App Group with local data:', { 
          history: this.localHistory.length,
          deviceId: this.deviceId
        });
      } catch (error) {
        console.log('ℹ️ Could not update App Group (extension may not be available):', error);
      }

      // Try to notify popup of status change (may fail if popup not open)
      try {
        await browser.runtime.sendMessage({
          action: 'statusUpdate',
          localHistoryCount: this.localHistory.length
        });
      } catch {
        // Popup not open, ignore
      }
    } catch (error) {
      console.error('Failed to update storage:', error);
    }
  }

  // P2P signaling is now handled natively by iOS app using IPFS/Helia
}

// Initialize the service
new LocalHistoryService();