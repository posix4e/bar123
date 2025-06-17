import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Chrome Extension Background Script', () => {
  test('background script initializes and responds to messages', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Wait for service worker
    await context.waitForEvent('serviceworker');
    const [sw] = context.serviceWorkers();
    console.log('Service worker URL:', sw.url());
    
    // Get extension ID from service worker URL
    const extensionId = sw.url().split('//')[1].split('/')[0];
    console.log('Extension ID from SW:', extensionId);
    
    // Open the service worker inspector
    const swPage = await context.newPage();
    await swPage.goto(`chrome://inspect/#service-workers`);
    await swPage.waitForTimeout(2000);
    
    // Open popup to test communication
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Test direct chrome.storage access
    const storageTest = await popup.evaluate(() => {
      return new Promise((resolve) => {
        // First set some test data
        chrome.storage.local.set({ 
          testKey: 'testValue',
          historyItems: []
        }, () => {
          // Then get it back
          chrome.storage.local.get(['testKey', 'historyItems'], (result) => {
            resolve(result);
          });
        });
      });
    });
    
    console.log('Storage test result:', storageTest);
    expect(storageTest.testKey).toBe('testValue');
    
    // Test message passing
    const messageTest = await popup.evaluate(() => {
      return new Promise((resolve) => {
        // Send a test message
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { error: 'No response' });
          }
        });
      });
    });
    
    console.log('Message test result:', messageTest);
    
    // Test history API directly
    const historyTest = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.history.search({ text: '', maxResults: 10 }, (results) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve({ count: results.length, sample: results[0] });
          }
        });
      });
    });
    
    console.log('History API test:', historyTest);
    
    // Now test the actual getStats message
    const statsTest = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { error: 'No response' });
          }
        });
      });
    });
    
    console.log('Stats message result:', statsTest);
    
    // Check if service worker is actually running by evaluating in it
    try {
      const swActive = await sw.evaluate(() => {
        return { active: true, url: self.location.href };
      });
      console.log('Service worker eval:', swActive);
    } catch (e) {
      console.log('Service worker eval error:', e.message);
    }
    
    await context.close();
  });
});