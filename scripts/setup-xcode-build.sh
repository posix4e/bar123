#!/bin/bash

# Script to set up Xcode build with Rust libp2p integration

set -e

echo "Setting up Xcode build with Rust libp2p..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Build the npm project first (includes Rust library)
echo "Building npm project..."
npm run build

# Copy Rust library to proper location
echo "Copying Rust library..."
./scripts/copy-rust-lib.sh

# Try to build the project
echo "Attempting Xcode build..."
xcodebuild -project bar123.xcodeproj -target "bar123 Extension" -configuration Debug build

echo "Xcode build setup complete!"