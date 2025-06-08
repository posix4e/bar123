/**
 * Connection Sharing Utilities
 * Handles creation and parsing of shareable connection strings for manual P2P setup
 */

class ConnectionShare {
    // Connection string version for future compatibility
    static VERSION = '1';
    
    /**
     * Creates a shareable connection offer
     * @param {Object} localInfo - Local peer information
     * @returns {Promise<Object>} Connection offer data
     */
    static async createOffer(localInfo) {
        // Create a peer connection to gather ICE candidates
        const pc = new RTCPeerConnection({
            iceServers: localInfo.stunServers.map(url => ({ urls: url }))
        });
        
        // Create data channel to trigger ICE gathering
        pc.createDataChannel('connection');
        
        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // Gather ICE candidates
        const candidates = await this.gatherCandidates(pc);
        
        // Create connection data
        const connectionData = {
            v: this.VERSION,
            id: localInfo.deviceId,
            name: localInfo.deviceName,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            ice: candidates.map(c => ({
                c: c.candidate,
                m: c.sdpMid,
                i: c.sdpMLineIndex
            })),
            ts: Date.now()
        };
        
        // Store the peer connection for later use
        this.pendingConnection = { pc, localInfo };
        
        return connectionData;
    }
    
    /**
     * Creates a response to a connection offer
     * @param {Object} offerData - The offer data from remote peer
     * @param {Object} localInfo - Local peer information
     * @returns {Promise<Object>} Connection response data
     */
    static async createResponse(offerData, localInfo) {
        // Validate offer data
        if (!this.validateConnectionData(offerData)) {
            throw new Error('Invalid connection offer');
        }
        
        // Create peer connection
        const pc = new RTCPeerConnection({
            iceServers: localInfo.stunServers.map(url => ({ urls: url }))
        });
        
        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
        
        // Add ICE candidates
        for (const ice of offerData.ice) {
            await pc.addIceCandidate(new RTCIceCandidate({
                candidate: ice.c,
                sdpMid: ice.m,
                sdpMLineIndex: ice.i
            }));
        }
        
        // Create answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        // Gather ICE candidates
        const candidates = await this.gatherCandidates(pc);
        
        // Create response data
        const responseData = {
            v: this.VERSION,
            id: localInfo.deviceId,
            name: localInfo.deviceName,
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            ice: candidates.map(c => ({
                c: c.candidate,
                m: c.sdpMid,
                i: c.sdpMLineIndex
            })),
            offerId: offerData.id,
            ts: Date.now()
        };
        
        // Store peer connection
        this.pendingConnection = { pc, remoteId: offerData.id, localInfo };
        
        return responseData;
    }
    
    /**
     * Completes connection using response data
     * @param {Object} responseData - Response data from remote peer
     * @returns {Promise<RTCPeerConnection>} Established peer connection
     */
    static async completeConnection(responseData) {
        if (!this.pendingConnection) {
            throw new Error('No pending connection');
        }
        
        const { pc } = this.pendingConnection;
        
        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(responseData.answer));
        
        // Add ICE candidates
        for (const ice of responseData.ice) {
            await pc.addIceCandidate(new RTCIceCandidate({
                candidate: ice.c,
                sdpMid: ice.m,
                sdpMLineIndex: ice.i
            }));
        }
        
        // Wait for connection
        await this.waitForConnection(pc);
        
        const connection = this.pendingConnection;
        this.pendingConnection = null;
        
        return { pc, remoteId: responseData.id, remoteName: responseData.name };
    }
    
    /**
     * Encodes connection data to shareable string
     * @param {Object} data - Connection data
     * @returns {string} Base64 encoded string
     */
    static encode(data) {
        const json = JSON.stringify(data);
        // Use URL-safe base64 encoding
        return btoa(json)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    /**
     * Decodes connection string
     * @param {string} encoded - Encoded connection string
     * @returns {Object} Connection data
     */
    static decode(encoded) {
        try {
            // Restore base64 padding and standard characters
            const base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/')
                .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');
            
            const json = atob(base64);
            return JSON.parse(json);
        } catch (error) {
            throw new Error('Invalid connection string');
        }
    }
    
    /**
     * Creates a shareable link with connection data
     * @param {Object} data - Connection data
     * @param {string} baseUrl - Base URL for the link
     * @returns {string} Shareable URL
     */
    static createLink(data, baseUrl = window.location.origin) {
        const encoded = this.encode(data);
        return `${baseUrl}#connect:${encoded}`;
    }
    
    /**
     * Parses connection link
     * @param {string} url - Connection URL
     * @returns {Object|null} Connection data or null
     */
    static parseLink(url) {
        const match = url.match(/#connect:(.+)$/);
        if (match) {
            return this.decode(match[1]);
        }
        return null;
    }
    
    /**
     * Creates a human-friendly connection code
     * @param {Object} data - Connection data
     * @returns {string} Short connection code
     */
    static createCode(data) {
        // Create a hash of the connection data
        const json = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < json.length; i++) {
            hash = ((hash << 5) - hash) + json.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Convert to readable code (e.g., "SYNC-A3F2-B9K1")
        const code = Math.abs(hash).toString(36).toUpperCase();
        return `SYNC-${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }
    
    /**
     * Formats connection data for display
     * @param {Object} data - Connection data
     * @returns {string} Formatted string for sharing
     */
    static format(data, isOffer = true) {
        const code = this.createCode(data);
        const encoded = this.encode(data);
        
        if (isOffer) {
            return `🔗 History Sync Connection Request
From: ${data.name}
Code: ${code}

To connect, either:
1. Click this link: ${this.createLink(data)}
2. Or copy and paste this code:

${encoded}

This request expires in 5 minutes.`;
        } else {
            return `✅ History Sync Connection Response
From: ${data.name}
Code: ${code}

Send this back to complete the connection:

${encoded}`;
        }
    }
    
    // Helper methods
    
    static async gatherCandidates(pc) {
        return new Promise((resolve) => {
            const candidates = [];
            let gatheringComplete = false;
            
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    candidates.push(event.candidate);
                } else if (!gatheringComplete) {
                    gatheringComplete = true;
                    resolve(candidates);
                }
            };
            
            // Timeout after 3 seconds
            setTimeout(() => {
                if (!gatheringComplete) {
                    gatheringComplete = true;
                    resolve(candidates);
                }
            }, 3000);
        });
    }
    
    static async waitForConnection(pc, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, timeout);
            
            const checkConnection = () => {
                if (pc.connectionState === 'connected') {
                    clearTimeout(timer);
                    resolve();
                } else if (pc.connectionState === 'failed') {
                    clearTimeout(timer);
                    reject(new Error('Connection failed'));
                }
            };
            
            pc.onconnectionstatechange = checkConnection;
            checkConnection(); // Check immediately
        });
    }
    
    static validateConnectionData(data) {
        return data && 
               data.v === this.VERSION &&
               data.id &&
               (data.offer || data.answer) &&
               data.ice &&
               Array.isArray(data.ice);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionShare;
}