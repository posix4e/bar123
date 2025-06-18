# Cloudflare DNS Discovery

This document describes the Cloudflare DNS-based peer discovery method for bar123.

## Overview

Cloudflare DNS discovery allows devices to find each other using DNS TXT records on your own domain. This provides a serverless alternative to the WebSocket signaling server while maintaining automatic peer discovery (unlike STUN-only which requires manual connection exchange).

## How It Works

1. **Peer Announcement**: Each device creates a DNS TXT record announcing its presence
2. **Peer Discovery**: Devices poll DNS records to find other peers
3. **Message Exchange**: WebRTC signaling messages are temporarily stored as DNS TXT records
4. **Direct Connection**: Once signaling is complete, devices connect directly via WebRTC

### DNS Record Structure

Records follow this naming pattern:
```
_p2psync-{roomId}-{type}-{deviceId}-{timestamp}.yourdomain.com
```

Where:
- `_p2psync`: Prefix to identify sync records
- `{roomId}`: Room identifier for grouping devices
- `{type}`: Record type (`peer` for announcements, `msg` for signaling)
- `{deviceId}`: Unique device identifier
- `{timestamp}`: Optional timestamp for message records

## Security Considerations

### Current Implementation

⚠️ **WARNING**: DNS TXT records are PUBLIC. Currently, the implementation stores:
- Device names and IDs (visible to anyone)
- WebRTC signaling data (visible to anyone)
- Room membership (visible to anyone)

### Recommended Security Improvements

1. **Encrypt Signaling Data**: All WebRTC offers/answers should be encrypted before storing in DNS
2. **Use Shared Secret**: Encrypt using a pre-shared key that all devices know
3. **Minimize Metadata**: Don't store device names in plaintext
4. **Short TTLs**: Use minimum TTL (120 seconds) to reduce exposure time

### Example Encrypted Implementation

```javascript
// Before storing in DNS
const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    sharedKey,
    encoder.encode(JSON.stringify(signalingData))
);
const record = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

// After retrieving from DNS
const encrypted = Uint8Array.from(atob(record), c => c.charCodeAt(0));
const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    sharedKey,
    encrypted
);
const signalingData = JSON.parse(decoder.decode(decrypted));
```

## Setup Instructions

### Prerequisites

1. A domain on Cloudflare
2. Cloudflare API token with DNS edit permissions
3. Zone ID from Cloudflare dashboard

### Chrome Extension Setup

1. Open the extension popup
2. Go to Settings tab
3. Select "Cloudflare DNS" as discovery method
4. Enter:
   - Your domain (e.g., example.com)
   - Zone ID (found in Cloudflare dashboard)
   - API Token (create at https://dash.cloudflare.com/profile/api-tokens)
   - Room ID (unique identifier for your device group)
5. Click "Save & Connect"

### iOS App Setup

1. First, generate a share code from Chrome extension:
   - After connecting with Cloudflare DNS
   - Click "Generate Share Code"
   - Copy the entire message

2. In iOS app:
   - Go to Settings
   - Select "Cloudflare DNS" discovery
   - Paste the share code
   - Tap "Import"

## API Token Permissions

Create a token with these permissions:
- Zone: DNS: Edit
- Zone Resources: Include your specific zone

## Limitations

1. **Rate Limits**: Cloudflare API has rate limits (1200 requests/5 min)
2. **Record Size**: DNS TXT records limited to 255 characters
3. **Polling Delay**: Discovery has 5-second polling interval
4. **Public Visibility**: All DNS records are publicly queryable

## Troubleshooting

### Devices Not Finding Each Other
- Verify all devices use the same room ID
- Check DNS propagation (may take a minute)
- Ensure API token has correct permissions
- Check browser console for errors

### Connection Failures
- Verify STUN servers are accessible
- Check firewall settings
- Ensure WebRTC is not blocked

### DNS Record Cleanup
Records are automatically cleaned up when:
- Device disconnects normally
- TTL expires (120 seconds)
- Message records deleted after processing

## Future Improvements

1. **End-to-End Encryption**: Implement proper E2E encryption for all DNS data
2. **DNS-over-HTTPS**: Use DoH for additional privacy
3. **Record Compression**: Better compression for larger messages
4. **Multi-String Records**: Support for messages > 255 chars
5. **Regional Discovery**: Use geo-DNS for regional peer discovery