/**
 * HistorySyncViewController.swift
 * iOS Native App for P2P History Sync
 * 
 * Features:
 * - WebRTC-based P2P connections
 * - Real-time history synchronization
 * - Search and browse synced history
 * - Device management
 * - Shared secret configuration
 */

import UIKit
import SafariServices
import os.log

class HistorySyncViewController: UIViewController {
    
    // MARK: - Properties
    private let historySyncManager = HistorySyncManager()
    private let logger = OSLog(subsystem: "com.historysync", category: "HistorySyncViewController")
    
    // UI State
    private var currentConfig = HistorySyncConfig()
    private var historyEntries: [HistoryEntry] = []
    private var filteredEntries: [HistoryEntry] = []
    private var connectedDevices: [DeviceInfo] = []
    private var selectedDeviceId: String?
    
    // MARK: - UI Components
    private let connectionStatusView = UIView()
    private let connectionStatusLabel = UILabel()
    private let searchBar = UISearchBar()
    private let segmentControl = UISegmentedControl(items: ["History", "Devices"])
    private let tableView = UITableView()
    private let settingsButton = UIBarButtonItem(title: "Settings", style: .plain, target: nil, action: nil)
    private let refreshButton = UIBarButtonItem(barButtonSystemItem: .refresh, target: nil, action: nil)
    
    // MARK: - View Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupConstraints()
        setupDelegates()
        loadConfiguration()
        
