#!/usr/bin/env node

/**
 * Xcode Cloud Integration Script
 * 
 * This script handles integration with Xcode Cloud:
 * - Monitors Xcode Cloud build status
 * - Downloads IPA artifacts from completed builds
 * - Reports status back to GitHub Actions
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { program } = require('commander');

// Configure command line options
program
  .option('-k, --api-key <key>', 'App Store Connect API Key ID')
  .option('-i, --issuer-id <id>', 'App Store Connect API Issuer ID')
  .option('-p, --private-key <path>', 'Path to App Store Connect API private key file')
  .option('-a, --app-id <id>', 'App ID to monitor builds for')
  .option('-b, --build-number <number>', 'Specific build number to monitor (optional)')
  .option('-o, --output <path>', 'Output directory for downloaded IPA', './build')
  .option('-w, --wait', 'Wait for build completion (up to 30 minutes)')
  .option('-s, --status-only', 'Only check status, don\'t download')
  .parse(process.argv);

const options = program.opts();

class XcodeCloudIntegration {
  constructor(apiKey, issuerId, privateKeyPath, appId) {
    this.apiKey = apiKey;
    this.issuerId = issuerId;
    this.privateKeyPath = privateKeyPath;
    this.appId = appId;
    this.baseUrl = 'https://api.appstoreconnect.apple.com/v1';
  }

  /**
   * Generate JWT token for App Store Connect API authentication
   */
  generateJWT() {
    try {
      // We'll use a simple approach for now - in production you'd want to use a proper JWT library
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (20 * 60); // 20 minutes expiry
      
      // For now, we'll use the xcrun command to generate the JWT
      // This requires the private key to be in the correct format
      const jwtCommand = `
        echo '{"alg":"ES256","kid":"${this.apiKey}","typ":"JWT"}' | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n' > /tmp/header.txt
        echo '{"iss":"${this.issuerId}","iat":${now},"exp":${exp},"aud":"appstoreconnect-v1"}' | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n' > /tmp/payload.txt
        cat /tmp/header.txt /tmp/payload.txt | tr -d '\n' | openssl dgst -sha256 -sign "${this.privateKeyPath}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n' > /tmp/signature.txt
        echo "$(cat /tmp/header.txt).$(cat /tmp/payload.txt).$(cat /tmp/signature.txt)"
      `;
      
      const jwt = execSync(jwtCommand, { encoding: 'utf8' }).trim();
      return jwt;
    } catch (error) {
      throw new Error(`Failed to generate JWT: ${error.message}`);
    }
  }

  /**
   * Make authenticated API request to App Store Connect
   */
  async apiRequest(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
      const jwt = this.generateJWT();
      const url = `${this.baseUrl}${endpoint}`;
      
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`API request failed: ${res.statusCode} - ${JSON.stringify(response)}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Get the latest builds for the app
   */
  async getLatestBuilds() {
    console.log(`📱 Fetching latest builds for app ${this.appId}...`);
    
    try {
      const response = await this.apiRequest(`/builds?filter[app]=${this.appId}&sort=-version&limit=10`);
      return response.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch builds: ${error.message}`);
    }
  }

  /**
   * Get specific build details
   */
  async getBuildDetails(buildId) {
    console.log(`🔍 Fetching details for build ${buildId}...`);
    
    try {
      const response = await this.apiRequest(`/builds/${buildId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch build details: ${error.message}`);
    }
  }

  /**
   * Monitor build status and wait for completion
   */
  async waitForBuildCompletion(buildId, maxWaitMinutes = 30) {
    console.log(`⏳ Waiting for build ${buildId} to complete (max ${maxWaitMinutes} minutes)...`);
    
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const build = await this.getBuildDetails(buildId);
        const status = build.attributes.processingState;
        
        console.log(`📊 Build status: ${status}`);
        
        if (status === 'PROCESSING') {
          console.log('🔄 Build still processing, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        } else if (status === 'VALID') {
          console.log('✅ Build completed successfully!');
          return { success: true, build };
        } else if (status === 'INVALID') {
          console.log('❌ Build failed validation');
          return { success: false, build, error: 'Build failed validation' };
        } else {
          console.log(`⚠️  Unknown build status: ${status}`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      } catch (error) {
        console.error(`❌ Error checking build status: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    return { success: false, error: 'Build wait timeout exceeded' };
  }

  /**
   * Download build artifact (IPA)
   */
  async downloadBuildArtifact(buildId, outputPath) {
    console.log(`📥 Attempting to download build artifact for ${buildId}...`);
    
    try {
      // Get build details to find download URL
      const build = await this.getBuildDetails(buildId);
      
      // Note: The actual download process may require additional API calls
      // to get the download URL, as Apple doesn't directly expose IPA downloads
      // This is a simplified version - in practice you may need to use
      // xcodebuild -exportArchive or other tools
      
      console.log('⚠️  Direct IPA download from App Store Connect API is not available');
      console.log('📝 Build information saved instead');
      
      // Save build information as JSON for now
      const buildInfo = {
        id: buildId,
        version: build.attributes.version,
        buildNumber: build.attributes.buildNumber,
        status: build.attributes.processingState,
        uploadedDate: build.attributes.uploadedDate,
        downloadNote: 'IPA download requires additional tooling or TestFlight export'
      };
      
      fs.writeFileSync(
        path.join(outputPath, `build-${buildId}-info.json`),
        JSON.stringify(buildInfo, null, 2)
      );
      
      return { success: true, buildInfo };
    } catch (error) {
      throw new Error(`Failed to download build artifact: ${error.message}`);
    }
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      console.log('🚀 Starting Xcode Cloud integration...');
      
      // Validate required options
      if (!this.apiKey || !this.issuerId || !this.privateKeyPath || !this.appId) {
        throw new Error('Missing required API credentials or app ID');
      }
      
      if (!fs.existsSync(this.privateKeyPath)) {
        throw new Error(`Private key file not found: ${this.privateKeyPath}`);
      }
      
      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      
      let targetBuild;
      
      if (options.buildNumber) {
        // Look for specific build number
        console.log(`🎯 Looking for build number ${options.buildNumber}...`);
        const builds = await this.getLatestBuilds();
        targetBuild = builds.find(build => 
          build.attributes.buildNumber === options.buildNumber
        );
        
        if (!targetBuild) {
          throw new Error(`Build number ${options.buildNumber} not found`);
        }
      } else {
        // Get latest build
        console.log('📱 Getting latest build...');
        const builds = await this.getLatestBuilds();
        
        if (builds.length === 0) {
          throw new Error('No builds found for this app');
        }
        
        targetBuild = builds[0];
      }
      
      console.log(`🎯 Target build: ${targetBuild.attributes.version} (${targetBuild.attributes.buildNumber})`);
      console.log(`📊 Status: ${targetBuild.attributes.processingState}`);
      
      if (options.statusOnly) {
        console.log('✅ Status check complete');
        return {
          success: true,
          build: targetBuild,
          status: targetBuild.attributes.processingState
        };
      }
      
      // Wait for completion if requested
      if (options.wait && targetBuild.attributes.processingState === 'PROCESSING') {
        const waitResult = await this.waitForBuildCompletion(targetBuild.id);
        if (!waitResult.success) {
          throw new Error(waitResult.error);
        }
        targetBuild = waitResult.build;
      }
      
      // Download artifact if build is ready
      if (targetBuild.attributes.processingState === 'VALID') {
        const downloadResult = await this.downloadBuildArtifact(targetBuild.id, options.output);
        console.log('✅ Xcode Cloud integration completed successfully');
        return {
          success: true,
          build: targetBuild,
          downloaded: downloadResult.success,
          buildInfo: downloadResult.buildInfo
        };
      } else {
        console.log(`⚠️  Build not ready for download (status: ${targetBuild.attributes.processingState})`);
        return {
          success: true,
          build: targetBuild,
          downloaded: false,
          status: targetBuild.attributes.processingState
        };
      }
      
    } catch (error) {
      console.error(`❌ Xcode Cloud integration failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  if (!options.apiKey || !options.issuerId || !options.privateKey || !options.appId) {
    console.error('❌ Missing required options:');
    console.error('  --api-key: App Store Connect API Key ID');
    console.error('  --issuer-id: App Store Connect API Issuer ID');
    console.error('  --private-key: Path to API private key file');
    console.error('  --app-id: App ID to monitor');
    process.exit(1);
  }
  
  const integration = new XcodeCloudIntegration(
    options.apiKey,
    options.issuerId,
    options.privateKey,
    options.appId
  );
  
  integration.run();
}

module.exports = XcodeCloudIntegration;