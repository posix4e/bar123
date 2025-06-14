import Foundation
import CoreData

// Extension-specific version of HistoryDataManager that uses shared app group
class ExtensionHistoryDataManager {
    static let shared = ExtensionHistoryDataManager()
    
    // MARK: - Core Data stack using App Group
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "HistoryDataModel")
        
        // Use shared app group for Core Data store
        let storeURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: AppConfiguration.appGroupIdentifier)!
            .appendingPathComponent("HistoryData.sqlite")
        
        let storeDescription = NSPersistentStoreDescription(url: storeURL)
        container.persistentStoreDescriptions = [storeDescription]
        
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
    
    private init() {}
    
    // MARK: - Public Methods
    
    /// Add a new history item
    func addHistoryItem(url: String, title: String, visitTime: Date, id: String? = nil) {
        let historyItem = HistoryItem(context: context)
        
        historyItem.url = url
        historyItem.title = title
        historyItem.visitTime = visitTime
        historyItem.id = id ?? UUID().uuidString
        historyItem.isSynced = false
        historyItem.syncedAt = nil
        
        saveContext()
        
        // Post Darwin notification for main app to refresh
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(AppConfiguration.historyUpdatedNotification as CFString),
            nil,
            nil,
            true
        )
    }
    
    /// Get recent history with limit only
    func getRecentHistory(limit: Int) -> [HistoryItem] {
        let request: NSFetchRequest<HistoryItem> = HistoryItem.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "visitTime", ascending: false)]
        request.fetchLimit = limit
        
        do {
            return try context.fetch(request)
        } catch {
            print("Error fetching recent history: \(error)")
            return []
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