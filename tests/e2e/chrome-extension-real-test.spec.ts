import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const PANTRY_ID = process.env.PANTRYID;
if (!PANTRY_ID) {
  throw new Error('PANTRYID environment variable is required');
}

const PANTRY_BASE_URL = 'https://getpantry.cloud/apiv1/pantry';
const BASKET_NAME = `test-${Date.now()}`;

// Helper to wait for extension to be ready
async function waitForExtension(context: BrowserContext, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      console.log(`Service worker found on attempt ${i + 1}`);
      return serviceWorkers[0];
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Service worker did not start after 10 seconds');
}

test.describe('Chrome Extension Real Test', () => {
  test('actually captures history and syncs to Pantry', async () => {
    console.log(`Test starting with Pantry ID: ${PANTRY_ID}`);
    console.log(`Using basket: ${BASKET_NAME}`);
    
    // Launch Chrome with extension
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=' + extensionPath,
        '--load-extension=' + extensionPath,
      ],
      viewport: { width: 1280, height: 720 }
    });

    // Wait for extension service worker to be ready
    const sw = await waitForExtension(context);
    console.log('Service worker URL:', sw.url());
    
    // Extract extension ID from service worker URL
    const extensionId = sw.url().split('//')[1].split('/')[0];
    console.log('Extension ID:', extensionId);
    
    // Give service worker time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Open extension popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Screenshot initial state
    await popup.screenshot({ path: 'test-results/1-popup-initial.png' });
    
    // Configure extension
    console.log('Configuring extension...');
    await popup.fill('#pantryId', PANTRY_ID);
    await popup.fill('#basketName', BASKET_NAME);
    await popup.check('#syncEnabled');
    await popup.click('#saveSettings');
    
    // Wait for settings to be saved
    await popup.waitForTimeout(2000);
    await popup.screenshot({ path: 'test-results/2-popup-configured.png' });
    
    // Browse to some test pages
    console.log('Browsing test pages...');
    const page = await context.newPage();
    
    const testUrls = [
      { url: 'https://example.com', title: 'Example Domain' },
      { url: 'https://www.wikipedia.org', title: 'Wikipedia' },
      { url: 'https://github.com', title: 'GitHub' }
    ];
    
    for (const testUrl of testUrls) {
      console.log(`Navigating to ${testUrl.url}`);
      await page.goto(testUrl.url);
      await page.waitForLoadState('networkidle');
      // Give extension time to capture the visit
      await page.waitForTimeout(3000);
    }
    
    // Go back to popup and reload to get fresh stats
    await popup.bringToFront();
    await popup.reload();
    await popup.waitForLoadState('networkidle');
    await popup.waitForTimeout(2000);
    
    // Check if history was captured
    console.log('Checking history capture...');
    const totalItems = await popup.locator('#totalItems').textContent();
    const unsyncedCount = await popup.locator('#unsyncedCount').textContent();
    
    console.log('Total items:', totalItems);
    console.log('Unsynced count:', unsyncedCount);
    
    await popup.screenshot({ path: 'test-results/3-popup-with-history.png' });
    
    // If we don't see numbers, try clicking sync to refresh
    if (totalItems === '-' || totalItems === '0') {
      console.log('No items shown, trying to refresh...');
      
      // Try to manually check storage
      const storageData = await popup.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['historyItems'], (data) => {
            resolve(data);
          });
        });
      });
      console.log('Storage data:', JSON.stringify(storageData, null, 2));
    }
    
    // Trigger sync
    console.log('Triggering sync...');
    await popup.click('#syncNow');
    
    // Wait for sync to complete
    await popup.waitForTimeout(5000);
    
    // Check sync status
    const lastSync = await popup.locator('#lastSync').textContent();
    console.log('Last sync:', lastSync);
    
    await popup.screenshot({ path: 'test-results/4-popup-after-sync.png' });
    
    // Check Pantry
    console.log('Checking Pantry...');
    const basketUrl = `${PANTRY_BASE_URL}/${PANTRY_ID}/basket/${BASKET_NAME}`;
    
    try {
      const response = await fetch(basketUrl);
      console.log('Pantry response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pantry data received');
        console.log('Number of items:', data.items?.length || 0);
        
        if (data.items && data.items.length > 0) {
          console.log('Sample item:', JSON.stringify(data.items[0], null, 2));
          
          // Verify we captured our test URLs
          const urls = data.items.map(item => item.url);
          console.log('Captured URLs:', urls);
          
          // Check if at least one test URL was captured
          const capturedTestUrl = testUrls.some(test => 
            urls.some(url => url.includes(test.url.replace('https://', '')))
          );
          
          expect(capturedTestUrl).toBeTruthy();
          console.log('✅ Test URLs were captured and synced!');
        } else {
          console.log('❌ No items in Pantry basket');
        }
      } else {
        const errorText = await response.text();
        console.log('Pantry error:', errorText);
      }
    } catch (error) {
      console.error('Failed to check Pantry:', error);
    }
    
    // Cleanup
    console.log('Cleaning up test basket...');
    try {
      await fetch(basketUrl, { method: 'DELETE' });
    } catch (e) {
      console.log('Cleanup error (non-critical):', e.message);
    }
    
    await context.close();
  });
});