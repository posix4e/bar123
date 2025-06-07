import Foundation

// MARK: - Sync Analytics

/// Tracks sync success rates and statistics
class SyncAnalytics {
    static let shared = SyncAnalytics()
    
    private var stats = SyncStats()
    private let statsQueue = DispatchQueue(label: "com.bar123.analytics", attributes: .concurrent)
    private let userDefaults = UserDefaults.standard
    
    private let statsKey = "bar123_sync_stats"
    
    private init() {
        loadStats()
    }
    
    // MARK: - Recording Events
    
    func recordSyncAttempt() {
        statsQueue.async(flags: .barrier) {
            self.stats.totalAttempts += 1
            self.stats.lastAttemptDate = Date()
            self.saveStats()
        }
    }
    
    func recordSyncSuccess(itemsSynced: Int, bytesSynced: Int) {
        statsQueue.async(flags: .barrier) {
            self.stats.successfulSyncs += 1
            self.stats.totalItemsSynced += itemsSynced
            self.stats.totalBytesSynced += bytesSynced
            self.stats.lastSuccessDate = Date()
            self.saveStats()
        }
    }
    
    func recordSyncFailure(error: Error) {
        statsQueue.async(flags: .barrier) {
            self.stats.failedSyncs += 1
            self.stats.lastFailureDate = Date()
            self.stats.lastError = error.localizedDescription
            self.saveStats()
        }
    }
    
    func recordPeerConnection(peerId: String) {
        statsQueue.async(flags: .barrier) {
            if !self.stats.connectedPeers.contains(peerId) {
                self.stats.connectedPeers.insert(peerId)
                self.stats.totalPeersConnected = self.stats.connectedPeers.count
            }
            self.saveStats()
        }
    }
    
    func recordPeerDisconnection(peerId: String) {
        statsQueue.async(flags: .barrier) {
            self.stats.connectedPeers.remove(peerId)
            self.saveStats()
        }
    }
    
    // MARK: - Retrieving Stats
    
    func getStats() -> SyncStats {
        statsQueue.sync {
            return stats
        }
    }
    
    func getSuccessRate() -> Double {
        statsQueue.sync {
            guard stats.totalAttempts > 0 else { return 0 }
            return Double(stats.successfulSyncs) / Double(stats.totalAttempts)
        }
    }
    
    func getAverageItemsPerSync() -> Double {
        statsQueue.sync {
            guard stats.successfulSyncs > 0 else { return 0 }
            return Double(stats.totalItemsSynced) / Double(stats.successfulSyncs)
        }
    }
    
    func reset() {
        statsQueue.async(flags: .barrier) {
            self.stats = SyncStats()
            self.saveStats()
        }
    }
    
    // MARK: - Persistence
    
    private func saveStats() {
        if let encoded = try? JSONEncoder().encode(stats) {
            userDefaults.set(encoded, forKey: statsKey)
        }
    }
    
    private func loadStats() {
        guard let data = userDefaults.data(forKey: statsKey),
              let decoded = try? JSONDecoder().decode(SyncStats.self, from: data) else {
            return
        }
        stats = decoded
    }
    
    // MARK: - Reporting
    
    func generateReport() -> String {
        let stats = getStats()
        let successRate = getSuccessRate()
        let avgItems = getAverageItemsPerSync()
        
        return """
        === Sync Analytics Report ===
        
        Total Attempts: \(stats.totalAttempts)
        Successful Syncs: \(stats.successfulSyncs)
        Failed Syncs: \(stats.failedSyncs)
        Success Rate: \(String(format: "%.1f%%", successRate * 100))
        
        Items Synced: \(stats.totalItemsSynced)
        Data Transferred: \(formatBytes(stats.totalBytesSynced))
        Average Items/Sync: \(String(format: "%.1f", avgItems))
        
        Connected Peers: \(stats.connectedPeers.count)
        Total Peers Seen: \(stats.totalPeersConnected)
        
        Last Success: \(stats.lastSuccessDate?.formatted() ?? "Never")
        Last Failure: \(stats.lastFailureDate?.formatted() ?? "Never")
        Last Error: \(stats.lastError ?? "None")
        """
    }
    
    private func formatBytes(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// MARK: - Sync Statistics

struct SyncStats: Codable {
    var totalAttempts: Int = 0
    var successfulSyncs: Int = 0
    var failedSyncs: Int = 0
    var totalItemsSynced: Int = 0
    var totalBytesSynced: Int = 0
    var connectedPeers: Set<String> = []
    var totalPeersConnected: Int = 0
    var lastAttemptDate: Date?
    var lastSuccessDate: Date?
    var lastFailureDate: Date?
    var lastError: String?
}