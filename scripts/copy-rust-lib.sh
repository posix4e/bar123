#!/bin/bash

# Script to copy Rust libp2p library for Xcode builds

set -e

echo "Building Rust libp2p library for iOS..."

# Add iOS targets if not already added
rustup target add aarch64-apple-ios
rustup target add x86_64-apple-ios

cd libp2p-ffi

# Build for iOS device (ARM64)
echo "Building for iOS ARM64..."
cargo build --release --target aarch64-apple-ios

# Build for iOS simulator (x86_64)
echo "Building for iOS simulator x86_64..."
cargo build --release --target x86_64-apple-ios

cd ..

# Create frameworks directory if it doesn't exist
mkdir -p "bar123 Extension/Frameworks"

# Use lipo to create universal library (if we want simulator support)
# For now, just use the device library
cp "libp2p-ffi/target/aarch64-apple-ios/release/liblibp2p_ffi.a" "bar123 Extension/Frameworks/"

# Copy the header
cp "libp2p-ffi/libp2p_ffi.h" "bar123 Extension/"

echo "Rust libp2p library built and copied successfully for iOS"