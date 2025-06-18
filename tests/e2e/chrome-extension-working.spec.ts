import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const PANTRY_ID = process.env.PANTRYID;
const PANTRY_BASE_URL = 'https://getpantry.cloud/apiv1/pantry';
const BASKET_NAME = `test-${Date.now()}`;

test.describe('Chrome Extension Working Test', () => {
  test('capture history with proper timing', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Wait for service worker
    const sw = await context.waitForEvent('serviceworker');
    console.log('Service worker:', sw.url());
    
    // Capture service worker logs
    sw.on('console', msg => {
      console.log('[SW]', msg.type().toUpperCase(), msg.text());
    });
    
    const extensionId = sw.url().split('//')[1].split('/')[0];
    
    // IMPORTANT: Give the service worker time to fully initialize
    console.log('Waiting for service worker to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Configure extension first
    const popup = await context.newPage();
    popup.on('console', msg => {
      console.log('[Popup]', msg.type().toUpperCase(), msg.text());
    });
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    await popup.fill('#pantryId', PANTRY_ID);
    await popup.fill('#basketName', BASKET_NAME);
    await popup.check('#syncEnabled');
    await popup.click('#saveSettings');
    await popup.waitForTimeout(2000);
    
    // Now browse pages
    console.log('Starting to browse pages...');
    const page = await context.newPage();
    
    // Browse with proper waits
    console.log('Going to example.com...');
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Give extension time to process
    
    console.log('Going to wikipedia.org...');
    await page.goto('https://www.wikipedia.org');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check storage directly
    const checkStorage = async () => {
      const data = await popup.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['historyItems'], (result) => {
            resolve(result);
          });
        });
      });
      console.log('Current storage:', JSON.stringify(data, null, 2));
      return data;
    };
    
    await checkStorage();
    
    // Reload popup to get fresh data
    await popup.reload();
    await popup.waitForTimeout(2000);
    
    // Check stats
    const totalItems = await popup.locator('#totalItems').textContent();
    console.log('Total items in UI:', totalItems);
    
    // Try manual history search
    const historySearch = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.history.search({ text: '', maxResults: 20 }, (results) => {
          resolve(results.map(item => ({
            url: item.url,
            title: item.title,
            lastVisitTime: item.lastVisitTime
          })));
        });
      });
    });
    
    console.log('History search results:', JSON.stringify(historySearch, null, 2));
    
    // Try to manually trigger save
    const manualSave = await popup.evaluate(() => {
      return new Promise((resolve) => {
        // Get recent history
        chrome.history.search({ text: '', maxResults: 10 }, async (results) => {
          const historyItems = [];
          
          for (const item of results) {
            if (!item.url.startsWith('chrome://') && !item.url.startsWith('chrome-extension://')) {
              historyItems.push({
                id: crypto.randomUUID(),
                url: item.url,
                title: item.title || item.url,
                timestamp: item.lastVisitTime,
                visitCount: item.visitCount || 1,
                syncedToPantry: false,
                deviceId: 'test-device'
              });
            }
          }
          
          // Save to storage
          await chrome.storage.local.set({ historyItems });
          
          // Get back to verify
          chrome.storage.local.get(['historyItems'], (result) => {
            resolve({
              saved: historyItems.length,
              stored: result.historyItems?.length || 0
            });
          });
        });
      });
    });
    
    console.log('Manual save result:', manualSave);
    
    // Reload popup again
    await popup.reload();
    await popup.waitForTimeout(2000);
    
    // Check final storage
    const finalStorage = await checkStorage();
    const finalTotal = await popup.locator('#totalItems').textContent();
    console.log('Final total items:', finalTotal);
    
    // Try sync
    if (finalStorage.historyItems && finalStorage.historyItems.length > 0) {
      console.log('Triggering sync...');
      await popup.click('#syncNow');
      await popup.waitForTimeout(5000);
      
      // Check Pantry
      const basketUrl = `${PANTRY_BASE_URL}/${PANTRY_ID}/basket/${BASKET_NAME}`;
      const response = await fetch(basketUrl);
      console.log('Pantry response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pantry data:', JSON.stringify(data, null, 2));
      }
    }
    
    await context.close();
  });
});