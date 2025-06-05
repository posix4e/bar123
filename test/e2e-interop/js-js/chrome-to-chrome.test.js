/**
 * End-to-end test: Chrome Extension to Chrome Extension
 * Uses Playwright to test real browser instances with the extension
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '..', '..', 'chrome-extension');

test.describe('Chrome to Chrome Extension Sync', () => {
  let browser1, browser2;
  let extensionId1, extensionId2;
  
  const testRoomSecret = `js-js-test-${Date.now()}`;

  test.beforeAll(async () => {
    // Launch two Chrome instances with the extension
    browser1 = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--user-data-dir=/tmp/chrome-test-profile-1'
      ]
    });

    browser2 = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--user-data-dir=/tmp/chrome-test-profile-2'
      ]
    });

    // Get extension IDs
    const backgroundPages1 = browser1.serviceWorkers();
    const backgroundPages2 = browser2.serviceWorkers();
    
    for (const worker of backgroundPages1) {
      if (worker.url().includes('chrome-extension://')) {
        extensionId1 = new URL(worker.url()).hostname;
        break;
      }
    }

    for (const worker of backgroundPages2) {
      if (worker.url().includes('chrome-extension://')) {
        extensionId2 = new URL(worker.url()).hostname;
        break;
      }
    }
  });

  test.afterAll(async () => {
    await browser1?.close();
    await browser2?.close();
  });

  test('should sync history between two Chrome extensions', async () => {
    // Open popup for browser 1
    const popup1 = await browser1.newPage();
    await popup1.goto(`chrome-extension://${extensionId1}/popup.html`);
    
    // Connect browser 1 to room
    await popup1.fill('#roomSecret', testRoomSecret);
    await popup1.click('#connectButton');
    
    // Wait for connection
    await expect(popup1.locator('#connectionStatus')).toContainText('Connected', { timeout: 30000 });

    // Open popup for browser 2
    const popup2 = await browser2.newPage();
    await popup2.goto(`chrome-extension://${extensionId2}/popup.html`);
    
    // Connect browser 2 to same room
    await popup2.fill('#roomSecret', testRoomSecret);
    await popup2.click('#connectButton');
    
    // Wait for both to be connected and find each other
    await expect(popup2.locator('#connectionStatus')).toContainText('Connected', { timeout: 30000 });
    await popup1.waitForTimeout(3000); // Allow peer discovery

    // Browser 1 visits some pages
    const tab1 = await browser1.newPage();
    await tab1.goto('https://example.com');
    await tab1.waitForLoadState('networkidle');
    
    await tab1.goto('https://wikipedia.org');
    await tab1.waitForLoadState('networkidle');
    
    await tab1.goto('https://github.com');
    await tab1.waitForLoadState('networkidle');

    // Wait for history to sync
    await popup2.waitForTimeout(5000);

    // Check if browser 2 received the history
    await popup2.click('#historyTab');
    
    // Look for synced entries
    const historyItems = popup2.locator('.history-item');
    await expect(historyItems).toHaveCount(3, { timeout: 10000 });
    
    // Verify specific URLs
    await expect(popup2.locator('text=example.com')).toBeVisible();
    await expect(popup2.locator('text=wikipedia.org')).toBeVisible();
    await expect(popup2.locator('text=github.com')).toBeVisible();

    // Take screenshots for debugging
    await popup1.screenshot({ path: 'test-results/chrome1-history.png' });
    await popup2.screenshot({ path: 'test-results/chrome2-history.png' });
  });

  test('should sync bidirectionally', async () => {
    // Both browsers visit different pages
    const tab1 = await browser1.newPage();
    const tab2 = await browser2.newPage();

    // Browser 1 visits pages
    await tab1.goto('https://google.com');
    await tab1.waitForLoadState('networkidle');

    // Browser 2 visits different pages
    await tab2.goto('https://stackoverflow.com');
    await tab2.waitForLoadState('networkidle');

    // Wait for sync
    await tab1.waitForTimeout(5000);

    // Open popups to check history
    const popup1 = await browser1.newPage();
    await popup1.goto(`chrome-extension://${extensionId1}/popup.html`);
    await popup1.click('#historyTab');

    const popup2 = await browser2.newPage();
    await popup2.goto(`chrome-extension://${extensionId2}/popup.html`);
    await popup2.click('#historyTab');

    // Browser 1 should have browser 2's history
    await expect(popup1.locator('text=stackoverflow.com')).toBeVisible();

    // Browser 2 should have browser 1's history
    await expect(popup2.locator('text=google.com')).toBeVisible();
  });

  test('should handle peer disconnection and reconnection', async () => {
    // Get popups
    const popup1 = browser1.pages().find(p => p.url().includes('popup.html'));
    browser2.pages().find(p => p.url().includes('popup.html')); // Verify popup exists before close

    // Close browser 2 to simulate disconnection
    await browser2.close();
    
    // Wait and check disconnection status in browser 1
    await popup1.waitForTimeout(5000);
    await expect(popup1.locator('#peerCount')).toContainText('0');

    // Reconnect browser 2
    browser2 = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--user-data-dir=/tmp/chrome-test-profile-2'
      ]
    });

    // Reconnect to room
    const newPopup2 = await browser2.newPage();
    await newPopup2.goto(`chrome-extension://${extensionId2}/popup.html`);
    await newPopup2.fill('#roomSecret', testRoomSecret);
    await newPopup2.click('#connectButton');

    // Verify reconnection
    await expect(newPopup2.locator('#connectionStatus')).toContainText('Connected', { timeout: 30000 });
    await expect(popup1.locator('#peerCount')).toContainText('1', { timeout: 30000 });
  });
});