#!/usr/bin/env node
import { joinRoom } from 'trystero/nostr';
import readline from 'readline';

const relayURL = process.env.RELAY_URL || 'ws://localhost:7777';
const roomID = process.env.ROOM_ID || 'test-room';
const peerName = process.env.PEER_NAME || 'js-peer';
const isAutomated = process.env.AUTOMATED_TEST === 'true';

console.log('[CHAT] Starting Trystero chat client');
console.log('[CHAT] Relay:', relayURL);
console.log('[CHAT] Room:', roomID);
console.log('[CHAT] Name:', peerName);

// Create room configuration
const room = joinRoom({
  appId: 'trystero-chat',
  relayUrls: [relayURL]
}, roomID);

// Track connected peers
const connectedPeers = new Set();

// Create send/receive actions
const [sendMessage, getMessage] = room.makeAction('chat');

// Set up event handlers
room.onPeerJoin(peerId => {
  console.log('[CHAT] Peer joined:', peerId);
  connectedPeers.add(peerId);
  
  // Send introduction message
  sendMessage(`${peerName} joined the room`, peerId);
});

room.onPeerLeave(peerId => {
  console.log('[CHAT] Peer left:', peerId);
  connectedPeers.delete(peerId);
});

// Handle incoming messages
getMessage((message, peerId) => {
  console.log(`[CHAT] Message from ${peerId}: ${message}`);
  
  // In automated mode, respond to specific messages
  if (isAutomated) {
    handleAutomatedResponse(message, peerId);
  }
});

function handleAutomatedResponse(message, peerId) {
  switch (message) {
  case 'ping':
    sendMessage('pong', peerId);
    break;
  case 'echo-test':
    sendMessage('echo-response', peerId);
    break;
  default:
    if (message.startsWith('test-')) {
      sendMessage(`ack-${message}`, peerId);
    }
    break;
  }
}

async function runAutomatedTest() {
  console.log('[CHAT] Running in automated test mode');
  
  // Wait for peers to connect
  let attempts = 0;
  while (connectedPeers.size === 0 && attempts < 30) {
    console.log(`[CHAT] Waiting for peers... (${attempts + 1}/30)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (connectedPeers.size === 0) {
    console.error('[CHAT] ERROR: No peers connected after 30 seconds');
    process.exit(1);
  }
  
  // Send test messages
  const testMessages = [
    'Hello from JavaScript!',
    'test-message-1',
    'test-message-2',
    'ping'
  ];
  
  for (const message of testMessages) {
    console.log('[CHAT] Sending test message:', message);
    sendMessage(message); // Broadcast to all
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('[CHAT] Automated test completed');
  process.exit(0);
}

async function runInteractiveChat() {
  console.log('[CHAT] Interactive mode - type messages to send, "quit" to exit');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('line', (input) => {
    if (input === 'quit') {
      console.log('[CHAT] Exiting...');
      room.leave();
      rl.close();
      process.exit(0);
    }
    
    const message = `${peerName}: ${input}`;
    sendMessage(message); // Broadcast
    console.log('[CHAT] Sent:', input);
  });
}

// Start the appropriate mode
if (isAutomated) {
  setTimeout(runAutomatedTest, 1000); // Give room time to initialize
} else {
  runInteractiveChat();
}