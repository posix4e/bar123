/**
 * P2P Core Connection Manager
 * Handles serverless peer-to-peer connections using QR codes or text sharing
 * 
 * Connection Flow:
 * 1. Device A creates an offer bundle with ICE candidates
 * 2. Device A displays bundle as QR code or text
 * 3. Device B scans/inputs the bundle and creates answer
 * 4. Device B displays answer bundle
 * 5. Device A scans/inputs answer to complete connection
 */

class P2PConnectionManager {
  constructor(config) {
    this.peers = new Map();
    this.sharedSecret = config.sharedSecret || this.generateSharedSecret();
    this.deviceId = config.deviceId;
    this.deviceInfo = config.deviceInfo;
    this.onPeerConnected = config.onPeerConnected || (() => {});
    this.onPeerDisconnected = config.onPeerDisconnected || (() => {});
    this.onDataReceived = config.onDataReceived || (() => {});
    
    // WebRTC configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    // Pending connections waiting for answers
    this.pendingConnections = new Map();
  }
  
  /**
   * Generate a new shared secret for first-time connections
   */
  generateSharedSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }
  
  /**
   * Create a connection offer bundle
   * @returns {Promise<string>} Base64 encoded connection bundle
   */
  async createConnectionOffer() {
    const pc = new RTCPeerConnection(this.rtcConfig);
    const connectionId = this.generateConnectionId();
    
    // Create data channel
    const dataChannel = pc.createDataChannel('history-sync', {
      ordered: true
    });
    
    // Collect ICE candidates
    const iceCandidates = [];
    const candidatePromise = new Promise((resolve) => {
      let candidateTimeout;
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON());
          
          // Reset timeout on each candidate
          clearTimeout(candidateTimeout);
          candidateTimeout = setTimeout(() => resolve(), 2000);
        } else {
          // No more candidates
          clearTimeout(candidateTimeout);
          resolve();
        }
      };
      
      // Fallback timeout if no candidates received
      candidateTimeout = setTimeout(() => resolve(), 5000);
    });
    
    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE gathering
    await candidatePromise;
    
    // Store pending connection
    this.pendingConnections.set(connectionId, {
      peerConnection: pc,
      dataChannel: dataChannel,
      timestamp: Date.now()
    });
    
    // Create connection bundle
    const bundle = {
      version: '1.0',
      type: 'offer',
      connectionId: connectionId,
      peerId: this.deviceId,
      deviceInfo: this.deviceInfo,
      timestamp: new Date().toISOString(),
      sdp: offer.sdp,
      iceCandidates: iceCandidates,
      sharedSecret: this.sharedSecret // Include for first connection
    };
    
    // Sign and encode bundle
    const signedBundle = this.signBundle(bundle);
    return this.encodeBundle(signedBundle);
  }
  
  /**
   * Process a connection offer and create an answer bundle
   * @param {string} offerBundle - Base64 encoded offer bundle
   * @returns {Promise<string>} Base64 encoded answer bundle
   */
  async processConnectionOffer(offerBundle) {
    // Decode and verify bundle
    const bundle = this.decodeBundle(offerBundle);
    if (!this.verifyBundle(bundle)) {
      throw new Error('Invalid bundle signature');
    }
    
    // Extract shared secret if this is first connection
    if (bundle.sharedSecret && !this.sharedSecret) {
      this.sharedSecret = bundle.sharedSecret;
    }
    
    const pc = new RTCPeerConnection(this.rtcConfig);
    const remotePeerId = bundle.peerId;
    
    // Set up data channel handler
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, remotePeerId, bundle.deviceInfo);
    };
    
    // Collect ICE candidates
    const iceCandidates = [];
    const candidatePromise = new Promise((resolve) => {
      let candidateTimeout;
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON());
          clearTimeout(candidateTimeout);
          candidateTimeout = setTimeout(() => resolve(), 2000);
        } else {
          clearTimeout(candidateTimeout);
          resolve();
        }
      };
      
      candidateTimeout = setTimeout(() => resolve(), 5000);
    });
    
    // Set remote description and create answer
    await pc.setRemoteDescription({ type: 'offer', sdp: bundle.sdp });
    
    // Add remote ICE candidates
    for (const candidate of bundle.iceCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Wait for ICE gathering
    await candidatePromise;
    
    // Store peer connection
    this.peers.set(remotePeerId, {
      peerConnection: pc,
      deviceInfo: bundle.deviceInfo,
      connectionId: bundle.connectionId
    });
    
    // Create answer bundle
    const answerBundle = {
      version: '1.0',
      type: 'answer',
      connectionId: bundle.connectionId,
      peerId: this.deviceId,
      deviceInfo: this.deviceInfo,
      timestamp: new Date().toISOString(),
      sdp: answer.sdp,
      iceCandidates: iceCandidates
    };
    
    // Sign and encode bundle
    const signedBundle = this.signBundle(answerBundle);
    return this.encodeBundle(signedBundle);
  }
  
  /**
   * Complete connection with answer bundle
   * @param {string} answerBundle - Base64 encoded answer bundle
   */
  async completeConnection(answerBundle) {
    // Decode and verify bundle
    const bundle = this.decodeBundle(answerBundle);
    if (!this.verifyBundle(bundle)) {
      throw new Error('Invalid bundle signature');
    }
    
    // Find pending connection
    const pending = this.pendingConnections.get(bundle.connectionId);
    if (!pending) {
      throw new Error('No pending connection found');
    }
    
    const { peerConnection, dataChannel } = pending;
    const remotePeerId = bundle.peerId;
    
    // Set remote description
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: bundle.sdp });
    
    // Add remote ICE candidates
    for (const candidate of bundle.iceCandidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    
    // Set up data channel
    this.setupDataChannel(dataChannel, remotePeerId, bundle.deviceInfo);
    
    // Store peer connection
    this.peers.set(remotePeerId, {
      peerConnection: peerConnection,
      dataChannel: dataChannel,
      deviceInfo: bundle.deviceInfo
    });
    
    // Clean up pending connection
    this.pendingConnections.delete(bundle.connectionId);
  }
  
  /**
   * Set up data channel event handlers
   */
  setupDataChannel(dataChannel, remotePeerId, deviceInfo) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${remotePeerId}`);
      this.onPeerConnected(remotePeerId, deviceInfo);
      
      // Exchange peer lists for discovery
      this.sendPeerList(remotePeerId);
    };
    
    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${remotePeerId}`);
      this.peers.delete(remotePeerId);
      this.onPeerDisconnected(remotePeerId);
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'peer_list') {
          this.handlePeerList(message, remotePeerId);
        } else {
          this.onDataReceived(message, remotePeerId);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
    
    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${remotePeerId}:`, error);
    };
  }
  
  /**
   * Send data to a specific peer or broadcast to all
   */
  sendData(data, peerId = null) {
    const message = JSON.stringify(data);
    
    if (peerId) {
      const peer = this.peers.get(peerId);
      if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(message);
      }
    } else {
      // Broadcast to all peers
      this.peers.forEach((peer, id) => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          peer.dataChannel.send(message);
        }
      });
    }
  }
  
  /**
   * Send peer list for discovery
   */
  sendPeerList(toPeerId) {
    const peerList = Array.from(this.peers.entries())
      .filter(([id]) => id !== toPeerId)
      .map(([id, peer]) => ({
        peerId: id,
        deviceInfo: peer.deviceInfo,
        lastSeen: new Date().toISOString()
      }));
    
    this.sendData({
      type: 'peer_list',
      peers: peerList
    }, toPeerId);
  }
  
  /**
   * Handle received peer list
   */
  handlePeerList(message, fromPeerId) {
    // Store peer information for potential future connections
    // This enables peer discovery through existing connections
    console.log(`Received peer list from ${fromPeerId}:`, message.peers);
    
    // In a full implementation, we would:
    // 1. Store these peers for display in UI
    // 2. Potentially attempt connections through relay
    // 3. Update last seen timestamps
  }
  
  /**
   * Encode connection bundle to Base64
   */
  encodeBundle(bundle) {
    const json = JSON.stringify(bundle);
    // Use browser's btoa or Node's Buffer for Base64 encoding
    if (typeof btoa !== 'undefined') {
      return btoa(json);
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(json).toString('base64');
    }
    throw new Error('No Base64 encoding method available');
  }
  
  /**
   * Decode connection bundle from Base64
   */
  decodeBundle(encoded) {
    let json;
    // Use browser's atob or Node's Buffer for Base64 decoding
    if (typeof atob !== 'undefined') {
      json = atob(encoded);
    } else if (typeof Buffer !== 'undefined') {
      json = Buffer.from(encoded, 'base64').toString();
    } else {
      throw new Error('No Base64 decoding method available');
    }
    return JSON.parse(json);
  }
  
  /**
   * Sign bundle with HMAC-SHA256
   */
  signBundle(bundle) {
    // Create a copy without signature
    const bundleToSign = { ...bundle };
    delete bundleToSign.signature;
    
    // Calculate HMAC
    const dataString = JSON.stringify(bundleToSign);
    const signature = this.calculateHMAC(dataString, this.sharedSecret);
    
    // Return bundle with signature
    return { ...bundle, signature };
  }
  
  /**
   * Verify bundle signature
   */
  verifyBundle(bundle) {
    const signature = bundle.signature;
    if (!signature) return false;
    
    // Create a copy without signature
    const bundleToVerify = { ...bundle };
    delete bundleToVerify.signature;
    
    // Calculate expected HMAC
    const dataString = JSON.stringify(bundleToVerify);
    const expectedSignature = this.calculateHMAC(dataString, this.sharedSecret);
    
    return signature === expectedSignature;
  }
  
  /**
   * Calculate HMAC-SHA256
   * This is a placeholder - actual implementation depends on platform
   */
  calculateHMAC(data, secret) {
    // In browser: use SubtleCrypto or CryptoJS
    // In Node: use crypto module
    // This should be overridden by platform-specific implementation
    console.warn('HMAC calculation not implemented - override this method');
    return 'placeholder-hmac';
  }
  
  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `${this.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up old pending connections
   */
  cleanupPendingConnections() {
    const timeout = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    this.pendingConnections.forEach((pending, id) => {
      if (now - pending.timestamp > timeout) {
        pending.peerConnection.close();
        this.pendingConnections.delete(id);
      }
    });
  }
  
  /**
   * Get all connected peers
   */
  getConnectedPeers() {
    return Array.from(this.peers.entries()).map(([id, peer]) => ({
      peerId: id,
      deviceInfo: peer.deviceInfo,
      connected: peer.peerConnection.connectionState === 'connected'
    }));
  }
  
  /**
   * Disconnect from a specific peer
   */
  disconnectPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.peerConnection.close();
      this.peers.delete(peerId);
    }
  }
  
  /**
   * Disconnect from all peers
   */
  disconnectAll() {
    this.peers.forEach((peer) => {
      peer.peerConnection.close();
    });
    this.peers.clear();
    
    this.pendingConnections.forEach((pending) => {
      pending.peerConnection.close();
    });
    this.pendingConnections.clear();
  }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = P2PConnectionManager;
} else if (typeof window !== 'undefined') {
  window.P2PConnectionManager = P2PConnectionManager;
}