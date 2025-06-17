import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Chrome Extension Debug', () => {
  test('check extension console logs', async () => {
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
    
    // Listen to console logs from service worker
    sw.on('console', msg => {
      console.log('SW Console:', msg.type(), msg.text());
    });
    
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

    // Open popup
    const popup = await context.newPage();
    
    // Listen to popup console
    popup.on('console', msg => {
      console.log('Popup Console:', msg.type(), msg.text());
    });
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Check if chrome.storage is available in popup
    const hasStorage = await popup.evaluate(() => {
      return typeof chrome !== 'undefined' && chrome.storage !== undefined;
    });
    console.log('Popup has chrome.storage:', hasStorage);
    
    // Check if chrome.runtime is available
    const hasRuntime = await popup.evaluate(() => {
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    });
    console.log('Popup has chrome.runtime:', hasRuntime);
    
    // Try to get stats directly
    const stats = await popup.evaluate(() => {
      return new Promise((resolve) => {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
            resolve(response || { error: 'No response' });
          });
        } else {
          resolve({ error: 'Chrome API not available' });
        }
      });
    });
    console.log('Stats from background:', stats);
    
    // Check storage directly
    const storageData = await popup.evaluate(() => {
      return new Promise((resolve) => {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (data) => {
            resolve(data);
          });
        } else {
          resolve({ error: 'Storage not available' });
        }
      });
    });
    console.log('Storage data:', storageData);
    
    // Browse to a page
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await testPage.waitForLoadState('networkidle');
    await testPage.waitForTimeout(3000);
    
    // Check service worker again
    console.log('Service worker URL:', sw.url());
    
    // Check storage again after browsing
    const storageAfter = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['historyItems'], (data) => {
          resolve(data);
        });
      });
    });
    console.log('Storage after browsing:', storageAfter);
    
    await context.close();
  });
});