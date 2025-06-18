//
//  Models.swift
//  Bar123Core
//
//  Shared data models for bar123
//

import Foundation

// MARK: - History Entry

public struct HistoryEntry: Codable, Equatable, Identifiable {
    public let id: String
    public let url: String
    public let title: String?
    public let visitDate: Date
    public let deviceId: String
    public let deviceName: String
    
    public init(
        id: String = UUID().uuidString,
        url: String,
        title: String?,
        visitDate: Date = Date(),
        deviceId: String,
        deviceName: String
    ) {
        self.id = id
        self.url = url
        self.title = title
        self.visitDate = visitDate
        self.deviceId = deviceId
        self.deviceName = deviceName
    }
}

// MARK: - Device Info

public struct DeviceInfo: Codable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let type: DeviceType
    public let lastSeen: Date
    public let isConnected: Bool
    
    public enum DeviceType: String, Codable {
        case ios = "ios"
        case chrome = "chrome"
        case safari = "safari"
        case cli = "cli"
        case unknown = "unknown"
    }
    
    public init(
        id: String,
        name: String,
        type: DeviceType,
        lastSeen: Date = Date(),
        isConnected: Bool = true
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.lastSeen = lastSeen
        self.isConnected = isConnected
    }
}

// MARK: - Peer Info

public struct PeerInfo: Codable, Equatable {
    public let id: String
    public let name: String
    public let type: String
    public let timestamp: TimeInterval
    
    public init(id: String, name: String, type: String, timestamp: Date = Date()) {
        self.id = id
        self.name = name
        self.type = type
        self.timestamp = timestamp.timeIntervalSince1970
    }
}

// MARK: - Sync Messages

public enum SyncMessageType: String, Codable {
    case deviceInfo = "device_info"
    case fullSync = "full_sync"
    case incrementalUpdate = "incremental_update"
    case syncRequest = "sync_request"
}

public struct SyncMessage: Codable {
    public let type: SyncMessageType
    public let timestamp: Date
    public let deviceId: String
    public let data: Data?
    
    public init(type: SyncMessageType, deviceId: String, data: Encodable? = nil) {
        self.type = type
        self.timestamp = Date()
        self.deviceId = deviceId
        
        if let data = data {
            self.data = try? JSONEncoder().encode(data)
        } else {
            self.data = nil
        }
    }
    
    public func decode<T: Decodable>(_ type: T.Type) throws -> T? {
        guard let data = data else { return nil }
        return try JSONDecoder().decode(type, from: data)
    }
}

// MARK: - Configuration

public struct CloudflareConfig: Codable {
    public let apiToken: String
    public let zoneId: String
    public let domain: String
    public let roomId: String
    public let recordPrefix: String
    public let ttl: Int
    
    public init(
        apiToken: String,
        zoneId: String,
        domain: String,
        roomId: String,
        recordPrefix: String = "_p2psync",
        ttl: Int = 120
    ) {
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.roomId = roomId
        self.recordPrefix = recordPrefix
        self.ttl = ttl
    }
}

// MARK: - Storage

public protocol HistoryStorage {
    func save(_ entries: [HistoryEntry]) async throws
    func load() async throws -> [HistoryEntry]
    func search(query: String) async throws -> [HistoryEntry]
    func deleteAll() async throws
}

// MARK: - File-based Storage

public class FileHistoryStorage: HistoryStorage {
    private let fileURL: URL
    
    public init(directory: URL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!) {
        self.fileURL = directory.appendingPathComponent("bar123_history.json")
    }
    
    public func save(_ entries: [HistoryEntry]) async throws {
        let data = try JSONEncoder().encode(entries)
        try data.write(to: fileURL)
    }
    
    public func load() async throws -> [HistoryEntry] {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return []
        }
        
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode([HistoryEntry].self, from: data)
    }
    
    public func search(query: String) async throws -> [HistoryEntry] {
        let entries = try await load()
        let lowercased = query.lowercased()
        
        return entries.filter { entry in
            entry.url.lowercased().contains(lowercased) ||
            (entry.title?.lowercased().contains(lowercased) ?? false)
        }
    }
    
    public func deleteAll() async throws {
        try FileManager.default.removeItem(at: fileURL)
    }
}