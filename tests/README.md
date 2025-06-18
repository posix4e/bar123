# bar123 Tests

This directory contains end-to-end tests for the bar123 Chrome extension.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```bash
   PANTRYID=your-pantry-id-here
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Local Development
```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug
```

### CI Environment
```bash
npm run test:ci
```

## Test Structure

- `chrome-extension-sync.spec.ts` - Full integration test that launches Chrome with the extension
- `chrome-extension-sync-ci.spec.ts` - Simplified tests that work in CI environment

## GitHub Actions

The tests run automatically on:
- Push to main, sync-logic-to-swift, or chrome-extension-support branches
- Pull requests to main

Required GitHub Secret:
- `PANTRYID` - A valid Pantry ID for testing

## Writing Tests

Tests use Playwright for browser automation. Key patterns:

1. Loading the extension:
   ```typescript
   const context = await chromium.launchPersistentContext('', {
     args: [
       `--disable-extensions-except=${extensionPath}`,
       `--load-extension=${extensionPath}`,
     ],
   });
   ```

2. Accessing extension popup:
   ```typescript
   await page.goto(`chrome-extension://${extensionId}/popup.html`);
   ```

3. Simulating sync:
   ```typescript
   await popup.click('#syncNow');
   await expect(popup.locator('.message.success')).toContainText('Sync completed');
   ```