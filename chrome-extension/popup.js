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
        discoveryMethod: document.getElementById('discoveryMethod'),
        websocketSettings: document.getElementById('websocketSettings'),
        stunSettings: document.getElementById('stunSettings'),
        serverUrl: document.getElementById('serverUrl'),
        roomId: document.getElementById('roomId'),
        sharedSecret: document.getElementById('sharedSecret'),
        generateSecret: document.getElementById('generateSecret'),
        stunServers: document.getElementById('stunServers'),
        connectionFlow: document.getElementById('connectionFlow'),
        createOfferStep: document.getElementById('createOfferStep'),
        shareOfferStep: document.getElementById('shareOfferStep'),
        processStep: document.getElementById('processStep'),
        connectionStatusStep: document.getElementById('connectionStatusStep'),
        createOffer: document.getElementById('createOffer'),
        shareViaChat: document.getElementById('shareViaChat'),
        copyOfferLink: document.getElementById('copyOfferLink'),
        copyOfferCode: document.getElementById('copyOfferCode'),
        connectionOffer: document.getElementById('connectionOffer'),
        connectionInput: document.getElementById('connectionInput'),
        processConnection: document.getElementById('processConnection'),
        connectionStatusMessage: document.getElementById('connectionStatusMessage'),
        connectedPeersList: document.getElementById('connectedPeersList'),
        newConnection: document.getElementById('newConnection'),
        saveSettings: document.getElementById('saveSettings'),
        disconnectButton: document.getElementById('disconnectButton'),
        
        // Cloudflare elements
        cloudflareSettings: document.getElementById('cloudflareSettings'),
        cloudflareDomain: document.getElementById('cloudflareDomain'),
        cloudflareZoneId: document.getElementById('cloudflareZoneId'),
        cloudflareApiToken: document.getElementById('cloudflareApiToken'),
        cloudflareRoomId: document.getElementById('cloudflareRoomId'),
        generateCloudflareShare: document.getElementById('generateCloudflareShare'),
        cloudflareShareCode: document.getElementById('cloudflareShareCode')
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
    // Set discovery method
    elements.discoveryMethod.value = currentConfig.discoveryMethod || 'websocket';
    
    // WebSocket settings
    elements.serverUrl.value = currentConfig.signalingServerUrl || '';
    elements.roomId.value = currentConfig.roomId || '';
    elements.sharedSecret.value = currentConfig.sharedSecret || '';
    
    // STUN servers
    const stunServers = currentConfig.stunServers || [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
    ];
    elements.stunServers.value = stunServers.join('\n');
    
    // Cloudflare settings
    elements.cloudflareDomain.value = currentConfig.cloudflareDomain || '';
    elements.cloudflareZoneId.value = currentConfig.cloudflareZoneId || '';
    elements.cloudflareApiToken.value = currentConfig.cloudflareApiToken || '';
    elements.cloudflareRoomId.value = currentConfig.cloudflareRoomId || '';
    
    // Show/hide appropriate settings
    updateDiscoveryUI();
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

