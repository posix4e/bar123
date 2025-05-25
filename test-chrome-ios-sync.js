const { chromium } = require('playwright');
const path = require('path');

async function testChromeIOSSync() {
    console.log('🚀 Starting Chrome-iOS P2P sync test...');
    
    // Launch Chrome with extension
    const extensionPath = path.resolve(__dirname, 'chrome-extension');
    const browser = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-first-run',
            '--no-default-browser-check'
        ]
    });
    
    const page = await browser.newPage();
    
    try {
        // Navigate to test page
        await page.goto('https://example.com');
        console.log('📱 Chrome loaded with extension');
        
        // Wait for extension to be available
        await page.waitForTimeout(2000);
        
        // Click extension icon (usually in toolbar)
        console.log('🔌 Looking for extension popup...');
        
        // Try to access extension popup programmatically
        try {
            // Navigate to extension popup directly
            const pages = browser.pages();
            let extensionPage = null;
            
            // Look for existing extension pages
            for (const p of pages) {
                if (p.url().includes('chrome-extension://')) {
                    extensionPage = p;
                    break;
                }
            }
            
            if (!extensionPage) {
                // Create new page for extension popup
                extensionPage = await browser.newPage();
                // Get extension ID from manifest
                const extensionId = await page.evaluate(() => {
                    return chrome?.runtime?.id || 'unknown';
                });
                
                if (extensionId && extensionId !== 'unknown') {
                    await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
                    console.log('📝 Extension popup opened programmatically');
                } else {
                    throw new Error('Extension ID not found');
                }
            }
            
            // Fill room ID and connect
            await extensionPage.fill('#roomId', 'test123');
            await extensionPage.click('#connectBtn');
            
            console.log('✅ Chrome extension connected to room "test123"');
            console.log('📱 Status: Waiting for iOS peer...');
            
            // Monitor connection status
            await extensionPage.waitForSelector('#status:has-text("Connected")', { timeout: 30000 });
            const status = await extensionPage.textContent('#status');
            console.log(`🎉 Chrome status: ${status}`);
            
            // Test history sync by navigating to a page
            await page.goto('https://httpbin.org/json');
            console.log('🌐 Chrome navigated to test page');
            
            // Wait a bit for sync
            await page.waitForTimeout(3000);
            
        } catch (extensionError) {
            console.log('❌ Could not access extension popup programmatically');
            console.log('📋 Manual steps for Chrome:');
            console.log('1. Click the extension icon in Chrome toolbar');
            console.log('2. Enter "test123" in room field');
            console.log('3. Click Connect');
        }
        
        console.log('\n📱 iOS Safari Instructions:');
        console.log('1. Open Safari on iOS simulator');
        console.log('2. Tap aA button → Enable "History Sync" extension');
        console.log('3. Tap extension icon → enter "test123" → Connect');
        console.log('4. Browse different sites to test sync');
        
        // Keep browser open for manual testing
        console.log('\n⏳ Keeping Chrome open for testing...');
        console.log('Press Ctrl+C to exit when done testing');
        
        // Wait indefinitely until user stops the script
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Don't close automatically - let user test manually
        // await browser.close();
    }
}

if (require.main === module) {
    testChromeIOSSync().catch(console.error);
}

module.exports = { testChromeIOSSync };