#!/bin/bash

# Test Cloudflare DNS using the CLI tool
# This script uses the credentials from .env file

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Testing Cloudflare DNS with bar123 CLI${NC}"
echo "=================================="

# Change to CLI directory
cd "$(dirname "$0")/../cli"

# Load .env file if it exists
if [ -f "../.env" ]; then
    echo -e "${GREEN}✅ Loading credentials from .env${NC}"
    export $(cat ../.env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ No .env file found${NC}"
    exit 1
fi

# Build the CLI tool
echo -e "\n${YELLOW}📦 Building CLI tool...${NC}"
swift build

# Run Cloudflare DNS test
echo -e "\n${YELLOW}🔍 Testing Cloudflare DNS Discovery...${NC}"
swift run bar123 test-cloudflare

# Monitor peer discovery for 10 seconds
echo -e "\n${YELLOW}👀 Monitoring peer discovery for 10 seconds...${NC}"
swift run bar123 monitor --duration 10 &
MONITOR_PID=$!

# Wait a bit then kill the monitor
sleep 10
kill $MONITOR_PID 2>/dev/null || true

# Simulate sync
echo -e "\n${YELLOW}🔄 Simulating history sync...${NC}"
swift run bar123 sync --entries 5 --method cloudflare

# Search test
echo -e "\n${YELLOW}🔎 Testing search functionality...${NC}"
swift run bar123 search "github"

echo -e "\n${GREEN}✅ All CLI tests completed!${NC}"
echo -e "\nTo run individual commands:"
echo -e "  ${YELLOW}swift run bar123 test-cloudflare${NC}"
echo -e "  ${YELLOW}swift run bar123 monitor --duration 30${NC}"
echo -e "  ${YELLOW}swift run bar123 sync --entries 10${NC}"
echo -e "  ${YELLOW}swift run bar123 search 'query'${NC}"