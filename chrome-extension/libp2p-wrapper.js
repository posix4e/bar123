// Wrapper to export LibP2PClient for bundling
import { LibP2PClient } from './libp2p-client.js';

// Export for IIFE bundle
window.LibP2PBundle = {
  LibP2PClient
};

export { LibP2PClient };