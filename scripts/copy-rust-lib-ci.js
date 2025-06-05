#!/usr/bin/env node

// Cross-platform script to copy Rust library build artifacts

const fs = require('fs');
const path = require('path');

const platform = process.platform;
const srcDir = path.join(__dirname, '..', 'libp2p-ffi', 'target', 'release');
const distDir = path.join(__dirname, '..', 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Determine library extension based on platform
let libName, libExt;
if (platform === 'darwin') {
  libName = 'liblibp2p_ffi.dylib';
  libExt = '.dylib';
} else if (platform === 'win32') {
  libName = 'libp2p_ffi.dll';
  libExt = '.dll';
} else {
  libName = 'liblibp2p_ffi.so';
  libExt = '.so';
}

// Copy library file
const srcLib = path.join(srcDir, libName);
const dstLib = path.join(distDir, libName);

if (fs.existsSync(srcLib)) {
  fs.copyFileSync(srcLib, dstLib);
  console.log(`✅ Copied ${libName} to dist/`);
} else {
  console.warn(`⚠️  Library ${srcLib} not found, skipping copy`);
}

// Copy header file
const srcHeader = path.join(__dirname, '..', 'libp2p-ffi', 'libp2p_ffi.h');
const dstHeader = path.join(distDir, 'libp2p_ffi.h');

if (fs.existsSync(srcHeader)) {
  fs.copyFileSync(srcHeader, dstHeader);
  console.log('✅ Copied libp2p_ffi.h to dist/');
} else {
  console.warn('⚠️  Header file not found, skipping copy');
}