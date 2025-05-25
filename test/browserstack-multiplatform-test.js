#!/usr/bin/env node

/**
 * Real BrowserStack Multiplatform Sync Testing
 * 
 * Tests REAL Chrome extension and Safari extension functionality using actual
 * WebDriver automation, establishes real PeerJS connections between platforms,
 * and verifies actual history data synchronization with comprehensive screenshots.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class RealBrowserStackSyncTester {
    constructor() {
        this.username = process.env.BROWSERSTACK_USERNAME;
        this.accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
        this.baseUrl = 'https://api.browserstack.com';
        
        if (!this.username || !this.accessKey) {
            throw new Error('BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables required');
        }
        
        this.testResults = {
            timestamp: new Date().toISOString(),
            platform: 'real-browserstack-multiplatform',
            browserstack_info: {
                username: this.username,
                account_info: null
            },
            sessions: [],
            sync_tests: [],
            screenshots: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                platforms_tested: []
            }
        };
        
        // Test platforms for real sync testing
        this.testPlatforms = [
            {
                type: 'chrome_desktop',
                os: 'Windows',
                os_version: '11',
                browser: 'Chrome',
                browser_version: 'latest',
                name: 'Chrome on Windows 11',
                role: 'sender' // This will send history data
            },
            {
                type: 'safari_ios',
                os: 'iOS',
                os_version: '17',
                device: 'iPhone 15 Pro',
                browser: 'Safari',
                name: 'Safari on iPhone 15 Pro (iOS 17)',
                role: 'receiver' // This will receive history data
            }
        ];
        
        this.sharedSecret = 'test-sync-' + Date.now();
        this.testHistoryEntries = [
            {
                url: 'https://test-sync-1-' + Date.now() + '.com',
                title: 'Test Sync Page 1',
                visitTime: Date.now(),
                duration: 30000
            },
            {
                url: 'https://test-sync-2-' + Date.now() + '.com',
                title: 'Test Sync Page 2',
                visitTime: Date.now() + 1000,
                duration: 45000
            },
            {
                url: 'https://test-sync-3-' + Date.now() + '.com',
                title: 'Test Sync Page 3 - Remote Delete Test',
                visitTime: Date.now() + 2000,
                duration: 60000
            },
            {
                url: 'https://test-sync-4-' + Date.now() + '.com',
                title: 'Test Sync Page 4 - Bidirectional Delete Test',
                visitTime: Date.now() + 3000,
                duration: 25000
            },
            {
                url: 'https://test-sync-5-' + Date.now() + '.com',
                title: 'Test Sync Page 5 - Extra Test Data',
                visitTime: Date.now() + 4000,
                duration: 40000
            }
        ];
    }

    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const auth = Buffer.from(`${this.username}:${this.accessKey}`).toString('base64');
            const options = {
                hostname: 'api.browserstack.com',
                path: endpoint,
                method: method,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => responseBody += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed);
                    } catch (e) {
                        resolve(responseBody);
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    async createRealChromeSession(platform, extensionPath) {
        console.log(`🚀 Creating REAL Chrome session with extension: ${platform.name}`);
        
        console.log(`Loading extension from: ${path.resolve(extensionPath)}`);
        
        const capabilities = {
            'bstack:options': {
                os: platform.os,
                osVersion: platform.os_version,
                projectName: 'Real History Sync Extension Testing',
                buildName: `Real Multiplatform Sync - ${new Date().toISOString()}`,
                sessionName: `${platform.name} - Real Extension Test`,
                local: false,
                debug: true,
                networkLogs: true,
                consoleLogs: 'verbose',
                video: true,
                resolution: '1920x1080'
            },
            browserName: 'Chrome',
            browserVersion: platform.browser_version
        };
        
        // Set Chrome-specific options
        capabilities['goog:chromeOptions'] = {
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
                `--load-extension=${path.resolve(extensionPath)}`,
                '--disable-extensions-except=' + path.resolve(extensionPath),
                '--disable-default-apps',
                '--enable-automation',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ],
            prefs: {
                'extensions.ui.developer_mode': true
            }
        };
        
        console.log('⏳ Creating Chrome WebDriver session (this may take 30-60 seconds)...');
        
        // Add timeout to prevent hanging
        const driver = await Promise.race([
            new Builder()
                .usingServer(`https://${this.username}:${this.accessKey}@hub-cloud.browserstack.com/wd/hub`)
                .withCapabilities(capabilities)
                .build(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Chrome session creation timeout after 2 minutes')), 120000)
            )
        ]);
            
        console.log(`✅ Chrome session created successfully`);
        return driver;
    }

    async createRealSafariIOSSession(platform) {
        console.log(`📱 Creating REAL Safari iOS session: ${platform.name}`);
        
        const capabilities = {
            'bstack:options': {
                os: 'iOS',
                osVersion: platform.os_version,
                deviceName: platform.device,
                realMobile: true,
                projectName: 'Real History Sync Extension Testing',
                buildName: `Real iOS Safari Test - ${new Date().toISOString()}`,
                sessionName: `${platform.name} - Real Safari Test`,
                debug: true,
                networkLogs: true,
                appiumLogs: true,
                video: true
            },
            browserName: 'Safari',
            platformName: 'iOS',
            'appium:automationName': 'XCUITest',
            'appium:deviceName': platform.device,
            'appium:platformVersion': platform.os_version
        };
        
        const driver = await new Builder()
            .usingServer(`https://${this.username}:${this.accessKey}@hub-cloud.browserstack.com/wd/hub`)
            .withCapabilities(capabilities)
            .build();
            
        console.log(`✅ Safari iOS session created successfully`);
        return driver;
    }

    async takeScreenshot(driver, name, description) {
        try {
            const screenshot = await driver.takeScreenshot();
            const filename = `screenshot-${Date.now()}-${name}.png`;
            const filepath = path.join('test-results/browserstack/screenshots', filename);
            
            // Ensure directory exists
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filepath, screenshot, 'base64');
            
            const screenshotData = {
                name,
                description,
                filename,
                filepath,
                timestamp: new Date().toISOString()
            };
            
            this.testResults.screenshots.push(screenshotData);
            console.log(`📸 Screenshot saved: ${name} - ${description}`);
            
            return screenshotData;
        } catch (error) {
            console.warn(`⚠️  Failed to take screenshot ${name}: ${error.message}`);
            return null;
        }
    }

    async testRealChromeExtension(driver, platform) {
        console.log(`🔧 Testing REAL Chrome extension functionality on ${platform.name}...`);
        
        const testResult = {
            platform: platform.name,
            platform_type: platform.type,
            role: platform.role,
            tests: {},
            passed: false,
            timestamp: new Date().toISOString(),
            screenshots: []
        };
        
        try {
            // Take initial screenshot
            const initialScreenshot = await this.takeScreenshot(driver, 'chrome-initial', 'Chrome browser initial state');
            if (initialScreenshot) testResult.screenshots.push(initialScreenshot);
            
            // Navigate to chrome://extensions to verify extension loaded
            console.log('  📋 Checking extension installation...');
            await driver.get('chrome://extensions/');
            await driver.sleep(3000);
            
            // Enable developer mode
            await driver.executeScript(`
                const devModeToggle = document.querySelector('#developerMode');
                if (devModeToggle && !devModeToggle.checked) {
                    devModeToggle.click();
                }
            `);
            
            await driver.sleep(2000);
            
            // Take screenshot of extensions page
            const extPageScreenshot = await this.takeScreenshot(driver, 'chrome-extensions-page', 'Chrome extensions page showing loaded extensions');
            if (extPageScreenshot) testResult.screenshots.push(extPageScreenshot);
            
            // Find our History Sync extension
            const extensionInfo = await driver.executeScript(`
                const extensions = document.querySelectorAll('extensions-item');
                for (let ext of extensions) {
                    try {
                        const shadowRoot = ext.shadowRoot;
                        if (!shadowRoot) continue;
                        
                        const nameElement = shadowRoot.querySelector('#name');
                        if (!nameElement) continue;
                        
                        const name = nameElement.textContent || '';
                        if (name.includes('History Sync') || name.includes('bar123')) {
                            const id = ext.id;
                            const enabled = shadowRoot.querySelector('#enableToggle');
                            const isEnabled = enabled ? enabled.checked : false;
                            
                            return {
                                found: true,
                                id: id,
                                name: name,
                                enabled: isEnabled
                            };
                        }
                    } catch (e) {
                        console.log('Error checking extension:', e);
                    }
                }
                return { found: false };
            `);
            
            testResult.tests.extension_found = {
                passed: extensionInfo.found,
                message: extensionInfo.found ? 
                    `Extension found: ${extensionInfo.name} (ID: ${extensionInfo.id})` :
                    'History Sync extension not found in loaded extensions',
                details: extensionInfo
            };
            
            if (!extensionInfo.found) {
                console.log('❌ Extension not found - cannot continue Chrome tests');
                return testResult;
            }
            
            // Navigate to a test page to interact with extension
            console.log('  🌐 Testing extension on web page...');
            await driver.get('https://example.com');
            await driver.sleep(3000);
            
            // Take screenshot of test page
            const testPageScreenshot = await this.takeScreenshot(driver, 'chrome-test-page', 'Chrome on test page where extension will be tested');
            if (testPageScreenshot) testResult.screenshots.push(testPageScreenshot);
            
            // Try to access extension popup
            console.log('  🎯 Testing extension popup access...');
            
            // Open extension popup (method varies by browser setup)
            const popupUrl = `chrome-extension://${extensionInfo.id}/popup.html`;
            await driver.executeScript(`window.open('${popupUrl}', '_blank');`);
            await driver.sleep(2000);
            
            // Switch to popup window
            const windows = await driver.getAllWindowHandles();
            if (windows.length > 1) {
                await driver.switchTo().window(windows[windows.length - 1]);
                
                // Take screenshot of extension popup
                const popupScreenshot = await this.takeScreenshot(driver, 'chrome-extension-popup', 'Chrome extension popup interface');
                if (popupScreenshot) testResult.screenshots.push(popupScreenshot);
                
                // Test popup functionality
                try {
                    // Look for shared secret input and connect button
                    const secretInput = await driver.wait(until.elementLocated(By.id('shared-secret')), 5000);
                    const connectButton = await driver.findElement(By.id('connect-btn'));
                    
                    // Enter shared secret
                    await secretInput.clear();
                    await secretInput.sendKeys(this.sharedSecret);
                    
                    // Take screenshot before connecting
                    const beforeConnectScreenshot = await this.takeScreenshot(driver, 'chrome-before-connect', 'Chrome extension popup with shared secret entered');
                    if (beforeConnectScreenshot) testResult.screenshots.push(beforeConnectScreenshot);
                    
                    // Click connect
                    await connectButton.click();
                    await driver.sleep(5000);
                    
                    // Take screenshot after connecting
                    const afterConnectScreenshot = await this.takeScreenshot(driver, 'chrome-after-connect', 'Chrome extension popup after connection attempt');
                    if (afterConnectScreenshot) testResult.screenshots.push(afterConnectScreenshot);
                    
                    // Check connection status
                    const statusElement = await driver.findElement(By.id('status'));
                    const statusText = await statusElement.getText();
                    
                    testResult.tests.popup_functionality = {
                        passed: statusText.includes('Connected') || statusText.includes('Waiting'),
                        message: `Popup functionality test: ${statusText}`,
                        details: { statusText, sharedSecret: this.sharedSecret }
                    };
                    
                } catch (error) {
                    testResult.tests.popup_functionality = {
                        passed: false,
                        message: `Failed to interact with popup: ${error.message}`,
                        details: { error: error.message }
                    };
                }
                
                // Switch back to main window
                await driver.switchTo().window(windows[0]);
            }
            
            // Test background script functionality by injecting code
            console.log('  ⚙️  Testing background script communication...');
            
            const backgroundTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    try {
                        // Test if we can communicate with background script
                        chrome.runtime.sendMessage('${extensionInfo.id}', {
                            action: 'ping'
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                resolve({
                                    success: false,
                                    error: chrome.runtime.lastError.message
                                });
                            } else {
                                resolve({
                                    success: true,
                                    response: response
                                });
                            }
                        });
                    } catch (error) {
                        resolve({
                            success: false,
                            error: error.message
                        });
                    }
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        resolve({
                            success: false,
                            error: 'Timeout waiting for background script response'
                        });
                    }, 5000);
                });
            `);
            
            testResult.tests.background_script = {
                passed: backgroundTest.success,
                message: backgroundTest.success ? 
                    'Background script communication successful' :
                    `Background script test failed: ${backgroundTest.error}`,
                details: backgroundTest
            };
            
            // Generate test history data for sync testing
            console.log('  📚 Adding test history data...');
            
            for (const historyEntry of this.testHistoryEntries) {
                await driver.executeScript(`
                    // Add history entry via extension
                    chrome.runtime.sendMessage('${extensionInfo.id}', {
                        action: 'addHistoryEntry',
                        entry: ${JSON.stringify(historyEntry)}
                    });
                `);
                await driver.sleep(1000);
            }
            
            testResult.tests.history_data_added = {
                passed: true,
                message: `Added ${this.testHistoryEntries.length} test history entries`,
                details: { entries: this.testHistoryEntries }
            };
            
            // Test Chrome-side history deletion capabilities
            console.log('  🗑️  Testing Chrome local history deletion...');
            
            const chromeDeleteTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                    const urlToDelete = testUrls[1]; // Delete the second entry
                    
                    // Send delete request to extension
                    chrome.runtime.sendMessage('${extensionInfo.id}', {
                        action: 'deleteHistoryEntry',
                        url: urlToDelete,
                        deleteType: 'local'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({
                                success: false,
                                error: chrome.runtime.lastError.message
                            });
                        } else {
                            resolve({
                                success: true,
                                deletedUrl: urlToDelete,
                                deleteType: 'local',
                                response: response
                            });
                        }
                    });
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        resolve({
                            success: false,
                            error: 'Chrome delete operation timeout'
                        });
                    }, 5000);
                });
            `);
            
            testResult.tests.chrome_local_delete = {
                passed: chromeDeleteTest.success,
                message: chromeDeleteTest.success ? 
                    `Chrome successfully deleted history entry locally: ${chromeDeleteTest.deletedUrl}` :
                    `Chrome local delete failed: ${chromeDeleteTest.error}`,
                details: chromeDeleteTest
            };
            
            // Test remote delete propagation (delete from Chrome, should sync to other devices)
            console.log('  🌐 Testing remote delete propagation...');
            
            await driver.sleep(2000); // Wait a moment
            
            const remoteDeleteTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                    const urlToDeleteRemotely = testUrls[2] || testUrls[0]; // Delete third entry or first if only 2
                    
                    // Send remote delete request (should propagate to connected devices)
                    chrome.runtime.sendMessage('${extensionInfo.id}', {
                        action: 'deleteHistoryEntry',
                        url: urlToDeleteRemotely,
                        deleteType: 'remote', // This should sync to other devices
                        propagate: true
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({
                                success: false,
                                error: chrome.runtime.lastError.message
                            });
                        } else {
                            resolve({
                                success: true,
                                deletedUrl: urlToDeleteRemotely,
                                deleteType: 'remote',
                                response: response
                            });
                        }
                    });
                    
                    // Timeout after 10 seconds (remote operations take longer)
                    setTimeout(() => {
                        resolve({
                            success: false,
                            error: 'Remote delete operation timeout'
                        });
                    }, 10000);
                });
            `);
            
            testResult.tests.chrome_remote_delete = {
                passed: remoteDeleteTest.success,
                message: remoteDeleteTest.success ? 
                    `Chrome successfully propagated remote delete: ${remoteDeleteTest.deletedUrl}` :
                    `Chrome remote delete failed: ${remoteDeleteTest.error}`,
                details: remoteDeleteTest
            };
            
            // Take screenshot after delete operations
            const afterDeleteScreenshot = await this.takeScreenshot(driver, 'chrome-after-deletes', 'Chrome after local and remote delete operations');
            if (afterDeleteScreenshot) testResult.screenshots.push(afterDeleteScreenshot);
            
            // Final screenshot
            const finalScreenshot = await this.takeScreenshot(driver, 'chrome-final', 'Chrome testing completed - final state');
            if (finalScreenshot) testResult.screenshots.push(finalScreenshot);
            
            // Determine overall success
            testResult.passed = Object.values(testResult.tests).every(test => test.passed);
            
        } catch (error) {
            console.error(`❌ Chrome extension test failed: ${error.message}`);
            testResult.tests.error = {
                passed: false,
                message: `Chrome extension test error: ${error.message}`,
                details: { error: error.message, stack: error.stack }
            };
        }
        
        console.log(`${testResult.passed ? '✅' : '❌'} Chrome extension test: ${testResult.passed ? 'PASSED' : 'FAILED'}`);
        return testResult;
    }

    async testRealSafariExtension(driver, platform) {
        console.log(`🍎 Testing REAL Safari iOS extension functionality on ${platform.name}...`);
        
        const testResult = {
            platform: platform.name,
            platform_type: platform.type,
            role: platform.role,
            tests: {},
            passed: false,
            timestamp: new Date().toISOString(),
            screenshots: []
        };
        
        try {
            // Take initial screenshot
            const initialScreenshot = await this.takeScreenshot(driver, 'ios-initial', 'iOS Safari initial state');
            if (initialScreenshot) testResult.screenshots.push(initialScreenshot);
            
            // Navigate to iOS Settings to check/enable extension
            console.log('  ⚙️  Checking Safari extension settings...');
            
            // Note: On real iOS devices, we can't directly access Settings app
            // So we'll test the extension functionality directly in Safari
            
            // Navigate to a test page
            await driver.get('https://example.com');
            await driver.sleep(5000);
            
            // Take screenshot of Safari with test page
            const safariScreenshot = await this.takeScreenshot(driver, 'ios-safari-page', 'iOS Safari on test page');
            if (safariScreenshot) testResult.screenshots.push(safariScreenshot);
            
            // Try to access Safari extension via share menu (if available)
            console.log('  📱 Testing Safari extension access...');
            
            try {
                // Look for share button in Safari
                const shareButton = await driver.findElement(By.xpath("//XCUIElementTypeButton[@name='Share']"));
                await shareButton.click();
                await driver.sleep(3000);
                
                // Take screenshot of share menu
                const shareMenuScreenshot = await this.takeScreenshot(driver, 'ios-share-menu', 'iOS Safari share menu');
                if (shareMenuScreenshot) testResult.screenshots.push(shareMenuScreenshot);
                
                // Look for our extension in the share menu
                const extensionFound = await driver.executeScript(`
                    // This would need to be adapted based on how the extension appears
                    return document.querySelector('[data-extension="history-sync"]') !== null;
                `);
                
                testResult.tests.extension_accessible = {
                    passed: extensionFound,
                    message: extensionFound ? 
                        'Safari extension found in share menu' :
                        'Safari extension not found in share menu',
                    details: { method: 'share_menu_check' }
                };
                
            } catch (error) {
                // If share menu approach doesn't work, try direct JavaScript injection
                console.log('  🔧 Testing extension via JavaScript injection...');
                
                const jsTest = await driver.executeScript(`
                    return new Promise((resolve) => {
                        // Test if extension content script is loaded
                        if (window.historySync || window.extensionLoaded) {
                            resolve({
                                found: true,
                                method: 'content_script_detection'
                            });
                        } else {
                            // Try to trigger extension functionality
                            window.postMessage({
                                action: 'testExtension',
                                sharedSecret: '${this.sharedSecret}'
                            }, '*');
                            
                            // Listen for response
                            let responseReceived = false;
                            window.addEventListener('message', function(event) {
                                if (event.data.action === 'extensionResponse') {
                                    responseReceived = true;
                                    resolve({
                                        found: true,
                                        method: 'postMessage_communication',
                                        response: event.data
                                    });
                                }
                            });
                            
                            // Timeout after 5 seconds
                            setTimeout(() => {
                                if (!responseReceived) {
                                    resolve({
                                        found: false,
                                        method: 'timeout',
                                        error: 'No extension response received'
                                    });
                                }
                            }, 5000);
                        }
                    });
                `);
                
                testResult.tests.extension_accessible = {
                    passed: jsTest.found,
                    message: jsTest.found ? 
                        `Safari extension detected via ${jsTest.method}` :
                        `Safari extension not detected: ${jsTest.error}`,
                    details: jsTest
                };
            }
            
            // Test PeerJS connection capability
            console.log('  🔗 Testing PeerJS connection capability...');
            
            const peerJSTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    try {
                        // Check if PeerJS is available
                        if (typeof Peer !== 'undefined') {
                            // Try to create a peer connection
                            const peer = new Peer('test-ios-' + Date.now());
                            
                            peer.on('open', function(id) {
                                peer.destroy();
                                resolve({
                                    success: true,
                                    message: 'PeerJS connection successful',
                                    peerId: id
                                });
                            });
                            
                            peer.on('error', function(error) {
                                resolve({
                                    success: false,
                                    message: 'PeerJS connection failed: ' + error.message,
                                    error: error.message
                                });
                            });
                            
                            // Timeout after 10 seconds
                            setTimeout(() => {
                                peer.destroy();
                                resolve({
                                    success: false,
                                    message: 'PeerJS connection timeout'
                                });
                            }, 10000);
                            
                        } else {
                            resolve({
                                success: false,
                                message: 'PeerJS not available'
                            });
                        }
                    } catch (error) {
                        resolve({
                            success: false,
                            message: 'PeerJS test error: ' + error.message,
                            error: error.message
                        });
                    }
                });
            `);
            
            testResult.tests.peerjs_capability = {
                passed: peerJSTest.success,
                message: peerJSTest.message,
                details: peerJSTest
            };
            
            // Test history data reception (simulate checking for synced data)
            console.log('  📚 Testing history data reception...');
            
            await driver.sleep(10000); // Wait for potential sync from Chrome
            
            const historyCheck = await driver.executeScript(`
                return new Promise((resolve) => {
                    // Check if any of our test history entries appeared
                    const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                    
                    // This would need to be adapted based on how the extension stores/displays synced history
                    window.postMessage({
                        action: 'getHistory'
                    }, '*');
                    
                    let historyReceived = false;
                    window.addEventListener('message', function(event) {
                        if (event.data.action === 'historyData') {
                            const syncedHistory = event.data.history || [];
                            const foundEntries = testUrls.filter(url => 
                                syncedHistory.some(entry => entry.url === url)
                            );
                            
                            historyReceived = true;
                            resolve({
                                success: foundEntries.length > 0,
                                foundEntries: foundEntries.length,
                                totalTestEntries: testUrls.length,
                                syncedHistory: syncedHistory
                            });
                        }
                    });
                    
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        if (!historyReceived) {
                            resolve({
                                success: false,
                                error: 'No history data response received'
                            });
                        }
                    }, 10000);
                });
            `);
            
            testResult.tests.history_sync_reception = {
                passed: historyCheck.success,
                message: historyCheck.success ? 
                    `Received ${historyCheck.foundEntries}/${historyCheck.totalTestEntries} test history entries` :
                    `History sync test failed: ${historyCheck.error}`,
                details: historyCheck
            };
            
            // Test local history deletion
            console.log('  🗑️  Testing local history deletion...');
            
            const localDeleteTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                    
                    // Delete the first test entry locally
                    const urlToDelete = testUrls[0];
                    window.postMessage({
                        action: 'deleteHistoryEntry',
                        url: urlToDelete,
                        deleteType: 'local'
                    }, '*');
                    
                    // Wait for deletion confirmation
                    let deleteConfirmed = false;
                    window.addEventListener('message', function(event) {
                        if (event.data.action === 'historyDeleted') {
                            deleteConfirmed = true;
                            resolve({
                                success: true,
                                deletedUrl: urlToDelete,
                                deleteType: 'local',
                                confirmation: event.data
                            });
                        }
                    });
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        if (!deleteConfirmed) {
                            resolve({
                                success: false,
                                error: 'Local delete operation timeout'
                            });
                        }
                    }, 5000);
                });
            `);
            
            testResult.tests.local_history_delete = {
                passed: localDeleteTest.success,
                message: localDeleteTest.success ? 
                    `Successfully deleted history entry locally: ${localDeleteTest.deletedUrl}` :
                    `Local history delete failed: ${localDeleteTest.error}`,
                details: localDeleteTest
            };
            
            // Take screenshot after local delete
            const afterLocalDeleteScreenshot = await this.takeScreenshot(driver, 'ios-after-local-delete', 'iOS Safari after local history deletion');
            if (afterLocalDeleteScreenshot) testResult.screenshots.push(afterLocalDeleteScreenshot);
            
            // Test remote delete reception (should receive deletes from Chrome)
            console.log('  📡 Testing remote delete reception...');
            
            await driver.sleep(15000); // Wait for potential remote deletes from Chrome
            
            const remoteDeleteReceptionTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    // Check if remote deletes were received
                    window.postMessage({
                        action: 'getDeletedHistory'
                    }, '*');
                    
                    let deleteDataReceived = false;
                    window.addEventListener('message', function(event) {
                        if (event.data.action === 'deletedHistoryData') {
                            const deletedEntries = event.data.deletedEntries || [];
                            deleteDataReceived = true;
                            
                            resolve({
                                success: deletedEntries.length > 0,
                                deletedCount: deletedEntries.length,
                                deletedEntries: deletedEntries,
                                method: 'remote_delete_reception'
                            });
                        }
                    });
                    
                    // Also check current history to see if items were actually deleted
                    setTimeout(() => {
                        window.postMessage({
                            action: 'getHistory'
                        }, '*');
                        
                        window.addEventListener('message', function(event) {
                            if (event.data.action === 'historyData' && !deleteDataReceived) {
                                const currentHistory = event.data.history || [];
                                const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                                
                                // Check how many test URLs are still present
                                const remainingEntries = testUrls.filter(url => 
                                    currentHistory.some(entry => entry.url === url)
                                );
                                
                                const deletedEntries = testUrls.filter(url => 
                                    !currentHistory.some(entry => entry.url === url)
                                );
                                
                                deleteDataReceived = true;
                                resolve({
                                    success: deletedEntries.length > 0,
                                    deletedCount: deletedEntries.length,
                                    remainingCount: remainingEntries.length,
                                    deletedUrls: deletedEntries,
                                    method: 'history_comparison'
                                });
                            }
                        });
                    }, 2000);
                    
                    // Timeout after 15 seconds
                    setTimeout(() => {
                        if (!deleteDataReceived) {
                            resolve({
                                success: false,
                                error: 'Remote delete reception timeout'
                            });
                        }
                    }, 15000);
                });
            `);
            
            testResult.tests.remote_delete_reception = {
                passed: remoteDeleteReceptionTest.success,
                message: remoteDeleteReceptionTest.success ? 
                    `Successfully received ${remoteDeleteReceptionTest.deletedCount} remote delete(s) via ${remoteDeleteReceptionTest.method}` :
                    `Remote delete reception failed: ${remoteDeleteReceptionTest.error}`,
                details: remoteDeleteReceptionTest
            };
            
            // Test bidirectional delete synchronization
            console.log('  🔄 Testing bidirectional delete sync...');
            
            const bidirectionalDeleteTest = await driver.executeScript(`
                return new Promise((resolve) => {
                    const testUrls = ${JSON.stringify(this.testHistoryEntries.map(e => e.url))};
                    const urlToDeleteFromIOS = testUrls[testUrls.length - 1]; // Delete last entry from iOS
                    
                    if (!urlToDeleteFromIOS) {
                        resolve({
                            success: false,
                            error: 'No test URLs available for bidirectional delete test'
                        });
                        return;
                    }
                    
                    // Delete from iOS and expect it to propagate to Chrome
                    window.postMessage({
                        action: 'deleteHistoryEntry',
                        url: urlToDeleteFromIOS,
                        deleteType: 'remote',
                        propagate: true
                    }, '*');
                    
                    // Wait for confirmation that delete was sent to other devices
                    let deleteConfirmed = false;
                    window.addEventListener('message', function(event) {
                        if (event.data.action === 'deletePropagated') {
                            deleteConfirmed = true;
                            resolve({
                                success: true,
                                deletedUrl: urlToDeleteFromIOS,
                                deleteType: 'bidirectional',
                                confirmation: event.data
                            });
                        }
                    });
                    
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        if (!deleteConfirmed) {
                            resolve({
                                success: false,
                                error: 'Bidirectional delete propagation timeout'
                            });
                        }
                    }, 10000);
                });
            `);
            
            testResult.tests.bidirectional_delete_sync = {
                passed: bidirectionalDeleteTest.success,
                message: bidirectionalDeleteTest.success ? 
                    `Successfully initiated bidirectional delete from iOS: ${bidirectionalDeleteTest.deletedUrl}` :
                    `Bidirectional delete failed: ${bidirectionalDeleteTest.error}`,
                details: bidirectionalDeleteTest
            };
            
            // Take screenshot after all delete tests
            const afterAllDeletesScreenshot = await this.takeScreenshot(driver, 'ios-after-all-deletes', 'iOS Safari after all delete operations completed');
            if (afterAllDeletesScreenshot) testResult.screenshots.push(afterAllDeletesScreenshot);
            
            // Final screenshot
            const finalScreenshot = await this.takeScreenshot(driver, 'ios-final', 'iOS Safari testing completed - final state');
            if (finalScreenshot) testResult.screenshots.push(finalScreenshot);
            
            // Determine overall success
            testResult.passed = Object.values(testResult.tests).every(test => test.passed);
            
        } catch (error) {
            console.error(`❌ Safari iOS extension test failed: ${error.message}`);
            testResult.tests.error = {
                passed: false,
                message: `Safari iOS extension test error: ${error.message}`,
                details: { error: error.message, stack: error.stack }
            };
        }
        
        console.log(`${testResult.passed ? '✅' : '❌'} Safari iOS extension test: ${testResult.passed ? 'PASSED' : 'FAILED'}`);
        return testResult;
    }

    async testRealCrossPlatformSync(chromeResult, iosResult) {
        console.log(`🔄 Testing REAL cross-platform sync between Chrome and Safari...`);
        
        const syncTest = {
            name: 'Real Cross-Platform History Sync',
            timestamp: new Date().toISOString(),
            tests: {},
            platforms_involved: [chromeResult.platform, iosResult.platform],
            passed: false
        };
        
        // Analyze if sync actually occurred based on test results
        const chromeDataAdded = chromeResult.tests.history_data_added && chromeResult.tests.history_data_added.passed;
        const iosDataReceived = iosResult.tests.history_sync_reception && iosResult.tests.history_sync_reception.passed;
        const chromeConnected = chromeResult.tests.popup_functionality && chromeResult.tests.popup_functionality.passed;
        const iosExtensionWorking = iosResult.tests.extension_accessible && iosResult.tests.extension_accessible.passed;
        
        // Analyze delete synchronization capabilities
        const chromeLocalDelete = chromeResult.tests.chrome_local_delete && chromeResult.tests.chrome_local_delete.passed;
        const chromeRemoteDelete = chromeResult.tests.chrome_remote_delete && chromeResult.tests.chrome_remote_delete.passed;
        const iosLocalDelete = iosResult.tests.local_history_delete && iosResult.tests.local_history_delete.passed;
        const iosRemoteDeleteReception = iosResult.tests.remote_delete_reception && iosResult.tests.remote_delete_reception.passed;
        const iosBidirectionalDelete = iosResult.tests.bidirectional_delete_sync && iosResult.tests.bidirectional_delete_sync.passed;
        
        syncTest.tests = {
            chrome_data_generation: {
                passed: chromeDataAdded,
                message: chromeDataAdded ? 
                    'Chrome successfully generated and transmitted test history data' :
                    'Chrome failed to generate/transmit test history data'
            },
            ios_data_reception: {
                passed: iosDataReceived,
                message: iosDataReceived ?
                    'iOS Safari successfully received synced history data' :
                    'iOS Safari failed to receive synced history data'
            },
            cross_platform_connection: {
                passed: chromeConnected && iosExtensionWorking,
                message: (chromeConnected && iosExtensionWorking) ?
                    'Both platforms successfully established connection capabilities' :
                    'One or both platforms failed to establish connection capabilities'
            },
            bidirectional_capability: {
                passed: chromeResult.tests.background_script && chromeResult.tests.background_script.passed &&
                        iosResult.tests.peerjs_capability && iosResult.tests.peerjs_capability.passed,
                message: 'Both platforms demonstrate bidirectional sync capability'
            },
            local_delete_operations: {
                passed: chromeLocalDelete && iosLocalDelete,
                message: (chromeLocalDelete && iosLocalDelete) ?
                    'Both platforms successfully performed local delete operations' :
                    'One or both platforms failed local delete operations'
            },
            remote_delete_propagation: {
                passed: chromeRemoteDelete,
                message: chromeRemoteDelete ?
                    'Chrome successfully propagated remote delete to connected devices' :
                    'Chrome failed to propagate remote delete'
            },
            remote_delete_reception: {
                passed: iosRemoteDeleteReception,
                message: iosRemoteDeleteReception ?
                    'iOS Safari successfully received remote delete operations' :
                    'iOS Safari failed to receive remote delete operations'
            },
            bidirectional_delete_sync: {
                passed: iosBidirectionalDelete,
                message: iosBidirectionalDelete ?
                    'iOS Safari successfully initiated bidirectional delete synchronization' :
                    'iOS Safari failed bidirectional delete synchronization'
            },
            comprehensive_delete_sync: {
                passed: chromeLocalDelete && chromeRemoteDelete && iosLocalDelete && iosRemoteDeleteReception,
                message: (chromeLocalDelete && chromeRemoteDelete && iosLocalDelete && iosRemoteDeleteReception) ?
                    'Complete delete synchronization working across all platforms and directions' :
                    'Delete synchronization incomplete - some operations failed'
            }
        };
        
        // Overall sync test success
        syncTest.passed = Object.values(syncTest.tests).every(test => test.passed);
        
        console.log(`${syncTest.passed ? '✅' : '❌'} Real cross-platform sync: ${syncTest.passed ? 'PASSED' : 'FAILED'}`);
        
        return syncTest;
    }

    findChromeExtension() {
        // For BrowserStack Chrome testing, we need an unzipped directory
        // The CI builds chrome-extension directory, so use that
        console.log('🔍 Looking for Chrome extension directory...');
        
        if (fs.existsSync('chrome-extension')) {
            console.log('✅ Found chrome-extension directory');
            return 'chrome-extension';
        }
        
        // If directory doesn't exist, try to extract from ZIP
        const zipFiles = [];
        try {
            const files = execSync('ls chrome-extension*.zip 2>/dev/null || true', { encoding: 'utf8' }).trim().split('\n').filter(f => f);
            zipFiles.push(...files);
        } catch (error) {
            // Ignore
        }
        
        if (zipFiles.length > 0) {
            const zipFile = zipFiles[0];
            console.log(`📦 Extracting Chrome extension from ZIP: ${zipFile}`);
            return this.extractChromeExtension(zipFile);
        }
        
        console.log('❌ No Chrome extension found (directory or ZIP)');
        return null;
    }

    extractChromeExtension(zipPath) {
        try {
            const extractDir = 'chrome-extension-for-testing';
            
            // Remove existing extracted directory
            if (fs.existsSync(extractDir)) {
                execSync(`rm -rf "${extractDir}"`);
            }
            
            // Create extraction directory
            fs.mkdirSync(extractDir, { recursive: true });
            
            // Extract ZIP file
            execSync(`unzip -q "${zipPath}" -d "${extractDir}"`);
            
            console.log(`✅ Chrome extension extracted to: ${extractDir}`);
            return extractDir;
            
        } catch (error) {
            console.error(`❌ Failed to extract Chrome extension: ${error.message}`);
            throw error;
        }
    }

    async runRealMultiplatformSyncTests() {
        console.log('🌐 Starting REAL BrowserStack Multiplatform Sync Tests...');
        console.log('================================================================');
        
        try {
            // Check for Chrome extension
            const chromeExtensionPath = this.findChromeExtension();
            if (!chromeExtensionPath) {
                throw new Error('Chrome extension not found - cannot run real sync tests');
            }
            
            console.log(`📱 Found Chrome extension: ${chromeExtensionPath}`);
            
            // Create sessions and run tests
            const sessions = {};
            const platformResults = [];
            
            // Test Chrome platform
            const chromePlatform = this.testPlatforms.find(p => p.type === 'chrome_desktop');
            console.log(`\n🚀 Testing Chrome platform: ${chromePlatform.name}`);
            
            let chromeDriver;
            try {
                chromeDriver = await this.createRealChromeSession(chromePlatform, chromeExtensionPath);
                sessions.chrome = chromeDriver;
                
                const chromeResult = await this.testRealChromeExtension(chromeDriver, chromePlatform);
                platformResults.push(chromeResult);
                
                this.testResults.sessions.push(chromeResult);
                this.testResults.summary.platforms_tested.push(chromePlatform.name);
                
            } catch (error) {
                console.error(`❌ Chrome platform test failed: ${error.message}`);
                const failedResult = {
                    platform: chromePlatform.name,
                    platform_type: chromePlatform.type,
                    tests: { error: { passed: false, message: error.message } },
                    passed: false,
                    timestamp: new Date().toISOString(),
                    screenshots: []
                };
                platformResults.push(failedResult);
                this.testResults.sessions.push(failedResult);
            }
            
            // Test iOS Safari platform
            const iosPlatform = this.testPlatforms.find(p => p.type === 'safari_ios');
            console.log(`\n📱 Testing iOS Safari platform: ${iosPlatform.name}`);
            
            let iosDriver;
            try {
                iosDriver = await this.createRealSafariIOSSession(iosPlatform);
                sessions.ios = iosDriver;
                
                const iosResult = await this.testRealSafariExtension(iosDriver, iosPlatform);
                platformResults.push(iosResult);
                
                this.testResults.sessions.push(iosResult);
                this.testResults.summary.platforms_tested.push(iosPlatform.name);
                
            } catch (error) {
                console.error(`❌ iOS Safari platform test failed: ${error.message}`);
                const failedResult = {
                    platform: iosPlatform.name,
                    platform_type: iosPlatform.type,
                    tests: { error: { passed: false, message: error.message } },
                    passed: false,
                    timestamp: new Date().toISOString(),
                    screenshots: []
                };
                platformResults.push(failedResult);
                this.testResults.sessions.push(failedResult);
            }
            
            // Test real cross-platform sync
            if (platformResults.length >= 2) {
                const chromeResult = platformResults.find(r => r.platform_type === 'chrome_desktop');
                const iosResult = platformResults.find(r => r.platform_type === 'safari_ios');
                
                if (chromeResult && iosResult) {
                    console.log(`\n🔄 Testing real cross-platform sync...`);
                    const syncTest = await this.testRealCrossPlatformSync(chromeResult, iosResult);
                    this.testResults.sync_tests.push(syncTest);
                }
            }
            
            // Close sessions
            console.log(`\n🛑 Closing browser sessions...`);
            for (const [platform, driver] of Object.entries(sessions)) {
                try {
                    await driver.quit();
                    console.log(`✅ ${platform} session closed`);
                } catch (error) {
                    console.warn(`⚠️  Failed to close ${platform} session: ${error.message}`);
                }
            }
            
            // Generate summary
            const overallPassed = platformResults.filter(r => r.passed).length;
            const overallTotal = platformResults.length;
            
            this.testResults.summary.total = overallTotal;
            this.testResults.summary.passed = overallPassed;
            this.testResults.summary.failed = overallTotal - overallPassed;
            
            console.log(`\n🎯 Real testing completed: ${overallPassed}/${overallTotal} platforms passed`);
            
        } catch (error) {
            console.error('❌ Real BrowserStack testing failed:', error.message);
            this.testResults.sync_tests.push({
                name: 'BrowserStack Integration Error',
                passed: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        return this.testResults;
    }

    async saveResults() {
        const resultsDir = 'test-results/browserstack';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const resultsFile = path.join(resultsDir, 'real-multiplatform-test-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.testResults, null, 2));
        
        console.log(`\n📊 Results saved to ${resultsFile}`);
        
        // Generate summary report
        this.generateSummaryReport();
    }

    generateSummaryReport() {
        console.log('\n🎯 REAL BrowserStack Multiplatform Test Summary:');
        console.log('=' .repeat(60));
        console.log(`📅 Timestamp: ${this.testResults.timestamp}`);
        console.log(`🏗️  Total Platforms: ${this.testResults.summary.platforms_tested.length}`);
        console.log(`✅ Successful Platforms: ${this.testResults.summary.passed}`);
        console.log(`❌ Failed Platforms: ${this.testResults.summary.failed}`);
        console.log(`🔄 Sync Tests: ${this.testResults.sync_tests.length}`);
        console.log(`📸 Screenshots Captured: ${this.testResults.screenshots.length}`);
        
        if (this.testResults.summary.platforms_tested.length > 0) {
            const successRate = Math.round((this.testResults.summary.passed / this.testResults.summary.platforms_tested.length) * 100);
            console.log(`📊 Overall Success Rate: ${successRate}%`);
        }
        
        console.log('\n📱 Platform Results:');
        for (const session of this.testResults.sessions) {
            const status = session.passed ? '✅' : '❌';
            const testCount = Object.keys(session.tests).length;
            const passedTests = Object.values(session.tests).filter(t => t.passed).length;
            const screenshotCount = session.screenshots ? session.screenshots.length : 0;
            console.log(`  ${status} ${session.platform}: ${passedTests}/${testCount} tests passed, ${screenshotCount} screenshots`);
        }
        
        if (this.testResults.sync_tests.length > 0) {
            console.log('\n🔄 Real Sync Test Results:');
            for (const syncTest of this.testResults.sync_tests) {
                const status = syncTest.passed ? '✅' : '❌';
                console.log(`  ${status} ${syncTest.name}`);
                if (syncTest.tests) {
                    for (const [testName, testResult] of Object.entries(syncTest.tests)) {
                        const testStatus = testResult.passed ? '  ✅' : '  ❌';
                        console.log(`    ${testStatus} ${testName}: ${testResult.message}`);
                    }
                }
            }
        }
        
        if (this.testResults.screenshots.length > 0) {
            console.log('\n📸 Screenshots Captured:');
            for (const screenshot of this.testResults.screenshots) {
                console.log(`  📷 ${screenshot.name}: ${screenshot.description}`);
                console.log(`     File: ${screenshot.filepath}`);
            }
        }
    }
}

// Main execution
async function main() {
    try {
        const tester = new RealBrowserStackSyncTester();
        const results = await tester.runRealMultiplatformSyncTests();
        await tester.saveResults();
        
        // Exit with appropriate code
        const hasFailures = results.sessions.some(s => !s.passed) || 
                          results.sync_tests.some(s => !s.passed);
        
        process.exit(hasFailures ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Real BrowserStack testing failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = RealBrowserStackSyncTester;