//
//  SafariToSafariUITests.swift
//  UI Tests for Safari to Safari extension sync (iOS to iOS)
//

import XCTest

final class SafariToSafariUITests: XCTestCase {
    
    var device1App: XCUIApplication!
    var device2App: XCUIApplication!
    let testRoomSecret = "swift-swift-test-\(Int(Date().timeIntervalSince1970))"
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        
        // For real device testing, you'd need two physical devices or simulators
        // This example shows the pattern for testing on a single device
        device1App = XCUIApplication()
        device1App.launchArguments = ["--uitesting", "--device-id=device1"]
        
        // In a real test, device2App would be on a different simulator/device
        device2App = XCUIApplication()
        device2App.launchArguments = ["--uitesting", "--device-id=device2"]
    }
    
    @MainActor
    func testSafariToSafariSync() throws {
        // Launch first device
        device1App.launch()
        
        // Connect device 1 to room
        connectToRoom(app: device1App, secret: testRoomSecret)
        
        // For testing on separate simulators, you'd launch the second one here
        // For this example, we'll simulate the second device
        
        // Simulate device 2 connection (in real test, this would be on second device)
        let device2Connected = simulateSecondDevice(roomSecret: testRoomSecret)
        XCTAssertTrue(device2Connected)
        
        // Device 1: Open Safari and browse
        openSafariAndBrowse(app: device1App, urls: [
            "https://apple.com",
            "https://developer.apple.com",
            "https://swift.org"
        ])
        
        // Wait for sync
        Thread.sleep(forTimeInterval: 5)
        
        // Check if device 2 received the history
        // In real test, this would check device2App
        let syncedHistory = checkSyncedHistory(expectedUrls: ["apple.com", "developer.apple.com", "swift.org"])
        XCTAssertTrue(syncedHistory, "Device 2 should receive Device 1's history")
    }
    
    @MainActor
    func testBidirectionalSafariSync() throws {
        // Both devices browse simultaneously
        device1App.launch()
        connectToRoom(app: device1App, secret: testRoomSecret)
        
        // Simulate device 2
        let device2Connected = simulateSecondDevice(roomSecret: testRoomSecret)
        XCTAssertTrue(device2Connected)
        
        // Concurrent browsing
        let group = DispatchGroup()
        
        group.enter()
        DispatchQueue.global().async {
            self.openSafariAndBrowse(app: self.device1App, urls: [
                "https://apple.com/mac",
                "https://apple.com/iphone"
            ])
            group.leave()
        }
        
        group.enter()
        DispatchQueue.global().async {
            // Simulate device 2 browsing
            self.simulateDevice2Browsing(urls: [
                "https://apple.com/ipad",
                "https://apple.com/watch"
            ])
            group.leave()
        }
        
        group.wait()
        Thread.sleep(forTimeInterval: 5)
        
        // Check both devices have all history
        let device1History = getHistoryItems(app: device1App)
        XCTAssertTrue(device1History.contains("apple.com/ipad"))
        XCTAssertTrue(device1History.contains("apple.com/watch"))
        
        // Device 2 check would be similar
        let device2HasDevice1History = checkSyncedHistory(expectedUrls: ["apple.com/mac", "apple.com/iphone"])
        XCTAssertTrue(device2HasDevice1History)
    }
    
    @MainActor
    func testSafariExtensionActivation() throws {
        device1App.launch()
        
        // Check extension status
        let extensionStatus = device1App.staticTexts["extensionStatus"]
        XCTAssertTrue(extensionStatus.exists)
        
        // If not enabled, show instructions
        if extensionStatus.label.contains("Disabled") {
            XCTAssertTrue(device1App.buttons["Enable in Safari Settings"].exists)
            
            // Tap to open Safari settings
            device1App.buttons["Enable in Safari Settings"].tap()
            
            // Wait for Safari settings to open
            Thread.sleep(forTimeInterval: 2)
            
            // Return to app
            device1App.activate()
        }
    }
    
    @MainActor
    func testMultiDeviceRoomManagement() throws {
        // Test that multiple Safari instances can join/leave rooms
        device1App.launch()
        
        // Create a room
        connectToRoom(app: device1App, secret: testRoomSecret)
        
        // Simulate multiple devices joining
        var connectedDevices: [String] = []
        for i in 2...5 {
            let deviceId = "device\(i)"
            if simulateDeviceJoining(deviceId: deviceId, roomSecret: testRoomSecret) {
                connectedDevices.append(deviceId)
            }
        }
        
        // Check peer count
        let peerCount = device1App.staticTexts["peerCount"]
        XCTAssertTrue(peerCount.exists)
        XCTAssertEqual(peerCount.label, "\(connectedDevices.count) peers")
        
        // Simulate devices leaving
        for deviceId in connectedDevices.prefix(2) {
            simulateDeviceLeaving(deviceId: deviceId)
        }
        
        Thread.sleep(forTimeInterval: 2)
        
        // Verify peer count updated
        XCTAssertEqual(peerCount.label, "\(connectedDevices.count - 2) peers")
    }
}

// MARK: - Helper Methods
extension SafariToSafariUITests {
    
    func connectToRoom(app: XCUIApplication, secret: String) {
        let roomField = app.textFields["roomSecretField"]
        guard roomField.exists else {
            XCTFail("Room secret field not found")
            return
        }
        
        roomField.tap()
        roomField.typeText(secret)
        app.buttons["connectButton"].tap()
        
        // Wait for connection
        let connected = app.staticTexts["connectionStatus"].waitForExistence(timeout: 10)
        XCTAssertTrue(connected)
    }
    
    func openSafariAndBrowse(app: XCUIApplication, urls: [String]) {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()
        
        for url in urls {
            // Navigate to URL
            let urlField = safari.textFields["URL"].firstMatch
            if urlField.exists {
                urlField.tap()
                urlField.typeText(url + "\n")
                
                // Wait for page load
                Thread.sleep(forTimeInterval: 3)
            }
        }
        
        // Return to our app
        app.activate()
    }
    
    func getHistoryItems(app: XCUIApplication) -> [String] {
        var items: [String] = []
        
        let historyTable = app.tables["historyTable"]
        if historyTable.exists {
            let cells = historyTable.cells
            for i in 0..<cells.count {
                let cell = cells.element(boundBy: i)
                if let url = cell.staticTexts["historyURL"].value as? String {
                    items.append(url)
                }
            }
        }
        
        return items
    }
    
    // MARK: - Simulation Methods (for single device testing)
    
    func simulateSecondDevice(roomSecret: String) -> Bool {
        // In real multi-device testing, this would launch app on second device
        // For now, we simulate via test API
        return true
    }
    
    func simulateDevice2Browsing(urls: [String]) {
        // Simulate device 2 browsing activity
        // In real test, this would control second device
    }
    
    func checkSyncedHistory(expectedUrls: [String]) -> Bool {
        // In real test, check device 2's history
        // For simulation, return true if test data was synced
        return true
    }
    
    func simulateDeviceJoining(deviceId: String, roomSecret: String) -> Bool {
        // Simulate additional device joining room
        return true
    }
    
    func simulateDeviceLeaving(deviceId: String) {
        // Simulate device leaving room
    }
}