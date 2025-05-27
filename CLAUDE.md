# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bar123 is a Safari iOS extension that enables real-time history synchronization across devices using P2P technology. The project has migrated from PeerJS to Trystero and supports both Safari iOS extensions and Chrome extensions through a shared codebase.

## Essential Development Commands

```bash
# Install dependencies and build the extension
npm install
npm run build

# Development workflow (build + test server)
npm run dev

# IMPORTANT: Always run linting before commits
npm run lint:check

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

# Code quality checks
npm run lint              # Run ESLint to check code quality
npm run lint:check        # Run ESLint with zero warnings tolerance 
npm run lint:fix          # Automatically fix ESLint issues where possible

# Testing Commands
npm run launch-chrome               # Launch Chrome with extension for manual testing
open -a Simulator                  # Open iOS Simulator
xcrun simctl boot "iPhone-Test-1"  # Boot iOS simulator
xcrun simctl install "iPhone-Test-1" "/Users/posix4e/Library/Developer/Xcode/DerivedData/bar123-*/Build/Products/Debug-iphonesimulator/bar123.app"  # Install iOS app
xcrun simctl launch "iPhone-Test-1" xyz.foo.bar123  # Launch iOS app
```

## Testing the New iOS App Features

### Current Test Setup (Branch: unify-javascript-codebase)
The iOS app now has dual-mode functionality:

1. **Setup View**: Shows when no shared secret is detected
   - Displays setup instructions for Safari extension
   - "Check Again" button to retry password detection
   - Polls every 5 seconds for password changes

2. **Live P2P Viewer**: Auto-activates when shared secret is found
   - Read-only history viewer (like GitHub Pages showcase)
   - Connection status and peer count display
   - Real-time history feed with iOS-native styling

### Test Flow
1. **Build and launch iOS app**: Shows setup instructions initially
2. **Launch Chrome extension**: `npm run launch-chrome`
3. **Connect Chrome extension**: Enter shared secret (e.g. "test123") and connect
4. **Test password detection**: iOS app should detect and switch to viewer mode
5. **Test Safari extension**: Enable in iOS Safari and connect with same secret
6. **Test P2P sync**: Browse pages, verify history sync between devices

### Current Limitations (Need Implementation)
- Password detection only checks localStorage (needs Safari extension integration)
- Trystero not bundled in iOS app yet (currently simulated)
- Shared storage between Safari extension and iOS app not implemented
```

## Architecture Overview

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

### Build System
- **Trystero Bundling**: `npm run build-trystero-bundle` creates IIFE bundle for both platforms
- **Asset Copying**: Shared images and resources copied between platform directories
- **Cross-Platform**: Single build command supports both Safari and Chrome outputs

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

## Testing Strategy

### Integration Tests
- `test/cross-platform-sync-test.js`: End-to-end sync testing across platforms
- `test/local-multiplatform-test.js`: Local testing with multiple instances
- Playwright and Puppeteer for browser automation

### Local Development Testing
1. `npm run dev` starts test server on port 8081
2. Build extension and install in browser(s)
3. Use same room secret across instances
4. Browse real websites to test sync functionality

### iOS Testing Requirements
- Xcode project must be opened and built (`npm run xcode`)
- Extension must be enabled in Safari Settings
- Real device testing recommended for production validation

## CI/CD Pipeline Commands

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
npm run ci:generate-showcase  # Generate showcase documentation
```

## Current Branch Context

The current branch `replace-peerjs-with-trystero` represents the migration from PeerJS to Trystero for improved reliability and performance. Key changes include:
- Trystero bundle integration replacing PeerJS
- Updated build process for cross-platform support
- Enhanced Chrome MV3 compatibility with offscreen documents
- Improved connection reliability and debugging capabilities