import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Chrome Extension API Test', () => {
  test('verify Chrome APIs are accessible', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=' + extensionPath,
        '--load-extension=' + extensionPath,
      ],
    });

    // Wait for service worker
    let sw;
    for (let i = 0; i < 10; i++) {
      const workers = context.serviceWorkers();
      if (workers.length > 0) {
        sw = workers[0];
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    expect(sw).toBeDefined();
    console.log('Service worker found:', sw.url());
    
    const extensionId = sw.url().split('//')[1].split('/')[0];
    
    // Open a test page in the extension context
    const testPage = await context.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Test 1: Check if chrome APIs exist
    const apisExist = await testPage.evaluate(() => {
      return {
        chrome: typeof chrome !== 'undefined',
        runtime: typeof chrome?.runtime !== 'undefined',
        storage: typeof chrome?.storage !== 'undefined',
        history: typeof chrome?.history !== 'undefined',
        tabs: typeof chrome?.tabs !== 'undefined',
      };
    });
    
    console.log('APIs exist:', apisExist);
    expect(apisExist.chrome).toBeTruthy();
    expect(apisExist.runtime).toBeTruthy();
    expect(apisExist.storage).toBeTruthy();
    expect(apisExist.history).toBeTruthy();
    
    // Test 2: Try to use history API
    const historyTest = await testPage.evaluate(() => {
      return new Promise((resolve) => {
        try {
          chrome.history.search({ text: '', maxResults: 5 }, (results) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
            } else {
              resolve({ 
                success: true, 
                count: results.length,
                sample: results[0] 
              });
            }
          });
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    });
    
    console.log('History API test:', historyTest);
    expect(historyTest.error).toBeUndefined();
    
    // Test 3: Try to use storage API
    const storageTest = await testPage.evaluate(() => {
      return new Promise((resolve) => {
        const testData = { test: 'value', timestamp: Date.now() };
        chrome.storage.local.set(testData, () => {
          chrome.storage.local.get(['test', 'timestamp'], (result) => {
            resolve({ 
              success: result.test === 'value',
              data: result 
            });
          });
        });
      });
    });
    
    console.log('Storage API test:', storageTest);
    expect(storageTest.success).toBeTruthy();
    
    // Test 4: Check if service worker can receive messages
    const messageTest = await testPage.evaluate(() => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ error: 'Timeout - no response from service worker' });
        }, 5000);
        
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve({ success: true, response });
          }
        });
      });
    });
    
    console.log('Message test:', messageTest);
    
    // Test 5: Browse a page and check if history captures it
    const browsePage = await context.newPage();
    await browsePage.goto('https://example.com');
    await browsePage.waitForLoadState('networkidle');
    await browsePage.waitForTimeout(3000);
    
    // Check history again
    const historyAfter = await testPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.history.search({ text: 'example.com', maxResults: 5 }, (results) => {
          resolve({ 
            count: results.length,
            found: results.some(item => item.url.includes('example.com'))
          });
        });
      });
    });
    
    console.log('History after browsing:', historyAfter);
    
    await context.close();
  });
});