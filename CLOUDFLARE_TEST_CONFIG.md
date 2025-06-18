# Test Cloudflare Configuration

If you want to quickly test the Cloudflare DNS discovery without setting up your own domain, you can use these test configurations:

## Option 1: Use Your Own Cloudflare Account (Recommended)

1. Sign up for a free Cloudflare account at https://cloudflare.com
2. Add any domain you own (even a free domain from Freenom works)
3. Follow the setup guide in the app to get your credentials

## Option 2: Test Domain (Limited Testing Only)

⚠️ **WARNING**: This is a shared test domain. Do NOT use for real data. Only for testing the feature.

You can use this configuration for basic testing:

```
Domain: p2psync-test.com
Zone ID: [Contact maintainer for test zone ID]
API Token: [Contact maintainer for test token]
Room ID: test-[your-name]-[random-number]
```

**Important Notes:**
- Use a unique Room ID to avoid conflicts with other testers
- This is ONLY for testing - do not sync real/private data
- The test domain may have rate limits or be unavailable

## Setting Up Your Own Test Domain

### Free Domain Options:
1. **Freenom** (https://freenom.com) - Free .tk, .ml, .ga domains
2. **Duck DNS** (https://duckdns.org) - Free subdomains
3. **No-IP** (https://noip.com) - Free dynamic DNS

### Steps:
1. Register a free domain
2. Add it to Cloudflare (free plan is sufficient)
3. Create an API token with DNS edit permissions
4. Use your domain for testing

## Quick Test Checklist

After configuration, verify:

✅ API Token has DNS edit permissions
✅ Zone ID matches your domain
✅ Room ID is the same on all devices
✅ Domain is active in Cloudflare
✅ DNS records are not proxied (orange cloud OFF)

## Example Working Configuration

Here's what a working configuration looks like:

```
Domain: mysync.example.com
Zone ID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
API Token: Vx_abcdef123456789...
Room ID: home-devices-2024
```

## Debugging

To verify Cloudflare DNS is working:

1. iOS App: Settings → Cloudflare DNS → Debug DNS Discovery
2. Chrome Extension: Open test-cloudflare.html
3. Command Line: `./scripts/test-cloudflare-dns.sh YOUR_TOKEN YOUR_ZONE YOUR_DOMAIN test-room`

## Security Reminder

- Never share your API token publicly
- Use unique Room IDs for privacy
- Only sync with devices you trust
- Revoke tokens when done testing