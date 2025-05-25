const { chromium } = require('playwright');
const path = require('path');

async function debugChromeExtension() {
    console.log('🚀 Starting Chrome extension debug session...');
    
    // Launch Chrome with extension and developer mode
    const extensionPath = path.resolve(__dirname, 'chrome-extension');
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ],
        devtools: true
    });
    
    const page = await context.newPage();
    
    try {
        // Navigate to test page first
        await page.goto('https://example.com');
        console.log('📱 Chrome loaded with extension');
        
        // Enable console logging for all pages
        page.on('console', msg => {
            console.log(`[Page Console] ${msg.type()}: ${msg.text()}`);
        });
        
        // Wait for extension to load
        await page.waitForTimeout(2000);
        
        // Open extension manager to get extension ID
        await page.goto('chrome://extensions/');
        await page.waitForTimeout(1000);
        
        // Try to find the extension ID
        const extensionCards = await page.$$('extensions-item');
        let extensionId = null;
        
        for (const card of extensionCards) {
            const nameElement = await card.$('.name');
            if (nameElement) {
                const name = await nameElement.textContent();
                if (name && name.includes('History Sync')) {
                    extensionId = await card.getAttribute('id');
                    break;
                }
            }
        }
        
        if (extensionId) {
            console.log(`📝 Found extension ID: ${extensionId}`);
            
            // Open extension popup
            const popupUrl = `chrome-extension://${extensionId}/popup.html`;
            const popupPage = await context.newPage();
            
            // Enable console logging for popup
            popupPage.on('console', msg => {
                console.log(`[Extension Console] ${msg.type()}: ${msg.text()}`);
            });
            
            await popupPage.goto(popupUrl);
            console.log('📝 Extension popup opened');
            
            // Check if elements exist
            const statusElement = await popupPage.$('#status');
            const secretInput = await popupPage.$('#sharedSecret');
            const connectBtn = await popupPage.$('#connectBtn');
            
            console.log('✅ Status element found:', !!statusElement);
            console.log('✅ Secret input found:', !!secretInput);
            console.log('✅ Connect button found:', !!connectBtn);
            
            if (secretInput && connectBtn) {
                // Fill and submit
                await secretInput.fill('test123');
                console.log('📝 Filled secret: test123');
                
                await connectBtn.click();
                console.log('🔌 Clicked connect button');
                
                // Wait and check status
                await popupPage.waitForTimeout(3000);
                const status = await popupPage.textContent('#status');
                console.log('📊 Connection status:', status);
            }
            
            // Keep popup open for manual inspection
            console.log('\n🔍 Debug session ready:');
            console.log('- Extension popup is open');
            console.log('- Console logs are being captured');
            console.log('- Inspect the extension background script at chrome://extensions/');
            console.log('- Press Ctrl+C to exit');
            
            // Wait indefinitely
            await new Promise(() => {});
            
        } else {
            console.log('❌ Extension not found. Make sure it\'s loaded properly.');
            console.log('📋 Manual debug steps:');
            console.log('1. Go to chrome://extensions/');
            console.log('2. Enable Developer mode');
            console.log('3. Click "Load unpacked" and select chrome-extension folder');
            console.log('4. Click on the extension to see its console logs');
        }
        
    } catch (error) {
        console.error('❌ Debug error:', error.message);
    }
}

if (require.main === module) {
    debugChromeExtension().catch(console.error);
}

module.exports = { debugChromeExtension };