#!/usr/bin/env node

// Debug script to test room ID generation and see if both platforms generate the same room ID

async function testRoomIdGeneration() {
    console.log('🔍 Testing room ID generation...');
    
    const sharedSecret = 'test123';
    console.log(`📝 Shared secret: "${sharedSecret}"`);
    
    // Simulate the hash function used by both extensions
    async function hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }
    
    const roomId = await hashSecret(sharedSecret);
    console.log(`🔑 Generated room ID: "${roomId}"`);
    console.log(`📏 Room ID length: ${roomId.length} characters`);
    
    // Test with different secrets
    const testSecrets = ['test123', 'hello', 'mysecret', ''];
    
    console.log('\n🧪 Testing multiple secrets:');
    for (const secret of testSecrets) {
        const id = await hashSecret(secret);
        console.log(`  "${secret}" → "${id}"`);
    }
    
    console.log('\n✅ Both Chrome and Safari should generate the same room IDs for the same secrets');
    console.log('📋 Next steps for debugging:');
    console.log('1. Check browser developer consoles for Trystero connection logs');
    console.log('2. Verify both extensions use the same room ID');
    console.log('3. Check if Trystero peers are actually joining the room');
    console.log('4. Look for network/firewall issues blocking WebRTC');
}

// Only run if this is the main module
if (require.main === module) {
    testRoomIdGeneration().catch(console.error);
}

module.exports = { testRoomIdGeneration };