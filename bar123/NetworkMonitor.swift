import Foundation
import Network
import os.log

// MARK: - Network Monitor

/// Monitors network connectivity and conditions
class NetworkMonitor {
    static let shared = NetworkMonitor()
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.bar123.network")
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "Network")
    
    private(set) var isConnected = false
    private(set) var isExpensive = false
    private(set) var currentConnectionType: ConnectionType = .none
    
    var onStatusChange: ((Bool) -> Void)?
    
    enum ConnectionType {
        case none
        case wifi
        case cellular
        case wired
        case other
    }
    
    private init() {}
    
    // MARK: - Monitoring
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.updateConnectionStatus(path)
        }
        
        monitor.start(queue: queue)
        logger.info("Network monitoring started")
    }
    
    func stopMonitoring() {
        monitor.cancel()
        logger.info("Network monitoring stopped")
    }
    
    private func updateConnectionStatus(_ path: NWPath) {
        let wasConnected = isConnected
        
        isConnected = path.status == .satisfied
        isExpensive = path.isExpensive
        
        // Determine connection type
        if path.usesInterfaceType(.wifi) {
            currentConnectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            currentConnectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            currentConnectionType = .wired
        } else if isConnected {
            currentConnectionType = .other
        } else {
            currentConnectionType = .none
        }
        
        
        // Notify if connection status changed
        if wasConnected != isConnected {
            DispatchQueue.main.async {
                self.onStatusChange?(self.isConnected)
            }
        }
    }
    
    // MARK: - Sync Recommendations
    
    /// Check if sync should be performed based on network conditions
    func shouldPerformSync() -> Bool {
        guard isConnected else {
            logger.info("Sync skipped: No network connection")
            return false
        }
        
        // Allow sync on WiFi or wired connections
        if currentConnectionType == .wifi || currentConnectionType == .wired {
            return true
        }
        
        // Check user preference for cellular sync
        let allowCellular = UserDefaults.standard.bool(forKey: "bar123_allow_cellular_sync")
        if currentConnectionType == .cellular && allowCellular {
            return true
        }
        
        logger.info("Sync skipped: Cellular connection and sync not allowed")
        return false
    }
    
    /// Check if large sync should be performed
    func shouldPerformLargeSync(estimatedBytes: Int) -> Bool {
        guard shouldPerformSync() else { return false }
        
        // Always allow on WiFi/wired
        if currentConnectionType == .wifi || currentConnectionType == .wired {
            return true
        }
        
        // Check size limit for cellular
        let cellularLimit = UserDefaults.standard.integer(forKey: "bar123_cellular_sync_limit")
        if cellularLimit > 0 && estimatedBytes > cellularLimit {
            logger.info("Large sync skipped: Exceeds cellular limit (\(estimatedBytes) > \(cellularLimit))")
            return false
        }
        
        return true
    }
    
    // MARK: - Utilities
    
    func waitForConnection(timeout: TimeInterval = 30) async -> Bool {
        if isConnected { return true }
        
        return await withCheckedContinuation { continuation in
            var timeoutTask: Task<Void, Never>?
            
            let statusObserver = { (connected: Bool) in
                if connected {
                    timeoutTask?.cancel()
                    continuation.resume(returning: true)
                }
            }
            
            // Temporarily observe status changes
            let previousHandler = self.onStatusChange
            self.onStatusChange = statusObserver
            
            // Set timeout
            timeoutTask = Task {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                self.onStatusChange = previousHandler
                continuation.resume(returning: false)
            }
            
            // Check one more time in case we're already connected
            if self.isConnected {
                timeoutTask?.cancel()
                self.onStatusChange = previousHandler
                continuation.resume(returning: true)
            }
        }
    }
}
