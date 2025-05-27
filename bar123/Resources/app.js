// Global state
let currentPassword = null;
let isViewingHistory = false;
let powerStatus = 'battery'; // 'battery' or 'charging'

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('iOS app initializing...');
  detectPowerStatus();
  checkForPassword();
    
  // Check battery status periodically
  setInterval(detectPowerStatus, 30000); // Every 30 seconds
});

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
    
  // Simulate initial connection (since we don't have actual Trystero here)
  setTimeout(() => {
    updateConnectionStatus('connected');
    loadHistoryData();
  }, 1000);
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

// Simulate loading history data
function loadHistoryData() {
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const peerCount = document.getElementById('peer-count');
    
  if (!historyList) {return;}
    
  // Simulate some history items
  const sampleHistory = [
    { url: 'https://example.com', title: 'Example Website', timestamp: new Date() },
    { url: 'https://github.com', title: 'GitHub', timestamp: new Date(Date.now() - 300000) },
    { url: 'https://stackoverflow.com', title: 'Stack Overflow', timestamp: new Date(Date.now() - 600000) }
  ];
    
  historyList.innerHTML = '';
    
  if (sampleHistory.length === 0) {
    historyList.innerHTML = '<div class="history-item">No history items found</div>';
  } else {
    sampleHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
            
      const timeStr = item.timestamp.toLocaleTimeString();
      historyItem.innerHTML = `
                <div class="history-title">${item.title}</div>
                <div class="history-url">${item.url}</div>
                <div class="history-time">${timeStr}</div>
            `;
            
      historyList.appendChild(historyItem);
    });
  }
    
  // Update stats
  if (historyCount) {historyCount.textContent = sampleHistory.length;}
  if (peerCount) {peerCount.textContent = '1';} // Simulate 1 connected peer
}

// Refresh history manually
function refreshHistory() {
  console.log('Manual history refresh requested');
  updateConnectionStatus('connecting');
    
  // Simulate refresh delay
  setTimeout(() => {
    updateConnectionStatus('connected');
    loadHistoryData();
  }, 500);
}

// Clear room secret
async function clearRoomSecret() {
  if (confirm('Are you sure you want to clear the room secret? You will need to re-enter it in Safari.')) {
    console.log('Clearing room secret...');
        
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