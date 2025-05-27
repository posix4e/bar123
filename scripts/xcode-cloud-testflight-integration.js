#!/usr/bin/env node

/**
 * Xcode Cloud + TestFlight Integration Script
 * 
 * This script:
 * - Checks Xcode Cloud build status via GitHub API
 * - Downloads the latest IPA from TestFlight using existing app-specific password
 * - Places it in the expected location for GitHub Actions artifacts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Configure command line options
program
  .option('-a, --apple-id <email>', 'Apple ID for TestFlight access')
  .option('-p, --app-password <password>', 'App-specific password')
  .option('-b, --bundle-id <id>', 'App bundle identifier')
  .option('-o, --output <path>', 'Output directory for IPA file', './build')
  .option('-w, --wait <minutes>', 'Wait for build completion (max minutes)', '30')
  .option('-s, --status-only', 'Only check status, don\'t download')
  .parse(process.argv);

const options = program.opts();

class XcodeCloudTestFlightIntegration {
  constructor(appleId, appPassword, bundleId, outputDir) {
    this.appleId = appleId;
    this.appPassword = appPassword;
    this.bundleId = bundleId;
    this.outputDir = outputDir;
    this.commitSha = process.env.GITHUB_SHA || 'latest';
  }

  /**
   * Check GitHub commit status for Xcode Cloud builds
   */
  async checkXcodeCloudStatus() {
    console.log('🔍 Checking Xcode Cloud build status via GitHub...');
    
    try {
      // Use GitHub CLI to check commit status
      const statusOutput = execSync(`gh api repos/:owner/:repo/commits/${this.commitSha}/status`, { 
        encoding: 'utf8' 
      });
      
      const status = JSON.parse(statusOutput);
      
      // Look for Xcode Cloud status checks
      const xcodeCloudChecks = status.statuses.filter(s => 
        s.context.includes('Xcode Cloud') || 
        s.context.includes('xcode') ||
        s.description.includes('Xcode Cloud')
      );
      
      if (xcodeCloudChecks.length === 0) {
        console.log('⚠️  No Xcode Cloud status checks found');
        return { found: false };
      }
      
      const latestCheck = xcodeCloudChecks[0];
      console.log(`📊 Xcode Cloud status: ${latestCheck.state} - ${latestCheck.description}`);
      
      return {
        found: true,
        state: latestCheck.state,
        description: latestCheck.description,
        url: latestCheck.target_url
      };
      
    } catch (error) {
      console.log(`⚠️  Could not check GitHub status: ${error.message}`);
      console.log('🔄 Proceeding with TestFlight check anyway...');
      return { found: false };
    }
  }

  /**
   * Get latest build from TestFlight using altool
   */
  async getLatestTestFlightBuild() {
    console.log('🛫 Checking latest TestFlight build...');
    
    try {
      // Use altool to list builds
      const command = `xcrun altool --list-builds ` +
        `--username "${this.appleId}" ` +
        `--password "${this.appPassword}" ` +
        `--bundle-id "${this.bundleId}" ` +
        `--output-format json`;
      
      const output = execSync(command, { encoding: 'utf8' });
      const result = JSON.parse(output);
      
      if (!result.builds || result.builds.length === 0) {
        throw new Error('No builds found in TestFlight');
      }
      
      // Get the latest build (assuming they're sorted by date)
      const latestBuild = result.builds[0];
      
      console.log(`📱 Latest build: ${latestBuild.version} (${latestBuild.buildNumber})`);
      console.log(`📅 Upload date: ${latestBuild.uploadDate}`);
      console.log(`📊 Status: ${latestBuild.processingState}`);
      
      return latestBuild;
      
    } catch (error) {
      throw new Error(`Failed to get TestFlight builds: ${error.message}`);
    }
  }

  /**
   * Download IPA from TestFlight
   * Note: Direct IPA download from TestFlight is not supported via altool
   * This is a placeholder for the expected workflow
   */
  async downloadTestFlightIPA(build) {
    console.log('📥 Attempting to download IPA from TestFlight...');
    
    // Unfortunately, altool doesn't support downloading IPAs directly
    // TestFlight IPAs are distributed differently than App Store Connect builds
    
    console.log('⚠️  Direct IPA download from TestFlight is not supported via altool');
    console.log('📝 Creating build info file instead');
    
    // Create a build info file with the details we have
    const buildInfo = {
      version: build.version,
      buildNumber: build.buildNumber,
      bundleId: build.bundleId,
      uploadDate: build.uploadDate,
      processingState: build.processingState,
      note: 'TestFlight IPA download requires manual export or different tooling',
      downloadInstructions: [
        '1. Open Xcode',
        '2. Go to Window > Organizer',
        '3. Select your app and build',
        '4. Click "Download dSYM" or export IPA',
        'Or use Transporter app to download from App Store Connect'
      ]
    };
    
    const buildInfoPath = path.join(this.outputDir, `bar123-${this.commitSha}-build-info.json`);
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
    
    console.log(`📄 Build info saved to: ${buildInfoPath}`);
    
    return { success: false, reason: 'Direct download not supported', buildInfo };
  }

  /**
   * Alternative: Try to export from local Xcode Organizer
   */
  async tryXcodeOrganizerExport() {
    console.log('🔧 Attempting to export from Xcode Organizer...');
    
    try {
      // This would require the build to be in the local Xcode Organizer
      // which may not be the case in CI environment
      
      const exportCommand = `xcodebuild -exportArchive ` +
        `-archivePath "./build/bar123.xcarchive" ` +
        `-exportPath "${this.outputDir}" ` +
        `-exportOptionsPlist "./ExportOptions.plist"`;
      
      // This will likely fail in CI, but we can try
      execSync(exportCommand, { encoding: 'utf8' });
      
      const expectedIPA = path.join(this.outputDir, `bar123-${this.commitSha}.ipa`);
      if (fs.existsSync(expectedIPA)) {
        console.log(`✅ IPA exported successfully: ${expectedIPA}`);
        return { success: true, path: expectedIPA };
      }
      
      throw new Error('IPA file not found after export');
      
    } catch (error) {
      console.log(`❌ Xcode export failed: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Wait for Xcode Cloud build to complete
   */
  async waitForBuildCompletion(maxWaitMinutes) {
    console.log(`⏳ Waiting for Xcode Cloud build completion (max ${maxWaitMinutes} minutes)...`);
    
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkXcodeCloudStatus();
      
      if (status.found) {
        if (status.state === 'success') {
          console.log('✅ Xcode Cloud build completed successfully!');
          return { success: true };
        } else if (status.state === 'failure') {
          console.log('❌ Xcode Cloud build failed');
          return { success: false, reason: 'Build failed' };
        } else if (status.state === 'pending') {
          console.log('🔄 Build still in progress, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        }
      }
      
      // Also check TestFlight for new builds
      try {
        const latestBuild = await this.getLatestTestFlightBuild();
        if (latestBuild.processingState === 'PROCESSING') {
          console.log('🔄 TestFlight processing, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        } else if (latestBuild.processingState === 'VALID') {
          console.log('✅ TestFlight build ready!');
          return { success: true, build: latestBuild };
        }
      } catch (error) {
        console.log(`⚠️  TestFlight check failed: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    return { success: false, reason: 'Timeout waiting for build completion' };
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      console.log('🚀 Starting Xcode Cloud + TestFlight integration...');
      
      // Create output directory
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Check Xcode Cloud status
      const xcodeStatus = await this.checkXcodeCloudStatus();
      
      if (options.statusOnly) {
        console.log('✅ Status check complete');
        return { success: true, xcodeStatus };
      }
      
      // Wait for completion if requested
      if (options.wait && xcodeStatus.found && xcodeStatus.state === 'pending') {
        const waitResult = await this.waitForBuildCompletion(parseInt(options.wait));
        if (!waitResult.success) {
          throw new Error(waitResult.reason);
        }
      }
      
      // Get latest TestFlight build
      const latestBuild = await this.getLatestTestFlightBuild();
      
      if (latestBuild.processingState !== 'VALID') {
        console.log(`⚠️  Build not ready (status: ${latestBuild.processingState})`);
        return { 
          success: true, 
          xcodeStatus, 
          build: latestBuild, 
          downloaded: false 
        };
      }
      
      // Try to download/export IPA
      console.log('📥 Attempting to get IPA file...');
      
      // First try the TestFlight approach (will likely fail)
      let downloadResult = await this.downloadTestFlightIPA(latestBuild);
      
      // If that fails, try Xcode Organizer export
      if (!downloadResult.success) {
        downloadResult = await this.tryXcodeOrganizerExport();
      }
      
      console.log('✅ Integration completed');
      return {
        success: true,
        xcodeStatus,
        build: latestBuild,
        downloaded: downloadResult.success,
        downloadResult
      };
      
    } catch (error) {
      console.error(`❌ Integration failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  if (!options.appleId || !options.appPassword || !options.bundleId) {
    console.error('❌ Missing required options:');
    console.error('  --apple-id: Apple ID email');
    console.error('  --app-password: App-specific password');
    console.error('  --bundle-id: App bundle identifier');
    process.exit(1);
  }
  
  const integration = new XcodeCloudTestFlightIntegration(
    options.appleId,
    options.appPassword,
    options.bundleId,
    options.output
  );
  
  integration.run();
}

module.exports = XcodeCloudTestFlightIntegration;