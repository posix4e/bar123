import UIKit

class DebugViewController: UIViewController {
    
    @IBOutlet weak var textView: UITextView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Debug Info"
        
        // Add refresh button
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .refresh,
            target: self,
            action: #selector(refreshDebugInfo)
        )
        
        refreshDebugInfo()
    }
    
    @objc private func refreshDebugInfo() {
        var debugText = ""
        
        // Add analytics report
        debugText += SyncAnalytics.shared.generateReport()
        debugText += "\n\n"
        
        // Add performance metrics
        debugText += "=== Performance Metrics ===\n\n"
        let metrics = PerformanceMonitor.shared.getAllMetrics()
        
        for (operation, summary) in metrics.sorted(by: { $0.key < $1.key }) {
            debugText += "\(operation):\n"
            debugText += "  Count: \(summary.count)\n"
            debugText += "  Average: \(String(format: "%.3f", summary.average))s\n"
            debugText += "  Median: \(String(format: "%.3f", summary.median))s\n"
            debugText += "  P95: \(String(format: "%.3f", summary.p95))s\n"
            debugText += "  Min/Max: \(String(format: "%.3f", summary.min))s / \(String(format: "%.3f", summary.max))s\n\n"
        }
        
        // Add device info
        debugText += "=== Device Info ===\n\n"
        debugText += "Device ID: \(UIDevice.current.identifierForVendor?.uuidString ?? "Unknown")\n"
        debugText += "Model: \(UIDevice.current.model)\n"
        debugText += "OS Version: \(UIDevice.current.systemVersion)\n"
        debugText += "Battery Level: \(UIDevice.current.batteryLevel * 100)%\n"
        
        textView.text = debugText
    }
    
    @IBAction func clearMetrics(_ sender: Any) {
        let alert = UIAlertController(
            title: "Clear Metrics",
            message: "Are you sure you want to clear all performance metrics and analytics?",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Clear", style: .destructive) { _ in
            PerformanceMonitor.shared.reset()
            SyncAnalytics.shared.reset()
            self.refreshDebugInfo()
        })
        
        present(alert, animated: true)
    }
    
    @IBAction func exportDebugLog(_ sender: Any) {
        let debugLog = textView.text ?? ""
        let activityVC = UIActivityViewController(
            activityItems: [debugLog],
            applicationActivities: nil
        )
        present(activityVC, animated: true)
    }
}