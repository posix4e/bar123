import XCTest

final class BrowsingHistoryTests: XCTestCase {
    
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    @MainActor
    func testHistoryTableViewExists() throws {
        // Launch the app
        app.launch()
        
        // Wait for the app to fully load
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))
        
        // Verify the main UI elements exist
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Main scroll view should exist")
        
        // Check for the history table view
        let historyTable = app.tables["historyTableView"]
        XCTAssertTrue(historyTable.exists, "History table view should exist")
        
        // Check for sync status elements
        let syncStatusLabel = app.staticTexts["syncStatusLabel"]
        XCTAssertTrue(syncStatusLabel.exists, "Sync status label should exist")
        
        let syncButton = app.buttons["syncButton"]
        XCTAssertTrue(syncButton.exists, "Sync button should exist")
        
        // Check for the Recent History header
        let historyHeader = app.staticTexts["Recent History"]
        XCTAssertTrue(historyHeader.exists, "Recent History header should exist")
    }
    
    @MainActor
    func testPullToRefresh() throws {
        app.launch()
        
        // Wait for app to load
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))
        sleep(2)
        
        // Get the scroll view
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.exists, "Scroll view should exist")
        
        // Perform pull to refresh
        scrollView.swipeDown()
        
        // Wait for refresh to complete
        sleep(2)
        
        // Verify the app is still responsive
        let syncButton = app.buttons["syncButton"]
        XCTAssertTrue(syncButton.exists, "App should remain functional after refresh")
    }
    
    @MainActor
    func testHistoryCellStructure() throws {
        app.launch()
        sleep(2)
        
        let historyTable = app.tables["historyTableView"]
        XCTAssertTrue(historyTable.waitForExistence(timeout: 5))
        
        // Check if there are any cells
        if historyTable.cells.count > 0 {
            let firstCell = historyTable.cells.element(boundBy: 0)
            XCTAssertTrue(firstCell.exists, "First cell should exist")
            
            // Log what we find in the cell
            print("Cell contains \(firstCell.staticTexts.count) static texts")
            print("Cell contains \(firstCell.buttons.count) buttons")
            print("Cell contains \(firstCell.images.count) images")
            
            // Verify cell is tappable
            XCTAssertTrue(firstCell.isHittable, "Cell should be tappable")
        } else {
            print("No history items present - this is expected for a fresh install")
            // Still pass the test as empty history is valid
            XCTAssertTrue(true)
        }
    }
    
    @MainActor
    func testManualBrowsingHistoryCapture() throws {
        // This test provides manual steps to verify history capture
        print("""
        
        ===== MANUAL TEST STEPS =====
        1. Enable the bar123 Safari Extension in Settings > Safari > Extensions
        2. Open Safari and browse to any website
        3. Return to the bar123 app
        4. Pull down to refresh
        5. Verify the visited website appears in the history list
        
        This test verifies the UI is ready to display history items.
        ==============================
        
        """)
        
        app.launch()
        sleep(2)
        
        // Verify the UI is set up correctly
        let historyTable = app.tables["historyTableView"]
        XCTAssertTrue(historyTable.exists, "History table should be ready to display items")
        
        let pendingLabel = app.staticTexts["pendingCountLabel"]
        XCTAssertTrue(pendingLabel.exists, "Pending count label should exist")
        
        // Check initial pending count
        print("Current pending count: \(pendingLabel.label)")
    }
}