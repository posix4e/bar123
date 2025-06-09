# Cloudflare DNS Setup Guide for bar123

This guide will help you set up Cloudflare DNS discovery for peer-to-peer connections.

## Step 1: Get Your Cloudflare Credentials

### 1.1 Create a Cloudflare API Token

1. Log in to your Cloudflare account at https://dash.cloudflare.com
2. Click on your profile icon (top right) → "My Profile"
3. Click on "API Tokens" in the left sidebar
4. Click "Create Token"
5. Click "Use template" next to "Edit zone DNS"
6. Configure the token:
   - **Token name**: `bar123 DNS Discovery`
   - **Permissions**: 
     - Zone → DNS → Edit
   - **Zone Resources**: 
     - Include → Specific zone → Select your domain
   - **Client IP Address Filtering** (optional): Add your IP for extra security
   - **TTL**: Set an expiration date or leave blank for no expiration
7. Click "Continue to summary"
8. Click "Create Token"
9. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### 1.2 Find Your Zone ID

1. Go to your domain's overview page in Cloudflare
2. In the right sidebar, under "API", find "Zone ID"
3. Click "Copy" to copy the Zone ID

### 1.3 Note Your Domain

This is simply your domain name (e.g., `example.com`)

## Step 2: Configure in bar123 App

### iOS App Configuration

1. Open the bar123 iOS app
2. Go to the "Settings" tab (gear icon)
3. Under "Discovery Method", tap "Cloudflare DNS"
4. Enter your configuration:
   - **Domain**: Your domain (e.g., `example.com`)
   - **Zone ID**: The Zone ID you copied
   - **API Token**: The API token you created
   - **Room ID**: A unique room name (e.g., `my-devices`)
5. Tap "Save"

### Chrome Extension Configuration

1. Click the bar123 extension icon
2. Click the settings gear
3. Select "Cloudflare DNS" as the discovery method
4. Enter the same credentials as above
5. Click "Save"

## Step 3: Test Your Configuration

### Quick Test in iOS

1. After saving, go to "Debug DNS Discovery"
2. Tap "Test Cloudflare DNS"
3. You should see:
   - ✅ API access verified
   - ✅ Created test record
   - ✅ Record is discoverable

### What Success Looks Like

```
[CloudflareDNS] Starting discovery for room: my-devices
[CloudflareDNS] API access verified ✅
[CloudflareDNS] Creating presence record: _p2psync-my-devices-peer-ios123.example.com
[CloudflareDNS] Presence announced ✅
[CloudflareDNS] Found 1 peer records for room my-devices
[CloudflareDNS] Discovered new peer: Chrome Browser (chrome-abc456)
```

## Step 4: Connect Your Devices

1. Configure all your devices with the same:
   - Domain
   - Zone ID  
   - API Token
   - **Room ID** (MUST be identical on all devices)

2. Devices will automatically discover each other within 5-10 seconds

## Troubleshooting

### "API access failed"
- Check your API token has DNS edit permissions
- Verify the token hasn't expired
- Make sure you're using the correct Zone ID

### "No peers discovered"
- Ensure all devices use the EXACT same Room ID
- Wait 30-60 seconds for DNS propagation
- Check that your domain's DNS records aren't proxied (orange cloud should be OFF)

### "Failed to create record"
- Your API token might not have write permissions
- Check if you've hit Cloudflare's API rate limits (1200 requests per 5 minutes)

## Security Notes

- **API Token**: Only grant DNS edit permissions, nothing more
- **Room ID**: Acts like a password - only devices with the same Room ID can discover each other
- **Data Privacy**: Only peer discovery happens through DNS. Actual data syncing uses direct peer-to-peer connections

## Example Configuration

Here's a complete example:

- **Domain**: `mysyncdata.com`
- **Zone ID**: `abc123def456ghi789jkl012mno345pq`
- **API Token**: `Vx_1234567890abcdef...` (keep this secret!)
- **Room ID**: `family-devices-2024`

## Advanced Options

### Using Subdomains
You can use a subdomain for better organization:
- Domain: `sync.example.com`
- This keeps sync records separate from your main domain

### Multiple Rooms
Use different Room IDs to create separate sync groups:
- `work-devices` for work computers
- `home-devices` for personal devices
- `test-room` for testing

### TTL Settings
The default TTL is 120 seconds (2 minutes). This means:
- Peers are discovered within 5-10 seconds
- Stale peers are removed after 2-3 minutes

## Need Help?

1. Use the "Debug DNS Discovery" feature in the iOS app
2. Run the test script: `./scripts/test-cloudflare-dns.sh`
3. Check Cloudflare's DNS records page to see if records are being created

Remember: The most common issue is using different Room IDs on different devices. Always double-check this first!