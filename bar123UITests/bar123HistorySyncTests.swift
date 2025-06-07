//
//  bar123HistorySyncTests.swift
//  bar123UITests
//
//  Created by Alex Newman on 5/22/25.
//

import XCTest

final class bar123HistorySyncTests: XCTestCase {
    
    var app1: XCUIApplication!
    var app2: XCUIApplication!
    let sharedSecret = "test-secret-12345"

    override func setUpWithError() throws {
        continueAfterFailure = false
        
        // Set up two app instances with different bundle IDs for simulation
        app1 = XCUIApplication()
        app1.launchArguments = ["--testing", "--device-id", "device1"]
        
        app2 = XCUIApplication()
        app2.launchArguments = ["--testing", "--device-id", "device2"]
    }

    override func tearDownWithError() throws {
        app1?.terminate()
        app2?.terminate()
    }

    @MainActor
    func testTwoNodeHistorySync() throws {
        // Launch first device
        app1.launch()
        
        // Navigate to extension settings in first device
        navigateToExtensionSettings(app: app1)
        
        // Set shared secret on first device
        setSharedSecret(app: app1, secret: sharedSecret)
        
        // Verify sync is active on first device
        XCTAssertTrue(app1.staticTexts["Syncing"].waitForExistence(timeout: 5))
        
        // Browse some test pages on first device
        browseTestPages(app: app1, deviceName: "Device 1")
        
        // Launch second device
        app2.launch()
        
        // Navigate to extension settings in second device
        navigateToExtensionSettings(app: app2)
        
        // Set same shared secret on second device
        setSharedSecret(app: app2, secret: sharedSecret)
        
        // Verify sync is active on second device
        XCTAssertTrue(app2.staticTexts["Syncing"].waitForExistence(timeout: 5))
        
        // Browse different pages on second device
        browseTestPages(app: app2, deviceName: "Device 2", startIndex: 3)
        
        // Wait for sync to propagate
        Thread.sleep(forTimeInterval: 5)
        
        // Test search functionality on both devices
        testCrossDeviceSearch(app: app1, searchTerm: "test", expectedDevices: ["Device 1", "Device 2"])
        testCrossDeviceSearch(app: app2, searchTerm: "page", expectedDevices: ["Device 1", "Device 2"])
        
        // Verify device list shows both devices
        verifyDeviceList(app: app1, expectedDevices: ["Device 1", "Device 2"])
        verifyDeviceList(app: app2, expectedDevices: ["Device 1", "Device 2"])
    }
    
    @MainActor
    func testHistorySyncWithDisconnection() throws {
        // Launch and set up first device
        app1.launch()
        navigateToExtensionSettings(app: app1)
        setSharedSecret(app: app1, secret: sharedSecret)
        
        // Browse pages on first device
        browseTestPages(app: app1, deviceName: "Device 1")
        
        // Launch and set up second device
        app2.launch()
        navigateToExtensionSettings(app: app2)
        setSharedSecret(app: app2, secret: sharedSecret)
        
        // Verify initial sync
        Thread.sleep(forTimeInterval: 3)
        testCrossDeviceSearch(app: app2, searchTerm: "test", expectedDevices: ["Device 1"])
        
        // Simulate first device going offline
        app1.terminate()
        
        // Browse more pages on second device while first is offline
        browseTestPages(app: app2, deviceName: "Device 2", startIndex: 5)
        
        // Restart first device
        app1.launch()
        navigateToExtensionSettings(app: app1)
        
        // Wait for resync
        Thread.sleep(forTimeInterval: 5)
        
        // Verify first device now has history from second device
        testCrossDeviceSearch(app: app1, searchTerm: "page5", expectedDevices: ["Device 2"])
    }
    
    // MARK: - Helper Methods
    
    private func navigateToExtensionSettings(app: XCUIApplication) {
        // This would navigate to Safari extension settings
        // For testing purposes, we'll simulate opening the extension popup
        let safariButton = app.buttons["Open Safari Settings"]
        if safariButton.exists {
            safariButton.tap()
        }
    }
    
    private func setSharedSecret(app: XCUIApplication, secret: String) {
        let secretField = app.secureTextFields["sharedSecret"]
        XCTAssertTrue(secretField.waitForExistence(timeout: 5))
        
        secretField.tap()
        secretField.typeText(secret)
        
        let setButton = app.buttons["Set"]
        setButton.tap()
        
        // Verify success message
        XCTAssertTrue(app.staticTexts["Secret set successfully!"].waitForExistence(timeout: 3))
    }
    
    private func browseTestPages(app: XCUIApplication, deviceName: String, startIndex: Int = 0) {
        // Simulate browsing history by creating test entries
        let testPages = [
            ("https://example.com/test\(startIndex)", "Test Page \(startIndex)"),
            ("https://example.com/page\(startIndex + 1)", "Sample Page \(startIndex + 1)"),
            ("https://test.com/article\(startIndex + 2)", "Article \(startIndex + 2)")
        ]
        
        for (url, title) in testPages {
            // In a real test, this would navigate Safari to these URLs
            // For testing, we'll simulate by directly adding to history
            simulateBrowsing(app: app, url: url, title: title)
            Thread.sleep(forTimeInterval: 0.5)
        }
    }
    
    private func simulateBrowsing(app: XCUIApplication, url: String, title: String) {
        // This would simulate actual browsing
        // In practice, you'd use Safari automation or mock the history addition
    }
    
    private func testCrossDeviceSearch(app: XCUIApplication, searchTerm: String, expectedDevices: [String]) {
        let searchField = app.textFields["searchInput"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        
        searchField.tap()
        searchField.typeText(searchTerm)
        
        let searchButton = app.buttons["Search"]
        searchButton.tap()
        
        // Wait for results
        Thread.sleep(forTimeInterval: 2)
        
        // Verify results contain entries from expected devices
        for device in expectedDevices {
            XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", device)).element.exists)
        }
    }
    
    private func verifyDeviceList(app: XCUIApplication, expectedDevices: [String]) {
        let refreshButton = app.buttons["Refresh"]
        XCTAssertTrue(refreshButton.waitForExistence(timeout: 5))
        refreshButton.tap()
        
        // Wait for device list to load
        Thread.sleep(forTimeInterval: 2)
        
        // Verify each expected device appears in the list
        for device in expectedDevices {
            XCTAssertTrue(app.staticTexts[device].exists)
        }
    }
}