import Foundation
import CoreData

class CoreDataManager {
    static let shared = CoreDataManager()
    
    private init() {}
    
    // MARK: - Core Data Stack
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "HistoryDataModel")
        
        // Configure for app group to share between app and extension
        let appGroupID = "group.com.apple-6746350013.bar123"
        if let appGroupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) {
            let storeURL = appGroupURL.appendingPathComponent("HistoryDataModel.sqlite")
            let description = NSPersistentStoreDescription(url: storeURL)
            container.persistentStoreDescriptions = [description]
        }
        
        container.loadPersistentStores { (storeDescription, error) in
            if let error = error as NSError? {
                fatalError("Unresolved error \(error), \(error.userInfo)")
            }
        }
        return container
    }()
    
    var context: NSManagedObjectContext {
        return persistentContainer.viewContext
    }
    
    // MARK: - Save Context
    func saveContext() {
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                let nserror = error as NSError
                fatalError("Unresolved error \(nserror), \(nserror.userInfo)")
            }
        }
    }
    
    // MARK: - History Operations
    func addHistoryItem(url: String, title: String, visitTime: Date, id: String) {
        let historyItem = HistoryItem(context: context)
        historyItem.url = url
        historyItem.title = title
        historyItem.visitTime = visitTime
        historyItem.id = id
        historyItem.isSynced = false
        
        saveContext()
    }
    
    func getUnsyncedItems(limit: Int = 100) -> [HistoryItem] {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        request.predicate = NSPredicate(format: "isSynced == %@", NSNumber(value: false))
        request.sortDescriptors = [NSSortDescriptor(key: "visitTime", ascending: false)]
        request.fetchLimit = limit
        
        do {
            return try context.fetch(request)
        } catch {
            print("Error fetching unsynced items: \(error)")
            return []
        }
    }
    
    func markItemsAsSynced(_ items: [HistoryItem]) {
        let syncTime = Date()
        for item in items {
            item.isSynced = true
            item.syncedAt = syncTime
        }
        saveContext()
    }
    
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
    
    func getRecentHistory(hoursAgo: Int, limit: Int = 50) -> [HistoryItem] {
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
    
    func deleteOldHistory(daysOld: Int = 30) {
        let request: NSFetchRequest<NSFetchRequestResult> = HistoryItem.fetchRequest()
        let cutoffDate = Date().addingTimeInterval(-Double(daysOld * 24 * 3600))
        request.predicate = NSPredicate(format: "visitTime < %@", cutoffDate as NSDate)
        
        let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)
        
        do {
            try context.execute(deleteRequest)
            saveContext()
        } catch {
            print("Error deleting old history: \(error)")
        }
    }
    
    // Convert HistoryItem to dictionary for JSON
    func historyItemToDict(_ item: HistoryItem) -> [String: Any] {
        return [
            "id": item.id ?? "",
            "url": item.url ?? "",
            "title": item.title ?? "",
            "visitTime": (item.visitTime?.timeIntervalSince1970 ?? 0) * 1000,
            "isSynced": item.isSynced
        ]
    }
}