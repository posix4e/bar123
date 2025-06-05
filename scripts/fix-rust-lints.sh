#!/bin/bash

# Fix Rust linting issues in libp2p-ffi

cd libp2p-ffi

# First, try to auto-fix what we can
cargo clippy --fix --allow-dirty --allow-staged || true

# Run cargo fmt
cargo fmt

# Check if there are still issues
echo "Checking remaining issues..."
cargo clippy -- -D warnings 2>&1 | head -20