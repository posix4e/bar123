//
//  CloudflareDNSIntegrationTests.swift
//  bar123Tests
//
//  Integration tests for Cloudflare DNS Discovery
//

import XCTest
@testable import bar123
// @testable import bar123_Extension  // Disabled due to linking issues

class CloudflareDNSIntegrationTests: XCTestCase {
    /*
    
    // Credentials from .env
    private let domain = "newman.family"
    private let zoneId = "10fa67ca924a83ca40d1c8081d21fdfe"
    private let apiToken = "deiE4Baspy24KyjrYncyDk0d4Nm9QsOFkAl854pI"
    private let roomId = "goatmanisthebest"
    
    private var discovery: CloudflareDNSDiscovery!
    
    override func setUp() async throws {
        try await super.setUp()
        
        // Create device info
        let deviceInfo = PeerInfo(
            id: "test-device-\(UUID().uuidString.prefix(8))",
            name: "Test Device",
            type: "test",
            timestamp: Date()
        )
        
        // Initialize Cloudflare DNS Discovery
        discovery = CloudflareDNSDiscovery(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId,
            deviceInfo: deviceInfo
        )
    }
    
    override func tearDown() async throws {
        // Clean up
        await discovery?.stop()
        discovery = nil
        try await super.tearDown()
    }
    
    func testAPIAccess() async throws {
        // This test verifies we can access the Cloudflare API
        let expectation = XCTestExpectation(description: "API access verified")
        
        do {
            // Start discovery (which includes API verification)
            try await discovery.start()
            expectation.fulfill()
        } catch {
            XCTFail("API access failed: \(error)")
        }
        
        await fulfillment(of: [expectation], timeout: 10)
    }
    
    func testCreateAndDiscoverPeer() async throws {
        // Create two discovery instances to test peer discovery
        let deviceInfo1 = PeerInfo(
            id: "test-device-1",
            name: "Test Device 1",
            type: "test",
            timestamp: Date()
        )
        
        let deviceInfo2 = PeerInfo(
            id: "test-device-2",
            name: "Test Device 2",
            type: "test",
            timestamp: Date()
        )
        
        let testRoomId = "test-room-\(UUID().uuidString.prefix(8))" // Unique room for this test
        
        let discovery1 = CloudflareDNSDiscovery(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: testRoomId,
            deviceInfo: deviceInfo1
        )
        
        let discovery2 = CloudflareDNSDiscovery(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: testRoomId, // Same room
            deviceInfo: deviceInfo2
        )
        
        // Set up discovery delegates
        let peerDiscoveredExpectation = XCTestExpectation(description: "Peer discovered")
        
        class TestDelegate: PeerDiscoveryDelegate {
            let expectation: XCTestExpectation
            
            init(expectation: XCTestExpectation) {
                self.expectation = expectation
            }
            
            func peerDiscovery(_ discovery: PeerDiscovery, didDiscoverPeer peerId: String, info: PeerInfo) {
                print("✅ Discovered peer: \(info.name) (\(peerId))")
                expectation.fulfill()
            }
            
            func peerDiscovery(_ discovery: PeerDiscovery, didLosePeer peerId: String) {
                print("Lost peer: \(peerId)")
            }
            
            func peerDiscovery(_ discovery: PeerDiscovery, didReceiveSignalingMessage message: SignalingMessage, from peerId: String) {
                print("Received signaling message from \(peerId)")
            }
            
            func peerDiscovery(_ discovery: PeerDiscovery, didEncounterError error: Error) {
                print("❌ Discovery error: \(error)")
            }
        }
        
        let delegate2 = TestDelegate(expectation: peerDiscoveredExpectation)
        discovery2.delegate = delegate2
        
        // Start both discoveries
        try await discovery1.start()
        
        // Wait a bit for DNS record to be created
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        try await discovery2.start()
        
        // Wait for peer discovery
        await fulfillment(of: [peerDiscoveredExpectation], timeout: 15)
        
        // Clean up
        await discovery1.stop()
        await discovery2.stop()
    }
    
    func testDNSRecordCreationAndCleanup() async throws {
        // Test that DNS records are created and cleaned up properly
        let testRoomId = "cleanup-test-\(UUID().uuidString.prefix(8))"
        
        let deviceInfo = PeerInfo(
            id: "cleanup-test-device",
            name: "Cleanup Test Device",
            type: "test",
            timestamp: Date()
        )
        
        let testDiscovery = CloudflareDNSDiscovery(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: testRoomId,
            deviceInfo: deviceInfo
        )
        
        // Start discovery
        try await testDiscovery.start()
        
        // Wait for record creation
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        // Check if record exists
        let recordName = "_p2psync-\(testRoomId)-peer-\(deviceInfo.id).\(domain)"
        let recordExists = try await checkDNSRecordExists(name: recordName)
        XCTAssertTrue(recordExists, "DNS record should be created")
        
        // Stop discovery
        await testDiscovery.stop()
        
        // Wait for cleanup
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        // Check if record is cleaned up
        let recordExistsAfterStop = try await checkDNSRecordExists(name: recordName)
        XCTAssertFalse(recordExistsAfterStop, "DNS record should be cleaned up after stop")
    }
    
    // MARK: - Helper Methods
    
    private func checkDNSRecordExists(name: String) async throws -> Bool {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT&name=\(name)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        struct CloudflareResponse: Decodable {
            let result: [DNSRecord]?
        }
        
        struct DNSRecord: Decodable {
            let id: String
            let name: String
        }
        
        let response = try JSONDecoder().decode(CloudflareResponse.self, from: data)
        return !(response.result?.isEmpty ?? true)
    }
    */
}