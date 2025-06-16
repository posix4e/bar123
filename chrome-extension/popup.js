// Popup script for bar123 Chrome Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();
  
  // Load current stats
  await loadStats();
  
  // Set up event listeners
  document.getElementById('syncNow').addEventListener('click', syncNow);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  
  // Update stats periodically
  setInterval(loadStats, 5000);
});

async function loadSettings() {
  const settings = await chrome.storage.local.get(['pantryId', 'basketName', 'syncEnabled']);
  
  document.getElementById('pantryId').value = settings.pantryId || '';
  document.getElementById('basketName').value = settings.basketName || 'browser-history';
  document.getElementById('syncEnabled').checked = settings.syncEnabled || false;
}

async function loadStats() {
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (response) {
      document.getElementById('totalItems').textContent = response.totalItems || 0;
      document.getElementById('unsyncedCount').textContent = response.unsyncedCount || 0;
      
      if (response.lastSync) {
        const lastSyncDate = new Date(response.lastSync);
        const now = new Date();
        const diffMs = now - lastSyncDate;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
          document.getElementById('lastSync').textContent = 'Just now';
        } else if (diffMins < 60) {
          document.getElementById('lastSync').textContent = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else {
          const diffHours = Math.floor(diffMins / 60);
          document.getElementById('lastSync').textContent = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        }
      } else {
        document.getElementById('lastSync').textContent = 'Never';
      }
    }
  });
}

async function syncNow() {
  const button = document.getElementById('syncNow');
  const message = document.getElementById('message');
  
  // Disable button and show loading state
  button.disabled = true;
  button.textContent = 'Syncing...';
  message.className = 'message';
  message.textContent = '';
  
  chrome.runtime.sendMessage({ action: 'syncNow' }, (response) => {
    button.disabled = false;
    button.textContent = 'Sync Now';
    
    if (response && response.success) {
      showMessage('Sync completed successfully!', 'success');
      loadStats();
    } else {
      showMessage('Sync failed. Check your settings.', 'error');
    }
  });
}

async function saveSettings() {
  const pantryId = document.getElementById('pantryId').value.trim();
  const basketName = document.getElementById('basketName').value.trim() || 'browser-history';
  const syncEnabled = document.getElementById('syncEnabled').checked;
  
  if (syncEnabled && !pantryId) {
    showMessage('Please enter a Pantry ID', 'error');
    return;
  }
  
  const settings = {
    pantryId,
    basketName,
    syncEnabled
  };
  
  chrome.runtime.sendMessage({ 
    action: 'updateSettings', 
    settings 
  }, (response) => {
    if (response && response.success) {
      showMessage('Settings saved successfully!', 'success');
      
      // If sync was just enabled, trigger a sync
      if (syncEnabled) {
        setTimeout(() => {
          document.getElementById('syncNow').click();
        }, 1000);
      }
    } else {
      showMessage('Failed to save settings', 'error');
    }
  });
}

function showMessage(text, type) {
  const message = document.getElementById('message');
  message.textContent = text;
  message.className = `message ${type}`;
  
  setTimeout(() => {
    message.className = 'message';
    message.textContent = '';
  }, 3000);
}