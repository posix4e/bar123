import XCTest
import CoreData
@testable import bar123

class HistoryDataManagerTests: XCTestCase {
    
    var historyDataManager: HistoryDataManager!
    
    override func setUpWithError() throws {
        // Use the shared instance for testing
        historyDataManager = HistoryDataManager.shared
    }
    
    override func tearDownWithError() throws {
        // Clean up test data
        cleanupTestData()
        historyDataManager = nil
    }
    
    func testAddHistoryItem() throws {
        // Given
        let testURL = "https://example.com/test"
        let testTitle = "Test Page"
        let testTime = Date()
        let testID = UUID().uuidString
        
        // When
        historyDataManager.addHistoryItem(
            url: testURL,
            title: testTitle,
            visitTime: testTime,
            id: testID
        )
        
        // Then
        let recentHistory = historyDataManager.getRecentHistory(limit: 1)
        XCTAssertEqual(recentHistory.count, 1, "Should have one history item")
        
        if let firstItem = recentHistory.first {
            XCTAssertEqual(firstItem.url, testURL)
            XCTAssertEqual(firstItem.title, testTitle)
            XCTAssertEqual(firstItem.id, testID)
            XCTAssertFalse(firstItem.isSynced, "New items should not be synced")
        }
    }
    
    func testGetPendingCount() throws {
        // Given - add some unsynced items
        let initialCount = historyDataManager.getPendingCount()
        
        // When - add new items
        for i in 0..<3 {
            historyDataManager.addHistoryItem(
                url: "https://example.com/test\(i)",
                title: "Test Page \(i)",
                visitTime: Date(),
                id: nil
            )
        }
        
        // Then
        let newCount = historyDataManager.getPendingCount()
        XCTAssertEqual(newCount, initialCount + 3, "Pending count should increase by 3")
    }
    
    func testMarkItemsAsSynced() throws {
        // Given - add unsynced items
        historyDataManager.addHistoryItem(
            url: "https://example.com/sync-test",
            title: "Sync Test Page",
            visitTime: Date(),
            id: nil
        )
        
        let unsyncedItems = historyDataManager.getUnsyncedItems()
        XCTAssertGreaterThan(unsyncedItems.count, 0, "Should have unsynced items")
        
        // When
        historyDataManager.markItemsAsSynced(unsyncedItems)
        
        // Then
        let remainingUnsynced = historyDataManager.getUnsyncedItems()
        let syncedCount = unsyncedItems.count - remainingUnsynced.count
        XCTAssertEqual(syncedCount, unsyncedItems.count, "All items should be marked as synced")
    }
    
    func testGetRecentHistoryWithLimit() throws {
        // Given - add multiple items
        for i in 0..<10 {
            historyDataManager.addHistoryItem(
                url: "https://example.com/page\(i)",
                title: "Page \(i)",
                visitTime: Date().addingTimeInterval(TimeInterval(i)),
                id: nil
            )
        }
        
        // When
        let recentHistory = historyDataManager.getRecentHistory(limit: 5)
        
        // Then
        XCTAssertLessThanOrEqual(recentHistory.count, 5, "Should return at most 5 items")
    }
    
    func testHistoryItemsAreSortedByMostRecent() throws {
        // Given - add items with different times
        let oldDate = Date().addingTimeInterval(-3600) // 1 hour ago
        let newDate = Date()
        
        historyDataManager.addHistoryItem(
            url: "https://old.com",
            title: "Old Page",
            visitTime: oldDate,
            id: "old"
        )
        
        historyDataManager.addHistoryItem(
            url: "https://new.com",
            title: "New Page",
            visitTime: newDate,
            id: "new"
        )
        
        // When
        let history = historyDataManager.getRecentHistory(limit: 10)
        
        // Then
        XCTAssertGreaterThanOrEqual(history.count, 2, "Should have at least 2 items")
        
        // Find our test items
        let newItemIndex = history.firstIndex { $0.id == "new" }
        let oldItemIndex = history.firstIndex { $0.id == "old" }
        
        if let newIdx = newItemIndex, let oldIdx = oldItemIndex {
            XCTAssertLessThan(newIdx, oldIdx, "Newer item should appear before older item")
        }
    }
    
    // MARK: - Helper Methods
    
    private func cleanupTestData() {
        // Clean up test data by removing items we created
        let testHistory = historyDataManager.getRecentHistory(limit: 100)
        for item in testHistory {
            if let url = item.url, 
               (url.contains("example.com") || url.contains("old.com") || url.contains("new.com")) {
                historyDataManager.deleteHistoryItem(item)
            }
        }
    }
}