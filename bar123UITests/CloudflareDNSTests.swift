//
//  CloudflareDNSTests.swift
//  bar123UITests
//
//  UI Tests for Cloudflare DNS Discovery functionality
//

import XCTest

class CloudflareDNSTests: XCTestCase {
    
    // Credentials from .env file
    private let domain = "newman.family"
    private let zoneId = "10fa67ca924a83ca40d1c8081d21fdfe"
    private let apiToken = "deiE4Baspy24KyjrYncyDk0d4Nm9QsOFkAl854pI"
    private let roomId = "goatmanisthebest"
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        
        let app = XCUIApplication()
        app.launchArguments = ["UI_TESTING"]
        app.launch()
    }
    
    func testCloudflareConfiguration() throws {
        let app = XCUIApplication()
        
        // Navigate to Settings tab
        app.tabBars.buttons["Settings"].tap()
        
        // Wait for settings to load
        let settingsTable = app.tables.firstMatch
        XCTAssertTrue(settingsTable.waitForExistence(timeout: 5))
        
        // Find and tap on Discovery Method
        let discoveryMethodCell = settingsTable.cells.containing(.staticText, identifier: "Discovery Method").firstMatch
        XCTAssertTrue(discoveryMethodCell.waitForExistence(timeout: 5))
        discoveryMethodCell.tap()
        
        // Select Cloudflare DNS
        let cloudflareDNSOption = app.tables.cells.containing(.staticText, identifier: "Cloudflare DNS").firstMatch
        XCTAssertTrue(cloudflareDNSOption.waitForExistence(timeout: 5))
        cloudflareDNSOption.tap()
        
        // Tap on Cloudflare DNS configuration
        app.navigationBars.buttons["Settings"].tap()
        
        let cloudflareConfigCell = settingsTable.cells.containing(.staticText, identifier: "Cloudflare DNS").firstMatch
        XCTAssertTrue(cloudflareConfigCell.waitForExistence(timeout: 5))
        cloudflareConfigCell.tap()
        
        // Fill in configuration
        fillCloudflareConfiguration(app: app)
        
        // Save configuration
        app.navigationBars.buttons["Save"].tap()
        
        // Wait for save to complete
        Thread.sleep(forTimeInterval: 2)
        
        // Verify we're back at settings
        XCTAssertTrue(settingsTable.waitForExistence(timeout: 5))
    }
    
    func testCloudflareDebugView() throws {
        let app = XCUIApplication()
        
        // First configure Cloudflare
        configureCloudflare(app: app)
        
        // Navigate to debug view
        app.tabBars.buttons["Settings"].tap()
        
        let settingsTable = app.tables.firstMatch
        let cloudflareConfigCell = settingsTable.cells.containing(.staticText, identifier: "Cloudflare DNS").firstMatch
        cloudflareConfigCell.tap()
        
        // Find and tap Debug DNS Discovery
        let debugCell = app.tables.cells.containing(.staticText, identifier: "Debug DNS Discovery").firstMatch
        XCTAssertTrue(debugCell.waitForExistence(timeout: 5))
        debugCell.tap()
        
        // Tap Test Cloudflare DNS button
        let testButton = app.buttons["Test Cloudflare DNS"]
        XCTAssertTrue(testButton.waitForExistence(timeout: 5))
        testButton.tap()
        
        // Wait for test to complete
        Thread.sleep(forTimeInterval: 5)
        
        // Check for success indicators in the text view
        let textView = app.textViews.firstMatch
        XCTAssertTrue(textView.waitForExistence(timeout: 10))
        
        // Verify API access
        let apiSuccessText = textView.staticTexts["✅ API access verified"].exists ||
                            (textView.value as? String ?? "").contains("API access verified")
        XCTAssertTrue(apiSuccessText, "API access should be verified")
    }
    
    func testCloudflareDiscovery() throws {
        let app = XCUIApplication()
        
        // Configure Cloudflare
        configureCloudflare(app: app)
        
        // Navigate to Status tab to see connection status
        app.tabBars.buttons["Status"].tap()
        
        // Wait for status view
        let statusView = app.otherElements["StatusView"]
        XCTAssertTrue(statusView.waitForExistence(timeout: 5))
        
        // Check discovery status
        Thread.sleep(forTimeInterval: 10) // Give time for discovery to start
        
        // Look for connected status or discovery activity
        let discoveryCard = app.otherElements.containing(.staticText, identifier: "Discovery Status").firstMatch
        XCTAssertTrue(discoveryCard.exists, "Discovery status card should exist")
    }
    
    // MARK: - Helper Methods
    
    private func configureCloudflare(app: XCUIApplication) {
        // Navigate to Settings
        app.tabBars.buttons["Settings"].tap()
        
        let settingsTable = app.tables.firstMatch
        
        // Set Discovery Method to Cloudflare DNS
        let discoveryMethodCell = settingsTable.cells.containing(.staticText, identifier: "Discovery Method").firstMatch
        discoveryMethodCell.tap()
        
        let cloudflareDNSOption = app.tables.cells.containing(.staticText, identifier: "Cloudflare DNS").firstMatch
        cloudflareDNSOption.tap()
        
        app.navigationBars.buttons["Settings"].tap()
        
        // Open Cloudflare configuration
        let cloudflareConfigCell = settingsTable.cells.containing(.staticText, identifier: "Cloudflare DNS").firstMatch
        cloudflareConfigCell.tap()
        
        // Fill configuration
        fillCloudflareConfiguration(app: app)
        
        // Save
        app.navigationBars.buttons["Save"].tap()
        
        Thread.sleep(forTimeInterval: 2)
    }
    
    private func fillCloudflareConfiguration(app: XCUIApplication) {
        // Clear and fill Domain field
        let domainField = app.textFields.element(boundBy: 0)
        domainField.tap()
        domainField.clearAndTypeText(domain)
        
        // Clear and fill Zone ID field
        let zoneIdField = app.textFields.element(boundBy: 1)
        zoneIdField.tap()
        zoneIdField.clearAndTypeText(zoneId)
        
        // Clear and fill API Token field
        let apiTokenField = app.secureTextFields.element(boundBy: 0)
        apiTokenField.tap()
        apiTokenField.clearAndTypeText(apiToken)
        
        // Clear and fill Room ID field
        let roomIdField = app.textFields.element(boundBy: 2)
        roomIdField.tap()
        roomIdField.clearAndTypeText(roomId)
        
        // Dismiss keyboard
        app.toolbars["Toolbar"].buttons["Done"].tap()
    }
}

// MARK: - XCUIElement Extension

extension XCUIElement {
    func clearAndTypeText(_ text: String) {
        guard let currentValue = self.value as? String else {
            self.typeText(text)
            return
        }
        
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count)
        self.typeText(deleteString)
        self.typeText(text)
    }
}