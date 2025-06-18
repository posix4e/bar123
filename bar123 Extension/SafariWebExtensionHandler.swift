import SafariServices
import os.log
import Foundation

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // MARK: - Properties
    private let logger = Logger(subsystem: AppConfiguration.logSubsystem, category: "WebExtension")
    
    // MARK: - NSExtensionRequestHandling
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]
        
        logger.info("Received message from web extension: \(String(describing: message))")
        
        guard let action = message["action"] as? String else {
            respondWithError(context: context, error: "Missing action parameter")
            return
        }
        
        switch action {
        case "addHistoryItem":
            handleAddHistoryItem(message: message, context: context)
            
        case "syncHistory":
            handleSyncHistory(context: context)
            
        case "getHistory":
            handleGetHistory(message: message, context: context)
            
        case "getRecentHistory":
            handleGetRecentHistory(message: message, context: context)
            
        case "searchHistory":
            handleSearchHistory(message: message, context: context)
            
        case "cleanupHistory":
            handleCleanupHistory(message: message, context: context)
            
            
        case "openHistoryView":
            handleOpenHistoryView(context: context)
            
        case "getStatus":
            handleGetStatus(context: context)
            
        default:
            respondWithError(context: context, error: "Unknown action: \(action)")
        }
    }
    
    // MARK: - Add History Item Handler
    private func handleAddHistoryItem(message: [String: Any], context: NSExtensionContext) {
        guard let data = message["data"] as? [[String: Any]] else {
            respondWithError(context: context, error: "Invalid history data format")
            return
        }
        
        // Store each history item using ExtensionHistoryDataManager
        let historyDataManager = ExtensionHistoryDataManager.shared
        
        for item in data {
            if let url = item["url"] as? String,
               let title = item["title"] as? String,
               let visitTime = item["visitTime"] as? Double,
               let id = item["id"] as? String {
                
                let date = Date(timeIntervalSince1970: visitTime / 1000)
                historyDataManager.addHistoryItem(
                    url: url,
                    title: title,
                    visitTime: date,
                    id: id
                )
            }
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: ["success": true]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Sync History Handler (Deprecated)
    private func handleSyncHistory(context: NSExtensionContext) {
        // Sync should only be triggered from the main app, not the extension
        respondWithError(context: context, error: "Sync must be triggered from the main app")
    }
    
    // MARK: - Get History Handler
    private func handleGetHistory(message: [String: Any], context: NSExtensionContext) {
        let limit = message["limit"] as? Int ?? 100
        
        // Get history from ExtensionHistoryDataManager
        let historyItems = ExtensionHistoryDataManager.shared.getRecentHistory(limit: limit)
        
        // Convert to dictionary array for JSON response
        let historyData: [[String: Any]] = historyItems.map { item in
            [
                "url": item.url as Any,
                "title": item.title as Any,
                "visitTime": item.visitTime?.timeIntervalSince1970 as Any,
                "id": item.id ?? "",
                "isSynced": item.isSynced
            ]
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "history": historyData
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Get Recent History Handler
    private func handleGetRecentHistory(message: [String: Any], context: NSExtensionContext) {
        let limit = message["limit"] as? Int ?? 50
        let hoursAgo = message["hoursAgo"] as? Int ?? 24
        
        // Calculate cutoff date
        let cutoffDate = Date().addingTimeInterval(-Double(hoursAgo) * 3600)
        
        // Get recent history from HistoryDataManager
        let allHistory = ExtensionHistoryDataManager.shared.getRecentHistory(limit: limit)
        let recentHistory = allHistory.filter { item in
            guard let visitTime = item.visitTime else { return false }
            return visitTime >= cutoffDate
        }
        
        // Convert to dictionary array
        let historyData: [[String: Any]] = recentHistory.map { item in
            [
                "url": item.url as Any,
                "title": item.title as Any,
                "visitTime": item.visitTime?.timeIntervalSince1970 as Any,
                "id": item.id ?? "",
                "isSynced": item.isSynced
            ]
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "history": historyData
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    
    // MARK: - Cleanup History Handler
    private func handleCleanupHistory(message: [String: Any], context: NSExtensionContext) {
        let _ = message["expirationDays"] as? Int ?? 30
        
        // Delete old history from local database
        // TODO: Delete old history from storage
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: ["success": true]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    
    // MARK: - Open History View Handler
    private func handleOpenHistoryView(context: NSExtensionContext) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: NSNotification.Name("OpenHistoryView"), object: nil)
            
            #if os(macOS)
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple-6746350013.bar123") {
                NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
            }
            #else
            // Extensions cannot directly open URLs on iOS
            // The containing app needs to handle this via notifications
            #endif
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: ["success": true]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Get Status Handler
    private func handleGetStatus(context: NSExtensionContext) {
        let pendingCount = ExtensionHistoryDataManager.shared.getPendingCount()
        let lastSyncTime = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)?.object(forKey: "lastSyncTime") as? Date
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "pendingCount": pendingCount,
                "lastSyncTime": lastSyncTime?.timeIntervalSince1970 ?? 0
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Search History Handler
    private func handleSearchHistory(message: [String: Any], context: NSExtensionContext) {
        guard let query = message["query"] as? String, !query.isEmpty else {
            respondWithError(context: context, error: "Search query is required")
            return
        }
        
        let searchType = message["searchType"] as? String ?? "all"
        let limit = message["limit"] as? Int ?? 100
        
        // Search in HistoryDataManager
        let historyDataManager = ExtensionHistoryDataManager.shared
        let allHistory = historyDataManager.getRecentHistory(limit: 1000) // Get more items to search through
        
        // Filter based on search type and query
        let results = allHistory.filter { item in
            let queryLower = query.lowercased()
            switch searchType {
            case "url":
                return item.url?.lowercased().contains(queryLower) ?? false
            case "title":
                return item.title?.lowercased().contains(queryLower) ?? false
            default: // "all"
                return (item.url?.lowercased().contains(queryLower) ?? false) ||
                       (item.title?.lowercased().contains(queryLower) ?? false)
            }
        }.prefix(limit)
        
        // Convert to dictionary array
        let resultsData: [[String: Any]] = Array(results).map { item in
            [
                "url": item.url as Any,
                "title": item.title as Any,
                "visitTime": item.visitTime?.timeIntervalSince1970 as Any,
                "id": item.id ?? "",
                "isSynced": item.isSynced
            ]
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "results": resultsData,
                "query": query
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    
    // MARK: - Helper Methods
    private func respondWithError(context: NSExtensionContext, error: String) {
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": false,
                "error": error
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}