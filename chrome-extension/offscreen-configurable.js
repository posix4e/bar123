// Chrome extension offscreen document for WebRTC/Trystero connections
// This version supports configurable relay URLs for testing

/* global URLSearchParams */

console.log('History Sync offscreen document loaded (configurable version)');

let trysteroRoom = null;
let isConnected = false; // eslint-disable-line no-unused-vars

// Get relay URL from environment or use default
function getRelayUrls() {
  // Check if we're in test mode with custom relay
  const urlParams = new URLSearchParams(window.location.search);
  const testRelay = urlParams.get('relay');
  
  if (testRelay) {
    console.log('Using test relay:', testRelay);
    return [testRelay];
  }
  
  // Check for relay URL in localStorage (set by test scripts)
  const storedRelay = localStorage.getItem('test_relay_url');
  if (storedRelay) {
    console.log('Using stored test relay:', storedRelay);
    return [storedRelay];
  }
  
  // Default production relay
  return ['wss://relay.snort.social'];
}

// Listen for connection requests from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request);
    
  try {
    if (request.action === 'initConnection') {
      initTrysteroConnection(request.roomId, request.relayUrl)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Connection error in offscreen:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response
    } else if (request.action === 'setTestRelay') {
      // Allow setting test relay URL
      if (request.relayUrl) {
        localStorage.setItem('test_relay_url', request.relayUrl);
        console.log('Test relay URL set:', request.relayUrl);
      }
      sendResponse({ success: true });
    } else if (request.action === 'disconnect') {
      if (trysteroRoom) {
        try {
          trysteroRoom.leave();
        } catch (error) {
          console.error('Error leaving room:', error);
        }
        trysteroRoom = null;
        isConnected = false;
        console.log('Disconnected from Trystero room');
      }
      sendResponse({ success: true });
    } else if (request.action === 'sendHistory') {
      // Send history data to peers
      if (window.sendHistory && request.historyData) {
        try {
          // iOS expects direct array, Chrome sends wrapper object
          const historyEntries = request.historyData.entries || request.historyData;
          window.sendHistory(historyEntries);
          console.log('Sent history entries to peers:', historyEntries);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to send history:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        sendResponse({ success: false, error: 'Send function not available or no data' });
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
});

async function initTrysteroConnection(roomId, customRelayUrl) {
  console.log('Initializing Trystero connection for room:', roomId);
    
  try {
    // Use Trystero from the bundle
    const trystero = window.Trystero;
    if (!trystero) {
      throw new Error('Trystero not loaded. Check trystero-bundle.js');
    }
        
    // Disconnect from any existing room
    if (trysteroRoom) {
      trysteroRoom.leave();
      trysteroRoom = null;
    }
        
    // Configuration for Trystero
    const relayUrls = customRelayUrl ? [customRelayUrl] : getRelayUrls();
    const roomConfig = {
      appId: 'bar123-sync',
      relayUrls: relayUrls
    };
    console.log('Joining Trystero room with config:', roomConfig);
    console.log('Trystero version:', trystero.version || 'unknown');
        
    trysteroRoom = trystero.joinRoom(roomConfig, roomId);
    console.log('Joined Trystero room, waiting for peers...');
        
    // Set up peer handlers
    trysteroRoom.onPeerJoin(peerId => {
      console.log('🎉 Peer joined:', peerId);
      isConnected = true;
            
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'peerJoined',
        peerId: peerId
      });
    });
        
    trysteroRoom.onPeerLeave(peerId => {
      console.log('👋 Peer left:', peerId);
            
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'peerLeft',
        peerId: peerId
      });
    });
        
    // Set up data channels
    const [sendHistory, getHistory] = trysteroRoom.makeAction('history-sync');
    const [sendDelete, getDelete] = trysteroRoom.makeAction('delete-item');
    
    // Store send functions globally for background script access
    window.sendHistory = sendHistory;
    window.sendDelete = sendDelete;
        
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
      console.log('Received delete request from', peerId, ':', deleteData);
            
      // Forward to background script
      chrome.runtime.sendMessage({
        action: 'deleteHistoryItem',
        deleteData: deleteData,
        peerId: peerId
      });
    });
        
    console.log('Trystero connection initialized');
        
  } catch (error) {
    console.error('Failed to initialize Trystero:', error);
    throw error;
  }
}