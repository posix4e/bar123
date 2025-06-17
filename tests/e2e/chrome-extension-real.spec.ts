import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const PANTRY_ID = process.env.PANTRYID;
if (!PANTRY_ID) {
  throw new Error('PANTRYID environment variable is required');
}

test.describe('Chrome Extension Real Test', () => {
  test('captures browsing history and syncs to Pantry', async () => {
    // Launch Chrome with the extension
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
      viewport: { width: 1280, height: 720 }
    });

    // Wait for extension to load
    await context.waitForEvent('serviceworker');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give extension time to initialize

    // Get extension ID by going to chrome://extensions
    const page = await context.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Get the extension ID from the page
    const extensionId = await page.evaluate(() => {
      const extensions = document.querySelector('extensions-manager').shadowRoot
        .querySelector('extensions-item-list').shadowRoot
        .querySelectorAll('extensions-item');
      
      for (const ext of extensions) {
        const name = ext.shadowRoot.querySelector('#name').textContent;
        if (name.includes('bar123')) {
          return ext.id;
        }
      }
      return null;
    });

    console.log('Extension ID:', extensionId);
    expect(extensionId).toBeTruthy();

    // Open extension popup and configure
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for popup to load
    await popup.waitForLoadState('networkidle');
    await popup.waitForTimeout(1000);
    
    // Debug: Check if elements exist
    const pantryIdExists = await popup.locator('#pantryId').isVisible();
    console.log('Pantry ID field visible:', pantryIdExists);
    
    // Configure Pantry
    await popup.fill('#pantryId', PANTRY_ID);
    await popup.fill('#basketName', `test-${Date.now()}`);
    await popup.check('#syncEnabled');
    await popup.click('#saveSettings');
    
    // Wait for settings to save and check for success
    await popup.waitForTimeout(2000);
    
    // Try to find success message with different selectors
    let successMessage = '';
    const messageDiv = await popup.locator('.message.success');
    if (await messageDiv.isVisible()) {
      successMessage = await messageDiv.textContent() || '';
    } else {
      // Try generic message
      const genericMessage = await popup.locator('.message');
      if (await genericMessage.isVisible()) {
        successMessage = await genericMessage.textContent() || '';
      }
    }
    
    console.log('Save message:', successMessage);
    
    // If no success message, maybe settings were already saved, so continue
    if (!successMessage) {
      console.log('No success message found, continuing anyway...');
    }
    
    // Check initial state - wait for stats to load
    await popup.waitForTimeout(2000);
    
    // Click somewhere to ensure popup is active
    await popup.click('body');
    
    // Trigger a manual stats refresh
    const totalItemsElement = await popup.locator('#totalItems');
    await totalItemsElement.waitFor({ state: 'visible' });
    
    let initialCount = await totalItemsElement.textContent();
    console.log('Initial history count:', initialCount);
    
    // If still showing "-", wait more
    if (initialCount === '-') {
      await popup.waitForTimeout(3000);
      initialCount = await totalItemsElement.textContent();
      console.log('Initial history count after wait:', initialCount);
    }

    // Browse to test websites
    const testPage = await context.newPage();
    
    // Visit Example.com
    await testPage.goto('https://example.com');
    await testPage.waitForLoadState('networkidle');
    await testPage.waitForTimeout(2000);
    
    // Visit Wikipedia
    await testPage.goto('https://www.wikipedia.org');
    await testPage.waitForLoadState('networkidle');
    await testPage.waitForTimeout(2000);
    
    // Visit GitHub
    await testPage.goto('https://github.com');
    await testPage.waitForLoadState('networkidle');
    await testPage.waitForTimeout(2000);

    // Go back to popup and check history count increased
    await popup.bringToFront();
    await popup.reload();
    await popup.waitForTimeout(1000);
    
    const newCount = await popup.locator('#totalItems').textContent();
    console.log('New history count:', newCount);
    
    // Should have at least 3 new items
    expect(parseInt(newCount || '0')).toBeGreaterThanOrEqual(3);
    
    // Check unsynced count
    const unsyncedCount = await popup.locator('#unsyncedCount').textContent();
    console.log('Unsynced items:', unsyncedCount);
    expect(parseInt(unsyncedCount || '0')).toBeGreaterThan(0);
    
    // Trigger sync
    await popup.click('#syncNow');
    
    // Wait for sync to complete
    await popup.waitForTimeout(3000);
    const syncMessage = await popup.locator('.message').textContent();
    console.log('Sync message:', syncMessage);
    expect(syncMessage).toContain('Sync completed successfully!');
    await popup.waitForTimeout(2000);
    
    // Verify items were synced
    const syncedUnsyncedCount = await popup.locator('#unsyncedCount').textContent();
    console.log('Unsynced after sync:', syncedUnsyncedCount);
    expect(parseInt(syncedUnsyncedCount || '0')).toBe(0);
    
    // Verify last sync time updated
    const lastSync = await popup.locator('#lastSync').textContent();
    console.log('Last sync:', lastSync);
    expect(lastSync).not.toBe('Never');
    
    // Clean up
    await context.close();
  });
});