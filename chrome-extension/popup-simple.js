/**
 * popup-simple.js - Simplified Chrome Extension Popup
 * Only uses Cloudflare DNS discovery
 */

// DOM elements
const elements = {
    status: document.getElementById('status'),
    statusIcon: document.getElementById('status-icon'),
    roomId: document.getElementById('room-id'),
    connectBtn: document.getElementById('connect-btn'),
    
    // Cloudflare settings
    cloudflareSection: document.getElementById('cloudflare-section'),
    cloudflareToggle: document.getElementById('cloudflare-toggle'),
    cloudflareSettings: document.getElementById('cloudflare-settings'),
    cloudflareApiToken: document.getElementById('cloudflare-api-token'),
    cloudflareZoneId: document.getElementById('cloudflare-zone-id'),
    cloudflareDomain: document.getElementById('cloudflare-domain'),
    
    // History
    searchInput: document.getElementById('search-input'),
    historyList: document.getElementById('history-list'),
    deviceFilter: document.getElementById('device-filter'),
    
    // Settings
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn')
};

// Initialize popup
async function init() {
    await loadConfig();
    await updateUI();
    setupEventListeners();
}

// Load configuration
async function loadConfig() {
    const response = await chrome.runtime.sendMessage({ type: 'get_config' });
    if (response.success) {
        const config = response.config;
        
        elements.roomId.value = config.roomId || '';
        elements.cloudflareToggle.checked = config.cloudflareEnabled || false;
        elements.cloudflareApiToken.value = config.cloudflareApiToken || '';
        elements.cloudflareZoneId.value = config.cloudflareZoneId || '';
        elements.cloudflareDomain.value = config.cloudflareDomain || '';
        
        // Show/hide Cloudflare settings
        elements.cloudflareSettings.style.display = config.cloudflareEnabled ? 'block' : 'none';
    }
}

// Update UI based on connection status
async function updateUI() {
    const configResponse = await chrome.runtime.sendMessage({ type: 'get_config' });
    
    if (configResponse.success && configResponse.config.isConnected) {
        elements.status.textContent = 'Connected';
        elements.status.className = 'status connected';
        elements.statusIcon.textContent = '🟢';
        elements.connectBtn.textContent = 'Disconnect';
        
        // Load devices for filter
        await loadDevices();
        
        // Load history
        await loadHistory();
    } else {
        elements.status.textContent = 'Disconnected';
        elements.status.className = 'status disconnected';
        elements.statusIcon.textContent = '🔴';
        elements.connectBtn.textContent = 'Connect';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Connect/disconnect
    elements.connectBtn.addEventListener('click', handleConnect);
    
    // Cloudflare toggle
    elements.cloudflareToggle.addEventListener('change', (e) => {
        elements.cloudflareSettings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Device filter
    elements.deviceFilter.addEventListener('change', handleSearch);
    
    // Settings
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.style.display = 'block';
    });
    
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    elements.cancelSettingsBtn.addEventListener('click', () => {
        elements.settingsModal.style.display = 'none';
        loadConfig(); // Reload to reset any changes
    });
    
    // Close modal on outside click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            elements.settingsModal.style.display = 'none';
            loadConfig();
        }
    });
}

// Handle connect/disconnect
async function handleConnect() {
    const isConnected = elements.connectBtn.textContent === 'Disconnect';
    
    if (isConnected) {
        const response = await chrome.runtime.sendMessage({ type: 'disconnect' });
        if (response.success) {
            await updateUI();
        }
    } else {
        // Save config first
        await saveSettings();
        
        // Then connect
        const response = await chrome.runtime.sendMessage({ type: 'connect' });
        if (response.success) {
            await updateUI();
        } else {
            alert('Connection failed: ' + (response.error || 'Unknown error'));
        }
    }
}

// Save settings
async function saveSettings() {
    const config = {
        roomId: elements.roomId.value || 'default',
        cloudflareEnabled: elements.cloudflareToggle.checked,
        cloudflareApiToken: elements.cloudflareApiToken.value,
        cloudflareZoneId: elements.cloudflareZoneId.value,
        cloudflareDomain: elements.cloudflareDomain.value
    };
    
    await chrome.runtime.sendMessage({ 
        type: 'update_config',
        config: config
    });
    
    elements.settingsModal.style.display = 'none';
}

// Load devices for filter
async function loadDevices() {
    const response = await chrome.runtime.sendMessage({ type: 'get_devices' });
    
    if (response.success) {
        elements.deviceFilter.innerHTML = '<option value="">All Devices</option>';
        
        response.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.name} (${device.type})`;
            elements.deviceFilter.appendChild(option);
        });
    }
}

// Load history
async function loadHistory() {
    const deviceId = elements.deviceFilter.value;
    const response = await chrome.runtime.sendMessage({ 
        type: 'get_history',
        deviceId: deviceId || null
    });
    
    if (response.success) {
        displayHistory(response.history);
    }
}

// Search history
async function handleSearch() {
    const query = elements.searchInput.value;
    
    if (query) {
        const response = await chrome.runtime.sendMessage({ 
            type: 'search',
            query: query
        });
        
        if (response.success) {
            displayHistory(response.results);
        }
    } else {
        await loadHistory();
    }
}

// Display history entries
function displayHistory(entries) {
    elements.historyList.innerHTML = '';
    
    if (entries.length === 0) {
        elements.historyList.innerHTML = '<div class="no-results">No history found</div>';
        return;
    }
    
    entries.forEach(entry => {
        const item = createHistoryItem(entry);
        elements.historyList.appendChild(item);
    });
}

// Create history item element
function createHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(entry.url).hostname}`;
    favicon.onerror = () => { favicon.src = 'icon-48.png'; };
    
    const content = document.createElement('div');
    content.className = 'content';
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = entry.title || entry.url;
    
    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = entry.url;
    
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${entry.deviceName} • ${formatDate(entry.visitDate)}`;
    
    content.appendChild(title);
    content.appendChild(url);
    content.appendChild(meta);
    
    item.appendChild(favicon);
    item.appendChild(content);
    
    // Click to open
    item.addEventListener('click', () => {
        chrome.tabs.create({ url: entry.url });
    });
    
    return item;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);