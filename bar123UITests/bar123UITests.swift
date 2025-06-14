//
//  bar123UITests.swift
//  bar123UITests
//
//  Created by Alex Newman on 5/22/25.
//

import XCTest

final class bar123UITests: XCTestCase {
    
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - History View Tests
    
    @MainActor
    func testHistoryViewOpens() throws {
        // Given: App is launched
        // When: User navigates to history view
        let historyButton = app.buttons["Open Full History"]
        XCTAssertTrue(historyButton.exists, "Open Full History button should exist")
        
        historyButton.tap()
        
        // Then: History view should be displayed
        let historyTitle = app.navigationBars["Browser History"]
        XCTAssertTrue(historyTitle.exists, "History navigation bar should be visible")
    }
    
    @MainActor
    func testSyncStatusDisplay() throws {
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        // Check sync status elements exist
        XCTAssertTrue(app.staticTexts["syncStatusLabel"].exists, "Sync status label should exist")
        XCTAssertTrue(app.staticTexts["lastSyncLabel"].exists, "Last sync label should exist")
        XCTAssertTrue(app.staticTexts["pendingCountLabel"].exists, "Pending count label should exist")
    }
    
    @MainActor
    func testForceSyncButton() throws {
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        // Check force sync button exists
        let syncButton = app.buttons["syncButton"]
        XCTAssertTrue(syncButton.exists, "Force sync button should exist")
        
        // Test button is enabled when configured
        XCTAssertTrue(syncButton.isEnabled, "Sync button should be enabled when Pantry is configured")
        
        // Tap the sync button
        syncButton.tap()
        
        // Wait for sync to start (button should be disabled)
        let disabledPredicate = NSPredicate(format: "enabled == false")
        expectation(for: disabledPredicate, evaluatedWith: syncButton, handler: nil)
        waitForExpectations(timeout: 2, handler: nil)
    }
    
    @MainActor
    func testHistoryListRefresh() throws {
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        // Check table view exists
        let tableView = app.tables["tableView"]
        XCTAssertTrue(tableView.exists, "History table view should exist")
        
        // Pull to refresh
        tableView.swipeDown()
        
        // Verify refresh control exists
        let refreshControl = tableView.otherElements["UIRefreshControl"]
        XCTAssertTrue(refreshControl.exists, "Refresh control should exist")
    }
    
    @MainActor
    func testDeleteHistoryItem() throws {
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        let tableView = app.tables["tableView"]
        
        // Skip if no history items
        guard tableView.cells.count > 0 else {
            XCTSkip("No history items to test deletion")
            return
        }
        
        let firstCell = tableView.cells.element(boundBy: 0)
        
        // Swipe to delete
        firstCell.swipeLeft()
        
        // Tap delete button
        let deleteButton = firstCell.buttons["Delete"]
        XCTAssertTrue(deleteButton.exists, "Delete button should appear on swipe")
        
        deleteButton.tap()
        
        // Verify cell count decreased
        let initialCount = tableView.cells.count
        XCTAssertTrue(tableView.cells.count < initialCount || tableView.cells.count == 0, "Cell count should decrease after deletion")
    }
    
    // MARK: - Settings Tests
    
    @MainActor
    func testPantrySettingsInSystemSettings() throws {
        // This test would require navigating to System Settings
        // which is outside the app's sandbox in UI tests
        
        // Instead, we can verify the Settings.bundle exists
        let settingsBundle = Bundle.main.path(forResource: "Settings", ofType: "bundle")
        XCTAssertNotNil(settingsBundle, "Settings.bundle should exist in the app")
    }
    
    @MainActor
    func testSyncStatusWithoutConfiguration() throws {
        // Clear UserDefaults to simulate no configuration
        let defaults = UserDefaults(suiteName: "group.com.apple-6746350013.bar123")
        defaults?.removeObject(forKey: "pantryID")
        defaults?.synchronize()
        
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        // Check sync status shows "Not configured"
        let syncStatusLabel = app.staticTexts["syncStatusLabel"]
        XCTAssertTrue(syncStatusLabel.label.contains("Not configured"), "Sync status should show 'Not configured' when Pantry ID is missing")
        
        // Check sync button is disabled
        let syncButton = app.buttons["syncButton"]
        XCTAssertFalse(syncButton.isEnabled, "Sync button should be disabled when not configured")
    }
    
    @MainActor
    func testSyncStatusWithConfiguration() throws {
        // Set test Pantry ID
        let defaults = UserDefaults(suiteName: "group.com.apple-6746350013.bar123")
        defaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        defaults?.set("browser-history", forKey: "basketName")
        defaults?.synchronize()
        
        // Navigate to history view
        app.buttons["Open Full History"].tap()
        
        // Check sync button is enabled
        let syncButton = app.buttons["syncButton"]
        XCTAssertTrue(syncButton.isEnabled, "Sync button should be enabled when configured")
        
        // Check sync status is not "Not configured"
        let syncStatusLabel = app.staticTexts["syncStatusLabel"]
        XCTAssertFalse(syncStatusLabel.label.contains("Not configured"), "Sync status should not show 'Not configured' when Pantry ID is set")
    }
    
    // MARK: - Performance Tests
    
    @MainActor
    func testLaunchPerformance() throws {
        if #available(macOS 10.15, iOS 13.0, tvOS 13.0, watchOS 7.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
}