// Update discovery UI based on selected method
function updateDiscoveryUI() {
    const method = elements.discoveryMethod.value;
    
    // Hide all settings first
    elements.websocketSettings.style.display = 'none';
    elements.stunSettings.style.display = 'none';
    elements.cloudflareSettings.style.display = 'none';
    
    if (method === 'websocket') {
        elements.websocketSettings.style.display = 'block';
    } else if (method === 'stun-only') {
        elements.stunSettings.style.display = 'block';
        
        // Show connection flow if connected
        if (currentConfig.isConnected) {
            elements.connectionFlow.style.display = 'block';
            updateConnectionFlow();
        }
    } else if (method === 'cloudflare-dns') {
        elements.cloudflareSettings.style.display = 'block';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Discovery method change
    elements.discoveryMethod.addEventListener('change', updateDiscoveryUI);
    
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
    
    // STUN-only features
    elements.createOffer.addEventListener('click', createConnectionOffer);
    elements.shareViaChat.addEventListener('click', shareViaChat);
    elements.copyOfferLink.addEventListener('click', copyOfferLink);
    elements.copyOfferCode.addEventListener('click', copyOfferCode);
    elements.processConnection.addEventListener('click', processConnection);
    elements.newConnection.addEventListener('click', resetConnectionFlow);
    
    // Cloudflare share
    elements.generateCloudflareShare.addEventListener('click', generateCloudflareShare);
    
    // Auto-detect connection data in input
    elements.connectionInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const input = elements.connectionInput.value.trim();
            if (input.includes('🔗 History Sync Connection') || 
                input.includes('✅ History Sync Connection')) {
                // Extract just the code from the formatted message
                const match = input.match(/\n\n([A-Za-z0-9\-_]+)\n\n/);
                if (match) {
                    elements.connectionInput.value = match[1];
                }
            }
        }, 100);
    });
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
    const discoveryMethod = elements.discoveryMethod.value;
    const config = {
        discoveryMethod: discoveryMethod
    };
    
    if (discoveryMethod === 'websocket') {
        config.signalingServerUrl = elements.serverUrl.value.trim();
        config.roomId = elements.roomId.value.trim();
        config.sharedSecret = elements.sharedSecret.value.trim();
        
        if (!config.signalingServerUrl || !config.roomId || !config.sharedSecret) {
            alert('Please fill in all WebSocket fields');
            return;
        }
    } else if (discoveryMethod === 'stun-only') {
        const stunServersText = elements.stunServers.value.trim();
        config.stunServers = stunServersText.split('\n').filter(s => s.trim());
        
        if (config.stunServers.length === 0) {
            alert('Please provide at least one STUN server');
            return;
        }
    } else if (discoveryMethod === 'cloudflare-dns') {
        config.cloudflareDomain = elements.cloudflareDomain.value.trim();
        config.cloudflareZoneId = elements.cloudflareZoneId.value.trim();
        config.cloudflareApiToken = elements.cloudflareApiToken.value.trim();
        config.cloudflareRoomId = elements.cloudflareRoomId.value.trim();
        
        if (!config.cloudflareDomain || !config.cloudflareZoneId || 
            !config.cloudflareApiToken || !config.cloudflareRoomId) {
            alert('Please fill in all Cloudflare fields');
            return;
        }
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
            currentConfig = { ...currentConfig, ...config };
            currentConfig.isConnected = true;
            updateConnectionStatus();
            updateDiscoveryUI();
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
        updateDiscoveryUI();
    } catch (error) {
        console.error('Failed to disconnect:', error);
    }
}

// STUN-only connection flow
let currentConnectionOffer = null;
let connectionTimer = null;

function updateConnectionFlow() {
    // Check connection status and update UI
    updateConnectionStatus();
}

function resetConnectionFlow() {
    currentConnectionOffer = null;
    if (connectionTimer) {
        clearInterval(connectionTimer);
        connectionTimer = null;
    }
    
    elements.createOfferStep.style.display = 'block';
    elements.shareOfferStep.style.display = 'none';
    elements.processStep.style.display = 'block';
    elements.connectionStatusStep.style.display = 'none';
    elements.connectionInput.value = '';
}

async function createConnectionOffer() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'create_connection_offer'
        });
        
        if (response.success) {
            currentConnectionOffer = response;
            
            // Update UI
            elements.createOfferStep.style.display = 'none';
            elements.shareOfferStep.style.display = 'block';
            elements.connectionOffer.value = response.shareText;
            
            // Start expiry timer
            let timeLeft = 300; // 5 minutes
            connectionTimer = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(connectionTimer);
                    resetConnectionFlow();
                    showStatus('Connection request expired', 'error');
                } else {
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    document.querySelector('.help-text').textContent = 
                        `Waiting for response... (expires in ${minutes}:${seconds.toString().padStart(2, '0')})`;
                }
            }, 1000);
            
            // Auto-select the text for easy copying
            elements.connectionOffer.select();
        } else {
            showStatus('Failed to create connection request: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Failed to create offer:', error);
        showStatus('Failed to create connection request', 'error');
    }
}

async function shareViaChat() {
    if (!currentConnectionOffer) return;
    
    try {
        // Use Web Share API if available
        if (navigator.share) {
            await navigator.share({
                title: 'History Sync Connection',
                text: currentConnectionOffer.shareText
            });
        } else {
            // Fallback to copying to clipboard
            await navigator.clipboard.writeText(currentConnectionOffer.shareText);
            showTemporaryButtonFeedback(elements.shareViaChat, 'Copied!');
        }
    } catch (error) {
        console.error('Failed to share:', error);
    }
}

async function copyOfferLink() {
    if (!currentConnectionOffer) return;
    
    try {
        await navigator.clipboard.writeText(currentConnectionOffer.link);
        showTemporaryButtonFeedback(elements.copyOfferLink, 'Copied!');
    } catch (error) {
        console.error('Failed to copy link:', error);
        showStatus('Failed to copy link', 'error');
    }
}

async function copyOfferCode() {
    if (!currentConnectionOffer) return;
    
    try {
        await navigator.clipboard.writeText(currentConnectionOffer.encoded);
        showTemporaryButtonFeedback(elements.copyOfferCode, 'Copied!');
    } catch (error) {
        console.error('Failed to copy code:', error);
        showStatus('Failed to copy code', 'error');
    }
}

