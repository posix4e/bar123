// Chrome extension connection page for handling WebRTC via Trystero
console.log('Connection page loaded');

let trysteroRoom = null;
let isConnected = false;

// Wait for DOM to be ready before signaling
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing connection page');
    updateStatus('Connection page loaded - waiting for init message');
    
    // Signal to background script that we're ready
    chrome.runtime.sendMessage({ action: 'connectionPageReady' });
});

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

async function initTrysteroConnection(roomId, sharedSecret) {
    try {
        console.log('Initializing Trystero connection');
        console.log('Room ID:', roomId);
        
        updateStatus('Connecting to Trystero...');
        
        // Check if trystero is available
        if (typeof trystero === 'undefined') {
            throw new Error('Trystero not loaded');
        }
        
        // Join room
        trysteroRoom = trystero.joinRoom({ appId: 'history-sync' }, roomId);
        console.log('Joined Trystero room');
        
        updateStatus('Waiting for peers...');
        
        // Set up peer handlers
        trysteroRoom.onPeerJoin(peerId => {
            console.log('Peer joined:', peerId);
            isConnected = true;
            updateStatus(`Connected to peer: ${peerId}`);
            
            // Notify background script
            chrome.runtime.sendMessage({
                action: 'peerJoined',
                peerId: peerId
            });
        });
        
        trysteroRoom.onPeerLeave(peerId => {
            console.log('Peer left:', peerId);
            updateStatus('Peer disconnected');
            
            // Notify background script
            chrome.runtime.sendMessage({
                action: 'peerLeft',
                peerId: peerId
            });
        });
        
        // Set up data channels
        const [sendHistory, getHistory] = trysteroRoom.makeAction('history-sync');
        const [sendDelete, getDelete] = trysteroRoom.makeAction('delete-item');
        
        getHistory((historyData, peerId) => {
            console.log('Received history from', peerId);
            
            // Forward to background script
            chrome.runtime.sendMessage({
                action: 'receivedHistory',
                historyData: historyData,
                peerId: peerId
            });
        });
        
        getDelete((deleteData, peerId) => {
            console.log('Received delete from', peerId);
            
            // Forward to background script
            chrome.runtime.sendMessage({
                action: 'receivedDelete',
                deleteData: deleteData,
                peerId: peerId
            });
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