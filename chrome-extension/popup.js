/**
 * popup.js - Chrome Extension Popup Script
 * Manages the UI for history search, device management, and settings
 */

// State
let currentConfig = {};
let currentTab = 'history';
let searchResults = [];
let devices = [];
let historyEntries = [];

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', initialize);

// Initialize
async function initialize() {
    // Get DOM elements
    setupElements();
    
    // Load current configuration
    await loadConfig();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    await refreshData();
}

// DOM elements
let elements = {};

function setupElements() {
    elements = {
        // Status
        connectionStatus: document.getElementById('connectionStatus'),
        
        // Search
        searchInput: document.getElementById('searchInput'),
        searchButton: document.getElementById('searchButton'),
        
        // Tabs
        tabButtons: document.querySelectorAll('.tab-button'),
        tabPanes: document.querySelectorAll('.tab-pane'),
        
        // History
        deviceFilter: document.getElementById('deviceFilter'),
        historyList: document.getElementById('historyList'),
        
        // Devices
        devicesList: document.getElementById('devicesList'),
        
        // Settings
        serverUrl: document.getElementById('serverUrl'),
        roomId: document.getElementById('roomId'),
        sharedSecret: document.getElementById('sharedSecret'),
        generateSecret: document.getElementById('generateSecret'),
        saveSettings: document.getElementById('saveSettings'),
        disconnectButton: document.getElementById('disconnectButton')
    };
}

// Load configuration
async function loadConfig() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_config' });
        if (response.success) {
            currentConfig = response.config;
            updateConfigUI();
            updateConnectionStatus();
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

// Update configuration UI
function updateConfigUI() {
    elements.serverUrl.value = currentConfig.signalingServerUrl || '';
    elements.roomId.value = currentConfig.roomId || '';
    elements.sharedSecret.value = currentConfig.sharedSecret || '';
}

// Update connection status
function updateConnectionStatus() {
    const statusText = elements.connectionStatus.querySelector('.status-text');
    
    if (currentConfig.isConnected) {
        elements.connectionStatus.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        elements.connectionStatus.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // Search
    elements.searchButton.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Device filter
    elements.deviceFilter.addEventListener('change', filterHistory);
    
    // Settings
    elements.generateSecret.addEventListener('click', generateSecret);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.disconnectButton.addEventListener('click', disconnect);
}

// Switch tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    elements.tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });
    
    // Update tab panes
    elements.tabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}Tab`);
    });
    
    // Refresh data for the current tab
    refreshTabData();
}

// Refresh data based on current tab
async function refreshTabData() {
    switch (currentTab) {
        case 'history':
            await loadHistory();
            break;
        case 'devices':
            await loadDevices();
            break;
    }
}

// Refresh all data
async function refreshData() {
    await Promise.all([
        loadHistory(),
        loadDevices()
    ]);
}

// Perform search
async function performSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) {
        await loadHistory();
        return;
    }
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'search',
            query: query
        });
        
        if (response.success) {
            searchResults = response.results;
            displayHistory(searchResults);
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

// Load history
async function loadHistory() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'get_history'
        });
        
        if (response.success) {
            historyEntries = response.history;
            displayHistory(historyEntries);
            updateDeviceFilter();
        }
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

// Display history
function displayHistory(entries) {
    if (entries.length === 0) {
        elements.historyList.innerHTML = '<p class="empty-state">No history entries found</p>';
        return;
    }
    
    const html = entries.map(entry => {
        const date = new Date(entry.visitDate);
        const timeString = date.toLocaleTimeString();
        const dateString = date.toLocaleDateString();
        
        return `
            <div class="history-item" data-url="${entry.url}">
                <div class="history-title">${entry.title || 'Untitled'}</div>
                <div class="history-url">${entry.url}</div>
                <div class="history-meta">${entry.deviceName} • ${dateString} ${timeString}</div>
            </div>
        `;
    }).join('');
    
    elements.historyList.innerHTML = html;
    
    // Add click handlers to open URLs
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            chrome.tabs.create({ url: item.dataset.url });
        });
    });
}

// Update device filter
function updateDeviceFilter() {
    const deviceIds = new Set(historyEntries.map(entry => entry.deviceId));
    const currentValue = elements.deviceFilter.value;
    
    let optionsHtml = '<option value="">All Devices</option>';
    
    deviceIds.forEach(deviceId => {
        const device = devices.find(d => d.id === deviceId);
        const deviceName = device ? device.name : deviceId;
        optionsHtml += `<option value="${deviceId}">${deviceName}</option>`;
    });
    
    elements.deviceFilter.innerHTML = optionsHtml;
    elements.deviceFilter.value = currentValue;
}

// Filter history by device
function filterHistory() {
    const deviceId = elements.deviceFilter.value;
    
    if (!deviceId) {
        displayHistory(historyEntries);
    } else {
        const filtered = historyEntries.filter(entry => entry.deviceId === deviceId);
        displayHistory(filtered);
    }
}

// Load devices
async function loadDevices() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'get_devices'
        });
        
        if (response.success) {
            devices = response.devices;
            displayDevices(devices);
        }
    } catch (error) {
        console.error('Failed to load devices:', error);
    }
}

// Display devices
function displayDevices(deviceList) {
    if (deviceList.length === 0) {
        elements.devicesList.innerHTML = '<p class="empty-state">No devices found</p>';
        return;
    }
    
    const html = deviceList.map(device => {
        const statusClass = device.isConnected ? 'connected' : '';
        const statusText = device.isConnected ? 'Connected' : 'Last seen ' + new Date(device.lastSeen).toLocaleDateString();
        
        return `
            <div class="device-item">
                <div class="device-name">${device.name}</div>
                <div class="device-info">Type: ${device.type}</div>
                <div class="device-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');
    
    elements.devicesList.innerHTML = html;
}

// Generate secret
function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    elements.sharedSecret.value = secret;
}

// Save settings
async function saveSettings() {
    const config = {
        signalingServerUrl: elements.serverUrl.value.trim(),
        roomId: elements.roomId.value.trim(),
        sharedSecret: elements.sharedSecret.value.trim()
    };
    
    if (!config.signalingServerUrl || !config.roomId || !config.sharedSecret) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        // Update config
        await chrome.runtime.sendMessage({
            type: 'update_config',
            config: config
        });
        
        // Connect
        const response = await chrome.runtime.sendMessage({
            type: 'connect'
        });
        
        if (response.success) {
            currentConfig.isConnected = true;
            updateConnectionStatus();
            await refreshData();
        } else {
            alert('Connection failed: ' + response.error);
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings');
    }
}

// Disconnect
async function disconnect() {
    try {
        await chrome.runtime.sendMessage({
            type: 'disconnect'
        });
        
        currentConfig.isConnected = false;
        updateConnectionStatus();
    } catch (error) {
        console.error('Failed to disconnect:', error);
    }
}