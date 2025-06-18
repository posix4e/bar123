/* global CloudflareDNSDiscovery */
/**
 * cloudflareDiscoveryEncrypted.js - Encrypted Cloudflare DNS-based peer discovery
 * Uses AES-GCM encryption for all data stored in DNS records
 */

class CloudflareDNSDiscoveryEncrypted extends CloudflareDNSDiscovery {
    constructor(config) {
        super(config);

        // Encryption key derived from room ID and optional shared secret
        this.encryptionKey = null;
        this.sharedSecret = config.sharedSecret || config.roomId;

        // Initialize encryption
        this.initializeEncryption();
    }

    async initializeEncryption() {
        // Derive encryption key from shared secret
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.sharedSecret),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key
        this.encryptionKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('bar123-cloudflare-dns'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // Override encode to add encryption
    encodeMessage(data) {
        return this.encryptData(data);
    }

    // Override decode to add decryption
    decodeMessage(data) {
        return this.decryptData(data);
    }

    async encryptData(data) {
        if (!this.encryptionKey) {
            await this.initializeEncryption();
        }

        const encoder = new TextEncoder();
        const plaintext = encoder.encode(JSON.stringify(data));

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            plaintext
        );

        // Combine IV and ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);

        // Base64 encode
        const encoded = btoa(String.fromCharCode.apply(null, combined));

        // Check size limit
        if (encoded.length > 255) {
            // For larger messages, we could implement chunking
            throw new Error('Encrypted message too large for DNS record');
        }

        return encoded;
    }

    async decryptData(encoded) {
        if (!this.encryptionKey) {
            await this.initializeEncryption();
        }

        try {
            // Base64 decode
            const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));

            // Extract IV and ciphertext
            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);

            // Decrypt
            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                ciphertext
            );

            // Parse JSON
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(plaintext));
        } catch (error) {
            console.warn('Failed to decrypt message, might be from different room/secret');
            throw new Error('Decryption failed');
        }
    }

    // Override peer discovery to only process encrypted messages
    async discoverPeers() {
        try {
            const records = await this.listDNSRecords();
            const now = Date.now();
            const maxAge = 60000; // 1 minute

            // Process only records we can decrypt
            for (const record of records) {
                try {
                    // Determine record type from name pattern
                    if (record.name.includes('-peer-')) {
                        const peerInfo = await this.decryptData(record.content);

                        // Validate timestamp
                        if (now - peerInfo.timestamp > maxAge) {
                            continue;
                        }

                        // Only add if we successfully decrypted (same room/secret)
                        if (!this.discoveredPeers.has(peerInfo.id)) {
                            this.addPeer(peerInfo.id, peerInfo);
                        }
                    } else if (record.name.includes(`-msg-${this.deviceInfo.id}-`)) {
                        const message = await this.decryptData(record.content);

                        if (message.to === this.deviceInfo.id) {
                            this.handleSignalingMessage(message, message.from);

                            // Delete processed message
                            await this.deleteDNSRecord(record.name);
                        }
                    }
                } catch (error) {
                    // Skip records we can't decrypt (different room/secret)
                    continue;
                }
            }

            // Clean up stale peers
            for (const [peerId, peerInfo] of this.discoveredPeers) {
                if (now - peerInfo.lastSeen > maxAge * 2) {
                    this.removePeer(peerId);
                }
            }
        } catch (error) {
            console.error('Failed to discover peers:', error);
            this.handleError(error);
        }
    }

    // Create a more secure record name that doesn't leak room ID
    createRecordName(type, id, timestamp = '') {
        // Hash the room ID to avoid leaking it
        const roomHash = this.hashString(this.roomId).substring(0, 8);
        const parts = [
            this.recordPrefix,
            roomHash,
            type,
            id.substring(0, 8) // Only use partial device ID
        ];

        if (timestamp) {
            parts.push(timestamp);
        }

        return parts.join('-') + '.' + this.domain;
    }

    // Simple hash function for room ID
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // Override announce to encrypt device info
    async announcePresence() {
        const recordName = this.createRecordName('peer', this.deviceInfo.id);

        // Only include minimal info, encrypt the rest
        const recordData = await this.encryptData({
            id: this.deviceInfo.id,
            name: this.deviceInfo.name,
            type: this.deviceInfo.type,
            timestamp: Date.now(),
            // Add HMAC for additional verification
            hmac: await this.generateHMAC(this.deviceInfo.id + Date.now())
        });

        await this.upsertDNSRecord(recordName, recordData);
        this.ownRecords.add(recordName);
    }

    // Generate HMAC for message integrity
    async generateHMAC(data) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.sharedSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(data)
        );

        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
}

// Configuration for encrypted Cloudflare discovery
class CloudflareEncryptedConfig {
    static generate(domain, zoneId, apiToken, roomId, sharedSecret) {
        return {
            type: 'cloudflare-dns-encrypted',
            version: 1,
            config: {
                domain: domain,
                zoneId: zoneId,
                apiToken: apiToken,
                roomId: roomId,
                sharedSecret: sharedSecret,
                recordPrefix: '_p2psync',
                ttl: 120,
                encrypted: true
            },
            createdAt: new Date().toISOString()
        };
    }

    static async generateShareCode(config) {
        // For sharing, we can optionally encrypt the API token
        const shareData = {
            ...config,
            config: {
                ...config.config,
                // Encrypt sensitive data
                apiToken: await this.encryptForSharing(config.config.apiToken, config.config.sharedSecret)
            }
        };

        return btoa(JSON.stringify(shareData));
    }

    static async encryptForSharing(data, password) {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoder.encode(data)
        );

        // Combine salt, iv, and ciphertext
        const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        combined.set(salt);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

        return btoa(String.fromCharCode.apply(null, combined));
    }
}

// Export for use in background script
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = { CloudflareDNSDiscoveryEncrypted, CloudflareEncryptedConfig };
}