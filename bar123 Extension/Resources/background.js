// Safari extension background script - simplified for history tracking only
// P2P sync now handled by native Swift app using TrysteroSwift

class HistoryTracker {
  constructor() {
    this.localHistory = [];
    this.deviceId = this.generateDeviceId();
    
    this.init();
  }

  init() {
    this.loadLocalHistory();
    this.setupMessageHandlers();
  }

  generateDeviceId() {
    // Use a persistent device ID
    const stored = localStorage.getItem('deviceId');
    if (stored) return stored;
        
    const newId = 'ios_safari_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('deviceId', newId);
    return newId;
  }

  async loadLocalHistory() {
    try {
      const stored = await browser.storage.local.get(['localHistory']);
      this.localHistory = stored.localHistory || [];
    } catch (error) {
      console.error('Failed to load local history:', error);
      this.localHistory = [];
    }
  }

  async saveLocalHistory() {
    try {
      await browser.storage.local.set({
        localHistory: this.localHistory,
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
        case 'trackHistory':
          console.log('📝 Tracking history entry:', request.entry);
          this.addHistoryEntry(request.entry);
          sendResponse({ success: true });
          break;

        case 'updateDuration':
          this.updateEntryDuration(request.url, request.duration);
          sendResponse({ success: true });
          break;

        case 'getRecentHistory':
          const limit = request.limit || 10;
          const recentHistory = this.localHistory.slice(0, limit);
          sendResponse({ 
            success: true, 
            history: recentHistory
          });
          break;

        case 'getHistory':
          sendResponse({ 
            success: true, 
            history: this.localHistory.slice(0, 50) // Return last 50 entries
          });
          break;

        case 'clearLocal':
          this.clearLocalHistory();
          sendResponse({ success: true });
          break;

        case 'syncToNativeApp':
          this.syncHistoryToNativeApp();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  addHistoryEntry(entry) {
    const historyEntry = {
      ...entry,
      id: this.generateEntryId(),
      sourceDevice: this.deviceId,
      synced: false,
      timestamp: Date.now()
    };
        
    this.localHistory.unshift(historyEntry);
    console.log(`📚 Added to local history. Total entries: ${this.localHistory.length}`);
        
    this.saveLocalHistory();
    
    // Notify native app about new history entry
    this.notifyNativeApp({
      type: 'newHistoryEntry',
      entry: historyEntry
    });

    // Notify popup if open
    this.notifyPopup();
  }

  updateEntryDuration(url, duration) {
    const entry = this.localHistory.find(e => e.url === url && !e.synced);
    if (entry) {
      entry.duration = duration;
      this.saveLocalHistory();
      
      // Notify native app about updated entry
      this.notifyNativeApp({
        type: 'historyEntryUpdated',
        entry: entry
      });
    }
  }

  generateEntryId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  clearLocalHistory() {
    this.localHistory = [];
    this.saveLocalHistory();
    this.notifyPopup();
    
    // Notify native app
    this.notifyNativeApp({
      type: 'historyCleared'
    });
  }

  async syncHistoryToNativeApp() {
    console.log(`📤 Syncing ${this.localHistory.length} history entries to native app`);
    
    this.notifyNativeApp({
      type: 'fullHistorySync',
      entries: this.localHistory,
      deviceId: this.deviceId,
      timestamp: Date.now()
    });
  }

  notifyNativeApp(message) {
    console.log('📱 Notifying native app:', message.type);
    
    // Send message to native Swift app
    try {
      browser.runtime.sendNativeMessage('xyz.foo.bar123.Extension', {
        type: 'extensionToApp',
        message: message
      });
    } catch (error) {
      console.error('Failed to notify native app:', error);
    }
  }

  async notifyPopup() {
    // Try to notify popup of changes (may fail if popup not open)
    try {
      await browser.runtime.sendMessage({
        action: 'historyUpdated'
      });
    } catch {
      // Popup not open, ignore
    }
  }
}

// Initialize the tracker
new HistoryTracker();