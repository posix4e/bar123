# Bar123 Playwright Sync Test

This test demonstrates real browser history syncing between Playwright (Chrome extension) and the Swift CLI.

## Prerequisites

1. Build the Swift CLI:
   ```bash
   cd ../cli
   swift build
   ```

2. Install test dependencies:
   ```bash
   npm install
   ```

3. Set environment variables (or create `.env` file):
   ```bash
   export API="your-cloudflare-api-token"
   export ZONEID="your-zone-id"
   export DNS="your-domain"
   export ROOMID="test-room"
   export SECRET="your-secret"
   ```

## Running the Test

### Basic test (with UI):
```bash
npm test
```

### Export synced history to file:
```bash
# JSON format
npm test 2>/dev/null | tail -n +20 > history.json

# CSV format
../cli/.build/debug/bar123-cli export --format csv > history.csv

# JSON Lines format
../cli/.build/debug/bar123-cli export --format jsonl > history.jsonl
```

## What the Test Does

1. **Cleans up** - Removes any existing peer records
2. **Announces CLI peer** - Starts the CLI as a peer in the room
3. **Launches browser** - Opens Chrome with the bar123 extension
4. **Browses sites** - Visits GitHub, StackOverflow, HackerNews, Wikipedia, Google
5. **Syncs data** - Waits for P2P sync to occur
6. **Exports history** - Shows the synced history in multiple formats

## Test Output

The test will output the synced browsing history in three formats:
- JSON (pretty-printed)
- CSV (for spreadsheets)
- JSON Lines (for streaming/processing)

All output goes to stdout, so you can redirect it:

```bash
# Get just the JSON output
../cli/.build/debug/bar123-cli export --format json --pretty > synced-history.json

# Get CSV for analysis
../cli/.build/debug/bar123-cli export --format csv > synced-history.csv
```

## Troubleshooting

1. **Extension not loading**: Make sure the extension is built and the path is correct
2. **No peers found**: Check Cloudflare credentials and room ID
3. **No history synced**: Ensure both browser and CLI are in the same room
4. **Permission errors**: The test needs access to create ~/.bar123/history.json

## Advanced Usage

Filter exports by device or date:
```bash
# Only Chrome history
../cli/.build/debug/bar123-cli export --device "chrome-extension"

# Only today's history
../cli/.build/debug/bar123-cli export --since "2024-01-09"

# Combine filters
../cli/.build/debug/bar123-cli export --device "chrome-extension" --since "2024-01-09" --format csv
```