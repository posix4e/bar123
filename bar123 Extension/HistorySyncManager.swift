/**
 * HistorySyncManager.swift
 * Manages browsing history tracking and P2P synchronization
 * 
 * Features:
 * - Tracks browsing history from Safari
 * - Syncs history across devices via serverless P2P
 * - Handles conflict resolution
 * - Provides search functionality
 * - Manages device information
 */

import Foundation
import SafariServices
import os.log

// MARK: - History Entry Model
struct HistoryEntry: Codable, Hashable {
    let id: UUID
    let url: String
    let title: String?
    let visitDate: Date
    let deviceId: String
    let deviceName: String
    
    init(url: String, title: String?, deviceId: String, deviceName: String) {
        self.id = UUID()
        self.url = url
        self.title = title
        self.visitDate = Date()
        self.deviceId = deviceId
        self.deviceName = deviceName
    }
}

// MARK: - Sync Message Types
enum SyncMessageType: String, Codable {
    case fullSync = "full_sync"
    case incrementalUpdate = "incremental_update"
    case syncRequest = "sync_request"
    case deviceInfo = "device_info"
}

struct SyncMessage: Codable {
    let type: SyncMessageType
    let timestamp: Date
    let deviceId: String
    let data: Data?
}

// MARK: - Device Info (using from P2PConnectionManager)
typealias P2PDeviceInfo = DeviceInfo

// MARK: - HistorySyncManagerDelegate
protocol HistorySyncManagerDelegate: AnyObject {
    func historySyncManager(_ manager: HistorySyncManager, didUpdateHistory entries: [HistoryEntry])
    func historySyncManager(_ manager: HistorySyncManager, didUpdateDevices devices: [P2PDeviceInfo])
    func historySyncManager(_ manager: HistorySyncManager, didEncounterError error: Error)
}

// MARK: - HistorySyncManager
class HistorySyncManager: NSObject {
    
    // MARK: - Properties
    weak var delegate: HistorySyncManagerDelegate?
    
    private let deviceId: String
    private let deviceName: String
    private var p2pManager: P2PConnectionManager?
    
    // History storage
    private var historyEntries: Set<HistoryEntry> = []
    private var connectedDevices: [String: P2PDeviceInfo] = [:]
    
    // Persistence
    private let historyStorageKey = "com.historysync.history"
    private let devicesStorageKey = "com.historysync.devices"
    private let sharedSecretKey = "com.historysync.sharedSecret"
    private let userDefaults = UserDefaults(suiteName: "group.com.historysync")!
    
    // Sync state
    private var lastSyncTimestamp: Date?
    private let syncQueue = DispatchQueue(label: "com.historysync.sync", attributes: .concurrent)
    
    private let logger = OSLog(subsystem: "com.historysync", category: "HistorySyncManager")
    
    // MARK: - Initialization
    override init() {
        self.deviceId = Self.getOrCreateDeviceId()
        self.deviceName = UIDevice.current.name
        
        super.init()
        
        loadPersistedData()
    }
    
