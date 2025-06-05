#!/usr/bin/env node

/**
 * Local test runner for development
 * Provides an easy way to run specific tests with debugging
 */

import { spawn } from 'child_process';
import { program } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

program
  .name('run-local-test')
  .description('Run bar123 interop tests locally')
  .version('1.0.0')
  .option('-t, --test <type>', 'Test type: js-js, swift-swift, swift-js, or all', 'all')
  .option('--headed', 'Run browsers in headed mode (visible)')
  .option('--debug', 'Enable debug logging')
  .option('--slow', 'Slow down test execution for debugging')
  .option('--screenshots', 'Take screenshots at each step')
  .option('--keep-open', 'Keep browsers open after test')
  .parse();

const options = program.opts();

async function ensureTestResults() {
  await fs.mkdir('test-results', { recursive: true });
  await fs.mkdir('test-results/screenshots', { recursive: true });
  await fs.mkdir('test-results/videos', { recursive: true });
}

async function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue(`\n▶ Running: ${command} ${args.join(' ')}`));
    
    const proc = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function runJsJsTests() {
  console.log(chalk.yellow('\n🧪 Running JavaScript to JavaScript tests...\n'));
  
  const args = ['playwright', 'test', '--project=chrome-to-chrome'];
  
  if (options.headed) {
    args.push('--headed');
  }
  
  if (options.debug) {
    args.push('--debug');
  }
  
  if (options.slow) {
    args.push('--slow-mo=1000');
  }
  
  const env = {};
  if (options.screenshots) {
    env.SCREENSHOTS = 'true';
  }
  
  if (options.keepOpen) {
    env.KEEP_BROWSERS_OPEN = 'true';
  }
  
  await runCommand('npx', args, env);
}

async function runSwiftSwiftTests() {
  console.log(chalk.yellow('\n🧪 Running Swift to Swift tests...\n'));
  
  // Check if on macOS
  if (process.platform !== 'darwin') {
    console.log(chalk.red('⚠️  Swift tests can only run on macOS'));
    return;
  }
  
  const args = [
    'test',
    '-project', 'bar123.xcodeproj',
    '-scheme', 'bar123UITests',
    '-destination', 'platform=iOS Simulator,name=iPhone 15',
    '-only-testing:bar123UITests/SafariToSafariUITests'
  ];
  
  if (options.debug) {
    args.push('-verbose');
  }
  
  await runCommand('xcodebuild', args);
}

async function runSwiftJsTests() {
  console.log(chalk.yellow('\n🧪 Running Cross-Platform tests...\n'));
  
  if (process.platform !== 'darwin') {
    console.log(chalk.red('⚠️  Cross-platform tests require macOS'));
    return;
  }
  
  // Start test coordinator first
  console.log(chalk.blue('Starting test coordinator...'));
  const coordinator = spawn('node', [
    path.join(import.meta.url, '../test-helpers/test-coordinator.js')
  ], { detached: true });
  
  // Give coordinator time to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const args = ['playwright', 'test', '--project=cross-platform'];
    
    if (options.headed) {
      args.push('--headed');
    }
    
    await runCommand('npx', args);
  } finally {
    // Stop coordinator
    coordinator.kill();
  }
}

async function main() {
  console.log(chalk.bold.green('\n🚀 Bar123 Local Test Runner\n'));
  
  // Ensure directories exist
  await ensureTestResults();
  
  // Check dependencies
  try {
    await fs.access('node_modules');
  } catch {
    console.log(chalk.yellow('Installing dependencies...'));
    await runCommand('npm', ['install']);
  }
  
  // Build if needed
  try {
    await fs.access('chrome-extension/manifest.json');
  } catch {
    console.log(chalk.yellow('Building extensions...'));
    await runCommand('npm', ['run', 'build']);
  }
  
  // Run tests based on selection
  try {
    switch (options.test) {
    case 'js-js':
      await runJsJsTests();
      break;
        
    case 'swift-swift':
      await runSwiftSwiftTests();
      break;
        
    case 'swift-js':
      await runSwiftJsTests();
      break;
        
    case 'all':
      await runJsJsTests();
      if (process.platform === 'darwin') {
        await runSwiftSwiftTests();
        await runSwiftJsTests();
      }
      break;
        
    default:
      console.error(chalk.red(`Unknown test type: ${options.test}`));
      process.exit(1);
    }
    
    console.log(chalk.bold.green('\n✅ Tests completed successfully!\n'));
    
    // Show results location
    console.log(chalk.blue('📊 Test results available at:'));
    console.log(`   - HTML Report: ${chalk.cyan('test-results/playwright-report/index.html')}`);
    console.log(`   - Screenshots: ${chalk.cyan('test-results/screenshots/')}`);
    console.log(`   - Videos: ${chalk.cyan('test-results/videos/')}\n`);
    
  } catch (error) {
    console.error(chalk.bold.red('\n❌ Tests failed!\n'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Helper to install chalk if not available
async function ensureChalk() {
  try {
    await import('chalk');
  } catch {
    console.log('Installing chalk for colored output...');
    await runCommand('npm', ['install', '--no-save', 'chalk']);
  }
}

// Run
ensureChalk().then(() => main()).catch(console.error);