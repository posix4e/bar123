import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Chrome Extension Debug', () => {
  test('debug why history events are not firing', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Wait for service worker
    const sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
    console.log('Service worker:', sw.url());
    
    // Capture ALL service worker logs
    sw.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        console.error('[SW ERROR]', text);
      } else {
        console.log(`[SW ${type.toUpperCase()}]`, text);
      }
    });
    
    const extensionId = sw.url().split('//')[1].split('/')[0];
    
    // Open popup to trigger extension initialization
    const popup = await context.newPage();
    popup.on('console', msg => {
      console.log('[POPUP]', msg.type().toUpperCase(), msg.text());
    });
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Wait to see initialization logs
    console.log('\n=== Waiting for service worker initialization ===');
    await popup.waitForTimeout(3000);
    
    // Browse a page
    console.log('\n=== Browsing to example.com ===');
    const page = await context.newPage();
    page.on('console', msg => {
      console.log('[PAGE]', msg.type().toUpperCase(), msg.text());
    });
    
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    // Wait to see if events fire
    console.log('\n=== Waiting for history events (10 seconds) ===');
    await page.waitForTimeout(10000);
    
    // Check what's in storage
    console.log('\n=== Checking storage ===');
    const storage = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (data) => {
          resolve(data);
        });
      });
    });
    console.log('Storage contents:', JSON.stringify(storage, null, 2));
    
    // Try to manually trigger a history search
    console.log('\n=== Manual history search ===');
    const history = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.history.search({ text: '', maxResults: 10 }, (results) => {
          resolve(results.map(r => ({ url: r.url, title: r.title })));
        });
      });
    });
    console.log('History results:', JSON.stringify(history, null, 2));
    
    // Check if service worker is still alive
    console.log('\n=== Testing service worker communication ===');
    const swTest = await popup.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          resolve(response || { error: 'No response' });
        });
      });
    });
    console.log('Service worker response:', swTest);
    
    await context.close();
  });
});