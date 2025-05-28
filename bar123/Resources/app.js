// iOS app JavaScript using Trystero for P2P connections directly
// This replaces the complex native WebRTC bridge with simple JavaScript

class iOSHistorySyncService {
  constructor() {
    this.isConnected = false;
    this.peers = new Map();
    this.localHistory = [];
    this.deviceId = this.generateDeviceId();
    this.roomId = null;
    this.sharedSecret = null;
    this.room = null;
    this.sendHistory = null;
    this.sendDelete = null;
    
    this.init();
  }

  init() {
    console.log('🍎 iOS History Sync Service initializing...');
    this.loadLocalHistory();
    this.setupMessageHandlers();
    this.setupUIHandlers();
    
    // Initial UI update
    this.updateUI();
  }

  generateDeviceId() {
    const stored = localStorage.getItem('deviceId');
    if (stored) {return stored;}
    
    const newId = 'ios_app_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('deviceId', newId);
    return newId;
  }

  setupMessageHandlers() {
    // Listen for messages from Swift
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type) {
        this.handleSwiftMessage(event.data);
      }
    });
  }

  async handleSwiftMessage(message) {
    console.log('📱 Received message from Swift:', message);
    
    switch (message.type) {
    case 'sharedSecretResponse':
      if (message.secret && message.secret.trim()) {
        console.log('✅ Found shared secret, connecting...');
        await this.connect(message.secret.trim());
      } else {
        console.log('ℹ️ No shared secret found');
        if (this.isConnected) {
          await this.disconnect();
        }
      }
      break;
    }
  }

  setupUIHandlers() {
    // Setup button handlers
    const refreshButton = document.querySelector('#refresh-history');
    if (refreshButton) {
      refreshButton.onclick = () => this.refreshHistory();
    }
    
    const clearButton = document.querySelector('#clear-room');
    if (clearButton) {
      clearButton.onclick = () => this.clearRoomSecret();
    }
  }

  async connect(sharedSecret) {
    if (this.isConnected && this.sharedSecret === sharedSecret) {
      console.log('✅ Already connected with same secret');
      return;
    }

    if (this.isConnected) {
      console.log('🔄 Disconnecting to reconnect with new secret...');
      await this.disconnect();
    }

    this.sharedSecret = sharedSecret;
    this.roomId = await this.hashSecret(sharedSecret);
    
    try {
      await this.initializeTrystero();
      console.log('✅ Connected to Trystero room:', this.roomId);
      this.isConnected = true;
      this.updateUI();
      
      // Notify Swift of connection status
      this.notifySwift({
        type: 'connectionStatusUpdate',
        isConnected: true,
        peerCount: this.peers.size,
        roomId: this.roomId
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to Trystero:', error);
      this.isConnected = false;
      this.updateUI();
    }
  }

  async disconnect() {
    console.log('🔄 Disconnecting from Trystero...');
    
    if (this.room) {
      this.room.close();
      this.room = null;
    }
    
    this.isConnected = false;
    this.peers.clear();
    this.sharedSecret = null;
    this.roomId = null;
    this.sendHistory = null;
    this.sendDelete = null;
    
    this.updateUI();
    
    // Notify Swift of disconnection
    this.notifySwift({
      type: 'connectionStatusUpdate',
      isConnected: false,
      peerCount: 0
    });
  }

  async hashSecret(secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  async initializeTrystero() {
    console.log('🔧 Initializing Trystero connection...');
    
    if (typeof trystero === 'undefined') {
      throw new Error('Trystero not loaded');
    }
    
    console.log('🚀 Joining Trystero room:', this.roomId);
    this.room = trystero.joinRoom({ appId: 'history-sync' }, this.roomId);
    
    // Set up peer handlers
    this.room.onPeerJoin(peerId => {
      console.log('🎉 Peer joined:', peerId);
      this.peers.set(peerId, { connected: true });
      this.updateUI();
      
      // Send current history to new peer
      if (this.sendHistory && this.localHistory.length > 0) {
        console.log(`📤 Sending ${this.localHistory.length} history entries to new peer`);
        this.sendHistory({
          entries: this.localHistory,
          deviceId: this.deviceId,
          timestamp: Date.now()
        });
      }
      
      // Notify Swift
      this.notifySwift({
        type: 'peerJoined',
        peerId: peerId,
        peerCount: this.peers.size
      });
    });
    
    this.room.onPeerLeave(peerId => {
      console.log('👋 Peer left:', peerId);
      this.peers.delete(peerId);
      this.updateUI();
      
      // Notify Swift
      this.notifySwift({
        type: 'peerLeft',
        peerId: peerId,
        peerCount: this.peers.size
      });
    });
    
    // Set up data channels
    [this.sendHistory] = this.room.makeAction('history');
    [this.sendDelete] = this.room.makeAction('delete');
    
    // Listen for history data
    this.room.onAction('history', (data, peerId) => {
      console.log(`📥 Received ${data.entries?.length || 0} history entries from ${peerId}`);
      if (data.entries) {
        this.mergeHistoryEntries(data.entries, peerId);
      }
    });
    
    // Listen for delete commands
    this.room.onAction('delete', (data, peerId) => {
      console.log(`🗑️ Received delete command from ${peerId}`);
      this.handleRemoteDelete(data);
    });
    
    console.log('✅ Trystero room setup complete');
  }

  mergeHistoryEntries(entries, sourceDeviceId) {
    let newEntries = 0;
    
    entries.forEach(entry => {
      // Check if we already have this entry
      const existing = this.localHistory.find(local => 
        local.url === entry.url && 
        Math.abs((local.visitTime || 0) - (entry.visitTime || 0)) < 60000 // Within 1 minute
      );
      
      if (!existing) {
        // Add source device info
        const enrichedEntry = {
          ...entry,
          sourceDevice: sourceDeviceId,
          synced: true
        };
        
        this.localHistory.push(enrichedEntry);
        newEntries++;
      }
    });
    
    if (newEntries > 0) {
      console.log(`📝 Added ${newEntries} new history entries`);
      this.saveLocalHistory();
      this.updateUI();
      
      // Notify Swift of new entries
      this.notifySwift({
        type: 'historyUpdated',
        newEntries: newEntries,
        totalEntries: this.localHistory.length
      });
    }
  }

  loadLocalHistory() {
    try {
      const stored = localStorage.getItem('localHistory');
      this.localHistory = stored ? JSON.parse(stored) : [];
      console.log(`📚 Loaded ${this.localHistory.length} history entries from storage`);
    } catch (error) {
      console.error('Failed to load local history:', error);
      this.localHistory = [];
    }
  }

  saveLocalHistory() {
    try {
      localStorage.setItem('localHistory', JSON.stringify(this.localHistory));
      console.log(`💾 Saved ${this.localHistory.length} history entries to storage`);
    } catch (error) {
      console.error('Failed to save local history:', error);
    }
  }

  addHistoryEntry(entry) {
    console.log('📝 Adding history entry:', entry.url);
    
    // Check for duplicates
    const existing = this.localHistory.find(item => 
      item.url === entry.url && 
      Math.abs((item.visitTime || 0) - (entry.visitTime || 0)) < 60000
    );
    
    if (!existing) {
      const historyEntry = {
        ...entry,
        deviceId: this.deviceId,
        synced: false
      };
      
      this.localHistory.push(historyEntry);
      this.saveLocalHistory();
      this.updateUI();
      
      // Send to peers
      if (this.sendHistory && this.isConnected) {
        this.sendHistory({
          entries: [historyEntry],
          deviceId: this.deviceId,
          timestamp: Date.now()
        });
      }
    }
  }

  updateUI() {
    // Update connection status
    const isConnected = this.isConnected;
    const peerCount = this.peers.size;
    const statusText = isConnected ? 'Connected' : 'Disconnected';
    
    // Update status elements
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    const deviceCount = document.getElementById('peer-count');
    const historyCount = document.getElementById('history-count');
    const roomName = document.getElementById('room-name');
    
    if (indicator) {indicator.className = isConnected ? 'connected' : 'disconnected';}
    if (text) {text.textContent = statusText;}
    if (deviceCount) {deviceCount.textContent = peerCount;}
    if (historyCount) {historyCount.textContent = this.localHistory.length;}
    if (roomName && this.roomId) {roomName.textContent = this.roomId;}
    
    // Update history list
    this.updateHistoryDisplay();
  }

  updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    if (!historyList) {return;}
    
    if (this.localHistory.length === 0) {
      historyList.innerHTML = '<div class="history-item">No history available</div>';
      return;
    }
    
    // Sort by visit time (newest first)
    const sortedHistory = this.localHistory.sort((a, b) => (b.visitTime || 0) - (a.visitTime || 0));
    const recentHistory = sortedHistory.slice(0, 50);
    
    const historyHTML = recentHistory.map(entry => {
      const isLocal = !entry.synced || entry.sourceDevice === this.deviceId;
      const entryClass = isLocal ? 'local' : 'synced';
      const title = entry.title || entry.url || 'Unknown';
      const url = entry.url || '';
      const source = isLocal ? 'Local' : 'Synced';
      const visitCount = entry.visitCount || 1;
      
      return `
        <div class="history-item ${entryClass}">
          <div class="history-title">${this.escapeHTML(title)}</div>
          <div class="history-url">${this.escapeHTML(url)}</div>
          <div class="history-meta">
            <span class="history-source ${entryClass}">${source}</span>
            <span>Visits: ${visitCount}</span>
          </div>
        </div>
      `;
    }).join('');
    
    historyList.innerHTML = historyHTML;
  }

  escapeHTML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  refreshHistory() {
    console.log('🔄 Refreshing history display...');
    this.updateUI();
  }

  clearRoomSecret() {
    console.log('🗑️ Clearing room secret...');
    
    // Notify Swift to clear the secret
    this.notifySwift({
      type: 'clearRoomSecret'
    });
    
    // Disconnect from current room
    this.disconnect();
  }

  notifySwift(message) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
        window.webkit.messageHandlers.controller.postMessage(message);
      }
    } catch (error) {
      console.error('Failed to notify Swift:', error);
    }
  }
}

