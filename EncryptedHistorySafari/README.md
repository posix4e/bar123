# Encrypted History Safari Extension

A Safari extension that stores browsing history encrypted using a secret and syncs it to Pantry cloud storage.

## Features

- Automatically captures browsing history
- Compresses data using zlib before encryption for efficient storage
- Encrypts history using AES-GCM with a user-defined secret
- Configurable sync interval (0.5 to 24 hours)
- Automatic 30-day expiration for old history entries
- Syncs to Pantry cloud storage at your configured interval or when 100+ entries accumulate
- Background sync handled by native Swift code
- Popup UI to view synced history
- Shows last sync time with automatic updates

## Setup

1. **Get a Pantry ID:**
   - Go to https://getpantry.cloud
   - Create a free account to get your Pantry ID

2. **Build the Extension:**
   - Open the project in Xcode
   - Build and run the app
   - Enable the extension in Safari preferences

3. **Configure:**
   - Set your encryption secret (keep this safe!)
   - Enter your Pantry ID
   - Optionally change the basket name (default: "encrypted-history")

## Architecture

- **JavaScript Side:** Captures browsing events and sends to Swift
- **Swift Side:** Handles encryption, local storage, and background sync
- **Pantry Storage:** Cloud storage for encrypted history data

## Security

- History is encrypted using AES-GCM before storage
- Encryption key derived from user secret using SHA256
- Only encrypted data is sent to Pantry
- Each device has a unique ID for multi-device support

## Sync Behavior

- Automatic sync at configurable intervals (default 1 hour)
- Immediate sync when 100+ entries accumulate
- Manual sync available via popup or settings
- Resilient to network failures (retries on next sync)
- History older than 30 days is automatically removed