/**
 * HistorySyncManager.swift
 * Manages browsing history tracking and P2P synchronization
 * 
 * Features:
 * - Tracks browsing history from Safari
 * - Syncs history across devices via WebRTC
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

// MARK: - Device Info
struct DeviceInfo: Codable {
    let id: String
    let name: String
    let type: String // "ios", "chrome", "native"
    let lastSeen: Date
    var isConnected: Bool
}

// MARK: - HistorySyncManagerDelegate
protocol HistorySyncManagerDelegate: AnyObject {
    func historySyncManager(_ manager: HistorySyncManager, didUpdateHistory entries: [HistoryEntry])
    func historySyncManager(_ manager: HistorySyncManager, didUpdateDevices devices: [DeviceInfo])
    func historySyncManager(_ manager: HistorySyncManager, didEncounterError error: Error)
}

// MARK: - HistorySyncManager
class HistorySyncManager: NSObject {
    
    // MARK: - Properties
    weak var delegate: HistorySyncManagerDelegate?
    
    private let deviceId: String
    private let deviceName: String
    private var webRTCManager: WebRTCManager?
    
    // History storage
    private var historyEntries: Set<HistoryEntry> = []
    private var connectedDevices: [String: DeviceInfo] = [:]
    
    // Persistence
    private let historyStorageKey = "com.historysync.history"
    private let devicesStorageKey = "com.historysync.devices"
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
    func connect(roomId: String, sharedSecret: String, signalingServerURL: URL) {
        let peerId = "\(deviceId)-\(UUID().uuidString.prefix(8))"
        
        webRTCManager = WebRTCManager(
            peerId: peerId,
            roomId: roomId,
            sharedSecret: sharedSecret,
            signalingServerURL: signalingServerURL
        )
        
        webRTCManager?.delegate = self
        webRTCManager?.connect()
        
        // Send device info when connected
        sendDeviceInfo()
    }
    
    func disconnect() {
        webRTCManager?.disconnect()
        webRTCManager = nil
        
        // Mark all devices as disconnected
        syncQueue.async(flags: .barrier) {
            self.connectedDevices.values.forEach { device in
                var updatedDevice = device
                updatedDevice.isConnected = false
                self.connectedDevices[device.id] = updatedDevice
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
    func getConnectedDevices() -> [DeviceInfo] {
        return syncQueue.sync {
            Array(connectedDevices.values).filter { $0.isConnected }
        }
    }
    
    func getAllKnownDevices() -> [DeviceInfo] {
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
           let decodedDevices = try? JSONDecoder().decode([String: DeviceInfo].self, from: devicesData) {
            syncQueue.async(flags: .barrier) {
                self.connectedDevices = decodedDevices
                // Mark all as disconnected initially
                self.connectedDevices.values.forEach { device in
                    var updatedDevice = device
                    updatedDevice.isConnected = false
                    self.connectedDevices[device.id] = updatedDevice
                }
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
        let deviceInfo = DeviceInfo(
            id: deviceId,
            name: deviceName,
            type: "ios",
            lastSeen: Date(),
            isConnected: true
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
        
        webRTCManager?.sendData(messageData, to: peerId)
    }
    
    // MARK: - Sync Message Handling
    private func handleSyncMessage(_ data: Data, from peerId: String) {
        guard let message = try? JSONDecoder().decode(SyncMessage.self, from: data) else {
            os_log(.error, log: logger, "Failed to decode sync message")
            return
        }
        
        switch message.type {
        case .deviceInfo:
            handleDeviceInfo(message)
            
        case .fullSync:
            handleFullSync(message)
            
        case .incrementalUpdate:
            handleIncrementalUpdate(message)
            
        case .syncRequest:
            // Peer is requesting our full history
            sendFullSync(to: peerId)
        }
    }
    
    private func handleDeviceInfo(_ message: SyncMessage) {
        guard let data = message.data,
              let deviceInfo = try? JSONDecoder().decode(DeviceInfo.self, from: data) else { return }
        
        syncQueue.async(flags: .barrier) {
            var info = deviceInfo
            info.isConnected = true
            self.connectedDevices[info.id] = info
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

// MARK: - WebRTCManagerDelegate
extension HistorySyncManager: WebRTCManagerDelegate {
    func webRTCManager(_ manager: WebRTCManager, didReceiveData data: Data, from peerId: String) {
        handleSyncMessage(data, from: peerId)
    }
    
    func webRTCManager(_ manager: WebRTCManager, didConnectPeer peerId: String) {
        os_log(.info, log: logger, "Connected to peer: %@", peerId)
        
        // Request full sync from new peer
        sendSyncRequest(to: peerId)
        
        // Send our device info
        sendDeviceInfo()
    }
    
    func webRTCManager(_ manager: WebRTCManager, didDisconnectPeer peerId: String) {
        os_log(.info, log: logger, "Disconnected from peer: %@", peerId)
        
        // Update device connection status
        syncQueue.async(flags: .barrier) {
            for (deviceId, var device) in self.connectedDevices {
                if peerId.hasPrefix(deviceId) {
                    device.isConnected = false
                    self.connectedDevices[deviceId] = device
                    break
                }
            }
            self.saveDevicesToPersistence()
        }
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didUpdateDevices: self.getAllKnownDevices())
        }
    }
    
    func webRTCManager(_ manager: WebRTCManager, didEncounterError error: Error) {
        os_log(.error, log: logger, "WebRTC error: %@", error.localizedDescription)
        
        DispatchQueue.main.async {
            self.delegate?.historySyncManager(self, didEncounterError: error)
        }
    }
}