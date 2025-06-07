import Foundation
import CryptoKit
import UIKit

// MARK: - Models

struct HistoryItem: Codable {
    let url: String
    let title: String
    let visitTime: Date
    let visitCount: Int
    let deviceId: String
    var deviceInfo: DeviceInfo
}

struct DeviceInfo: Codable {
    let name: String
    let model: String
    let osVersion: String
}

struct HistorySyncData: Codable {
    let version: String
    let deviceId: String
    let historyItems: [HistoryItem]
    let lastSyncTime: Date
}

// MARK: - TorrentManager

class TorrentManager {
    private let sharedSecret: String
    private let deviceId: String
    private var syncTimer: Timer?
    
    // File paths
    private let documentsDirectory: URL
    private let torrentDataPath: URL
    private let historyStorePath: URL
    
    // P2P manager for peer-to-peer sync
    private let p2pManager: LegacyP2PManager
    private var syncedPeers: Set<String> = []
    
    init(sharedSecret: String) {
        self.sharedSecret = sharedSecret
        self.deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        
        // Setup file paths
        self.documentsDirectory = FileManager.default.urls(for: .documentDirectory, 
                                                          in: .userDomainMask).first!
        self.torrentDataPath = documentsDirectory.appendingPathComponent("TorrentData")
        self.historyStorePath = documentsDirectory.appendingPathComponent("HistoryStore")
        
        // Initialize P2P manager
        self.p2pManager = LegacyP2PManager(sharedSecret: sharedSecret)
        
        // Create directories if needed
        try? FileManager.default.createDirectory(at: torrentDataPath, 
                                                withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: historyStorePath, 
                                                withIntermediateDirectories: true)
        
        // Setup P2P callbacks
        setupP2PCallbacks()
    }
    
    // MARK: - Public Methods
    
    func startSync() {
        print("[TorrentManager] Starting sync with device ID: \(deviceId)")
        
        // Start P2P discovery
        p2pManager.startDiscovery()
        
        // Start periodic sync
        syncTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            Task {
                await self.performSync()
            }
        }
        
