#!/bin/bash
set -e

echo "=== Trystero Swift/JS Interop Test ==="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Clean up function
cleanup() {
    echo -e "\n${GREEN}Cleaning up...${NC}"
    
    # Stop relay
    if [ -n "$RELAY_PID" ]; then
        cd relay && docker-compose down
    fi
    
    # Kill chat processes
    [ -n "$SWIFT_PID" ] && kill $SWIFT_PID 2>/dev/null || true
    [ -n "$JS_PID" ] && kill $JS_PID 2>/dev/null || true
    
    exit $1
}

trap 'cleanup 1' INT TERM

# Step 1: Start the relay
echo -e "\n${GREEN}Starting Nostr relay...${NC}"
cd relay
docker-compose up -d
cd ..

# Wait for relay to be ready
echo "Waiting for relay to start..."
sleep 5

# Step 2: Build Swift chat client
echo -e "\n${GREEN}Building Swift chat client...${NC}"
cd chat-swift
swift build
cd ..

# Step 3: Install JS dependencies
echo -e "\n${GREEN}Installing JavaScript dependencies...${NC}"
cd chat-js
npm install
cd ..

# Step 4: Run automated test
echo -e "\n${GREEN}Running automated interop test...${NC}"

# Set test environment
export RELAY_URL="ws://localhost:7777"
export ROOM_ID="interop-test-room"
export AUTOMATED_TEST="true"

# Start Swift client
echo "Starting Swift client..."
export PEER_NAME="swift-peer"
cd chat-swift
.build/debug/trystero-chat > ../swift-output.log 2>&1 &
SWIFT_PID=$!
cd ..

# Give Swift client time to connect
sleep 2

# Start JS client
echo "Starting JavaScript client..."
export PEER_NAME="js-peer"
cd chat-js
node chat.js > ../js-output.log 2>&1 &
JS_PID=$!
cd ..

# Wait for test to complete
echo "Running test for 15 seconds..."
sleep 15

# Check if processes are still running
if ! kill -0 $SWIFT_PID 2>/dev/null; then
    echo -e "${RED}Swift client crashed!${NC}"
    cat swift-output.log
    cleanup 1
fi

if ! kill -0 $JS_PID 2>/dev/null; then
    echo -e "${RED}JavaScript client crashed!${NC}"
    cat js-output.log
    cleanup 1
fi

# Analyze logs
echo -e "\n${GREEN}Analyzing test results...${NC}"

# Check for successful connections
if grep -q "Peer joined" swift-output.log && grep -q "Peer joined" js-output.log; then
    echo -e "${GREEN}✓ Peers connected successfully${NC}"
else
    echo -e "${RED}✗ Peers failed to connect${NC}"
    echo "Swift output:"
    cat swift-output.log
    echo -e "\nJavaScript output:"
    cat js-output.log
    cleanup 1
fi

# Check for message exchange
if grep -q "Message from" swift-output.log && grep -q "Message from" js-output.log; then
    echo -e "${GREEN}✓ Messages exchanged successfully${NC}"
else
    echo -e "${RED}✗ Message exchange failed${NC}"
    cleanup 1
fi

# Check for ping/pong
if grep -q "pong" swift-output.log || grep -q "pong" js-output.log; then
    echo -e "${GREEN}✓ Ping/pong test passed${NC}"
else
    echo -e "${RED}✗ Ping/pong test failed${NC}"
    cleanup 1
fi

echo -e "\n${GREEN}=== All tests passed! ===${NC}"

# Clean up
cleanup 0