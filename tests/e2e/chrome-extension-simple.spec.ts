import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const PANTRY_ID = process.env.PANTRYID;
const BASKET_NAME = `test-${Date.now()}`;

test.describe('Chrome Extension Simple Test', () => {
  test('simple history capture test', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    // Launch with debugging port
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-logging',
        '--v=1'
      ],
      devtools: true
    });

    // Get service worker
    const sw = await context.waitForEvent('serviceworker');
    const extensionId = sw.url().split('//')[1].split('/')[0];
    console.log('Extension ID:', extensionId);
    
    // Open popup and configure
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Configure the extension
    await popup.fill('#pantryId', PANTRY_ID);
    await popup.fill('#basketName', BASKET_NAME);
    await popup.check('#syncEnabled');
    await popup.click('#saveSettings');
    await popup.waitForTimeout(2000);
    
    // Create a simple page that logs when history should be captured
    const testPage = await context.newPage();
    
    // Navigate to a page
    console.log('Navigating to test page...');
    await testPage.goto('https://example.com');
    await testPage.waitForLoadState('networkidle');
    
    // Wait a bit
    await testPage.waitForTimeout(5000);
    
    // Check if history was captured by looking at the popup stats
    await popup.reload();
    await popup.waitForTimeout(2000);
    
    const totalItems = await popup.locator('#totalItems').textContent();
    console.log('Total items after navigation:', totalItems);
    
    // Try to manually call the history API from popup context
    const manualCapture = await popup.evaluate(async () => {
      // First, let's see what's in history
      const history = await new Promise((resolve) => {
        chrome.history.search({ text: '', maxResults: 5 }, (results) => {
          resolve(results);
        });
      });
      
      // Now let's manually save the first non-extension URL
      const historyItem = history.find(h => !h.url.startsWith('chrome-extension://'));
      if (historyItem) {
        // Send a message to the background script to save it
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'manualSave',
            historyItem: historyItem
          }, (response) => {
            resolve(response || { error: 'No response' });
          });
        });
        
        return {
          found: historyItem,
          saveResponse: response
        };
      }
      
      return { error: 'No history item found' };
    });
    
    console.log('Manual capture result:', manualCapture);
    
    // Add the manual save handler to background.js
    await popup.evaluate(() => {
      chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
        console.log('Stats after manual save:', response);
      });
    });
    
    await context.close();
  });
});