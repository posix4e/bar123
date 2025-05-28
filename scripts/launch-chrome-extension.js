#!/usr/bin/env node

const { chromium } = require('playwright');
const path = require('path');

async function launchChromeWithExtension() {
  console.log('🚀 Launching Chrome with History Sync extension...');
    
  // Build the extension first
  console.log('📦 Building extension...');
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Extension built successfully');
  } catch (error) {
    console.error('❌ Failed to build extension:', error.message);
    process.exit(1);
  }
    
  const extensionPath = path.resolve(__dirname, 'chrome-extension');
  const userDataDir = path.join(__dirname, 'temp-chrome-profile-' + Date.now());
    
  console.log(`📂 Extension path: ${extensionPath}`);
  console.log(`💾 Profile directory: ${userDataDir}`);
    
  try {
    // Launch Chrome with extension
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      viewport: { width: 1280, height: 720 }
    });
        
    const page = await context.newPage();
        
    console.log('✅ Chrome launched with extension');
    console.log('📱 Extension should appear in the toolbar');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Click the History Sync extension icon in the toolbar');
    console.log('2. Enter a shared secret (e.g., "test123")');
    console.log('3. Click Connect');
    console.log('4. Status should show "Connected (0 peers)" or "Connected (1 peers)" if iOS joins');
    console.log('');
    console.log('📱 For iOS testing:');
    console.log('1. Open Safari in iOS Simulator');
    console.log('2. Tap aA button → Enable "History Sync" extension');
    console.log('3. Tap extension icon → enter same secret → Connect');
    console.log('');
    console.log('⏳ Chrome will stay open for testing...');
    console.log('💡 Press Ctrl+C to exit when done');
        
    // Navigate to a test page
    await page.goto('https://example.com');
        
    // Keep running until user stops
    const cleanup = () => {
      console.log('\n🧹 Cleaning up...');
      context.close().then(() => {
        console.log('✅ Chrome closed');
                
        // Clean up temp profile
        const fs = require('fs');
        if (fs.existsSync(userDataDir)) {
          console.log('🗑️  Removing temporary profile...');
          try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
            console.log('✅ Temporary profile cleaned up');
          } catch (error) {
            console.warn('⚠️  Could not clean up profile:', error.message);
          }
        }
                
        process.exit(0);
      });
    };
        
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
        
    // Wait indefinitely
    await new Promise(() => {});
        
  } catch (error) {
    console.error('❌ Failed to launch Chrome:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  launchChromeWithExtension().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { launchChromeWithExtension };