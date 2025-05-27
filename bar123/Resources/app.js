// iOS App Main Logic - Password Detection and P2P Viewer
console.log('History Sync iOS App loaded');

class HistorySyncApp {
  constructor() {
    this.room = null;
    this.sharedSecret = null;
    this.checkInterval = null;
    this.connectionStatus = 'disconnected';
    this.powerState = 'unknown';
    this.batteryLevel = 1.0;
    this.isCharging = false;
    
    // iOS-specific power strategy: conservative always, desktop aggressive
    this.intervals = {
      charging: null,        // Even when charging, iOS stays manual-only
      battery: null          // No automatic polling on battery
    };
    
    this.manualRefreshRequested = false;
    
    this.init();
  }

  async init() {
    console.log('Initializing History Sync App...');
    
    // Set up power state monitoring
    await this.initPowerMonitoring();
    
    // Set up UI event handlers
    this.setupEventHandlers();
    
    // Start checking for stored password
    await this.checkForStoredPassword();
    
    // Set up periodic checking for password changes
    this.startPasswordPolling();
  }

  setupEventHandlers() {
    // Setup view - retry button (manual refresh)
    document.getElementById('retryBtn')?.addEventListener('click', () => {
      this.manualRefresh();
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

    // Viewer view - refresh button (manual refresh)
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
      
      // Check localStorage first (for testing)
      for (const key of possibleKeys) {
        const stored = localStorage.getItem(key);
        if (stored && stored.trim()) {
          foundSecret = stored.trim();
          console.log(`Found stored secret in localStorage.${key}`);
          break;
        }
      }
      
      // Debug: Try to access WebExtensions storage if available
      if (!foundSecret && typeof browser !== 'undefined' && browser.storage) {
        try {
          const extensionData = await browser.storage.local.get(['sharedSecret']);
          if (extensionData.sharedSecret) {
            foundSecret = extensionData.sharedSecret;
            console.log('Found stored secret in browser.storage.local');
          }
        } catch (error) {
          console.log('Cannot access browser.storage.local:', error.message);
        }
      }

      // Check App Group shared storage (primary method)
      if (!foundSecret) {
        foundSecret = await this.tryGetPasswordFromSharedStorage();
      }

      // If still no password found, check if we can communicate with the extension
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

  async tryGetPasswordFromSharedStorage() {
    console.log('Checking App Group shared storage...');
    
    try {
      // Check if we can access the shared UserDefaults via native bridge
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sharedStorage) {
        const result = await new Promise((resolve) => {
          // Set up listener for response
          const handleResponse = (event) => {
            console.log('Received shared storage response:', event.detail);
            window.removeEventListener('sharedStorageResponse', handleResponse);
            resolve(event.detail);
          };
          
          window.addEventListener('sharedStorageResponse', handleResponse);
          
          // Send message to native code to check shared storage
          console.log('Requesting shared secret from native bridge...');
          window.webkit.messageHandlers.sharedStorage.postMessage({
            action: 'getSharedSecret'
          });
          
          // Timeout after 3 seconds
          setTimeout(() => {
            window.removeEventListener('sharedStorageResponse', handleResponse);
            resolve({ success: false, error: 'Timeout' });
          }, 3000);
        });
        
        if (result && result.success && result.sharedSecret && result.sharedSecret.trim()) {
          console.log('Found shared secret in App Group storage');
          return result.sharedSecret.trim();
        } else if (result && !result.success) {
          console.log('App Group storage access failed:', result.error);
        } else {
          console.log('No shared secret found in App Group storage');
        }
      } else {
        console.log('Native bridge not available');
      }
      
      return null;
    } catch (error) {
      console.log('Could not access shared storage:', error.message);
      return null;
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
    
    // Update power state UI
    this.updatePowerStateUI();
  }

  showViewerView() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('viewer-view').style.display = 'flex';
    
    // Update room secret display (masked)
    const secretEl = document.getElementById('roomSecret');
    if (secretEl && this.sharedSecret) {
      secretEl.textContent = '•'.repeat(Math.min(this.sharedSecret.length, 8));
    }
    
    // Update power state UI
    this.updatePowerStateUI();
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
    if (!historyFeed) {
      return;
    }

    // Remove "no history" message if present
    const noHistory = historyFeed.querySelector('.no-history');
    if (noHistory) {
      noHistory.remove();
    }

    // Create history item element
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item new';
    
    const timestamp = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
    
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

  async initPowerMonitoring() {
    console.log('Setting up power monitoring...');
    
    try {
      // Try to get battery information if available
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;
        this.updatePowerState();
        
        // Listen for power state changes
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.updatePowerState();
          console.log(`Power state changed: ${this.isCharging ? 'charging' : 'on battery'}`);
        });
        
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.updatePowerState();
        });
      } else {
        // Fallback: assume on battery to be conservative
        this.isCharging = false;
        this.batteryLevel = 0.5;
        this.updatePowerState();
        console.log('Battery API not available, assuming battery mode');
      }
    } catch (error) {
      console.log('Could not access battery information:', error.message);
      // Default to conservative battery mode
      this.isCharging = false;
      this.batteryLevel = 0.5;
      this.updatePowerState();
    }
    
    // Set up user interaction tracking for battery mode
    this.setupUserInteractionTracking();
  }

  updatePowerState() {
    const oldState = this.powerState;
    this.powerState = this.isCharging ? 'charging' : 'battery';
    
    if (oldState !== this.powerState) {
      console.log(`Power state updated: ${this.powerState} (battery: ${Math.round(this.batteryLevel * 100)}%)`);
      this.updatePowerStateUI();
      this.restartPasswordPolling();
      this.updateConnectionBehavior();
    }
  }

  updatePowerStateUI() {
    const batteryPercent = Math.round(this.batteryLevel * 100);
    let powerText, powerIcon;
    
    if (this.isCharging) {
      powerIcon = '⚡';
      powerText = `${powerIcon} Charging (${batteryPercent}%)`;
    } else {
      powerIcon = '🔋';
      powerText = `${powerIcon} Battery (${batteryPercent}%)`;
    }
    
    // Update viewer power mode
    const viewerPowerMode = document.getElementById('powerMode');
    if (viewerPowerMode) {
      viewerPowerMode.textContent = `${powerText} • Read-only`;
      viewerPowerMode.className = this.isCharging ? 'value charging' : 'value battery';
    }
    
    // Update setup power mode - iOS always manual
    const setupPowerMode = document.getElementById('setupPowerMode');
    if (setupPowerMode) {
      setupPowerMode.textContent = `${powerText} - Manual refresh only`;
      setupPowerMode.className = this.isCharging ? 'power-indicator charging' : 'power-indicator battery';
    }
  }

  setupUserInteractionTracking() {
    // iOS: Manual refresh only via explicit button clicks
    // No automatic background polling to preserve battery
    console.log('iOS mode: Manual refresh only via explicit user actions');
  }

  restartPasswordPolling() {
    this.stopPasswordPolling();
    this.startPasswordPolling();
  }

  startPasswordPolling() {
    // iOS: No automatic polling at all - manual refresh only
    console.log('iOS mode: No automatic password polling - manual refresh via buttons only');
  }

  getCurrentPollingInterval() {
    // iOS always uses manual refresh, never automatic polling
    return null;
  }

  manualRefresh() {
    console.log('Manual refresh requested');
    this.manualRefreshRequested = true;
    this.checkForStoredPassword();
  }


  updateConnectionBehavior() {
    // iOS: Always conservative - no real-time syncing even when charging
    // This is a read-only viewer app, not an active sync client
    if (this.room) {
      console.log('iOS mode: Read-only P2P viewer - no active syncing');
      // In a real implementation: 
      // - No history sending from iOS app
      // - Minimal keep-alive messages
      // - Receive-only mode for viewing desktop history
    }
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