/**
 * Global setup for Playwright tests
 * Builds extensions before running tests
 */

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

async function globalSetup() {
  console.log('🔧 Setting up test environment...\n');

  // Check if Chrome extension exists
  const extensionPath = path.join(process.cwd(), 'chrome-extension');
  try {
    await fs.access(path.join(extensionPath, 'manifest.json'));
    console.log('✅ Chrome extension found');
  } catch {
    console.log('Building Chrome extension...');
    await runCommand('npm', ['run', 'build-chrome']);
  }

  // Check if libp2p FFI is built
  const ffiPath = path.join(process.cwd(), 'dist/liblibp2p_ffi.dylib');
  try {
    await fs.access(ffiPath);
    console.log('✅ libp2p FFI library found');
  } catch {
    console.log('Building libp2p FFI...');
    await runCommand('npm', ['run', 'build-libp2p']);
  }

  // Create test results directory
  await fs.mkdir('test-results', { recursive: true });

  console.log('\n✅ Test environment ready\n');
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} failed with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

module.exports = globalSetup;