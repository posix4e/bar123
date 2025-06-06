#!/bin/bash
set -e

echo "🧪 Bar123 Interoperability Test Suite"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is required${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}npx is required${NC}"
    exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]] && ! command -v xcodebuild &> /dev/null; then
    echo -e "${YELLOW}Warning: Xcode not found. Swift tests will be skipped.${NC}"
    SKIP_SWIFT=1
fi

# Build extensions if needed
echo -e "\n${YELLOW}Building extensions...${NC}"
npm run build

# JavaScript to JavaScript tests (Chrome to Chrome)
echo -e "\n${YELLOW}=== JavaScript to JavaScript Tests ===${NC}"
run_test "Chrome to Chrome Extension Sync" \
    "npx playwright test --project=chrome-to-chrome"

# Swift to Swift tests (Safari iOS to Safari iOS)
if [[ -z "$SKIP_SWIFT" ]]; then
    echo -e "\n${YELLOW}=== Swift to Swift Tests ===${NC}"
    
    # Run XCTest UI tests
    run_test "Safari to Safari Extension Sync" \
        "xcodebuild test \
            -project bar123.xcodeproj \
            -scheme bar123UITests \
            -destination 'platform=iOS Simulator,name=iPhone 15' \
            -only-testing:bar123UITests/SafariToSafariUITests"
else
    echo -e "\n${YELLOW}Skipping Swift tests (Xcode not available)${NC}"
fi

# Cross-platform tests (Safari iOS to Chrome)
echo -e "\n${YELLOW}=== Cross-Platform Tests ===${NC}"

if [[ -z "$SKIP_SWIFT" ]]; then
    run_test "Safari iOS to Chrome Extension Sync" \
        "npx playwright test --project=cross-platform"
else
    echo -e "${YELLOW}Skipping cross-platform tests (requires Xcode)${NC}"
fi

# Summary
echo -e "\n${BLUE}==============================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}==============================${NC}"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi