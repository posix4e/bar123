# bar123

A Safari extension for iOS that tracks your browsing history and syncs it across devices using Pantry cloud storage.

## Features

- 📱 Native iOS app with integrated browsing history view
- 🔄 Real-time sync across multiple devices
- 🌐 Safari extension that automatically captures browsing data
- ☁️ Cloud storage via Pantry API
- 🔒 Secure app group sharing between app and extension
- 📊 Clean, modern UI showing recent browsing history

## Requirements

- iOS 15.0+
- Xcode 15.2+
- Safari with extensions enabled

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/posix4e/bar123.git
   cd bar123
   ```

2. Open the project in Xcode:
   ```bash
   open bar123.xcodeproj
   ```

3. Build and run the app on your device or simulator

4. Enable the Safari extension:
   - Open Settings on your iOS device
   - Navigate to Safari > Extensions
   - Enable the bar123 extension

## Configuration

The app uses Pantry for cloud sync. To configure:

1. Open the bar123 app
2. Go to Settings (in iOS Settings app)
3. Enter your Pantry ID and basket name
4. The app will automatically start syncing

Default configuration:
- Pantry ID: Can be obtained from [Pantry](https://getpantry.cloud)
- Basket Name: `browser-history`

## Project Structure

```
bar123/
├── bar123/                    # Main iOS app
│   ├── AppDelegate.swift      # App lifecycle management
│   ├── SceneDelegate.swift    # Scene lifecycle management
│   ├── ViewController.swift   # Main UI with integrated history view
│   ├── SyncManager.swift      # Handles Pantry sync operations
│   ├── DataManager.swift      # Core Data operations
│   └── HistoryDataModel.xcdatamodeld  # Core Data model
├── bar123 Extension/          # Safari web extension
│   ├── SafariWebExtensionHandler.swift  # Native message handling
│   └── Resources/             # Web extension files
│       ├── manifest.json      # Extension manifest
│       ├── background.js      # Background script
│       ├── content.js         # Content script
│       └── popup.html/css/js  # Extension popup UI
└── bar123.xcodeproj/          # Xcode project file
```

## How It Works

1. **Safari Extension**: Captures browsing data (URL, title, timestamp) when you visit websites
2. **Core Data**: Stores history locally using a shared app group container
3. **Sync Manager**: Periodically syncs local data with Pantry cloud storage
4. **Main App**: Displays synchronized browsing history from all your devices

## Development

### Building

```bash
xcodebuild -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15' build
```

### Testing

```bash
xcodebuild test -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Code Style

The project uses Swift 5.0 and follows standard Swift conventions. Key patterns:
- MVVM architecture for the main app
- Core Data for local persistence
- URLSession for network requests
- Async/await for asynchronous operations

## Troubleshooting

### App crashes on launch
- Ensure you're using Xcode 15.2 or later
- Clean build folder: `Product > Clean Build Folder`
- Delete derived data and rebuild

### Extension not capturing history
- Verify the extension is enabled in Safari settings
- Check that the app group is properly configured
- Ensure Core Data container is accessible

### Sync not working
- Verify Pantry credentials in Settings
- Check network connectivity
- Look for sync status in the main app UI

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- [Pantry](https://getpantry.cloud) for providing free JSON storage
- Safari Web Extensions documentation
- Core Data framework for local persistence