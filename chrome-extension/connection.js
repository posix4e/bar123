// Chrome extension connection page for handling WebRTC via Trystero
console.log('Connection page loaded');

let trysteroRoom = null;
let isConnected = false;

// Wait for DOM and Chrome APIs to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing connection page');
    updateStatus('Connection page loaded - waiting for init message');
    
    // Wait for chrome.runtime to be available
    function waitForChromeRuntime() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            console.log('Chrome runtime available, signaling ready');
            // Signal to background script that we're ready
            chrome.runtime.sendMessage({ action: 'connectionPageReady' });
        } else {
            console.log('Waiting for Chrome runtime...');
            setTimeout(waitForChromeRuntime, 100);
        }
    }
    
    waitForChromeRuntime();
});

// Setup message listener when Chrome APIs are ready
function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        // Listen for connection requests from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'initConnection') {
                initTrysteroConnection(request.roomId, request.sharedSecret)
                    .then(() => {
                        sendResponse({ success: true });
                    })
                    .catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep message channel open for async response
            } else if (request.action === 'disconnect') {
                if (trysteroRoom) {
                    trysteroRoom.leave();
                    trysteroRoom = null;
                    isConnected = false;
                    console.log('Disconnected from Trystero room');
                    updateStatus('Disconnected');
                }
                sendResponse({ success: true });
            }
        });
        console.log('Message listener setup complete');
    } else {
        console.log('Chrome runtime not ready, retrying...');
        setTimeout(setupMessageListener, 100);
    }
}

// Initialize message listener
setupMessageListener();

async function initTrysteroConnection(roomId, sharedSecret) {
    try {
        console.log('Initializing Trystero connection');
        console.log('Room ID:', roomId);
        
        updateStatus('Connecting to Trystero...');
        
        // Check if trystero is available
        if (typeof trystero === 'undefined') {
            throw new Error('Trystero not loaded');
        }
        
        // Join room with explicit config
        console.log('Joining Trystero room with config:', { appId: 'history-sync' });
        console.log('Room ID:', roomId);
        console.log('Trystero version:', trystero.version || 'unknown');
        
        trysteroRoom = trystero.joinRoom({ appId: 'history-sync' }, roomId);
        console.log('Joined Trystero room, waiting for peers...');
        
        updateStatus('Waiting for peers...');
        
        // Set up peer handlers
        trysteroRoom.onPeerJoin(peerId => {
            console.log('🎉 Peer joined:', peerId);
            isConnected = true;
            updateStatus(`Connected to peer: ${peerId}`);
            
            // Notify background script
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'peerJoined',
                    peerId: peerId
                });
            }
        });
        
        // Add error handling for connection issues
        trysteroRoom.onPeerLeave(peerId => {
            console.log('👋 Peer left:', peerId);
            updateStatus('Peer disconnected');
            
            // Notify background script
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'peerLeft',
                    peerId: peerId
                });
            }
        });
        
        // Log room activity
        console.log('🔍 Room setup complete. Actively looking for peers...');
        console.log('💡 Make sure both devices use the same shared secret!');
        
        // Timeout warning
        setTimeout(() => {
            if (!isConnected) {
                console.warn('⚠️  No peers found after 30 seconds. Check:');
                console.warn('   1. Same shared secret on both devices');
                console.warn('   2. Network connectivity');
                console.warn('   3. Browser console for errors');
                updateStatus('Waiting for peers... (check console for debugging)');
            }
        }, 30000);
        
        // Set up data channels
        const [sendHistory, getHistory] = trysteroRoom.makeAction('history-sync');
        const [sendDelete, getDelete] = trysteroRoom.makeAction('delete-item');
        
        getHistory((historyData, peerId) => {
            console.log('Received history from', peerId);
            
            // Forward to background script
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'receivedHistory',
                    historyData: historyData,
                    peerId: peerId
                });
            }
        });
        
        getDelete((deleteData, peerId) => {
            console.log('Received delete from', peerId);
            
            // Forward to background script
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'receivedDelete',
                    deleteData: deleteData,
                    peerId: peerId
                });
            }
        });
        
        updateStatus('Ready for P2P connections');
        console.log('Trystero connection established successfully');
        return Promise.resolve();
        
    } catch (error) {
        console.error('Trystero connection error:', error);
        updateStatus(`Connection failed: ${error.message}`);
        throw error;
    }
}

function updateStatus(message) {
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');
    
    if (statusEl) {
        statusEl.textContent = message;
    }
    
    if (logEl) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `${new Date().toISOString()}: ${message}`;
        logEl.appendChild(logEntry);
        // Auto-scroll to bottom
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    console.log('Status:', message);
}

// Script loaded
console.log('Connection page script fully loaded');