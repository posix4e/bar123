/**
 * HistorySyncUITests.swift
 * UI Tests for P2P History Sync
 */

import XCTest

class HistorySyncUITests: XCTestCase {
    
    var app1: XCUIApplication!
    var app2: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        
        // Note: Testing P2P between two app instances requires special setup
        // This is a simplified version that tests the UI flow
        app1 = XCUIApplication()
        app1.launch()
    }
    
    override func tearDownWithError() throws {
        app1?.terminate()
        app2?.terminate()
    }
    
    // MARK: - WebSocket Discovery Tests
    
    func testWebSocketDiscoveryConnection() throws {
        // Navigate to settings
        app1.tabBars.buttons["Settings"].tap()
        
        // Select WebSocket discovery
        let discoveryPicker = app1.pickers["discoveryMethodPicker"]
        if discoveryPicker.exists {
            discoveryPicker.tap()
            app1.pickerWheels.element.adjust(toPickerWheelValue: "WebSocket Server")
        }
        
        // Configure connection
        let serverUrlField = app1.textFields["serverUrlField"]
        serverUrlField.tap()
        serverUrlField.clearAndTypeText("ws://localhost:8080")
        
        let roomIdField = app1.textFields["roomIdField"]
        roomIdField.tap()
        roomIdField.clearAndTypeText("test-room-ui")
        
        let secretField = app1.secureTextFields["sharedSecretField"]
        secretField.tap()
        secretField.clearAndTypeText("test-secret-12345")
        
        // Connect
        app1.buttons["connectButton"].tap()
        
        // Verify connection status
        let connectionStatus = app1.staticTexts["connectionStatusLabel"]
        XCTAssertTrue(connectionStatus.waitForExistence(timeout: 10))
        
        // In a real test, we'd verify the connection is established
        // For now, we're testing the UI flow
    }
    
    func testWebSocketDisconnection() throws {
        // Assuming already connected from previous test
        // In real tests, each test should be independent
        
        // Navigate to settings if needed
        if !app1.buttons["disconnectButton"].exists {
            app1.tabBars.buttons["Settings"].tap()
        }
        
        // Disconnect
        app1.buttons["disconnectButton"].tap()
        
        // Verify disconnection
        let connectionStatus = app1.staticTexts["connectionStatusLabel"]
        XCTAssertTrue(connectionStatus.exists)
        XCTAssertEqual(connectionStatus.label, "Disconnected")
    }
    
    // MARK: - STUN-Only Discovery Tests
    
    func testSTUNOnlyDiscoveryFlow() throws {
        // Navigate to settings
        app1.tabBars.buttons["Settings"].tap()
        
        // Select STUN-only discovery
        let discoveryPicker = app1.pickers["discoveryMethodPicker"]
        if discoveryPicker.exists {
            discoveryPicker.tap()
            app1.pickerWheels.element.adjust(toPickerWheelValue: "STUN Only (Manual)")
        }
        
        // Create connection offer
        app1.buttons["createOfferButton"].tap()
        
        // Verify offer is created
        let offerTextView = app1.textViews["connectionOfferTextView"]
        XCTAssertTrue(offerTextView.waitForExistence(timeout: 5))
        XCTAssertFalse(offerTextView.value as? String ?? "" == "")
        
        // Test share functionality
        app1.buttons["shareOfferButton"].tap()
        
        // Verify share sheet appears (on simulator this might not work)
        // Just verify the button is tappable
        XCTAssertTrue(app1.buttons["shareOfferButton"].exists)
    }
    
    // MARK: - History Sync Tests
    
    func testHistoryDisplay() throws {
        // Navigate to history tab
        app1.tabBars.buttons["History"].tap()
        
        // Verify history table exists
        let historyTable = app1.tables["historyTableView"]
        XCTAssertTrue(historyTable.exists)
        
        // Check for empty state or history items
        if historyTable.cells.count == 0 {
            let emptyLabel = app1.staticTexts["emptyHistoryLabel"]
            XCTAssertTrue(emptyLabel.exists)
            XCTAssertEqual(emptyLabel.label, "No history entries yet")
        } else {
            // Verify history cell structure
            let firstCell = historyTable.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.exists)
            
            // Check for expected elements in history cell
            XCTAssertTrue(firstCell.staticTexts["titleLabel"].exists)
            XCTAssertTrue(firstCell.staticTexts["urlLabel"].exists)
            XCTAssertTrue(firstCell.staticTexts["deviceLabel"].exists)
        }
    }
    
    func testHistorySearch() throws {
        // Navigate to history tab
        app1.tabBars.buttons["History"].tap()
        
        // Tap search bar
        let searchBar = app1.searchFields["historySearchBar"]
        XCTAssertTrue(searchBar.exists)
        searchBar.tap()
        
        // Type search query
        searchBar.typeText("github")
        
        // Verify search is performed (results would depend on actual data)
        // For now, just verify the search bar accepts input
        XCTAssertEqual(searchBar.value as? String, "github")
        
        // Test clear search
        let clearButton = searchBar.buttons["Clear text"].firstMatch
        if clearButton.exists {
            clearButton.tap()
            XCTAssertEqual(searchBar.value as? String, "Search text")
        }
    }
    
    // MARK: - Device Management Tests
    
    func testDeviceListDisplay() throws {
        // Navigate to devices tab
        app1.tabBars.buttons["Devices"].tap()
        
        // Verify devices table exists
        let devicesTable = app1.tables["devicesTableView"]
        XCTAssertTrue(devicesTable.exists)
        
        // Check for empty state or device items
        if devicesTable.cells.count == 0 {
            let emptyLabel = app1.staticTexts["emptyDevicesLabel"]
            XCTAssertTrue(emptyLabel.exists)
            XCTAssertEqual(emptyLabel.label, "No connected devices")
        } else {
            // Verify device cell structure
            let firstCell = devicesTable.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.exists)
            
            // Check for expected elements in device cell
            XCTAssertTrue(firstCell.staticTexts["deviceNameLabel"].exists)
            XCTAssertTrue(firstCell.staticTexts["deviceTypeLabel"].exists)
            XCTAssertTrue(firstCell.staticTexts["deviceStatusLabel"].exists)
        }
    }
    
    // MARK: - Performance Tests
    
    func testLaunchPerformance() throws {
        if #available(iOS 14.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
    
    func testHistoryScrollPerformance() throws {
        app1.tabBars.buttons["History"].tap()
        
        let historyTable = app1.tables["historyTableView"]
        
        measure {
            // Scroll to bottom
            historyTable.swipeUp()
            historyTable.swipeUp()
            
            // Scroll back to top
            historyTable.swipeDown()
            historyTable.swipeDown()
        }
    }
}

