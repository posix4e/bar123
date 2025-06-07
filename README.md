# P2P WebRTC History Sync System

A complete peer-to-peer browsing history synchronization system using WebRTC for direct connections and WebSocket signaling with HMAC authentication.

## Architecture Overview

### System Components

1. **Signaling Server (Node.js)**
   - WebSocket-based signaling for WebRTC connection establishment
   - HMAC-SHA256 authentication for all messages
   - Room-based peer management
   - No history data passes through the server

2. **iOS Safari Extension**
   - Tracks browsing history in Safari
   - WebRTC data channels for P2P sync
   - Native Swift implementation with Google's WebRTC framework
   - Full UI for search, device management, and settings

3. **Chrome Extension**
   - Standard WebRTC browser APIs
   - Automatic history tracking via Chrome APIs
   - Popup UI for search and configuration
   - Cross-platform compatibility

4. **iOS Native App**
   - Standalone app for history browsing
   - Reuses Safari Extension's sync infrastructure
   - Native UIKit interface

### Security Architecture

1. **Shared Secret**
   - Pre-shared secret distributed out-of-band
   - Used for HMAC-SHA256 message authentication
   - Never transmitted in plain text

2. **Message Authentication**
   - All signaling messages include HMAC
   - Messages without valid HMAC are rejected
   - Prevents unauthorized peers from joining

3. **WebRTC Security**
   - DTLS encryption for data channels
   - Direct peer-to-peer connections
   - No centralized data storage

### Data Flow

```
Device A                    Signaling Server                    Device B
    |                             |                                |
    |------ Join Room (HMAC) ---->|                                |
    |                             |<----- Join Room (HMAC) --------|
    |<---- Room Peers List -------|                                |
    |                             |------- Peer Joined ----------->|
    |                                                              |
    |------ Offer (via server) ---------------------------------->|
    |<----- Answer (via server) ----------------------------------|
    |------ ICE Candidates ------>|<------ ICE Candidates --------|
    |                                                              |
    |<============== WebRTC Data Channel (Direct P2P) ============>|
    |                                                              |
    |<------- History Sync Data (Direct, Encrypted) -------------->|
```

## Installation & Setup

### 1. Signaling Server

```bash
cd signaling-server
npm install
SHARED_SECRET=your-secret-here npm start
```

### 2. iOS Safari Extension

1. Open `bar123.xcodeproj` in Xcode
2. Add WebRTC framework dependency:
   - In Xcode, select the project in the navigator
   - Go to the "Package Dependencies" tab
   - Click the "+" button
   - Enter: `https://github.com/stasel/WebRTC.git`
   - Click "Add Package"
   - Select version: "Up to Next Major Version" from `120.0.0`
   - Click "Add Package"
   - Select "WebRTC" to add to your targets
3. Build and run on device/simulator
4. Enable the extension in Safari settings

### 3. Chrome Extension

1. Install dependencies:
```bash
cd chrome-extension
npm install
npm run build
```

2. Add placeholder icons or your own 16x16, 48x48, and 128x128 PNG icons

3. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` directory

### 4. iOS Native App

- Already included in the Xcode project
- Uses `HistorySyncViewController` as the main interface
- Shares WebRTC and sync code with Safari Extension

## Usage

### Initial Setup

1. **Generate a Shared Secret**
   - Use the "Generate" button in any app
   - Or create your own 32+ character secret
   - Share this secret securely with your other devices

2. **Configure Each Device**
   - Signaling Server URL: `ws://your-server:8080`
   - Room ID: Choose a unique room name
   - Shared Secret: Enter the same secret on all devices

3. **Connect**
   - Click "Save & Connect" on each device
   - Devices will automatically discover each other

### Features

#### History Search
- Search across all synced devices
- Filter by device
- Click entries to open in browser

#### Device Management
- View all connected and previously seen devices
- See connection status in real-time
- Filter history by specific device

#### Automatic Sync
- History syncs automatically when devices connect
- Real-time updates as you browse
- Conflict resolution based on timestamps

## Development

### Adding New Platforms

To add support for new platforms:

1. Implement WebRTC peer connections
2. Create data channel with label "history-sync"
3. Implement HMAC authentication for signaling
4. Follow the sync protocol (see below)

### Sync Protocol

Messages sent over data channels use JSON format:

```typescript
interface SyncMessage {
    type: 'device_info' | 'full_sync' | 'incremental_update' | 'sync_request';
    timestamp: string; // ISO 8601
    deviceId: string;
    data?: any;
}

interface HistoryEntry {
    id: string;
    url: string;
    title?: string;
    visitDate: string; // ISO 8601
    deviceId: string;
    deviceName: string;
}
```

### Testing

1. **Local Testing**
   - Run signaling server locally
   - Use `ws://localhost:8080` as server URL
   - Test with multiple browser profiles

2. **Network Testing**
   - Deploy signaling server to cloud
   - Use public STUN servers
   - Test across different networks

3. **Security Testing**
   - Verify HMAC validation
   - Test with invalid secrets
   - Monitor WebSocket traffic

## Troubleshooting

### Connection Issues
- Ensure all devices use the same shared secret
- Check firewall settings for WebSocket connections
- Verify STUN server accessibility

### Sync Issues
- Check browser console for errors
- Ensure history permissions are granted
- Verify data channel state in logs

### iOS Specific
- Enable Safari Extension in Settings
- Grant necessary permissions
- Check Xcode console for native logs

## Future Enhancements

1. **Encryption Layer**
   - Additional encryption using shared secret
   - End-to-end encrypted history data

2. **Selective Sync**
   - Choose which sites to sync
   - Privacy filters

3. **Backup & Restore**
   - Export history to encrypted file
   - Import from backup

4. **Advanced Search**
   - Full-text search
   - Date range filters
   - Regular expression support