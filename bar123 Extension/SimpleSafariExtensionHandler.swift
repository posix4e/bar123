//
//  SimpleSafariExtensionHandler.swift
//  bar123 Extension
//
//  Simplified Safari extension handler using only Cloudflare DNS
//

import SafariServices
import os.log

class SimpleSafariExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    private let logger = OSLog(subsystem: "com.bar123", category: "SafariExtension")
    
    // Message types from JavaScript
    enum MessageType: String {
        case trackVisit = "track_visit"
        case getConfig = "get_config"
        case updateConfig = "update_config"
        case searchHistory = "search_history"
        case getDevices = "get_devices"
    }
    
    // MARK: - Extension Request Handling
    
    func beginRequest(with context: NSExtensionContext) {
        guard let request = context.inputItems.first as? NSExtensionItem,
              let message = request.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let type = message["type"] as? String else {
            context.cancelRequest(withError: NSError(domain: "InvalidMessage", code: 0))
            return
        }
        
        os_log("Received message: %{public}@", log: logger, type: .debug, type)
        
        Task {
            do {
                let response = try await handleMessage(type: type, data: message["data"] as? [String: Any])
                
                let responseItem = NSExtensionItem()
                responseItem.userInfo = [SFExtensionMessageKey: response]
                
                context.completeRequest(returningItems: [responseItem])
            } catch {
                os_log("Error handling message: %{public}@", log: logger, type: .error, error.localizedDescription)
                context.cancelRequest(withError: error)
            }
        }
    }
    
    // MARK: - Message Handling
    
    private func handleMessage(type: String, data: [String: Any]?) async throws -> [String: Any] {
        switch MessageType(rawValue: type) {
        case .trackVisit:
            return try await handleTrackVisit(data: data)
            
        case .getConfig:
            return handleGetConfig()
            
        case .updateConfig:
            return try handleUpdateConfig(data: data)
            
        case .searchHistory:
            return try await handleSearchHistory(data: data)
            
        case .getDevices:
            return handleGetDevices()
            
        default:
            throw NSError(domain: "UnknownMessageType", code: 0)
        }
    }
    
    // MARK: - Handler Methods
    
    private func handleTrackVisit(data: [String: Any]?) async throws -> [String: Any] {
        guard let url = data?["url"] as? String else {
            throw NSError(domain: "InvalidData", code: 0)
        }
        
        let title = data?["title"] as? String
        let deviceId = UserDefaults.standard.string(forKey: "deviceId") ?? "safari-extension"
        
        let entry = HistoryEntry(
            url: url,
            title: title,
            visitDate: Date(),
            deviceId: deviceId,
            deviceName: "Safari"
        )
        
        // Save to shared storage
        var entries = loadHistory()
        entries.append(entry)
        saveHistory(entries)
        
        // Notify main app via shared container
        notifyMainApp()
        
        return ["success": true]
    }
    
    private func handleGetConfig() -> [String: Any] {
        let config: [String: Any] = [
            "roomId": UserDefaults.standard.string(forKey: "roomId") ?? "default",
            "cloudflareEnabled": UserDefaults.standard.bool(forKey: "cloudflareEnabled"),
            "cloudflareConfigured": isCloudflareConfigured()
        ]
        
        return ["success": true, "config": config]
    }
    
    private func handleUpdateConfig(data: [String: Any]?) throws -> [String: Any] {
        guard let config = data else {
            throw NSError(domain: "InvalidData", code: 0)
        }
        
        if let roomId = config["roomId"] as? String {
            UserDefaults.standard.set(roomId, forKey: "roomId")
        }
        
        if let enabled = config["cloudflareEnabled"] as? Bool {
            UserDefaults.standard.set(enabled, forKey: "cloudflareEnabled")
        }
        
        notifyMainApp()
        
        return ["success": true]
    }
    
    private func handleSearchHistory(data: [String: Any]?) async throws -> [String: Any] {
        let query = data?["query"] as? String ?? ""
        let entries = loadHistory()
        
        let results: [HistoryEntry]
        if query.isEmpty {
            results = entries
        } else {
            let lowercased = query.lowercased()
            results = entries.filter { entry in
                entry.url.lowercased().contains(lowercased) ||
                (entry.title?.lowercased().contains(lowercased) ?? false)
            }
        }
        
        // Convert to dictionary array for JavaScript
        let resultDicts = results.map { entry in
            [
                "id": entry.id,
                "url": entry.url,
                "title": entry.title ?? "",
                "visitDate": ISO8601DateFormatter().string(from: entry.visitDate),
                "deviceId": entry.deviceId,
                "deviceName": entry.deviceName
            ]
        }
        
        return ["success": true, "results": resultDicts]
    }
    
    private func handleGetDevices() -> [String: Any] {
        // In simplified version, we don't track connected devices
        // This would come from the main app via shared container
        return ["success": true, "devices": []]
    }
    
    // MARK: - Helper Methods
    
    private func isCloudflareConfigured() -> Bool {
        let hasToken = UserDefaults.standard.string(forKey: "cloudflareApiToken") != nil
        let hasZoneId = UserDefaults.standard.string(forKey: "cloudflareZoneId") != nil
        let hasDomain = UserDefaults.standard.string(forKey: "cloudflareDomain") != nil
        return hasToken && hasZoneId && hasDomain
    }
    
    private func loadHistory() -> [HistoryEntry] {
        guard let data = UserDefaults.standard.data(forKey: "safari_history"),
              let entries = try? JSONDecoder().decode([HistoryEntry].self, from: data) else {
            return []
        }
        return entries
    }
    
    private func saveHistory(_ entries: [HistoryEntry]) {
        // Keep only last 1000 entries
        let trimmed = Array(entries.suffix(1000))
        if let data = try? JSONEncoder().encode(trimmed) {
            UserDefaults.standard.set(data, forKey: "safari_history")
        }
    }
    
    private func notifyMainApp() {
        // Post notification that main app can observe
        NotificationCenter.default.post(
            name: NSNotification.Name("HistoryUpdated"),
            object: nil,
            userInfo: nil
        )
    }
}