// MARK: - Helper Extensions
// Note: clearAndTypeText is defined in CloudflareDNSTests.swift

// MARK: - P2P Test Scenarios
// Note: True P2P testing between two app instances requires:
// 1. Multiple simulators or devices
// 2. XCTest UI Test bundles that can coordinate
// 3. A test harness that can launch multiple apps
// These tests focus on the UI flow and single-app functionality

extension HistorySyncUITests {
    
    func testCompleteWebSocketSyncFlow() throws {
        // This test simulates the complete flow for WebSocket-based sync
        // In a real P2P test, we'd need two app instances
        
        // 1. Configure and connect
        try testWebSocketDiscoveryConnection()
        
        // 2. Verify devices tab shows connection
        app1.tabBars.buttons["Devices"].tap()
        // Would verify peer device appears
        
        // 3. Check history sync
        app1.tabBars.buttons["History"].tap()
        // Would verify synced history appears
        
        // 4. Test search on synced history
        try testHistorySearch()
        
        // 5. Disconnect
        try testWebSocketDisconnection()
    }
    
    func testCompleteSTUNOnlySyncFlow() throws {
        // This test simulates the complete flow for STUN-only sync
        
        // 1. Create connection offer
        try testSTUNOnlyDiscoveryFlow()
        
        // 2. In a real test, we'd:
        // - Copy the offer
        // - Paste it in second app
        // - Copy the response
        // - Paste it back in first app
        
        // 3. Verify connection established
        // Would check connection status
        
        // 4. Test history sync
        app1.tabBars.buttons["History"].tap()
        // Would verify synced history appears
    }
}