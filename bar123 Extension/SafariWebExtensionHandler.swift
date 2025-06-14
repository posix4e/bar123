import SafariServices
import os.log
import CryptoKit
import Foundation

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // MARK: - Properties
    private let encryptionKey = SymmetricKey(size: .bits256)
    private let logger = Logger(subsystem: "com.apple-6746350013.bar123", category: "WebExtension")
    // CoreDataManager will be accessed through dependency injection or shared instance
    
    // User-configurable Pantry settings
    private var pantryID: String {
        UserDefaults.standard.string(forKey: "pantryID") ?? ""
    }
    
    private var basketName: String {
        UserDefaults.standard.string(forKey: "basketName") ?? "browser-history"
    }
    
    private var pantryBaseURL: String {
        "https://getpantry.cloud/apiv1/pantry"
    }
    
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
            
        case "configurePantry":
            handleConfigurePantry(message: message, context: context)
            
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
        
        // Store each history item in Core Data
        for item in data {
            if let url = item["url"] as? String,
               let title = item["title"] as? String,
               let visitTime = item["visitTime"] as? Double,
               let id = item["id"] as? String {
                
                let date = Date(timeIntervalSince1970: visitTime / 1000)
                // TODO: Implement data persistence
                // Need to add storage solution for history items
            }
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: ["success": true]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
        
        // Schedule sync if needed
        scheduleSyncIfNeeded()
    }
    
    // MARK: - Sync History Handler
    private func handleSyncHistory(context: NSExtensionContext) {
        guard !pantryID.isEmpty else {
            respondWithError(context: context, error: "Pantry ID not configured")
            return
        }
        
        Task {
            do {
                // Get unsynced items from Core Data
                // TODO: Get unsynced items from storage
                let unsyncedItems: [[String: Any]] = []
                
                if unsyncedItems.isEmpty {
                    let response = NSExtensionItem()
                    response.userInfo = [
                        SFExtensionMessageKey: [
                            "success": true,
                            "syncedCount": 0
                        ]
                    ]
                    context.completeRequest(returningItems: [response], completionHandler: nil)
                    return
                }
                
                // Convert to dictionary array
                let historyData = unsyncedItems
                
                // Encrypt and upload
                let encryptedData = try encryptHistoryData(historyData)
                let success = await uploadToPantry(encryptedData: encryptedData)
                
                if success {
                    // Mark items as synced
                    // TODO: Mark items as synced in storage
                    UserDefaults.standard.set(Date(), forKey: "lastSyncTime")
                    
                    let response = NSExtensionItem()
                    response.userInfo = [
                        SFExtensionMessageKey: [
                            "success": true,
                            "syncedCount": unsyncedItems.count
                        ]
                    ]
                    context.completeRequest(returningItems: [response], completionHandler: nil)
                } else {
                    respondWithError(context: context, error: "Failed to upload to Pantry")
                }
            } catch {
                logger.error("Sync failed: \(error.localizedDescription)")
                respondWithError(context: context, error: error.localizedDescription)
            }
        }
    }
    
    // MARK: - Get History Handler
    private func handleGetHistory(message: [String: Any], context: NSExtensionContext) {
        let limit = message["limit"] as? Int ?? 100
        
        // Get history from local database
        // TODO: Get history from storage
        let historyData: [[String: Any]] = []
        
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
        
        // Get recent history from local database
        // TODO: Get recent history from storage  
        let historyData: [[String: Any]] = []
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "history": historyData
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
        
        // Search in local database
        // TODO: Search history in storage
        let resultsData: [[String: Any]] = []
        
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
    
    // MARK: - Cleanup History Handler
    private func handleCleanupHistory(message: [String: Any], context: NSExtensionContext) {
        let expirationDays = message["expirationDays"] as? Int ?? 30
        
        // Delete old history from local database
        // TODO: Delete old history from storage
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: ["success": true]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Configure Pantry Handler
    private func handleConfigurePantry(message: [String: Any], context: NSExtensionContext) {
        if let pantryID = message["pantryID"] as? String {
            UserDefaults.standard.set(pantryID, forKey: "pantryID")
        }
        
        if let basketName = message["basketName"] as? String {
            UserDefaults.standard.set(basketName, forKey: "basketName")
        }
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "pantryID": self.pantryID,
                "basketName": self.basketName
            ]
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
        // TODO: Get unsynced count from storage
        let unsyncedCount = 0
        
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": true,
                "pendingCount": unsyncedCount
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // MARK: - Sync Scheduling
    private func scheduleSyncIfNeeded() {
        // Check if we have enough unsynced items or if it's been too long since last sync
        // TODO: Get unsynced count from storage
        let unsyncedCount = 0
        let lastSyncTime = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date ?? Date.distantPast
        let timeSinceLastSync = Date().timeIntervalSince(lastSyncTime)
        
        if unsyncedCount > 50 || timeSinceLastSync > 3600 { // 50 items or 1 hour
            Task {
                await performBackgroundSync()
            }
        }
    }
    
    private func performBackgroundSync() async {
        guard !pantryID.isEmpty else { return }
        
        do {
            // TODO: Get unsynced items from storage
            let unsyncedItems: [[String: Any]] = []
            if !unsyncedItems.isEmpty {
                let historyData = unsyncedItems
                let encryptedData = try encryptHistoryData(historyData)
                
                if await uploadToPantry(encryptedData: encryptedData) {
                    // TODO: Mark items as synced in storage
                    UserDefaults.standard.set(Date(), forKey: "lastSyncTime")
                }
            }
        } catch {
            logger.error("Background sync failed: \(error)")
        }
    }
    
    // MARK: - Encryption Methods
    private func encryptHistoryData(_ data: [[String: Any]]) throws -> Data {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(jsonData, using: encryptionKey, nonce: nonce)
        
        var encryptedData = Data()
        encryptedData.append(nonce.withUnsafeBytes { Data($0) })
        encryptedData.append(sealedBox.ciphertext)
        encryptedData.append(sealedBox.tag)
        
        return encryptedData
    }
    
    // MARK: - Pantry Integration
    private func uploadToPantry(encryptedData: Data) async -> Bool {
        guard let url = URL(string: "\(pantryBaseURL)/\(pantryID)/basket/\(basketName)") else { 
            logger.error("Invalid Pantry URL")
            return false 
        }
        
        let payload: [String: Any] = [
            "encryptedData": encryptedData.base64EncodedString(),
            "timestamp": Date().timeIntervalSince1970,
            "version": "1.0"
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload) else {
            logger.error("Failed to create JSON payload")
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                logger.info("Pantry upload response: \(httpResponse.statusCode)")
                return httpResponse.statusCode == 200
            }
        } catch {
            logger.error("Pantry upload failed: \(error.localizedDescription)")
        }
        
        return false
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

// MARK: - Custom Errors
enum EncryptionError: Error {
    case invalidData
    case encryptionFailed
    case decryptionFailed
}