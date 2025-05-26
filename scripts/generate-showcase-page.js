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

        .screenshot-placeholder {
            background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
                        linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
                        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-style: italic;
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

        .demo-container {
            margin-top: 20px;
        }

        .device-panels {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 20px;
            margin-bottom: 30px;
            align-items: start;
        }

        .device-panel {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .chrome-device {
            border-left: 4px solid #4285f4;
        }

        .safari-device {
            border-left: 4px solid #007aff;
        }

        .device-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
        }

        .device-icon {
            font-size: 1.5rem;
        }

        .device-header h3 {
            margin: 0;
            color: #333;
            flex-grow: 1;
        }

        .connection-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .connection-status.connected {
            background-color: #d4edda;
            color: #155724;
        }

        .connection-status.connecting {
            background-color: #fff3cd;
            color: #856404;
        }

        .history-panel {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            min-height: 200px;
        }

        .history-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
        }

        .history-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 5px;
            background-color: #f8f9fa;
            animation: fadeIn 0.5s ease-in;
        }

        .history-item.syncing {
            background-color: #fff3cd;
            animation: pulse 1s infinite;
        }

        .history-item.synced {
            background-color: #d4edda;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .sync-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px 10px;
        }

        .sync-arrow {
            font-size: 2rem;
            color: #28a745;
            animation: syncPulse 2s infinite;
        }

        @keyframes syncPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }

        .sync-status {
            margin-top: 10px;
            font-size: 0.9rem;
            text-align: center;
            color: #666;
        }

        .demo-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s ease;
        }

        .demo-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .demo-button.primary {
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: bold;
        }

        .demo-controls-main {
            text-align: center;
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .demo-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .demo-info h4 {
            margin-top: 0;
            color: #333;
        }

        .demo-info ul {
            margin: 0;
            padding-left: 20px;
        }

        .demo-info li {
            margin-bottom: 8px;
        }

        @media (max-width: 768px) {
            .device-panels {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .sync-indicator {
                order: -1;
                padding: 10px;
            }
            
            .sync-arrow {
                transform: rotate(90deg);
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
        ${this.generateP2PDemo()}
        ${this.generateInstallationGuide()}
        ${this.generateTechnicalDetails()}

        <footer class="footer">
            <p>Generated ${new Date().toISOString()} | Commit ${this.commitSha.substring(0, 8)} | Build #${this.runId}</p>
        </footer>
    </div>

    <script>
        let demoActive = false;
        let historyCounter = 0;
        
        const sampleSites = [
            { title: 'GitHub', url: 'https://github.com', icon: '🐙' },
            { title: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '📚' },
            { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', icon: '📖' },
            { title: 'YouTube', url: 'https://youtube.com', icon: '📺' },
            { title: 'Reddit', url: 'https://reddit.com', icon: '🔴' },
            { title: 'Twitter', url: 'https://twitter.com', icon: '🐦' },
            { title: 'Wikipedia', url: 'https://wikipedia.org', icon: '📰' },
            { title: 'Google', url: 'https://google.com', icon: '🔍' },
        ];

        function startDemo() {
            demoActive = true;
            document.getElementById('start-demo').textContent = 'Demo Running...';
            document.getElementById('start-demo').disabled = true;
            
            // Simulate connection process
            setTimeout(() => {
                document.getElementById('chrome-status').textContent = 'Connected';
                document.getElementById('chrome-status').className = 'connection-status connected';
                document.getElementById('safari-status').textContent = 'Connected';
                document.getElementById('safari-status').className = 'connection-status connected';
                document.getElementById('sync-status').textContent = 'P2P Connection Established';
            }, 1500);
        }

        function simulateBrowsing(device) {
            if (!demoActive) {
                alert('Please start the demo first!');
                return;
            }

            const site = sampleSites[Math.floor(Math.random() * sampleSites.length)];
            const timestamp = new Date().toLocaleTimeString();
            historyCounter++;
            
            const historyItem = {
                id: historyCounter,
                title: site.title,
                url: site.url,
                icon: site.icon,
                timestamp: timestamp,
                device: device
            };
            
            // Add to originating device first
            addHistoryItem(device, historyItem, 'local');
            
            // Simulate sync delay and add to other device
            setTimeout(() => {
                const otherDevice = device === 'chrome' ? 'safari' : 'chrome';
                addHistoryItem(otherDevice, historyItem, 'synced');
            }, Math.random() * 1000 + 500);
        }

        function addHistoryItem(device, item, type) {
            const listId = device + '-history-list';
            const historyList = document.getElementById(listId);
            
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item ' + (type === 'synced' ? 'syncing' : '');
            historyElement.innerHTML = \`
                <span style="font-size: 1.2rem;">\${item.icon}</span>
                <div style="flex-grow: 1;">
                    <div style="font-weight: bold; font-size: 0.9rem;">\${item.title}</div>
                    <div style="font-size: 0.8rem; color: #666;">\${item.url}</div>
                    <div style="font-size: 0.7rem; color: #999;">\${item.timestamp} • From \${item.device === device ? 'local' : item.device}</div>
                </div>
            \`;
            
            historyList.insertBefore(historyElement, historyList.firstChild);
            
            if (type === 'synced') {
                setTimeout(() => {
                    historyElement.classList.remove('syncing');
                    historyElement.classList.add('synced');
                }, 1000);
            }
            
            // Keep only last 5 items
            while (historyList.children.length > 5) {
                historyList.removeChild(historyList.lastChild);
            }
        }

        function resetDemo() {
            demoActive = false;
            historyCounter = 0;
            
            document.getElementById('start-demo').textContent = 'Start Demo';
            document.getElementById('start-demo').disabled = false;
            
            document.getElementById('chrome-status').textContent = 'Disconnected';
            document.getElementById('chrome-status').className = 'connection-status';
            document.getElementById('safari-status').textContent = 'Disconnected';
            document.getElementById('safari-status').className = 'connection-status';
            document.getElementById('sync-status').textContent = 'Connection Closed';
            
            document.getElementById('chrome-history-list').innerHTML = '';
            document.getElementById('safari-history-list').innerHTML = '';
        }
    </script>
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
        const iosAvailable = this.debugReport?.artifacts?.ios_ipa || fs.existsSync(`${process.env.RUNNER_TEMP || ''}/build/bar123-${this.commitSha}.ipa`);

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
                        `<a href="./bar123-${this.commitSha}.ipa" class="download-button">Download IPA</a>` :
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
                <h2>🌐 BrowserStack Multiplatform Testing</h2>
                <p>BrowserStack test results not available</p>
                <div class="screenshot-gallery">
                    <div class="screenshot-card">
                        <div class="screenshot-placeholder">
                            Screenshot: Chrome on Windows 11
                        </div>
                        <div class="screenshot-info">
                            <h4>Chrome on Windows 11</h4>
                            <p>Desktop extension functionality testing</p>
                        </div>
                    </div>
                    
                    <div class="screenshot-card">
                        <div class="screenshot-placeholder">
                            Screenshot: Safari on iPhone 15 Pro
                        </div>
                        <div class="screenshot-info">
                            <h4>Safari on iPhone 15 Pro</h4>
                            <p>iOS Safari Web Extension testing</p>
                        </div>
                    </div>
                    
                    <div class="screenshot-card">
                        <div class="screenshot-placeholder">
                            Screenshot: Cross-platform sync demo
                        </div>
                        <div class="screenshot-info">
                            <h4>Cross-Platform Sync</h4>
                            <p>Real-time history synchronization between devices</p>
                        </div>
                    </div>
                </div>
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
            
            <div class="screenshot-gallery">
                ${this.generatePlatformScreenshots(platformResults)}
            </div>
            
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
        return platforms.map(platform => `
            <div class="screenshot-card">
                <div class="screenshot-placeholder">
                    Screenshot: ${platform.platform}
                </div>
                <div class="screenshot-info">
                    <h4>${platform.platform}</h4>
                    <p>${platform.platform_type === 'chrome_desktop' ? 'Desktop browser extension' : 'iOS Safari Web Extension'}</p>
                    <div style="margin-top: 10px; font-size: 0.9rem; color: #6c757d;">
                        Tests: ${Object.keys(platform.tests || {}).length} | 
                        Status: ${platform.passed ? 'Passed' : 'Failed'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    generateP2PDemo() {
        return `
        <div class="card">
            <h2>🔄 Live P2P History Sync Demo</h2>
            <p>Experience real-time history synchronization between Chrome desktop and Safari iOS in read-only mode</p>
            
            <div class="demo-container">
                <div class="device-panels">
                    <div class="device-panel chrome-device">
                        <div class="device-header">
                            <div class="device-icon">🖥️</div>
                            <h3>Chrome Desktop</h3>
                            <div class="connection-status" id="chrome-status">Connecting...</div>
                        </div>
                        <div class="history-panel" id="chrome-history">
                            <div class="history-header">📚 Recent History</div>
                            <div class="history-list" id="chrome-history-list">
                                <!-- Will be populated by demo -->
                            </div>
                        </div>
                        <div class="demo-controls">
                            <button onclick="simulateBrowsing('chrome')" class="demo-button">Simulate Browsing</button>
                        </div>
                    </div>

                    <div class="sync-indicator">
                        <div class="sync-arrow" id="sync-arrow">⟷</div>
                        <div class="sync-status" id="sync-status">Establishing P2P Connection...</div>
                    </div>

                    <div class="device-panel safari-device">
                        <div class="device-header">
                            <div class="device-icon">📱</div>
                            <h3>Safari iOS</h3>
                            <div class="connection-status" id="safari-status">Connecting...</div>
                        </div>
                        <div class="history-panel" id="safari-history">
                            <div class="history-header">📚 Recent History</div>
                            <div class="history-list" id="safari-history-list">
                                <!-- Will be populated by demo -->
                            </div>
                        </div>
                        <div class="demo-controls">
                            <button onclick="simulateBrowsing('safari')" class="demo-button">Simulate Browsing</button>
                        </div>
                    </div>
                </div>

                <div class="demo-info">
                    <h4>🎯 How it Works</h4>
                    <ul>
                        <li><strong>WebRTC P2P:</strong> Direct device-to-device connection using Trystero</li>
                        <li><strong>Shared Secret:</strong> Both devices use the same room key for discovery</li>
                        <li><strong>Real-time Sync:</strong> History items appear instantly on both devices</li>
                        <li><strong>No Server Storage:</strong> All data stays between your devices</li>
                        <li><strong>End-to-End Encrypted:</strong> Secure peer-to-peer communication</li>
                    </ul>
                </div>

                <div class="demo-controls-main">
                    <button onclick="startDemo()" class="demo-button primary" id="start-demo">Start Demo</button>
                    <button onclick="resetDemo()" class="demo-button">Reset Demo</button>
                </div>
            </div>
        </div>`;
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
        // Copy Chrome extension if available
        const chromeZip = `chrome-extension-${this.commitSha}.zip`;
        if (fs.existsSync(chromeZip)) {
            fs.copyFileSync(chromeZip, path.join(this.outputDir, chromeZip));
            console.log(`📦 Copied Chrome extension: ${chromeZip}`);
        }

        // Copy iOS IPA if available
        const ipaPath = `${process.env.RUNNER_TEMP || ''}/build/bar123-${this.commitSha}.ipa`;
        if (fs.existsSync(ipaPath)) {
            fs.copyFileSync(ipaPath, path.join(this.outputDir, `bar123-${this.commitSha}.ipa`));
            console.log(`📱 Copied iOS IPA: bar123-${this.commitSha}.ipa`);
        }

        // Copy any additional assets
        if (fs.existsSync('chrome-extension/images')) {
            const imagesDir = path.join(this.outputDir, 'images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir);
            }
            // Copy extension icons for display
            const iconFiles = fs.readdirSync('chrome-extension/images');
            iconFiles.forEach(file => {
                fs.copyFileSync(
                    path.join('chrome-extension/images', file),
                    path.join(imagesDir, file)
                );
            });
            console.log(`🖼️ Copied extension images`);
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