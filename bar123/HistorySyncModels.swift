/**
 * HistorySyncModels.swift
 * Shared data models for history sync
 */

import Foundation

// MARK: - History Entry
struct HistoryEntry: Codable, Identifiable, Hashable {
    let id: UUID
    let url: String
    let title: String?
    let visitDate: Date
    let deviceId: String
    let deviceName: String
    
    init(url: String, title: String?, deviceId: String, deviceName: String, visitDate: Date = Date()) {
        self.id = UUID()
        self.url = url
        self.title = title
        self.visitDate = visitDate
        self.deviceId = deviceId
        self.deviceName = deviceName
    }
}

// MARK: - Device Info
struct DeviceInfo: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    var lastSeen: Date
    var isConnected: Bool
    
    init(id: String, name: String, type: String, isConnected: Bool = false) {
        self.id = id
        self.name = name
        self.type = type
        self.lastSeen = Date()
        self.isConnected = isConnected
    }
}

// MARK: - History Sync Manager Protocol
protocol HistorySyncManagerDelegate: AnyObject {
    func historySyncManager(_ manager: HistorySyncManager, didUpdateHistory entries: [HistoryEntry])
    func historySyncManager(_ manager: HistorySyncManager, didUpdateDevices devices: [DeviceInfo])
    func historySyncManager(_ manager: HistorySyncManager, didEncounterError error: Error)
}

// MARK: - Mock History Sync Manager
// This is a mock implementation for the main app
// The real implementation is in the Safari Extension
class HistorySyncManager {
    weak var delegate: HistorySyncManagerDelegate?
    
    private var historyEntries: [HistoryEntry] = []
    private var connectedDevices: [DeviceInfo] = []
    
    init() {
        // Load some mock data for development
        loadMockData()
    }
    
    func connect(roomId: String, sharedSecret: String, signalingServerURL: URL) async throws {
        // In the real implementation, this would establish WebRTC connections
        // For now, just simulate a connection
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.delegate?.historySyncManager(self, didUpdateDevices: self.connectedDevices)
        }
    }
    
    func disconnect() async {
        // Simulate disconnection
        connectedDevices.forEach { device in
            var updatedDevice = device
            updatedDevice.isConnected = false
            if let index = connectedDevices.firstIndex(where: { $0.id == device.id }) {
                connectedDevices[index] = updatedDevice
            }
        }
        delegate?.historySyncManager(self, didUpdateDevices: connectedDevices)
    }
    
    func searchHistory(query: String) -> [HistoryEntry] {
        let lowercasedQuery = query.lowercased()
        return historyEntries.filter { entry in
            entry.url.lowercased().contains(lowercasedQuery) ||
            (entry.title?.lowercased().contains(lowercasedQuery) ?? false)
        }
    }
    
    func getHistory(for deviceId: String? = nil) -> [HistoryEntry] {
        if let deviceId = deviceId {
            return historyEntries.filter { $0.deviceId == deviceId }
        }
        return historyEntries
    }
    
    func getDevices() -> [DeviceInfo] {
        return connectedDevices
    }
    
    private func loadMockData() {
        // Create some mock devices
        connectedDevices = [
            DeviceInfo(id: "chrome-123", name: "Chrome Browser", type: "chrome", isConnected: true),
            DeviceInfo(id: "safari-456", name: "Safari on iPhone", type: "safari", isConnected: false)
        ]
        
        // Create some mock history entries
        historyEntries = [
            HistoryEntry(
                url: "https://github.com",
                title: "GitHub: Let's build from here",
                deviceId: "chrome-123",
                deviceName: "Chrome Browser",
                visitDate: Date().addingTimeInterval(-3600)
            ),
            HistoryEntry(
                url: "https://stackoverflow.com",
                title: "Stack Overflow - Where Developers Learn",
                deviceId: "chrome-123",
                deviceName: "Chrome Browser",
                visitDate: Date().addingTimeInterval(-7200)
            ),
            HistoryEntry(
                url: "https://developer.apple.com",
                title: "Apple Developer",
                deviceId: "safari-456",
                deviceName: "Safari on iPhone",
                visitDate: Date().addingTimeInterval(-10800)
            ),
            HistoryEntry(
                url: "https://swift.org",
                title: "Swift.org - Welcome to Swift.org",
                deviceId: "safari-456",
                deviceName: "Safari on iPhone",
                visitDate: Date().addingTimeInterval(-14400)
            )
        ]
        
        // Notify delegate
        delegate?.historySyncManager(self, didUpdateHistory: historyEntries)
        delegate?.historySyncManager(self, didUpdateDevices: connectedDevices)
    }
}