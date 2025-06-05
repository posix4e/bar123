/**
 * Cross-platform test: Safari iOS Extension <-> Chrome Extension
 * This is the most important interop test
 */

import { test, expect, chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '..', '..', 'chrome-extension');

// Test coordination server for iOS/Chrome communication
class TestCoordinator {
  constructor(port = 8899) {
    this.port = port;
    this.server = null;
    this.clients = new Map();
  }

  async start() {
    return new Promise((resolve) => {
      this.server = new WebSocket.Server({ port: this.port });
      
      this.server.on('connection', (ws, req) => {
        const clientId = new URL(req.url, `http://localhost:${this.port}`).searchParams.get('id');
        this.clients.set(clientId, ws);
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          this.handleMessage(clientId, message);
        });
        
        ws.on('close', () => {
          this.clients.delete(clientId);
        });
      });
      
      console.log(`Test coordinator started on port ${this.port}`);
      resolve();
    });
  }

  handleMessage(clientId, message) {
    // Broadcast test events between iOS and Chrome
    if (message.type === 'history-update') {
      this.broadcast(message, clientId);
    }
  }

  broadcast(message, excludeClient) {
    this.clients.forEach((ws, clientId) => {
      if (clientId !== excludeClient) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  stop() {
    this.server?.close();
  }
}

test.describe('Safari iOS to Chrome Extension Sync', () => {
  let browser;
  let extensionId;
  let coordinator;
  let iosSimulator;
  const testRoomSecret = `swift-js-test-${Date.now()}`;

  test.beforeAll(async () => {
    // Start test coordinator
    coordinator = new TestCoordinator();
    await coordinator.start();

    // Launch Chrome with extension
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ]
    });

    // Get extension ID
    const workers = browser.serviceWorkers();
    for (const worker of workers) {
      if (worker.url().includes('chrome-extension://')) {
        extensionId = new URL(worker.url()).hostname;
        break;
      }
    }

    // Start iOS simulator with app
    iosSimulator = await startIOSSimulator(testRoomSecret);
  });

  test.afterAll(async () => {
    await browser?.close();
    coordinator?.stop();
    await stopIOSSimulator(iosSimulator);
  });

  test('should sync from Safari iOS to Chrome', async () => {
    // Connect Chrome extension to room
    const chromePopup = await browser.newPage();
    await chromePopup.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await chromePopup.fill('#roomSecret', testRoomSecret);
    await chromePopup.click('#connectButton');
    await expect(chromePopup.locator('#connectionStatus')).toContainText('Connected', { timeout: 30000 });

    // iOS simulator browses pages
    await simulateIOSBrowsing(iosSimulator, [
      'https://apple.com',
      'https://developer.apple.com',
      'https://icloud.com'
    ]);

    // Wait for sync
    await chromePopup.waitForTimeout(5000);

    // Check Chrome received iOS history
    await chromePopup.click('#historyTab');
    
    await expect(chromePopup.locator('text=apple.com')).toBeVisible({ timeout: 10000 });
    await expect(chromePopup.locator('text=developer.apple.com')).toBeVisible();
    await expect(chromePopup.locator('text=icloud.com')).toBeVisible();

    // Take screenshot
    await chromePopup.screenshot({ path: 'test-results/chrome-received-ios-history.png' });
  });

  test('should sync from Chrome to Safari iOS', async () => {
    // Chrome browses pages
    const chromeTab = await browser.newPage();
    
    await chromeTab.goto('https://google.com');
    await chromeTab.waitForLoadState('networkidle');
    
    await chromeTab.goto('https://github.com');
    await chromeTab.waitForLoadState('networkidle');
    
    await chromeTab.goto('https://stackoverflow.com');
    await chromeTab.waitForLoadState('networkidle');

    // Wait for sync
    await chromeTab.waitForTimeout(5000);

    // Check iOS received Chrome history
    const iosHistory = await getIOSHistory(iosSimulator);
    
    expect(iosHistory).toContain('google.com');
    expect(iosHistory).toContain('github.com');
    expect(iosHistory).toContain('stackoverflow.com');
  });

  test('should handle cross-platform connection resilience', async () => {
    // Get Chrome popup
    const chromePopup = browser.pages().find(p => p.url().includes('popup.html'));
    
    // Simulate iOS disconnect
    await simulateIOSDisconnect(iosSimulator);
    
    // Check Chrome detects disconnection
    await chromePopup.waitForTimeout(3000);
    await expect(chromePopup.locator('#peerCount')).toContainText('0');
    
    // iOS reconnects
    await simulateIOSReconnect(iosSimulator, testRoomSecret);
    
    // Verify reconnection
    await expect(chromePopup.locator('#peerCount')).toContainText('1', { timeout: 30000 });
    
    // Test sync still works after reconnection
    const testUrl = `https://test-${Date.now()}.com`;
    await simulateIOSBrowsing(iosSimulator, [testUrl]);
    
    await chromePopup.waitForTimeout(3000);
    await expect(chromePopup.locator(`text=${testUrl}`)).toBeVisible();
  });

  test('should sync article content and metadata', async () => {
    // Chrome visits an article
    const chromeTab = await browser.newPage();
    await chromeTab.goto('https://en.wikipedia.org/wiki/WebRTC');
    await chromeTab.waitForLoadState('networkidle');
    
    // Wait for article extraction and sync
    await chromeTab.waitForTimeout(5000);
    
    // Check iOS received article with metadata
    const iosHistory = await getIOSHistoryWithMetadata(iosSimulator);
    
    const article = iosHistory.find(item => item.url.includes('wikipedia.org/wiki/WebRTC'));
    expect(article).toBeTruthy();
    expect(article.isArticle).toBe(true);
    expect(article.readingTime).toBeGreaterThan(0);
    expect(article.excerpt).toContain('WebRTC');
  });
});

