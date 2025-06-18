//
//  SyncManager.swift
//  Bar123Core
//
//  Simplified sync manager using only Cloudflare DNS
//

import Foundation

public protocol SyncManagerDelegate: AnyObject {
    func syncManager(_ manager: SyncManager, didUpdateHistory entries: [HistoryEntry])
    func syncManager(_ manager: SyncManager, didUpdateDevices devices: [DeviceInfo])
    func syncManager(_ manager: SyncManager, didUpdateConnectionStatus connected: Bool)
}

public class SyncManager {
    
    // MARK: - Properties
    
    private let config: CloudflareConfig
    private let deviceInfo: DeviceInfo
    private let storage: HistoryStorage
    private let discoveryManager: PeerDiscoveryManager
    
    public weak var delegate: SyncManagerDelegate?
    
    private var historyEntries: [HistoryEntry] = []
    private var connectedDevices: [DeviceInfo] = []
    private var isConnected = false
    
    // MARK: - Initialization
    
    public init(
        config: CloudflareConfig,
        deviceInfo: DeviceInfo,
        storage: HistoryStorage = FileHistoryStorage()
    ) {
        self.config = config
        self.deviceInfo = deviceInfo
        self.storage = storage
        
        let peerInfo = PeerInfo(
            id: deviceInfo.id,
            name: deviceInfo.name,
            type: deviceInfo.type.rawValue
        )
        
        self.discoveryManager = PeerDiscoveryManager(config: config, deviceInfo: peerInfo)
        
        setupDiscoveryHandlers()
        loadHistory()
    }
    
    // MARK: - Public Methods
    
    public func start() async throws {
        try await discoveryManager.start()
        isConnected = true
        delegate?.syncManager(self, didUpdateConnectionStatus: true)
    }
    
    public func stop() async {
        await discoveryManager.stop()
        isConnected = false
        connectedDevices.removeAll()
        delegate?.syncManager(self, didUpdateConnectionStatus: false)
        delegate?.syncManager(self, didUpdateDevices: [])
    }
    
    public func addHistoryEntry(_ entry: HistoryEntry) async throws {
        historyEntries.append(entry)
        try await storage.save(historyEntries)
        delegate?.syncManager(self, didUpdateHistory: historyEntries)
        
        // In a real implementation, this would send to peers via WebRTC
        // For now, we just save locally
    }
    
    public func searchHistory(query: String) async throws -> [HistoryEntry] {
        return try await storage.search(query: query)
    }
    
    public func exportHistory(format: ExportFormat = .json) async throws -> String {
        let entries = try await storage.load()
        
        switch format {
        case .json:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(entries)
            return String(data: data, encoding: .utf8) ?? ""
            
        case .csv:
            var csv = "id,url,title,deviceId,deviceName,visitDate\n"
            for entry in entries {
                let title = (entry.title ?? "").replacingOccurrences(of: "\"", with: "\"\"")
                let url = entry.url.replacingOccurrences(of: "\"", with: "\"\"")
                csv += "\"\(entry.id)\",\"\(url)\",\"\(title)\",\"\(entry.deviceId)\",\"\(entry.deviceName)\",\"\(ISO8601DateFormatter().string(from: entry.visitDate))\"\n"
            }
            return csv
            
        case .jsonl:
            let encoder = JSONEncoder()
            var lines: [String] = []
            for entry in entries {
                if let data = try? encoder.encode(entry),
                   let line = String(data: data, encoding: .utf8) {
                    lines.append(line)
                }
            }
            return lines.joined(separator: "\n")
        }
    }
    
    public enum ExportFormat {
        case json
        case csv
        case jsonl
    }
    
    // MARK: - Private Methods
    
    private func setupDiscoveryHandlers() {
        discoveryManager.onPeerDiscovered = { [weak self] peerId, peerInfo in
            guard let self = self else { return }
            
            let device = DeviceInfo(
                id: peerId,
                name: peerInfo.name,
                type: DeviceInfo.DeviceType(rawValue: peerInfo.type) ?? .unknown,
                lastSeen: Date(timeIntervalSince1970: peerInfo.timestamp),
                isConnected: true
            )
            
            self.connectedDevices.append(device)
            self.delegate?.syncManager(self, didUpdateDevices: self.connectedDevices)
        }
        
        discoveryManager.onPeerLost = { [weak self] peerId in
            guard let self = self else { return }
            
            self.connectedDevices.removeAll { $0.id == peerId }
            self.delegate?.syncManager(self, didUpdateDevices: self.connectedDevices)
        }
    }
    
    private func loadHistory() {
        Task {
            do {
                historyEntries = try await storage.load()
                delegate?.syncManager(self, didUpdateHistory: historyEntries)
            } catch {
                print("Failed to load history: \(error)")
            }
        }
    }
}