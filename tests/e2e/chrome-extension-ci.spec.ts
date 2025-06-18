import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Chrome Extension CI Tests', () => {
  test('extension files are valid', async () => {
    const extensionPath = path.join(__dirname, '../../chrome-extension');
    
    // Verify extension exists
    expect(fs.existsSync(extensionPath)).toBeTruthy();
    
    // Check manifest.json
    const manifestPath = path.join(extensionPath, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBeTruthy();
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('bar123 - Browsing History Sync');
    expect(manifest.permissions).toContain('history');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.host_permissions).toContain('https://getpantry.cloud/*');
    
    // Check required files exist
    const requiredFiles = [
      'background.js',
      'content.js',
      'popup.html',
      'popup.css',
      'popup.js',
      'icons/icon-16.png',
      'icons/icon-48.png',
      'icons/icon-128.png'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(extensionPath, file);
      expect(fs.existsSync(filePath)).toBeTruthy();
    }
  });
  
  test('popup page renders correctly', async ({ page }) => {
    // Test the popup HTML directly
    const popupPath = `file://${path.join(__dirname, '../../chrome-extension/popup.html')}`;
    await page.goto(popupPath);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/popup-ui.png' });
    
    // Check all UI elements exist
    await expect(page.locator('h1')).toContainText('bar123');
    await expect(page.locator('#pantryId')).toBeVisible();
    await expect(page.locator('#basketName')).toBeVisible();
    await expect(page.locator('#syncEnabled')).toBeVisible();
    await expect(page.locator('#syncNow')).toBeVisible();
    await expect(page.locator('#saveSettings')).toBeVisible();
    
    // Check labels
    await expect(page.locator('label[for="pantryId"]')).toContainText('Pantry ID:');
    await expect(page.locator('label[for="basketName"]')).toContainText('Basket Name:');
    
    // Check default values
    const basketNameValue = await page.locator('#basketName').getAttribute('placeholder');
    expect(basketNameValue).toBe('browser-history');
  });
  
  test('can fill popup form', async ({ page }) => {
    const popupPath = `file://${path.join(__dirname, '../../chrome-extension/popup.html')}`;
    await page.goto(popupPath);
    
    // Fill form
    await page.fill('#pantryId', 'test-pantry-id');
    await page.fill('#basketName', 'test-basket');
    await page.check('#syncEnabled');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/popup-filled.png' });
    
    // Verify values
    await expect(page.locator('#pantryId')).toHaveValue('test-pantry-id');
    await expect(page.locator('#basketName')).toHaveValue('test-basket');
    await expect(page.locator('#syncEnabled')).toBeChecked();
  });
});