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
- `test/local-multiplatform-test.js`: Local testing with multiple instances using Playwright
- Real browser automation with Chrome extension loading and iOS Safari simulation
- Screenshot capture for visual verification

### Local Development Testing
1. `npm run dev` starts test server on port 8081
2. Build extension and install in browser(s)
3. Use same room secret across instances
4. Browse real websites to test sync functionality

### iOS Testing Requirements
- Xcode project must be opened and built (`npm run xcode`)
- Extension must be enabled in Safari Settings
- Real device testing recommended for production validation

### Test Artifact Requirements
- Tests generate screenshots for showcase page verification
- Showcase generation fails if no screenshots available (ensures real testing)
- Screenshots copied to GitHub Pages for live demonstration

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
npm run ci:generate-showcase  # Generate showcase documentation with live P2P demo
```

## Branch & Release Strategy

### Branch Workflow
- **Feature PRs** → Build + test, no uploads or deployments
- **`main` branch** → TestFlight uploads for development/beta testing
- **`test-testflight`** → TestFlight testing branch for isolated uploads
- **`test-pages`** → GitHub Pages testing branch for showcase development
- **Git releases/tags** → Production release assets with versioned downloads

### Release Types
- **Development builds** → Every merge to `main` uploads to TestFlight
- **Production releases** → Manual git tags (v1.0.0) create versioned assets
- **Testing isolation** → Special branches for testing CI components without affecting main workflow

## GitHub Pages Showcase

The showcase page generated by `ci:generate-showcase` includes:
- **Live P2P Demo**: Interactive Trystero connection using visitor's shared secret
- **Real Test Screenshots**: Actual Playwright screenshots from CI test runs
- **Build Artifacts**: Direct download links to Chrome extension ZIP and iOS IPA
- **Test Results**: Complete debug information and test status from CI runs
- **No Placeholder Content**: Page generation fails if real artifacts don't exist

## Current Project State

Project has migrated from PeerJS to Trystero with complete BrowserStack removal. Current architecture:
- Trystero bundle integration for improved P2P reliability
- Cross-platform build process supporting both Safari iOS and Chrome
- Enhanced Chrome MV3 compatibility with offscreen documents  
- Local multiplatform testing with Playwright browser automation
- Real-time GitHub Pages demo using same P2P protocol as extensions