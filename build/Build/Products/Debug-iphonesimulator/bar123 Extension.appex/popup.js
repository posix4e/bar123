// Popup JavaScript

// Configuration
const ExtensionConfig = {
    nativeAppId: 'com.apple-6746350013.bar123'
};

// DOM elements
const syncStatusEl = document.getElementById('sync-status');
const lastSyncEl = document.getElementById('last-sync');
const pendingCountEl = document.getElementById('pending-count');
const errorMessage = document.getElementById('error-message');
const openFullHistoryBtn = document.getElementById('open-full-history');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    loadStatus();
    setupEventListeners();
});

// Load current status
async function loadStatus() {
    try {
        const status = await browser.runtime.sendMessage({ action: 'getStatus' });
        
        updateStatusDisplay(status);
        
    } catch (error) {
        showError('Failed to load status');
    }
}

// Update status display
function updateStatusDisplay(status) {
    // Update sync status
    if (status.lastSyncTime) {
        syncStatusEl.textContent = 'Active';
        syncStatusEl.style.color = '#34c759';
        
        // Format last sync time
        const lastSync = new Date(status.lastSyncTime);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSync) / 60000);
        
        if (diffMinutes < 1) {
            lastSyncEl.textContent = 'Just now';
        } else if (diffMinutes < 60) {
            lastSyncEl.textContent = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            lastSyncEl.textContent = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            lastSyncEl.textContent = lastSync.toLocaleDateString();
        }
    } else {
        syncStatusEl.textContent = 'Never synced';
        syncStatusEl.style.color = '#ff9500';
        lastSyncEl.textContent = 'Never';
    }
    
    // Update pending count
    pendingCountEl.textContent = status.pendingCount || '0';
    
    // Show warning if pending count is high
    if (status.pendingCount > 100) {
        pendingCountEl.style.color = '#ff3b30';
    } else if (status.pendingCount > 50) {
        pendingCountEl.style.color = '#ff9500';
    } else {
        pendingCountEl.style.color = '#1d1d1f';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Open full history button
    if (openFullHistoryBtn) {
        openFullHistoryBtn.addEventListener('click', handleOpenFullHistory);
    }
}




// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}


// Auto-refresh status every 30 seconds
setInterval(loadStatus, 30000);



// Handle open full history
function handleOpenFullHistory() {
    // Send message to open the native app's history view
    browser.runtime.sendNativeMessage(
        ExtensionConfig.nativeAppId,
        {
            action: 'openHistoryView'
        }
    ).then(response => {
        if (response && response.success) {
            // Optionally close the popup
            window.close();
        }
    }).catch(error => {
        showError('Failed to open history view');
    });
}