        // Auto-connect if configured
        if currentConfig.isConfigured {
            connectToNetwork()
        }
    }
    
    // MARK: - Setup
    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "History Sync"
        
        // Navigation bar
        navigationItem.rightBarButtonItems = [settingsButton, refreshButton]
        settingsButton.target = self
        settingsButton.action = #selector(settingsButtonTapped)
        refreshButton.target = self
        refreshButton.action = #selector(refreshButtonTapped)
        
        // Connection status
        connectionStatusView.layer.cornerRadius = 8
        connectionStatusView.translatesAutoresizingMaskIntoConstraints = false
        connectionStatusLabel.translatesAutoresizingMaskIntoConstraints = false
        connectionStatusLabel.textAlignment = .center
        connectionStatusLabel.font = .systemFont(ofSize: 14, weight: .medium)
        connectionStatusLabel.textColor = .white
        connectionStatusView.addSubview(connectionStatusLabel)
        updateConnectionStatus(false)
        
        // Search bar
        searchBar.placeholder = "Search history..."
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        
        // Segment control
        segmentControl.selectedSegmentIndex = 0
        segmentControl.translatesAutoresizingMaskIntoConstraints = false
        segmentControl.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)
        
        // Table view
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.register(HistoryTableViewCell.self, forCellReuseIdentifier: "HistoryCell")
        tableView.register(DeviceTableViewCell.self, forCellReuseIdentifier: "DeviceCell")
        
        // Add subviews
        view.addSubview(connectionStatusView)
        view.addSubview(searchBar)
        view.addSubview(segmentControl)
        view.addSubview(tableView)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Connection status
            connectionStatusView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            connectionStatusView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            connectionStatusView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            connectionStatusView.heightAnchor.constraint(equalToConstant: 36),
            
            connectionStatusLabel.centerXAnchor.constraint(equalTo: connectionStatusView.centerXAnchor),
            connectionStatusLabel.centerYAnchor.constraint(equalTo: connectionStatusView.centerYAnchor),
            
            // Search bar
            searchBar.topAnchor.constraint(equalTo: connectionStatusView.bottomAnchor, constant: 8),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            // Segment control
            segmentControl.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 8),
            segmentControl.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            segmentControl.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            // Table view
            tableView.topAnchor.constraint(equalTo: segmentControl.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
    }
    
    private func setupDelegates() {
        historySyncManager.delegate = self
        searchBar.delegate = self
        tableView.dataSource = self
        tableView.delegate = self
    }
    
    // MARK: - Configuration
    private func loadConfiguration() {
        currentConfig = HistorySyncConfig.load()
    }
    
    private func saveConfiguration() {
        currentConfig.save()
    }
    
    // MARK: - Connection Management
    private func connectToNetwork() {
        guard currentConfig.isConfigured,
              let serverURL = URL(string: currentConfig.signalingServerUrl) else {
            showAlert(title: "Configuration Error", message: "Please configure connection settings first")
            return
        }
        
        Task {
            do {
                try await historySyncManager.connect(
                    roomId: currentConfig.roomId,
                    sharedSecret: currentConfig.sharedSecret,
                    signalingServerURL: serverURL
                )
                await MainActor.run {
                    updateConnectionStatus(true)
                }
            } catch {
                await MainActor.run {
                    showAlert(title: "Connection Error", message: error.localizedDescription)
                    updateConnectionStatus(false)
                }
            }
        }
    }
    
    private func disconnect() {
        Task {
            await historySyncManager.disconnect()
            await MainActor.run {
                updateConnectionStatus(false)
            }
        }
    }
    
    private func updateConnectionStatus(_ connected: Bool) {
        connectionStatusView.backgroundColor = connected ? .systemGreen : .systemRed
        connectionStatusLabel.text = connected ? "Connected" : "Disconnected"
    }
    
    // MARK: - Data Management
    private func refreshData() {
        switch segmentControl.selectedSegmentIndex {
        case 0: // History
            loadHistory()
        case 1: // Devices
            loadDevices()
        default:
            break
        }
    }
    
    private func loadHistory() {
        historyEntries = historySyncManager.getHistory(for: selectedDeviceId)
        filterHistory(with: searchBar.text)
    }
    
    private func loadDevices() {
        connectedDevices = historySyncManager.getDevices()
        tableView.reloadData()
    }
    
    private func filterHistory(with query: String?) {
        if let query = query, !query.isEmpty {
            filteredEntries = historySyncManager.searchHistory(query: query)
        } else {
            filteredEntries = historyEntries
        }
        tableView.reloadData()
    }
    
    // MARK: - Actions
    @objc private func segmentChanged() {
        searchBar.text = ""
        searchBar.resignFirstResponder()
        refreshData()
    }
    
    @objc private func settingsButtonTapped() {
        showSettingsAlert()
    }
    
    @objc private func refreshButtonTapped() {
        refreshData()
    }
    
    // MARK: - Settings
    private func showSettingsAlert() {
        let alert = UIAlertController(title: "Connection Settings", message: nil, preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "Signaling Server URL"
            textField.text = self.currentConfig.signalingServerUrl
            textField.keyboardType = .URL
            textField.autocapitalizationType = .none
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Room ID"
            textField.text = self.currentConfig.roomId
            textField.autocapitalizationType = .none
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Shared Secret"
            textField.text = self.currentConfig.sharedSecret
            textField.isSecureTextEntry = true
            textField.autocapitalizationType = .none
        }
        
        let generateAction = UIAlertAction(title: "Generate Secret", style: .default) { _ in
            if let secretField = alert.textFields?[2] {
                secretField.text = HistorySyncConfig.generateSecret()
            }
            self.present(alert, animated: true)
        }
        
        let connectAction = UIAlertAction(title: "Save & Connect", style: .default) { _ in
            guard let serverUrl = alert.textFields?[0].text,
                  let roomId = alert.textFields?[1].text,
                  let secret = alert.textFields?[2].text,
                  !serverUrl.isEmpty, !roomId.isEmpty, !secret.isEmpty else {
                self.showAlert(title: "Error", message: "Please fill in all fields")
                return
            }
            
            self.currentConfig.signalingServerUrl = serverUrl
            self.currentConfig.roomId = roomId
            self.currentConfig.sharedSecret = secret
            self.saveConfiguration()
            
            self.connectToNetwork()
        }
        
        let disconnectAction = UIAlertAction(title: "Disconnect", style: .destructive) { _ in
            self.disconnect()
        }
        
        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel)
        
        alert.addAction(generateAction)
        alert.addAction(connectAction)
        if historySyncManager.isConnected {
            alert.addAction(disconnectAction)
        }
        alert.addAction(cancelAction)
        
        present(alert, animated: true)
    }
    
    // MARK: - Helper Methods
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func openURL(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        
        let safariVC = SFSafariViewController(url: url)
        present(safariVC, animated: true)
    }
}

// MARK: - UITableViewDataSource
extension HistorySyncViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch segmentControl.selectedSegmentIndex {
        case 0: // History
            return filteredEntries.count
        case 1: // Devices
            return connectedDevices.count
        default:
            return 0
        }
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        switch segmentControl.selectedSegmentIndex {
        case 0: // History
            let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell", for: indexPath) as! HistoryTableViewCell
            let entry = filteredEntries[indexPath.row]
            cell.configure(with: entry)
            return cell
            
        case 1: // Devices
            let cell = tableView.dequeueReusableCell(withIdentifier: "DeviceCell", for: indexPath) as! DeviceTableViewCell
            let device = connectedDevices[indexPath.row]
            cell.configure(with: device, isSelected: device.id == selectedDeviceId)
            return cell
            
        default:
            return UITableViewCell()
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - UITableViewDelegate
extension HistorySyncViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        switch segmentControl.selectedSegmentIndex {
        case 0: // History
            let entry = filteredEntries[indexPath.row]
            openURL(entry.url)
            
        case 1: // Devices
            let device = connectedDevices[indexPath.row]
            
            if selectedDeviceId == device.id {
                selectedDeviceId = nil
            } else {
                selectedDeviceId = device.id
            }
            
            segmentControl.selectedSegmentIndex = 0
            loadHistory()
            
        default:
            break
        }
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return segmentControl.selectedSegmentIndex == 0 ? 80 : 60
    }
}

