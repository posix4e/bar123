# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bar123 is a Safari iOS extension that enables real-time history synchronization across devices using P2P technology. The project has migrated from PeerJS → Rust libp2p and supports both Safari iOS extensions and Chrome extensions. The new architecture uses Rust libp2p via FFI for P2P networking, with the sync logic handled natively in Swift for iOS.

## Essential Development Commands

```bash
# Install dependencies and build the extension (now builds Rust libp2p FFI)
npm install
npm run build

# Development workflow (build + test server)
npm run dev

# Open Xcode with built extension for iOS development  
npm run xcode

# Build Chrome extension specifically
npm run build-chrome

# Build just the Rust libp2p FFI library
npm run build-libp2p

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

# Code quality and linting
npm run lint                   # Check code style and quality
npm run lint:fix               # Auto-fix linting issues
npm run lint:check             # Check with zero warnings tolerance
```

## Architecture Overview

### Multi-Platform Extension Architecture
- **Safari Extension**: Uses `bar123 Extension/Resources/` with Swift native P2P networking
- **Chrome Extension**: Uses `chrome-extension/` with service worker architecture and native messaging
- **Rust libp2p Core**: Both platforms now use Rust libp2p via FFI for P2P networking
- **Native Swift Logic**: History sync logic moved to Swift SafariWebExtensionHandler for iOS

### P2P Connection System
- **Rust libp2p FFI**: Native Rust libp2p implementation with C FFI bindings for Swift
- **Swift Wrapper**: LibP2PWrapper.swift provides Swift interface to Rust library
- **Room-Based Connections**: Devices join rooms using shared secrets (hashed for security)
- **Gossipsub Protocol**: Uses libp2p gossipsub for efficient message broadcasting
- **mDNS Discovery**: Local peer discovery via multicast DNS
- **Device Identification**: Persistent device IDs for reconnection handling

### Core Components
1. **SafariWebExtensionHandler** (`SafariWebExtensionHandler.swift`): Native Swift P2P networking and history sync logic
2. **LibP2PWrapper** (`LibP2PWrapper.swift`): Swift wrapper for Rust libp2p FFI library
3. **Rust libp2p FFI** (`libp2p-ffi/`): Core P2P networking library with C bindings
4. **Background Service** (`background.js`): JavaScript interface that delegates to native Swift layer
5. **Content Script** (`content.js`): Tracks page visits, extracts article content using Readability.js
6. **Popup Interface** (`popup.html/js/css`): Room configuration, connection status, and article search

### Article Content Extraction
- **Readability.js Integration**: Mozilla Readability.js extracts clean article content from web pages
- **Content Analysis**: Identifies articles vs. regular pages based on content length and structure
- **Reading Time Calculation**: Estimates reading time at ~200 words per minute
- **Search Interface**: Search through article titles, content, and excerpts via popup interface

### Build System
- **Rust libp2p Compilation**: `npm run build-libp2p` compiles Rust FFI library and copies to dist/
- **Readability Bundling**: `npm run build-readability-bundle` creates IIFE bundle for article extraction
- **Asset Copying**: Shared images and resources copied between platform directories
- **Cross-Platform**: Single build command supports both Safari and Chrome outputs
- **FFI Integration**: Build process generates C headers and dynamic library for Swift integration

## Platform Differences

### Safari Extension (iOS)
- Uses `manifest.json` with background scripts that delegate to native Swift
- Native P2P networking via Rust libp2p FFI in Swift
- Requires Xcode build process and iOS code signing
- Extension resources in `bar123 Extension/Resources/`
- Swift P2P logic in `SafariWebExtensionHandler.swift` and `LibP2PWrapper.swift`

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

## Article Search Functionality

### Using the Search Interface
The extension provides a search-focused interface for finding articles by content:

1. **Search Entry**: Type keywords in the search box to find relevant articles
2. **Content Matching**: Search looks through article titles, content, URLs, and excerpts
3. **Article Display**: Results show reading time, excerpts, and article badges
4. **Clean Interface**: No history dump by default - only shows search results

### Search Features
- **Real-time Search**: Type keywords to find articles containing those terms
- **Article Detection**: Only content identified as articles (>500 chars) gets special treatment
- **Reading Time**: Shows estimated reading time based on word count (~200 WPM)
- **Content Excerpts**: Preview first few sentences of extracted article content
- **Cross-Platform**: Same search interface works on both Safari iOS and Chrome extensions

### Testing Article Extraction
```bash
# Build extension with article extraction
npm run build

# Test on various content types
# - News articles (should show article badge + reading time)
# - Blog posts (should extract clean content)
# - Social media (may not trigger article detection)
# - Documentation pages (depends on structure)
```

## Current Branch Context

The current branch focuses on smart history search with article content extraction:
- Readability.js integration for clean article content extraction
- Search-focused popup interface for both Safari and Chrome extensions  
- Enhanced history entries with reading time and content excerpts
- Cross-platform article search functionality