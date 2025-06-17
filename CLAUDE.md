# Claude Development Guide for bar123

This guide helps Claude (AI assistant) understand the bar123 project structure and development practices.

## Project Overview

bar123 is an iOS Safari extension that tracks browsing history and syncs it across devices using Pantry cloud storage. The project consists of a main iOS app and a Safari web extension that work together through a shared Core Data container.

## Key Technical Details

### Architecture
- **Main App**: SwiftUI/UIKit hybrid with integrated history view in ViewController.swift
- **Extension**: Safari Web Extension with native Swift handler for Core Data access
- **Storage**: Core Data with app group sharing (group.xyz.foo.bar123)
- **Sync**: Pantry API integration for cross-device synchronization

### Important Files
- `ViewController.swift`: Main UI with history table view and sync controls
- `SyncManager.swift`: Handles all Pantry API operations and sync logic
- `DataManager.swift`: Core Data stack and CRUD operations
- `SafariWebExtensionHandler.swift`: Processes messages from JavaScript extension

### Build Configuration
- **Xcode Version**: 15.2+ (project uses objectVersion 70)
- **iOS Deployment Target**: 15.0
- **Swift Version**: 5.0
- **Code Signing**: Automatic with team ID 2858MX5336

## Common Tasks

### Running the Project
```bash
# Open in Xcode
open bar123.xcodeproj

# Build from command line
xcodebuild -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15' build

# Run tests
xcodebuild test -project bar123.xcodeproj -scheme bar123 -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Debugging Issues

1. **App Crashes**: Usually related to storyboard loading or Core Data initialization
   - Check Info.plist for proper storyboard configuration
   - Verify Core Data model is included in both targets

2. **Extension Not Working**: Safari extensions require proper entitlements
   - Verify app groups are configured correctly
   - Check extension is enabled in Safari settings

3. **Sync Failures**: Related to Pantry configuration or network issues
   - Check UserDefaults for pantryID and basketName
   - Verify network requests in SyncManager

### Code Style Guidelines

- Use async/await for asynchronous operations
- Wrap UIKit calls in MainActor.run when needed
- Follow Swift naming conventions (camelCase for variables, PascalCase for types)
- Keep sync logic centralized in SyncManager
- Use meaningful commit messages with clear descriptions

### Testing Approach

1. **UI Tests**: Located in bar123UITests/
   - Test browsing history display
   - Verify sync functionality
   - Check Safari extension integration

2. **Manual Testing**:
   - Install app on simulator
   - Enable Safari extension
   - Browse websites and verify history capture
   - Test sync between multiple simulators

### Project Structure
```
bar123/
├── bar123/                          # Main app target
│   ├── Base.lproj/                 # Storyboards
│   │   ├── Main.storyboard         # Main UI
│   │   └── LaunchScreen.storyboard # Launch screen
│   ├── Assets.xcassets/            # Image assets
│   ├── AppDelegate.swift           # App lifecycle
│   ├── SceneDelegate.swift         # Scene lifecycle
│   ├── ViewController.swift        # Main view controller
│   ├── SyncManager.swift           # Pantry sync logic
│   ├── DataManager.swift           # Core Data operations
│   └── HistoryDataModel.xcdatamodeld # Core Data model
├── bar123 Extension/               # Safari extension target
│   ├── SafariWebExtensionHandler.swift # Native handler
│   ├── Resources/                  # Web extension files
│   │   ├── manifest.json          # Extension manifest
│   │   ├── background.js          # Background script
│   │   ├── content.js             # Content script
│   │   ├── popup.html/css/js      # Popup UI
│   │   └── images/                # Extension icons
│   └── Info.plist                 # Extension configuration
└── bar123UITests/                  # UI test target
    └── bar123UITests.swift         # UI test cases
```

### Sync Architecture

1. **Local Storage**: Core Data stores HistoryItem entities
2. **Sync Process**:
   - Fetch unsynced items (syncedToPantry == false)
   - POST to Pantry API
   - Mark items as synced on success
   - Fetch remote changes and merge

3. **Conflict Resolution**: Last-write-wins based on timestamp

### API Integration

Pantry API endpoints:
- Base URL: `https://getpantry.cloud/apiv1/pantry/{pantryID}`
- Create/Update: `PUT /basket/{basketName}`
- Fetch: `GET /basket/{basketName}`

### Security Considerations

- App Group: `group.xyz.foo.bar123` for data sharing
- Entitlements: Both app and extension must have app group entitlement
- No sensitive data in UserDefaults
- HTTPS only for API communication

### Deployment Checklist

Before pushing changes:
1. Run all tests
2. Verify app builds for both simulator and device
3. Test Safari extension functionality
4. Check for any hardcoded values
5. Update version numbers if needed
6. Ensure no debugging code remains

### Troubleshooting Commands

```bash
# Clean build
rm -rf ~/Library/Developer/Xcode/DerivedData/bar123-*

# Reset simulator
xcrun simctl erase all

# Check crash logs
ls ~/Library/Logs/DiagnosticReports/ | grep bar123

# Verify app installation
xcrun simctl get_app_container booted xyz.foo.bar123
```

## Chrome Extension

The project now includes a Chrome extension for cross-platform sync:

### Chrome Extension Structure
```
chrome-extension/
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service worker for history tracking
├── content.js             # Content script for page metadata
├── popup.html/css/js      # Extension UI
└── icons/                 # Extension icons
```

### Testing

#### E2E Tests with Playwright
```bash
# Install dependencies
npm install

# Set up environment
echo "PANTRYID=your-test-pantry-id" > .env

# Run tests locally
npm test

# Run tests in CI mode
npm run test:ci
```

#### GitHub Actions
The project uses GitHub Actions for CI/CD:

1. **iOS Build**: Runs on macOS-13 with Xcode 15.2
2. **Chrome Extension Tests**: Runs on Ubuntu with Playwright

Required GitHub Secrets:
- `PANTRYID`: Pantry ID for E2E tests

Workflow triggers on:
- Push to: main, sync-logic-to-swift, chrome-extension-support
- Pull requests to: main

### Chrome Extension Development

#### Loading the Extension
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `chrome-extension` directory

#### Key Features
- Manifest V3 with service workers
- Automatic history capture (via Chrome History API and content scripts)
- 5-minute sync intervals
- Badge with unsynced count
- Cross-platform sync with iOS app

#### Known Limitations
- Chrome History API events don't fire in Playwright automation tests
- Manual history capture via Chrome API works correctly
- Content scripts provide fallback page capture mechanism

## Notes for Future Development

- Consider adding iCloud sync as alternative to Pantry
- Implement data export functionality
- Add search and filtering for history items
- Consider adding favorite/bookmark functionality
- Optimize Core Data queries for large datasets
- Add proper error handling UI for sync failures
- Create automated release process for Chrome Web Store
- Add Firefox extension support