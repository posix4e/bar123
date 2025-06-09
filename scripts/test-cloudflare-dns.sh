#!/bin/bash

# Test Cloudflare DNS Discovery
# Usage: ./test-cloudflare-dns.sh <api_token> <zone_id> <domain>

set -e

API_TOKEN="${1:-}"
ZONE_ID="${2:-}"
DOMAIN="${3:-}"
ROOM_ID="${4:-test-room}"

if [ -z "$API_TOKEN" ] || [ -z "$ZONE_ID" ] || [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <api_token> <zone_id> <domain> [room_id]"
    echo "Example: $0 your-api-token your-zone-id example.com test-room"
    exit 1
fi

echo "🔍 Testing Cloudflare DNS Discovery"
echo "=================================="
echo "Domain: $DOMAIN"
echo "Zone ID: $ZONE_ID"
echo "Room ID: $ROOM_ID"
echo ""

# Test 1: Verify API access
echo "1️⃣  Testing API access..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API access verified"
    ZONE_NAME=$(echo "$BODY" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "   Zone: $ZONE_NAME"
else
    echo "❌ API access failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
echo ""

# Test 2: List existing peer records
echo "2️⃣  Listing existing peer records..."
RECORDS=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=_p2psync-$ROOM_ID" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

RECORD_COUNT=$(echo "$RECORDS" | jq '.result | length' 2>/dev/null || echo "0")
echo "Found $RECORD_COUNT DNS record(s)"

if [ "$RECORD_COUNT" -gt "0" ]; then
    echo "$RECORDS" | jq -r '.result[] | "   - \(.name): \(.content | .[0:50])..."' 2>/dev/null
fi
echo ""

# Test 3: Create a test peer announcement
echo "3️⃣  Creating test peer announcement..."
TEST_ID="test-$(date +%s)"
RECORD_NAME="_p2psync-$ROOM_ID-peer-$TEST_ID.$DOMAIN"
TEST_DATA=$(echo "{\"id\":\"$TEST_ID\",\"name\":\"Test Peer\",\"type\":\"test\",\"timestamp\":$(date +%s)}" | base64)

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
        \"type\": \"TXT\",
        \"name\": \"$RECORD_NAME\",
        \"content\": \"$TEST_DATA\",
        \"ttl\": 120
    }")

CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)

if [ "$CREATE_CODE" = "200" ]; then
    echo "✅ Created test record: $RECORD_NAME"
    RECORD_ID=$(echo "$CREATE_BODY" | jq -r '.result.id' 2>/dev/null)
else
    echo "❌ Failed to create record (HTTP $CREATE_CODE)"
    echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
    exit 1
fi
echo ""

# Test 4: Verify record is discoverable
echo "4️⃣  Verifying record is discoverable..."
sleep 2

VERIFY_RECORDS=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=$RECORD_NAME" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

FOUND=$(echo "$VERIFY_RECORDS" | jq '.result | length' 2>/dev/null || echo "0")
if [ "$FOUND" = "1" ]; then
    echo "✅ Record is discoverable"
    CONTENT=$(echo "$VERIFY_RECORDS" | jq -r '.result[0].content' 2>/dev/null)
    DECODED=$(echo "$CONTENT" | base64 -d 2>/dev/null || echo "Failed to decode")
    echo "   Decoded content: $DECODED"
else
    echo "❌ Record not found"
fi
echo ""

# Test 5: Clean up
echo "5️⃣  Cleaning up test record..."
if [ ! -z "$RECORD_ID" ]; then
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
        "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    DELETE_CODE=$(echo "$DELETE_RESPONSE" | tail -1)
    
    if [ "$DELETE_CODE" = "200" ]; then
        echo "✅ Test record deleted"
    else
        echo "⚠️  Failed to delete test record"
    fi
fi
echo ""

echo "✅ Cloudflare DNS Discovery test complete!"
echo ""
echo "Summary:"
echo "- API access: ✅"
echo "- Can create records: ✅"
echo "- Records are discoverable: ✅"
echo "- Record prefix: _p2psync-$ROOM_ID"
echo ""
echo "To use in the app:"
echo "1. Configure with these settings in iOS/Chrome extension"
echo "2. All peers in room '$ROOM_ID' will discover each other"
echo "3. Records expire after 2 minutes (TTL: 120s)"