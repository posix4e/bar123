// Browser shims for Node.js APIs used by libp2p

/* global queueMicrotask */
/* eslint-disable no-redeclare */

const Buffer = globalThis.Buffer || (() => {
  // Basic Buffer shim
  class Buffer extends Uint8Array {
    static from(data) {
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        return new Buffer(encoder.encode(data));
      }
      return new Buffer(data);
    }
    
    static isBuffer(obj) {
      return obj instanceof Buffer;
    }
    
    toString() {
      const decoder = new TextDecoder();
      return decoder.decode(this);
    }
  }
  return Buffer;
})();

const process = {
  env: {},
  nextTick: (fn) => queueMicrotask(fn),
  version: 'v16.0.0',
  versions: {},
  browser: true
};

globalThis.Buffer = Buffer;
globalThis.process = process;

module.exports = { Buffer, process };