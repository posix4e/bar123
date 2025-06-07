import Foundation
import os.log

// MARK: - Performance Monitor

/// Monitors and logs performance metrics for sync operations
class PerformanceMonitor {
    static let shared = PerformanceMonitor()
    
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "Performance")
    private var metrics: [String: [TimeInterval]] = [:]
    private let metricsQueue = DispatchQueue(label: "com.bar123.performance", attributes: .concurrent)
    
    private init() {}
    
    // MARK: - Timing
    
    /// Start timing an operation
    func startTimer(for operation: String) -> Date {
        let startTime = Date()
        logger.debug("Starting timer for: \(operation)")
        return startTime
    }
    
    /// End timing and record the duration
    func endTimer(for operation: String, startTime: Date) {
        let duration = Date().timeIntervalSince(startTime)
        
        metricsQueue.async(flags: .barrier) {
            if self.metrics[operation] == nil {
                self.metrics[operation] = []
            }
            self.metrics[operation]?.append(duration)
            
            // Keep only last 100 measurements
            if let count = self.metrics[operation]?.count, count > 100 {
                self.metrics[operation]?.removeFirst(count - 100)
            }
        }
        
        logger.info("\(operation) completed in \(String(format: "%.3f", duration))s")
    }
    
    /// Measure a block of code
    func measure<T>(_ operation: String, block: () throws -> T) rethrows -> T {
        let startTime = startTimer(for: operation)
        defer { endTimer(for: operation, startTime: startTime) }
        return try block()
    }
    
    /// Measure an async block of code
    func measure<T>(_ operation: String, block: () async throws -> T) async rethrows -> T {
        let startTime = startTimer(for: operation)
        defer { endTimer(for: operation, startTime: startTime) }
        return try await block()
    }
    
    // MARK: - Metrics
    
    /// Get average duration for an operation
    func averageDuration(for operation: String) -> TimeInterval? {
        metricsQueue.sync {
            guard let durations = metrics[operation], !durations.isEmpty else { return nil }
            return durations.reduce(0, +) / Double(durations.count)
        }
    }
    
    /// Get all metrics
    func getAllMetrics() -> [String: MetricsSummary] {
        metricsQueue.sync {
            var summaries: [String: MetricsSummary] = [:]
            
            for (operation, durations) in metrics {
                guard !durations.isEmpty else { continue }
                
                let sorted = durations.sorted()
                let sum = durations.reduce(0, +)
                let average = sum / Double(durations.count)
                let median = sorted[sorted.count / 2]
                let p95 = sorted[Int(Double(sorted.count) * 0.95)]
                
                summaries[operation] = MetricsSummary(
                    count: durations.count,
                    average: average,
                    median: median,
                    p95: p95,
                    min: sorted.first ?? 0,
                    max: sorted.last ?? 0
                )
            }
            
            return summaries
        }
    }
    
    /// Log all metrics
    func logMetricsSummary() {
        let summaries = getAllMetrics()
        
        logger.info("=== Performance Metrics Summary ===")
        for (operation, summary) in summaries.sorted(by: { $0.key < $1.key }) {
            logger.info("""
                \(operation):
                  Count: \(summary.count)
                  Avg: \(String(format: "%.3f", summary.average))s
                  Median: \(String(format: "%.3f", summary.median))s
                  P95: \(String(format: "%.3f", summary.p95))s
                  Min: \(String(format: "%.3f", summary.min))s
                  Max: \(String(format: "%.3f", summary.max))s
                """)
        }
    }
    
    /// Reset all metrics
    func reset() {
        metricsQueue.async(flags: .barrier) {
            self.metrics.removeAll()
        }
        logger.info("Performance metrics reset")
    }
}

// MARK: - Metrics Summary

struct MetricsSummary {
    let count: Int
    let average: TimeInterval
    let median: TimeInterval
    let p95: TimeInterval
    let min: TimeInterval
    let max: TimeInterval
}

// MARK: - Performance Categories

extension PerformanceMonitor {
    enum Operation {
        static let syncTotal = "sync.total"
        static let syncPrepareData = "sync.prepare_data"
        static let syncEncryption = "sync.encryption"
        static let syncBroadcast = "sync.broadcast"
        static let syncMerge = "sync.merge"
        static let historyLoad = "history.load"
        static let historySave = "history.save"
        static let historySearch = "history.search"
        static let p2pDiscovery = "p2p.discovery"
        static let p2pHandshake = "p2p.handshake"
        static let p2pDataTransfer = "p2p.data_transfer"
    }
}