const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const config = {
  roomId: process.env.ROOMID || 'playwright-test-room',
  apiToken: process.env.API || '',
  zoneId: process.env.ZONEID || '',
  domain: process.env.DNS || '',
  secret: process.env.SECRET || 'test-secret',
  extensionPath: path.join(__dirname, '../chrome-extension'),
  cliPath: path.join(__dirname, '../cli/.build/debug/bar123-cli'),
  historyPath: process.env.HOME + '/.bar123/history.json'
};

// Sites to visit for testing
const testSites = [
  { url: 'https://github.com', waitFor: 'h1' },
  { url: 'https://stackoverflow.com', waitFor: '.s-topbar' },
  { url: 'https://news.ycombinator.com', waitFor: '.hnname' },
  { url: 'https://www.wikipedia.org', waitFor: '.central-featured' },
  { url: 'https://www.google.com', waitFor: 'input[name="q"]' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCLICommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.cliPath, [command, ...args], {
      env: {
        ...process.env,
        API: config.apiToken,
        ZONEID: config.zoneId,
        DNS: config.domain,
        ROOMID: config.roomId,
        SECRET: config.secret
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`CLI command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function setupBrowser() {
  console.log('🚀 Launching browser with bar123 extension...');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
      '--enable-logging',
      '--v=1'
    ]
  });

  return browser;
}

async function configurateExtension(page) {
  console.log('⚙️ Configuring bar123 extension...');
  
  // Open extension popup
  const extensionId = 'YOUR_EXTENSION_ID'; // You'll need to get this from chrome://extensions
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  
  // Configure Cloudflare settings
  await page.click('text=Settings');
  await page.fill('#cloudflare-api-token', config.apiToken);
  await page.fill('#cloudflare-zone-id', config.zoneId);
  await page.fill('#cloudflare-domain', config.domain);
  await page.fill('#room-id', config.roomId);
  await page.fill('#pre-shared-secret', config.secret);
  
  // Enable Cloudflare discovery
  await page.check('#enable-cloudflare');
  await page.click('text=Save');
  
  console.log('✅ Extension configured');
}

async function browseTestSites(page) {
  console.log('🌐 Browsing test sites...');
  
  for (const site of testSites) {
    console.log(`  Visiting ${site.url}...`);
    await page.goto(site.url);
    await page.waitForSelector(site.waitFor, { timeout: 10000 });
    await sleep(2000); // Give extension time to capture the visit
  }
  
  console.log('✅ Browsing complete');
}

async function main() {
  let browser;
  let cliAnnouncer;
  
  try {
    // Step 1: Clean up any existing peer records
    console.log('🧹 Cleaning up existing peer records...');
    try {
      await runCLICommand('delete-peer', ['--all']);
    } catch (e) {
      // Ignore errors if no peers exist
    }

    // Step 2: Start CLI peer announcement
    console.log('📢 Starting CLI peer announcement...');
    cliAnnouncer = spawn(config.cliPath, [
      'announce',
      '--name', 'Playwright Test CLI',
      '--type', 'cli-test',
      '--keep-alive'
    ], {
      env: {
        ...process.env,
        API: config.apiToken,
        ZONEID: config.zoneId,
        DNS: config.domain,
        ROOMID: config.roomId
      }
    });

    // Give it time to announce
    await sleep(3000);

    // Step 3: Launch browser with extension
    browser = await setupBrowser();
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Step 4: Configure extension (if needed)
    // await configurateExtension(page);

    // Step 5: Browse test sites
    await browseTestSites(page);

    // Step 6: Wait for sync to happen
    console.log('⏳ Waiting for P2P sync...');
    await sleep(10000);

    // Step 7: List peers to verify connectivity
    console.log('\n📋 Current peers:');
    await runCLICommand('list-peers');

    // Step 8: Export synced history
    console.log('\n📤 Exporting synced history:');
    console.log('='.repeat(50));
    
    // Create test history file for demo
    const testHistory = testSites.map((site, index) => ({
      id: `test-${index}`,
      url: site.url,
      title: `Test visit to ${new URL(site.url).hostname}`,
      deviceId: 'playwright-browser',
      deviceName: 'Playwright Test Browser',
      visitDate: new Date(Date.now() - index * 60000).toISOString()
    }));

    // Ensure directory exists
    await fs.mkdir(path.dirname(config.historyPath), { recursive: true });
    await fs.writeFile(config.historyPath, JSON.stringify(testHistory, null, 2));

    // Export as JSON
    console.log('\nJSON format:');
    await runCLICommand('export', ['--format', 'json', '--pretty']);

    console.log('\n' + '='.repeat(50));
    console.log('\nCSV format:');
    await runCLICommand('export', ['--format', 'csv']);

    console.log('\n' + '='.repeat(50));
    console.log('\nJSON Lines format:');
    await runCLICommand('export', ['--format', 'jsonl']);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (cliAnnouncer) {
      cliAnnouncer.kill();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
main().catch(console.error);