/**
 * WebRTC Signaling Server with HMAC Authentication
 * 
 * This server relays WebRTC signaling messages (SDP offers/answers and ICE candidates)
 * between peers. All messages must be authenticated with HMAC using a pre-shared secret.
 * 
 * Architecture:
 * - WebSocket-based for real-time bidirectional communication
 * - HMAC-SHA256 authentication for message integrity and authenticity
 * - Room-based peer management for scalability
 * - Message types: join, offer, answer, ice-candidate, leave
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8080;
const SHARED_SECRET = process.env.SHARED_SECRET || 'your-pre-shared-secret-here';

// In-memory storage for connected peers
const rooms = new Map(); // roomId -> Set of peer connections
const peers = new Map(); // ws -> { id, roomId, deviceInfo }

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signaling Server\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

/**
 * Verify HMAC signature of a message
 * @param {Object} message - The message object containing data and hmac
 * @param {string} secret - The shared secret
 * @returns {boolean} - True if HMAC is valid
 */
function verifyHMAC(message, secret) {
  if (!message.hmac || !message.data) {
    console.log('Missing HMAC or data in message');
    return false;
  }

  // Calculate expected HMAC
  const dataString = JSON.stringify(message.data);
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(message.hmac, 'hex'),
    Buffer.from(expectedHmac, 'hex')
  );
}

/**
 * Generate HMAC for outgoing messages
 * @param {Object} data - The data to sign
 * @param {string} secret - The shared secret
 * @returns {string} - The HMAC hex string
 */
function generateHMAC(data, secret) {
  const dataString = JSON.stringify(data);
  return crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');
}

/**
 * Send a message to a specific peer with HMAC
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - The data to send
 */
function sendToPeer(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    const message = {
      data: data,
      hmac: generateHMAC(data, SHARED_SECRET)
    };
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast a message to all peers in a room except the sender
 * @param {string} roomId - The room ID
 * @param {string} senderId - The sender's peer ID
 * @param {Object} data - The data to broadcast
 */
function broadcastToRoom(roomId, senderId, data) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.forEach(peerWs => {
    const peer = peers.get(peerWs);
    if (peer && peer.id !== senderId) {
      sendToPeer(peerWs, data);
    }
  });
}

/**
 * Handle peer joining a room
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - Join message data
 */
function handleJoin(ws, data) {
  const { roomId, peerId, deviceInfo } = data;
  
  if (!roomId || !peerId) {
    sendToPeer(ws, { type: 'error', message: 'Missing roomId or peerId' });
    return;
  }

  // Store peer information
  peers.set(ws, { id: peerId, roomId, deviceInfo });

  // Add peer to room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(ws);

  console.log(`Peer ${peerId} joined room ${roomId}`);

  // Notify other peers in the room
  broadcastToRoom(roomId, peerId, {
    type: 'peer-joined',
    peerId: peerId,
    deviceInfo: deviceInfo
  });

  // Send list of existing peers to the new peer
  const existingPeers = [];
  rooms.get(roomId).forEach(peerWs => {
    const peer = peers.get(peerWs);
    if (peer && peer.id !== peerId) {
      existingPeers.push({
        peerId: peer.id,
        deviceInfo: peer.deviceInfo
      });
    }
  });

  sendToPeer(ws, {
    type: 'room-peers',
    peers: existingPeers
  });
}

/**
 * Handle WebRTC offer
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - Offer message data
 */
function handleOffer(ws, data) {
  const sender = peers.get(ws);
  if (!sender) return;

  const { targetPeerId, offer } = data;
  
  // Find target peer
  let targetWs = null;
  rooms.get(sender.roomId)?.forEach(peerWs => {
    const peer = peers.get(peerWs);
    if (peer && peer.id === targetPeerId) {
      targetWs = peerWs;
    }
  });

  if (targetWs) {
    sendToPeer(targetWs, {
      type: 'offer',
      offer: offer,
      fromPeerId: sender.id
    });
  }
}

/**
 * Handle WebRTC answer
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - Answer message data
 */
function handleAnswer(ws, data) {
  const sender = peers.get(ws);
  if (!sender) return;

  const { targetPeerId, answer } = data;
  
  // Find target peer
  let targetWs = null;
  rooms.get(sender.roomId)?.forEach(peerWs => {
    const peer = peers.get(peerWs);
    if (peer && peer.id === targetPeerId) {
      targetWs = peerWs;
    }
  });

  if (targetWs) {
    sendToPeer(targetWs, {
      type: 'answer',
      answer: answer,
      fromPeerId: sender.id
    });
  }
}

/**
 * Handle ICE candidate
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Object} data - ICE candidate message data
 */
function handleIceCandidate(ws, data) {
  const sender = peers.get(ws);
  if (!sender) return;

  const { targetPeerId, candidate } = data;
  
  // Find target peer
  let targetWs = null;
  rooms.get(sender.roomId)?.forEach(peerWs => {
    const peer = peers.get(peerWs);
    if (peer && peer.id === targetPeerId) {
      targetWs = peerWs;
    }
  });

  if (targetWs) {
    sendToPeer(targetWs, {
      type: 'ice-candidate',
      candidate: candidate,
      fromPeerId: sender.id
    });
  }
}

/**
 * Handle peer disconnection
 * @param {WebSocket} ws - The WebSocket connection
 */
function handleDisconnect(ws) {
  const peer = peers.get(ws);
  if (!peer) return;

  // Remove from room
  const room = rooms.get(peer.roomId);
  if (room) {
    room.delete(ws);
    
    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(peer.roomId);
    } else {
      // Notify other peers
      broadcastToRoom(peer.roomId, peer.id, {
        type: 'peer-left',
        peerId: peer.id
      });
    }
  }

  // Remove peer info
  peers.delete(ws);
  console.log(`Peer ${peer.id} disconnected from room ${peer.roomId}`);
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      
      // Verify HMAC
      if (!verifyHMAC(parsedMessage, SHARED_SECRET)) {
        console.log('Invalid HMAC, rejecting message');
        sendToPeer(ws, { type: 'error', message: 'Invalid authentication' });
        ws.close();
        return;
      }

      const data = parsedMessage.data;
      console.log('Received message type:', data.type);

      // Handle different message types
      switch (data.type) {
        case 'join':
          handleJoin(ws, data);
          break;
        case 'offer':
          handleOffer(ws, data);
          break;
        case 'answer':
          handleAnswer(ws, data);
          break;
        case 'ice-candidate':
          handleIceCandidate(ws, data);
          break;
        case 'leave':
          handleDisconnect(ws);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendToPeer(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleDisconnect(ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log('Make sure to set SHARED_SECRET environment variable in production');
});