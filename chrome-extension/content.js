// Chrome extension content script for history tracking and P2P connection
console.log('History Sync content script loaded');

// Global connection state
let trysteroRoom = null;
let isConnected = false;

// Load Trystero bundle dynamically
const script = document.createElement('script');
script.src = chrome.runtime.getURL('trystero-bundle.js');
script.onload = () => {
    console.log('Trystero loaded in content script');
};
document.head.appendChild(script);

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
        }
        sendResponse({ success: true });
    }
});

async function initTrysteroConnection(roomId, sharedSecret) {
    try {
        console.log('Initializing Trystero connection in content script');
        console.log('Room ID:', roomId);
        
        // Wait for Trystero to be available
        let attempts = 0;
        while (typeof window.trystero === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof window.trystero === 'undefined') {
            throw new Error('Trystero not loaded after 5 seconds');
        }
        
        // Join room
        trysteroRoom = window.trystero.joinRoom({ appId: 'history-sync' }, roomId);
        console.log('Joined Trystero room');
        
        // Set up peer handlers
        trysteroRoom.onPeerJoin(peerId => {
            console.log('Peer joined:', peerId);
            isConnected = true;
            
            // Notify background script
            chrome.runtime.sendMessage({
                action: 'peerJoined',
                peerId: peerId
            });
        });
        
        trysteroRoom.onPeerLeave(peerId => {
            console.log('Peer left:', peerId);
            
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
        
        console.log('Trystero connection established successfully');
        return Promise.resolve();
        
    } catch (error) {
        console.error('Trystero connection error:', error);
        throw error;
    }
}

// Track page visits
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageVisit);
} else {
    trackPageVisit();
}

function trackPageVisit() {
    const historyEntry = {
        url: window.location.href,
        title: document.title,
        visitTime: Date.now()
    };
    
    // Send to background script
    chrome.runtime.sendMessage({
        action: 'trackHistory',
        entry: historyEntry
    }).catch(error => {
        console.log('Failed to track history:', error);
    });
}