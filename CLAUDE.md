# bar123 - P2P WebRTC History Sync System

## Project Overview
bar123 is a privacy-focused, peer-to-peer browsing history synchronization system that enables users to sync their browsing history across different devices and browsers without relying on centralized cloud storage. The system uses WebRTC for direct peer-to-peer connections and Cloudflare DNS for peer discovery.

## Architecture

### Components
1. **Chrome Extension** (`chrome-extension/`)
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
- **Cloudflare DNS**: Peer discovery via TXT records
- **Swift/UIKit**: iOS development
- **JavaScript**: Chrome extension and Safari web extension
- **STUN**: NAT traversal (Google's public STUN servers)

## Key Features

### Security & Privacy
- End-to-end encryption via WebRTC DTLS
- Room ID based peer discovery
- No cloud storage - data stays on user devices
- Cloudflare API token for DNS updates
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
1. Devices publish their peer info to Cloudflare DNS TXT records
2. Discover peers via DNS queries for room-specific records
3. Exchange WebRTC offers/answers via DNS TXT records
4. Share ICE candidates via DNS updates
5. Establish direct P2P connection

### Sync Protocol
Message types exchanged over WebRTC data channels:
- `device_info`: Device metadata exchange
- `full_sync`: Complete history transfer
- `incremental_update`: Real-time updates
- `sync_request`: Request sync from peer

## Development Guidelines

### Code Organization
- Shared WebRTC logic in Bar123Core Swift package
- Shared Cloudflare DNS discovery logic
- UI code separated by platform
- Minimal JavaScript for browser extensions

### Testing
- Test WebRTC connections across platforms
- Verify Cloudflare DNS discovery
- Check sync conflict resolution
- Test offline/online transitions
- Validate history data integrity

### Building & Running

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
- Set Cloudflare API credentials (API Token, Zone ID, Domain)
- Configure Room ID for peer grouping
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
2. **DNS errors**: Verify Cloudflare API token and permissions
3. **Sync conflicts**: Check device time synchronization
4. **Missing history**: Ensure proper permissions granted

### Debug Tools
- Chrome DevTools for extension debugging
- Safari Web Inspector for Safari Extension
- Xcode debugger for iOS app
- Swift CLI for testing sync and discovery

## Security Notes
- Never commit Cloudflare API tokens
- Use DNS over HTTPS when possible
- Regularly update WebRTC dependencies
- Consider additional encryption for sensitive data
- Monitor DNS record usage for abuse

## Maintenance
- Keep WebRTC framework updated
- Monitor for Chrome Extension API changes
- Test across iOS versions
- Update STUN server list periodically
- Review security best practices