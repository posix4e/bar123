// iOS App Main Logic - Password Detection and P2P Viewer
console.log('History Sync iOS App loaded');

class HistorySyncApp {
  constructor() {
    this.room = null;
    this.sharedSecret = null;
    this.checkInterval = null;
    this.connectionStatus = 'disconnected';
    
    this.init();
  }

  async init() {
    console.log('Initializing History Sync App...');
    
    // Set up UI event handlers
    this.setupEventHandlers();
    
    // Start checking for stored password
    await this.checkForStoredPassword();
    
    // Set up periodic checking for password changes
    this.startPasswordPolling();
  }

  setupEventHandlers() {
    // Setup view - retry button
    document.getElementById('retryBtn')?.addEventListener('click', () => {
      this.checkForStoredPassword();
    });

    // Viewer view - disconnect button
    document.getElementById('disconnectViewerBtn')?.addEventListener('click', () => {
      this.disconnectFromRoom();
      this.showSetupView();
    });

    // Viewer view - show setup button
    document.getElementById('showSetupBtn')?.addEventListener('click', () => {
      this.showSetupView();
    });

    // Viewer view - refresh button
    document.getElementById('refreshViewerBtn')?.addEventListener('click', () => {
      this.refreshHistoryFeed();
    });
  }

  async checkForStoredPassword() {
    console.log('Checking for stored password from Safari extension...');
    
    try {
      // Try multiple storage locations where the extension might save the password
      const possibleKeys = [
        'sharedSecret',
        'roomSecret', 
        'historySync_sharedSecret',
        'historySync_roomId'
      ];

      let foundSecret = null;
      
      // Check localStorage first
      for (const key of possibleKeys) {
        const stored = localStorage.getItem(key);
        if (stored && stored.trim()) {
          foundSecret = stored.trim();
          console.log(`Found stored secret in localStorage.${key}`);
          break;
        }
      }

      // If no password found, check if we can communicate with the extension
      if (!foundSecret) {
        foundSecret = await this.tryGetPasswordFromExtension();
      }

      if (foundSecret) {
        this.sharedSecret = foundSecret;
        this.showViewerView();
        await this.connectToRoom();
      } else {
        this.showSetupView();
      }
    } catch (error) {
      console.error('Error checking for stored password:', error);
      this.showSetupView();
    }
  }

  async tryGetPasswordFromExtension() {
    console.log('Attempting to get password from Safari extension...');
    
    try {
      // Try to communicate with the extension if possible
      // This might not work due to sandbox restrictions, but worth trying
      
      // For now, return null - this would need native iOS integration
      // to access shared app group storage between app and extension
      return null;
    } catch (error) {
      console.log('Could not communicate with extension:', error.message);
      return null;
    }
  }

  showSetupView() {
    document.getElementById('setup-view').style.display = 'flex';
    document.getElementById('viewer-view').style.display = 'none';
    
    // Update setup status
    const statusEl = document.querySelector('.setup-status p');
    if (statusEl) {
      statusEl.textContent = '🔍 No connection found. Please set up the Safari extension.';
    }
  }

  showViewerView() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('viewer-view').style.display = 'flex';
    