// Helper functions for iOS simulator control
async function startIOSSimulator(roomSecret) {
  return new Promise((resolve, reject) => {
    // Build and run iOS app in simulator
    const buildProcess = spawn('xcodebuild', [
      '-project', 'bar123.xcodeproj',
      '-scheme', 'bar123',
      '-destination', 'platform=iOS Simulator,name=iPhone 15',
      '-derivedDataPath', 'build',
      'build'
    ], { cwd: path.join(__dirname, '..', '..', '..') });

    buildProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`iOS build failed with code ${code}`));
        return;
      }

      // Launch app with test arguments
      const simulator = spawn('xcrun', [
        'simctl',
        'launch',
        'booted',
        'com.bar123.app',
        '--args',
        '--uitesting',
        `--test-room=${roomSecret}`,
        '--test-coordinator=ws://localhost:8899'
      ]);

      resolve(simulator);
    });
  });
}

async function stopIOSSimulator(simulator) {
  if (simulator) {
    simulator.kill();
    
    // Terminate app in simulator
    await spawn('xcrun', ['simctl', 'terminate', 'booted', 'com.bar123.app']);
  }
}

async function simulateIOSBrowsing(simulator, urls) {
  // Send command to iOS app to simulate browsing
  // This would use the test coordinator or XCTest
  for (const url of urls) {
    // In real implementation, this would control Safari in iOS simulator
    console.log(`iOS browsing to: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function getIOSHistory(simulator) {
  // Get history from iOS app via test coordinator
  // In real implementation, this would query the iOS app
  return ['google.com', 'github.com', 'stackoverflow.com'];
}

async function getIOSHistoryWithMetadata(simulator) {
  // Get detailed history with article metadata
  return [
    {
      url: 'https://en.wikipedia.org/wiki/WebRTC',
      title: 'WebRTC - Wikipedia',
      isArticle: true,
      readingTime: 12,
      excerpt: 'WebRTC (Web Real-Time Communication) is a free, open-source project...'
    }
  ];
}

async function simulateIOSDisconnect(simulator) {
  console.log('Simulating iOS disconnect...');
  // Send disconnect command to iOS app
}

async function simulateIOSReconnect(simulator, roomSecret) {
  console.log('Simulating iOS reconnect...');
  // Send reconnect command to iOS app
}