    private static func getOrCreateDeviceId() -> String {
        let key = "com.historysync.deviceId"
        if let existingId = UserDefaults.standard.string(forKey: key) {
            return existingId
        }
        
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: key)
        return newId
    }
    
    // MARK: - Connection Management
    func initializeP2P() {
        // Get or create shared secret
        let sharedSecret = getOrCreateSharedSecret()
        
        let deviceInfo = P2PDeviceInfo(name: deviceName, type: "ios")
        
        p2pManager = P2PConnectionManager(
            deviceId: deviceId,
            deviceInfo: deviceInfo,
            sharedSecret: sharedSecret
        )
        
        p2pManager?.delegate = self
    }
    
    private func getOrCreateSharedSecret() -> String {
        if let existing = userDefaults.string(forKey: sharedSecretKey) {
            return existing
        }
        
        let newSecret = P2PConnectionManager.generateSharedSecret()
        userDefaults.set(newSecret, forKey: sharedSecretKey)
        return newSecret
    }
    
    func updateSharedSecret(_ secret: String) {
        userDefaults.set(secret, forKey: sharedSecretKey)
        p2pManager?.sharedSecret = secret
    }
    
    // Connection methods for QR code flow
    func createConnectionOffer(completion: @escaping (Result<String, Error>) -> Void) {
        guard let p2pManager = p2pManager else {
            completion(.failure(NSError(domain: "HistorySync", code: 1, userInfo: [NSLocalizedDescriptionKey: "P2P manager not initialized"])))
            return
        }
        
        p2pManager.createConnectionOffer(completion: completion)
    }
    
    func processConnectionOffer(_ offer: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard let p2pManager = p2pManager else {
            completion(.failure(NSError(domain: "HistorySync", code: 1, userInfo: [NSLocalizedDescriptionKey: "P2P manager not initialized"])))
            return
        }
        
        p2pManager.processConnectionOffer(offer, completion: completion)
    }
    
    func completeConnection(_ answer: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let p2pManager = p2pManager else {
            completion(.failure(NSError(domain: "HistorySync", code: 1, userInfo: [NSLocalizedDescriptionKey: "P2P manager not initialized"])))
            return
        }
        
        p2pManager.completeConnection(answer, completion: completion)
    }
    
    func disconnect() {
        p2pManager?.disconnectAll()
        
        // Mark all devices as disconnected
        syncQueue.async(flags: .barrier) {
            for (deviceId, device) in self.connectedDevices {
                self.connectedDevices[deviceId] = P2PDeviceInfo(name: device.name, type: device.type)
            }
        }
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateDevices: Array(self.connectedDevices.values))
        }
    }
    
    // MARK: - History Tracking
    func trackVisit(url: String, title: String?) {
        let entry = HistoryEntry(
            url: url,
            title: title,
            deviceId: deviceId,
            deviceName: deviceName
        )
        
        syncQueue.async(flags: .barrier) {
            self.historyEntries.insert(entry)
            self.saveHistoryToPersistence()
        }
        
        // Send incremental update to peers
        sendIncrementalUpdate([entry])
        
        // Notify delegate
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateHistory: Array(self.historyEntries))
        }
    }
    
    // MARK: - Search
    func searchHistory(query: String) -> [HistoryEntry] {
        let lowercasedQuery = query.lowercased()
        
        return syncQueue.sync {
            historyEntries.filter { entry in
                entry.url.lowercased().contains(lowercasedQuery) ||
                (entry.title?.lowercased().contains(lowercasedQuery) ?? false)
            }
            .sorted { $0.visitDate > $1.visitDate }
        }
    }
    
    func getHistory(for deviceId: String? = nil) -> [HistoryEntry] {
        return syncQueue.sync {
            if let deviceId = deviceId {
                return historyEntries
                    .filter { $0.deviceId == deviceId }
                    .sorted { $0.visitDate > $1.visitDate }
            } else {
                return historyEntries.sorted { $0.visitDate > $1.visitDate }
            }
        }
    }
    
    // MARK: - Device Management
    func getConnectedDevices() -> [P2PDeviceInfo] {
        guard let p2pManager = p2pManager else { return [] }
        return p2pManager.getConnectedPeers().map { $0.deviceInfo }
    }
    
    func getAllKnownDevices() -> [P2PDeviceInfo] {
        return syncQueue.sync {
            Array(connectedDevices.values)
        }
    }
    
    // MARK: - Persistence
    private func loadPersistedData() {
        // Load history
        if let historyData = userDefaults.data(forKey: historyStorageKey),
           let decodedHistory = try? JSONDecoder().decode(Set<HistoryEntry>.self, from: historyData) {
            syncQueue.async(flags: .barrier) {
                self.historyEntries = decodedHistory
            }
        }
        
        // Load devices
        if let devicesData = userDefaults.data(forKey: devicesStorageKey),
           let decodedDevices = try? JSONDecoder().decode([String: P2PDeviceInfo].self, from: devicesData) {
            syncQueue.async(flags: .barrier) {
                self.connectedDevices = decodedDevices
            }
        }
    }
    
    private func saveHistoryToPersistence() {
        if let encoded = try? JSONEncoder().encode(historyEntries) {
            userDefaults.set(encoded, forKey: historyStorageKey)
        }
    }
    
    private func saveDevicesToPersistence() {
        if let encoded = try? JSONEncoder().encode(connectedDevices) {
            userDefaults.set(encoded, forKey: devicesStorageKey)
        }
    }
    
    // MARK: - Sync Protocol
    private func sendDeviceInfo() {
        let deviceInfo = P2PDeviceInfo(
            name: deviceName,
            type: "ios"
        )
        
        guard let data = try? JSONEncoder().encode(deviceInfo) else { return }
        
        let message = SyncMessage(
            type: .deviceInfo,
            timestamp: Date(),
            deviceId: deviceId,
            data: data
        )
        
        sendSyncMessage(message)
    }
    
    private func sendFullSync(to peerId: String? = nil) {
        syncQueue.sync {
            guard let data = try? JSONEncoder().encode(Array(historyEntries)) else { return }
            
            let message = SyncMessage(
                type: .fullSync,
                timestamp: Date(),
                deviceId: deviceId,
                data: data
            )
            
            sendSyncMessage(message, to: peerId)
        }
    }
    
    private func sendIncrementalUpdate(_ entries: [HistoryEntry], to peerId: String? = nil) {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        
        let message = SyncMessage(
            type: .incrementalUpdate,
            timestamp: Date(),
            deviceId: deviceId,
            data: data
        )
        
        sendSyncMessage(message, to: peerId)
    }
    
    private func sendSyncRequest(to peerId: String? = nil) {
        let message = SyncMessage(
            type: .syncRequest,
            timestamp: Date(),
            deviceId: deviceId,
            data: nil
        )
        
        sendSyncMessage(message, to: peerId)
    }
    
    private func sendSyncMessage(_ message: SyncMessage, to peerId: String? = nil) {
        guard let messageData = try? JSONEncoder().encode(message) else { return }
        
        p2pManager?.sendData(messageData, to: peerId)
    }
    
    // MARK: - Sync Message Handling
    private func handleSyncMessage(_ data: Data, from peerId: String) {
        guard let message = try? JSONDecoder().decode(SyncMessage.self, from: data) else {
            os_log(.error, log: logger, "Failed to decode sync message")
            return
        }
        
        switch message.type {
        case .deviceInfo:
            handleDeviceInfo(message, from: peerId)
            
        case .fullSync:
            handleFullSync(message)
            
        case .incrementalUpdate:
            handleIncrementalUpdate(message)
            
        case .syncRequest:
            // Peer is requesting our full history
            sendFullSync(to: peerId)
        }
    }
    
    private func handleDeviceInfo(_ message: SyncMessage, from peerId: String) {
        guard let data = message.data,
              let deviceInfo = try? JSONDecoder().decode(P2PDeviceInfo.self, from: data) else { return }
        
        syncQueue.async(flags: .barrier) {
            self.connectedDevices[peerId] = deviceInfo
            self.saveDevicesToPersistence()
        }
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateDevices: self.getAllKnownDevices())
        }
    }
    
    private func handleFullSync(_ message: SyncMessage) {
        guard let data = message.data,
              let entries = try? JSONDecoder().decode([HistoryEntry].self, from: data) else { return }
        
        syncQueue.async(flags: .barrier) {
            // Merge with existing history
            entries.forEach { self.historyEntries.insert($0) }
            self.saveHistoryToPersistence()
        }
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateHistory: Array(self.historyEntries))
        }
        
        lastSyncTimestamp = Date()
    }
    
    private func handleIncrementalUpdate(_ message: SyncMessage) {
        guard let data = message.data,
              let entries = try? JSONDecoder().decode([HistoryEntry].self, from: data) else { return }
        
        syncQueue.async(flags: .barrier) {
            // Add new entries
            entries.forEach { self.historyEntries.insert($0) }
            self.saveHistoryToPersistence()
        }
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateHistory: Array(self.historyEntries))
        }
    }
}