    // Update room secret display (masked)
    const secretEl = document.getElementById('roomSecret');
    if (secretEl && this.sharedSecret) {
      secretEl.textContent = '•'.repeat(Math.min(this.sharedSecret.length, 8));
    }
  }

  async connectToRoom() {
    if (!this.sharedSecret) {
      console.error('No shared secret available for connection');
      return;
    }

    try {
      this.updateConnectionStatus('Connecting...');
      console.log('Connecting to P2P room...');

      // Hash the shared secret to create room ID (same as extension logic)
      const encoder = new TextEncoder();
      const data = encoder.encode(this.sharedSecret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const roomId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

      console.log(`Joining room: ${roomId}`);

      // For now, simulate connection - would need to load Trystero library
      // This would require adding Trystero to the iOS app bundle
      this.simulateConnection();

    } catch (error) {
      console.error('Connection failed:', error);
      this.updateConnectionStatus('Connection failed');
    }
  }

  simulateConnection() {
    // Simulate connecting to room for now
    // In a real implementation, we'd load Trystero and connect
    
    setTimeout(() => {
      this.updateConnectionStatus('Connected (Read-only)');
      this.updatePeerCount(0);
      
      // Simulate receiving some history entries
      setTimeout(() => {
        this.addHistoryEntry({
          title: 'Welcome to History Sync',
          url: 'https://example.com',
          timestamp: Date.now(),
          deviceId: 'demo-device'
        });
      }, 2000);
    }, 1500);
  }

  disconnectFromRoom() {
    if (this.room) {
      try {
        this.room.leave();
      } catch (error) {
        console.warn('Error leaving room:', error);
      }
    }
    
    this.room = null;
    this.updateConnectionStatus('Disconnected');
    this.updatePeerCount(0);
    this.clearHistoryFeed();
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status.toLowerCase();
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = 'connection-status';
      
      if (status.toLowerCase().includes('connected')) {
        statusEl.classList.add('connected');
      } else if (status.toLowerCase().includes('connecting')) {
        statusEl.classList.add('connecting');
      }
    }
  }

  updatePeerCount(count) {
    const peerCountEl = document.getElementById('peerCount');
    if (peerCountEl) {
      peerCountEl.textContent = count.toString();
    }
  }

  addHistoryEntry(entry) {
    const historyFeed = document.getElementById('historyFeed');
    if (!historyFeed) return;

    // Remove "no history" message if present
    const noHistory = historyFeed.querySelector('.no-history');
    if (noHistory) {
      noHistory.remove();
    }

    // Create history item element
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item new';
    
    const timestamp = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
    const favicon = entry.url ? `https://www.google.com/s2/favicons?domain=${new URL(entry.url).hostname}` : '';
    
    historyItem.innerHTML = `
      <div class="history-content">
        <div class="history-title">${entry.title || 'No title'}</div>
        <div class="history-url">${entry.url || 'No URL'}</div>
        <div class="history-meta">${timestamp} • From ${entry.deviceId || 'unknown device'}</div>
      </div>
    `;
    
    // Add to top of feed
    historyFeed.insertBefore(historyItem, historyFeed.firstChild);
    
    // Keep only last 50 items
    while (historyFeed.children.length > 50) {
      historyFeed.removeChild(historyFeed.lastChild);
    }
    
    // Remove 'new' class after animation
    setTimeout(() => {
      historyItem.classList.remove('new');
    }, 500);
  }

  clearHistoryFeed() {
    const historyFeed = document.getElementById('historyFeed');
    if (historyFeed) {
      historyFeed.innerHTML = '<div class="no-history">Listening for history updates...</div>';
    }
  }

  refreshHistoryFeed() {
    console.log('Refreshing history feed...');
    // In a real implementation, this would request fresh data from peers
    
    // For now, just show a refresh animation
    const refreshBtn = document.getElementById('refreshViewerBtn');
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(360deg)';
      refreshBtn.style.transition = 'transform 0.5s ease';
      setTimeout(() => {
        refreshBtn.style.transform = '';
        refreshBtn.style.transition = '';
      }, 500);
    }
  }

  startPasswordPolling() {
    // Check for password changes every 5 seconds
    this.checkInterval = setInterval(() => {
      if (!this.sharedSecret) {
        this.checkForStoredPassword();
      }
    }, 5000);
  }

  stopPasswordPolling() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Cleanup when app is closed
  destroy() {
    this.stopPasswordPolling();
    this.disconnectFromRoom();
  }
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.historySyncApp = new HistorySyncApp();
  });
} else {
  window.historySyncApp = new HistorySyncApp();
}

// Handle app lifecycle
window.addEventListener('beforeunload', () => {
  if (window.historySyncApp) {
    window.historySyncApp.destroy();
  }
});