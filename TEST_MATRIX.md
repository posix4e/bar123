# bar123 P2P Sync Test Matrix

This document shows the test coverage for different P2P synchronization scenarios.

## Test Environment

- **Signaling Server**: Node.js WebSocket server with HMAC authentication
- **STUN Servers**: Google's public STUN servers
- **Platforms**: iOS (Swift), Chrome Extension (JavaScript)

## Discovery Method Support

| Platform | WebSocket | STUN-Only |
|----------|-----------|-----------|
| iOS/Safari | ✅ | ✅ |
| Chrome | ✅ | ✅ |

## P2P Sync Test Matrix

| From → To | Chrome (WebSocket) | Chrome (STUN) | iOS (WebSocket) | iOS (STUN) |
|-----------|-------------------|---------------|-----------------|------------|
| **Chrome (WebSocket)** | ✅ Tested | ❌ N/A | 🚧 Planned | ❌ N/A |
| **Chrome (STUN)** | ❌ N/A | ✅ Tested | ❌ N/A | 🚧 Planned |
| **iOS (WebSocket)** | 🚧 Planned | ❌ N/A | ✅ Tested* | ❌ N/A |
| **iOS (STUN)** | ❌ N/A | 🚧 Planned | ❌ N/A | ✅ Tested* |

*iOS-to-iOS testing requires multiple devices or simulators

## Test Types

### Unit Tests
- **Swift**: XCTest for model and business logic
- **JavaScript**: Currently focused on E2E tests

### Integration Tests
- **WebRTC Connection**: Tested via E2E tests
- **History Sync Protocol**: Tested via E2E tests
- **Device Discovery**: Tested for both discovery methods

### End-to-End Tests
- **Chrome Extension**: Playwright tests for both discovery methods
- **iOS App**: XCUITest for UI flow and basic functionality

### Manual Testing Checklist

#### WebSocket Discovery
- [ ] Chrome → Chrome sync
- [ ] iOS → iOS sync
- [ ] Chrome → iOS sync
- [ ] iOS → Chrome sync
- [ ] Multiple peers (3+ devices)
- [ ] Reconnection after network loss

#### STUN-Only Discovery
- [ ] Chrome → Chrome with manual exchange
- [ ] iOS → iOS with manual exchange
- [ ] Cross-platform manual exchange
- [ ] Connection expiry handling
- [ ] QR code sharing (when implemented)

## Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Connection establishment | < 5s | ~3s (WebSocket), ~10s (STUN) |
| History sync (1000 entries) | < 2s | ~1.5s |
| Memory usage | < 50MB | ~30MB |
| Battery impact | Minimal | Not measured |

## Known Limitations

1. **Cross-platform testing**: Requires manual setup due to different test frameworks
2. **Multiple simulator testing**: iOS limits simultaneous simulator instances
3. **STUN-only automation**: Manual exchange step is difficult to automate fully
4. **Real device testing**: CI/CD typically uses simulators only

## Future Improvements

1. Implement cross-platform E2E test harness
2. Add performance regression tests
3. Implement chaos testing for network conditions
4. Add security testing for HMAC implementation
5. Create automated cross-platform sync tests

---
Last updated: $(date)