// Battery status detection
let powerStatus = 'battery';

function detectPowerStatus() {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(function(battery) {
      const newStatus = battery.charging ? 'charging' : 'battery';
      if (newStatus !== powerStatus) {
        powerStatus = newStatus;
        updateBatteryDisplay();
      }
    });
  }
}

function updateBatteryDisplay() {
  const batteryIndicator = document.getElementById('power-indicator');
  const batteryText = document.getElementById('power-text');
  
  if (batteryIndicator && batteryText) {
    const icon = powerStatus === 'charging' ? '⚡' : '🔋';
    const text = powerStatus === 'charging' ? 'Charging - Auto Refresh' : 'Battery Mode - Manual Refresh Only';
    
    batteryIndicator.textContent = icon;
    batteryText.textContent = text;
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🍎 iOS app initializing...');
  
  // Initialize history sync service
  window.historySyncService = new iOSHistorySyncService();
  
  // Setup battery monitoring
  detectPowerStatus();
  setInterval(detectPowerStatus, 30000);
  
  console.log('✅ iOS app initialized successfully');
});

// Expose global functions for Swift to call
window.requestSecretCheck = function() {
  console.log('📱 Swift requested secret check');
  window.historySyncService?.notifySwift({ type: 'getSharedSecret' });
};

window.addHistoryEntry = function(entry) {
  console.log('📝 Swift adding history entry:', entry);
  window.historySyncService?.addHistoryEntry(entry);
};

