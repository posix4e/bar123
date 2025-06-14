# bar123 Chrome Extension

A Chrome extension that syncs your browsing history to Pantry cloud storage with end-to-end encryption.

## Features

- Captures Chrome browsing history in real-time
- Encrypts history data before syncing to Pantry
- Compatible with Safari extension using the same Pantry backend
- Displays device type (Chrome Browser) in synced history
- Search synced history across all devices
- Configurable sync intervals

## Installation

### Developer Mode Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `bar123 Chrome Extension` directory
5. The extension icon should appear in your toolbar

## Configuration

1. Click the extension icon in Chrome toolbar
2. Enter your Pantry ID (same as used in Safari extension)
3. Configure basket name (default: `browserHistory`)
4. Set sync interval (5 minutes to 24 hours)
5. Enable sync

## Testing

1. Browse to several websites in Chrome
2. Click the extension icon
3. Check "Pending Items" count increases
4. Click "Sync Now" to manually sync
5. Search for synced history using the search box
6. Device type should show as "Chrome Browser"

## Compatibility

- Works with the same Pantry backend as Safari extension
- History items include device type for identification
- Encrypted using AES-GCM for security

## Development

To modify the extension:

1. Edit files in this directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Privacy

- All history data is encrypted before leaving your device
- Only you have access to your encryption key (derived from Pantry ID)
- No third parties can read your browsing history