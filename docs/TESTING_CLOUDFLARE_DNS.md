# Testing Cloudflare DNS Discovery

This guide helps you verify that Cloudflare DNS discovery is working correctly.

## Prerequisites

1. A Cloudflare account with a domain
2. API token with DNS edit permissions
3. Zone ID for your domain

## Getting Your Cloudflare Credentials

1. **API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit zone DNS" template
   - Select your zone
   - Create and copy the token

2. **Zone ID**:
   - Go to your domain's overview page in Cloudflare
   - Find Zone ID in the right sidebar
   - Copy the ID

## Testing Methods

### Method 1: Command Line Test

```bash
# Run the test script
./scripts/test-cloudflare-dns.sh YOUR_API_TOKEN YOUR_ZONE_ID YOUR_DOMAIN test-room

# Example:
./scripts/test-cloudflare-dns.sh abc123... def456... example.com myroom
```

This will:
- Verify API access
- List existing peer records
- Create a test record
- Verify it's discoverable
- Clean up after testing

### Method 2: iOS Debug View

1. Open the bar123 iOS app
2. Go to Settings → Cloudflare DNS → Debug DNS Discovery
3. The debug view will show:
   - Current configuration
   - API access status
   - DNS record operations
   - Real-time discovery logs

### Method 3: Chrome Extension Test

1. Open `chrome-extension/test-cloudflare.html` in Chrome
2. Enter your credentials
3. Click "Test API Access" to verify connection
4. Click "Start Discovery" to begin peer discovery
5. Open in multiple tabs/browsers to test peer discovery

### Method 4: Manual DNS Check

You can manually verify DNS records using `dig`:

```bash
# Check for peer records
dig TXT _p2psync-ROOMID-peer-*.example.com @1.1.1.1

# Check specific record
dig TXT _p2psync-test-room-peer-device123.example.com @1.1.1.1
```

## What to Look For

### Success Indicators:
- ✅ API returns 200 OK
- ✅ Records are created with format: `_p2psync-ROOMID-peer-DEVICEID.domain`
- ✅ Records contain base64-encoded JSON with peer info
- ✅ Other peers discover your records within 5-10 seconds
- ✅ Records are automatically cleaned up on disconnect

### Common Issues:

1. **API Access Denied**
   - Check API token has DNS edit permissions
   - Verify token is for the correct zone

2. **Records Not Found**
   - DNS propagation can take 1-2 minutes
   - Check record name format is correct
   - Verify domain and zone ID match

3. **Peers Not Discovering Each Other**
   - Ensure both peers use same room ID
   - Check record prefix matches (`_p2psync`)
   - Verify DNS records are public (not proxied)

## Debug Output

When working correctly, you should see logs like:

```
[CloudflareDNS] Starting discovery for room: test-room
[CloudflareDNS] API access verified ✅
[CloudflareDNS] Creating presence record: _p2psync-test-room-peer-abc123.example.com
[CloudflareDNS] Presence announced ✅
[CloudflareDNS] Found 2 peer records for room test-room
[CloudflareDNS] Discovered new peer: Chrome Browser (chrome-xyz789)
```

## Performance Notes

- DNS records have 120-second TTL
- Discovery polls every 5 seconds
- Records are cleaned up on graceful disconnect
- Stale peers are removed after 60 seconds

## Security Considerations

- API tokens should have minimal permissions (DNS edit only)
- Each room ID creates isolated discovery namespace
- No actual sync data passes through DNS (only peer announcements)
- Records are automatically expired to prevent accumulation