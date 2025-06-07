import Foundation
import BackgroundTasks
import UIKit

// MARK: - Background Sync Manager

class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()
    
    // Background task identifiers
    static let syncTaskIdentifier = "xyz.foo.bar123.sync"
    static let cleanupTaskIdentifier = "xyz.foo.bar123.cleanup"
    
    private var torrentManager: TorrentManager?
    private let syncInterval: TimeInterval = 3600 // 1 hour
    
    private init() {}
    
    // MARK: - Setup
    
    func setup(with torrentManager: TorrentManager) {
        self.torrentManager = torrentManager
        
        // Register background tasks
        registerBackgroundTasks()
        
        // Schedule initial tasks
        scheduleAppRefresh()
        scheduleBackgroundProcessing()
    }
    
    private func registerBackgroundTasks() {
        // Register sync task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: BackgroundSyncManager.syncTaskIdentifier,
            using: nil
        ) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        // Register cleanup task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: BackgroundSyncManager.cleanupTaskIdentifier,
            using: nil
        ) { task in
            self.handleBackgroundProcessing(task: task as! BGProcessingTask)
        }
    }
    
    // MARK: - Scheduling
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: BackgroundSyncManager.syncTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: syncInterval)
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("[BackgroundSync] Scheduled app refresh task")
        } catch {
            print("[BackgroundSync] Failed to schedule app refresh: \(error)")
        }
    }
    
    func scheduleBackgroundProcessing() {
        let request = BGProcessingTaskRequest(identifier: BackgroundSyncManager.cleanupTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 86400) // 24 hours
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("[BackgroundSync] Scheduled background processing task")
        } catch {
            print("[BackgroundSync] Failed to schedule background processing: \(error)")
        }
    }
    
    // MARK: - Task Handlers
    
    private func handleAppRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh
        scheduleAppRefresh()
        
        // Create a task to perform sync
        let syncTask = Task {
            do {
                try await performBackgroundSync()
                task.setTaskCompleted(success: true)
            } catch {
                print("[BackgroundSync] Sync failed: \(error)")
                task.setTaskCompleted(success: false)
            }
        }
        
        // Handle expiration
        task.expirationHandler = {
            syncTask.cancel()
            print("[BackgroundSync] Task expired")
        }
    }
    
    private func handleBackgroundProcessing(task: BGProcessingTask) {
        // Schedule the next processing
        scheduleBackgroundProcessing()
        
        // Create a task to perform cleanup
        let cleanupTask = Task {
            do {
                try await performBackgroundCleanup()
                task.setTaskCompleted(success: true)
            } catch {
                print("[BackgroundSync] Cleanup failed: \(error)")
                task.setTaskCompleted(success: false)
            }
        }
        
        // Handle expiration
        task.expirationHandler = {
            cleanupTask.cancel()
            print("[BackgroundSync] Cleanup task expired")
        }
    }
    
    // MARK: - Background Operations
    
    private func performBackgroundSync() async throws {
        guard let torrentManager = torrentManager else {
            throw BackgroundSyncError.noTorrentManager
        }
        
        print("[BackgroundSync] Starting background sync")
        
        // Check network connectivity
        guard await isNetworkAvailable() else {
            throw BackgroundSyncError.noNetwork
        }
        
        // Check battery level
        let battery = await batteryLevel()
        let charging = await isCharging()
        if battery < 0.2 && !charging {
            throw BackgroundSyncError.lowBattery
        }
        
        // Perform sync
        // Note: This will use the mock implementation until real libtorrent is integrated
        await torrentManager.performSync()
        
        // Update last sync time
        UserDefaults.standard.set(Date(), forKey: "lastSyncTime")
        
        print("[BackgroundSync] Background sync completed")
    }
    
    private func performBackgroundCleanup() async throws {
        print("[BackgroundSync] Starting background cleanup")
        
        // Clean up old history entries (older than 90 days)
        let cutoffDate = Date().addingTimeInterval(-90 * 24 * 3600)
        
        // Clean up temporary files
        let tempDir = FileManager.default.temporaryDirectory
        let torrentTempDir = tempDir.appendingPathComponent("TorrentTemp")
        
        if FileManager.default.fileExists(atPath: torrentTempDir.path) {
            try FileManager.default.removeItem(at: torrentTempDir)
        }
        
        // Clean up old sync logs
        cleanupOldLogs()
        
        print("[BackgroundSync] Background cleanup completed")
    }
    
    // MARK: - Utilities
    
    private func isNetworkAvailable() async -> Bool {
        // In production, use NWPathMonitor or similar
        // For now, assume network is available
        return true
    }
    
    private func batteryLevel() async -> Float {
        await UIDevice.current.batteryLevel
    }
    
    private func isCharging() async -> Bool {
        let batteryState = await UIDevice.current.batteryState
        return batteryState == .charging || batteryState == .full
    }
    
    private func cleanupOldLogs() {
        // Clean up logs older than 7 days
        let logsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Logs")
        
        guard FileManager.default.fileExists(atPath: logsDir.path) else { return }
        
        do {
            let logFiles = try FileManager.default.contentsOfDirectory(
                at: logsDir,
                includingPropertiesForKeys: [.creationDateKey]
            )
            
            let cutoffDate = Date().addingTimeInterval(-7 * 24 * 3600)
            
            for logFile in logFiles {
                if let attributes = try? FileManager.default.attributesOfItem(atPath: logFile.path),
                   let creationDate = attributes[.creationDate] as? Date,
                   creationDate < cutoffDate {
                    try? FileManager.default.removeItem(at: logFile)
                }
            }
        } catch {
            print("[BackgroundSync] Failed to cleanup logs: \(error)")
        }
    }
    
    // MARK: - Manual Sync
    
    func triggerManualSync() async throws {
        guard let torrentManager = torrentManager else {
            throw BackgroundSyncError.noTorrentManager
        }
        
        print("[BackgroundSync] Manual sync triggered")
        await torrentManager.performSync()
    }
}

// MARK: - Additional Errors

extension BackgroundSyncError {
    static var noNetwork: BackgroundSyncError {
        return .syncFailed
    }
    
    static var lowBattery: BackgroundSyncError {
        return .syncFailed
    }
}

// MARK: - App Delegate Extension

extension AppDelegate {
    func setupBackgroundSync() {
        // Enable battery monitoring
        UIDevice.current.isBatteryMonitoringEnabled = true
        
        // Get shared secret from user defaults
        guard let sharedSecret = UserDefaults.standard.string(forKey: "bar123_shared_secret") else {
            print("[BackgroundSync] No shared secret found")
            return
        }
        
        // Create torrent manager
        let torrentManager = TorrentManager(sharedSecret: sharedSecret)
        
        // Setup background sync
        BackgroundSyncManager.shared.setup(with: torrentManager)
        
        // Start sync
        torrentManager.startSync()
    }
}