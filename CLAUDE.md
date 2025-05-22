# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bar123 is a Safari web extension with an iOS companion app that enables cross-device browsing history synchronization via P2P connections. The project consists of two main components:

1. **Safari Web Extension** (`bar123 Extension/`) - Captures browsing history and provides a popup interface
2. **iOS Companion App** (`bar123/`) - Displays history and manages P2P sync settings in a WebKit view

## Build Commands

### Building the Project
```bash
# Build all targets (main app + extension)
xcodebuild -project bar123.xcodeproj -scheme bar123 -configuration Debug build

# Build for Release
xcodebuild -project bar123.xcodeproj -scheme bar123 -configuration Release build

# Build just the extension
xcodebuild -project bar123.xcodeproj -target "bar123 Extension" -configuration Debug build
```

### Running Tests
```bash
# Run unit tests
xcodebuild test -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15'

# Run UI tests
xcodebuild test -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:bar123UITests
```

### Opening in Xcode
```bash
open bar123.xcodeproj
```

## Architecture

### Data Flow
1. **Safari Extension** captures page visits via `content.js` and stores them via `background.js`
2. **SafariWebExtensionHandler.swift** receives messages from the extension and stores history in UserDefaults
3. **SharedDataManager.swift** manages Core Data persistence and syncs between UserDefaults and the Core Data store
4. **ViewController.swift** displays history in a WebKit view and handles P2P settings via JavaScript message handlers

### Key Components

#### Safari Extension (`bar123 Extension/`)
- `manifest.json` - Extension configuration with permissions for tabs, activeTab, storage
- `content.js` - Injected into web pages to capture navigation events
- `background.js` - Service worker that processes page visits
- `popup.js` - Extension popup interface with history display and P2P controls
- `SafariWebExtensionHandler.swift` - Native bridge between extension and iOS app

#### iOS App (`bar123/`)
- `ViewController.swift` - Main view controller with WebKit view and message handlers
- `SharedDataManager.swift` - Core Data manager with App Group container support
- `Main.html` - WebKit-based UI with P2P sync functionality using WebRTC
- `HistoryDataModel.xcdatamodeld` - Core Data model for persistent history storage

### Data Synchronization
- **Local Storage**: Extension uses browser storage, app uses UserDefaults + Core Data
- **P2P Sync**: WebRTC-based peer-to-peer synchronization with configurable discovery servers
- **App Group**: Shared container `group.xyz.foo.bar123` for data sharing between app and extension

### P2P Implementation
The P2P synchronization uses WebRTC data channels with:
- Discovery via WebSocket signaling servers (Google STUN, Twilio TURN, or custom)
- Shared secret authentication for peer discovery
- Real-time history broadcasting between connected devices
- Conflict resolution based on timestamps

## Development Notes

- Bundle identifiers: `xyz.foo.bar123` (app), `xyz.foo.bar123.Extension` (extension)
- Minimum iOS deployment target: 15.0
- Development team: 2858MX5336
- Uses Swift 5.0 and modern Xcode project format (objectVersion 77)
- WebKit message handlers: `getHistory`, `saveP2PSettings`, `loadP2PSettings`