//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit
import os.log
import CryptoKit

class ViewController: UIViewController {
    
    // UI Elements
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var connectionStatusView: UIView!
    @IBOutlet weak var connectionIndicator: UILabel!
    @IBOutlet weak var connectionLabel: UILabel!
    @IBOutlet weak var batteryStatusView: UIView!
    @IBOutlet weak var batteryIndicator: UILabel!
    @IBOutlet weak var batteryLabel: UILabel!
    @IBOutlet weak var peerCountLabel: UILabel!
    @IBOutlet weak var historyCountLabel: UILabel!
    @IBOutlet weak var roomIdLabel: UILabel!
    @IBOutlet weak var refreshButton: UIButton!
    @IBOutlet weak var clearRoomButton: UIButton!
    @IBOutlet weak var historyTableView: UITableView!
    
    
    // State
    private var isConnected = false
    private var peerCount = 0
    private var historyCount = 0
    private var currentRoomId: String?
    private var batteryLevel: Float = -1
    private var isCharging = false
    private var batteryTimer: Timer?
    
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "ViewController")

    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupBatteryMonitoring()
        checkForExistingRoomSecret()
        loadExtensionData()
        
        logger.info("ViewController initialized with native UI")
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        batteryTimer?.invalidate()
    }
    
    private func setupUI() {
        // Setup title
        if let titleLabel = titleLabel {
            titleLabel.text = "History Sync"
            titleLabel.font = UIFont.boldSystemFont(ofSize: 24)
        }
        
        // Setup connection status
        updateConnectionStatus()
        
        // Setup battery status
        updateBatteryStatus()
        
        // Setup buttons
        refreshButton?.addTarget(self, action: #selector(refreshHistory), for: .touchUpInside)
        clearRoomButton?.addTarget(self, action: #selector(clearRoomSecret), for: .touchUpInside)
        
        // Style buttons
        refreshButton?.backgroundColor = .systemBlue
        refreshButton?.layer.cornerRadius = 8
        refreshButton?.setTitleColor(.white, for: .normal)
        
        clearRoomButton?.backgroundColor = .systemRed
        clearRoomButton?.layer.cornerRadius = 8
        clearRoomButton?.setTitleColor(.white, for: .normal)
        
        logger.info("Native UI setup completed")
    }
    
    private func setupBatteryMonitoring() {
        // Enable battery monitoring
        UIDevice.current.isBatteryMonitoringEnabled = true
        
        // Initial battery status
        updateBatteryInfo()
        
        // Monitor battery changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryStateDidChange),
            name: UIDevice.batteryStateDidChangeNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryLevelDidChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
        
        // Periodic updates every 30 seconds
        batteryTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.updateBatteryInfo()
            self?.loadExtensionData() // Also refresh extension data
        }
        
        logger.info("Battery monitoring setup completed")
    }
    
    
    private func checkForExistingRoomSecret() {
        let secret = getSharedSecret()
        if !secret.isEmpty {
            logger.info("Found existing room secret, letting JavaScript handle connection")
            showHistoryViewer()
            // Send secret to JavaScript
            updateSecretStatus(secret)
        } else {
            logger.info("No room secret found, showing setup view")
            showSetupView()
        }
    }

    
    private func handleSetSharedSecret(_ secret: String) {
        logger.info("🔐 handleSetSharedSecret called with secret: '\(secret)'")
        
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        if secret.isEmpty {
            logger.info("🗑️ Clearing secret and showing setup view")
            sharedDefaults?.removeObject(forKey: "roomSecret")
            showSetupView()
        } else {
            logger.info("💾 Saving secret and switching to history viewer")
            sharedDefaults?.set(secret, forKey: "roomSecret")
            showHistoryViewer()
            updateSecretStatus(secret)
        }
        
        sharedDefaults?.synchronize()
        logger.info("✅ Shared secret updated: \(secret.isEmpty ? "cleared" : "set")")
    }
    
    // MARK: - View Management
    
    private func showHistoryViewer() {
        // History viewer mode - show all history elements
        DispatchQueue.main.async { [weak self] in
            // Show history interface elements
            self?.peerCountLabel?.superview?.isHidden = false
            self?.historyCountLabel?.superview?.isHidden = false
            self?.roomIdLabel?.superview?.isHidden = false
            self?.refreshButton?.isHidden = false
            self?.clearRoomButton?.isHidden = false
            self?.historyTableView?.isHidden = false
            
            
            self?.titleLabel?.text = "History Sync"
            self?.updateConnectionStatus()
            self?.updateBatteryStatus()
            self?.logger.info("Switched to history viewer mode")
        }
    }
    
    private func showSetupView() {
        // Setup mode - show room secret input
        DispatchQueue.main.async { [weak self] in
            // For now, show a simple alert for room secret input since we don't have setup UI in storyboard yet
            self?.showRoomSecretInputAlert()
            self?.logger.info("Switched to setup mode")
        }
    }
    
    private func showRoomSecretInputAlert() {
        let alert = UIAlertController(
            title: "Enter Room Secret", 
            message: "Enter a room secret to connect with other devices",
            preferredStyle: .alert
        )
        
        alert.addTextField { textField in
            textField.placeholder = "Room secret"
            textField.autocapitalizationType = .none
        }
        
        alert.addAction(UIAlertAction(title: "Generate Random", style: .default) { [weak self] _ in
            let secret = self?.generateRandomSecret() ?? ""
            alert.textFields?.first?.text = secret
        })
        
        alert.addAction(UIAlertAction(title: "Connect", style: .default) { [weak self] _ in
            if let secret = alert.textFields?.first?.text, !secret.isEmpty {
                self?.handleSetSharedSecret(secret)
            }
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        DispatchQueue.main.async { [weak self] in
            self?.present(alert, animated: true)
        }
    }
    
    private func showSafariInstructions() {
        let alert = UIAlertController(
            title: "Safari Extension Setup",
            message: "1. Tap the 'AA' button in Safari's address bar\n2. Select 'bar123'\n3. Set your room secret\n4. Return to this app",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        
        DispatchQueue.main.async {
            self.present(alert, animated: true)
        }
    }
    
    // MARK: - Helper Methods
    
    private func updateSecretStatus(_ secret: String) {
        logger.info("Secret available for native UI: \(secret.isEmpty ? "empty" : "set")")
        // Update native UI elements based on secret availability
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
        }
    }
    
    
    
    private func getSharedSecret() -> String {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        return sharedDefaults?.string(forKey: "roomSecret") ?? ""
    }
    
    private func loadExtensionData() {
        // Try to get data from the Safari extension via the App Group
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        // Check if extension has stored connection status
        isConnected = sharedDefaults?.bool(forKey: "extensionConnected") ?? false
        peerCount = sharedDefaults?.integer(forKey: "extensionPeerCount") ?? 0
        historyCount = sharedDefaults?.integer(forKey: "extensionHistoryCount") ?? 0
        currentRoomId = sharedDefaults?.string(forKey: "extensionRoomId")
        
        // Update UI with real data
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
        }
        
        logger.info("Loaded extension data: connected=\(self.isConnected), peers=\(self.peerCount), history=\(self.historyCount)")
    }
    
    // MARK: - Battery Monitoring
    
    @objc private func batteryStateDidChange() {
        updateBatteryInfo()
    }
    
    @objc private func batteryLevelDidChange() {
        updateBatteryInfo()
    }
    
    private func updateBatteryInfo() {
        let device = UIDevice.current
        batteryLevel = device.batteryLevel
        
        switch device.batteryState {
        case .charging:
            isCharging = true
        case .full:
            isCharging = true  // Plugged in when full
        case .unplugged:
            isCharging = false
        case .unknown:
            isCharging = false
        @unknown default:
            isCharging = false
        }
        
        updateBatteryStatus()
        
        logger.info("Battery updated: level=\(self.batteryLevel), charging=\(self.isCharging)")
    }
    
    private func updateBatteryStatus() {
        guard let batteryIndicator = batteryIndicator,
              let batteryLabel = batteryLabel else { return }
        
        let icon: String
        let text: String
        let color: UIColor
        
        if batteryLevel < 0 {
            icon = "❓"
            text = "Battery Status Unknown - Manual Refresh Only"
            color = .systemGray
        } else if isCharging {
            icon = "⚡"
            text = "Charging (\(Int(batteryLevel * 100))%) - Auto Refresh"
            color = .systemGreen
        } else {
            icon = "🔋"
            text = "Battery (\(Int(batteryLevel * 100))%) - Manual Refresh Only"
            color = .systemOrange
        }
        
        batteryIndicator.text = icon
        batteryLabel.text = text
        batteryStatusView?.backgroundColor = color.withAlphaComponent(0.1)
    }
    
    private func updateConnectionStatus() {
        guard let connectionIndicator = connectionIndicator,
              let connectionLabel = connectionLabel else { return }
        
        if isConnected {
            connectionIndicator.text = "●"
            connectionIndicator.textColor = .systemGreen
            connectionLabel.text = "Connected"
        } else {
            connectionIndicator.text = "●"
            connectionIndicator.textColor = .systemRed
            connectionLabel.text = "Disconnected"
        }
        
        peerCountLabel?.text = "\(peerCount)"
        historyCountLabel?.text = "\(historyCount)"
        
        if let roomId = currentRoomId, !roomId.isEmpty {
            // Show truncated room ID for readability
            let truncated = roomId.count > 8 ? String(roomId.prefix(8)) + "..." : roomId
            roomIdLabel?.text = truncated
        } else {
            roomIdLabel?.text = "None"
        }
    }
    
    // MARK: - Button Actions
    
    @objc private func refreshHistory() {
        logger.info("Manual history refresh requested")
        // TODO: Implement history refresh
    }
    
    @objc private func clearRoomSecret() {
        logger.info("Clear room secret requested")
        handleSetSharedSecret("")
    }
    
    
    private func generateRandomSecret() -> String {
        let characters = "abcdefghijklmnopqrstuvwxyz0123456789"
        return String((0..<12).map { _ in characters.randomElement()! })
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        DispatchQueue.main.async { [weak self] in
            self?.present(alert, animated: true)
        }
    }
    
}
