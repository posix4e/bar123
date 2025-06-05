# End-to-End Interoperability Tests

This directory contains real UI tests for the bar123 extensions using Playwright (for Chrome) and XCTest (for iOS Safari).

## Test Structure

### 1. JavaScript to JavaScript (`js-js/`)
- **Tool**: Playwright
- **Tests**: Chrome extension to Chrome extension sync
- **Features**:
  - Multi-browser instance testing
  - Real extension popup interaction
  - History sync verification
  - Connection resilience testing

### 2. Swift to Swift (`swift-swift/`)
- **Tool**: XCTest UI Tests
- **Tests**: Safari iOS to Safari iOS sync
- **Features**:
  - Multi-device simulation
  - Safari extension interaction
  - Room management
  - Peer discovery testing

### 3. Cross-Platform (`swift-js/`)
- **Tool**: Playwright + XCTest coordination
- **Tests**: Safari iOS to Chrome extension sync
- **Features**:
  - Cross-platform peer discovery
  - Bidirectional sync
  - Article content extraction
  - Connection recovery

## Running Tests

### All Tests
```bash
npm run test:interop
```

### Individual Test Suites
```bash
# Chrome to Chrome only
npm run test:js-js

# Safari to Safari only (requires macOS/Xcode)
npm run test:swift-swift

# Cross-platform only (requires macOS/Xcode)
npm run test:swift-js
```

### With Visual Mode (see browsers)
```bash
npx playwright test --headed
```

## Test Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Chrome Ext 1   │     │  Chrome Ext 2   │
│  (Playwright)   │<--->│  (Playwright)   │
└─────────────────┘     └─────────────────┘
        │                        │
        └──── libp2p P2P ────────┘

┌─────────────────┐     ┌─────────────────┐
│ Safari iOS 1    │     │ Safari iOS 2    │
│   (XCTest)      │<--->│   (XCTest)      │
└─────────────────┘     └─────────────────┘
        │                        │
        └─── Rust FFI P2P ───────┘

┌─────────────────┐     ┌─────────────────┐
│   Chrome Ext    │     │  Safari iOS     │
│  (Playwright)   │<--->│   (XCTest)      │
└─────────────────┘     └─────────────────┘
        │                        │
        └── Cross-Platform P2P ──┘
```

## Key Test Scenarios

1. **Basic Sync**: Verify history syncs between instances
2. **Bidirectional**: Both sides can send and receive
3. **Resilience**: Handle disconnections and reconnections
4. **Article Content**: Readability.js extracted content syncs
5. **Multi-Peer**: Support for multiple connected devices
6. **Performance**: Sync speed and resource usage

## CI/CD Integration

These tests run automatically on:
- Pull requests to main
- Pushes to main/develop branches
- Release builds

The GitHub Actions workflow handles:
- Building extensions
- Running Playwright tests
- Running XCTest on macOS runners
- Collecting test artifacts (screenshots, videos)

## Debugging Failed Tests

1. **Screenshots**: Check `test-results/` for failure screenshots
2. **Videos**: Playwright records videos on failure
3. **Traces**: Use `npx playwright show-trace` to debug
4. **Logs**: Check console output in test results

## Requirements

- Node.js 20+
- Chrome/Chromium for Playwright tests
- macOS with Xcode 15+ for Swift tests
- iOS Simulator for Safari tests