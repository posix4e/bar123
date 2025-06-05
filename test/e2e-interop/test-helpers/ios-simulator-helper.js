/**
 * Helper utilities for iOS Simulator and Safari extension testing
 */

import { spawn, execSync } from 'child_process';
import path from 'path';

export class IOSSimulatorHelper {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.deviceId = null;
    this.appBundleId = 'com.bar123.app';
    this.buildProcess = null;
  }

  async getOrCreateSimulator(deviceName = 'iPhone 15') {
    try {
      // List available simulators
      const output = execSync('xcrun simctl list devices --json').toString();
      const devices = JSON.parse(output);
      
      // Find iOS devices
      for (const [runtime, deviceList] of Object.entries(devices.devices)) {
        if (runtime.includes('iOS')) {
          const device = deviceList.find(d => d.name === deviceName && d.isAvailable);
          if (device) {
            this.deviceId = device.udid;
            console.log(`Found simulator: ${deviceName} (${this.deviceId})`);
            return this.deviceId;
          }
        }
      }
      
      // Create if not found
      console.log(`Creating new simulator: ${deviceName}`);
      const runtimes = Object.keys(devices.devices).filter(r => r.includes('iOS'));
      const latestRuntime = runtimes.sort().pop();
      
      const createOutput = execSync(
        `xcrun simctl create "${deviceName}" "iPhone 15" "${latestRuntime}"`
      ).toString().trim();
      
      this.deviceId = createOutput;
      return this.deviceId;
      
    } catch (error) {
      throw new Error(`Failed to get/create simulator: ${error.message}`);
    }
  }

  async bootSimulator() {
    if (!this.deviceId) {
      throw new Error('No device ID set');
    }

    try {
      // Check if already booted
      const state = execSync(`xcrun simctl list devices | grep ${this.deviceId}`).toString();
      if (!state.includes('Booted')) {
        console.log('Booting simulator...');
        execSync(`xcrun simctl boot ${this.deviceId}`);
        
        // Wait for boot
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      console.log('Simulator booted');
    } catch (error) {
      console.log('Simulator may already be booted');
    }
  }

  async buildAndInstallApp(scheme = 'bar123') {
    console.log('Building iOS app...');
    
    return new Promise((resolve, reject) => {
      const args = [
        '-project', path.join(this.projectPath, 'bar123.xcodeproj'),
        '-scheme', scheme,
        '-destination', `id=${this.deviceId}`,
        '-derivedDataPath', path.join(this.projectPath, 'build'),
        'build'
      ];

      this.buildProcess = spawn('xcodebuild', args, {
        cwd: this.projectPath,
        stdio: 'pipe'
      });

      let output = '';
      this.buildProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Show progress
        if (data.toString().includes('BUILD SUCCEEDED')) {
          console.log('✅ Build succeeded');
        }
      });

      this.buildProcess.stderr.on('data', (data) => {
        console.error('Build error:', data.toString());
      });

      this.buildProcess.on('close', (code) => {
        if (code === 0) {
          this.installApp()
            .then(() => resolve())
            .catch(reject);
        } else {
          reject(new Error(`Build failed with code ${code}\n${output}`));
        }
      });
    });
  }

  async installApp() {
    console.log('Installing app to simulator...');
    
    // Find the app bundle
    const appPath = execSync(
      `find ${this.projectPath}/build -name "*.app" -type d | head -1`
    ).toString().trim();
    
    if (!appPath) {
      throw new Error('Could not find built app');
    }

    execSync(`xcrun simctl install ${this.deviceId} "${appPath}"`);
    console.log('App installed');
  }

  async launchApp(arguments = []) {
    console.log('Launching app...');
    
    const args = [
      'simctl', 'launch',
      '--console',
      this.deviceId,
      this.appBundleId,
      ...arguments
    ];

    const launch = spawn('xcrun', args);
    
    launch.stdout.on('data', (data) => {
      console.log('App output:', data.toString());
    });

    // Give app time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async openSafariAndBrowse(urls) {
    for (const url of urls) {
      // Open URL in Safari
      execSync(`xcrun simctl openurl ${this.deviceId} "${url}"`);
      
      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async connectToRoom(roomSecret) {
    // This would need to be implemented based on your app's UI
    // For testing, we can use a deep link or app scheme
    const deepLink = `bar123://connect?room=${encodeURIComponent(roomSecret)}`;
    execSync(`xcrun simctl openurl ${this.deviceId} "${deepLink}"`);
  }

  async getAppState() {
    // This would query the app's state via XCTest or a test API
    // For now, return mock data
    return {
      connected: true,
      roomId: 'test-room',
      peerCount: 1,
      historyCount: 5
    };
  }

  async takeScreenshot(name) {
    const screenshotPath = path.join(
      this.projectPath, 
      'test-results', 
      'screenshots',
      `${name}-${Date.now()}.png`
    );
    
    execSync(`xcrun simctl io ${this.deviceId} screenshot "${screenshotPath}"`);
    console.log(`Screenshot saved: ${screenshotPath}`);
    
    return screenshotPath;
  }

  async getAppLogs() {
    try {
      // Get system log for our app
      const logs = execSync(
        `xcrun simctl spawn ${this.deviceId} log show --predicate 'processImagePath contains "bar123"' --last 1m`
      ).toString();
      
      return logs.split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }

  async cleanup() {
    // Terminate app
    try {
      execSync(`xcrun simctl terminate ${this.deviceId} ${this.appBundleId}`);
    } catch (error) {
      // App may not be running
    }

    // Shutdown simulator if we started it
    if (this.deviceId) {
      try {
        execSync(`xcrun simctl shutdown ${this.deviceId}`);
      } catch (error) {
        // May already be shutdown
      }
    }
  }
}

// Utility functions
export async function waitForCondition(checkFn, timeout = 30000, interval = 1000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await checkFn()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Condition not met within timeout');
}

export function parseIOSLogs(logs) {
  return logs.map(line => {
    const match = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+).*?\[(.*?)\]\s+(.*)/);
    if (match) {
      return {
        timestamp: match[1],
        category: match[2],
        message: match[3]
      };
    }
    return { message: line };
  });
}