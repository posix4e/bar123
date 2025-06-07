# bar123 - P2P Browser History Sync

A Safari extension that synchronizes browser history across multiple devices using peer-to-peer technology.

## Features

- 🔒 **Secure P2P Sync**: Uses a shared secret to encrypt and sync browser history
- 🌐 **Local Network Discovery**: Automatically finds other devices on your network
- 📱 **Safari Extension**: Seamlessly integrates with Safari on iOS
- 🔐 **End-to-End Encryption**: All data is encrypted using AES-GCM
- 📊 **Cross-Device Search**: Search history from all your synced devices
- 🔄 **Background Sync**: Automatically syncs in the background

## Architecture

The app consists of three main components:

1. **Safari Extension**: Captures browsing history from Safari
2. **Main App**: Manages P2P sync and provides search interface
3. **P2P Manager**: Handles peer discovery and data transfer

## Setup

### Requirements

- iOS 15.0+
- Xcode 15+
- Swift 5.9+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bar123.git
cd bar123
```

2. Open in Xcode:
```bash
open bar123.xcodeproj
```

3. Build and run on your device or simulator

### Configuration

1. Launch the app on all devices you want to sync
2. Enter the same shared secret on all devices
3. Enable the Safari extension in Settings > Safari > Extensions
4. Start browsing - your history will sync automatically!

## How It Works

### P2P Synchronization

The app uses local network discovery (Bonjour) to find other devices running bar123 with the same shared secret. Once connected, devices exchange encrypted history data directly without any server.

### Security

- **Shared Secret**: Used to derive encryption keys and authenticate peers
- **AES-GCM Encryption**: All data is encrypted before transmission
- **HMAC Authentication**: Peers verify each other using HMAC signatures

### Data Flow

1. Safari visits a webpage
2. Extension captures URL and title
3. Data is stored locally and broadcasted to peers
4. Peers receive and merge history data
5. All devices maintain a synchronized history

## Development

### Project Structure

```
bar123/
├── bar123/                    # Main iOS app
│   ├── TorrentManager.swift   # Core sync logic
│   ├── LegacyP2PManager.swift # P2P networking
│   └── BackgroundSync*.swift  # Background task management
├── bar123 Extension/          # Safari extension
│   ├── SafariWebExtensionHandler.swift
│   └── Resources/
│       ├── background.js      # Extension background script
│       ├── content.js         # Page tracking
│       └── popup.js           # Extension popup
└── bar123Tests/               # Unit tests
```

### Building

```bash
xcodebuild -project bar123.xcodeproj -scheme bar123 -sdk iphonesimulator build
```

### Testing

```bash
xcodebuild -project bar123.xcodeproj -scheme bar123 -sdk iphonesimulator test
```

## Future Improvements

- [ ] Real libtorrent integration for true P2P sync
- [ ] WebRTC support for NAT traversal
- [ ] iCloud Keychain integration for shared secret
- [ ] macOS Safari extension support
- [ ] Selective sync and filtering options
- [ ] Export/import history data

## Troubleshooting

### Devices not discovering each other

1. Ensure all devices are on the same network
2. Check that local network permission is granted
3. Verify the same shared secret is used
4. Try restarting the app on all devices

### History not syncing

1. Check that the Safari extension is enabled
2. Ensure background app refresh is enabled
3. Verify network connectivity
4. Check logs in Xcode console

## Privacy

This app prioritizes your privacy:
- No data leaves your local network
- All communication is encrypted
- No analytics or tracking
- No cloud servers involved

## License

MIT License - see LICENSE file for details

## Contributing

Pull requests are welcome! Please read CONTRIBUTING.md for guidelines.

## Acknowledgments

- Uses Apple's Network framework for P2P communication
- Inspired by decentralized sync solutions
- Built with privacy-first principles