// MARK: - UISearchBarDelegate
extension HistorySyncViewController: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        filterHistory(with: searchText)
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
    }
}

// MARK: - HistorySyncManagerDelegate
extension HistorySyncViewController: HistorySyncManagerDelegate {
    func historySyncManager(_ manager: Any, didUpdateHistory entries: [HistoryEntry]) {
        DispatchQueue.main.async {
            self.loadHistory()
            self.updateConnectionStatus(true)
        }
    }
    
    func historySyncManager(_ manager: Any, didUpdateDevices devices: [DeviceInfo]) {
        DispatchQueue.main.async {
            self.connectedDevices = devices
            if self.segmentControl.selectedSegmentIndex == 1 {
                self.tableView.reloadData()
            }
            self.updateConnectionStatus(true)
        }
    }
    
    func historySyncManager(_ manager: Any, didEncounterError error: Error) {
        DispatchQueue.main.async {
            self.showAlert(title: "Sync Error", message: error.localizedDescription)
            self.updateConnectionStatus(false)
        }
    }
}

// MARK: - Custom Table View Cells
class HistoryTableViewCell: UITableViewCell {
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: .subtitle, reuseIdentifier: reuseIdentifier)
        
        textLabel?.font = .systemFont(ofSize: 16, weight: .medium)
        textLabel?.numberOfLines = 2
        detailTextLabel?.font = .systemFont(ofSize: 12)
        detailTextLabel?.textColor = .secondaryLabel
        detailTextLabel?.numberOfLines = 1
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func configure(with entry: HistoryEntry) {
        textLabel?.text = entry.title ?? entry.url
        
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        let dateString = formatter.string(from: entry.visitDate)
        
        detailTextLabel?.text = "\(entry.deviceName) • \(dateString)"
    }
}

class DeviceTableViewCell: UITableViewCell {
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: .subtitle, reuseIdentifier: reuseIdentifier)
        
        textLabel?.font = .systemFont(ofSize: 16, weight: .medium)
        detailTextLabel?.font = .systemFont(ofSize: 12)
        detailTextLabel?.textColor = .secondaryLabel
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func configure(with device: DeviceInfo, isSelected: Bool) {
        textLabel?.text = device.name
        
        if device.isConnected {
            detailTextLabel?.text = "Connected"
            detailTextLabel?.textColor = .systemGreen
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            let dateString = formatter.string(from: device.lastSeen)
            detailTextLabel?.text = "Last seen \(dateString)"
            detailTextLabel?.textColor = .secondaryLabel
        }
        
        accessoryType = isSelected ? .checkmark : .none
    }
}

// MARK: - Configuration Model
struct HistorySyncConfig {
    var signalingServerUrl: String = "ws://localhost:8080"
    var roomId: String = "history-sync-default"
    var sharedSecret: String = ""
    
    var isConfigured: Bool {
        return !signalingServerUrl.isEmpty && !roomId.isEmpty && !sharedSecret.isEmpty
    }
    
    static func load() -> HistorySyncConfig {
        let defaults = UserDefaults.standard
        var config = HistorySyncConfig()
        
        if let url = defaults.string(forKey: "signalingServerUrl") {
            config.signalingServerUrl = url
        }
        if let roomId = defaults.string(forKey: "roomId") {
            config.roomId = roomId
        }
        if let secret = defaults.string(forKey: "sharedSecret") {
            config.sharedSecret = secret
        }
        
        return config
    }
    
    func save() {
        let defaults = UserDefaults.standard
        defaults.set(signalingServerUrl, forKey: "signalingServerUrl")
        defaults.set(roomId, forKey: "roomId")
        defaults.set(sharedSecret, forKey: "sharedSecret")
    }
    
    static func generateSecret() -> String {
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return String((0..<32).map { _ in characters.randomElement()! })
    }
}

// MARK: - HistorySyncManager Extension
extension HistorySyncManager {
    var isConnected: Bool {
        // Add this computed property to check connection status
        return false  // The main app uses a mock implementation
    }
}