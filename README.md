# Bar123 - Cross-Platform History Sync Extension

A Safari iOS extension and Chrome extension that enables real-time history synchronization across devices using P2P technology and Trystero.

## 🚀 [Live Demo & Downloads](https://posix4e.github.io/bar123/)

**Interactive P2P Demo**: Enter your shared secret on the showcase page to see live history synchronization from your devices in real-time! The demo uses the same Trystero protocol as the actual extensions.

View the showcase for live build artifacts, test results, screenshots, and download links.

## 🚀 Quick Start

### 1. Install Dependencies and Build
```bash
npm install
npm run build
```

### 2. Safari iOS Development
```bash
npm run xcode
```
This builds the extension and opens Xcode automatically.

### 3. Chrome Extension Testing
```bash
npm run launch-chrome
```
This builds and launches Chrome with the extension loaded.

### 4. Test Synchronization
1. **Device A**: Open extension popup → Enter room secret: `test123` → Connect
2. **Device B**: Same steps with same secret
3. Browse real websites and watch history sync in real-time!

## 🛠️ Development Commands

```bash
# Install dependencies and build the extension
npm install
npm run build

# Development workflow (build + test server)
npm run dev

# Open Xcode with built extension for iOS development  
npm run xcode

# Build Chrome extension specifically
npm run build-chrome

# Run comprehensive tests
npm run test                    # Cross-platform sync tests
npm run test-local-multiplatform  # Local multiplatform tests
npm run test-all               # All tests

# Launch Chrome extension for testing
npm run launch-chrome

# iOS build commands
npm run ios-build-local        # Local iOS build
npm run ios-build-testflight   # TestFlight build with upload

# Clean build artifacts
npm run clean
```

## 🔧 Architecture

### Multi-Platform Extension Architecture
- **Safari Extension**: Uses `bar123 Extension/Resources/` with manifest v3 background scripts
- **Chrome Extension**: Uses `chrome-extension/` with service worker architecture
- **Shared Core**: Both platforms use the same Trystero-based P2P connection logic

### P2P Connection System
- **Trystero Integration**: Bundled locally via esbuild to avoid CSP issues
- **Room-Based Connections**: Devices join rooms using shared secrets (hashed for security)
- **WebRTC Direct P2P**: No server-side data storage, encrypted peer connections
- **Device Identification**: Persistent device IDs for reconnection handling

### Core Components
1. **Background Service** (`background.js`): Manages P2P connections, history synchronization, and device coordination
2. **Content Script** (`content.js`): Tracks page visits, navigation timing, and sends events to background
3. **Popup Interface** (`popup.html/js/css`): Room configuration, connection status, and history management
4. **Signaling Adapters** (`signaling-adapters.js`): Platform-specific WebRTC signaling implementations

## ✨ Features

- **Cross-Platform**: Works on both Safari iOS and Chrome
- **Zero Server Setup**: Uses Trystero for serverless P2P connections
- **Real-Time Sync**: Instant history sharing as you browse
- **Privacy-First**: Direct P2P connections, no data on servers
- **Duration Tracking**: Tracks time spent on each page
- **Device Management**: Persistent device IDs for reconnection
- **History Viewing**: Browse synced history from all connected devices
- **Easy Setup**: Just enter a shared room secret

## 🧪 Testing

### Real-World Testing (Recommended)
1. Build and install extension on multiple devices/browsers
2. Use same room secret on all devices
3. Browse real websites (reddit.com, github.com, etc.)
4. Watch history sync in real-time

### Local Testing (For Development)
```bash
npm run dev
# Navigate to http://localhost:8081 for test pages
```

### Cross-Platform Testing
```bash
npm run test                    # End-to-end sync testing
npm run test-local-multiplatform  # Local multi-instance testing
```

## 📱 How to Use

### Safari iOS
1. **Build**: `npm run xcode` and build in Xcode
2. **Enable**: Safari Settings → Extensions → Enable "bar123 Extension"
3. **Configure**: Tap extension icon → Enter room secret
4. **Connect**: Tap "Connect" to join the P2P network

### Chrome
1. **Launch**: `npm run launch-chrome` or load `chrome-extension/` in developer mode
2. **Configure**: Click extension icon → Enter room secret
3. **Connect**: Click "Connect" to join the P2P network

### Usage
4. **Browse**: Visit any websites - history syncs automatically
5. **View History**: Use "View History" to see synced data from all devices
6. **Manage**: Use "Clear Local" or "Delete Remote" as needed

## 🔒 Security

- Room secrets are hashed before use
- P2P connections use WebRTC encryption
- No history data stored on any servers
- Local storage for persistence only
- Device IDs for secure reconnection

## 🛠️ Development

### Project Structure
```
bar123 Extension/Resources/     # Safari extension
├── manifest.json              # Safari manifest
├── background.js              # P2P service and history management
├── content.js                 # Page tracking
├── popup.html/css/js          # Settings UI
├── signaling-adapters.js      # Trystero bundle

chrome-extension/              # Chrome extension
├── manifest.json              # Chrome manifest (MV3)
├── background.js              # Service worker
├── content.js                 # Page tracking
├── popup.html/css/js          # Settings UI
├── offscreen.html/js          # WebRTC support for MV3

test/                          # Integration tests
├── cross-platform-sync-test.js
├── local-multiplatform-test.js
```

### Build Process
1. `npm install` downloads dependencies
2. `npm run build-trystero-bundle` creates IIFE bundle
3. `npm run build` copies shared resources to both platforms
4. Platform-specific manifests handle service worker vs background script differences

## Platform Differences

### Safari Extension (iOS)
- Uses `manifest.json` with background scripts array
- Requires Xcode build process and iOS code signing
- Extension resources in `bar123 Extension/Resources/`
- Swift wrapper in `SafariWebExtensionHandler.swift`

### Chrome Extension
- Uses `manifest.json` with service worker
- Offscreen document support for WebRTC in MV3
- Direct Chrome Web Store deployment capability
- Additional permissions for scripting and offscreen docs

## 🐛 Troubleshooting

**"Failed to connect":**
- Check internet connection
- Try a different room secret
- Verify extension permissions

**"0 devices" connected:**
- Ensure all devices use identical room secret
- Check extension is enabled/loaded
- Try disconnecting and reconnecting

**No history syncing:**
- Verify content script has permissions
- Check browser's content blocker settings
- Look for console errors in developer tools

**Chrome MV3 Issues:**
- Offscreen document may need manual permission
- Check service worker is running
- Verify WebRTC permissions

## 🚀 CI/CD & Release Workflow

### Branch Strategy
- **Feature PRs** → Build + test, no uploads
- **`main` branch** → TestFlight uploads (development/beta testing)
- **`test-testflight`** → TestFlight testing branch  
- **`test-pages`** → GitHub Pages testing branch
- **Git releases/tags** → Production release assets

### Development Commands
```bash
# CI-specific builds
npm run ci:build-chrome        # Chrome extension build + zip
npm run ci:build-ios          # iOS build with certificates
npm run ci:upload-testflight  # Upload to TestFlight

# CI testing
npm run ci:test               # Cross-platform tests with logging
npm run ci:test-local-multiplatform  # Local multiplatform with logging

# Debug and artifact collection
npm run ci:collect-debug      # Collect debugging information
npm run ci:generate-showcase  # Generate showcase documentation with live demo
```

### Release Process
1. **Development**: Merge to `main` → TestFlight upload for beta testing
2. **Production**: Create git release (v1.0.0) → Versioned production assets
3. **Testing**: Use `test-testflight` and `test-pages` branches for isolated testing

## 📝 License

MIT License - see LICENSE file for details.