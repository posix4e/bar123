# Trystero Interoperability Testing

This directory contains tools for testing interoperability between TrysteroSwift and the JavaScript Trystero library.

## Components

### chat-swift/
A Swift command-line chat application that uses TrysteroSwift for P2P communication.

### chat-js/
A Node.js chat application that uses the standard Trystero library.

### relay/
Docker configuration for running a local Nostr relay for testing.

## Running Tests

### Automated Test
```bash
./run-interop-test.sh
```

This script:
1. Starts a local Nostr relay using Docker
2. Builds the Swift chat client
3. Installs JavaScript dependencies
4. Runs both clients in automated test mode
5. Verifies that messages are exchanged correctly

### Interactive Mode
You can also run the chat clients interactively:

1. Start the relay:
   ```bash
   cd relay
   docker-compose up
   ```

2. In one terminal, run the Swift client:
   ```bash
   cd chat-swift
   swift run
   ```

3. In another terminal, run the JavaScript client:
   ```bash
   cd chat-js
   npm start
   ```

Both clients will connect to the same room and you can type messages to send between them.

## Environment Variables

- `RELAY_URL`: WebSocket URL of the Nostr relay (default: `ws://localhost:7777`)
- `ROOM_ID`: Room identifier for peers to join (default: `test-room`)
- `PEER_NAME`: Display name for the peer (default: `swift-peer` or `js-peer`)
- `AUTOMATED_TEST`: Set to `true` for automated testing mode

## GitHub Actions Integration

The interop test is integrated into the CI pipeline. See `.github/workflows/interop-test.yml`.