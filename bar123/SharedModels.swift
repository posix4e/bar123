//
//  SharedModels.swift
//  bar123
//
//  Shared data models between the main app and Safari Extension
//

import Foundation

// MARK: - History Entry
public struct HistoryEntry: Codable, Identifiable, Hashable {
    public let id: UUID
    public let url: String
    public let title: String?
    public let visitDate: Date
    public let deviceId: String
    public let deviceName: String
    
    public init(url: String, title: String?, deviceId: String, deviceName: String, visitDate: Date = Date()) {
        self.id = UUID()
        self.url = url
        self.title = title
        self.visitDate = visitDate
        self.deviceId = deviceId
        self.deviceName = deviceName
    }
}

// MARK: - Device Info
public struct DeviceInfo: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let type: String
    public var lastSeen: Date
    public var isConnected: Bool
    
    public init(id: String, name: String, type: String, isConnected: Bool = false) {
        self.id = id
        self.name = name
        self.type = type
        self.lastSeen = Date()
        self.isConnected = isConnected
    }
}

// MARK: - Performance Metrics
public struct PerformanceMetrics {
    public var connectedPeers: Int = 0
    public var totalHistoryEntries: Int = 0
    public var lastSyncTime: Date?
    public var syncRate: Double = 0.0
    public var dataTransferred: Int = 0
    
    public init() {}
}

// MARK: - Connection Status
public struct ConnectionStatus {
    public let isConnected: Bool
    public let message: String
    
    public init(isConnected: Bool, message: String) {
        self.isConnected = isConnected
        self.message = message
    }
}

// MARK: - Shared Protocol
public protocol HistorySyncManagerDelegate: AnyObject {
    func historySyncManager(_ manager: Any, didUpdateHistory entries: [HistoryEntry])
    func historySyncManager(_ manager: Any, didUpdateDevices devices: [DeviceInfo])
    func historySyncManager(_ manager: Any, didEncounterError error: Error)
}

// MARK: - Mock HistorySyncManager for compatibility
// This is a stub for the old HistorySyncViewController
public class HistorySyncManager {
    public weak var delegate: HistorySyncManagerDelegate?
    
    public init() {}
    
    public func connect(roomId: String, sharedSecret: String, signalingServerURL: URL) async throws {
        // Stub implementation
    }
    
    public func disconnect() async {
        // Stub implementation
    }
    
    public func searchHistory(query: String) -> [HistoryEntry] {
        return []
    }
    
    public func getHistory(for deviceId: String? = nil) -> [HistoryEntry] {
        return []
    }
    
    public func getDevices() -> [DeviceInfo] {
        return []
    }
}