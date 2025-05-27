// Global state
let currentPassword = null;
let isViewingHistory = false;
let powerStatus = 'battery'; // 'battery' or 'charging'
let p2pRoom = null;
const connectedPeers = new Set();
let localHistory = [];
let deviceId = null;

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('iOS app initializing...');
  generateDeviceId();
  loadLocalHistory();
  detectPowerStatus();
  checkForPassword();
    
  // Check battery status periodically
  setInterval(detectPowerStatus, 30000); // Every 30 seconds
});

// Generate or retrieve persistent device ID
function generateDeviceId() {
  const stored = localStorage.getItem('bar123_deviceId');
  if (stored) {
    deviceId = stored;
  } else {
    deviceId = 'ios_app_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('bar123_deviceId', deviceId);
  }
  console.log('Device ID:', deviceId);
}

// Load locally stored history
function loadLocalHistory() {
  try {
    const stored = localStorage.getItem('bar123_localHistory');
    const lastSync = localStorage.getItem('bar123_lastSyncTime');
    
    localHistory = stored ? JSON.parse(stored) : [];
    console.log(`Loaded ${localHistory.length} history items from storage`);
    
    if (lastSync) {
      console.log('Last sync:', new Date(parseInt(lastSync)));
    }
  } catch (error) {
    console.error('Failed to load local history:', error);
    localHistory = [];
  }
}

// Save history to local storage
function saveLocalHistory() {
  try {
    localStorage.setItem('bar123_localHistory', JSON.stringify(localHistory));
    localStorage.setItem('bar123_lastSyncTime', Date.now().toString());
    console.log(`Saved ${localHistory.length} history items to storage`);
  } catch (error) {
    console.error('Failed to save local history:', error);
  }
}

// Check if device is charging vs on battery
function detectPowerStatus() {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(function(battery) {
      const wasCharging = powerStatus === 'charging';
      powerStatus = battery.charging ? 'charging' : 'battery';
            
      updatePowerUI();
            
      // If we just started charging and have a password, start syncing
      if (!wasCharging && battery.charging && currentPassword) {
        console.log('Device started charging - enabling sync');
        if (isViewingHistory) {
          refreshHistory();
        }
      }
    }).catch(function(error) {
      console.log('Battery API not available:', error);
      powerStatus = 'battery'; // Default to battery mode
      updatePowerUI();
    });
  } else {
    powerStatus = 'battery'; // Default to battery mode
    updatePowerUI();
  }
}

// Update power status UI
function updatePowerUI() {
  const powerIndicator = document.getElementById('power-indicator');
  const powerText = document.getElementById('power-text');
    
  if (!powerIndicator || !powerText) {return;}
    
  if (powerStatus === 'charging') {
    powerIndicator.textContent = '⚡';
    powerIndicator.className = 'charging';
    powerText.textContent = 'Charging - Auto Sync Enabled';
  } else {
    powerIndicator.textContent = '🔋';
    powerIndicator.className = 'battery';
    powerText.textContent = 'Battery Mode - Manual Refresh Only';
  }
}

// Try to get password from shared storage via Swift bridge
async function tryGetPasswordFromSharedStorage() {
  return new Promise((resolve) => {
    // Set up one-time message listener for response
    const messageHandler = function(event) {
      if (event.data && event.data.type === 'sharedSecretResponse') {
        window.removeEventListener('message', messageHandler);
        console.log('Received shared secret response:', event.data.secret ? 'Found' : 'Not found');
        resolve(event.data.secret || null);
      }
    };
        
    window.addEventListener('message', messageHandler);
        
    // Send message to Swift via WebKit
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
      console.log('Requesting shared secret from Swift...');
      window.webkit.messageHandlers.controller.postMessage({
        type: 'getSharedSecret'
      });
            
      // Timeout after 2 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        console.log('Timeout waiting for shared secret');
        resolve(null);
      }, 2000);
    } else {
      console.log('WebKit message handlers not available');
      window.removeEventListener('message', messageHandler);
      resolve(null);
    }
  });
}

