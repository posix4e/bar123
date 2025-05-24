# Safari History Sync Extension

A Safari iOS extension that enables real-time history synchronization across devices using P2P technology and PeerJS.

## 🚀 Quick Start

### 1. Install Dependencies and Build
```bash
npm install
npm run build
```

### 2. Open in Xcode and Build
```bash
npm run xcode
```
This builds the extension and opens Xcode automatically.

### 3. Install on Device/Simulator
- In Xcode: Select target → Press `Cmd+R`
- Enable in Safari: Settings → Safari → Extensions → Enable "bar123 Extension"

### 4. Test Synchronization
1. **Device A**: Open Safari extension → Enter room secret: `test123` → Connect
2. **Device B**: Same steps with same secret
3. Browse real websites and watch history sync in real-time!

## 🛠️ Development Commands

```bash
# Install dependencies and build extension
npm run build

# Start development environment (build + test server)
npm run dev

# Open Xcode with built extension
npm run xcode

# Clean build artifacts
npm run clean

# Test PeerJS connectivity
npm run test-peerjs
```

## 🔧 Architecture

- **Content Script**: Tracks page visits and navigation events
- **Background Service**: Manages P2P connections via PeerJS
- **Popup UI**: Configuration interface for room secrets
- **PeerJS**: Handles all WebRTC signaling and connections
- **Local Bundling**: PeerJS bundled locally to avoid CSP issues

## ✨ Features

- **Zero Server Setup**: Uses PeerJS cloud service
- **Real-Time Sync**: Instant history sharing as you browse
- **Privacy-First**: Direct P2P connections, no data on servers
- **Duration Tracking**: Tracks time spent on each page
- **Cross-Device**: Works across Safari instances on any device
- **Easy Setup**: Just enter a shared room secret

## 🧪 Testing

### Real-World Testing (Recommended)
1. Build and install extension on 2 devices
2. Use same room secret on both devices
3. Browse real websites (reddit.com, github.com, etc.)
4. Watch history sync in real-time

### Local Testing (For Development)
```bash
npm run dev
# Navigate to http://localhost:8081 for test pages
```

## 📱 How to Use

1. **Install Extension**: Build in Xcode and enable in Safari
2. **Configure**: Enter a room secret (same on all devices)
3. **Connect**: Tap "Connect" to join the P2P network
4. **Browse**: Visit any websites - history syncs automatically
5. **Manage**: Use "Clear Local" or "Delete Remote" as needed

## 🔒 Security

- Room secrets are hashed before use
- P2P connections use WebRTC encryption
- No history data stored on any servers
- Local storage for persistence only

## 🛠️ Development

### Project Structure
```
bar123 Extension/Resources/
├── manifest.json          # Extension manifest
├── peerjs.min.js          # Bundled PeerJS library
├── background.js          # P2P service and history management
├── content.js            # Page tracking
├── popup.html/css/js     # Settings UI
package.json              # Build system and dependencies
```

### Build Process
1. `npm install` downloads PeerJS
2. `npm run build` copies PeerJS to extension resources
3. Manifest loads PeerJS before background script
4. No external CDN dependencies = no CSP issues

## 🐛 Troubleshooting

**"Failed to connect to PeerJS":**
- Check internet connection
- Try a different room secret
- Verify extension permissions

**"0 devices" connected:**
- Ensure both devices use identical room secret
- Check Safari extension is enabled
- Try disconnecting and reconnecting

**No history syncing:**
- Verify content script has permissions
- Check Safari's content blocker settings
- Look for console errors in Web Inspector

## 📝 License

MIT License - see LICENSE file for details.