// Global functions for HTML onclick handlers
window.setRoomSecret = function() {
  console.log('🔐 Setting room secret from UI...');
  
  const input = document.getElementById('room-secret-input');
  console.log('📍 Input element:', input);
  console.log('📍 Input value:', input?.value);
  
  if (input && input.value.trim()) {
    const secret = input.value.trim();
    console.log('📤 Sending secret to Swift:', secret);
    
    // Send to Swift to save in UserDefaults
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
      console.log('✅ Webkit available, sending message...');
      window.webkit.messageHandlers.controller.postMessage({
        type: 'setSharedSecret',
        secret: secret
      });
    } else {
      console.error('❌ Webkit messageHandlers not available');
      console.error('Available webkit properties:', Object.keys(window.webkit || {}));
    }
  } else {
    alert('Please enter a room secret');
  }
};

window.checkForPassword = function() {
  console.log('🔍 Checking for existing password...');
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
    window.webkit.messageHandlers.controller.postMessage({
      type: 'getSharedSecret'
    });
  }
};

window.openSafariExtension = function() {
  console.log('🌐 Opening Safari extension...');
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
    window.webkit.messageHandlers.controller.postMessage({
      type: 'openSafariExtension'
    });
  }
};

window.refreshHistory = function() {
  console.log('🔄 Refreshing history...');
  window.historySyncService?.refreshHistory();
};

window.clearRoomSecret = function() {
  console.log('🗑️ Clearing room secret...');
  if (confirm('Clear room secret and disconnect?')) {
    window.historySyncService?.clearRoomSecret();
  }
};