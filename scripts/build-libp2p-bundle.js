// Build script to bundle js-libp2p for Chrome extension
const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../chrome-extension/libp2p-client.js')],
      bundle: true,
      format: 'iife',
      globalName: 'LibP2PBundle',
      outfile: path.join(__dirname, '../chrome-extension/libp2p-bundle.js'),
      platform: 'browser',
      target: ['chrome90'],
      define: {
        'global': 'globalThis',
        'process.env.NODE_ENV': '"production"'
      },
      alias: {
        'node:crypto': 'crypto',
        'node:stream': 'stream-browserify',
        'node:buffer': 'buffer'
      },
      inject: [path.join(__dirname, 'browser-shims.js')],
      external: [],
      sourcemap: false,
      minify: false
    });
    
    console.log('✅ Successfully built libp2p bundle for Chrome extension');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();