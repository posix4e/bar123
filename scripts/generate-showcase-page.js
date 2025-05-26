#!/usr/bin/env node

/**
 * Showcase Page Generator
 * 
 * Creates a comprehensive webpage showcasing the multiplatform history sync extension
 * with artifacts, test results, BrowserStack screenshots, and installation instructions.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ShowcasePageGenerator {
    constructor() {
        this.outputDir = 'docs';  // GitHub Pages serves from docs/ directory
        this.packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        this.commitSha = process.env.GITHUB_SHA || 'local';
        this.runId = process.env.GITHUB_RUN_ID || 'local';
        this.eventName = process.env.GITHUB_EVENT_NAME || 'manual';
        this.ref = process.env.GITHUB_REF || 'refs/heads/local';
        
        // Load debug report if available
        this.debugReport = null;
        if (fs.existsSync('build-debug-report.json')) {
            try {
                this.debugReport = JSON.parse(fs.readFileSync('build-debug-report.json', 'utf8'));
            } catch (error) {
                console.warn('Could not load debug report:', error.message);
            }
        }
        
        // Load BrowserStack results if available
        this.browserstackResults = null;
        if (fs.existsSync('test-results/browserstack/multiplatform-test-results.json')) {
            try {
                this.browserstackResults = JSON.parse(fs.readFileSync('test-results/browserstack/multiplatform-test-results.json', 'utf8'));
            } catch (error) {
                console.warn('Could not load BrowserStack results:', error.message);
            }
        }
    }

    generateHTML() {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>History Sync Extension - Multiplatform Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }

        .header h1 {
            font-size: 3.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto;
        }

        .build-info {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            color: white;
        }

        .build-info h3 {
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-passed {
            background: #28a745;
            color: white;
        }

        .status-failed {
            background: #dc3545;
            color: white;
        }

        .status-skipped {
            background: #6c757d;
            color: white;
        }

        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
        }

        .card h2 {
            color: #333;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .download-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .download-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            transition: transform 0.3s ease;
        }

        .download-card:hover {
            transform: scale(1.05);
        }

        .download-button {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 15px;
            font-weight: bold;
            transition: background 0.3s ease;
            border: 2px solid rgba(255,255,255,0.3);
        }

        .download-button:hover {
            background: rgba(255,255,255,0.3);
            border-color: rgba(255,255,255,0.5);
        }

        .download-button:before {
            content: "⬇️ ";
            margin-right: 8px;
        }

        .platform-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .platform-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            border: 2px solid #e9ecef;
        }

        .platform-card.passed {
            border-color: #28a745;
            background: #d4edda;
        }

        .platform-card.failed {
            border-color: #dc3545;
            background: #f8d7da;
        }

        .platform-icon {
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .test-results {
            margin-top: 20px;
        }

        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .test-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }

        .test-item.passed {
            background: #d4edda;
            border-left: 4px solid #28a745;
        }

        .test-item.failed {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .feature-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
        }

        .feature-icon {
            font-size: 2.5rem;
            margin-bottom: 15px;
        }

        .screenshot-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .screenshot-card {
            background: #f8f9fa;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #dee2e6;
        }


        .screenshot-info {
            padding: 15px;
        }

        .logs-section {
            background: #2d3748;
            color: #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            max-height: 400px;
            overflow-y: auto;
        }

        .log-entry {
            margin-bottom: 5px;
            padding: 5px;
            border-radius: 3px;
        }

        .log-error {
            background: rgba(220, 53, 69, 0.2);
            border-left: 3px solid #dc3545;
        }

        .log-success {
            background: rgba(40, 167, 69, 0.2);
            border-left: 3px solid #28a745;
        }

        .metadata {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            font-size: 0.9rem;
            color: #6c757d;
        }

        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .footer {
            text-align: center;
            color: white;
            margin-top: 50px;
            opacity: 0.8;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2.5rem;
            }
            
            .container {
                padding: 15px;
            }
            
            .card {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🔄 History Sync Extension</h1>
            <p>Cross-platform browser history synchronization using P2P WebRTC connections. Sync seamlessly between Chrome desktop and Safari iOS devices.</p>
        </header>

        ${this.generateBuildInfo()}
        ${this.generateDownloadSection()}
        ${this.generateFeaturesSection()}
        ${this.generateTestResultsSection()}
        ${this.generateBrowserStackSection()}
        ${this.generateInstallationGuide()}
        ${this.generateTechnicalDetails()}

        <footer class="footer">
            <p>Generated ${new Date().toISOString()} | Commit ${this.commitSha.substring(0, 8)} | Build #${this.runId}</p>
        </footer>
    </div>
</body>
</html>`;

        return html;
    }

    generateBuildInfo() {
        if (!this.debugReport) {
            return `
            <div class="build-info">
                <h3>🏗️ Build Information</h3>
                <p>Build information not available</p>
            </div>`;
        }

        const { results } = this.debugReport;
        const testStatus = results.tests.passed ? 'passed' : 'failed';
        const browserstackStatus = results.browserstack_tests.ran ? 
            (results.browserstack_tests.passed ? 'passed' : 'failed') : 'skipped';
        const iosStatus = results.ios_build.passed ? 'passed' : 'failed';
        const testflightStatus = results.testflight_upload?.ran ? 
            (results.testflight_upload.passed ? 'passed' : 'failed') : 'skipped';

        return `
        <div class="build-info">
            <h3>🏗️ Build Information</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div>
                    <strong>Tests:</strong> 
                    <span class="status-badge status-${testStatus}">${testStatus}</span>
                </div>
                <div>
                    <strong>BrowserStack:</strong>
                    <span class="status-badge status-${browserstackStatus}">${browserstackStatus}</span>
                </div>
                <div>
                    <strong>iOS Build:</strong>
                    <span class="status-badge status-${iosStatus}">${iosStatus}</span>
                </div>
                <div>
                    <strong>TestFlight:</strong>
                    <span class="status-badge status-${testflightStatus}">${testflightStatus}</span>
                </div>
            </div>
            <div style="margin-top: 15px; font-size: 0.9rem; opacity: 0.9;">
                <strong>Built:</strong> ${this.debugReport.metadata.timestamp} | 
                <strong>Event:</strong> ${this.debugReport.metadata.event_name} |
                <strong>Branch:</strong> ${this.debugReport.metadata.ref}
            </div>
        </div>`;
    }

    generateDownloadSection() {
        const chromeAvailable = this.debugReport?.artifacts?.chrome_extension || fs.existsSync(`chrome-extension-${this.commitSha}.zip`);
        const iosAvailable = this.debugReport?.artifacts?.ios_ipa || fs.existsSync(`${process.env.RUNNER_TEMP || ''}/build/bar123.ipa`);

        return `
        <div class="card">
            <h2>📱 Download & Install</h2>
            <div class="download-section">
                <div class="download-card">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🖥️</div>
                    <h3>Chrome Extension</h3>
                    <p>Desktop Chrome extension for Windows, macOS, and Linux</p>
                    ${chromeAvailable ? 
                        `<a href="./chrome-extension-${this.commitSha}.zip" class="download-button">Download Extension</a>` :
                        `<div style="opacity: 0.7; margin-top: 15px;">Extension not available</div>`
                    }
                    <div style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                        Load unpacked in Chrome Developer Mode
                    </div>
                </div>

                <div class="download-card">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📱</div>
                    <h3>iOS Safari Extension</h3>
                    <p>Native iOS app with Safari Web Extension</p>
                    ${iosAvailable ? 
                        `<a href="./bar123.ipa" class="download-button">Download IPA</a>` :
                        `<div style="opacity: 0.7; margin-top: 15px;">IPA not available</div>`
                    }
                    <div style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                        Install via TestFlight or Xcode
                    </div>
                </div>
            </div>
        </div>`;
    }

    generateFeaturesSection() {
        return `
        <div class="card">
            <h2>✨ Features</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🔄</div>
                    <h3>Real-time Sync</h3>
                    <p>Instantly synchronize browser history between devices using WebRTC peer-to-peer connections</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">🔒</div>
                    <h3>Secure & Private</h3>
                    <p>End-to-end encrypted with shared secret authentication. No data stored on external servers</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">🌐</div>
                    <h3>Cross-Platform</h3>
                    <p>Works seamlessly between Chrome desktop (Windows/macOS/Linux) and Safari on iOS devices</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3>No Setup Required</h3>
                    <p>Just install on both devices, enter the same shared secret, and start syncing immediately</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">🎯</div>
                    <h3>Device Discovery</h3>
                    <p>Automatic device discovery and connection management with unique device identification</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">📱</div>
                    <h3>Mobile Optimized</h3>
                    <p>Native iOS app with Safari Web Extension integration for optimal mobile experience</p>
                </div>
            </div>
        </div>`;
    }

    generateTestResultsSection() {
        if (!this.debugReport?.results) {
            return `
            <div class="card">
                <h2>🧪 Test Results</h2>
                <p>Test results not available</p>
            </div>`;
        }

        const { results } = this.debugReport;
        
        return `
        <div class="card">
            <h2>🧪 Test Results</h2>
            <div class="test-grid">
                <div class="test-item ${results.tests.passed ? 'passed' : 'failed'}">
                    <h4>Unit Tests</h4>
                    <div>Exit Code: ${results.tests.exit_code}</div>
                    <div>${results.tests.passed ? '✅ Passed' : '❌ Failed'}</div>
                </div>
                
                <div class="test-item ${results.browserstack_tests.ran ? (results.browserstack_tests.passed ? 'passed' : 'failed') : 'skipped'}">
                    <h4>BrowserStack Tests</h4>
                    <div>Exit Code: ${results.browserstack_tests.exit_code || 'N/A'}</div>
                    <div>${results.browserstack_tests.ran ? (results.browserstack_tests.passed ? '✅ Passed' : '❌ Failed') : '⏭️ Skipped'}</div>
                </div>
                
                <div class="test-item ${results.ios_build.passed ? 'passed' : 'failed'}">
                    <h4>iOS Build</h4>
                    <div>Exit Code: ${results.ios_build.exit_code}</div>
                    <div>${results.ios_build.passed ? '✅ Passed' : '❌ Failed'}</div>
                </div>
                
                ${results.testflight_upload ? `
                <div class="test-item ${results.testflight_upload.ran ? (results.testflight_upload.passed ? 'passed' : 'failed') : 'skipped'}">
                    <h4>TestFlight Upload</h4>
                    <div>Exit Code: ${results.testflight_upload.exit_code || 'N/A'}</div>
                    <div>${results.testflight_upload.ran ? (results.testflight_upload.passed ? '✅ Passed' : '❌ Failed') : '⏭️ Skipped'}</div>
                </div>
                ` : ''}
            </div>
            
            ${this.generateLogsSection()}
        </div>`;
    }

    generateBrowserStackSection() {
        if (!this.browserstackResults) {
            return `
            <div class="card">
                <h2>🌐 Local Testing Results</h2>
                <p>Local multiplatform tests completed - see test results section for details</p>
            </div>`;
        }

        const platformResults = this.browserstackResults.sessions || [];
        
        return `
        <div class="card">
            <h2>🌐 BrowserStack Multiplatform Testing</h2>
            <p>Tested on ${platformResults.length} real devices and browsers with ${this.browserstackResults.summary?.success_rate || 'unknown'}% success rate</p>
            
            <div class="platform-grid">
                ${platformResults.map(session => `
                    <div class="platform-card ${session.passed ? 'passed' : 'failed'}">
                        <div class="platform-icon">
                            ${session.platform_type === 'chrome_desktop' ? '🖥️' : '📱'}
                        </div>
                        <h4>${session.platform}</h4>
                        <div>Session: ${session.session_id || 'Unknown'}</div>
                        <div>Tests: ${Object.keys(session.tests || {}).length}</div>
                        <div>${session.passed ? '✅ Passed' : '❌ Failed'}</div>
                    </div>
                `).join('')}
            </div>
            
            ${this.generatePlatformScreenshots(platformResults) ? `
            <div class="screenshot-gallery">
                ${this.generatePlatformScreenshots(platformResults)}
            </div>
            ` : ''}
            
            ${this.browserstackResults.sync_tests?.length > 0 ? `
            <div style="margin-top: 30px;">
                <h3>🔄 Cross-Platform Sync Tests</h3>
                <div class="test-grid">
                    ${this.browserstackResults.sync_tests.map(test => `
                        <div class="test-item ${test.passed ? 'passed' : 'failed'}">
                            <h4>${test.name}</h4>
                            <div>${test.passed ? '✅ Passed' : '❌ Failed'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>`;
    }

    generatePlatformScreenshots(platforms) {
        // Use actual test screenshots if available
        const screenshotsDir = 'screenshots';
        let actualScreenshots = [];
        
        if (fs.existsSync('test-results/local-multiplatform/screenshots')) {
            const files = fs.readdirSync('test-results/local-multiplatform/screenshots');
            actualScreenshots = files.filter(f => f.endsWith('.png'));
        }
        
        if (actualScreenshots.length > 0) {
            return actualScreenshots.slice(0, 6).map((screenshot, index) => {
                const screenshotName = screenshot.replace('screenshot-', '').replace('.png', '');
                const isChrome = screenshotName.includes('chrome');
                const isSafari = screenshotName.includes('safari');
                
                return `
                <div class="screenshot-card">
                    <img src="./${screenshotsDir}/${screenshot}" 
                         alt="${screenshotName}" 
                         style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px 10px 0 0;">
                    <div class="screenshot-info">
                        <h4>${isChrome ? '🖥️ Chrome Extension' : isSafari ? '📱 Safari Extension' : '🔧 Test Screenshot'}</h4>
                        <p>Real test screenshot: ${screenshotName}</p>
                        <div style="margin-top: 10px; font-size: 0.9rem; color: #6c757d;">
                            File: ${screenshot}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
        
        // Return empty if no real screenshots available
        return '';
    }

    generateInstallationGuide() {
        return `
        <div class="card">
            <h2>🔧 Installation Guide</h2>
            
            <div style="margin-bottom: 30px;">
                <h3>Chrome Extension (Desktop)</h3>
                <ol style="margin-left: 20px; margin-top: 10px;">
                    <li>Download the Chrome extension ZIP file above</li>
                    <li>Open Chrome and go to <code>chrome://extensions/</code></li>
                    <li>Enable "Developer mode" in the top right</li>
                    <li>Click "Load unpacked" and select the extracted extension folder</li>
                    <li>The extension icon will appear in your toolbar</li>
                </ol>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3>iOS Safari Extension</h3>
                <ol style="margin-left: 20px; margin-top: 10px;">
                    <li>Download the iOS IPA file above</li>
                    <li>Install via TestFlight (recommended) or Xcode</li>
                    <li>Open the History Sync app on your iOS device</li>
                    <li>Go to iOS Settings → Safari → Extensions</li>
                    <li>Enable "History Sync Extension"</li>
                </ol>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3>Setting Up Sync</h3>
                <ol style="margin-left: 20px; margin-top: 10px;">
                    <li>Open the extension on both devices</li>
                    <li>Enter the same shared secret (any password you choose)</li>
                    <li>Click "Connect" on both devices</li>
                    <li>Devices will automatically discover each other</li>
                    <li>History will sync in real-time between devices</li>
                </ol>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <strong>💡 Pro Tip:</strong> Use a memorable but unique shared secret. Both devices need the exact same secret to connect and sync.
            </div>
        </div>`;
    }

    generateTechnicalDetails() {
        const environment = this.debugReport?.environment || {};
        
        return `
        <div class="card">
            <h2>⚙️ Technical Details</h2>
            
            <div style="margin-bottom: 20px;">
                <h3>Architecture</h3>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li><strong>Protocol:</strong> WebRTC peer-to-peer connections</li>
                    <li><strong>Discovery:</strong> PeerJS signaling server</li>
                    <li><strong>Security:</strong> SHA-256 hashed shared secrets</li>
                    <li><strong>Chrome:</strong> Manifest V3 service worker extension</li>
                    <li><strong>iOS:</strong> Native app with Safari Web Extension</li>
                </ul>
            </div>
            
            <div class="metadata">
                <h4>Build Environment</h4>
                <div class="metadata-grid">
                    <div><strong>Node.js:</strong> ${environment.node_version || 'Unknown'}</div>
                    <div><strong>npm:</strong> ${environment.npm_version || 'Unknown'}</div>
                    <div><strong>Xcode:</strong> ${environment.xcode_version || 'Unknown'}</div>
                    <div><strong>macOS:</strong> ${environment.os_version || 'Unknown'}</div>
                    <div><strong>Runner:</strong> ${this.debugReport?.metadata?.runner_os || 'Unknown'} ${this.debugReport?.metadata?.runner_arch || ''}</div>
                    <div><strong>Disk Space:</strong> ${environment.available_disk_space || 'Unknown'}</div>
                </div>
            </div>
            
            <div class="metadata" style="margin-top: 15px;">
                <h4>Repository Information</h4>
                <div class="metadata-grid">
                    <div><strong>Version:</strong> ${this.packageJson.version}</div>
                    <div><strong>Commit:</strong> ${this.commitSha}</div>
                    <div><strong>Build:</strong> #${this.runId}</div>
                    <div><strong>Event:</strong> ${this.eventName}</div>
                    <div><strong>Ref:</strong> ${this.ref}</div>
                    <div><strong>Generated:</strong> ${new Date().toISOString()}</div>
                </div>
            </div>
        </div>`;
    }

    generateLogsSection() {
        if (!this.debugReport?.logs) {
            return '';
        }

        const logs = this.debugReport.logs;
        let logEntries = [];

        // Collect log entries from various sources
        if (logs.test_log?.excerpt) {
            logEntries.push(...logs.test_log.excerpt.map(line => ({ type: 'test', content: line })));
        }
        
        if (logs.browserstack_test_log?.excerpt) {
            logEntries.push(...logs.browserstack_test_log.excerpt.map(line => ({ type: 'browserstack', content: line })));
        }
        
        if (logs.ios_build_log?.excerpt) {
            logEntries.push(...logs.ios_build_log.excerpt.map(line => ({ type: 'ios', content: line })));
        }

        if (logEntries.length === 0) {
            return '';
        }

        return `
        <div class="logs-section">
            <h4>📋 Recent Log Entries</h4>
            ${logEntries.slice(-20).map(entry => {
                const className = entry.content.includes('error') || entry.content.includes('failed') || entry.content.includes('❌') ? 'log-error' :
                               entry.content.includes('passed') || entry.content.includes('✅') || entry.content.includes('success') ? 'log-success' : '';
                return `<div class="log-entry ${className}">[${entry.type}] ${entry.content}</div>`;
            }).join('')}
        </div>`;
    }

    async generate() {
        console.log('🎨 Generating showcase webpage...');
        
        // Check for required screenshots first
        const screenshotsDir = 'test-results/local-multiplatform/screenshots';
        if (!fs.existsSync(screenshotsDir)) {
            throw new Error(`❌ Screenshots directory not found: ${screenshotsDir}. Run tests first to generate screenshots.`);
        }
        
        const screenshotFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
        if (screenshotFiles.length === 0) {
            throw new Error(`❌ No screenshot files found in ${screenshotsDir}. Run tests first to generate screenshots.`);
        }
        
        console.log(`📸 Found ${screenshotFiles.length} screenshots for showcase`);
        
        // Create output directory
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Generate HTML
        const html = this.generateHTML();
        fs.writeFileSync(path.join(this.outputDir, 'index.html'), html);

        // Copy artifacts if they exist
        this.copyArtifacts();

        console.log(`✅ Showcase page generated at ${this.outputDir}/index.html`);
        return path.join(this.outputDir, 'index.html');
    }

    copyArtifacts() {
        console.log('📦 Copying build artifacts to GitHub Pages...');
        
        // Copy Chrome extension zip if available
        const chromeZip = `chrome-extension-${this.commitSha}.zip`;
        if (fs.existsSync(chromeZip)) {
            fs.copyFileSync(chromeZip, path.join(this.outputDir, chromeZip));
            console.log(`📦 Copied Chrome extension: ${chromeZip}`);
        } else {
            console.warn(`⚠️ Chrome extension not found: ${chromeZip}`);
        }

        // Copy iOS IPA if available
        const ipaPath = `${process.env.RUNNER_TEMP || ''}/build/bar123.ipa`;
        if (fs.existsSync(ipaPath)) {
            fs.copyFileSync(ipaPath, path.join(this.outputDir, 'bar123.ipa'));
            console.log(`📱 Copied iOS IPA: bar123.ipa`);
        } else {
            console.warn(`⚠️ iOS IPA not found: ${ipaPath}`);
        }

        // Copy test result screenshots if available
        const screenshotsDir = 'test-results/local-multiplatform/screenshots';
        if (fs.existsSync(screenshotsDir)) {
            const outputScreenshotsDir = path.join(this.outputDir, 'screenshots');
            if (!fs.existsSync(outputScreenshotsDir)) {
                fs.mkdirSync(outputScreenshotsDir, { recursive: true });
            }
            
            const screenshotFiles = fs.readdirSync(screenshotsDir);
            screenshotFiles.forEach(file => {
                if (file.endsWith('.png')) {
                    fs.copyFileSync(
                        path.join(screenshotsDir, file),
                        path.join(outputScreenshotsDir, file)
                    );
                }
            });
            console.log(`📸 Copied ${screenshotFiles.length} test screenshots`);
        }

        // Copy debug reports
        if (fs.existsSync('build-debug-report.json')) {
            fs.copyFileSync('build-debug-report.json', path.join(this.outputDir, 'build-debug-report.json'));
            console.log(`📊 Copied debug report`);
        }

        // Copy test results
        if (fs.existsSync('test-results')) {
            const testResultsDir = path.join(this.outputDir, 'test-results');
            if (!fs.existsSync(testResultsDir)) {
                fs.mkdirSync(testResultsDir, { recursive: true });
            }
            
            // Copy JSON test results
            const testFiles = ['test-results/local-multiplatform/local-test-results.json', 'test-results/sync/test-results.json'];
            testFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    const filename = path.basename(file);
                    fs.copyFileSync(file, path.join(testResultsDir, filename));
                    console.log(`📋 Copied test results: ${filename}`);
                }
            });
        }

        // Copy extension icons and assets for display
        if (fs.existsSync('chrome-extension/images')) {
            const imagesDir = path.join(this.outputDir, 'images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }
            
            const iconFiles = fs.readdirSync('chrome-extension/images');
            iconFiles.forEach(file => {
                fs.copyFileSync(
                    path.join('chrome-extension/images', file),
                    path.join(imagesDir, file)
                );
            });
            console.log(`🖼️ Copied ${iconFiles.length} extension images`);
        }
    }
}

// Main execution
async function main() {
    try {
        const generator = new ShowcasePageGenerator();
        const outputPath = await generator.generate();
        console.log(`🎉 Showcase page ready: ${outputPath}`);
    } catch (error) {
        console.error('❌ Failed to generate showcase page:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ShowcasePageGenerator;