/**
 * popup.js - Chrome Extension Popup Interface
 * Handles QR code generation/scanning and P2P connection management
 */

// Import QR libraries
let QRCode = null;
let QrScanner = null;

// State management
let currentTab = 'connect';
let connectionState = 'disconnected';
let qrScanner = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Load QR libraries
    await loadQRLibraries();
    
    // Set up event listeners
    setupTabNavigation();
    setupConnectionHandlers();
    setupSearchHandlers();
    setupSettingsHandlers();
    
    // Load initial state
    await loadConnectionState();
    await loadHistory();
    await loadDevices();
});

// Load QR libraries dynamically
async function loadQRLibraries() {
    // Load QRCode generator
    const qrScript = document.createElement('script');
    qrScript.src = 'lib/qrcode.min.js';
    await new Promise((resolve) => {
        qrScript.onload = resolve;
        document.head.appendChild(qrScript);
    });
    QRCode = window.QRCode;
    
    // Load QR Scanner
    const scannerScript = document.createElement('script');
    scannerScript.src = 'lib/qr-scanner.min.js';
    scannerScript.type = 'module';
    await new Promise((resolve) => {
        scannerScript.onload = resolve;
        document.head.appendChild(scannerScript);
    });
    
    // Import QrScanner from module
    const module = await import('./lib/qr-scanner.min.js');
    QrScanner = module.default;
}

// Tab navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            
            currentTab = targetTab;
            
            // Stop QR scanner if switching away from connect tab
            if (targetTab !== 'connect' && qrScanner) {
                qrScanner.stop();
            }
        });
    });
}

// Connection handlers
function setupConnectionHandlers() {
    // Start new connection button
    document.getElementById('startConnectionBtn').addEventListener('click', async () => {
        try {
            updateConnectionStatus('Creating connection offer...');
            
            // Request background script to create offer
            const response = await chrome.runtime.sendMessage({ type: 'create_offer' });
            
            if (response.success) {
                await displayConnectionOffer(response.offer);
            } else {
                showError('Failed to create connection offer: ' + response.error);
            }
        } catch (error) {
            showError('Error creating connection: ' + error.message);
        }
    });
    
    // Join existing connection button
    document.getElementById('joinConnectionBtn').addEventListener('click', () => {
        showQRScanner();
    });
    
    // Copy bundle button
    document.getElementById('copyBundleBtn').addEventListener('click', () => {
        const bundleText = document.getElementById('connectionBundle').value;
        navigator.clipboard.writeText(bundleText).then(() => {
            showSuccess('Connection data copied to clipboard!');
        });
    });
    
    // Process manual input button
    document.getElementById('processManualBtn').addEventListener('click', async () => {
        const input = document.getElementById('manualInput').value.trim();
        if (input) {
            await processConnectionBundle(input);
        }
    });
}

// Display connection offer as QR code
async function displayConnectionOffer(offerBundle) {
    // Show connection flow
    document.getElementById('connectionFlow').classList.remove('hidden');
    document.getElementById('qrCodeSection').classList.remove('hidden');
    document.getElementById('qrScannerSection').classList.add('hidden');
    
    // Hide initial buttons
    document.querySelector('.connect-mode').style.display = 'none';
    
    // Display bundle text
    document.getElementById('connectionBundle').value = offerBundle;
    
    // Generate QR code
    const canvas = document.getElementById('qrCanvas');
    canvas.innerHTML = ''; // Clear existing QR code
    
    new QRCode(canvas, {
        text: offerBundle,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
    });
    
    updateConnectionStatus('Waiting for other device to scan QR code...');
    
    // Show instructions for completing connection
    const statusDiv = document.getElementById('connectionStatus');
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'connection-instructions';
    instructionsDiv.innerHTML = `
        <h4>After the other device scans this code:</h4>
        <ol>
            <li>They will show an answer QR code</li>
            <li>Click "Scan Answer" below to complete the connection</li>
        </ol>
        <button id="scanAnswerBtn" class="btn btn-primary">Scan Answer</button>
    `;
    statusDiv.appendChild(instructionsDiv);
    
    // Set up scan answer button
    document.getElementById('scanAnswerBtn').addEventListener('click', () => {
        showQRScanner(true); // true = scanning for answer
    });
}