// Check for room password and switch views
async function checkForPassword() {
  console.log('Checking for room password...');
    
  const password = await tryGetPasswordFromSharedStorage();
    
  if (password && password.trim() !== '') {
    currentPassword = password.trim();
    console.log('Found password, switching to history viewer');
    switchToHistoryViewer();
  } else {
    console.log('No password found, showing setup view');
    switchToSetupView();
  }
}

// Switch to setup view
function switchToSetupView() {
  document.getElementById('setup-view').style.display = 'block';
  document.getElementById('history-viewer').style.display = 'none';
  isViewingHistory = false;
}

// Switch to history viewer
function switchToHistoryViewer() {
  document.getElementById('setup-view').style.display = 'none';
  document.getElementById('history-viewer').style.display = 'block';
  isViewingHistory = true;
    
  // Update room name display
  const roomName = document.getElementById('room-name');
  if (roomName && currentPassword) {
    // Show first and last few characters of password for identification
    const display = currentPassword.length > 10 
      ? currentPassword.substring(0, 4) + '...' + currentPassword.substring(currentPassword.length - 4)
      : currentPassword;
    roomName.textContent = display;
  }
    
  updatePowerUI();
  updateConnectionStatus('connecting');
    
  // Load real history data
  loadHistoryData();
}

// Update connection status
function updateConnectionStatus(status) {
  const indicator = document.getElementById('connection-indicator');
  const text = document.getElementById('connection-text');
    
  if (!indicator || !text) {return;}
    
  switch (status) {
  case 'connecting':
    indicator.className = 'connecting';
    text.textContent = 'Connecting...';
    break;
  case 'connected':
    indicator.className = 'connected';
    text.textContent = 'Connected';
    break;
  case 'disconnected':
    indicator.className = 'disconnected';
    text.textContent = 'Disconnected';
    break;
  }
}

// Load real history data from P2P network
function loadHistoryData() {
  const historyList = document.getElementById('history-list');
  if (!historyList) {
    return;
  }
    
  if (!currentPassword) {
    historyList.innerHTML = '<div class="history-item">No room secret available</div>';
    return;
  }
    
  // Display existing history first, then connect for updates
  displayHistoryItems();
  
  // Initialize P2P connection with room secret
  initP2PConnection();
}

