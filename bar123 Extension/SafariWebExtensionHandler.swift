/**
 * SafariWebExtensionHandler.swift
 * Handles communication between Safari extension JavaScript and native iOS code
 * 
 * Features:
 * - Receives browsing history updates from JavaScript
 * - Manages WebRTC connections for P2P sync
 * - Handles search queries and device management
 * - Provides configuration updates to JavaScript
 */

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // MARK: - Properties
    private static let historySyncManager = HistorySyncManager()
    private let logger = OSLog(subsystem: "com.historysync", category: "SafariExtensionHandler")
    
    // MARK: - Message Types
    enum MessageType: String {
        case trackVisit = "track_visit"
        case connect = "connect"
        case disconnect = "disconnect"
        case searchHistory = "search_history"
        case getDevices = "get_devices"
        case getHistory = "get_history"
        case addSecret = "add_secret"
        case getSecrets = "get_secrets"
    }
    
    // MARK: - Extension Request Handling
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, log: logger, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        // Process the message
        if let messageDict = message as? [String: Any] {
            handleMessage(messageDict, context: context)
        } else {
            // Echo back for unknown messages
            let response = NSExtensionItem()
            if #available(iOS 15.0, macOS 11.0, *) {
                response.userInfo = [ SFExtensionMessageKey: [ "echo": message ] ]
            } else {
                response.userInfo = [ "message": [ "echo": message ] ]
            }
            context.completeRequest(returningItems: [ response ], completionHandler: nil)
        }
    }
    
    // MARK: - Message Handling
    private func handleMessage(_ message: [String: Any], context: NSExtensionContext) {
        guard let typeString = message["type"] as? String,
              let type = MessageType(rawValue: typeString) else {
            sendErrorResponse("Unknown message type", context: context)
            return
        }
        
        switch type {
        case .trackVisit:
            handleTrackVisit(message, context: context)
            
        case .connect:
            handleConnect(message, context: context)
            
        case .disconnect:
            handleDisconnect(context: context)
            
        case .searchHistory:
            handleSearchHistory(message, context: context)
            
        case .getDevices:
            handleGetDevices(context: context)
            
        case .getHistory:
            handleGetHistory(message, context: context)
            
        case .addSecret:
            handleAddSecret(message, context: context)
            
        case .getSecrets:
            handleGetSecrets(context: context)
        }
    }
    
    // MARK: - Message Handlers
    private func handleTrackVisit(_ message: [String: Any], context: NSExtensionContext) {
        guard let url = message["url"] as? String else {
            sendErrorResponse("Missing URL", context: context)
            return
        }
        
        let title = message["title"] as? String
        
        Self.historySyncManager.trackVisit(url: url, title: title)
        
        sendSuccessResponse(["tracked": true], context: context)
    }
    
    private func handleConnect(_ message: [String: Any], context: NSExtensionContext) {
        guard let roomId = message["roomId"] as? String,
              let sharedSecret = message["sharedSecret"] as? String,
              let serverUrl = message["serverUrl"] as? String,
              let signalingURL = URL(string: serverUrl) else {
            sendErrorResponse("Missing connection parameters", context: context)
            return
        }
        
        Task {
            do {
                try await Self.historySyncManager.connect(
                    roomId: roomId,
                    sharedSecret: sharedSecret,
                    signalingServerURL: signalingURL
                )
                sendSuccessResponse(["connected": true], context: context)
            } catch {
                sendErrorResponse("Connection failed: \(error.localizedDescription)", context: context)
            }
        }
    }
    
    private func handleDisconnect(context: NSExtensionContext) {
        Task {
            await Self.historySyncManager.disconnect()
            sendSuccessResponse(["disconnected": true], context: context)
        }
    }
    
    private func handleSearchHistory(_ message: [String: Any], context: NSExtensionContext) {
        guard let query = message["query"] as? String else {
            sendErrorResponse("Missing search query", context: context)
            return
        }
        
        let results = Self.historySyncManager.searchHistory(query: query)
        let encodedResults = results.map { entry in
            [
                "id": entry.id.uuidString,
                "url": entry.url,
                "title": entry.title ?? "",
                "visitDate": ISO8601DateFormatter().string(from: entry.visitDate),
                "deviceId": entry.deviceId,
                "deviceName": entry.deviceName
            ]
        }
        
        sendSuccessResponse(["results": encodedResults], context: context)
    }
    
    private func handleGetDevices(context: NSExtensionContext) {
        let devices = Self.historySyncManager.getAllKnownDevices()
        let encodedDevices = devices.map { device in
            [
                "id": device.id,
                "name": device.name,
                "type": device.type,
                "lastSeen": ISO8601DateFormatter().string(from: device.lastSeen),
                "isConnected": device.isConnected
            ]
        }
        
        sendSuccessResponse(["devices": encodedDevices], context: context)
    }
    
    private func handleGetHistory(_ message: [String: Any], context: NSExtensionContext) {
        let deviceId = message["deviceId"] as? String
        let history = Self.historySyncManager.getHistory(for: deviceId)
        
        let encodedHistory = history.map { entry in
            [
                "id": entry.id.uuidString,
                "url": entry.url,
                "title": entry.title ?? "",
                "visitDate": ISO8601DateFormatter().string(from: entry.visitDate),
                "deviceId": entry.deviceId,
                "deviceName": entry.deviceName
            ]
        }
        
        sendSuccessResponse(["history": encodedHistory], context: context)
    }
    
    private func handleAddSecret(_ message: [String: Any], context: NSExtensionContext) {
        guard let secret = message["secret"] as? String,
              let name = message["name"] as? String else {
            sendErrorResponse("Missing secret or name", context: context)
            return
        }
        
        // Store secret securely
        let secrets = loadSecrets()
        var updatedSecrets = secrets
        updatedSecrets[name] = secret
        saveSecrets(updatedSecrets)
        
        sendSuccessResponse(["added": true], context: context)
    }
    
    private func handleGetSecrets(context: NSExtensionContext) {
        let secrets = loadSecrets()
        let secretsList = secrets.map { ["name": $0.key, "secret": $0.value] }
        
        sendSuccessResponse(["secrets": secretsList], context: context)
    }
    
    // MARK: - Secret Management
    private func loadSecrets() -> [String: String] {
        let userDefaults = UserDefaults(suiteName: "group.com.historysync")!
        return userDefaults.dictionary(forKey: "sharedSecrets") as? [String: String] ?? [:]
    }
    
    private func saveSecrets(_ secrets: [String: String]) {
        let userDefaults = UserDefaults(suiteName: "group.com.historysync")!
        userDefaults.set(secrets, forKey: "sharedSecrets")
    }
    
    // MARK: - Response Helpers
    private func sendSuccessResponse(_ data: [String: Any], context: NSExtensionContext) {
        let responseData: [String: Any] = ["success": true, "data": data]
        sendResponse(responseData, context: context)
    }
    
    private func sendErrorResponse(_ error: String, context: NSExtensionContext) {
        let responseData: [String: Any] = ["success": false, "error": error]
        sendResponse(responseData, context: context)
    }
    
    private func sendResponse(_ data: [String: Any], context: NSExtensionContext) {
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: data ]
        } else {
            response.userInfo = [ "message": data ]
        }
        
        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
}