// Show QR scanner
function showQRScanner(isAnswer = false) {
    // Show scanner section
    document.getElementById('connectionFlow').classList.remove('hidden');
    document.getElementById('qrScannerSection').classList.remove('hidden');
    document.getElementById('qrCodeSection').classList.add('hidden');
    
    // Hide initial buttons if not already hidden
    document.querySelector('.connect-mode').style.display = 'none';
    
    // Update instructions
    const h3 = document.querySelector('#qrScannerSection h3');
    h3.textContent = isAnswer ? 'Scan answer QR code' : 'Scan QR code from other device';
    
    // Start QR scanner
    const videoElement = document.getElementById('qrVideo');
    
    if (!qrScanner) {
        qrScanner = new QrScanner(
            videoElement,
            result => {
                console.log('QR code scanned:', result);
                processConnectionBundle(result.data, isAnswer);
            },
            {
                preferredCamera: 'environment',
                highlightScanRegion: true,
                highlightCodeOutline: true
            }
        );
    }
    
    qrScanner.start().catch(error => {
        console.error('Failed to start QR scanner:', error);
        showError('Camera access denied or not available. Please use manual input.');
    });
}

// Process scanned or pasted connection bundle
async function processConnectionBundle(bundleData, isAnswer = false) {
    try {
        // Stop scanner if running
        if (qrScanner) {
            qrScanner.stop();
        }
        
        if (isAnswer) {
            // This is an answer to our offer
            updateConnectionStatus('Processing answer...');
            
            const response = await chrome.runtime.sendMessage({
                type: 'complete_connection',
                answer: bundleData
            });
            
            if (response.success) {
                showSuccess('Connection established!');
                connectionState = 'connected';
                await loadDevices();
                resetConnectionUI();
            } else {
                showError('Failed to complete connection: ' + response.error);
            }
        } else {
            // This is an offer from another device
            updateConnectionStatus('Processing offer and creating answer...');
            
            const response = await chrome.runtime.sendMessage({
                type: 'process_offer',
                offer: bundleData
            });
            
            if (response.success) {
                // Display answer as QR code
                await displayAnswerBundle(response.answer);
            } else {
                showError('Failed to process offer: ' + response.error);
            }
        }
    } catch (error) {
        showError('Error processing connection: ' + error.message);
    }
}

// Display answer bundle as QR code
async function displayAnswerBundle(answerBundle) {
    // Show QR code section
    document.getElementById('qrCodeSection').classList.remove('hidden');
    document.getElementById('qrScannerSection').classList.add('hidden');
    
    // Update heading
    document.querySelector('#qrCodeSection h3').textContent = 'Show this answer to the other device';
    
    // Display bundle text
    document.getElementById('connectionBundle').value = answerBundle;
    
    // Generate QR code
    const canvas = document.getElementById('qrCanvas');
    canvas.innerHTML = ''; // Clear existing QR code
    
    new QRCode(canvas, {
        text: answerBundle,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
    });
    
    updateConnectionStatus('Connection will complete when other device scans this answer...');
    
    // Monitor for connection completion
    const checkInterval = setInterval(async () => {
        const devices = await chrome.runtime.sendMessage({ type: 'get_devices' });
        if (devices.peerCount > 0) {
            clearInterval(checkInterval);
            showSuccess('Connection established!');
            connectionState = 'connected';
            await loadDevices();
            resetConnectionUI();
        }
    }, 1000);
    
    // Stop checking after 5 minutes
    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
}

// Reset connection UI to initial state
function resetConnectionUI() {
    document.getElementById('connectionFlow').classList.add('hidden');
    document.getElementById('qrCodeSection').classList.add('hidden');
    document.getElementById('qrScannerSection').classList.add('hidden');
    document.querySelector('.connect-mode').style.display = 'block';
    document.getElementById('manualInput').value = '';
    document.getElementById('connectionBundle').value = '';
}

// Search handlers
function setupSearchHandlers() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        
        const response = await chrome.runtime.sendMessage({
            type: 'search',
            query: query
        });
        
        if (response.success) {
            displaySearchResults(response.results);
        }
    };
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

// Settings handlers
function setupSettingsHandlers() {
    // Generate secret button
    document.getElementById('generateSecret').addEventListener('click', () => {
        const secret = generateSharedSecret();
        document.getElementById('sharedSecret').value = secret;
    });
    
    // Disconnect button
    document.getElementById('disconnectButton').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'disconnect_all' });
        connectionState = 'disconnected';
        await loadDevices();
        showSuccess('Disconnected from all peers');
    });
}

// Load connection state
async function loadConnectionState() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_config' });
        if (response.success) {
            const config = response.config;
            
            // Update connection status
            connectionState = config.peerCount > 0 ? 'connected' : 'disconnected';
            updateConnectionIndicator();
            
            // Update settings if available
            if (config.hasSharedSecret) {
                document.getElementById('sharedSecret').value = '••••••••';
            }
        }
    } catch (error) {
        console.error('Error loading connection state:', error);
    }
}

// Load history
async function loadHistory() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_history' });
        if (response.success) {
            displayHistory(response.history);
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Load devices
async function loadDevices() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_devices' });
        if (response.success) {
            displayDevices(response.devices);
            updateDeviceFilter(response.devices);
        }
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

// Display history entries
function displayHistory(entries) {
    const historyList = document.getElementById('historyList');
    
    if (entries.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No history entries yet</p>';
        return;
    }
    
    historyList.innerHTML = entries.map(entry => `
        <div class="history-item">
            <div class="history-title">${escapeHtml(entry.title || 'Untitled')}</div>
            <div class="history-url">${escapeHtml(entry.url)}</div>
            <div class="history-meta">
                <span class="history-device">${escapeHtml(entry.deviceName)}</span>
                <span class="history-date">${formatDate(entry.visitDate)}</span>
            </div>
        </div>
    `).join('');
}

// Display search results
function displaySearchResults(results) {
    // Switch to history tab
    document.querySelector('.tab-button[data-tab="history"]').click();
    
    // Display results
    displayHistory(results);
}

// Display connected devices
function displayDevices(devices) {
    const devicesList = document.getElementById('devicesList');
    
    if (devices.length === 0) {
        devicesList.innerHTML = '<p class="empty-state">No connected devices</p>';
        return;
    }
    
    devicesList.innerHTML = devices.map(device => `
        <div class="device-item">
            <div class="device-name">${escapeHtml(device.name)}</div>
            <div class="device-info">
                <span class="device-type">${escapeHtml(device.type)}</span>
                <span class="device-id">${escapeHtml(device.id)}</span>
            </div>
            <div class="device-status">
                <span class="status-dot active"></span>
                Connected
            </div>
        </div>
    `).join('');
}

// Update device filter dropdown
function updateDeviceFilter(devices) {
    const deviceFilter = document.getElementById('deviceFilter');
    
    // Keep "All Devices" option
    deviceFilter.innerHTML = '<option value="">All Devices</option>';
    
    // Add device options
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name;
        deviceFilter.appendChild(option);
    });
    
    // Handle filter change
    deviceFilter.addEventListener('change', async () => {
        const response = await chrome.runtime.sendMessage({
            type: 'get_history',
            deviceId: deviceFilter.value || null
        });
        
        if (response.success) {
            displayHistory(response.history);
        }
    });
}

// Update connection indicator
function updateConnectionIndicator() {
    const indicator = document.getElementById('connectionStatus');
    const statusDot = indicator.querySelector('.status-dot');
    const statusText = indicator.querySelector('.status-text');
    
    if (connectionState === 'connected') {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// Update connection status message
function updateConnectionStatus(message) {
    const statusDiv = document.getElementById('connectionStatus');
    statusDiv.innerHTML = `<p class="status-message">${message}</p>`;
}

// Show error message
function showError(message) {
    const statusDiv = document.getElementById('connectionStatus');
    statusDiv.innerHTML = `<p class="error-message">${message}</p>`;
}

// Show success message
function showSuccess(message) {
    const statusDiv = document.getElementById('connectionStatus');
    statusDiv.innerHTML = `<p class="success-message">${message}</p>`;
}

// Generate shared secret
function generateSharedSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString();
}