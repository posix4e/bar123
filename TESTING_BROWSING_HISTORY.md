# Testing Browsing History in bar123

This document describes how to test that browsing history from Safari appears in the Swift interface.

## Prerequisites

1. Build and run the bar123 app on an iOS device or simulator
2. Enable the Safari extension:
   - Go to Settings > Safari > Extensions
   - Enable "bar123"
   - Allow access to all websites

## Test Steps

### 1. Initial Setup
- Launch the bar123 app
- Note the current history count (may be 0 for fresh install)
- Check the "Pending" count in the sync status section

### 2. Browse in Safari
- Open Safari
- Visit a few websites, for example:
  - https://example.com
  - https://apple.com
  - https://github.com

### 3. Verify History Capture
- Return to the bar123 app
- Pull down to refresh the history list
- You should see:
  - The websites you just visited appear in the "Recent History" section
  - The "Pending" count increases by the number of sites visited
  - Each history item shows the page title and URL

### 4. Test Sync Status
- The sync status should show "Sync needed" if there are pending items
- Tap "Force Sync" to sync the history to Pantry (if configured)
- After sync, the pending count should decrease

## Expected Behavior

1. **Real-time Capture**: History items appear immediately after visiting a site in Safari
2. **Display Format**: Each history item shows:
   - Page title
   - URL (in gray text)
   - Checkmark if synced
3. **Sorting**: Most recent visits appear at the top
4. **Swipe to Delete**: You can swipe left on any history item to delete it
5. **Pull to Refresh**: Updates the list with any new history items

## UI Test Code

The app includes UI tests that verify:
- `testHistoryTableViewExists()` - Verifies the history table is visible
- `testBrowsingHistoryAppearsInApp()` - Simulates browsing and checks for new items
- `testHistoryCellStructure()` - Verifies the structure of history cells

## Unit Test Code

The app includes unit tests that verify:
- `testAddHistoryItem()` - Tests adding history items to Core Data
- `testGetPendingCount()` - Tests pending sync count
- `testMarkItemsAsSynced()` - Tests sync status updates
- `testGetRecentHistoryWithLimit()` - Tests history retrieval with limits

## Troubleshooting

If history doesn't appear:
1. Ensure the Safari extension is enabled
2. Check that the app has the correct permissions
3. Try force-quitting and restarting both Safari and bar123
4. Check the console logs for any errors

## Technical Details

The history capture flow:
1. Safari extension's `browser.history.onVisited` listener captures new visits
2. Extension sends history to native app via `browser.runtime.sendNativeMessage`
3. Native app stores in Core Data using shared app group
4. UI refreshes via Darwin notifications between extension and app