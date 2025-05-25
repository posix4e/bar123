const { chromium } = require('playwright');
const path = require('path');

async function testChromeSimple() {
    console.log('🚀 Testing Chrome extension...');
    
    const extensionPath = path.resolve(__dirname, 'chrome-extension');
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-first-run'
        ]
    });
    
    const page = await context.newPage();
    await page.goto('https://example.com');
    
    console.log('✅ Chrome launched with extension');
    console.log('📋 Manual steps:');
    console.log('1. Click the puzzle piece icon in toolbar');
    console.log('2. Click "History Sync" extension');
    console.log('3. Enter "test123" as shared secret');
    console.log('4. Click Connect');
    console.log('5. Check status shows "Connected (0 peers)" or similar');
    console.log('\n⏳ Keeping browser open for testing...');
    
    // Keep open for manual testing
    await new Promise(() => {});
}

testChromeSimple().catch(console.error);