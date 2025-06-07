# Libtorrent Integration Guide

This document explains how to integrate libtorrent-rasterbar into the bar123 Safari extension for real P2P synchronization.

## Overview

The current implementation uses a mock `LibtorrentBridge` protocol. To enable actual P2P synchronization, you need to:

1. Add libtorrent-rasterbar C++ library to the project
2. Create Swift-C++ bridging
3. Implement the `LibtorrentBridge` protocol with real libtorrent calls

## Architecture

### Current Mock Implementation
- `LibtorrentBridge.swift` - Protocol defining required operations
- `MockLibtorrentBridge` - Placeholder implementation that logs operations
- `TorrentManager.swift` - Uses bridge for all P2P operations

### Required Components for Real Implementation

#### 1. Libtorrent Session Management
```swift
class LibtorrentSession {
    // Initialize libtorrent::session
    // Configure settings (DHT, encryption, etc.)
    // Manage torrent handles
}
```

#### 2. DHT Operations
- Bootstrap DHT with well-known nodes
- Announce info_hash derived from shared secret
- Search for peers with same info_hash
- Handle peer discovery callbacks

#### 3. Torrent Creation
- Create torrent from encrypted history data
- Set piece size appropriately (16KB recommended)
- Generate bencode torrent file
- Start seeding immediately

#### 4. Peer Communication
- Connect to discovered peers
- Exchange torrent metadata
- Download history data from peers
- Merge downloaded history with local

## Implementation Steps

### Step 1: Add Libtorrent Dependencies

1. Build libtorrent-rasterbar for iOS:
   ```bash
   # Clone libtorrent
   git clone https://github.com/arvidn/libtorrent.git
   cd libtorrent
   
   # Build for iOS using cmake
   cmake -DCMAKE_TOOLCHAIN_FILE=ios.toolchain.cmake \
         -DPLATFORM=OS64 \
         -DENABLE_BITCODE=NO \
         -DBUILD_SHARED_LIBS=OFF \
         -Dstatic_runtime=ON
   ```

2. Create XCFramework for iOS targets

3. Add to Xcode project as embedded framework

### Step 2: Create Swift-C++ Bridge

Create `LibtorrentBridgeImpl.mm`:
```objc
#import "LibtorrentBridgeImpl.h"
#include <libtorrent/session.hpp>
#include <libtorrent/add_torrent_params.hpp>
#include <libtorrent/torrent_handle.hpp>
#include <libtorrent/alert_types.hpp>

@implementation LibtorrentBridgeImpl {
    std::unique_ptr<libtorrent::session> _session;
}

- (void)initializeSessionWithDownloadPath:(NSURL *)downloadPath 
                               uploadPath:(NSURL *)uploadPath {
    libtorrent::settings_pack settings;
    settings.set_bool(libtorrent::settings_pack::enable_dht, true);
    settings.set_int(libtorrent::settings_pack::alert_mask, 
                     libtorrent::alert::error_notification | 
                     libtorrent::alert::storage_notification |
                     libtorrent::alert::status_notification);
    
    _session = std::make_unique<libtorrent::session>(settings);
}

// Implement other protocol methods...
@end
```

### Step 3: Implement Protocol Methods

Key operations to implement:

1. **startDHT**: 
   - Add bootstrap nodes
   - Start DHT service
   - Wait for bootstrap completion

2. **announceDHT**:
   - Use session.dht_announce() with info_hash
   - Set port for incoming connections

3. **searchDHT**:
   - Use session.dht_get_peers() 
   - Handle peer discovery alerts
   - Return discovered peer information

4. **createTorrent**:
   - Use libtorrent::create_torrent
   - Add encrypted data as single file
   - Generate torrent file

5. **addTorrent**:
   - Create add_torrent_params
   - Set save path and torrent info
   - Return torrent_handle wrapper

### Step 4: Handle Asynchronous Operations

Libtorrent uses alerts for async operations. Create alert handler:

```swift
class AlertHandler {
    func processAlerts(_ session: LibtorrentSession) {
        // Pop alerts from session
        // Handle different alert types
        // Update UI/state accordingly
    }
}
```

### Step 5: Security Considerations

1. **Encryption**: All data is already encrypted with AES-GCM using shared secret
2. **Authentication**: Only peers with same info_hash (derived from secret) can connect
3. **Validation**: Verify decrypted data structure before merging

## Testing

1. Unit tests with mock torrent operations
2. Integration tests with local libtorrent instances
3. Network tests with multiple simulators
4. Performance tests with large history datasets

## Known Challenges

1. **iOS Restrictions**: 
   - Background networking limitations
   - App sandbox restrictions
   - Need proper entitlements

2. **Binary Size**: 
   - Libtorrent adds ~10MB to app size
   - Consider dynamic framework loading

3. **Battery Usage**:
   - Implement smart sync scheduling
   - Pause when on cellular/low battery

## Alternative Approaches

If full libtorrent integration proves difficult:

1. **WebRTC Data Channels**: Direct P2P without torrents
2. **MultipeerConnectivity**: Apple's P2P framework (local network only)
3. **Custom Protocol**: Simplified P2P over WebSockets
4. **Hybrid Approach**: Use server for discovery, P2P for data transfer

## Resources

- [libtorrent documentation](https://libtorrent.org/reference.html)
- [Swift-C++ Interop Guide](https://www.swift.org/documentation/cxx-interop/)
- [iOS Background Tasks](https://developer.apple.com/documentation/backgroundtasks)