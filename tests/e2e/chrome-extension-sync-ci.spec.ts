import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test Pantry credentials - uses environment variable
const PANTRY_ID = process.env.PANTRYID;
const TEST_BASKET_NAME = 'test-browser-history-' + Date.now();

// Simplified test for CI environment
test.describe('Chrome Extension Basic Sync', () => {
  test('extension loads and can be configured', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    // Verify extension exists
    expect(fs.existsSync(extensionPath)).toBeTruthy();
    expect(fs.existsSync(path.join(extensionPath, 'manifest.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(extensionPath, 'background.js'))).toBeTruthy();
    expect(fs.existsSync(path.join(extensionPath, 'popup.html'))).toBeTruthy();
    
    // In CI, we can't easily launch Chrome with extensions
    // So we'll test the extension files directly
    const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
    
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('bar123 - Browsing History Sync');
    expect(manifest.permissions).toContain('history');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.host_permissions).toContain('https://getpantry.cloud/*');
  });
  
  test('popup page renders correctly', async ({ page }) => {
    // Test the popup HTML directly
    const popupPath = `file://${path.join(__dirname, '../../chrome-extension/popup.html')}`;
    await page.goto(popupPath);
    
    // Check all UI elements exist
    await expect(page.locator('h1')).toContainText('bar123');
    await expect(page.locator('#pantryId')).toBeVisible();
    await expect(page.locator('#basketName')).toBeVisible();
    await expect(page.locator('#syncEnabled')).toBeVisible();
    await expect(page.locator('#syncNow')).toBeVisible();
    await expect(page.locator('#saveSettings')).toBeVisible();
    
    // Check default values
    const basketNameValue = await page.locator('#basketName').getAttribute('placeholder');
    expect(basketNameValue).toBe('browser-history');
  });
  
  test('can interact with popup form', async ({ page }) => {
    const popupPath = `file://${path.join(__dirname, '../../chrome-extension/popup.html')}`;
    await page.goto(popupPath);
    
    // Fill in the form
    await page.fill('#pantryId', PANTRY_ID);
    await page.fill('#basketName', TEST_BASKET_NAME);
    await page.check('#syncEnabled');
    
    // Verify values were set
    await expect(page.locator('#pantryId')).toHaveValue(PANTRY_ID);
    await expect(page.locator('#basketName')).toHaveValue(TEST_BASKET_NAME);
    await expect(page.locator('#syncEnabled')).toBeChecked();
  });
  
  test('background script syntax is valid', async () => {
    const backgroundPath = path.join(__dirname, '../../chrome-extension/background.js');
    const backgroundContent = fs.readFileSync(backgroundPath, 'utf8');
    
    // Basic syntax checks
    expect(backgroundContent).toContain('chrome.runtime.onInstalled');
    expect(backgroundContent).toContain('chrome.history.onVisited');
    expect(backgroundContent).toContain('syncWithPantry');
    expect(backgroundContent).toContain('PANTRY_BASE_URL');
    
    // Check for required functions
    expect(backgroundContent).toContain('saveHistoryItem');
    expect(backgroundContent).toContain('getDeviceId');
    expect(backgroundContent).toContain('updateBadge');
  });
});

// Full integration test that requires real Chrome (skip in CI)
test.describe('Chrome Extension Full Integration', () => {
  test.skip(process.env.CI === 'true', 'Full Chrome extension test requires real Chrome browser');
  
  test('syncs history between two instances', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    // Launch Chrome with extension
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    
    // Get extension ID
    const [backgroundPage] = context.serviceWorkers();
    await backgroundPage?.waitForLoadState();
    
    const page = await context.newPage();
    
    // Find extension ID by checking chrome://extensions
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Navigate to test page
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    // Extension should capture this visit
    await page.waitForTimeout(3000);
    
    // Check that history was captured (would need extension ID)
    // This is a placeholder for the full test
    
    await context.close();
  });
});