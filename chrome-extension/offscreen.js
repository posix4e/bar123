// Chrome extension offscreen document for WebRTC/Trystero connections
console.log('History Sync offscreen document loaded');

let trysteroRoom = null;
let isConnected = false;

// Listen for connection requests from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request);
    
  try {
    if (request.action === 'initConnection') {
      initTrysteroConnection(request.roomId, request.sharedSecret)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Connection error in offscreen:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response
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
    }
  } catch (error) {
    console.error('Error handling offscreen message:', error);
    sendResponse({ success: false, error: error.message });
  }
});

async function initTrysteroConnection(roomId, _sharedSecret) {
  try {
    console.log('Initializing Trystero connection in offscreen document');
    console.log('Room ID:', roomId);
    console.log('Trystero available:', typeof trystero !== 'undefined');
        
    if (typeof trystero === 'undefined') {
      throw new Error('Trystero not loaded');
    }
        
    // Join room with explicit config
    console.log('Joining Trystero room with config:', { appId: 'history-sync' });
    console.log('Trystero version:', trystero.version || 'unknown');
        
    trysteroRoom = trystero.joinRoom({ appId: 'history-sync' }, roomId);
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
    const [, getHistory] = trysteroRoom.makeAction('history-sync');
    const [, getDelete] = trysteroRoom.makeAction('delete-item');
        
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
      }
    }, 30000);
        
    console.log('Trystero connection established successfully');
    return Promise.resolve();
        
  } catch (error) {
    console.error('Trystero connection error:', error);
    throw error;
  }
}