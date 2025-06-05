#!/usr/bin/env node

/**
 * Test for Safari extension functionality
 * Note: This requires Xcode and macOS to run
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectPath = path.join(__dirname, '..');

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: projectPath,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString().trim());
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function buildSafariExtension() {
  console.log('Building Safari extension...');
  
  // First build the Rust library
  await runCommand('npm', ['run', 'build-libp2p']);
  
  // Then build the Xcode project
  await runCommand('xcodebuild', [
    '-project', 'bar123.xcodeproj',
    '-scheme', 'bar123',
    '-configuration', 'Debug',
    '-derivedDataPath', 'build',
    'build'
  ]);
  
  console.log('✅ Safari extension built successfully');
}

async function runSafariTest() {
  console.log('🧪 Starting Safari Extension Test\n');

  try {
    // Build the extension
    await buildSafariExtension();

    // Run unit tests if available
    console.log('\nRunning Safari extension unit tests...');
    await runCommand('xcodebuild', [
      'test',
      '-project', 'bar123.xcodeproj',
      '-scheme', 'bar123Tests',
      '-destination', 'platform=iOS Simulator,name=iPhone 15'
    ]);

    console.log('\n✅ Safari extension tests PASSED!');

  } catch (error) {
    console.error('\n❌ Safari test failed:', error.message);
    process.exit(1);
  }
}

// Check if we're on macOS
if (process.platform !== 'darwin') {
  console.log('⚠️  Safari extension tests can only run on macOS');
  process.exit(0);
}

runSafariTest().catch(console.error);