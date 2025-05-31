#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ChromeIOSSyncCompatibilityTester {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      platform: 'chrome-ios-sync-compatibility',
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  addTestResult(testName, passed, details = {}) {
    const result = {
      name: testName,
      passed,
      timestamp: new Date().toISOString(),
      details
    };
        
    this.testResults.tests.push(result);
    this.testResults.summary.total++;
        
    if (passed) {
      this.testResults.summary.passed++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      this.testResults.summary.failed++;
      console.log(`❌ ${testName}: FAILED`);
      if (details.error) {
        console.log(`   Error: ${details.error}`);
      }
      if (details.details) {
        console.log(`   Details: ${details.details}`);
      }
    }
  }

  async testTrysteroConfiguration() {
    console.log('🧪 Testing Trystero configuration compatibility...');
    
    try {
      // Check Chrome extension offscreen script
      const chromeOffscreenPath = 'chrome-extension/offscreen.js';
      const chromeOffscreenExists = fs.existsSync(chromeOffscreenPath);
      
      let chromeConfig = null;
      let chromeAppId = null;
      if (chromeOffscreenExists) {
        const content = fs.readFileSync(chromeOffscreenPath, 'utf8');
        const appIdMatch = content.match(/appId:\s*['"]([^'"]+)['"]/);
        chromeAppId = appIdMatch ? appIdMatch[1] : null;
        
        // Check if room joining uses proper config
        const roomJoinMatch = content.match(/trystero\.joinRoom\(([^)]+)\)/);
        chromeConfig = roomJoinMatch ? roomJoinMatch[1] : null;
      }
      
      // Check iOS TrysteroSwift implementation
      const iOSViewControllerPath = 'bar123/ViewController.swift';
      const iOSViewControllerExists = fs.existsSync(iOSViewControllerPath);
      
      let iOSConfig = null;
      let iOSAppIdEquivalent = null;
      if (iOSViewControllerExists) {
        const content = fs.readFileSync(iOSViewControllerPath, 'utf8');
        
        // Check for RoomConfig usage
        const configMatch = content.match(/RoomConfig\(([^)]+)\)/);
        iOSConfig = configMatch ? configMatch[1] : null;
        
        // Check for app identification in room joining
        const roomJoinMatch = content.match(/Trystero\.joinRoom\([^,]+,\s*roomId:\s*([^)]+)\)/);
        iOSAppIdEquivalent = roomJoinMatch ? 'roomId-based' : null;
      }
      
      const configCompatible = chromeAppId === 'history-sync' && iOSConfig && iOSConfig.includes('relays');
      
      this.addTestResult('Trystero Configuration Compatibility', configCompatible, {
        chromeOffscreenExists,
        iOSViewControllerExists,
        chromeAppId,
        chromeConfig: chromeConfig ? chromeConfig.substring(0, 50) + '...' : null,
        iOSConfig: iOSConfig ? iOSConfig.substring(0, 50) + '...' : null,
        details: configCompatible ? 'Configurations use compatible patterns' : 'Chrome uses appId, iOS uses relay-based config - need alignment'
      });
      
    } catch (error) {
      this.addTestResult('Trystero Configuration Compatibility', false, {
        error: error.message
      });
    }
  }

  async testDataStructureCompatibility() {
    console.log('🧪 Testing data structure compatibility...');
    
    try {
      // Check Chrome extension history structure
      const chromeBackgroundPath = 'chrome-extension/background.js';
      const chromeBackgroundExists = fs.existsSync(chromeBackgroundPath);
      
      let chromeHistoryFields = [];
      if (chromeBackgroundExists) {
        const content = fs.readFileSync(chromeBackgroundPath, 'utf8');
        
        // Look for history entry field references
        const fieldMatches = content.match(/entry\.[a-zA-Z_]+/g) || [];
        chromeHistoryFields = [...new Set(fieldMatches.map(m => m.replace('entry.', '')))];
      }
      
      // Check iOS history structure
      const iOSViewControllerPath = 'bar123/ViewController.swift';
      const iOSViewControllerExists = fs.existsSync(iOSViewControllerPath);
      
      let iOSHistoryFields = [];
      if (iOSViewControllerExists) {
        const content = fs.readFileSync(iOSViewControllerPath, 'utf8');
        
        // Look for HistoryEntry struct fields (main struct, not nested)
        const structMatch = content.match(/struct HistoryEntry[^{]*\{([^}]*?)struct\s+ArticleContent/s);
        if (structMatch) {
          const structContent = structMatch[1];
          const fieldMatches = structContent.match(/let\s+([a-zA-Z_]+):/g) || [];
          iOSHistoryFields = fieldMatches.map(m => m.replace(/let\s+|:/g, ''));
        } else {
          // Fallback: look for any HistoryEntry struct
          const fallbackMatch = content.match(/struct HistoryEntry[^}]+\{([^}]+)\}/s);
          if (fallbackMatch) {
            const structContent = fallbackMatch[1];
            const fieldMatches = structContent.match(/let\s+([a-zA-Z_]+):/g) || [];
            iOSHistoryFields = fieldMatches.map(m => m.replace(/let\s+|:/g, ''));
          }
        }
      }
      
      // Check for common essential fields
      const essentialFields = ['id', 'url', 'title', 'visitTime', 'deviceId'];
      const chromeHasEssentials = essentialFields.every(field => 
        chromeHistoryFields.includes(field) || chromeBackgroundExists && 
        fs.readFileSync(chromeBackgroundPath, 'utf8').includes(field)
      );
      const iOSHasEssentials = essentialFields.every(field => iOSHistoryFields.includes(field));
      
      const structureCompatible = chromeHasEssentials && iOSHasEssentials;
      
      this.addTestResult('Data Structure Compatibility', structureCompatible, {
        chromeBackgroundExists,
        iOSViewControllerExists,
        chromeHistoryFields: chromeHistoryFields.slice(0, 10),
        iOSHistoryFields,
        essentialFields,
        chromeHasEssentials,
        iOSHasEssentials,
        details: structureCompatible ? 'Both platforms have essential fields' : 'Missing essential fields in one or both platforms'
      });
      
    } catch (error) {
      this.addTestResult('Data Structure Compatibility', false, {
        error: error.message
      });
    }
  }

  async testP2PMessageHandling() {
    console.log('🧪 Testing P2P message handling compatibility...');
    
    try {
      // Check Chrome extension message actions
      const chromeOffscreenPath = 'chrome-extension/offscreen.js';
      const chromeOffscreenExists = fs.existsSync(chromeOffscreenPath);
      
      let chromeActions = [];
      let chromeHasSendCapability = false;
      if (chromeOffscreenExists) {
        const content = fs.readFileSync(chromeOffscreenPath, 'utf8');
        
        // Check for makeAction calls
        const actionMatches = content.match(/makeAction\(['"]([^'"]+)['"]\)/g) || [];
        chromeActions = actionMatches.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
        
        // Check if it can send (has send function)
        chromeHasSendCapability = content.includes('sendHistory') || content.includes('send(');
      }
      
      // Check iOS message handling
      const iOSViewControllerPath = 'bar123/ViewController.swift';
      const iOSViewControllerExists = fs.existsSync(iOSViewControllerPath);
      
      let iOSHasSendCapability = false;
      let iOSHasReceiveCapability = false;
      if (iOSViewControllerExists) {
        const content = fs.readFileSync(iOSViewControllerPath, 'utf8');
        
        iOSHasSendCapability = content.includes('trysteroRoom?.send(') || content.includes('send(');
        iOSHasReceiveCapability = content.includes('onData') || content.includes('handleReceivedData');
      }
      
      const messageHandlingCompatible = 
        chromeActions.includes('history-sync') && 
        (chromeHasSendCapability || iOSHasSendCapability) &&
        iOSHasReceiveCapability;
      
      this.addTestResult('P2P Message Handling Compatibility', messageHandlingCompatible, {
        chromeOffscreenExists,
        iOSViewControllerExists,
        chromeActions,
        chromeHasSendCapability,
        iOSHasSendCapability,
        iOSHasReceiveCapability,
        details: messageHandlingCompatible ? 
          'Both platforms can handle P2P messaging' : 
          'Missing send/receive capabilities for proper P2P sync'
      });
      
    } catch (error) {
      this.addTestResult('P2P Message Handling Compatibility', false, {
        error: error.message
      });
    }
  }

  async testSecretHashingCompatibility() {
    console.log('🧪 Testing secret hashing compatibility...');
    
    try {
      // Check Chrome hashing implementation
      const chromeBackgroundPath = 'chrome-extension/background.js';
      const chromeBackgroundExists = fs.existsSync(chromeBackgroundPath);
      
      let chromeHashMethod = null;
      if (chromeBackgroundExists) {
        const content = fs.readFileSync(chromeBackgroundPath, 'utf8');
        
        if (content.includes('crypto.subtle.digest') && content.includes('SHA-256')) {
          chromeHashMethod = 'SHA-256';
        }
      }
      
      // Check iOS hashing implementation
      const iOSViewControllerPath = 'bar123/ViewController.swift';
      const iOSViewControllerExists = fs.existsSync(iOSViewControllerPath);
      
      let iOSHashMethod = null;
      if (iOSViewControllerExists) {
        const content = fs.readFileSync(iOSViewControllerPath, 'utf8');
        
        if (content.includes('SHA256') || content.includes('CryptoKit')) {
          iOSHashMethod = 'SHA-256';
        }
      }
      
      const hashingCompatible = chromeHashMethod === 'SHA-256' && iOSHashMethod === 'SHA-256';
      
      this.addTestResult('Secret Hashing Compatibility', hashingCompatible, {
        chromeBackgroundExists,
        iOSViewControllerExists,
        chromeHashMethod,
        iOSHashMethod,
        details: hashingCompatible ? 
          'Both platforms use SHA-256 for secret hashing' : 
          'Different or missing hashing methods - room IDs may not match'
      });
      
    } catch (error) {
      this.addTestResult('Secret Hashing Compatibility', false, {
        error: error.message
      });
    }
  }

  async testRelayCompatibility() {
    console.log('🧪 Testing relay configuration compatibility...');
    
    try {
      // Check if iOS specifies relays
      const iOSViewControllerPath = 'bar123/ViewController.swift';
      const iOSViewControllerExists = fs.existsSync(iOSViewControllerPath);
      
      let iOSRelays = [];
      if (iOSViewControllerExists) {
        const content = fs.readFileSync(iOSViewControllerPath, 'utf8');
        
        const relayMatches = content.match(/wss:\/\/[^"']+/g) || [];
        iOSRelays = relayMatches;
      }
      
      // Check if Chrome uses default Trystero relays (should work with iOS relays)
      const chromeOffscreenPath = 'chrome-extension/offscreen.js';
      const chromeOffscreenExists = fs.existsSync(chromeOffscreenPath);
      
      let chromeUsesDefaultRelays = false;
      if (chromeOffscreenExists) {
        const content = fs.readFileSync(chromeOffscreenPath, 'utf8');
        
        // Chrome should use default Trystero relays if no explicit relays configured
        chromeUsesDefaultRelays = !content.includes('relays:') && content.includes('trystero.joinRoom');
      }
      
      // Compatibility check: iOS should use standard Nostr relays that work with Trystero defaults
      const hasStandardRelays = iOSRelays.some(relay => 
        relay.includes('relay.damus.io') || 
        relay.includes('relay.nostr.band') || 
        relay.includes('nos.lol')
      );
      
      const relayCompatible = chromeUsesDefaultRelays && hasStandardRelays;
      
      this.addTestResult('Relay Configuration Compatibility', relayCompatible, {
        chromeOffscreenExists,
        iOSViewControllerExists,
        iOSRelays,
        chromeUsesDefaultRelays,
        hasStandardRelays,
        details: relayCompatible ? 
          'iOS uses standard relays compatible with Chrome defaults' : 
          'Relay configuration mismatch may prevent connection'
      });
      
    } catch (error) {
      this.addTestResult('Relay Configuration Compatibility', false, {
        error: error.message
      });
    }
  }

  async saveResults() {
    const resultsDir = './test-results/chrome-ios-sync';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
        
    const resultsFile = path.join(resultsDir, 'compatibility-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.testResults, null, 2));
        
    console.log(`💾 Results saved to ${resultsFile}`);
  }

  async run() {
    try {
      console.log('🧪 Starting Chrome-iOS sync compatibility tests...');
            
      await this.testTrysteroConfiguration();
      await this.testDataStructureCompatibility();
      await this.testP2PMessageHandling();
      await this.testSecretHashingCompatibility();
      await this.testRelayCompatibility();
            
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.addTestResult('Test Suite', false, { error: error.message });
    } finally {
      await this.saveResults();
            
      // Print summary
      console.log('\n📊 Chrome-iOS Sync Compatibility Summary:');
      console.log(`   Total: ${this.testResults.summary.total}`);
      console.log(`   Passed: ${this.testResults.summary.passed}`);
      console.log(`   Failed: ${this.testResults.summary.failed}`);
      
      if (this.testResults.summary.failed > 0) {
        console.log('\n🔧 Issues found that may prevent Chrome-iOS sync:');
        this.testResults.tests.filter(t => !t.passed).forEach(test => {
          console.log(`   - ${test.name}: ${test.details.details || test.details.error}`);
        });
      }
            
      // Exit with appropriate code
      process.exit(this.testResults.summary.failed > 0 ? 1 : 0);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ChromeIOSSyncCompatibilityTester();
  tester.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ChromeIOSSyncCompatibilityTester;