// Initialize P2P connection using Trystero (based on GitHub Pages viewer)
async function initP2PConnection() {
  if (!currentPassword || !window.trystero) {
    console.error('Cannot initialize P2P: missing password or Trystero');
    updateConnectionStatus('disconnected');
    return;
  }
  
  try {
    console.log('Initializing P2P connection with room secret...');
    updateConnectionStatus('connecting');
    
    // Hash the room secret like the GitHub Pages viewer does
    const encoder = new TextEncoder();
    const data = encoder.encode(currentPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedSecret = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    
    // Create room using Trystero (same as GitHub Pages viewer)
    p2pRoom = trystero.joinRoom({
      appId: 'history-sync'
    }, hashedSecret);
    
    // Set up history sync channel
    const [, receiveHistory] = p2pRoom.makeAction('history-sync');
    
    // Listen for history updates from other peers
    receiveHistory((historyData, peerId) => {
      console.log('Received history from peer:', peerId, historyData);
      addHistoryToLocalStorage(historyData, peerId);
    });
    
    // Track peer connections
    p2pRoom.onPeerJoin(peerId => {
      console.log('Peer joined:', peerId);
      connectedPeers.add(peerId);
      updatePeerCount();
      updateConnectionStatus('connected');
    });
    
    p2pRoom.onPeerLeave(peerId => {
      console.log('Peer left:', peerId);
      connectedPeers.delete(peerId);
      updatePeerCount();
      
      if (connectedPeers.size === 0) {
        updateConnectionStatus('disconnected');
      }
    });
    
    console.log('P2P connection initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize P2P connection:', error);
    updateConnectionStatus('disconnected');
  }
}

// Add history item to local storage and display (based on GitHub Pages viewer)
function addHistoryToLocalStorage(historyData, peerId) {
  if (!historyData.url) {
    return;
  }
  
  // Check if we already have this URL
  const exists = localHistory.some(item => item.url === historyData.url);
  if (exists) {
    return;
  }
  
  // Add to local storage
  const historyItem = {
    url: historyData.url,
    title: historyData.title || 'No title',
    timestamp: new Date().toISOString(),
    peerId: peerId
  };
  
  localHistory.unshift(historyItem); // Add to beginning
  
  // Keep only last 100 items
  if (localHistory.length > 100) {
    localHistory = localHistory.slice(0, 100);
  }
  
  // Save to storage and update display
  saveLocalHistory();
  displayHistoryItems();
  
  console.log(`Added new history item: ${historyData.title}`);
}

// Display history items in UI (based on GitHub Pages viewer styling)
function displayHistoryItems() {
  const historyList = document.getElementById('history-list');
  if (!historyList) {
    return;
  }
    
  historyList.innerHTML = '';
    
  if (localHistory.length === 0) {
    historyList.innerHTML = '<div class="history-item">Listening for history updates...</div>';
  } else {
    // Show most recent 50 items
    const recentItems = localHistory.slice(0, 50);
    
    recentItems.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const timestamp = new Date(item.timestamp);
      const timeStr = timestamp.toLocaleTimeString();
      const favicon = item.url ? `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}` : '';
      const peerDisplay = item.peerId ? item.peerId.substring(0, 8) : 'local';
      
      historyItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          ${favicon ? `<img src="${favicon}" width="16" height="16" style="border-radius: 2px;" onerror="this.style.display='none'"/>` : '<span>🌐</span>'}
          <div style="flex-grow: 1;">
            <div style="font-weight: bold; font-size: 0.9rem; color: #333;">${item.title || 'No title'}</div>
            <div style="font-size: 0.8rem; color: #666; word-break: break-all; margin-top: 2px;">${item.url || 'No URL'}</div>
            <div style="font-size: 0.7rem; color: #999; margin-top: 2px;">${timeStr} • From ${peerDisplay}</div>
          </div>
        </div>
      `;
      
      // Add animation
      historyItem.style.animation = 'fadeIn 0.5s ease-in';
      historyList.appendChild(historyItem);
    });
  }
    
  // Update stats
  const historyCount = document.getElementById('history-count');
  if (historyCount) {
    historyCount.textContent = localHistory.length;
  }
}

// Update peer count display
function updatePeerCount() {
  const peerCount = document.getElementById('peer-count');
  if (peerCount) {
    const count = p2pRoom ? p2pRoom.getPeers().length : 0;
    peerCount.textContent = count;
  }
}

// Refresh history manually
function refreshHistory() {
  console.log('Manual history refresh requested');
  
  if (!currentPassword) {
    console.log('No room secret available');
    return;
  }
  
  updateConnectionStatus('connecting');
  
  // Reconnect P2P if needed
  if (!p2pRoom) {
    initP2PConnection();
  } else {
    // Update peer count and display
    updatePeerCount();
    displayHistoryItems();
    
    setTimeout(() => {
      updateConnectionStatus(connectedPeers.size > 0 ? 'connected' : 'disconnected');
    }, 500);
  }
}

// Clear room secret
async function clearRoomSecret() {
  if (confirm('Are you sure you want to clear the room secret? You will need to re-enter it in Safari.')) {
    console.log('Clearing room secret...');
    
    // Disconnect from P2P room
    if (p2pRoom) {
      p2pRoom.leave();
      p2pRoom = null;
    }
    
    // Clear connected peers
    connectedPeers.clear();
        
    // Clear via Swift bridge
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
      window.webkit.messageHandlers.controller.postMessage({
        type: 'setSharedSecret',
        secret: ''
      });
    }
        
    currentPassword = null;
    switchToSetupView();
  }
}

// Expose functions to global scope for HTML onclick handlers
window.checkForPassword = checkForPassword;
window.refreshHistory = refreshHistory;
window.clearRoomSecret = clearRoomSecret;