// MARK: - P2PConnectionManagerDelegate
extension HistorySyncManager: P2PConnectionManagerDelegate {
    func p2pManager(_ manager: P2PConnectionManager, didConnectPeer peerId: String, deviceInfo: DeviceInfo) {
        os_log(.info, log: logger, "Connected to peer: %@", peerId)
        
        // Store device info
        syncQueue.async(flags: .barrier) {
            self.connectedDevices[peerId] = deviceInfo
            self.saveDevicesToPersistence()
        }
        
        // Request full sync from new peer
        sendSyncRequest(to: peerId)
        
        // Send our device info
        sendDeviceInfo()
        
        // Update delegate
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateDevices: self.getConnectedDevices())
        }
    }
    
    func p2pManager(_ manager: P2PConnectionManager, didDisconnectPeer peerId: String) {
        os_log(.info, log: logger, "Disconnected from peer: %@", peerId)
        
        // Update delegate
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateDevices: self.getConnectedDevices())
        }
    }
    
    func p2pManager(_ manager: P2PConnectionManager, didReceiveData data: Data, from peerId: String) {
        handleSyncMessage(data, from: peerId)
    }
    
    func p2pManager(_ manager: P2PConnectionManager, didEncounterError error: Error) {
        os_log(.error, log: logger, "P2P error: %@", error.localizedDescription)
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didEncounterError: error)
        }
    }
}