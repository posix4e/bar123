/**
 * cloudflareDiscovery.js - Cloudflare DNS-based peer discovery
 * Uses DNS TXT records for WebRTC signaling without a server
 */

class CloudflareDNSDiscovery extends PeerDiscovery {
    constructor(config) {
        super(config);
        
        // Cloudflare API configuration
        this.apiToken = config.cloudflareApiToken;
        this.zoneId = config.cloudflareZoneId;
        this.domain = config.domain;
        this.recordPrefix = config.recordPrefix || '_p2psync';
        this.roomId = config.roomId;
        
        // Record TTL (minimum 120 seconds for Cloudflare)
        this.ttl = config.ttl || 120;
        
        // Polling interval for checking new peers
        this.pollInterval = config.pollInterval || 5000;
        this.pollTimer = null;
        
        // Track our own records for cleanup
        this.ownRecords = new Set();
        
        // Active connections
        this.connections = new Map();
    }
    
    async start() {
        try {
            // Verify API access
            await this.verifyAccess();
            
            // Announce our presence
            await this.announcePresence();
            
            // Start polling for peers
            this.pollTimer = setInterval(() => {
                this.discoverPeers().catch(error => {
                    this.handleError(error);
                });
            }, this.pollInterval);
            
            // Initial discovery
            await this.discoverPeers();
        } catch (error) {
            throw new Error(`Failed to start Cloudflare discovery: ${error.message}`);
        }
    }
    
    async stop() {
        // Stop polling
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        
        // Clean up our DNS records
        await this.cleanupRecords();
        
        // Clear state
        this.discoveredPeers.clear();
        this.connections.clear();
    }
    
    async sendSignalingMessage(message, to) {
        // Create a DNS record for the message
        const recordName = this.createRecordName('msg', to, Date.now());
        const recordData = this.encodeMessage({
            from: this.deviceInfo.id,
            to: to,
            type: message.type,
            data: message.data
        });
        
        await this.createDNSRecord(recordName, recordData);
        this.ownRecords.add(recordName);
        
        // Clean up old message records
        setTimeout(() => {
            this.deleteDNSRecord(recordName).catch(() => {});
        }, 30000); // Clean up after 30 seconds
    }
    
    // Announce our presence via DNS
    async announcePresence() {
        const recordName = this.createRecordName('peer', this.deviceInfo.id);
        const recordData = this.encodeMessage({
            id: this.deviceInfo.id,
            name: this.deviceInfo.name,
            type: this.deviceInfo.type,
            timestamp: Date.now()
        });
        
        await this.upsertDNSRecord(recordName, recordData);
        this.ownRecords.add(recordName);
    }
    
    // Discover peers by scanning DNS records
    async discoverPeers() {
        try {
            const records = await this.listDNSRecords();
            const now = Date.now();
            const maxAge = 60000; // Consider peers stale after 1 minute
            
            // Process peer announcements
            const peerRecords = records.filter(r => 
                r.name.includes(`${this.recordPrefix}-${this.roomId}-peer-`) &&
                !r.name.includes(`-peer-${this.deviceInfo.id}`)
            );
            
            for (const record of peerRecords) {
                try {
                    const peerInfo = this.decodeMessage(record.content);
                    
                    // Skip stale peers
                    if (now - peerInfo.timestamp > maxAge) {
                        continue;
                    }
                    
                    // Add or update peer
                    if (!this.discoveredPeers.has(peerInfo.id)) {
                        this.addPeer(peerInfo.id, peerInfo);
                    }
                } catch (error) {
                    console.warn('Failed to decode peer record:', error);
                }
            }
            
            // Process signaling messages for us
            const messageRecords = records.filter(r => 
                r.name.includes(`${this.recordPrefix}-${this.roomId}-msg-${this.deviceInfo.id}-`)
            );
            
            for (const record of messageRecords) {
                try {
                    const message = this.decodeMessage(record.content);
                    
                    if (message.to === this.deviceInfo.id) {
                        this.handleSignalingMessage(message, message.from);
                        
                        // Delete processed message
                        await this.deleteDNSRecord(record.name);
                    }
                } catch (error) {
                    console.warn('Failed to process message record:', error);
                }
            }
            
            // Check for stale peers
            for (const [peerId, peerInfo] of this.discoveredPeers) {
                const peerRecord = peerRecords.find(r => 
                    r.name.includes(`-peer-${peerId}`)
                );
                
                if (!peerRecord) {
                    this.removePeer(peerId);
                }
            }
        } catch (error) {
            console.error('Failed to discover peers:', error);
            this.handleError(error);
        }
    }
    
