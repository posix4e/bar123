// js-libp2p client for Chrome extension
// This provides full libp2p functionality in the browser extension

import { createLibp2p } from 'libp2p';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { identify } from '@libp2p/identify';
import { kadDHT } from '@libp2p/kad-dht';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { all } from '@libp2p/websockets/filters';

class LibP2PClient {
  constructor() {
    this.node = null;
    this.isConnected = false;
    this.peerId = null;
    this.roomTopic = null;
    this.messageHandlers = new Map();
    this.peers = new Map();
  }

  async connect(_, roomId) { // No relay needed
    try {
      // Create libp2p node configured for browser with P2P capabilities
      this.node = await createLibp2p({
        addresses: {
          listen: [
            // Listen on WebRTC for browser-to-browser connections
            '/webrtc'
          ]
        },
        transports: [
          webSockets({
            filter: all
          }),
          webRTC()
        ],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [],
        services: {
          identify: identify(),
          dht: kadDHT({
            clientMode: false // Run as full DHT node
          }),
          pubsub: gossipsub({
            allowPublishToZeroPeers: true,
            emitSelf: false,
            fallbackToFloodsub: true,
            floodPublish: false,
            doPX: false,
            msgIdFn: (msg) => {
              // Create message ID from content hash
              const decoder = new TextDecoder();
              decoder.decode(msg.data); // Decode for validation
              return crypto.subtle.digest('SHA-256', msg.data).then(hash => {
                return Array.from(new Uint8Array(hash))
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join('')
                  .substring(0, 20);
              });
            }
          })
        }
      });

      // Set up event listeners
      this.node.addEventListener('peer:connect', (evt) => {
        const peerId = evt.detail.toString();
        console.log('Connected to peer:', peerId);
        this.handlePeerJoined(peerId);
      });

      this.node.addEventListener('peer:disconnect', (evt) => {
        const peerId = evt.detail.toString();
        console.log('Disconnected from peer:', peerId);
        this.handlePeerLeft(peerId);
      });

      // Start the node
      await this.node.start();
      this.peerId = this.node.peerId.toString();
      console.log('LibP2P node started with ID:', this.peerId);

      // Subscribe to room topic
      this.roomTopic = `bar123-room-${roomId}`;
      this.node.services.pubsub.subscribe(this.roomTopic);
      console.log('Subscribed to room topic:', this.roomTopic);

      // Also subscribe to general history sync topic
      this.node.services.pubsub.subscribe('bar123-history-sync');

      // Handle incoming messages
      this.node.services.pubsub.addEventListener('message', (evt) => {
        this.handleMessage(evt.detail);
      });

      this.isConnected = true;
      console.log('Connected to libp2p network');
      
      // Start DHT random walk to discover peers
      await this.node.services.dht.refreshRoutingTable();
      console.log('DHT routing table refresh started');

    } catch (error) {
      console.error('Failed to create libp2p node:', error);
      throw error;
    }
  }

  async publish(data) {
    if (!this.node || !this.roomTopic) {
      console.warn('Not connected to a room');
      return;
    }

    try {
      const message = new TextEncoder().encode(JSON.stringify(data));
      await this.node.services.pubsub.publish(this.roomTopic, message);
      console.log('Published message to room');
    } catch (error) {
      console.error('Failed to publish message:', error);
    }
  }

  handleMessage(evt) {
    try {
      // Skip our own messages
      if (evt.detail.from === this.peerId) {return;}
      
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(evt.detail.data));
      
      console.log('Received message from', evt.detail.from, ':', data);
      
      const handler = this.messageHandlers.get('data');
      if (handler) {
        handler(data, evt.detail.from);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  handlePeerJoined(peerId) {
    this.peers.set(peerId, { connected: true });
    const handler = this.messageHandlers.get('peer_joined');
    if (handler) {handler(peerId);}
  }

  handlePeerLeft(peerId) {
    this.peers.delete(peerId);
    const handler = this.messageHandlers.get('peer_left');
    if (handler) {handler(peerId);}
  }

  onPeerJoin(handler) {
    this.messageHandlers.set('peer_joined', handler);
  }

  onPeerLeave(handler) {
    this.messageHandlers.set('peer_left', handler);
  }

  onData(handler) {
    this.messageHandlers.set('data', handler);
  }

  onDisconnected(handler) {
    this.messageHandlers.set('disconnected', handler);
  }

  async disconnect() {
    if (this.node) {
      if (this.roomTopic) {
        this.node.services.pubsub.unsubscribe(this.roomTopic);
      }
      this.node.services.pubsub.unsubscribe('bar123-history-sync');
      
      await this.node.stop();
      this.node = null;
    }
    
    this.isConnected = false;
    this.peers.clear();
    
    const handler = this.messageHandlers.get('disconnected');
    if (handler) {handler();}
  }

  getPeers() {
    return Array.from(this.peers.keys());
  }
}

export { LibP2PClient };