# Contributing to bar123

Technical guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Device information (iOS version, device model)
- Safari version
- Crash logs or error messages

### Suggesting Features

Feature requests are welcome! Please provide:

- A clear and descriptive title
- Detailed description of the proposed feature
- Use cases and benefits
- Mockups or wireframes (if applicable)
- Any potential drawbacks or challenges

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style**:
   - Use SwiftLint (run `swiftlint` before committing)
   - Follow Swift API Design Guidelines
   - Keep code modular and testable
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Ensure all tests pass** (`./test.sh`)
6. **Write a clear commit message**

### Development Setup

1. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/bar123.git
cd bar123
```

2. Open in Xcode:
```bash
open bar123.xcodeproj
```

3. Build and run tests:
```bash
./test.sh
```

### Coding Standards

#### Swift Style Guide

- Use 4 spaces for indentation
- Limit lines to 120 characters
- Use descriptive variable and function names
- Prefer `let` over `var` when possible
- Use guard statements for early returns
- Document public APIs with comments

#### JavaScript Style Guide

- Use 2 spaces for indentation
- Use `const` and `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over promises when possible
- Add JSDoc comments for functions

#### Git Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests

Example:
```
Add background sync optimization

- Reduce battery usage by batching sync operations
- Add exponential backoff for failed syncs
- Improve error handling and logging

Fixes #123
```

### Testing

#### Unit Tests
- Test individual components in isolation
- Mock dependencies
- Cover edge cases
- Aim for >80% code coverage

#### Integration Tests
- Test component interactions
- Test Safari extension communication
- Test P2P sync scenarios

#### UI Tests
- Test user workflows
- Test error states
- Test multi-device scenarios

### Documentation

- Update README.md for user-facing changes
- Update code comments for implementation changes
- Add inline documentation for complex logic
- Include examples in documentation

### Review Process

1. All submissions require review
2. Reviews will check for:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Performance impact
   - Security considerations
3. Address review feedback promptly
4. Be patient - maintainers volunteer their time

### Security

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Email security concerns to the maintainers
3. Include detailed steps to reproduce
4. Allow time for a fix before disclosure

### Questions?

- Check existing documentation
- Search closed issues
- Ask in discussions
- Contact maintainers

Thank you for contributing to make bar123 better!