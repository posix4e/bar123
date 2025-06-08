# bar123 - P2P WebRTC History Sync System

## Project Overview
bar123 is a privacy-focused, peer-to-peer browsing history synchronization system that enables users to sync their browsing history across different devices and browsers without relying on centralized cloud storage. The system uses WebRTC for direct peer-to-peer connections and a minimal signaling server for connection establishment.

## Architecture

### Components
1. **Signaling Server** (`signaling-server/`)
   - Node.js WebSocket server for WebRTC connection orchestration
   - HMAC-SHA256 authentication for all messages
   - Room-based peer management
   - No history data passes through the server

2. **Chrome Extension** (`chrome-extension/`)
   - Browser extension for Chrome/Chromium browsers
   - Tracks browsing history via Chrome History API
   - WebRTC implementation using browser APIs
   - Popup UI for configuration and search

3. **Safari Extension** (`bar123 Extension/`)
   - iOS Safari Web Extension
   - Native Swift implementation with WebRTC framework
   - Bridges JavaScript and native iOS code
   - Integrated with iOS app

4. **iOS Native App** (`bar123/`)
   - Standalone iOS application
   - Full-featured history browsing and management UI
   - Shares WebRTC infrastructure with Safari Extension
   - Device management and settings

### Technology Stack
- **WebRTC**: Peer-to-peer data channels
- **WebSocket**: Signaling server communication
- **HMAC-SHA256**: Message authentication
- **Swift/UIKit**: iOS development
- **JavaScript**: Chrome extension and Safari web extension
- **Node.js**: Signaling server
- **STUN**: NAT traversal (Google's public STUN servers)

## Key Features

### Security & Privacy
- End-to-end encryption via WebRTC DTLS
- Pre-shared secret authentication
- No cloud storage - data stays on user devices
- HMAC verification on all signaling messages
- Peer-to-peer architecture

### Synchronization
- Real-time history updates
- Full sync for new devices
- Incremental updates for connected peers
- Timestamp-based conflict resolution
- Offline support with local storage

### Cross-Platform Support
- Chrome/Chromium browsers via extension
- iOS Safari via web extension
- Native iOS app for full functionality
- Shared codebase where possible

## Data Flow

### Connection Establishment
1. Devices authenticate with pre-shared secret
2. Join room on signaling server
3. Exchange WebRTC offers/answers
4. Share ICE candidates for NAT traversal
5. Establish direct P2P connection

### Sync Protocol
Message types exchanged over WebRTC data channels:
- `device_info`: Device metadata exchange
- `full_sync`: Complete history transfer
- `incremental_update`: Real-time updates
- `sync_request`: Request sync from peer

## Development Guidelines

### Code Organization
- Shared WebRTC logic between Safari Extension and iOS app
- Protocol definitions in respective platform code
- UI code separated by platform
- Signaling server kept minimal and stateless

### Testing
- Test WebRTC connections across platforms
- Verify HMAC authentication
- Check sync conflict resolution
- Test offline/online transitions
- Validate history data integrity

### Building & Running

#### Signaling Server
```bash
cd signaling-server
npm install
npm start
```

#### Chrome Extension
```bash
cd chrome-extension
npm install
# Load unpacked extension in Chrome
```

#### iOS App & Safari Extension
- Open `bar123.xcodeproj` in Xcode
- Build and run on simulator or device
- Safari Extension requires developer settings enabled

### Configuration
- Set `SIGNALING_SERVER_URL` in each component
- Configure `PRE_SHARED_SECRET` consistently
- Adjust STUN server list if needed

## Important Considerations

### Performance
- Limit history sync batch sizes
- Implement pagination for large histories
- Monitor WebRTC connection quality
- Handle network transitions gracefully

### Compatibility
- WebRTC API differences between platforms
- Safari Extension API limitations
- Chrome Extension Manifest V3 requirements
- iOS background execution limits

### Future Enhancements
- [ ] End-to-end encryption layer
- [ ] Multiple room support
- [ ] Bookmark synchronization
- [ ] Password/form data sync (with extra encryption)
- [ ] Desktop Safari support
- [ ] Firefox extension
- [ ] Android app

## Troubleshooting

### Common Issues
1. **Connection failures**: Check firewall/NAT settings
2. **Auth errors**: Verify pre-shared secret matches
3. **Sync conflicts**: Check device time synchronization
4. **Missing history**: Ensure proper permissions granted

### Debug Tools
- Chrome DevTools for extension debugging
- Safari Web Inspector for Safari Extension
- Xcode debugger for iOS app
- Server logs for signaling issues

## Security Notes
- Never commit pre-shared secrets
- Use secure WebSocket (wss://) in production
- Regularly update WebRTC dependencies
- Consider additional encryption for sensitive data
- Implement rate limiting on signaling server

## Maintenance
- Keep WebRTC framework updated
- Monitor for Chrome Extension API changes
- Test across iOS versions
- Update STUN server list periodically
- Review security best practices