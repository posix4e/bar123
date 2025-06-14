import Foundation
import CoreData

class HistoryDataManager {
    static let shared = HistoryDataManager()
    
    // MARK: - Core Data stack
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "HistoryDataModel")
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Failed to load Core Data stack: \(error)")
            }
        }
        return container
    }()
    
    private var context: NSManagedObjectContext {
        return persistentContainer.viewContext
    }
    
    // MARK: - Public Methods
    
    /// Save a new history item from the browser extension
    func saveHistoryItem(url: String, title: String, visitTime: Date, id: String? = nil) {
        let historyItem = NSEntityDescription.insertNewObject(forEntityName: "HistoryItem", into: context) as! HistoryItem
        
        historyItem.url = url
        historyItem.title = title
        historyItem.visitTime = visitTime
        historyItem.id = id ?? UUID().uuidString
        historyItem.isSynced = false
        historyItem.syncedAt = nil
        
        saveContext()
        
        // Post notification for UI updates
        NotificationCenter.default.post(name: NSNotification.Name("HistoryUpdated"), object: nil)
    }
    
    /// Get all unsynced history items
    func getUnsyncedItems() -> [HistoryItem] {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        request.predicate = NSPredicate(format: "isSynced == NO")
        request.sortDescriptors = [NSSortDescriptor(key: "visitTime", ascending: false)]
        
        do {
            return try context.fetch(request)
        } catch {
            print("Error fetching unsynced items: \(error)")
            return []
        }
    }
    
    /// Mark items as synced
    func markItemsAsSynced(_ items: [HistoryItem]) {
        let syncTime = Date()
        items.forEach { item in
            item.isSynced = true
            item.syncedAt = syncTime
        }
        saveContext()
    }
    
    /// Search history in local database
    func searchHistory(query: String, searchType: String = "all", limit: Int = 100) -> [HistoryItem] {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        
        switch searchType {
        case "title":
            request.predicate = NSPredicate(format: "title CONTAINS[cd] %@", query)
        case "url":
            request.predicate = NSPredicate(format: "url CONTAINS[cd] %@", query)
        default: // "all"
            request.predicate = NSPredicate(format: "title CONTAINS[cd] %@ OR url CONTAINS[cd] %@", query, query)
        }
        
        request.sortDescriptors = [NSSortDescriptor(key: "visitTime", ascending: false)]
        request.fetchLimit = limit
        
        do {
            return try context.fetch(request)
        } catch {
            print("Error searching history: \(error)")
            return []
        }
    }
    
    /// Get recent history from local database
    func getRecentHistory(hoursAgo: Int = 24, limit: Int = 50) -> [HistoryItem] {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        let cutoffDate = Date().addingTimeInterval(-Double(hoursAgo * 3600))
        
        request.predicate = NSPredicate(format: "visitTime >= %@", cutoffDate as NSDate)
        request.sortDescriptors = [NSSortDescriptor(key: "visitTime", ascending: false)]
        request.fetchLimit = limit
        
        do {
            return try context.fetch(request)
        } catch {
            print("Error fetching recent history: \(error)")
            return []
        }
    }
    
    /// Delete old history items (30+ days)
    func cleanupOldHistory(daysToKeep: Int = 30) {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        let cutoffDate = Date().addingTimeInterval(-Double(daysToKeep * 24 * 3600))
        
        request.predicate = NSPredicate(format: "visitTime < %@", cutoffDate as NSDate)
        
        do {
            let oldItems = try context.fetch(request)
            oldItems.forEach { context.delete($0) }
            saveContext()
        } catch {
            print("Error cleaning up old history: \(error)")
        }
    }
    
    /// Get count of pending items
    func getPendingCount() -> Int {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        request.predicate = NSPredicate(format: "isSynced == NO")
        
        do {
            return try context.count(for: request)
        } catch {
            print("Error counting pending items: \(error)")
            return 0
        }
    }
    
    // MARK: - Private Methods
    private func saveContext() {
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("Error saving context: \(error)")
            }
        }
    }
}