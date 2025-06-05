# Bar123 - Cross-Platform History Sync Extension

A Safari iOS extension and Chrome extension that enables real-time history synchronization across devices using P2P technology and Trystero.

## 🚀 [Live Demo & Downloads](https://posix4e.github.io/bar123/)

**✨ New:** Interactive P2P history viewer - connect to real sync rooms and view live browsing history!

View the comprehensive showcase with:
- 📱 **Download links** for Chrome extension and iOS IPA (git-hashed)
- 👁️ **Live P2P viewer** - connect to real history sync rooms in read-only mode
- 📸 **Test screenshots** from automated cross-platform testing
- 🏗️ **Build artifacts** from latest CI runs with detailed reports
- 📊 **Real-time status** of tests, iOS builds, and TestFlight uploads

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

### 5. Try the Live Demo
1. Visit [showcase page](https://posix4e.github.io/bar123/)
2. Find someone using the extension and get their room secret
3. Use the **P2P History Viewer** to watch their browsing in real-time
4. See actual P2P WebRTC connections and history sync in action

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
- **Room-Based Connections**: Devices join rooms using shared secrets (SHA-256 hashed)
- **WebRTC Direct P2P**: No server-side data storage, encrypted peer connections
- **Device Identification**: Persistent device IDs for reconnection handling

### Core Components
1. **Background Service** (`background.js`): Manages P2P connections, history synchronization, and device coordination
2. **Content Script** (`content.js`): Tracks page visits, navigation timing, and sends events to background
3. **Popup Interface** (`popup.html/js/css`): Room configuration, connection status, and history management

### Build System
- **Trystero Bundling**: `npm run build-trystero-bundle` creates IIFE bundle for both platforms
- **Asset Copying**: Shared images and resources copied between platform directories
- **Cross-Platform**: Single build command supports both Safari and Chrome outputs
- **Version Control**: Git-hashed artifacts prevent stale distributions

## ✨ Features

- **Cross-Platform**: Works on both Safari iOS and Chrome desktop
- **Zero Server Setup**: Uses Trystero for serverless P2P connections
- **Real-Time Sync**: Instant history sharing as you browse
- **Privacy-First**: Direct P2P connections, no data stored on servers
- **Article Extraction**: Automatic content extraction from articles using Readability.js
- **Smart Search**: Search through article content, titles, and excerpts
- **Reading Time**: Calculates estimated reading time for articles (~200 WPM)
- **Duration Tracking**: Tracks time spent on each page
- **Device Management**: Persistent device IDs for reconnection
- **Search-Focused Interface**: Clean popup focused on finding specific articles
- **Easy Setup**: Just enter a shared room secret
- **Live Demo**: Real P2P viewer embedded in showcase page

## 🧪 Testing

### Real-World Testing (Recommended)
1. Build and install extension on multiple devices/browsers
2. Use same room secret on all devices
3. Browse real websites (reddit.com, github.com, etc.)
4. Watch history sync in real-time

### Live P2P Demo Testing
1. Visit [showcase page](https://posix4e.github.io/bar123/)
2. Get a room secret from an extension user
3. Use the **P2P History Viewer** to see real synchronization
4. Watch live browsing activity appear instantly

### Local Testing (For Development)
```bash
npm run dev
# Navigate to http://localhost:8081 for test pages
```

### Automated Testing

**End-to-End UI Tests:**
```bash
npm run test:interop            # Run all E2E tests
npm run test:js-js             # Chrome to Chrome sync tests
npm run test:swift-swift       # Safari to Safari sync tests (macOS)
npm run test:swift-js          # Chrome to Safari cross-platform tests (macOS)
```

**Local Test Runner (Interactive):**
```bash
./test/e2e-interop/run-local-test.js --headed --slow
# Options:
#   --test <type>    Run specific test: js-js, swift-swift, swift-js
#   --headed         Show browsers (not headless)
#   --debug          Enable debug mode
#   --slow           Slow down for debugging
#   --screenshots    Take screenshots at each step
```

**Test Coverage:**
- ✅ Real browser extension UI testing with Playwright
- ✅ iOS Safari extension UI testing with XCTest
- ✅ Cross-platform peer discovery and sync
- ✅ Connection resilience and reconnection
- ✅ Article content extraction and search
- ✅ Multi-peer room management
- ✅ WebRTC connection establishment
- ✅ Trystero room joining and peer discovery

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

### Using Article Search
4. **Browse**: Visit articles and blog posts - content extracts automatically
5. **Search**: Open extension → Type keywords to find articles by content
6. **Results**: See articles with reading time estimates and content excerpts
7. **Manage**: Use "Clear Local" or "Delete Remote" as needed

### What Gets Extracted
- **Article Content**: Clean text from news articles, blog posts, documentation
- **Reading Time**: Estimated at ~200 words per minute
- **Excerpts**: First few sentences for quick preview
- **Article Detection**: Only content >500 characters gets article treatment

## 🔒 Security

- **Room Secrets**: SHA-256 hashed before use for secure room joining
- **P2P Encryption**: WebRTC provides end-to-end encryption
- **No Server Storage**: History data never touches any servers
- **Local Persistence**: Extension data stored locally only
- **Device Privacy**: Device IDs for secure reconnection without personal data
- **Read-Only Demo**: Showcase P2P viewer can only receive, not send history

## 🛠️ Development

### Project Structure
```
bar123 Extension/Resources/     # Safari extension
├── manifest.json              # Safari manifest v3
├── background.js              # P2P service and history management
├── content.js                 # Page tracking and navigation timing
├── popup.html/css/js          # Settings UI and connection management
├── trystero-bundle.js         # Trystero bundle (IIFE)

chrome-extension/              # Chrome extension
├── manifest.json              # Chrome manifest v3 (service worker)
├── background.js              # Service worker for P2P connections
├── content.js                 # Page tracking and navigation timing
├── popup.html/css/js          # Settings UI and connection management
├── offscreen.html/js          # WebRTC support for MV3 compatibility

test/                          # Integration and end-to-end tests
├── cross-platform-sync-test.js    # Extension validation tests
├── local-multiplatform-test.js    # Chrome + Safari simulator tests

scripts/                       # Build and deployment automation
├── ios-build.js               # iOS build with TestFlight upload
├── generate-showcase-page.js   # GitHub Pages showcase generation
├── collect-debug-info.js      # CI debugging and artifact collection
├── prepare-profiles.js        # iOS provisioning profile setup

.github/workflows/             # CI/CD automation
├── ci-cd.yml                  # Complete build, test, and deploy pipeline
```

### Build Process
1. `npm install` downloads dependencies
2. `npm run build-trystero-bundle` creates IIFE bundle for WebRTC
3. `npm run build` copies shared resources to both platform directories
4. Platform-specific manifests handle service worker vs background script differences
5. `npm run ci:generate-showcase` creates GitHub Pages with embedded P2P viewer

### CI/CD Pipeline
- **Automated Testing**: Cross-platform validation with Chrome and Safari simulator
- **iOS Builds**: Automatic IPA generation with proper code signing
- **TestFlight Upload**: Automated deployment with enhanced error detection
- **GitHub Pages**: Live showcase deployment with build artifacts
- **Artifact Management**: Git-hashed files for version tracking
- **Test Screenshots**: Visual validation of extension functionality

## Platform Differences

### Safari Extension (iOS)
- Uses `manifest.json` with background scripts array
- Requires Xcode build process and iOS code signing
- Extension resources in `bar123 Extension/Resources/`
- Swift wrapper in `SafariWebExtensionHandler.swift`
- TestFlight distribution for beta testing

### Chrome Extension
- Uses `manifest.json` with service worker architecture
- Offscreen document support for WebRTC in MV3
- Direct Chrome Web Store deployment capability
- Additional permissions for scripting and offscreen documents
- Developer mode loading for testing

## 🐛 Troubleshooting

**"Failed to connect":**
- Check internet connection and WebRTC support
- Try a different room secret
- Verify extension permissions and enable status

**"0 peers" connected:**
- Ensure all devices use identical room secret
- Check extension is enabled/loaded properly
- Try disconnecting and reconnecting

**No history syncing:**
- Verify content script has necessary permissions
- Check browser's content blocker settings
- Look for console errors in developer tools
- Ensure background script/service worker is active

**Chrome MV3 Issues:**
- Offscreen document may need manual permission grant
- Check service worker is running (chrome://extensions)
- Verify WebRTC permissions in site settings

**TestFlight "Invalid" Status:**
- Set Export Compliance to "No" in App Store Connect
- Complete required app metadata fields
- Verify Bundle ID matches App Store Connect configuration

**iOS Build Failures:**
- Check provisioning profiles are valid and not expired
- Verify code signing certificates in Keychain
- Ensure Xcode command line tools are up to date

## 🚀 CI/CD Commands

```bash
# CI-specific builds
npm run ci:build-chrome        # Chrome extension build + zip with git hash
npm run ci:build-ios          # iOS build with certificates and signing
npm run ci:upload-testflight  # Upload to TestFlight with error detection

# CI testing
npm run ci:test               # Cross-platform tests with comprehensive logging
npm run ci:test-local-multiplatform  # Chrome + Safari simulator testing

# Debug and showcase
npm run ci:collect-debug      # Comprehensive debugging information
npm run ci:generate-showcase  # GitHub Pages with P2P viewer and artifacts
```

## 📝 License

MIT License - see LICENSE file for details.

---

**🔗 Links:**
- **Live Demo**: https://posix4e.github.io/bar123/
- **GitHub**: https://github.com/posix4e/bar123
- **Issues**: https://github.com/posix4e/bar123/issues