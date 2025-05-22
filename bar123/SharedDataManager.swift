import Foundation
import CoreData

class SharedDataManager {
    static let shared = SharedDataManager()
    
    private init() {}
    
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "HistoryDataModel")
        
        guard let appGroupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.xyz.foo.bar123") else {
            fatalError("App Group container not found")
        }
        
        let storeURL = appGroupURL.appendingPathComponent("HistoryDataModel.sqlite")
        let description = NSPersistentStoreDescription(url: storeURL)
        container.persistentStoreDescriptions = [description]
        
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Core Data error: \(error)")
            }
        }
        
        return container
    }()
    
    var context: NSManagedObjectContext {
        return persistentContainer.viewContext
    }
    
    func saveContext() {
        if context.hasChanges {
            try? context.save()
        }
    }
    
    func addHistoryItem(url: String, title: String?, domain: String?) {
        let historyItem = HistoryItem(context: context)
        historyItem.url = url
        historyItem.title = title
        historyItem.domain = domain
        historyItem.visitDate = Date()
        
        saveContext()
    }
    
    func fetchHistoryItems() -> [HistoryItem] {
        syncPendingHistory()
        
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(keyPath: \HistoryItem.visitDate, ascending: false)]
        
        return (try? context.fetch(request)) ?? []
    }
    
    private func syncPendingHistory() {
        guard let userDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            return
        }
        
        guard let pendingHistory = userDefaults.array(forKey: "pendingHistory") as? [[String: Any]] else {
            return
        }
        
        let dateFormatter = ISO8601DateFormatter()
        
        for item in pendingHistory {
            guard let url = item["url"] as? String,
                  let visitDateString = item["visitDate"] as? String,
                  let visitDate = dateFormatter.date(from: visitDateString) else {
                continue
            }
            
            // Check if this item already exists
            let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
            request.predicate = NSPredicate(format: "url == %@ AND visitDate == %@", url, visitDate as CVarArg)
            
            if (try? context.count(for: request)) == 0 {
                let historyItem = HistoryItem(context: context)
                historyItem.url = url
                historyItem.title = item["title"] as? String
                historyItem.domain = item["domain"] as? String
                historyItem.visitDate = visitDate
            }
        }
        
        saveContext()
        
        // Clear synced items
        userDefaults.removeObject(forKey: "pendingHistory")
        userDefaults.synchronize()
    }
}