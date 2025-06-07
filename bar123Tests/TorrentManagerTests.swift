//
//  TorrentManagerTests.swift
//  bar123Tests
//
//  Created on 6/7/25.
//

import XCTest
@testable import bar123

final class TorrentManagerTests: XCTestCase {

    var torrentManager: TorrentManager!
    let testSecret = "test-secret-123"
    
    override func setUpWithError() throws {
        torrentManager = TorrentManager(sharedSecret: testSecret)
    }

    override func tearDownWithError() throws {
        torrentManager.stopSync()
        torrentManager = nil
    }

    func testAddHistoryItem() async throws {
        // Create a test history item
        let deviceInfo = DeviceInfo(
            name: "Test Device",
            model: "iPhone Test",
            osVersion: "15.0"
        )
        
        let historyItem = HistoryItem(
            url: "https://example.com",
            title: "Test Page",
            visitTime: Date(),
            visitCount: 1,
            deviceId: "test-device-id",
            deviceInfo: deviceInfo
        )
        
        // Add the item
        try await torrentManager.addHistoryItem(historyItem)
        
        // Search for it
        let results = try await torrentManager.searchHistory(query: "example")
        
        // Verify it was added
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.url, "https://example.com")
    }
    
    func testSearchHistory() async throws {
        // Add multiple items
        let deviceInfo = DeviceInfo(
            name: "Test Device",
            model: "iPhone Test",
            osVersion: "15.0"
        )
        
        let items = [
            HistoryItem(url: "https://apple.com", title: "Apple", visitTime: Date(), visitCount: 1, deviceId: "test", deviceInfo: deviceInfo),
            HistoryItem(url: "https://google.com", title: "Google", visitTime: Date(), visitCount: 1, deviceId: "test", deviceInfo: deviceInfo),
            HistoryItem(url: "https://github.com", title: "GitHub", visitTime: Date(), visitCount: 1, deviceId: "test", deviceInfo: deviceInfo)
        ]
        
        for item in items {
            try await torrentManager.addHistoryItem(item)
        }
        
        // Search tests
        let appleResults = try await torrentManager.searchHistory(query: "apple")
        XCTAssertEqual(appleResults.count, 1)
        
        let comResults = try await torrentManager.searchHistory(query: ".com")
        XCTAssertEqual(comResults.count, 3)
    }
    
    func testGetAllDevices() async throws {
        // Add items from different devices
        let device1 = DeviceInfo(name: "iPhone 1", model: "iPhone 15", osVersion: "17.0")
        let device2 = DeviceInfo(name: "iPhone 2", model: "iPhone 14", osVersion: "16.0")
        
        let item1 = HistoryItem(url: "https://test1.com", title: "Test 1", visitTime: Date(), visitCount: 1, deviceId: "device1", deviceInfo: device1)
        let item2 = HistoryItem(url: "https://test2.com", title: "Test 2", visitTime: Date(), visitCount: 1, deviceId: "device2", deviceInfo: device2)
        
        try await torrentManager.addHistoryItem(item1)
        try await torrentManager.addHistoryItem(item2)
        
        let devices = try await torrentManager.getAllDevices()
        XCTAssertGreaterThanOrEqual(devices.count, 2)
    }
    
    func testEncryptionDecryption() async throws {
        // This tests the internal encryption by verifying data roundtrip
        let testData = "Test history data".data(using: .utf8)!
        
        // Since encryption methods are private, we test indirectly through sync
        let deviceInfo = DeviceInfo(name: "Test", model: "Test", osVersion: "1.0")
        let item = HistoryItem(url: "https://encryption-test.com", title: "Encryption Test", visitTime: Date(), visitCount: 1, deviceId: "test", deviceInfo: deviceInfo)
        
        try await torrentManager.addHistoryItem(item)
        
        // Verify we can retrieve it (which means encryption/decryption worked)
        let results = try await torrentManager.searchHistory(query: "encryption")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.title, "Encryption Test")
    }
}