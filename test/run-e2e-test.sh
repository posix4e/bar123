#!/bin/bash

# E2E test runner for Chrome extension to Swift CLI sync

set -e

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Check if Playwright is installed
if ! npm list playwright &>/dev/null; then
    echo "Installing Playwright..."
    npm install playwright
fi

# Build CLI if needed
if [ ! -f "../cli/.build/debug/bar123-cli" ]; then
    echo "Building CLI..."
    cd ../cli && swift build && cd ../test
fi

# Run the test
echo "Running E2E sync test..."
node e2e-sync-test.js