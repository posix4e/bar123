/**
 * SafariWebExtensionHandler-Enhanced.swift
 * Enhanced handler that manages ALL business logic, configuration, and state
 * JavaScript only handles browser APIs and display
 */

import SafariServices
import os.log

class SafariWebExtensionHandlerEnhanced: NSObject, NSExtensionRequestHandling {
    
    // MARK: - Properties
    private static let historySyncManager = HistorySyncManager()
    private static let configManager = ConfigurationManager()
    private static let discoveryManager = DiscoveryManager()
    private let logger = OSLog(subsystem: "com.bar123", category: "SafariExtensionHandler")
    
    // MARK: - Message Types
    enum MessageType: String {
        // History
        case trackVisit = "track_visit"
        case search = "search"
        case getHistory = "get_history"
        
        // Connection
        case connect = "connect"
        case disconnect = "disconnect"
        case getConnectionStatus = "get_connection_status"
        case createConnectionOffer = "create_connection_offer"
        case processConnection = "process_connection"
        case getConnectionStats = "get_connection_stats"
        
        // Configuration
        case getConfig = "get_config"
        case updateConfig = "update_config"
        case openSettings = "open_settings"
        
        // Devices
        case getDevices = "get_devices"
    }
    
    // MARK: - Extension Request Handling
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        
        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }
        
        os_log(.default, log: logger, "Received message: %@", String(describing: message))
        
        // Process the message
        if let messageDict = message as? [String: Any] {
            handleMessage(messageDict, context: context)
        } else {
            sendErrorResponse("Invalid message format", context: context)
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
        // History
        case .trackVisit:
            handleTrackVisit(message, context: context)
        case .search:
            handleSearch(message, context: context)
        case .getHistory:
            handleGetHistory(message, context: context)
            
        // Connection
        case .connect:
            handleConnect(message, context: context)
        case .disconnect:
            handleDisconnect(context: context)
        case .getConnectionStatus:
            handleGetConnectionStatus(context: context)
        case .createConnectionOffer:
            handleCreateConnectionOffer(context: context)
        case .processConnection:
            handleProcessConnection(message, context: context)
        case .getConnectionStats:
            handleGetConnectionStats(context: context)
            
        // Configuration
        case .getConfig:
            handleGetConfig(context: context)
        case .updateConfig:
            handleUpdateConfig(message, context: context)
        case .openSettings:
            handleOpenSettings(context: context)
            
        // Devices
        case .getDevices:
            handleGetDevices(context: context)
        }
    }
    
    // MARK: - History Handlers
    private func handleTrackVisit(_ message: [String: Any], context: NSExtensionContext) {
        guard let data = message["data"] as? [String: Any],
              let url = data["url"] as? String else {
            sendErrorResponse("Missing visit data", context: context)
            return
        }
        
        let title = data["title"] as? String
        let _ = data["timestamp"] as? TimeInterval ?? Date().timeIntervalSince1970
        
        Self.historySyncManager.trackVisit(
            url: url,
            title: title
        )
        
        sendSuccessResponse([:], context: context)
    }
    
    private func handleSearch(_ message: [String: Any], context: NSExtensionContext) {
        guard let query = message["query"] as? String else {
            sendErrorResponse("Missing search query", context: context)
            return
        }
        
        let results = Self.historySyncManager.searchHistory(query: query)
        let encodedResults = results.prefix(10).map { encodeHistoryEntry($0) }
        
        sendSuccessResponse(["results": encodedResults], context: context)
    }
    
    private func handleGetHistory(_ message: [String: Any], context: NSExtensionContext) {
        let _ = message["limit"] as? Int ?? 100
        let deviceId = message["deviceId"] as? String
        
        let history = Self.historySyncManager.getHistory(for: deviceId)
        let encodedHistory = history.map { encodeHistoryEntry($0) }
        
        sendSuccessResponse(["history": encodedHistory], context: context)
    }
    
    // MARK: - Connection Handlers
    private func handleConnect(_ message: [String: Any], context: NSExtensionContext) {
        Task {
            do {
                let config = Self.configManager.currentConfig
                
                // Use the appropriate connection method based on discovery type
                switch config.discoveryMethod {
                case "websocket":
                    try await Self.historySyncManager.connect(
                        roomId: config.roomId ?? "",
                        sharedSecret: config.sharedSecret ?? "",
                        signalingServerURL: URL(string: config.signalingServerUrl ?? "")!
                    )
                case "stun-only":
                    try await Self.historySyncManager.connectSTUNOnly(stunServers: config.stunServers)
                case "cloudflare-dns":
                    let cloudflareMethod = DiscoveryManager.DiscoveryMethod.cloudflareDNS(
                        apiToken: config.cloudflareApiToken ?? "",
                        zoneId: config.cloudflareZoneId ?? "",
                        domain: config.cloudflareDomain ?? "",
                        roomId: config.cloudflareRoomId ?? ""
                    )
                    try await Self.historySyncManager.connect(discoveryMethod: cloudflareMethod)
                default:
                    throw ConfigError.invalidDiscoveryMethod
                }
                
                Self.configManager.setConnected(true)
                sendSuccessResponse(["connected": true], context: context)
            } catch {
                sendErrorResponse("Connection failed: \(error.localizedDescription)", context: context)
            }
        }
    }
    
    private func handleDisconnect(context: NSExtensionContext) {
        Task {
            await Self.historySyncManager.disconnect()
            Self.configManager.setConnected(false)
            sendSuccessResponse(["disconnected": true], context: context)
        }
    }
    
    private func handleGetConnectionStatus(context: NSExtensionContext) {
        let isConnected = Self.configManager.isConnected
        let connectedDevices = Self.historySyncManager.getConnectedDevices()
        
        sendSuccessResponse([
            "connected": isConnected,
            "peerCount": connectedDevices.count,
            "peers": connectedDevices.map { ["id": $0.id, "name": $0.name] }
        ], context: context)
    }
    
    private func handleCreateConnectionOffer(context: NSExtensionContext) {
        // TODO: Implement connection offer creation for STUN-only mode
        // This requires WebRTCManager to expose offer creation methods
        sendErrorResponse("Connection offers not yet implemented", context: context)
    }
    
    private func handleProcessConnection(_ message: [String: Any], context: NSExtensionContext) {
        // TODO: Implement connection processing for STUN-only mode
        // This requires WebRTCManager to expose offer/answer processing methods
        sendErrorResponse("Connection processing not yet implemented", context: context)
    }
    
    private func handleGetConnectionStats(context: NSExtensionContext) {
        // TODO: Implement connection statistics
        // For now, return basic stats based on connected devices
        let connectedDevices = Self.historySyncManager.getConnectedDevices()
        
        sendSuccessResponse([
            "stats": [
                "active": connectedDevices.count,
                "total": connectedDevices.count,
                "messagesSent": 0,
                "messagesReceived": 0,
                "peers": connectedDevices.map { device in
                    [
                        "id": device.id,
                        "name": device.name,
                        "state": "connected",
                        "connectedAt": ISO8601DateFormatter().string(from: device.lastSeen)
                    ]
                }
            ]
        ], context: context)
    }
    
    // MARK: - Configuration Handlers
    private func handleGetConfig(context: NSExtensionContext) {
        let config = Self.configManager.currentConfig
        
        sendSuccessResponse([
            "config": [
                "discoveryMethod": config.discoveryMethod,
                "signalingServerUrl": config.signalingServerUrl ?? "",
                "roomId": config.roomId ?? "",
                "sharedSecret": config.sharedSecret ?? "",
                "stunServers": config.stunServers ?? [],
                "cloudflareDomain": config.cloudflareDomain ?? "",
                "cloudflareZoneId": config.cloudflareZoneId ?? "",
                "cloudflareApiToken": config.cloudflareApiToken ?? "",
                "cloudflareRoomId": config.cloudflareRoomId ?? "",
                "isConnected": Self.configManager.isConnected
            ]
        ], context: context)
    }
    
    private func handleUpdateConfig(_ message: [String: Any], context: NSExtensionContext) {
        guard let config = message["config"] as? [String: Any] else {
            sendErrorResponse("Missing configuration", context: context)
            return
        }
        
        do {
            try Self.configManager.updateConfig(config)
            sendSuccessResponse(["updated": true], context: context)
        } catch {
            sendErrorResponse("Failed to update config: \(error.localizedDescription)", context: context)
        }
    }
    
    private func handleOpenSettings(context: NSExtensionContext) {
        // Notify the iOS app to open settings
        NotificationCenter.default.post(name: .openSettings, object: nil)
        sendSuccessResponse(["opened": true], context: context)
    }
    
    // MARK: - Device Handlers
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
    
    // MARK: - Helper Methods
    private func encodeHistoryEntry(_ entry: HistoryEntry) -> [String: Any] {
        return [
            "id": entry.id.uuidString,
            "url": entry.url,
            "title": entry.title ?? "Untitled",
            "visitDate": entry.visitDate.timeIntervalSince1970 * 1000,
            "deviceId": entry.deviceId,
            "deviceName": entry.deviceName
        ]
    }
    
    // MARK: - Response Helpers
    private func sendSuccessResponse(_ data: [String: Any], context: NSExtensionContext) {
        var responseData: [String: Any] = ["success": true]
        data.forEach { responseData[$0.key] = $0.value }
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

// MARK: - Configuration Manager
class ConfigurationManager {
    private let userDefaults = UserDefaults(suiteName: "group.com.bar123")!
    
    struct Config {
        var discoveryMethod: String = "websocket"
        var signalingServerUrl: String?
        var roomId: String?
        var sharedSecret: String?
        var stunServers: [String]?
        var cloudflareDomain: String?
        var cloudflareZoneId: String?
        var cloudflareApiToken: String?
        var cloudflareRoomId: String?
    }
    
    var currentConfig: Config {
        var config = Config()
        config.discoveryMethod = userDefaults.string(forKey: "discoveryMethod") ?? "websocket"
        config.signalingServerUrl = userDefaults.string(forKey: "signalingServerUrl")
        config.roomId = userDefaults.string(forKey: "roomId")
        config.sharedSecret = userDefaults.string(forKey: "sharedSecret")
        config.stunServers = userDefaults.stringArray(forKey: "stunServers")
        config.cloudflareDomain = userDefaults.string(forKey: "cloudflareDomain")
        config.cloudflareZoneId = userDefaults.string(forKey: "cloudflareZoneId")
        config.cloudflareApiToken = userDefaults.string(forKey: "cloudflareApiToken")
        config.cloudflareRoomId = userDefaults.string(forKey: "cloudflareRoomId")
        return config
    }
    
    var isConnected: Bool {
        return userDefaults.bool(forKey: "isConnected")
    }
    
    func setConnected(_ connected: Bool) {
        userDefaults.set(connected, forKey: "isConnected")
    }
    
    func updateConfig(_ configDict: [String: Any]) throws {
        configDict.forEach { key, value in
            userDefaults.set(value, forKey: key)
        }
        userDefaults.synchronize()
    }
}

// MARK: - Helper Classes
class ConnectionShareHelper {
    struct ConnectionData {
        let isOffer: Bool
        let deviceName: String
        let data: String
        let timestamp: Date
    }
    
    struct ShareData {
        let encoded: String
        let link: String
        let shareText: String
    }
    
    func createShareableOffer(_ offer: String) -> ShareData {
        // Implementation for creating shareable offer
        let encoded = Data(offer.utf8).base64EncodedString()
        let link = "https://bar123.app/connect#\(encoded)"
        let shareText = """
        🔗 History Sync Connection Request
        From: \(UIDevice.current.name)
        
        To connect, either:
        1. Click this link: \(link)
        2. Or copy and paste this code:
        
        \(encoded)
        """
        
        return ShareData(encoded: encoded, link: link, shareText: shareText)
    }
    
    func createShareableResponse(_ response: String) -> ShareData {
        // Similar implementation for response
        let encoded = Data(response.utf8).base64EncodedString()
        let shareText = """
        ✅ History Sync Connection Response
        From: \(UIDevice.current.name)
        
        Copy and send this back:
        
        \(encoded)
        """
        
        return ShareData(encoded: encoded, link: "", shareText: shareText)
    }
    
    func parseConnectionData(_ data: String) throws -> ConnectionData {
        // Parse the connection data
        guard let decoded = Data(base64Encoded: data),
              let json = try? JSONSerialization.jsonObject(with: decoded) as? [String: Any] else {
            throw ConfigError.invalidConnectionData
        }
        
        return ConnectionData(
            isOffer: json["type"] as? String == "offer",
            deviceName: json["deviceName"] as? String ?? "Unknown",
            data: json["data"] as? String ?? "",
            timestamp: Date()
        )
    }
}

// MARK: - Errors
enum ConfigError: LocalizedError {
    case invalidDiscoveryMethod
    case invalidConnectionData
    
    var errorDescription: String? {
        switch self {
        case .invalidDiscoveryMethod:
            return "Invalid discovery method"
        case .invalidConnectionData:
            return "Invalid connection data"
        }
    }
}

// MARK: - Notifications
extension Notification.Name {
    static let openSettings = Notification.Name("openSettings")
}