# bar123 CLI Testing Tool

A command-line interface for testing bar123's P2P sync functionality, including Cloudflare DNS discovery.

## Installation

```bash
cd cli
swift build
```

## Usage

The CLI automatically reads credentials from the `.env` file in the parent directory.

### Test Cloudflare DNS Discovery

```bash
# Uses credentials from .env
swift run bar123 test-cloudflare

# Or specify manually
swift run bar123 test-cloudflare \
  --api-token "your-token" \
  --zone-id "your-zone-id" \
  --domain "your-domain" \
  --room-id "test-room"
```

### Simulate History Sync

```bash
# Generate and sync 50 history entries
swift run bar123 sync --entries 50 --method cloudflare

# Use WebSocket discovery
swift run bar123 sync --method websocket --room-id "my-room"
```

### Search History

```bash
# Search all synced history
swift run bar123 search "github"

# Search on specific device
swift run bar123 search "stackoverflow" --device "device-1"
```

### Monitor Peer Discovery

```bash
# Monitor for 30 seconds
swift run bar123 monitor --duration 30

# Monitor specific room
swift run bar123 monitor --room-id "production" --method cloudflare
```

## Environment Variables

The CLI reads from `.env` file:
- `API` - Cloudflare API token
- `ZONEID` - Cloudflare Zone ID
- `DNS` - Domain name
- `ROOMID` - Room ID for peer discovery

## Examples

### Full Cloudflare Test Workflow

```bash
# 1. Test API access and DNS operations
swift run bar123 test-cloudflare

# 2. Monitor peer discovery
swift run bar123 monitor --method cloudflare --duration 60

# 3. Simulate syncing
swift run bar123 sync --entries 100 --method cloudflare

# 4. Search synced data
swift run bar123 search "apple"
```

### Testing Different Discovery Methods

```bash
# Cloudflare DNS
swift run bar123 sync --method cloudflare

# WebSocket signaling
swift run bar123 sync --method websocket

# STUN-only (manual)
swift run bar123 sync --method stun
```

## Output Examples

### Successful Cloudflare Test
```
🔍 Testing Cloudflare DNS Discovery
Domain: newman.family
Zone ID: 10fa67ca924a83ca40d1c8081d21fdfe
Room ID: goatmanisthebest

1️⃣ Testing API access...
✅ API access verified

2️⃣ Listing existing peer records...
Found 2 DNS record(s)
  - _p2psync-goatmanisthebest-peer-ios123.newman.family
  - _p2psync-goatmanisthebest-peer-chrome456.newman.family

3️⃣ Creating test peer announcement...
✅ Created test record: _p2psync-goatmanisthebest-peer-cli-test-a1b2c3d4.newman.family

4️⃣ Verifying record is discoverable...
✅ Record should now be discoverable by other peers

5️⃣ Cleaning up test record...
✅ Test record deleted

✅ All tests passed!
```