/**
 * Helper utilities for Chrome extension testing with Playwright
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

export class ChromeExtensionHelper {
  constructor(extensionPath) {
    this.extensionPath = extensionPath;
    this.browser = null;
    this.extensionId = null;
  }

  async launch(options = {}) {
    const userDataDir = options.userDataDir || `/tmp/chrome-test-${Date.now()}`;
    
    this.browser = await chromium.launchPersistentContext(userDataDir, {
      headless: options.headless ?? false,
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(options.args || [])
      ],
      viewport: options.viewport || { width: 1280, height: 720 },
      ...options
    });

    // Get extension ID
    await this.waitForExtension();
    
    return this.browser;
  }

  async waitForExtension(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const workers = this.browser.serviceWorkers();
      
      for (const worker of workers) {
        if (worker.url().includes('chrome-extension://')) {
          this.extensionId = new URL(worker.url()).hostname;
          console.log(`Extension loaded with ID: ${this.extensionId}`);
          return this.extensionId;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('Extension failed to load within timeout');
  }

  async openPopup() {
    if (!this.extensionId) {
      throw new Error('Extension not loaded');
    }

    const popup = await this.browser.newPage();
    await popup.goto(`chrome-extension://${this.extensionId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    
    return popup;
  }

  async connectToRoom(popup, roomSecret) {
    // Wait for popup to be ready
    await popup.waitForSelector('#roomSecret', { state: 'visible' });
    
    // Clear and enter room secret
    await popup.fill('#roomSecret', '');
    await popup.type('#roomSecret', roomSecret);
    
    // Click connect
    await popup.click('#connectButton');
    
    // Wait for connection
    await popup.waitForFunction(
      () => {
        const status = document.querySelector('#connectionStatus');
        return status && (
          status.textContent.includes('Connected') || 
          status.textContent.includes('connected')
        );
      },
      { timeout: 30000 }
    );
    
    console.log(`Connected to room: ${roomSecret}`);
  }

  async getHistoryItems(popup) {
    // Switch to history tab if needed
    const historyTab = await popup.$('#historyTab');
    if (historyTab) {
      await historyTab.click();
      await popup.waitForTimeout(500);
    }

    return await popup.evaluate(() => {
      const items = [];
      document.querySelectorAll('.history-item').forEach(item => {
        const url = item.querySelector('.history-url')?.textContent;
        const title = item.querySelector('.history-title')?.textContent;
        const timestamp = item.querySelector('.history-time')?.getAttribute('data-timestamp');
        const isArticle = item.querySelector('.article-badge') !== null;
        const readingTime = item.querySelector('.reading-time')?.textContent;
        
        if (url) {
          items.push({
            url,
            title: title || '',
            timestamp: timestamp ? parseInt(timestamp) : null,
            isArticle,
            readingTime
          });
        }
      });
      return items;
    });
  }

  async getPeerCount(popup) {
    const peerCount = await popup.locator('#peerCount').textContent();
    return parseInt(peerCount) || 0;
  }

  async waitForPeers(popup, expectedCount, timeout = 30000) {
    await popup.waitForFunction(
      (count) => {
        const peerElement = document.querySelector('#peerCount');
        return peerElement && parseInt(peerElement.textContent) >= count;
      },
      expectedCount,
      { timeout }
    );
  }

  async visitPages(urls) {
    for (const url of urls) {
      const page = await this.browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        // Wait for content script to process
        await page.waitForTimeout(2000);
      } finally {
        await page.close();
      }
    }
  }

  async takeDebugScreenshot(page, name) {
    const screenshotDir = 'test-results/screenshots';
    await fs.mkdir(screenshotDir, { recursive: true });
    
    const screenshot = await page.screenshot({
      path: path.join(screenshotDir, `${name}-${Date.now()}.png`),
      fullPage: true
    });
    
    return screenshot;
  }

  async getExtensionLogs() {
    // Get background service worker logs
    const workers = this.browser.serviceWorkers();
    const logs = [];
    
    for (const worker of workers) {
      if (worker.url().includes(this.extensionId)) {
        // This would need to be implemented based on your logging setup
        // For now, return placeholder
        logs.push({
          type: 'service-worker',
          url: worker.url(),
          timestamp: Date.now()
        });
      }
    }
    
    return logs;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test data generators
export function generateTestHistory(count = 5) {
  const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
  const pages = ['', '/about', '/products', '/contact', '/blog'];
  
  return Array.from({ length: count }, (_, i) => ({
    url: `https://${domains[i % domains.length]}${pages[i % pages.length]}`,
    title: `Test Page ${i + 1}`,
    timestamp: Date.now() - (i * 60000) // 1 minute apart
  }));
}

export function generateRoomSecret(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}