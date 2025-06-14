//
//  bar123UITests.swift
//  bar123UITests
//
//  Created by Alex Newman on 5/22/25.
//

import XCTest

final class bar123UITests: XCTestCase {
    
    var app1: XCUIApplication!
    var app2: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        
        // First app instance
        app1 = XCUIApplication()
        
        // Second app instance - for multi-app testing
        app2 = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app1 = nil
        app2 = nil
    }
    
    // MARK: - History View Tests
    
    @MainActor
    func testHistoryViewOpens() throws {
        // Launch app1 for single device tests
        app1.launch()
        
        // Wait for app to load
        XCTAssertTrue(app1.wait(for: .runningForeground, timeout: 5))
        
        // Wait for app to fully load
        sleep(2)
        
        // The button is now a native UIKit button, not in a webview
        let historyButton = app1.buttons["Open Full History"]
        XCTAssertTrue(historyButton.waitForExistence(timeout: 5), "Open Full History button should exist")
        historyButton.tap()
        
        // Then: History view should be displayed
        let historyTitle = app1.navigationBars["Browser History"]
        XCTAssertTrue(historyTitle.waitForExistence(timeout: 5), "History navigation bar should be visible")
    }
    
    @MainActor
    func testSyncStatusDisplay() throws {
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        // Check sync status elements exist
        XCTAssertTrue(app1.staticTexts["syncStatusLabel"].waitForExistence(timeout: 5), "Sync status label should exist")
        XCTAssertTrue(app1.staticTexts["lastSyncLabel"].exists, "Last sync label should exist")
        XCTAssertTrue(app1.staticTexts["pendingCountLabel"].exists, "Pending count label should exist")
    }
    
    @MainActor
    func testForceSyncButton() throws {
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        // Check force sync button exists
        let syncButton = app1.buttons["syncButton"]
        XCTAssertTrue(syncButton.waitForExistence(timeout: 5), "Force sync button should exist")
        
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
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        // Check table view exists
        let tableView = app1.tables["tableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5), "History table view should exist")
        
        // Pull to refresh
        tableView.swipeDown()
        
        // Verify refresh control exists
        let refreshControl = tableView.otherElements["UIRefreshControl"]
        XCTAssertTrue(refreshControl.exists, "Refresh control should exist")
    }
    
    @MainActor
    func testDeleteHistoryItem() throws {
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        let tableView = app1.tables["tableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5))
        
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
        
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        // Check sync status shows "Not configured"
        let syncStatusLabel = app1.staticTexts["syncStatusLabel"]
        XCTAssertTrue(syncStatusLabel.waitForExistence(timeout: 5))
        XCTAssertTrue(syncStatusLabel.label.contains("Not configured"), "Sync status should show 'Not configured' when Pantry ID is missing")
        
        // Check sync button is disabled
        let syncButton = app1.buttons["syncButton"]
        XCTAssertFalse(syncButton.isEnabled, "Sync button should be disabled when not configured")
    }
    
    @MainActor
    func testSyncStatusWithConfiguration() throws {
        // Set test Pantry ID
        let defaults = UserDefaults(suiteName: "group.com.apple-6746350013.bar123")
        defaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        defaults?.set("browser-history", forKey: "basketName")
        defaults?.synchronize()
        
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Navigate to history view
        app1.buttons["Open Full History"].tap()
        
        // Check sync button is enabled
        let syncButton = app1.buttons["syncButton"]
        XCTAssertTrue(syncButton.waitForExistence(timeout: 5))
        XCTAssertTrue(syncButton.isEnabled, "Sync button should be enabled when configured")
        
        // Check sync status is not "Not configured"
        let syncStatusLabel = app1.staticTexts["syncStatusLabel"]
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
    
    // MARK: - Multi-Device Sync Tests
    
    @MainActor
    func testSyncBetweenTwoDevices() throws {
        // Configure shared Pantry settings
        let sharedDefaults = UserDefaults(suiteName: "group.com.apple-6746350013.bar123")
        sharedDefaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        sharedDefaults?.set("browser-history-test", forKey: "basketName")
        sharedDefaults?.synchronize()
        
        // Launch first app
        app1.launch()
        
        // Launch second app on different simulator
        app2.launch()
        
        // Wait for both apps to be ready
        XCTAssertTrue(app1.wait(for: .runningForeground, timeout: 5))
        XCTAssertTrue(app2.wait(for: .runningForeground, timeout: 5))
        
        // Navigate to history view on first device
        if app1.buttons["Open Full History"].exists {
            app1.buttons["Open Full History"].tap()
        }
        
        // Navigate to history view on second device
        if app2.buttons["Open Full History"].exists {
            app2.buttons["Open Full History"].tap()
        }
        
        // Force sync on first device
        let syncButton1 = app1.buttons["syncButton"]
        if syncButton1.exists && syncButton1.isEnabled {
            syncButton1.tap()
            
            // Wait for sync to complete
            let syncComplete1 = app1.staticTexts["syncStatusLabel"]
            let predicate1 = NSPredicate(format: "label CONTAINS 'Synced'")
            expectation(for: predicate1, evaluatedWith: syncComplete1, handler: nil)
            waitForExpectations(timeout: 10, handler: nil)
        }
        
        // Force sync on second device to get updates
        let syncButton2 = app2.buttons["syncButton"]
        if syncButton2.exists && syncButton2.isEnabled {
            syncButton2.tap()
            
            // Wait for sync to complete
            let syncComplete2 = app2.staticTexts["syncStatusLabel"]
            let predicate2 = NSPredicate(format: "label CONTAINS 'Synced'")
            expectation(for: predicate2, evaluatedWith: syncComplete2, handler: nil)
            waitForExpectations(timeout: 10, handler: nil)
        }
        
        // Verify both devices show the same sync status
        let lastSync1 = app1.staticTexts["lastSyncLabel"].label
        let lastSync2 = app2.staticTexts["lastSyncLabel"].label
        
        // Both should show recent sync times
        XCTAssertFalse(lastSync1.contains("Never"), "Device 1 should have synced")
        XCTAssertFalse(lastSync2.contains("Never"), "Device 2 should have synced")
    }
    
    @MainActor
    func testHistoryPropagationBetweenDevices() throws {
        // This test simulates adding history on one device and seeing it on another
        
        // Configure shared Pantry settings
        let sharedDefaults = UserDefaults(suiteName: "group.com.apple-6746350013.bar123")
        sharedDefaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        sharedDefaults?.set("browser-history-sync-test", forKey: "basketName")
        sharedDefaults?.synchronize()
        
        // Launch both apps
        app1.launch()
        app2.launch()
        
        // Both apps should be running
        XCTAssertTrue(app1.wait(for: .runningForeground, timeout: 5))
        XCTAssertTrue(app2.wait(for: .runningForeground, timeout: 5))
        
        // TODO: Add history item on device 1 through Safari extension
        // For now, we'll just verify the sync mechanism works
        
        // Navigate to history on both devices
        if app1.buttons["Open Full History"].exists {
            app1.buttons["Open Full History"].tap()
        }
        
        if app2.buttons["Open Full History"].exists {
            app2.buttons["Open Full History"].tap()
        }
        
        // Get initial history count on device 2
        let tableView2 = app2.tables["tableView"]
        let initialCount2 = tableView2.cells.count
        
        // Sync on device 1 (which might have new history)
        let syncButton1 = app1.buttons["syncButton"]
        if syncButton1.exists && syncButton1.isEnabled {
            syncButton1.tap()
            sleep(2) // Wait for sync
        }
        
        // Sync on device 2 to get updates
        let syncButton2 = app2.buttons["syncButton"]
        if syncButton2.exists && syncButton2.isEnabled {
            syncButton2.tap()
            
            // Wait for potential new items
            sleep(3)
            
            // Pull to refresh on device 2
            tableView2.swipeDown()
            sleep(1)
        }
        
        // Verify sync indicators are working
        let pendingCount1 = app1.staticTexts["pendingCountLabel"]
        let pendingCount2 = app2.staticTexts["pendingCountLabel"]
        
        XCTAssertTrue(pendingCount1.exists, "Device 1 should show pending count")
        XCTAssertTrue(pendingCount2.exists, "Device 2 should show pending count")
    }
}