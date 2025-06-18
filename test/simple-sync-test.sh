#!/bin/bash

# Simple test script for bar123 sync and export

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Bar123 Sync & Export Test${NC}"
echo "============================"

# Check if CLI is built
CLI_PATH="../cli/.build/debug/bar123-cli"
if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}❌ CLI not found. Building...${NC}"
    cd ../cli && swift build && cd ../test
fi

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Step 1: Clean up
echo -e "\n${YELLOW}1️⃣ Cleaning up existing peers...${NC}"
$CLI_PATH delete-peer --all 2>/dev/null || true

# Step 2: List current peers (should be empty)
echo -e "\n${YELLOW}2️⃣ Current peers (should be empty):${NC}"
$CLI_PATH list-peers

# Step 3: Create a test peer
echo -e "\n${YELLOW}3️⃣ Creating test peer...${NC}"
$CLI_PATH announce --name "Test Device" --type "test"

# Step 4: List peers again
echo -e "\n${YELLOW}4️⃣ Current peers (should show test peer):${NC}"
$CLI_PATH list-peers

# Step 5: Generate test history
echo -e "\n${YELLOW}5️⃣ Generating test history...${NC}"
mkdir -p ~/.bar123

# Create test history
cat > ~/.bar123/history.json << EOF
[
  {
    "id": "$(uuidgen)",
    "url": "https://github.com/anthropics/claude",
    "title": "Claude Repository - GitHub",
    "deviceId": "test-device-1",
    "deviceName": "Test Browser",
    "visitDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  {
    "id": "$(uuidgen)",
    "url": "https://stackoverflow.com/questions/swift",
    "title": "Swift Questions - Stack Overflow",
    "deviceId": "test-device-1",
    "deviceName": "Test Browser",
    "visitDate": "$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ)"
  },
  {
    "id": "$(uuidgen)",
    "url": "https://news.ycombinator.com",
    "title": "Hacker News",
    "deviceId": "test-device-2",
    "deviceName": "Mobile Browser",
    "visitDate": "$(date -u -v-10M +%Y-%m-%dT%H:%M:%SZ)"
  }
]
EOF

echo "✅ Created test history with 3 entries"

# Step 6: Export in different formats
echo -e "\n${YELLOW}6️⃣ Exporting history...${NC}"

echo -e "\n${GREEN}JSON Format (to stdout):${NC}"
echo "------------------------"
$CLI_PATH export --format json --pretty

echo -e "\n${GREEN}CSV Format (to stdout):${NC}"
echo "------------------------"
$CLI_PATH export --format csv

echo -e "\n${GREEN}JSON Lines Format (to stdout):${NC}"
echo "------------------------"
$CLI_PATH export --format jsonl

# Step 7: Show how to redirect output
echo -e "\n${YELLOW}7️⃣ Example redirections:${NC}"
echo "To save JSON: $CLI_PATH export --format json > history.json"
echo "To save CSV:  $CLI_PATH export --format csv > history.csv"
echo "To save JSONL: $CLI_PATH export --format jsonl > history.jsonl"

# Step 8: Filter examples
echo -e "\n${YELLOW}8️⃣ Filtering examples:${NC}"
echo -e "\n${GREEN}Filter by device:${NC}"
$CLI_PATH export --device "test-device-1" --format json --pretty

echo -e "\n${GREEN}✅ Test completed!${NC}"