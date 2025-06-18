# bar123 Testing Guide

This document describes the testing infrastructure for the bar123 P2P history sync system.

## Overview

The project includes comprehensive testing for both JavaScript (Chrome Extension) and Swift (iOS app) components, covering:

- **Linting**: Code style and quality checks
- **Unit Tests**: Component-level testing
- **Integration Tests**: WebRTC and sync protocol testing
- **End-to-End Tests**: Full user flow testing
- **UI Tests**: Interface interaction testing

## Running Tests Locally

### Prerequisites

- Node.js 18+
- npm or yarn
- Xcode 15.2+
- SwiftLint (`brew install swiftlint`)
- Chrome browser

### JavaScript/Chrome Extension

```bash
cd chrome-extension

# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run E2E tests (requires signaling server)
npm run test:e2e

# Run all tests
npm test
```

### Swift/iOS

```bash
# Install SwiftLint if needed
brew install swiftlint

# Run linting
swiftlint lint

# Build and test
xcodebuild test \
  -project bar123.xcodeproj \
  -scheme bar123 \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# Run specific UI tests
xcodebuild test \
  -project bar123.xcodeproj \
  -scheme bar123 \
  -only-testing:bar123UITests/HistorySyncUITests
```

### Full Test Suite

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run complete build and test
./scripts/build-and-test.sh

# Generate test matrix
./scripts/generate-test-matrix.sh
```

## Test Structure

### Chrome Extension Tests

#### E2E Tests (`chrome-extension/tests/e2e/`)

- **websocket-discovery.spec.js**: Tests WebSocket-based peer discovery
- **stun-discovery.spec.js**: Tests STUN-only manual connection flow
- **helpers.js**: Shared test utilities

Tests use Playwright for browser automation and test two Chrome instances connecting via P2P.

### iOS Tests

#### UI Tests (`bar123UITests/`)

- **HistorySyncUITests.swift**: Main UI test suite
  - WebSocket discovery flow
  - STUN-only connection flow
  - History sync verification
  - Device management
  - Performance tests

Tests use XCUITest framework for iOS UI automation.

## CI/CD Integration

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Linting**
   - ESLint for JavaScript
   - SwiftLint for Swift

2. **Building**
   - Chrome extension packaging
   - iOS app and Safari extension compilation

3. **Testing**
   - Playwright E2E tests for Chrome
   - XCUITest for iOS
   - Test result artifacts

4. **Reporting**
   - Test matrix generation
   - PR comments with results
   - Build artifacts

## Test Scenarios

### P2P Connection Tests

1. **WebSocket Discovery**
   - Two peers join same room
   - Automatic peer discovery
   - WebRTC connection establishment
   - History synchronization

2. **STUN-Only Discovery**
   - Manual connection offer/response
   - Copy/paste workflow
   - Connection without signaling server
   - Expiry handling

### Cross-Platform Tests (Future)

- Chrome → iOS sync
- iOS → Chrome sync
- Multiple peer scenarios

## Debugging Tests

### Chrome Extension

1. Run tests with headed browser:
   ```bash
   npx playwright test --headed
   ```

2. Debug specific test:
   ```bash
   npx playwright test websocket-discovery.spec.js --debug
   ```

3. View test report:
   ```bash
   npx playwright show-report
   ```

### iOS

1. Use Xcode test navigator
2. Set breakpoints in test code
3. Run individual tests from Xcode
4. Check test logs in Report navigator

## Known Issues

1. **Extension Loading in Playwright**: Requires special Chrome flags
2. **Multiple iOS Simulators**: Limited by Xcode
3. **Cross-Platform Testing**: Requires manual setup
4. **STUN-Only Automation**: Manual steps are hard to automate

## Contributing

When adding new features:

1. Add appropriate unit tests
2. Update E2E test scenarios
3. Ensure linting passes
4. Update test matrix if needed
5. Run full test suite before PR

## Test Results

See `TEST_MATRIX.md` for current test coverage and results.