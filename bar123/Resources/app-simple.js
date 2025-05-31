// Simplified iOS app JavaScript - only UI display, no P2P (handled by TrysteroSwift)

class iOSHistoryViewer {
  constructor() {
    this.isConnected = false;
    this.peerCount = 0;
    this.historyEntries = [];
    this.roomId = null;
    
    this.init();
  }

  init() {
    console.log('🍎 iOS History Viewer initializing...');
    this.setupMessageHandlers();
    this.setupUIHandlers();
    this.updateUI();
  }

  setupMessageHandlers() {
    // Listen for messages from Swift ViewController
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type) {
        this.handleSwiftMessage(event.data);
      }
    });
  }

  async handleSwiftMessage(message) {
    console.log('📱 Received message from Swift:', message);
    
    switch (message.type) {
      case 'historyUpdate':
        this.updateFromSwift(message);
        break;
    }
  }

  updateFromSwift(data) {
    // Update connection status
    this.isConnected = data.isConnected || false;
    this.peerCount = data.peerCount || 0;
    this.historyEntries = data.history || [];
    
    console.log(`📊 Updated from Swift: connected=${this.isConnected}, peers=${this.peerCount}, history=${this.historyEntries.length}`);
    
    this.updateUI();
  }

  setupUIHandlers() {
    // Setup button handlers
    const clearButton = document.querySelector('#clear-room');
    if (clearButton) {
      clearButton.onclick = () => this.clearRoomSecret();
    }
  }

  updateUI() {
    // Update connection status
    const statusText = this.isConnected ? 'Connected' : 'Disconnected';
    
    // Update status elements
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    const deviceCount = document.getElementById('peer-count');
    const historyCount = document.getElementById('history-count');
    const roomName = document.getElementById('room-name');
    
    if (indicator) {indicator.className = this.isConnected ? 'connected' : 'disconnected';}
    if (text) {text.textContent = statusText;}
    if (deviceCount) {deviceCount.textContent = this.peerCount;}
    if (historyCount) {historyCount.textContent = this.historyEntries.length;}
    if (roomName && this.roomId) {roomName.textContent = this.roomId;}
    
    // Update history list
    this.updateHistoryDisplay();
  }

  updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    if (!historyList) {return;}
    
    if (this.historyEntries.length === 0) {
      historyList.innerHTML = '<div class="history-item">No recent history available</div>';
      return;
    }
    
    // Show last 10 sites as requested
    const recentHistory = this.historyEntries.slice(0, 10);
    
    const historyHTML = recentHistory.map(entry => {
      const title = entry.title || entry.url || 'Unknown';
      const url = entry.url || '';
      const hostname = entry.hostname || '';
      const isArticle = entry.isArticle || false;
      const readingTime = entry.readingTime || 0;
      const excerpt = entry.excerpt || '';
      
      // Format reading time display
      let readingDisplay = '';
      if (isArticle && readingTime > 0) {
        readingDisplay = `<span class="article-badge">📖 ${readingTime} min read</span>`;
      }
      
      // Format visit time
      const visitTime = entry.visitTime ? new Date(entry.visitTime).toLocaleString() : '';
      
      return `
        <div class="history-item ${isArticle ? 'article' : ''}">
          <div class="history-title">${this.escapeHTML(title)}</div>
          <div class="history-url">${this.escapeHTML(hostname)}</div>
          ${excerpt ? `<div class="history-excerpt">${this.escapeHTML(excerpt)}</div>` : ''}
          <div class="history-meta">
            <span class="history-time">${visitTime}</span>
            ${readingDisplay}
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

  clearRoomSecret() {
    console.log('🗑️ Clearing room secret...');
    
    // Notify Swift to clear the secret
    this.notifySwift({
      type: 'clearRoomSecret'
    });
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

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🍎 iOS app initializing...');
  
  // Initialize history viewer
  window.historyViewer = new iOSHistoryViewer();
  
  console.log('✅ iOS app initialized successfully');
});

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
  // History refresh is now handled by TrysteroSwift, just update UI
  window.historyViewer?.updateUI();
};

window.clearRoomSecret = function() {
  console.log('🗑️ Clearing room secret...');
  if (confirm('Clear room secret and disconnect?')) {
    window.historyViewer?.clearRoomSecret();
  }
};