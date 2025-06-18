# bar123 Chrome Extension

This is the Chrome extension version of bar123 that syncs browsing history with the iOS app.

## Installation

### From Source (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` directory from this repository

### From Chrome Web Store

(Coming soon)

## Configuration

1. Click the bar123 extension icon in Chrome
2. Enter your Pantry ID (get one from https://getpantry.cloud)
3. Set the basket name (default: `browser-history`)
4. Enable Auto Sync
5. Click "Save Settings"

## Features

- Automatically captures browsing history
- Syncs with Pantry cloud storage every 5 minutes
- Shows badge with unsynced item count
- Manual sync option available
- Compatible with iOS app for cross-device sync

## Privacy

The extension only accesses:
- Your browsing history (to sync it)
- Storage permissions (to save settings)
- Pantry API (for cloud sync)

No data is sent anywhere except your personal Pantry basket.

## Development

### Building for Production

1. Remove any development files
2. Zip the extension directory:
   ```bash
   zip -r bar123-chrome.zip chrome-extension/
   ```
3. Upload to Chrome Web Store

### Testing

1. Load the extension in developer mode
2. Browse some websites
3. Check the popup to see history items
4. Verify sync works with your Pantry basket

## Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers