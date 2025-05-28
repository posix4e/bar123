//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit
import os.log
import CryptoKit

// MARK: - History Item Model
struct HistoryItem: Codable {
    let url: String
    let title: String?
    let visitTime: Date
    let deviceId: String?
    let isArticle: Bool
    let readingTime: Int?
    let excerpt: String?
    let isLocal: Bool
    
    init(url: String, title: String? = nil, visitTime: Date = Date(), deviceId: String? = nil, isArticle: Bool = false, readingTime: Int? = nil, excerpt: String? = nil, isLocal: Bool = true) {
        self.url = url
        self.title = title
        self.visitTime = visitTime
        self.deviceId = deviceId
        self.isArticle = isArticle
        self.readingTime = readingTime
        self.excerpt = excerpt
        self.isLocal = isLocal
    }
}

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
    @IBOutlet weak var searchBar: UISearchBar!
    
    
    // State
    private var isConnected = false
    private var peerCount = 0
    private var historyCount = 0
    private var currentRoomId: String?
    private var batteryLevel: Float = -1
    private var isCharging = false
    private var batteryTimer: Timer?
    
    // IPFS Manager
    private var ipfsManager: IPFSManager?
    
    // History data
    private var allHistoryItems: [HistoryItem] = []
    private var filteredHistoryItems: [HistoryItem] = []
    private var searchText: String = ""
    
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "ViewController")

    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupIPFSManager()
        setupUI()
        setupBatteryMonitoring()
        checkForExistingRoomSecret()
        loadExtensionData()
        
        logger.info("ViewController initialized with native UI and IPFS")
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        batteryTimer?.invalidate()
        ipfsManager?.disconnect()
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
        
        // Setup table view
        historyTableView?.delegate = self
        historyTableView?.dataSource = self
        
        // Setup search bar
        searchBar?.delegate = self
        searchBar?.placeholder = "Search history..."
        searchBar?.backgroundImage = UIImage()
        
        // Load initial history data
        loadHistoryData()
        
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
    
    private func setupIPFSManager() {
        ipfsManager = IPFSManager()
        ipfsManager?.delegate = self
        logger.info("IPFS manager setup completed")
    }
    
    
    private func checkForExistingRoomSecret() {
        let secret = getSharedSecret()
        if !secret.isEmpty {
            logger.info("Found existing room secret, connecting to IPFS")
            ipfsManager?.connect(roomSecret: secret)
            showHistoryViewer()
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
            logger.info("🗑️ Clearing secret and disconnecting from IPFS")
            ipfsManager?.disconnect()
            sharedDefaults?.removeObject(forKey: "roomSecret")
            showSetupView()
        } else {
            logger.info("💾 Saving secret and connecting to IPFS")
            sharedDefaults?.set(secret, forKey: "roomSecret")
            ipfsManager?.connect(roomSecret: secret)
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
        // Load local history data from extension
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        // Get extension history count (but connection status comes from IPFS manager)
        let extensionHistoryCount = sharedDefaults?.integer(forKey: "extensionHistoryCount") ?? 0
        
        // Load history from extension if available
        if let historyData = sharedDefaults?.data(forKey: "extensionHistoryData"),
           let decodedHistory = try? JSONDecoder().decode([HistoryItem].self, from: historyData) {
            
            // Convert to IPFS format and update manager
            let ipfsHistory = decodedHistory.map { item in
                IPFSHistoryItem(from: item, deviceId: ipfsManager?.deviceId ?? "unknown")
            }
            ipfsManager?.updateLocalHistory(ipfsHistory)
            
            // Merge with local display
            allHistoryItems = decodedHistory
            filterHistoryItems()
        }
        
        // Update UI with current data
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
            self?.updateHistoryDisplay()
        }
        
        logger.info("Loaded extension data: extensionHistory=\(extensionHistoryCount), localHistory=\(allHistoryItems.count)")
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
        
        // Use IPFS manager status
        let ipfsConnected = ipfsManager?.isConnected ?? false
        let ipfsPeerCount = ipfsManager?.peerCount ?? 0
        let ipfsRoomInfo = ipfsManager?.currentTopic
        
        if ipfsConnected {
            connectionIndicator.text = "●"
            connectionIndicator.textColor = .systemGreen
            connectionLabel.text = "Connected (IPFS)"
        } else {
            connectionIndicator.text = "●"
            connectionIndicator.textColor = .systemRed
            connectionLabel.text = "Disconnected"
        }
        
        peerCountLabel?.text = "\(ipfsPeerCount)"
        historyCountLabel?.text = "\(allHistoryItems.count)"
        
        if let roomId = ipfsRoomInfo, !roomId.isEmpty {
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
        loadHistoryData()
        
        // Request history from IPFS peers
        ipfsManager?.requestHistoryFromPeers()
        
        updateHistoryDisplay()
    }
    
    @objc private func clearRoomSecret() {
        logger.info("Clear room secret requested")
        handleSetSharedSecret("")
    }
    
    // MARK: - History Data Management
    
    private func loadHistoryData() {
        // Load history from App Group UserDefaults (shared with Safari extension)
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        
        // Load real data from extension if available
        if let historyData = sharedDefaults?.data(forKey: "extensionHistoryData"),
           let decodedHistory = try? JSONDecoder().decode([HistoryItem].self, from: historyData) {
            allHistoryItems = decodedHistory
        } else {
            allHistoryItems = []
        }
        
        filterHistoryItems()
    }
    
    
    private func filterHistoryItems() {
        if searchText.isEmpty {
            // Show most recent 10 items by default
            filteredHistoryItems = Array(allHistoryItems.prefix(10))
        } else {
            // Filter based on search text
            filteredHistoryItems = allHistoryItems.filter { item in
                let titleMatch = item.title?.localizedCaseInsensitiveContains(searchText) ?? false
                let urlMatch = item.url.localizedCaseInsensitiveContains(searchText)
                let excerptMatch = item.excerpt?.localizedCaseInsensitiveContains(searchText) ?? false
                return titleMatch || urlMatch || excerptMatch
            }
        }
    }
    
    private func updateHistoryDisplay() {
        DispatchQueue.main.async { [weak self] in
            self?.historyTableView?.reloadData()
            self?.historyCountLabel?.text = "\(self?.allHistoryItems.count ?? 0)"
        }
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

// MARK: - UITableViewDataSource
extension ViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filteredHistoryItems.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell") ?? UITableViewCell(style: .subtitle, reuseIdentifier: "HistoryCell")
        let item = filteredHistoryItems[indexPath.row]
        
        // Configure cell
        cell.textLabel?.text = item.title ?? item.url
        cell.textLabel?.font = UIFont.boldSystemFont(ofSize: 13)
        cell.textLabel?.numberOfLines = 1
        
        // Create detail text with reading time if it's an article
        var detailText = item.url
        if item.isArticle, let readingTime = item.readingTime {
            detailText += " • \(readingTime) min read"
        }
        
        cell.detailTextLabel?.text = detailText
        cell.detailTextLabel?.font = UIFont.systemFont(ofSize: 10)
        cell.detailTextLabel?.textColor = .secondaryLabel
        cell.detailTextLabel?.numberOfLines = 1
        
        // Add article indicator
        if item.isArticle {
            cell.accessoryType = .detailButton
            cell.tintColor = .systemBlue
        } else {
            cell.accessoryType = .none
        }
        
        // Add time indicator
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        
        let timeLabel = UILabel()
        timeLabel.text = formatter.string(from: item.visitTime)
        timeLabel.font = UIFont.systemFont(ofSize: 10)
        timeLabel.textColor = .tertiaryLabel
        timeLabel.sizeToFit()
        
        cell.accessoryView = timeLabel
        
        return cell
    }
}

// MARK: - UITableViewDelegate
extension ViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        let item = filteredHistoryItems[indexPath.row]
        
        // Open URL in Safari
        if let url = URL(string: item.url) {
            UIApplication.shared.open(url)
        }
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 54
    }
    
    func tableView(_ tableView: UITableView, accessoryButtonTappedForRowWith indexPath: IndexPath) {
        let item = filteredHistoryItems[indexPath.row]
        
        if item.isArticle {
            // Show article details
            var message = "Article: \(item.title ?? "Unknown Title")\n\n"
            message += "URL: \(item.url)\n\n"
            
            if let readingTime = item.readingTime {
                message += "Reading Time: \(readingTime) minutes\n\n"
            }
            
            if let excerpt = item.excerpt {
                message += "Excerpt:\n\(excerpt)"
            }
            
            let alert = UIAlertController(title: "Article Details", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Open", style: .default) { _ in
                if let url = URL(string: item.url) {
                    UIApplication.shared.open(url)
                }
            })
            alert.addAction(UIAlertAction(title: "Close", style: .cancel))
            
            DispatchQueue.main.async { [weak self] in
                self?.present(alert, animated: true)
            }
        }
    }
}

// MARK: - UISearchBarDelegate
extension ViewController: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        self.searchText = searchText
        filterHistoryItems()
        updateHistoryDisplay()
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
    }
    
    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        searchBar.text = ""
        searchBar.resignFirstResponder()
        searchText = ""
        filterHistoryItems()
        updateHistoryDisplay()
    }
}

// MARK: - IPFSManagerDelegate
extension ViewController: IPFSManagerDelegate {
    func ipfsManager(_ manager: IPFSManager, didReceiveHistory items: [IPFSHistoryItem]) {
        logger.info("📥 Received \(items.count) history items from IPFS")
        
        // Convert IPFS items to local HistoryItem format
        let newItems = items.map { ipfsItem in
            HistoryItem(
                url: ipfsItem.url,
                title: ipfsItem.title,
                visitTime: ipfsItem.visitTime,
                deviceId: ipfsItem.deviceId,
                isArticle: ipfsItem.isArticle,
                readingTime: ipfsItem.readingTime,
                excerpt: ipfsItem.excerpt,
                isLocal: false
            )
        }
        
        // Merge with existing history
        let existingUrls = Set(allHistoryItems.map { $0.url + $0.visitTime.description })
        
        for item in newItems {
            let key = item.url + item.visitTime.description
            if !existingUrls.contains(key) {
                allHistoryItems.append(item)
            }
        }
        
        // Sort by visit time (newest first)
        allHistoryItems.sort { $0.visitTime > $1.visitTime }
        
        // Update UI on main thread
        DispatchQueue.main.async { [weak self] in
            self?.filterHistoryItems()
            self?.updateHistoryDisplay()
            self?.updateConnectionStatus()
        }
        
        // Save to App Group for extension access
        saveHistoryToAppGroup()
    }
    
    func ipfsManager(_ manager: IPFSManager, didDiscoverPeer peerId: String) {
        logger.info("🎉 IPFS peer discovered: \(peerId)")
        
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
        }
    }
    
    func ipfsManager(_ manager: IPFSManager, didLosePeer peerId: String) {
        logger.info("👋 IPFS peer lost: \(peerId)")
        
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
        }
    }
    
    func ipfsManager(_ manager: IPFSManager, connectionStatusChanged isConnected: Bool) {
        logger.info("🔗 IPFS connection status changed: \(isConnected ? "connected" : "disconnected")")
        
        self.isConnected = isConnected
        
        DispatchQueue.main.async { [weak self] in
            self?.updateConnectionStatus()
        }
        
        // If we just connected, share our local history
        if isConnected {
            shareLocalHistoryWithIPFS()
        }
    }
    
    private func saveHistoryToAppGroup() {
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            logger.error("Failed to access App Group for saving history")
            return
        }
        
        do {
            let historyData = try JSONEncoder().encode(allHistoryItems)
            sharedDefaults.set(historyData, forKey: "extensionHistoryData")
            sharedDefaults.set(allHistoryItems.count, forKey: "extensionHistoryCount")
            sharedDefaults.synchronize()
            
            logger.info("💾 Saved \(allHistoryItems.count) history items to App Group")
        } catch {
            logger.error("Failed to encode history for App Group: \(error)")
        }
    }
    
    private func shareLocalHistoryWithIPFS() {
        // Convert local history to IPFS format and share
        let ipfsHistory = allHistoryItems.filter { $0.isLocal }.map { item in
            IPFSHistoryItem(from: item, deviceId: ipfsManager?.deviceId ?? "unknown")
        }
        
        if !ipfsHistory.isEmpty {
            logger.info("📤 Sharing \(ipfsHistory.count) local history items with IPFS peers")
            ipfsManager?.broadcastHistory(ipfsHistory)
        }
    }
}
