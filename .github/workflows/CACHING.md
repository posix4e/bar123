# CI/CD Caching Strategy

This document describes the caching implemented in our GitHub Actions workflow to speed up builds.

## Cached Dependencies

### 1. **npm Dependencies** (built-in with setup-node)
- **What**: node_modules directory
- **Key**: Based on package-lock.json hash
- **Cache hit rate**: High (changes only when dependencies update)
- **Time saved**: ~30-60 seconds

### 2. **Rust/Cargo Dependencies**
- **What**: 
  - Cargo registry (~/.cargo)
  - Compiled dependencies (target/)
- **Key**: Based on Cargo.lock hash
- **Cache hit rate**: High
- **Time saved**: ~2-5 minutes (avoiding recompilation)

### 3. **Homebrew Packages**
- **What**: SwiftLint and other brew packages
- **Key**: Based on workflow file hash
- **Cache hit rate**: Very high
- **Time saved**: ~1-2 minutes

### 4. **Swift Package Manager**
- **What**: 
  - Xcode DerivedData
  - SPM packages
- **Key**: Based on Package.resolved and project.pbxproj
- **Cache hit rate**: Medium-High
- **Time saved**: ~1-3 minutes

### 5. **Chrome Binary**
- **What**: Chrome for testing
- **Key**: Based on package-lock.json
- **Cache hit rate**: Very high
- **Time saved**: ~30-60 seconds

### 6. **Playwright Browsers**
- **What**: Chromium for E2E tests
- **Key**: Based on package-lock.json
- **Cache hit rate**: High
- **Time saved**: ~1-2 minutes

## Cache Invalidation

Caches are automatically invalidated when:
- package-lock.json changes (npm, Chrome, Playwright)
- Cargo.lock changes (Rust)
- Package.resolved or project.pbxproj changes (Swift)
- Workflow file changes (Homebrew)

## Monitoring

The workflow includes a "Display cache statistics" step that shows:
- Cache hit/miss for each cache
- Size of cached directories
- Helps identify cache effectiveness

## Best Practices

1. **Don't cache build outputs** that change frequently
2. **Use restore-keys** for partial cache matches
3. **Monitor cache sizes** to avoid hitting GitHub's 10GB limit
4. **Clear caches** if they become corrupted (via GitHub UI)

## Estimated Time Savings

With all caches hit:
- **Before**: ~15-20 minutes
- **After**: ~5-8 minutes
- **Savings**: ~10-12 minutes per build