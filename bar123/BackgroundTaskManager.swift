import Foundation
import BackgroundTasks
import os.log

class BackgroundTaskManager {
    static let shared = BackgroundTaskManager()
    
    private let backgroundTaskIdentifier = "xyz.foo.bar123.historysync"
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "BackgroundSync")
    private var torrentManager: TorrentManager?
    
    private init() {}
    
    func configure(with torrentManager: TorrentManager) {
        self.torrentManager = torrentManager
        
        // Register background task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundTaskIdentifier,
            using: nil
        ) { task in
            self.handleBackgroundSync(task: task as! BGProcessingTask)
        }
        
        // Schedule initial task
        scheduleBackgroundSync()
    }
    
    func scheduleBackgroundSync() {
        let request = BGProcessingTaskRequest(identifier: backgroundTaskIdentifier)
        
        // Schedule for next sync (e.g., every 6 hours)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 60 * 60)
        
        // Require network connectivity
        request.requiresNetworkConnectivity = true
        
        // Don't require external power (battery friendly)
        request.requiresExternalPower = false
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Background sync scheduled successfully")
        } catch {
            logger.error("Failed to schedule background sync: \(error.localizedDescription)")
        }
    }
    
    private func handleBackgroundSync(task: BGProcessingTask) {
        // Schedule next sync
        scheduleBackgroundSync()
        
        // Create a task to perform the sync
        let syncTask = Task {
            do {
                logger.info("Starting background history sync")
                
                // Perform sync operation
                guard let torrentManager = self.torrentManager else {
                    throw BackgroundSyncError.noTorrentManager
                }
                
                // This would trigger the actual torrent sync
                // In production, this would:
                // 1. Connect to DHT network
                // 2. Find peers with same shared secret
                // 3. Exchange history data
                // 4. Merge received history
                
                // For now, we'll simulate with a delay
                try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                
                logger.info("Background sync completed successfully")
                task.setTaskCompleted(success: true)
                
            } catch {
                logger.error("Background sync failed: \(error.localizedDescription)")
                task.setTaskCompleted(success: false)
            }
        }
        
        // Handle expiration
        task.expirationHandler = {
            syncTask.cancel()
            self.logger.warning("Background sync task expired")
        }
    }
    
    // Call this when app enters background
    func applicationDidEnterBackground() {
        // Trigger immediate sync if needed
        if shouldPerformImmediateSync() {
            scheduleImmediateBackgroundSync()
        }
    }
    
    private func shouldPerformImmediateSync() -> Bool {
        // Check if enough time has passed since last sync
        let lastSyncKey = "lastBackgroundSyncDate"
        let lastSync = UserDefaults.standard.object(forKey: lastSyncKey) as? Date ?? Date.distantPast
        let timeSinceLastSync = Date().timeIntervalSince(lastSync)
        
        // Sync if more than 1 hour has passed
        return timeSinceLastSync > 3600
    }
    
    private func scheduleImmediateBackgroundSync() {
        let request = BGProcessingTaskRequest(identifier: backgroundTaskIdentifier)
        request.earliestBeginDate = nil // Start ASAP
        request.requiresNetworkConnectivity = true
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Immediate background sync scheduled")
        } catch {
            logger.error("Failed to schedule immediate sync: \(error.localizedDescription)")
        }
    }
}

enum BackgroundSyncError: Error {
    case noTorrentManager
    case syncFailed
}