// Simplified Safari extension background script
// Only handles history tracking and sends data to iOS app
// All P2P sync logic moved to iOS TrysteroSwift

class HistoryTracker {
  constructor() {
    this.localHistory = [];
    this.deviceId = this.generateDeviceId();
    this.init();
  }

  init() {
    this.loadLocalHistory();
    this.setupMessageHandlers();
    this.notifyiOSAppReady();
  }

  generateDeviceId() {
    const stored = localStorage.getItem('deviceId');
    if (stored) return stored;
    
    const newId = 'safari_ext_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
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

        case 'getStats':
          sendResponse({
            localHistoryCount: this.localHistory.length,
            deviceId: this.deviceId
          });
          break;

        case 'getHistory':
          sendResponse({ 
            success: true, 
            history: this.localHistory.slice(0, 10) // Return last 10 entries for iOS display
          });
          break;

        default:
          console.log('Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
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
    
    // Send to iOS app for sync
    this.sendToiOSApp(historyEntry);
  }

  updateEntryDuration(url, duration) {
    const entry = this.localHistory.find(e => e.url === url && !e.synced);
    if (entry) {
      entry.duration = duration;
      this.saveLocalHistory();
      
      // Send updated entry to iOS app
      this.sendToiOSApp(entry);
    }
  }

  generateEntryId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  sendToiOSApp(historyEntry) {
    try {
      // Send history entry to iOS app via native messaging
      browser.runtime.sendNativeMessage('xyz.foo.bar123.Extension', {
        type: 'historyEntry',
        entry: historyEntry
      }).then(() => {
        console.log('✅ Sent history entry to iOS app');
      }).catch(error => {
        console.error('❌ Failed to send to iOS app:', error);
      });
    } catch (error) {
      console.error('Failed to send to iOS app:', error);
    }
  }

  notifyiOSAppReady() {
    try {
      browser.runtime.sendNativeMessage('xyz.foo.bar123.Extension', {
        type: 'extensionReady',
        deviceId: this.deviceId
      }).catch(error => {
        console.log('iOS app not available for native messaging');
      });
    } catch (error) {
      console.log('Native messaging not available');
    }
  }
}

// Initialize the simplified tracker
new HistoryTracker();