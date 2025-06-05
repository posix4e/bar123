/**
 * Example: Complete end-to-end sync test using all helpers
 * This demonstrates a real-world test scenario
 */

import { test, expect } from '@playwright/test';
import { ChromeExtensionHelper, generateRoomSecret } from '../test-helpers/chrome-extension-helper.js';
import { IOSSimulatorHelper } from '../test-helpers/ios-simulator-helper.js';
import { TestCoordinator, TestSequenceBuilder } from '../test-helpers/test-coordinator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..', '..');

test.describe('Full Sync Test Example', () => {
  let coordinator;
  let chromeHelper;
  let iosHelper;
  let roomSecret;

  test.beforeAll(async () => {
    // Start test coordinator
    coordinator = new TestCoordinator();
    await coordinator.start();
    
    // Generate room secret for this test
    roomSecret = generateRoomSecret('full-sync');
    console.log(`Test room: ${roomSecret}`);
  });

  test.afterAll(async () => {
    await chromeHelper?.cleanup();
    await iosHelper?.cleanup();
    await coordinator?.stop();
  });

  test('complete sync workflow between Chrome and iOS', async () => {
    // Step 1: Launch Chrome extension
    console.log('\n📱 Step 1: Launching Chrome extension...');
    chromeHelper = new ChromeExtensionHelper(
      path.join(projectRoot, 'chrome-extension')
    );
    
    const chromeBrowser = await chromeHelper.launch({
      headless: false // Set to true for CI
    });
    
    const chromePopup = await chromeHelper.openPopup();
    await chromeHelper.takeDebugScreenshot(chromePopup, 'chrome-initial');
    
    // Connect Chrome to room
    await chromeHelper.connectToRoom(chromePopup, roomSecret);
    
    // Verify Chrome is connected
    const chromeStatus = await chromePopup.locator('#connectionStatus').textContent();
    expect(chromeStatus).toContain('Connected');
    
    // Step 2: Launch iOS app
    console.log('\n📱 Step 2: Launching iOS app...');
    iosHelper = new IOSSimulatorHelper(projectRoot);
    
    // Get or create simulator
    await iosHelper.getOrCreateSimulator();
    await iosHelper.bootSimulator();
    
    // Build and install app
    await iosHelper.buildAndInstallApp();
    
    // Launch with test arguments
    await iosHelper.launchApp([
      '--uitesting',
      `--test-room=${roomSecret}`,
      `--test-coordinator=ws://localhost:${coordinator.port}?id=ios&type=safari`
    ]);
    
    // Wait for both clients to connect to coordinator
    await coordinator.waitForClients(['chrome', 'safari'], 30000);
    console.log('✅ Both clients connected to test coordinator');
    
    // Step 3: Chrome browses pages
    console.log('\n🌐 Step 3: Chrome browsing test pages...');
    const testUrls = [
      'https://example.com',
      'https://en.wikipedia.org/wiki/Peer-to-peer',
      'https://github.com'
    ];
    
    await chromeHelper.visitPages(testUrls);
    
    // Wait for history to be tracked
    await chromePopup.waitForTimeout(2000);
    
    // Verify Chrome has history
    const chromeHistory = await chromeHelper.getHistoryItems(chromePopup);
    expect(chromeHistory.length).toBeGreaterThanOrEqual(3);
    console.log(`Chrome has ${chromeHistory.length} history items`);
    
    // Take screenshot of Chrome history
    await chromeHelper.takeDebugScreenshot(chromePopup, 'chrome-history');
    
    // Step 4: Wait for sync to iOS
    console.log('\n🔄 Step 4: Waiting for sync to iOS...');
    
    // Use coordinator to verify sync
    const syncEvent = coordinator.waitForEvent('test-event', 30000);
    
    // iOS should report receiving history
    const event = await syncEvent;
    expect(event.event).toBe('history-received');
    
    // Take iOS screenshot
    await iosHelper.takeScreenshot('ios-after-sync');
    
    // Step 5: iOS browses pages
    console.log('\n📱 Step 5: iOS browsing test pages...');
    await iosHelper.openSafariAndBrowse([
      'https://apple.com',
      'https://developer.apple.com'
    ]);
    
    // Step 6: Wait for reverse sync
    console.log('\n🔄 Step 6: Waiting for sync to Chrome...');
    await chromePopup.waitForTimeout(5000);
    
    // Refresh Chrome history view
    await chromePopup.click('#refreshButton');
    
    // Check Chrome received iOS history
    const updatedHistory = await chromeHelper.getHistoryItems(chromePopup);
    const hasApplePages = updatedHistory.some(item => 
      item.url.includes('apple.com')
    );
    
    expect(hasApplePages).toBe(true);
    console.log('✅ Chrome received iOS history');
    
    // Step 7: Test article extraction
    console.log('\n📄 Step 7: Testing article extraction...');
    
    // Visit an article page
    const articlePage = await chromeBrowser.newPage();
    await articlePage.goto('https://en.wikipedia.org/wiki/WebRTC');
    await articlePage.waitForLoadState('networkidle');
    await articlePage.waitForTimeout(3000); // Wait for extraction
    await articlePage.close();
    
    // Check if article was detected
    await chromePopup.click('#refreshButton');
    const historyWithArticle = await chromeHelper.getHistoryItems(chromePopup);
    const article = historyWithArticle.find(item => 
      item.url.includes('wikipedia.org/wiki/WebRTC')
    );
    
    expect(article).toBeTruthy();
    expect(article.isArticle).toBe(true);
    expect(article.readingTime).toBeTruthy();
    console.log('✅ Article extraction working');
    
    // Step 8: Test peer count
    console.log('\n👥 Step 8: Verifying peer connections...');
    const peerCount = await chromeHelper.getPeerCount(chromePopup);
    expect(peerCount).toBeGreaterThanOrEqual(1);
    console.log(`Chrome shows ${peerCount} connected peer(s)`);
    
    // Final screenshots
    await chromeHelper.takeDebugScreenshot(chromePopup, 'chrome-final');
    await iosHelper.takeScreenshot('ios-final');
    
    // Get logs for debugging
    const chromeLogs = await chromeHelper.getExtensionLogs();
    const iosLogs = await iosHelper.getAppLogs();
    const coordinatorLog = coordinator.getMessageLog();
    
    console.log('\n📊 Test Summary:');
    console.log(`- Chrome history items: ${updatedHistory.length}`);
    console.log(`- Connected peers: ${peerCount}`);
    console.log(`- Coordinator messages: ${coordinatorLog.length}`);
    console.log('✅ Full sync test completed successfully!');
  });

  test('test connection resilience', async () => {
    // This test would simulate disconnections and reconnections
    console.log('\n🔌 Testing connection resilience...');
    
    // Use existing connections from previous test or set up new ones
    
    // Create test sequence
    const sequence = new TestSequenceBuilder()
      .broadcast({ type: 'simulate-disconnect' }, 'Simulate disconnect')
      .wait(3000, 'Wait for disconnect')
      .broadcast({ type: 'simulate-reconnect' }, 'Simulate reconnect')
      .wait(5000, 'Wait for reconnection')
      .waitForEvent('peer-connected', 10000, 'Wait for peer reconnection')
      .build();
    
    const results = await coordinator.executeTestSequence(sequence);
    
    // Verify all steps succeeded
    const failed = results.filter(r => !r.success);
    expect(failed).toHaveLength(0);
    
    console.log('✅ Connection resilience test passed');
  });
});