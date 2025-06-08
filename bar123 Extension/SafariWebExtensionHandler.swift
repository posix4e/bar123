/**
 * SafariWebExtensionHandler.swift
 * Handles communication between Safari extension JavaScript and native iOS code
 * 
 * Features:
 * - Receives browsing history updates from JavaScript
 * - Manages serverless P2P connections via QR codes
 * - Handles search queries and device management
 * - Provides connection status to JavaScript
 */

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // MARK: - Properties
    private static let historySyncManager = HistorySyncManager()
    private let logger = OSLog(subsystem: "com.historysync", category: "SafariExtensionHandler")
    
    // MARK: - Message Types
    enum MessageType: String {
        case initializeP2P = "initialize_p2p"
        case trackVisit = "track_visit"
        case createOffer = "create_offer"
        case processOffer = "process_offer"
        case completeConnection = "complete_connection"
        case disconnect = "disconnect"
        case searchHistory = "search_history"
        case getDevices = "get_devices"
        case getHistory = "get_history"
        case updateSharedSecret = "update_shared_secret"
        case getConnectionStatus = "get_connection_status"
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
        case .initializeP2P:
            handleInitializeP2P(context: context)
            
        case .trackVisit:
            handleTrackVisit(message, context: context)
            
        case .createOffer:
            handleCreateOffer(context: context)
            
        case .processOffer:
            handleProcessOffer(message, context: context)
            
        case .completeConnection:
            handleCompleteConnection(message, context: context)
            
        case .disconnect:
            handleDisconnect(context: context)
            
        case .searchHistory:
            handleSearchHistory(message, context: context)
            
        case .getDevices:
            handleGetDevices(context: context)
            
        case .getHistory:
            handleGetHistory(message, context: context)
            
        case .updateSharedSecret:
            handleUpdateSharedSecret(message, context: context)
            
        case .getConnectionStatus:
            handleGetConnectionStatus(context: context)
        }
    }
    
    // MARK: - Message Handlers
    private func handleInitializeP2P(context: NSExtensionContext) {
        Self.historySyncManager.initializeP2P()
        sendSuccessResponse(["initialized": true], context: context)
    }
    
    private func handleTrackVisit(_ message: [String: Any], context: NSExtensionContext) {
        guard let url = message["url"] as? String else {
            sendErrorResponse("Missing URL", context: context)
            return
        }
        
        let title = message["title"] as? String
        
        Self.historySyncManager.trackVisit(url: url, title: title)
        
        sendSuccessResponse(["tracked": true], context: context)
    }
    
    private func handleCreateOffer(context: NSExtensionContext) {
        Self.historySyncManager.createConnectionOffer { result in
            switch result {
            case .success(let offer):
                self.sendSuccessResponse(["offer": offer], context: context)
            case .failure(let error):
                self.sendErrorResponse(error.localizedDescription, context: context)
            }
        }
    }
    
    private func handleProcessOffer(_ message: [String: Any], context: NSExtensionContext) {
        guard let offer = message["offer"] as? String else {
            sendErrorResponse("Missing offer", context: context)
            return
        }
        
        Self.historySyncManager.processConnectionOffer(offer) { result in
            switch result {
            case .success(let answer):
                self.sendSuccessResponse(["answer": answer], context: context)
            case .failure(let error):
                self.sendErrorResponse(error.localizedDescription, context: context)
            }
        }
    }
    
    private func handleCompleteConnection(_ message: [String: Any], context: NSExtensionContext) {
        guard let answer = message["answer"] as? String else {
            sendErrorResponse("Missing answer", context: context)
            return
        }
        
        Self.historySyncManager.completeConnection(answer) { result in
            switch result {
            case .success:
                self.sendSuccessResponse(["connected": true], context: context)
            case .failure(let error):
                self.sendErrorResponse(error.localizedDescription, context: context)
            }
        }
    }
    
    private func handleDisconnect(context: NSExtensionContext) {
        Self.historySyncManager.disconnect()
        sendSuccessResponse(["disconnected": true], context: context)
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
        let devices = Self.historySyncManager.getConnectedDevices()
        let encodedDevices = devices.map { device in
            [
                "id": "device-\(UUID().uuidString)", // Generate temporary ID
                "name": device.name,
                "type": device.type,
                "lastSeen": ISO8601DateFormatter().string(from: Date()),
                "isConnected": true
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
    
    private func handleUpdateSharedSecret(_ message: [String: Any], context: NSExtensionContext) {
        guard let secret = message["secret"] as? String else {
            sendErrorResponse("Missing secret", context: context)
            return
        }
        
        Self.historySyncManager.updateSharedSecret(secret)
        sendSuccessResponse(["updated": true], context: context)
    }
    
    private func handleGetConnectionStatus(context: NSExtensionContext) {
        let connectedDevices = Self.historySyncManager.getConnectedDevices()
        let hasSharedSecret = UserDefaults(suiteName: "group.com.historysync")?.string(forKey: "com.historysync.sharedSecret") != nil
        
        let status = [
            "connected": !connectedDevices.isEmpty,
            "hasSharedSecret": hasSharedSecret,
            "peerCount": connectedDevices.count
        ]
        
        sendSuccessResponse(status, context: context)
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