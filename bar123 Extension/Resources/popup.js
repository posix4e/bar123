// Popup JavaScript

// Configuration
const ExtensionConfig = {
    nativeAppId: 'com.apple-6746350013.bar123'
};

// DOM elements
const syncStatusEl = document.getElementById('sync-status');
const lastSyncEl = document.getElementById('last-sync');
const pendingCountEl = document.getElementById('pending-count');
const forceSyncBtn = document.getElementById('force-sync');
const viewHistoryBtn = document.getElementById('view-history');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
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
    // Force sync button
    forceSyncBtn.addEventListener('click', handleForceSync);
    
    
    
    // Open full history button
    if (openFullHistoryBtn) {
        openFullHistoryBtn.addEventListener('click', handleOpenFullHistory);
    }
}

// Handle force sync
async function handleForceSync() {
    const buttonText = forceSyncBtn.querySelector('.button-text');
    const spinner = forceSyncBtn.querySelector('.spinner');
    
    try {
        // Show loading state
        forceSyncBtn.disabled = true;
        buttonText.textContent = 'Syncing...';
        spinner.style.display = 'inline-block';
        
        const response = await browser.runtime.sendMessage({ action: 'forceSync' });
        
        if (response.success) {
            buttonText.textContent = 'Sync Complete!';
            setTimeout(() => {
                buttonText.textContent = 'Force Sync Now';
                loadStatus(); // Reload status
            }, 2000);
        } else {
            throw new Error(response.error || 'Sync failed');
        }
    } catch (error) {
        showError('Sync failed: ' + error.message);
        buttonText.textContent = 'Force Sync Now';
    } finally {
        forceSyncBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

// Handle view history
async function handleViewHistory() {
    const isVisible = historySection.style.display !== 'none';
    
    if (isVisible) {
        // Hide history
        historySection.style.display = 'none';
        viewHistoryBtn.textContent = 'View History';
    } else {
        // Show history
        historySection.style.display = 'block';
        viewHistoryBtn.textContent = 'Hide History';
        
        // Load history
        await loadHistory();
    }
}

// Load history - show only last 10 items
async function loadHistory() {
    try {
        historyList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';
        
        // Get recent history from last 24 hours, limit to 10
        const response = await browser.runtime.sendMessage({ 
            action: 'getRecentHistory',
            hoursAgo: 24,
            limit: 10
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        const history = response.history || [];
        
        if (history.length === 0) {
            historyList.innerHTML = '<div style="text-align: center; padding: 20px; color: #86868b;">No recent history</div>';
            return;
        }
        
        // Clear loading message
        historyList.innerHTML = '';
        
        // Add history items
        history.forEach(item => {
            const historyItem = createHistoryItem(item);
            historyList.appendChild(historyItem);
        });
    } catch (error) {
        historyList.innerHTML = '<div style="text-align: center; padding: 20px; color: #c00;">Failed to load history</div>';
        showError('Failed to load history: ' + error.message);
    }
}

// Create history item element
function createHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = item.title || 'Untitled';
    
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = item.url;
    
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = new Date(item.visitTime).toLocaleString();
    
    div.appendChild(title);
    div.appendChild(url);
    div.appendChild(time);
    
    // Make clickable
    div.addEventListener('click', () => {
        browser.tabs.create({ url: item.url });
    });
    
    return div;
}


// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successEl = document.createElement('div');
    successEl.style.cssText = 'background-color: #e8f5e8; color: #34c759; padding: 12px; border-radius: 6px; font-size: 14px; margin-top: 12px;';
    successEl.textContent = message;
    
    document.querySelector('.container').appendChild(successEl);
    
    setTimeout(() => {
        successEl.remove();
    }, 3000);
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