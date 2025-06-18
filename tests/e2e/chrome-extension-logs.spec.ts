import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Chrome Extension Logs', () => {
  test('capture service worker logs', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-logging',
        '--v=1'
      ],
    });

    // Collect console logs
    const logs = [];
    
    // Wait for service worker
    const sw = await context.waitForEvent('serviceworker');
    console.log('Service worker URL:', sw.url());
    
    // Listen to service worker console
    sw.on('console', msg => {
      const log = `[SW] ${msg.type()}: ${msg.text()}`;
      console.log(log);
      logs.push(log);
    });
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get extension ID
    const extensionId = sw.url().split('//')[1].split('/')[0];
    
    // Open popup
    const popup = await context.newPage();
    
    // Listen to popup console
    popup.on('console', msg => {
      const log = `[Popup] ${msg.type()}: ${msg.text()}`;
      console.log(log);
      logs.push(log);
    });
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    // Wait for popup to load
    await popup.waitForTimeout(2000);
    
    // Try to trigger getStats
    console.log('Sending getStats message...');
    const statsResult = await popup.evaluate(() => {
      return new Promise((resolve) => {
        console.log('Sending message from popup...');
        chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
          console.log('Got response:', response);
          if (chrome.runtime.lastError) {
            console.error('Message error:', chrome.runtime.lastError);
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      });
    });
    
    console.log('Stats result:', statsResult);
    
    // Wait a bit more for any async logs
    await popup.waitForTimeout(2000);
    
    // Print all collected logs
    console.log('\n=== All collected logs ===');
    logs.forEach(log => console.log(log));
    console.log('=== End of logs ===\n');
    
    // Check if we got any service worker logs
    const swLogs = logs.filter(log => log.startsWith('[SW]'));
    console.log(`Found ${swLogs.length} service worker logs`);
    
    await context.close();
  });
});