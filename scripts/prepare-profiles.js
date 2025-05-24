#!/usr/bin/env node

/**
 * Prepare Provisioning Profiles Script
 * 
 * This script decodes base64-encoded provisioning profiles and certificates
 * and saves them to temporary files for use in the build process.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a consistent directory for the profiles
const tempDir = process.env.RUNNER_TEMP ? path.join(process.env.RUNNER_TEMP, 'ios-profiles') : fs.mkdtempSync(path.join(os.tmpdir(), 'ios-profiles-'));

// Ensure the directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log(`Using profiles directory: ${tempDir}`);

// Function to decode and save a base64 string to a file
function decodeBase64ToFile(base64String, outputPath) {
  if (!base64String) {
    throw new Error(`Base64 string is empty or undefined`);
  }
  
  // Remove any whitespace that might be in the base64 string
  const cleanedBase64 = base64String.replace(/\s/g, '');
  
  // Decode and write to file
  const buffer = Buffer.from(cleanedBase64, 'base64');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`Decoded file saved to: ${outputPath}`);
  return outputPath;
}

// Main function
function main() {
  try {
    // Get base64 encoded values from environment variables
    const certificateBase64 = process.env.BUILD_CERTIFICATE_BASE64;
    const appProfileBase64 = process.env.APP_PROVISIONING_PROFILE_BASE64;
    const extProfileBase64 = process.env.EXTENSION_PROVISIONING_PROFILE_BASE64;
    
    // Validate environment variables
    if (!certificateBase64) {
      throw new Error('BUILD_CERTIFICATE_BASE64 environment variable is required');
    }
    if (!appProfileBase64) {
      throw new Error('APP_PROVISIONING_PROFILE_BASE64 environment variable is required');
    }
    if (!extProfileBase64) {
      throw new Error('EXTENSION_PROVISIONING_PROFILE_BASE64 environment variable is required');
    }
    
    // Define output paths
    const certificatePath = path.join(tempDir, 'certificate.p12');
    const appProfilePath = path.join(tempDir, 'app_profile.mobileprovision');
    const extProfilePath = path.join(tempDir, 'extension_profile.mobileprovision');
    
    // Decode and save files
    decodeBase64ToFile(certificateBase64, certificatePath);
    decodeBase64ToFile(appProfileBase64, appProfilePath);
    decodeBase64ToFile(extProfileBase64, extProfilePath);
    
    // Output paths as JSON for the next step in the workflow
    const result = {
      certificatePath,
      appProfilePath,
      extProfilePath,
      tempDir
    };
    
    // Write to output file if specified
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `paths=${JSON.stringify(result)}\n`);
    }
    
    // Also print to stdout for local usage
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error preparing profiles:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();