# iOS Code Signing Guide

This document explains how to generate and set up the required secrets for iOS code signing in the GitHub Actions workflow.

## Required Secrets

The following secrets need to be set in your GitHub repository:

1. `BUILD_CERTIFICATE_BASE64`: Base64-encoded p12 certificate
2. `P12_PASSWORD`: Password for the p12 certificate
3. `APP_PROVISIONING_PROFILE_BASE64`: Base64-encoded app provisioning profile
4. `EXTENSION_PROVISIONING_PROFILE_BASE64`: Base64-encoded extension provisioning profile
5. `APPLE_ID`: Apple ID email
6. `APP_SPECIFIC_PASSWORD`: App-specific password for Apple ID

## Generating the Secrets

### Certificate (P12)

1. Open Keychain Access on your Mac
2. Select the certificate you want to export (should include the private key)
3. Right-click and select "Export"
4. Choose the .p12 format and set a strong password
5. Convert to base64:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

### Provisioning Profiles

1. Download the provisioning profiles from the Apple Developer Portal
   - One for the main app
   - One for the extension
2. Convert to base64:
   ```bash
   base64 -i profile.mobileprovision | pbcopy
   ```

### App-Specific Password

1. Go to https://appleid.apple.com/
2. Sign in with your Apple ID
3. Go to "Security" > "App-Specific Passwords"
4. Click "Generate Password" and follow the instructions

## Setting the Secrets in GitHub

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add each of the required secrets with their respective values

## Troubleshooting

### MAC Verification Failed

If you see an error like:
```
security: SecKeychainItemImport: MAC verification failed during PKCS12 import (wrong password?)
```

This means either:
1. The P12 password is incorrect
2. The P12 certificate is corrupted or improperly encoded

To fix:
1. Re-export the certificate from Keychain Access
2. Make sure to use the correct password
3. Ensure the base64 encoding is done properly without line breaks:
   ```bash
   base64 -i certificate.p12 | tr -d '\n' | pbcopy
   ```

### Provisioning Profile Issues

If you encounter provisioning profile errors:
1. Make sure the profiles are still valid and not expired
2. Verify the profiles are for the correct app bundle identifiers
3. Check that the profiles are properly encoded in base64
4. Ensure the team ID in the workflow matches the team ID in the profiles

## Manual Testing

You can test the code signing process locally using the npm scripts:

```bash
# Install dependencies
npm install

# Set environment variables
export BUILD_CERTIFICATE_BASE64="your_base64_certificate"
export P12_PASSWORD="your_p12_password"
export APP_PROVISIONING_PROFILE_BASE64="your_base64_app_profile"
export EXTENSION_PROVISIONING_PROFILE_BASE64="your_base64_extension_profile"

# Build locally without uploading to TestFlight
npm run ios-build-local

# Build and upload to TestFlight
export APPLE_ID="your_apple_id@example.com"
export APP_SPECIFIC_PASSWORD="your_app_specific_password"
npm run ios-build-testflight
```