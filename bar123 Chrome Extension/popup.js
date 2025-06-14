// Chrome Extension Popup Script

// DOM Elements
const elements = {
    syncStatus: document.getElementById('syncStatus'),
    lastSync: document.getElementById('lastSync'),
    pendingCount: document.getElementById('pendingCount'),
    enableSync: document.getElementById('enableSync'),
    pantryId: document.getElementById('pantryId'),
    basketName: document.getElementById('basketName'),
    syncInterval: document.getElementById('syncInterval'),
    saveSettings: document.getElementById('saveSettings'),
    searchQuery: document.getElementById('searchQuery'),
    searchType: document.getElementById('searchType'),
    searchButton: document.getElementById('searchButton'),
    searchResults: document.getElementById('searchResults'),
    syncNow: document.getElementById('syncNow'),
    viewLocalHistory: document.getElementById('viewLocalHistory'),
    statusMessage: document.getElementById('statusMessage')
};

// Initialize popup
async function init() {
    await loadStatus();
    setupEventListeners();
}

// Load current status
async function loadStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
        
        // Update sync status
        if (response.config.enableSync) {
            elements.syncStatus.textContent = 'Enabled';
            elements.syncStatus.className = 'status-value enabled';
        } else {
            elements.syncStatus.textContent = 'Disabled';
            elements.syncStatus.className = 'status-value disabled';
        }
        
        // Update last sync time
        if (response.lastSync) {
            const lastSyncDate = new Date(response.lastSync);
            elements.lastSync.textContent = formatRelativeTime(lastSyncDate);
        } else {
            elements.lastSync.textContent = 'Never';
        }
        
        // Update pending count
        elements.pendingCount.textContent = response.pendingCount;
        
        // Update settings fields
        elements.enableSync.checked = response.config.enableSync;
        elements.pantryId.value = response.config.pantryId || '';
        elements.basketName.value = response.config.basketName || 'browserHistory';
        elements.syncInterval.value = response.config.syncInterval || 3600;
        
    } catch (error) {
        console.error('Error loading status:', error);
        showMessage('Error loading status', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.syncNow.addEventListener('click', syncNow);
    elements.searchButton.addEventListener('click', search);
    elements.searchQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search();
    });
    elements.viewLocalHistory.addEventListener('click', viewLocalHistory);
}

// Save settings
async function saveSettings() {
    const config = {
        enableSync: elements.enableSync.checked,
        pantryId: elements.pantryId.value.trim(),
        basketName: elements.basketName.value.trim() || 'browserHistory',
        syncInterval: parseInt(elements.syncInterval.value)
    };
    
    if (config.enableSync && !config.pantryId) {
        showMessage('Please enter a Pantry ID', 'error');
        return;
    }
    
    try {
        await chrome.runtime.sendMessage({ action: 'updateConfig', config });
        showMessage('Settings saved successfully', 'success');
        await loadStatus(); // Reload status
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('Error saving settings', 'error');
    }
}

// Sync now
async function syncNow() {
    elements.syncNow.disabled = true;
    elements.syncNow.innerHTML = '<span class="spinner"></span> Syncing...';
    
    try {
        const response = await chrome.runtime.sendMessage({ action: 'forceSync' });
        
        if (response.success) {
            showMessage(`Successfully synced ${response.syncedCount} items`, 'success');
            await loadStatus(); // Reload status
        } else {
            showMessage(`Sync failed: ${response.error}`, 'error');
        }
    } catch (error) {
        console.error('Error syncing:', error);
        showMessage('Error syncing', 'error');
    } finally {
        elements.syncNow.disabled = false;
        elements.syncNow.textContent = 'Sync Now';
    }
}

// Search history
async function search() {
    const query = elements.searchQuery.value.trim();
    const searchType = elements.searchType.value;
    
    elements.searchButton.disabled = true;
    elements.searchButton.innerHTML = '<span class="spinner"></span>';
    elements.searchResults.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'search', 
            query, 
            searchType 
        });
        
        if (response.success) {
            displaySearchResults(response.results);
        } else {
            elements.searchResults.innerHTML = `<div class="error">Search failed: ${response.error}</div>`;
        }
    } catch (error) {
        console.error('Error searching:', error);
        elements.searchResults.innerHTML = '<div class="error">Error searching</div>';
    } finally {
        elements.searchButton.disabled = false;
        elements.searchButton.textContent = 'Search';
    }
}

// Display search results
function displaySearchResults(results) {
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    const html = results.map(item => {
        const visitTime = new Date(item.lastVisitTime || item.capturedAt);
        const deviceInfo = item.deviceInfo || { deviceType: 'Unknown' };
        
        return `
            <div class="search-result-item" data-url="${escapeHtml(item.url)}">
                <div class="result-title">${escapeHtml(item.title || 'Untitled')}</div>
                <div class="result-url">${escapeHtml(item.url)}</div>
                <div class="result-meta">
                    <span class="result-time">${formatRelativeTime(visitTime)}</span>
                    <span class="result-device">${escapeHtml(deviceInfo.deviceType)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    elements.searchResults.innerHTML = html;
    
    // Add click handlers
    elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const url = item.dataset.url;
            chrome.tabs.create({ url });
        });
    });
}

// View local history
function viewLocalHistory() {
    chrome.tabs.create({ url: 'chrome://history' });
}

// Show status message
function showMessage(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        elements.statusMessage.className = 'status-message';
    }, 3000);
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);