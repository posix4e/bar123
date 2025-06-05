//
//  HistorySyncUITests.swift
//  bar123UITests
//
//  UI Tests for History Sync functionality
//

import XCTest

final class HistorySyncUITests: XCTestCase {
    var app: XCUIApplication!
    var safari: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        
        app = XCUIApplication()
        safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    }
    
    override func tearDownWithError() throws {
        app = nil
        safari = nil
    }
    
    @MainActor
    func testExtensionCanBeEnabled() throws {
        // Launch the app
        app.launch()
        
        // Check if the main screen shows Safari extension instructions
        XCTAssertTrue(app.staticTexts["Enable in Safari Settings"].exists)
        
        // Tap the button to open Safari settings
        app.buttons["Open Safari Settings"].tap()
        
        // Note: We can't directly control Safari settings, but we can verify our app responds correctly
        sleep(2) // Give time for Safari to open
        
        // Return to app
        app.activate()
        
        // The app should still be functional
        XCTAssertTrue(app.staticTexts["Enable in Safari Settings"].exists)
    }
    
    @MainActor
    func testRoomConnectionUI() throws {
        // Launch the app
        app.launch()
        
        // Look for the room secret field (if shown in the app)
        let roomSecretField = app.textFields["roomSecretField"]
        if roomSecretField.exists {
            // Enter a test room secret
            roomSecretField.tap()
            roomSecretField.typeText("test-room-123")
            
            // Connect button
            let connectButton = app.buttons["connectButton"]
            XCTAssertTrue(connectButton.exists)
            connectButton.tap()
            
            // Verify connection status changes
            let connectionStatus = app.staticTexts["connectionStatus"]
            
            // Wait for connection (or timeout)
            let expectation = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "label CONTAINS 'Connected'"),
                object: connectionStatus
            )
            
            let result = XCTWaiter.wait(for: [expectation], timeout: 10.0)
            XCTAssertEqual(result, .completed)
        }
    }
    
    @MainActor
    func testSafariExtensionInteraction() throws {
        // This test requires the extension to be already enabled in Safari
        // It simulates actual browsing and checks if history is tracked
        
        // First ensure our app is running
        app.launch()
        
        // Switch to Safari
        safari.launch()
        
        // Navigate to a test URL
        let urlBar = safari.textFields["URL"]
        if urlBar.exists {
            urlBar.tap()
            urlBar.typeText("https://example.com\n")
            sleep(3) // Wait for page load
        }
        
        // Open our extension popup in Safari
        // Note: This is tricky in UI tests as Safari extension UI is limited
        let toolbar = safari.toolbars.firstMatch
        if toolbar.exists {
            // Look for our extension button
            let extensionButton = toolbar.buttons["History Sync"]
            if extensionButton.exists {
                extensionButton.tap()
                
                // Verify the popup shows
                XCTAssertTrue(safari.staticTexts["History Sync"].exists)
            }
        }
        
        // Return to our app to check if history was synced
        app.activate()
        
        // Check if the visited URL appears in our app's history view
        // (This assumes the app displays synced history)
        let historyTable = app.tables["historyTable"]
        if historyTable.exists {
            let historyCell = historyTable.cells.containing(.staticText, identifier: "example.com").firstMatch
            
            // Wait for sync to complete
            let expectation = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "exists == true"),
                object: historyCell
            )
            
            let result = XCTWaiter.wait(for: [expectation], timeout: 15.0)
            XCTAssertEqual(result, .completed, "History item should appear after sync")
        }
    }
    
    @MainActor
    func testP2PSyncBetweenDevices() throws {
        // This test simulates P2P sync by using the app's sync functionality
        // In a real test environment, you'd have two devices or simulators
        
        app.launch()
        
        // Connect to a test room
        let roomSecretField = app.textFields["roomSecretField"]
        if roomSecretField.exists {
            roomSecretField.tap()
            roomSecretField.typeText("ui-test-room-\(Date().timeIntervalSince1970)")
            
            app.buttons["connectButton"].tap()
            
            // Wait for connection
            sleep(5)
            
            // Simulate sending test history
            if app.buttons["sendTestHistory"].exists {
                app.buttons["sendTestHistory"].tap()
                
                // Verify send confirmation
                XCTAssertTrue(app.staticTexts["History sent"].exists)
            }
            
            // In a real cross-device test, the other device would receive this
            // For now, we just verify our device can send
        }
    }
    
    @MainActor
    func testExtensionPermissions() throws {
        // Test that the app properly handles extension permissions
        
        app.launch()
        
        // Check for permission status
        let permissionStatus = app.staticTexts["extensionPermissionStatus"]
        
        if permissionStatus.exists {
            // Verify we show the correct permission state
            XCTAssertTrue(
                permissionStatus.label.contains("Enabled") ||
                permissionStatus.label.contains("Disabled") ||
                permissionStatus.label.contains("Not Configured")
            )
        }
        
        // If permissions are not granted, verify we show instructions
        if app.staticTexts["Enable Safari Extension"].exists {
            XCTAssertTrue(app.buttons["Open Safari Settings"].exists)
        }
    }
}

// MARK: - Helper Methods
extension HistorySyncUITests {
    /// Wait for an element to appear
    func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
        let predicate = NSPredicate(format: "exists == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        return result == .completed
    }
    
    /// Take a screenshot for debugging
    func takeDebugScreenshot(name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
