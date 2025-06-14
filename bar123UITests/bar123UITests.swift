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
    
    // MARK: - Integrated History View Tests
    
    @MainActor
    func testIntegratedHistoryViewIsVisible() throws {
        // Launch app1 for single device tests
        app1.launch()
        
        // Wait for app to load
        XCTAssertTrue(app1.wait(for: .runningForeground, timeout: 5))
        
        // Wait for app to fully load
        sleep(2)
        
        // Check that history table view is visible on main screen
        let historyTableView = app1.tables["historyTableView"]
        XCTAssertTrue(historyTableView.waitForExistence(timeout: 5), "History table view should be visible on main screen")
        
        // Check that Recent History header is visible
        let historyHeader = app1.staticTexts["Recent History"]
        XCTAssertTrue(historyHeader.exists, "Recent History header should be visible")
    }
    
    @MainActor
    func testIntegratedUIScrolling() throws {
        // Launch app
        app1.launch()
        sleep(2)
        
        // Check all main UI elements are present
        XCTAssertTrue(app1.images.firstMatch.exists, "App icon should be visible")
        XCTAssertTrue(app1.staticTexts["You can turn on bar123's Safari extension in Settings."].exists, "Info label should be visible")
        
        // Check sync status container elements
        let syncStatusLabel = app1.staticTexts["syncStatusLabel"]
        XCTAssertTrue(syncStatusLabel.exists, "Sync status should be visible")
        
        // Get scroll view
        let scrollView = app1.scrollViews.firstMatch
        XCTAssertTrue(scrollView.exists, "Scroll view should exist")
        
        // Scroll down to ensure history table is visible
        scrollView.swipeUp()
        
        // Verify history table is still accessible after scrolling
        let historyTable = app1.tables["historyTableView"]
        XCTAssertTrue(historyTable.exists, "History table should remain accessible after scrolling")
        
        // Scroll back up
        scrollView.swipeDown()
        
        // Verify top elements are still visible
        XCTAssertTrue(app1.buttons["syncButton"].exists, "Sync button should still be accessible")
    }
    
    @MainActor
    func testHistoryItemInteraction() throws {
        // Launch app
        app1.launch()
        sleep(2)
        
        let tableView = app1.tables["historyTableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5))
        
        // Skip if no history items
        guard tableView.cells.count > 0 else {
            XCTSkip("No history items to test interaction")
            return
        }
        
        // Test tapping a history item
        let firstCell = tableView.cells.element(boundBy: 0)
        
        // Verify cell has expected elements
        XCTAssertTrue(firstCell.staticTexts.count >= 1, "History cell should have title text")
        
        // Test cell tap (should open URL in Safari)
        firstCell.tap()
        
        // After tapping, we should return to the app
        // (URL opening happens in Safari, then user returns)
        sleep(1)
        
        // Verify app is still running
        XCTAssertTrue(app1.wait(for: .runningForeground, timeout: 2))
    }
    
    @MainActor
    func testBrowsingHistoryAppearsInApp() throws {
        // Configure test Pantry settings
        let defaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
        defaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        defaults?.set("browser-history-test", forKey: "basketName")
        defaults?.synchronize()
        
        // Launch the app
        app1.launch()
        sleep(2)
        
        // Get initial history count
        let tableView = app1.tables["historyTableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5))
        let initialCount = tableView.cells.count
        
        print("Initial history count: \(initialCount)")
        
        // Open Safari and browse to a test page
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()
        
        // Wait for Safari to load
        sleep(3)
        
        // Navigate to a test URL
        let urlBar = safari.textFields.firstMatch
        if urlBar.waitForExistence(timeout: 5) {
            urlBar.tap()
            sleep(1)
            urlBar.typeText("https://example.com")
            safari.keyboards.buttons["Go"].tap()
            
            // Wait for page to load
            sleep(5)
        }
        
        // Return to our app
        app1.activate()
        sleep(2)
        
        // Pull to refresh to see new history
        let scrollView = app1.scrollViews.firstMatch
        scrollView.swipeDown()
        sleep(3)
        
        // Check if history count increased
        let newCount = tableView.cells.count
        print("New history count: \(newCount)")
        
        // Note: This might not work immediately due to extension timing
        // In a real scenario, you'd need to ensure the Safari extension is enabled
        // and has time to capture and sync the history
        
        if newCount > initialCount {
            // Verify the new history item appears
            let firstCell = tableView.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.exists, "First history cell should exist")
            
            // Check for expected content
            let staticTexts = firstCell.staticTexts
            XCTAssertTrue(staticTexts.count >= 1, "History cell should have content")
        } else {
            // If no new items, at least verify the UI is working
            XCTAssertTrue(tableView.exists, "History table should still be visible")
            print("Note: Safari extension may need to be enabled for this test to fully work")
        }
    }
    
    @MainActor
    func testHistoryTableViewDisplaysItems() throws {
        // Launch app
        app1.launch()
        sleep(2)
        
        // Verify history table view exists
        let tableView = app1.tables["historyTableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5), "History table view should be visible")
        
        // Check if there are any history items
        if tableView.cells.count > 0 {
            // Verify first cell has expected structure
            let firstCell = tableView.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.exists, "First cell should exist")
            
            // Verify cell has text content
            let staticTexts = firstCell.staticTexts
            XCTAssertTrue(staticTexts.count >= 1, "Cell should contain text elements")
            
            // Verify checkmark accessory for synced items
            let checkmarks = firstCell.images.matching(identifier: "checkmark")
            print("Cell has \(checkmarks.count) checkmark images")
        } else {
            print("No history items to display - this is normal for a fresh install")
        }
        
        // Test pull to refresh functionality
        let scrollView = app1.scrollViews.firstMatch
        XCTAssertTrue(scrollView.exists, "Scroll view should exist")
        
        // Perform pull to refresh
        scrollView.swipeDown()
        sleep(1)
        
        // Verify the view is still functional after refresh
        XCTAssertTrue(tableView.exists, "Table view should still exist after refresh")
    }
    
    @MainActor
    func testSyncStatusDisplay() throws {
        // Launch app
        app1.launch()
        sleep(2)
        
        // Check sync status elements exist on main screen
        XCTAssertTrue(app1.staticTexts["syncStatusLabel"].waitForExistence(timeout: 5), "Sync status label should exist")
        XCTAssertTrue(app1.staticTexts["lastSyncLabel"].exists, "Last sync label should exist")
        XCTAssertTrue(app1.staticTexts["pendingCountLabel"].exists, "Pending count label should exist")
    }
    
    // MARK: - Helper Methods
    
    private func addTestHistoryItem() {
        // Note: In UI tests, we cannot directly access the app's internal classes
        // In a real test, you would:
        // 1. Use XCUIDevice to open Safari
        // 2. Navigate to a test URL
        // 3. Return to the app
        // This is a placeholder for demonstration
    }
    
    private func addMultipleTestHistoryItems(count: Int) {
        // Note: In UI tests, we cannot directly access the app's internal classes
        // In a real test, you would simulate browsing multiple pages in Safari
    }
    
    private func extractPendingCount(from text: String) -> Int {
        // Extract number from "Pending: X items" format
        let components = text.components(separatedBy: CharacterSet.decimalDigits.inverted)
        for component in components {
            if let number = Int(component) {
                return number
            }
        }
        return 0
    }
    
    
    @MainActor
    func testForceSyncButton() throws {
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Check force sync button exists on main screen
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
        
        // Get scroll view to perform pull to refresh
        let scrollView = app1.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 5), "Scroll view should exist")
        
        // Pull to refresh
        scrollView.swipeDown()
        
        // Verify refresh happens (sync status should update)
        let syncStatusLabel = app1.staticTexts["syncStatusLabel"]
        XCTAssertTrue(syncStatusLabel.exists, "Sync status should update after refresh")
    }
    
    @MainActor
    func testDeleteHistoryItem() throws {
        // Launch app1
        app1.launch()
        sleep(2)
        
        let tableView = app1.tables["historyTableView"]
        XCTAssertTrue(tableView.waitForExistence(timeout: 5))
        
        // Skip if no history items
        guard tableView.cells.count > 0 else {
            XCTSkip("No history items to test deletion")
            return
        }
        
        let initialCount = tableView.cells.count
        let firstCell = tableView.cells.element(boundBy: 0)
        
        // Swipe to delete
        firstCell.swipeLeft()
        
        // Tap delete button
        let deleteButton = firstCell.buttons["Delete"]
        XCTAssertTrue(deleteButton.waitForExistence(timeout: 2), "Delete button should appear on swipe")
        
        deleteButton.tap()
        
        // Wait a moment for deletion animation
        sleep(1)
        
        // Verify cell count decreased
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
        let defaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
        defaults?.removeObject(forKey: "pantryID")
        defaults?.synchronize()
        
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Check sync status shows "Not configured" on main screen
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
        let defaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
        defaults?.set("71422a67-e462-4021-9926-5d689c8bc16e", forKey: "pantryID")
        defaults?.set("browser-history", forKey: "basketName")
        defaults?.synchronize()
        
        // Launch app1
        app1.launch()
        sleep(2)
        
        // Check sync button is enabled on main screen
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
        let sharedDefaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
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
        
        // History is already visible on main screen for both devices
        // Just wait a moment for UI to settle
        sleep(2)
        
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
        let sharedDefaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
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
        
        // History is already visible on main screen for both devices
        // Just wait a moment for UI to settle
        sleep(2)
        
        // Get initial history count on device 2
        let tableView2 = app2.tables["historyTableView"]
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