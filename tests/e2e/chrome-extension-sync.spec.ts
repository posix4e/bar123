import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test Pantry credentials - uses environment variable
const TEST_PANTRY_ID = process.env.TEST_PANTRY_ID;
const TEST_BASKET_NAME = 'test-browser-history-' + Date.now();

if (!TEST_PANTRY_ID) {
  throw new Error('TEST_PANTRY_ID environment variable is required. Set it in .env file or GitHub secrets.');
}

test.describe('Chrome Extension Sync', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  
  test.beforeAll(async () => {
    // Path to the Chrome extension
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    // Verify extension exists
    expect(fs.existsSync(extensionPath)).toBeTruthy();
    
    // Launch two Chrome instances with the extension
    context1 = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    context2 = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    // Wait for extensions to load
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
  
  test.afterAll(async () => {
    await context1?.close();
    await context2?.close();
  });
  
  test('should sync history between two Chrome instances', async () => {
    // Get extension IDs
    const extensions1 = await context1.pages()[0].evaluate(() => 
      new Promise((resolve) => {
        // @ts-ignore
        chrome.management.getAll((extensions) => {
          resolve(extensions.filter(e => e.name === 'bar123 - Browsing History Sync'));
        });
      })
    );
    
    const extensions2 = await context2.pages()[0].evaluate(() => 
      new Promise((resolve) => {
        // @ts-ignore
        chrome.management.getAll((extensions) => {
          resolve(extensions.filter(e => e.name === 'bar123 - Browsing History Sync'));
        });
      })
    );
    
    // @ts-ignore
    const extensionId1 = extensions1[0]?.id;
    // @ts-ignore
    const extensionId2 = extensions2[0]?.id;
    
    expect(extensionId1).toBeTruthy();
    expect(extensionId2).toBeTruthy();
    
    // Configure extension 1
    const popup1 = await context1.newPage();
    await popup1.goto(`chrome-extension://${extensionId1}/popup.html`);
    
    // Set Pantry credentials
    await popup1.fill('#pantryId', TEST_PANTRY_ID);
    await popup1.fill('#basketName', TEST_BASKET_NAME);
    await popup1.check('#syncEnabled');
    await popup1.click('#saveSettings');
    
    // Wait for settings to save
    await expect(popup1.locator('.message.success')).toContainText('Settings saved successfully!');
    
    // Configure extension 2 with same credentials
    const popup2 = await context2.newPage();
    await popup2.goto(`chrome-extension://${extensionId2}/popup.html`);
    
    await popup2.fill('#pantryId', TEST_PANTRY_ID);
    await popup2.fill('#basketName', TEST_BASKET_NAME);
    await popup2.check('#syncEnabled');
    await popup2.click('#saveSettings');
    
    await expect(popup2.locator('.message.success')).toContainText('Settings saved successfully!');
    
    // Browse to a test page in context 1
    const page1 = await context1.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');
    
    // Wait for history to be captured
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Trigger sync in context 1
    await popup1.click('#syncNow');
    await expect(popup1.locator('.message.success')).toContainText('Sync completed successfully!');
    
    // Check that context 1 shows the history item
    const totalItems1 = await popup1.locator('#totalItems').textContent();
    expect(parseInt(totalItems1 || '0')).toBeGreaterThan(0);
    
    // Trigger sync in context 2 to pull the data
    await popup2.click('#syncNow');
    await expect(popup2.locator('.message.success')).toContainText('Sync completed successfully!');
    
    // Verify context 2 now has the same history
    const totalItems2 = await popup2.locator('#totalItems').textContent();
    expect(totalItems2).toBe(totalItems1);
    
    // Browse to another page in context 2
    const page2 = await context2.newPage();
    await page2.goto('https://www.wikipedia.org');
    await page2.waitForLoadState('networkidle');
    
    // Wait for history capture
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Sync context 2
    await popup2.click('#syncNow');
    await expect(popup2.locator('.message.success')).toContainText('Sync completed successfully!');
    
    // Sync context 1 to get the new item
    await popup1.click('#syncNow');
    await expect(popup1.locator('.message.success')).toContainText('Sync completed successfully!');
    
    // Both should now have 2 items
    const finalItems1 = await popup1.locator('#totalItems').textContent();
    const finalItems2 = await popup2.locator('#totalItems').textContent();
    
    expect(parseInt(finalItems1 || '0')).toBe(2);
    expect(finalItems1).toBe(finalItems2);
  });
  
  test('should handle sync conflicts correctly', async () => {
    // This test verifies that when both extensions browse at the same time,
    // the sync mechanism properly merges without duplicates
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both browse to the same site
    await Promise.all([
      page1.goto('https://github.com'),
      page2.goto('https://github.com')
    ]);
    
    await Promise.all([
      page1.waitForLoadState('networkidle'),
      page2.waitForLoadState('networkidle')
    ]);
    
    // Wait for history capture
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get extension popups
    const extensionId1 = await getExtensionId(context1);
    const extensionId2 = await getExtensionId(context2);
    
    const popup1 = await context1.newPage();
    await popup1.goto(`chrome-extension://${extensionId1}/popup.html`);
    
    const popup2 = await context2.newPage();
    await popup2.goto(`chrome-extension://${extensionId2}/popup.html`);
    
    // Sync both
    await Promise.all([
      popup1.click('#syncNow'),
      popup2.click('#syncNow')
    ]);
    
    // Wait for syncs to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Sync again to ensure both have the latest
    await popup1.click('#syncNow');
    await popup2.click('#syncNow');
    
    // Both should have the same count (no duplicates)
    const items1 = await popup1.locator('#totalItems').textContent();
    const items2 = await popup2.locator('#totalItems').textContent();
    
    expect(items1).toBe(items2);
  });
});

async function getExtensionId(context: BrowserContext): Promise<string> {
  const result = await context.pages()[0].evaluate(() => 
    new Promise((resolve) => {
      // @ts-ignore
      chrome.management.getAll((extensions) => {
        const ext = extensions.find(e => e.name === 'bar123 - Browsing History Sync');
        resolve(ext?.id || '');
      });
    })
  );
  return result as string;
}