        // Initial sync after a short delay to allow peer discovery
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            await performSync()
        }
    }
    
    func stopSync() {
        syncTimer?.invalidate()
        syncTimer = nil
        
        // Stop P2P connections
        p2pManager.stop()
        
        print("[TorrentManager] Stopped sync")
    }
    
    func addHistoryItem(_ item: HistoryItem) async throws {
        // Load current history
        var history = try await loadLocalHistory()
        history.append(item)
        
        // Save updated history
        try await saveLocalHistory(history)
        
        // Trigger sync
        await performSync()
    }
    
    func searchHistory(query: String) async throws -> [HistoryItem] {
        // Search both local and synced history
        let allHistory = try await loadAllHistory()
        
        return allHistory.filter { item in
            item.url.localizedCaseInsensitiveContains(query) ||
            item.title.localizedCaseInsensitiveContains(query)
        }
    }
    
    func getAllDevices() async throws -> [DeviceInfo] {
        // Get all unique devices from synced history
        let allHistory = try await loadAllHistory()
        let deviceInfos = Set(allHistory.map { $0.deviceInfo })
        return Array(deviceInfos)
    }
    
    // MARK: - Private Methods
    
    func performSync() async {
        do {
            // 1. Prepare our history data for sharing
            let syncData = try await prepareSyncData()
            
            // 2. Create and serialize the data
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let jsonData = try encoder.encode(syncData)
            
            // 3. Broadcast to all connected peers
            p2pManager.broadcast(jsonData)
            
            print("[TorrentManager] Broadcasted sync data to peers")
        } catch {
            print("[TorrentManager] Sync error: \(error)")
        }
    }
    
    private func setupP2PCallbacks() {
        // Handle data received from peers
        p2pManager.onDataReceived = { [weak self] data, peerId in
            Task {
                await self?.handleReceivedSyncData(data, from: peerId)
            }
        }
        
        // Handle peer connections
        p2pManager.onPeerConnected = { [weak self] peerId in
            print("[TorrentManager] Peer connected: \(peerId)")
            self?.syncedPeers.insert(peerId)
            
            // Send our current data to the new peer
            Task {
                await self?.performSync()
            }
        }
        
        p2pManager.onPeerDisconnected = { [weak self] peerId in
            print("[TorrentManager] Peer disconnected: \(peerId)")
            self?.syncedPeers.remove(peerId)
        }
    }
    
    private func prepareSyncData() async throws -> HistorySyncData {
        let history = try await loadLocalHistory()
        let deviceInfo = await DeviceInfo(
            name: UIDevice.current.name,
            model: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion
        )
        
        // Update device info for all items
        let updatedHistory = history.map { item in
            var newItem = item
            newItem.deviceInfo = deviceInfo
            return newItem
        }
        
        return HistorySyncData(
            version: "1.0",
            deviceId: deviceId,
            historyItems: updatedHistory,
            lastSyncTime: Date()
        )
    }
    
    private func handleReceivedSyncData(_ data: Data, from peerId: String) async {
        do {
            // 1. Decode the sync data
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let syncData = try decoder.decode(HistorySyncData.self, from: data)
            
            print("[TorrentManager] Received \(syncData.historyItems.count) items from \(peerId)")
            
            // 2. Merge with our history
            await mergeHistoryFromPeer(syncData)
            
        } catch {
            print("[TorrentManager] Failed to decode sync data from \(peerId): \(error)")
        }
    }
    
    private func mergeHistoryFromPeer(_ peerData: HistorySyncData) async {
        // Load all history (including from other peers)
        let allHistory = (try? await loadAllHistory()) ?? []
        
        // Create a dictionary for efficient lookup
        var historyDict = Dictionary(uniqueKeysWithValues: allHistory.map { ($0.url + "_" + $0.deviceId, $0) })
        
        // Merge peer's history
        for item in peerData.historyItems {
            let key = item.url + "_" + item.deviceId
            
            if let existingItem = historyDict[key] {
                // Update if peer's version is newer
                if item.visitTime > existingItem.visitTime {
                    historyDict[key] = item
                }
            } else {
                // Add new item
                historyDict[key] = item
            }
        }
        
        // Save merged history for this peer
        let peerHistoryFile = historyStorePath.appendingPathComponent("\(peerData.deviceId).json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        if let data = try? encoder.encode(peerData.historyItems) {
            try? data.write(to: peerHistoryFile)
        }
        
        print("[TorrentManager] Merged history from peer \(peerData.deviceId)")
    }
    
    private func loadLocalHistory() async throws -> [HistoryItem] {
        let historyFile = historyStorePath.appendingPathComponent("\(deviceId).json")
        
        guard FileManager.default.fileExists(atPath: historyFile.path) else {
            return []
        }
        
        let data = try Data(contentsOf: historyFile)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([HistoryItem].self, from: data)
    }
    
    private func saveLocalHistory(_ history: [HistoryItem]) async throws {
        let historyFile = historyStorePath.appendingPathComponent("\(deviceId).json")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(history)
        
        try data.write(to: historyFile)
    }
    
    private func loadAllHistory() async throws -> [HistoryItem] {
        var allHistory: [HistoryItem] = []
        
        // Load history from all devices
        let historyFiles = try FileManager.default.contentsOfDirectory(
            at: historyStorePath,
            includingPropertiesForKeys: nil
        )
        
        for file in historyFiles where file.pathExtension == "json" {
            let data = try Data(contentsOf: file)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let history = try decoder.decode([HistoryItem].self, from: data)
            allHistory.append(contentsOf: history)
        }
        
        // Sort by visit time, newest first
        allHistory.sort { $0.visitTime > $1.visitTime }
        
        return allHistory
    }
}

// MARK: - DeviceInfo Hashable

extension DeviceInfo: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(name)
        hasher.combine(model)
        hasher.combine(osVersion)
    }
    
    static func == (lhs: DeviceInfo, rhs: DeviceInfo) -> Bool {
        lhs.name == rhs.name && 
        lhs.model == rhs.model && 
        lhs.osVersion == rhs.osVersion
    }
}