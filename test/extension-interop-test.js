#!/usr/bin/env node

/**
 * End-to-end test for Chrome extension to Chrome extension communication
 * Tests actual history synchronization between two browser instances
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', 'chrome-extension');

// Test configuration
const ROOM_SECRET = 'test-room-' + Date.now();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupBrowser(profileName) {
  console.log(`Setting up browser: ${profileName}`);
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--user-data-dir=/tmp/chrome-profile-${profileName}`
    ]
  });

  // Get extension ID
  const targets = await browser.targets();
  const extensionTarget = targets.find(target => 
    target.type() === 'service_worker' && 
    target.url().includes('chrome-extension://')
  );
  
  if (!extensionTarget) {
    throw new Error('Extension not loaded');
  }

  const extensionId = new URL(extensionTarget.url()).hostname;
  console.log(`Extension ID for ${profileName}: ${extensionId}`);

  return { browser, extensionId };
}

async function getExtensionPopup(browser, extensionId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForSelector('#roomSecret', { timeout: 5000 });
  return page;
}

async function connectToRoom(popup, roomSecret) {
  console.log(`Connecting to room: ${roomSecret}`);
  
  // Enter room secret
  await popup.type('#roomSecret', roomSecret);
  await popup.click('#connectButton');
  
  // Wait for connection
  await popup.waitForFunction(
    () => {
      const status = document.querySelector('#connectionStatus');
      return status && status.textContent.includes('Connected');
    },
    { timeout: 30000 }
  );
  
  console.log('Connected to room');
}

async function visitTestPages(browser) {
  const testUrls = [
    'https://example.com',
    'https://www.wikipedia.org',
    'https://www.github.com'
  ];

  for (const url of testUrls) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(1000); // Let content script track the visit
    await page.close();
  }

  console.log('Visited test pages');
}

async function getHistoryFromPopup(popup) {
  // Click on history tab if needed
  const historyTab = await popup.$('#historyTab');
  if (historyTab) {
    await historyTab.click();
    await delay(500);
  }

  // Get history entries
  const history = await popup.evaluate(() => {
    const entries = [];
    const historyElements = document.querySelectorAll('.history-item');
    
    historyElements.forEach(el => {
      const url = el.querySelector('.history-url')?.textContent;
      const title = el.querySelector('.history-title')?.textContent;
      if (url) {
        entries.push({ url, title });
      }
    });
    
    return entries;
  });

  return history;
}

async function runTest() {
  console.log('🧪 Starting Chrome Extension Interop Test\n');

  let browser1, browser2, extensionId1, extensionId2;

  try {
    // Build extension first
    console.log('Building extension...');
    await fs.access(extensionPath);
    
    // Setup two browser instances
    ({ browser: browser1, extensionId: extensionId1 } = await setupBrowser('user1'));
    ({ browser: browser2, extensionId: extensionId2 } = await setupBrowser('user2'));

    // Get popup pages
    const popup1 = await getExtensionPopup(browser1, extensionId1);
    const popup2 = await getExtensionPopup(browser2, extensionId2);

    // Connect both to the same room
    await connectToRoom(popup1, ROOM_SECRET);
    await delay(2000);
    await connectToRoom(popup2, ROOM_SECRET);

    // Wait for peer discovery
    console.log('Waiting for peer discovery...');
    await delay(5000);

    // Browser 1 visits some pages
    console.log('\nBrowser 1 visiting pages...');
    await visitTestPages(browser1);

    // Wait for sync
    console.log('Waiting for history sync...');
    await delay(5000);

    // Check if Browser 2 received the history
    console.log('\nChecking Browser 2 history...');
    const history2 = await getHistoryFromPopup(popup2);

    console.log(`Browser 2 received ${history2.length} history entries`);

    // Verify the test URLs are present
    const testPassed = history2.some(entry => entry.url.includes('example.com')) &&
                      history2.some(entry => entry.url.includes('wikipedia.org'));

    if (testPassed) {
      console.log('\n✅ Chrome-Chrome interop test PASSED!');
      console.log('History successfully synced between extensions');
    } else {
      console.log('\n❌ Chrome-Chrome interop test FAILED!');
      console.log('Expected URLs not found in synced history');
      console.log('Received history:', history2);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    if (browser1) {await browser1.close();}
    if (browser2) {await browser2.close();}
  }
}

// Run the test
runTest().catch(console.error);