async function processConnection() {
    const input = elements.connectionInput.value.trim();
    
    if (!input) {
        showStatus('Please paste connection code', 'error');
        return;
    }
    
    try {
        // Disable button during processing
        elements.processConnection.disabled = true;
        elements.processConnection.textContent = 'Connecting...';
        
        const response = await chrome.runtime.sendMessage({
            type: 'process_connection',
            data: input
        });
        
        if (response.success) {
            if (response.isOffer) {
                // We received an offer and created a response
                showStatus('Connection established! Send the response back:', 'success');
                elements.connectionInput.value = response.shareText;
                elements.connectionInput.select();
                
                // Update button to copy response
                elements.processConnection.textContent = 'Copy Response';
                elements.processConnection.onclick = async () => {
                    await navigator.clipboard.writeText(response.shareText);
                    showTemporaryButtonFeedback(elements.processConnection, 'Copied!');
                };
            } else {
                // We received a response and completed the connection
                showStatus(`Connected to ${response.peerName}!`, 'success');
                elements.connectionInput.value = '';
                
                // Update connection status
                setTimeout(() => {
                    updateConnectionStatus();
                    refreshData();
                }, 1000);
            }
        } else {
            showStatus('Connection failed: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Failed to process connection:', error);
        showStatus('Failed to process connection', 'error');
    } finally {
        // Re-enable button
        elements.processConnection.disabled = false;
        if (elements.processConnection.textContent === 'Connecting...') {
            elements.processConnection.textContent = 'Connect';
        }
    }
}

async function updateConnectionStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'get_connection_stats'
        });
        
        if (response.success && response.stats) {
            const stats = response.stats;
            
            if (stats.active > 0) {
                elements.createOfferStep.style.display = 'none';
                elements.shareOfferStep.style.display = 'none';
                elements.processStep.style.display = 'none';
                elements.connectionStatusStep.style.display = 'block';
                
                // Update status message
                elements.connectionStatusMessage.className = 'status-message success';
                elements.connectionStatusMessage.textContent = `Connected to ${stats.active} peer${stats.active > 1 ? 's' : ''}`;
                
                // Update peer list
                elements.connectedPeersList.innerHTML = stats.peers.map(peer => `
                    <div class="peer-item">
                        <span class="peer-name">${peer.name}</span>
                        <span class="peer-status">${peer.state}</span>
                    </div>
                `).join('');
            } else {
                resetConnectionFlow();
            }
        }
    } catch (error) {
        console.error('Failed to get connection stats:', error);
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.createElement('div');
    statusEl.className = `status-message ${type}`;
    statusEl.textContent = message;
    
    // Find a good place to show the status
    const container = elements.connectionFlow || elements.stunSettings;
    container.insertBefore(statusEl, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => statusEl.remove(), 5000);
}

function showTemporaryButtonFeedback(button, message) {
    const originalText = button.textContent;
    button.textContent = message;
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

// Generate Cloudflare share code
async function generateCloudflareShare() {
    // Get current Cloudflare config
    const config = {
        domain: elements.cloudflareDomain.value.trim(),
        zoneId: elements.cloudflareZoneId.value.trim(),
        apiToken: elements.cloudflareApiToken.value.trim(),
        roomId: elements.cloudflareRoomId.value.trim()
    };
    
    if (!config.domain || !config.zoneId || !config.apiToken || !config.roomId) {
        showStatus('Please fill in all Cloudflare fields first', 'error');
        return;
    }
    
    // Create shareable config
    const shareData = {
        type: 'cloudflare-dns-config',
        version: 1,
        config: {
            domain: config.domain,
            zoneId: config.zoneId,
            apiToken: config.apiToken,
            roomId: config.roomId,
            recordPrefix: '_p2psync',
            ttl: 120
        },
        createdAt: new Date().toISOString(),
        deviceName: 'Chrome Extension'
    };
    
    // Encode as base64
    const encoded = btoa(JSON.stringify(shareData));
    
    // Format for sharing
    const shareText = `🔐 History Sync Cloudflare Config

This allows other devices to join the same P2P network using your Cloudflare domain for discovery.

⚠️ Keep this secure - it contains your API token!

${encoded}

To use on iOS:
1. Copy this entire message
2. Open the iOS app
3. Go to Settings > Discovery Method > Cloudflare DNS
4. Paste this code

Expires: Never (revoke API token to disable)`;
    
    // Show the share code
    elements.cloudflareShareCode.value = shareText;
    elements.cloudflareShareCode.style.display = 'block';
    elements.cloudflareShareCode.select();
    
    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(shareText);
        showTemporaryButtonFeedback(elements.generateCloudflareShare, 'Copied to Clipboard!');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
    }
}