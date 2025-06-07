# WebRTC Signaling Server

## Overview
This Node.js WebSocket server facilitates WebRTC peer connections by relaying signaling messages (SDP offers/answers and ICE candidates) between peers. All messages are authenticated using HMAC-SHA256 with a pre-shared secret.

## Installation
```bash
npm install
```

## Configuration
Set the following environment variables:
- `PORT`: Server port (default: 8080)
- `SHARED_SECRET`: Pre-shared secret for HMAC authentication

## Running the Server
```bash
# Production
SHARED_SECRET=your-secret-here npm start

# Development with auto-reload
SHARED_SECRET=your-secret-here npm run dev
```

## Protocol

### Message Format
All messages must include HMAC authentication:
```json
{
  "data": { /* actual message content */ },
  "hmac": "sha256-hmac-hex-string"
}
```

### Message Types

1. **Join Room**
```json
{
  "type": "join",
  "roomId": "room-name",
  "peerId": "unique-peer-id",
  "deviceInfo": {
    "name": "Device Name",
    "type": "ios|chrome|native"
  }
}
```

2. **WebRTC Offer**
```json
{
  "type": "offer",
  "targetPeerId": "peer-id",
  "offer": { /* RTCSessionDescription */ }
}
```

3. **WebRTC Answer**
```json
{
  "type": "answer",
  "targetPeerId": "peer-id",
  "answer": { /* RTCSessionDescription */ }
}
```

4. **ICE Candidate**
```json
{
  "type": "ice-candidate",
  "targetPeerId": "peer-id",
  "candidate": { /* RTCIceCandidate */ }
}
```

## Security Considerations
- The shared secret must be distributed out-of-band
- Use HTTPS/WSS in production
- Implement rate limiting for production use
- Consider using different secrets per room/user group