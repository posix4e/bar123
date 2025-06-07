# Chrome Extension - History Sync

## Installation

1. Install dependencies:
   ```bash
   npm install
   npm run build
   ```

2. Create placeholder icons (or use your own):
   ```bash
   # Create simple placeholder icons
   echo "icon" > icon-16.png
   echo "icon" > icon-48.png
   echo "icon" > icon-128.png
   ```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` directory

## Usage

1. Click the extension icon in the toolbar
2. Go to Settings tab
3. Configure:
   - Signaling Server URL (default: ws://localhost:8080)
   - Room ID (default: history-sync-default)
   - Shared Secret (use Generate button or enter your own)
4. Click "Save & Connect"
5. The extension will automatically sync browsing history with connected devices

## Features

- Real-time P2P history synchronization
- Search across all synced devices
- View which device visited which sites
- Secure communication with HMAC authentication
- Works with iOS Safari Extension and native iOS app

## Security

- All signaling messages are authenticated with HMAC-SHA256
- Shared secret must be distributed out-of-band
- Data channels use WebRTC's built-in encryption
- No history data passes through the signaling server