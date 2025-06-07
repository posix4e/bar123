#!/bin/bash

# bar123 Test Script
# Runs build and tests locally

set -e

echo "🔨 Building bar123..."

# Clean build folder
xcodebuild clean \
  -project bar123.xcodeproj \
  -scheme bar123 \
  -sdk iphonesimulator \
  -quiet

# Build the project
xcodebuild build \
  -project bar123.xcodeproj \
  -scheme bar123 \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  ONLY_ACTIVE_ARCH=NO

echo "✅ Build successful!"

echo "🧪 Running tests..."

# Run tests
xcodebuild test \
  -project bar123.xcodeproj \
  -scheme bar123 \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  ONLY_ACTIVE_ARCH=NO \
  -resultBundlePath TestResults

echo "✅ Tests passed!"

# Check if SwiftLint is installed
if command -v swiftlint &> /dev/null; then
    echo "🔍 Running SwiftLint..."
    swiftlint lint
else
    echo "⚠️  SwiftLint not installed. Install with: brew install swiftlint"
fi

echo "🎉 All checks passed!"