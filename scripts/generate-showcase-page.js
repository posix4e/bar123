#!/usr/bin/env node

/**
 * Showcase Page Generator
 * 
 * Creates a comprehensive webpage showcasing the multiplatform history sync extension
 * with artifacts, test results, BrowserStack screenshots, and installation instructions.
 */

const fs = require('fs');
const path = require('path');
// const { execSync } = require('child_process'); // unused variable

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

        .viewer-container {
            margin-top: 20px;
        }

        .connection-panel {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .room-input-section {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }

        .room-input-section label {
            font-weight: bold;
            min-width: 100px;
        }

        .room-input-section input {
            flex-grow: 1;
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
            font-size: 0.9rem;
        }

        .history-viewer {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .viewer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
        }

        .viewer-header h3 {
            margin: 0;
            color: #333;
        }

        .peer-count {
            background-color: #e7f3ff;
            color: #0066cc;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: bold;
        }

        .history-feed {
            max-height: 400px;
            overflow-y: auto;
        }

        .no-history {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 40px 20px;
        }

        .viewer-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
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

    <script src="./trystero-bundle.js"></script>
    <script>
        let room = null;
        let currentRoomSecret = null;
        let [sendHistory, getHistory] = [null, null];

        async function connectToRoom() {
            const roomSecret = document.getElementById('room-secret').value.trim();
            if (!roomSecret) {
                alert('Please enter a room secret');
                return;
            }

            try {
                // Check if Trystero is loaded
                if (typeof trystero === 'undefined') {
                    throw new Error('Trystero P2P library failed to load. Please refresh the page.');
                }
                
                updateConnectionStatus('Connecting...', 'connecting');
                
                // Hash the room secret like the extension does
                const encoder = new TextEncoder();
                const data = encoder.encode(roomSecret);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashedSecret = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
                
                // Create room using Trystero
                room = trystero.joinRoom({
                    appId: 'history-sync'
                }, hashedSecret);
                
                // Set up history sync channel (read-only)
                [sendHistory, getHistory] = room.makeAction('history-sync');
                
                // Listen for history updates from other peers
                getHistory((historyData, peerId) => {
                    console.log('Received history from peer:', peerId, historyData);
                    addHistoryToFeed(historyData, peerId);
                });

                // Track peer connections
                room.onPeerJoin(peerId => {
                    console.log('Peer joined:', peerId);
                    updatePeerCount();
                });

                room.onPeerLeave(peerId => {
                    console.log('Peer left:', peerId);
                    updatePeerCount();
                });

                currentRoomSecret = roomSecret;
                updateConnectionStatus('Connected to room', 'connected');
                showHistoryViewer();
                
                document.getElementById('connect-btn').disabled = true;
                document.getElementById('disconnect-btn').disabled = false;
                document.getElementById('room-secret').disabled = true;
                
            } catch (error) {
                console.error('Connection failed:', error);
                updateConnectionStatus('Connection failed: ' + error.message, 'error');
            }
        }

        function disconnectFromRoom() {
            if (room) {
                room.leave();
                room = null;
                currentRoomSecret = null;
                [sendHistory, getHistory] = [null, null];
            }
            
            updateConnectionStatus('Disconnected', 'disconnected');
            hideHistoryViewer();
            
            document.getElementById('connect-btn').disabled = false;
            document.getElementById('disconnect-btn').disabled = true;
            document.getElementById('room-secret').disabled = false;
        }

        function updateConnectionStatus(message, type) {
            const statusEl = document.getElementById('connection-status');
            statusEl.textContent = message;
            statusEl.className = 'connection-status ' + type;
        }

        function showHistoryViewer() {
            document.getElementById('history-viewer').style.display = 'block';
            document.getElementById('history-feed').innerHTML = '<div class="no-history">Listening for history updates...</div>';
        }

        function hideHistoryViewer() {
            document.getElementById('history-viewer').style.display = 'none';
        }

        function updatePeerCount() {
            const count = room ? room.getPeers().length : 0;
            document.getElementById('peer-count').textContent = count;
        }

        function addHistoryToFeed(historyData, peerId) {
            const historyFeed = document.getElementById('history-feed');
            
            // Remove "no history" message
            const noHistory = historyFeed.querySelector('.no-history');
            if (noHistory) {
                noHistory.remove();
            }
            
            // Create history item element
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const timestamp = new Date().toLocaleTimeString();
            const favicon = historyData.url ? \`https://www.google.com/s2/favicons?domain=\${new URL(historyData.url).hostname}\` : '';
            
            historyItem.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 10px;">
                    \${favicon ? \`<img src="\${favicon}" width="16" height="16" style="border-radius: 2px;" onerror="this.style.display='none'"/>\` : '<span>🌐</span>'}
                    <div style="flex-grow: 1;">
                        <div style="font-weight: bold; font-size: 0.9rem;">\${historyData.title || 'No title'}</div>
                        <div style="font-size: 0.8rem; color: #666; word-break: break-all;">\${historyData.url || 'No URL'}</div>
                        <div style="font-size: 0.7rem; color: #999;">\${timestamp} • From peer \${peerId.substring(0, 8)}</div>
                    </div>
                </div>
            \`;
            
            // Add to top of feed
            historyFeed.insertBefore(historyItem, historyFeed.firstChild);
            
            // Keep only last 20 items
            while (historyFeed.children.length > 20) {
                historyFeed.removeChild(historyFeed.lastChild);
            }
            
            // Add animation
            historyItem.style.animation = 'fadeIn 0.5s ease-in';
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
    '<div style="opacity: 0.7; margin-top: 15px;">Extension not available</div>'
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
    '<div style="opacity: 0.7; margin-top: 15px;">IPA not available</div>'
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
                    ${this.generateFallbackScreenshots()}
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

  findScreenshotForPlatform(platform) {
    // Look for screenshots in test results directories
    const screenshotDirs = [
      'test-results/local-multiplatform/screenshots',
      'test-results/browserstack/screenshots',
      'test-results/screenshots'
    ];
    
    for (const dir of screenshotDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        // Try to find a screenshot that matches the platform name
        const matchingFile = files.find(f => {
          const lowerFile = f.toLowerCase();
          const lowerPlatform = platform.platform?.toLowerCase() || '';
          return lowerFile.includes('chrome') && lowerPlatform.includes('chrome') ||
                 lowerFile.includes('safari') && lowerPlatform.includes('safari') ||
                 lowerFile.includes('ios') && lowerPlatform.includes('ios');
        });
        if (matchingFile) return matchingFile;
        
        // If no specific match, return the first screenshot found
        if (files.length > 0) return files[0];
      }
    }
    return null;
  }

  generateFallbackScreenshots() {
    // Try to find any available screenshots first
    const availableScreenshots = this.findAllAvailableScreenshots();
    
    const fallbackPlatforms = [
      { name: 'Chrome on Desktop', type: 'chrome_desktop', description: 'Desktop extension functionality testing' },
      { name: 'Safari on iOS', type: 'safari_ios', description: 'iOS Safari Web Extension testing' },
      { name: 'Cross-platform sync demo', type: 'sync_demo', description: 'Real-time history synchronization between devices' }
    ];
    
    return fallbackPlatforms.map((platform, index) => {
      const screenshotFile = availableScreenshots[index] || null;
      
      return `
            <div class="screenshot-card">
                ${screenshotFile ? 
                  `<img src="./screenshots/${screenshotFile}" alt="Screenshot: ${platform.name}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.parentElement.innerHTML='<div class=\\"screenshot-placeholder\\">Screenshot: ${platform.name}</div>'" />` :
                  `<div class="screenshot-placeholder">Screenshot: ${platform.name}</div>`
                }
                <div class="screenshot-info">
                    <h4>${platform.name}</h4>
                    <p>${platform.description}</p>
                </div>
            </div>
        `;
    }).join('');
  }

  findAllAvailableScreenshots() {
    const screenshotDirs = [
      'test-results/local-multiplatform/screenshots',
      'test-results/browserstack/screenshots', 
      'test-results/screenshots'
    ];
    
    const allScreenshots = [];
    for (const dir of screenshotDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        allScreenshots.push(...files);
      }
    }
    return allScreenshots;
  }

  generatePlatformScreenshots(platforms) {
    return platforms.map(platform => {
      // Look for actual screenshots for this platform
      const screenshotFile = this.findScreenshotForPlatform(platform);
      
      return `
            <div class="screenshot-card">
                ${screenshotFile ? 
                  `<img src="./screenshots/${screenshotFile}" alt="Screenshot: ${platform.platform}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.parentElement.innerHTML='<div class=\\"screenshot-placeholder\\">Screenshot: ${platform.platform}</div>'" />` :
                  `<div class="screenshot-placeholder">Screenshot: ${platform.platform}</div>`
                }
                <div class="screenshot-info">
                    <h4>${platform.platform}</h4>
                    <p>${platform.platform_type === 'chrome_desktop' ? 'Desktop browser extension' : 'iOS Safari Web Extension'}</p>
                    <div style="margin-top: 10px; font-size: 0.9rem; color: #6c757d;">
                        Tests: ${Object.keys(platform.tests || {}).length} | 
                        Status: ${platform.passed ? 'Passed' : 'Failed'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
  }

  generateP2PDemo() {
    return `
        <div class="card">
            <h2>👁️ Live P2P History Viewer</h2>
            <p>Connect to a real history sync room and view shared browsing history in read-only mode</p>
            
            <div class="viewer-container">
                <div class="connection-panel">
                    <div class="room-input-section">
                        <label for="room-secret">Room Secret:</label>
                        <input type="text" id="room-secret" placeholder="Enter shared secret to view history" />
                        <button onclick="connectToRoom()" class="demo-button primary" id="connect-btn">Connect</button>
                        <button onclick="disconnectFromRoom()" class="demo-button" id="disconnect-btn" disabled>Disconnect</button>
                    </div>
                    <div class="connection-status" id="connection-status">Enter a room secret to connect</div>
                </div>

                <div class="history-viewer" id="history-viewer" style="display: none;">
                    <div class="viewer-header">
                        <h3>📚 Shared History Stream</h3>
                        <div class="peer-count">Peers: <span id="peer-count">0</span></div>
                    </div>
                    
                    <div class="history-feed" id="history-feed">
                        <div class="no-history">No history entries yet. History will appear here when users browse with this room secret.</div>
                    </div>
                </div>

                <div class="viewer-info">
                    <h4>🎯 How to Use</h4>
                    <ul>
                        <li><strong>Get a room secret:</strong> Ask someone using the extension to share their room secret</li>
                        <li><strong>Connect:</strong> Enter the secret above to join their P2P room</li>
                        <li><strong>View history:</strong> See real browsing activity as it happens</li>
                        <li><strong>Read-only:</strong> You can only view, not send history data</li>
                        <li><strong>Private:</strong> Your connection doesn't reveal your browsing history</li>
                    </ul>
                    
                    <div style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ Privacy Note:</strong> Only connect to room secrets you trust. You'll see all browsing activity shared in that room.
                    </div>
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
    const logEntries = [];

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

  copyScreenshots() {
    const screenshotDirs = [
      'test-results/local-multiplatform/screenshots',
      'test-results/browserstack/screenshots',
      'test-results/screenshots'
    ];
    
    const outputScreenshotDir = path.join(this.outputDir, 'screenshots');
    if (!fs.existsSync(outputScreenshotDir)) {
      fs.mkdirSync(outputScreenshotDir, { recursive: true });
    }
    
    let copiedCount = 0;
    for (const dir of screenshotDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        files.forEach(file => {
          const sourcePath = path.join(dir, file);
          const destPath = path.join(outputScreenshotDir, file);
          try {
            fs.copyFileSync(sourcePath, destPath);
            copiedCount++;
          } catch (error) {
            console.warn(`⚠️ Failed to copy screenshot ${file}: ${error.message}`);
          }
        });
      }
    }
    
    if (copiedCount > 0) {
      console.log(`📸 Copied ${copiedCount} screenshots to GitHub Pages`);
    }
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

    // Copy Trystero bundle for P2P functionality
    if (fs.existsSync('dist/trystero-bundle.js')) {
      fs.copyFileSync('dist/trystero-bundle.js', path.join(this.outputDir, 'trystero-bundle.js'));
      console.log('🔗 Copied Trystero P2P bundle');
    }

    // Copy screenshots from test results
    this.copyScreenshots();

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
      console.log('🖼️ Copied extension images');
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