    // Create a standardized record name
    createRecordName(type, id, timestamp = '') {
        const parts = [
            this.recordPrefix,
            this.roomId,
            type,
            id
        ];
        
        if (timestamp) {
            parts.push(timestamp);
        }
        
        return parts.join('-') + '.' + this.domain;
    }
    
    // Encode message for DNS TXT record (max 255 chars)
    encodeMessage(data) {
        const json = JSON.stringify(data);
        const compressed = this.compress(json);
        
        // DNS TXT records have a 255 character limit per string
        // But can have multiple strings, we'll use base64 encoding
        const encoded = btoa(compressed);
        
        if (encoded.length > 255) {
            // For larger messages, we could split across multiple strings
            // For now, we'll truncate and add a continuation marker
            console.warn('Message too large for single DNS record');
            return encoded.substring(0, 252) + '...';
        }
        
        return encoded;
    }
    
    // Decode message from DNS TXT record
    decodeMessage(data) {
        try {
            // Handle multiple strings if present
            const combined = Array.isArray(data) ? data.join('') : data;
            
            if (combined.endsWith('...')) {
                throw new Error('Truncated message');
            }
            
            const decompressed = this.decompress(atob(combined));
            return JSON.parse(decompressed);
        } catch (error) {
            throw new Error(`Failed to decode message: ${error.message}`);
        }
    }
    
    // Simple compression using URL-safe replacements
    compress(str) {
        // Replace common WebRTC signaling patterns
        return str
            .replace(/candidate:/g, 'c:')
            .replace(/typ host/g, 'th')
            .replace(/typ srflx/g, 'ts')
            .replace(/generation/g, 'g')
            .replace(/ufrag/g, 'u')
            .replace(/pwd/g, 'p')
            .replace(/fingerprint/g, 'f')
            .replace(/setup/g, 's')
            .replace(/protocol/g, 'pr')
            .replace(/sdpMLineIndex/g, 'mi')
            .replace(/sdpMid/g, 'm');
    }
    
    decompress(str) {
        return str
            .replace(/c:/g, 'candidate:')
            .replace(/th/g, 'typ host')
            .replace(/ts/g, 'typ srflx')
            .replace(/g/g, 'generation')
            .replace(/u/g, 'ufrag')
            .replace(/p/g, 'pwd')
            .replace(/f/g, 'fingerprint')
            .replace(/s/g, 'setup')
            .replace(/pr/g, 'protocol')
            .replace(/mi/g, 'sdpMLineIndex')
            .replace(/m/g, 'sdpMid');
    }
    
    // Cloudflare API methods
    async verifyAccess() {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}`, {
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid Cloudflare credentials or zone ID');
        }
    }
    
    async listDNSRecords() {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records?type=TXT&name=${this.recordPrefix}-${this.roomId}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to list DNS records');
        }
        
        const data = await response.json();
        return data.result || [];
    }
    
    async createDNSRecord(name, content) {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'TXT',
                    name: name,
                    content: content,
                    ttl: this.ttl
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to create DNS record');
        }
    }
    
    async upsertDNSRecord(name, content) {
        // First, check if record exists
        const existing = await this.listDNSRecords();
        const record = existing.find(r => r.name === name);
        
        if (record) {
            // Update existing record
            await this.updateDNSRecord(record.id, content);
        } else {
            // Create new record
            await this.createDNSRecord(name, content);
        }
    }
    
    async updateDNSRecord(recordId, content) {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${recordId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to update DNS record');
        }
    }
    
    async deleteDNSRecord(name) {
        const records = await this.listDNSRecords();
        const record = records.find(r => r.name === name);
        
        if (record) {
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${record.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to delete DNS record');
            }
        }
    }
    
    async cleanupRecords() {
        // Delete all our records
        for (const recordName of this.ownRecords) {
            try {
                await this.deleteDNSRecord(recordName);
            } catch (error) {
                console.warn(`Failed to cleanup record ${recordName}:`, error);
            }
        }
        this.ownRecords.clear();
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudflareDNSDiscovery;
}