#!/usr/bin/env node

/**
 * iOS Build Script
 * 
 * This script handles the iOS build process including:
 * - Setting up code signing
 * - Building the Xcode project
 * - Creating an IPA file
 * - Uploading to TestFlight (if requested)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Configure command line options
program
  .option('-c, --certificate <path>', 'Path to p12 certificate file')
  .option('-p, --password <password>', 'Certificate password')
  .option('-a, --app-profile <path>', 'Path to app provisioning profile')
  .option('-e, --ext-profile <path>', 'Path to extension provisioning profile')
  .option('-o, --output <path>', 'Output directory for IPA file', process.env.RUNNER_TEMP || './build')
  .option('-u, --upload', 'Upload to TestFlight after building')
  .option('-i, --apple-id <email>', 'Apple ID for TestFlight upload')
  .option('-s, --app-password <password>', 'App-specific password for TestFlight upload')
  .parse(process.argv);

const options = program.opts();

// Validate required options
if (!options.certificate || !options.password || !options.appProfile || !options.extProfile) {
  console.error('Error: Missing required options. Use --help for more information.');
  process.exit(1);
}

// Create output directory if it doesn't exist
if (!fs.existsSync(options.output)) {
  fs.mkdirSync(options.output, { recursive: true });
}

// Setup keychain and import certificate
function setupCodeSigning() {
  console.log('Setting up code signing...');
  
  try {
    // Create temporary keychain
    execSync(`security create-keychain -p "temp-password" signing_temp.keychain`);
    execSync(`security set-keychain-settings -lut 21600 signing_temp.keychain`);
    execSync(`security unlock-keychain -p "temp-password" signing_temp.keychain`);
    
    // Import certificate
    execSync(`security import "${options.certificate}" -k signing_temp.keychain -f pkcs12 -A -T /usr/bin/codesign -T /usr/bin/security -P "${options.password}"`);
    
    // Set keychain search list
    execSync(`security list-keychains -d user -s signing_temp.keychain $(security list-keychains -d user | sed s/\\"//g)`);
    execSync(`security default-keychain -s signing_temp.keychain`);
    execSync(`security set-key-partition-list -S apple-tool:,apple: -s -k "temp-password" signing_temp.keychain`);
    
    // Install provisioning profiles
    const profilesDir = path.join(process.env.HOME, 'Library/MobileDevice/Provisioning Profiles');
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    fs.copyFileSync(options.appProfile, path.join(profilesDir, 'app_profile.mobileprovision'));
    fs.copyFileSync(options.extProfile, path.join(profilesDir, 'extension_profile.mobileprovision'));
    
    console.log('Code signing setup complete.');
  } catch (error) {
    console.error('Error setting up code signing:', error.message);
    process.exit(1);
  }
}

// Extract provisioning profile UUIDs
function getProfileUUIDs() {
  console.log('Extracting provisioning profile UUIDs...');
  
  const profilesDir = path.join(process.env.HOME, 'Library/MobileDevice/Provisioning Profiles');
  const appProfilePath = path.join(profilesDir, 'app_profile.mobileprovision');
  const extProfilePath = path.join(profilesDir, 'extension_profile.mobileprovision');
  
  try {
    // Extract UUIDs using Apple's official security and plutil tools
    console.log('Extracting UUIDs from provisioning profiles...');
    const appProfileUUID = execSync(`security cms -D -i "${appProfilePath}" | plutil -extract UUID raw -`).toString().trim();
    const extProfileUUID = execSync(`security cms -D -i "${extProfilePath}" | plutil -extract UUID raw -`).toString().trim();
    
    console.log(`App Profile UUID: ${appProfileUUID}`);
    console.log(`Extension Profile UUID: ${extProfileUUID}`);
    
    // Validate UUIDs
    if (!appProfileUUID || appProfileUUID.length !== 36) {
      throw new Error(`Invalid app profile UUID: ${appProfileUUID}. Profile may be corrupted or invalid.`);
    }
    if (!extProfileUUID || extProfileUUID.length !== 36) {
      throw new Error(`Invalid extension profile UUID: ${extProfileUUID}. Profile may be corrupted or invalid.`);
    }
    
    return { appProfileUUID, extProfileUUID };
  } catch (error) {
    console.error('❌ Failed to extract provisioning profile UUIDs:', error.message);
    console.error('💡 Ensure that:');
    console.error('  - Provisioning profiles are valid and not corrupted');
    console.error('  - Profiles are properly base64 decoded');
    console.error('  - security and plutil commands are available (standard on macOS)');
    process.exit(1);
  }
}

// Build Xcode project
function buildArchive(uuids) {
  console.log('Building Xcode archive...');
  
  const archivePath = path.join(options.output, 'bar123.xcarchive');
  
  try {
    execSync(`xcodebuild \
      -project bar123.xcodeproj \
      -scheme bar123 \
      -destination generic/platform=iOS \
      -archivePath "${archivePath}" \
      archive \
      CODE_SIGN_STYLE=Manual \
      CODE_SIGN_IDENTITY="iPhone Distribution" \
      PROVISIONING_PROFILE="${uuids.appProfileUUID}" \
      "PROVISIONING_PROFILE[sdk=iphoneos*]"="${uuids.appProfileUUID}" \
      PROVISIONING_PROFILE_xyz_foo_bar123_Extension="${uuids.extProfileUUID}"`, 
      { stdio: 'inherit' });
    
    console.log('Archive build complete.');
    return archivePath;
  } catch (error) {
    console.error('Error building archive:', error.message);
    process.exit(1);
  }
}

// Create export options plist
function createExportOptions(uuids) {
  console.log('Creating export options plist...');
  
  if (!uuids.appProfileUUID || !uuids.extProfileUUID) {
    throw new Error('Profile UUIDs are required for export options');
  }
  
  const exportOptionsPath = path.join(options.output, 'ExportOptions.plist');
  const exportOptionsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>2858MX5336</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>xyz.foo.bar123</key>
    <string>${uuids.appProfileUUID}</string>
    <key>xyz.foo.bar123.Extension</key>
    <string>${uuids.extProfileUUID}</string>
  </dict>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>`;
  
  fs.writeFileSync(exportOptionsPath, exportOptionsContent);
  console.log('Export options created at:', exportOptionsPath);
  
  return exportOptionsPath;
}

// Export IPA
function exportIPA(archivePath, exportOptionsPath) {
  console.log('Exporting IPA...');
  
  try {
    execSync(`xcodebuild \
      -exportArchive \
      -archivePath "${archivePath}" \
      -exportOptionsPlist "${exportOptionsPath}" \
      -exportPath "${options.output}"`, 
      { stdio: 'inherit' });
    
    const ipaPath = path.join(options.output, 'bar123.ipa');
    console.log('IPA export complete:', ipaPath);
    
    return ipaPath;
  } catch (error) {
    console.error('Error exporting IPA:', error.message);
    process.exit(1);
  }
}

// Upload to TestFlight
function uploadToTestFlight(ipaPath) {
  if (!options.upload) {
    console.log('Skipping TestFlight upload (use --upload to enable)');
    return;
  }
  
  if (!options.appleId || !options.appPassword) {
    console.error('Error: Apple ID and app-specific password required for TestFlight upload');
    process.exit(1);
  }
  
  console.log('Uploading to TestFlight...');
  
  try {
    // Use xcrun altool for TestFlight uploads (notarytool is for notarization, not TestFlight)
    execSync(`xcrun altool --upload-app \
      --type ios \
      --file "${ipaPath}" \
      --username "${options.appleId}" \
      --password "${options.appPassword}" \
      --verbose`, 
      { stdio: 'inherit' });
    
    console.log('TestFlight upload complete.');
  } catch (error) {
    console.error('Error uploading to TestFlight:', error.message);
    console.error('Note: Ensure you have the latest Xcode command line tools installed');
    process.exit(1);
  }
}

// Cleanup
function cleanup() {
  console.log('Cleaning up...');
  
  try {
    execSync('security default-keychain -s login.keychain');
    execSync('security delete-keychain signing_temp.keychain');
    console.log('Cleanup complete.');
  } catch (error) {
    console.warn('Warning during cleanup:', error.message);
  }
}

// Main function
async function main() {
  let buildSuccess = false;
  let archivePath = null;
  let ipaPath = null;
  
  try {
    console.log('=== iOS Build Process Starting ===');
    console.log(`Node version: ${process.version}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Output directory: ${options.output}`);
    console.log(`Upload to TestFlight: ${options.upload ? 'YES' : 'NO'}`);
    
    setupCodeSigning();
    const uuids = getProfileUUIDs();
    archivePath = buildArchive(uuids);
    const exportOptionsPath = createExportOptions(uuids);
    ipaPath = exportIPA(archivePath, exportOptionsPath);
    
    // Verify IPA was created successfully
    if (!fs.existsSync(ipaPath)) {
      throw new Error(`IPA file not found at expected path: ${ipaPath}`);
    }
    
    const ipaStats = fs.statSync(ipaPath);
    console.log(`IPA created successfully: ${ipaPath} (${(ipaStats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    if (options.upload) {
      uploadToTestFlight(ipaPath);
    }
    
    buildSuccess = true;
    console.log('=== Build process completed successfully! ===');
  } catch (error) {
    console.error('=== Build process failed ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Log build artifacts status
    if (archivePath && fs.existsSync(archivePath)) {
      console.log(`Archive exists: ${archivePath}`);
    }
    if (ipaPath && fs.existsSync(ipaPath)) {
      console.log(`IPA exists: ${ipaPath}`);
    }
    
    process.exit(1);
  } finally {
    cleanup();
    
    // Final status summary
    console.log('=== Build Summary ===');
    console.log(`Status: ${buildSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (ipaPath && fs.existsSync(ipaPath)) {
      const ipaStats = fs.statSync(ipaPath);
      console.log(`Final IPA: ${ipaPath} (${(ipaStats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
}

// Run the main function
main();