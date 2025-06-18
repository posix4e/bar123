# Migration Guide: Moving Logic from JavaScript to Swift

This guide explains how to migrate from the JavaScript-heavy architecture to a Swift-centric design where JavaScript only handles browser APIs.

## Overview

### Before (JavaScript-heavy)
- **popup.js**: 773 lines handling all UI logic, state, and business logic
- **background.js**: 677 lines managing connections, discovery, and sync
- **discoveryInterface.js**: 596 lines of discovery logic
- **Total JS**: ~2500+ lines

### After (Swift-centric)
- **popup-minimal.js**: ~100 lines - only display and forward actions
- **background-minimal.js**: ~50 lines - only message routing
- **content-minimal.js**: ~20 lines - only capture visits
- **Total JS**: ~200 lines

## Architecture Changes

### JavaScript Side (Minimal)

1. **content-minimal.js**
   - Captures page visits
   - Sends to background script
   - No business logic

2. **background-minimal.js**
   - Routes messages between content/popup and native
   - Maintains cache of last 10 items for display
   - Updates browser badge
   - No connection management

3. **popup-minimal.js**
   - Displays last 10 history items from cache
   - Forwards all user actions to native
   - No state management
   - No discovery logic

### Swift Side (All Logic)

1. **SafariWebExtensionHandler-Enhanced.swift**
   - Handles all message types
   - Manages configuration
   - Controls connections
   - Performs searches
   - Tracks devices

2. **ConfigurationManager**
   - Stores all settings in UserDefaults
   - Shared between extension and app
   - Single source of truth

3. **ConnectionShareHelper**
   - Handles connection offer/response creation
   - Manages shareable formats
   - Parses connection data

## Migration Steps

### 1. Update manifest.json

```json
{
  "manifest_version": 2,
  "content_scripts": [{
    "js": ["content-minimal.js"],
    "matches": ["<all_urls>"]
  }],
  "background": {
    "scripts": ["background-minimal.js"],
    "persistent": false
  },
  "browser_action": {
    "default_popup": "popup-minimal.html"
  }
}
```

### 2. Replace JavaScript Files

```bash
# Backup old files
mv background.js background-old.js
mv popup.js popup-old.js
mv content.js content-old.js

# Use minimal versions
mv background-minimal.js background.js
mv popup-minimal.js popup.js
mv content-minimal.js content.js
mv popup-minimal.html popup.html
```

### 3. Update SafariWebExtensionHandler.swift

Replace the existing handler with SafariWebExtensionHandler-Enhanced.swift

### 4. Update Message Types

Old JavaScript messages:
```javascript
// Complex connection logic in JS
chrome.runtime.sendMessage({
    type: 'connect',
    config: {
        discoveryMethod: 'websocket',
        signalingServerUrl: '...',
        roomId: '...',
        sharedSecret: '...'
    }
});
```

New simplified messages:
```javascript
// Just forward to native
browser.runtime.sendMessage({
    type: 'connect'
});
// Native handles all config
```

## Benefits

### 1. Simplified JavaScript
- From 2500+ lines to ~200 lines
- Only browser-specific code remains
- No duplicate business logic

### 2. Better Performance
- Native Swift code is faster
- Less memory usage in extension
- Reduced JavaScript execution

### 3. Easier Maintenance
- Single source of truth in Swift
- Better type safety
- Easier to test

### 4. Consistent Behavior
- Same logic for app and extension
- No sync issues between platforms
- Unified configuration

## Message Flow Example

### Page Visit
```
1. User visits page
2. content.js captures URL/title
3. Sends to background.js
4. background.js adds to cache
5. Forwards to Swift handler
6. Swift stores in Core Data
7. Swift syncs with peers
```

### Search
```
1. User types in popup
2. popup.js sends search to background
3. background.js forwards to Swift
4. Swift searches Core Data
5. Returns results
6. popup.js displays results
```

### Connection
```
1. User clicks connect in popup
2. popup.js sends connect message
3. Swift reads config from UserDefaults
4. Swift initializes discovery
5. Swift manages WebRTC
6. Updates popup with status
```

## Testing the Migration

1. **Verify History Tracking**
   - Visit pages
   - Check popup shows last 10
   - Verify Swift stores all history

2. **Test Search**
   - Search from popup
   - Verify results from Swift
   - Check performance

3. **Test Connections**
   - Connect via each discovery method
   - Verify peer sync works
   - Check status updates

## Rollback Plan

If issues arise:
1. Keep old files backed up
2. Revert manifest.json
3. Restore original SafariWebExtensionHandler
4. Test thoroughly before removing backups

## Next Steps

1. Remove unused JavaScript files:
   - discoveryInterface.js
   - connectionShare.js
   - cloudflareDiscovery.js

2. Update Chrome extension to match (optional)

3. Add native iOS settings UI to replace popup settings

4. Consider native popup window instead of HTML