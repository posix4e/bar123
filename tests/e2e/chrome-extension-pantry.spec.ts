import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const PANTRY_ID = process.env.PANTRYID;
if (!PANTRY_ID) {
  throw new Error('PANTRYID environment variable is required');
}

const PANTRY_BASE_URL = 'https://getpantry.cloud/apiv1/pantry';
const BASKET_NAME = `test-${Date.now()}`;

test.describe('Chrome Extension Pantry Sync', () => {
  test('captures history and syncs to Pantry', async () => {
    console.log('Using Pantry ID:', PANTRY_ID);
    console.log('Using basket name:', BASKET_NAME);
    
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
    const [sw] = context.serviceWorkers();
    console.log('Service worker loaded:', sw.url());
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get extension ID
    const page = await context.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
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
    await popup.waitForLoadState('networkidle');
    
    // Configure extension
    await popup.fill('#pantryId', PANTRY_ID);
    await popup.fill('#basketName', BASKET_NAME);
    await popup.check('#syncEnabled');
    await popup.click('#saveSettings');
    
    // Wait for settings to save
    await popup.waitForTimeout(2000);
    
    // Take screenshot of configured popup
    await popup.screenshot({ path: 'test-results/popup-configured-pantry.png' });

    // Browse to test websites
    const testPage = await context.newPage();
    
    const testUrls = [
      'https://example.com',
      'https://www.wikipedia.org',
      'https://github.com',
      'https://news.ycombinator.com'
    ];
    
    for (const url of testUrls) {
      console.log(`Navigating to ${url}`);
      await testPage.goto(url);
      await testPage.waitForLoadState('networkidle');
      await testPage.waitForTimeout(2000);
    }

    // Go back to popup and check stats
    await popup.bringToFront();
    await popup.reload();
    await popup.waitForTimeout(2000);
    
    const totalItems = await popup.locator('#totalItems').textContent();
    const unsyncedCount = await popup.locator('#unsyncedCount').textContent();
    
    console.log('Total items:', totalItems);
    console.log('Unsynced items:', unsyncedCount);
    
    // Take screenshot before sync
    await popup.screenshot({ path: 'test-results/popup-before-sync.png' });
    
    // Trigger manual sync
    console.log('Triggering sync...');
    await popup.click('#syncNow');
    
    // Wait for sync to complete
    await popup.waitForTimeout(5000);
    
    // Take screenshot after sync
    await popup.screenshot({ path: 'test-results/popup-after-sync.png' });
    
    // Check sync status
    const newUnsyncedCount = await popup.locator('#unsyncedCount').textContent();
    const lastSync = await popup.locator('#lastSync').textContent();
    
    console.log('Unsynced after sync:', newUnsyncedCount);
    console.log('Last sync:', lastSync);
    
    // Verify data in Pantry
    console.log('Checking Pantry basket...');
    const basketUrl = `${PANTRY_BASE_URL}/${PANTRY_ID}/basket/${BASKET_NAME}`;
    
    const response = await fetch(basketUrl);
    console.log('Pantry response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Pantry data:', JSON.stringify(data, null, 2));
      
      // Verify we have history items
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBeTruthy();
      expect(data.items.length).toBeGreaterThan(0);
      
      // Check that our test URLs are in the data
      const urls = data.items.map(item => item.url);
      console.log('URLs in Pantry:', urls);
      
      // At least one of our test URLs should be there
      const foundTestUrl = testUrls.some(testUrl => 
        urls.some(url => url.includes(testUrl.replace('https://', '')))
      );
      expect(foundTestUrl).toBeTruthy();
    } else {
      console.log('Pantry response:', await response.text());
      
      // If no basket exists, that means sync didn't work
      expect(response.status).toBe(200);
    }
    
    // Clean up - delete test basket
    console.log('Cleaning up test basket...');
    await fetch(basketUrl, { method: 'DELETE' });
    
    await context.close();
  });
});