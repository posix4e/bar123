/**
 * HistorySyncViewController.swift
 * iOS Native App for Serverless P2P History Sync
 * 
 * Features:
 * - Serverless P2P connections via QR codes
 * - Real-time history synchronization
 * - Search and browse synced history
 * - Device management
 * - No signaling server required
 */

import UIKit
import SafariServices
import os.log

class HistorySyncViewController: UIViewController {
    
    // MARK: - Properties
    private let historySyncManager = HistorySyncManager()
    private let logger = OSLog(subsystem: "com.historysync", category: "HistorySyncViewController")
    
    // UI State
    private var historyEntries: [HistoryEntry] = []
    private var filteredEntries: [HistoryEntry] = []
    private var connectedDevices: [P2PDeviceInfo] = []
    private var selectedDeviceId: String?
    
    // MARK: - UI Components
    private let connectionStatusView = UIView()
    private let connectionStatusLabel = UILabel()
    private let searchBar = UISearchBar()
    private let segmentControl = UISegmentedControl(items: ["History", "Devices"])
    private let tableView = UITableView()
    private let connectButton = UIBarButtonItem(title: "Connect", style: .plain, target: nil, action: nil)
    private let refreshButton = UIBarButtonItem(barButtonSystemItem: .refresh, target: nil, action: nil)
    
    // MARK: - View Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupConstraints()
        setupDelegates()
        
        // Initialize P2P manager
        historySyncManager.initializeP2P()
        updateConnectionStatus()
    }
    
    // MARK: - Setup
    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "History Sync"
        
        // Navigation bar
        navigationItem.rightBarButtonItems = [connectButton, refreshButton]
        connectButton.target = self
        connectButton.action = #selector(connectButtonTapped)
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
        updateConnectionStatus()
        
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
    
    // MARK: - Connection Management
    private func updateConnectionStatus() {
        let devices = historySyncManager.getConnectedDevices()
        let isConnected = !devices.isEmpty
        
        connectionStatusView.backgroundColor = isConnected ? .systemGreen : .systemOrange
        connectionStatusLabel.text = isConnected ? "Connected (\(devices.count) devices)" : "Not Connected"
        
        connectedDevices = devices
        if segmentControl.selectedSegmentIndex == 1 {
            tableView.reloadData()
        }
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
        connectedDevices = historySyncManager.getConnectedDevices()
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
    
    @objc private func connectButtonTapped() {
        showConnectionOptions()
    }
    
    @objc private func refreshButtonTapped() {
        refreshData()
    }
    
    // MARK: - Connection UI
    private func showConnectionOptions() {
        let alert = UIAlertController(title: "P2P Connection", message: "Choose how to connect", preferredStyle: .actionSheet)
        
        let createAction = UIAlertAction(title: "Create New Connection", style: .default) { [weak self] _ in
            self?.showQRConnectionController(mode: .create)
        }
        
        let joinAction = UIAlertAction(title: "Join Existing Connection", style: .default) { [weak self] _ in
            self?.showQRConnectionController(mode: .join)
        }
        
        let disconnectAction = UIAlertAction(title: "Disconnect All", style: .destructive) { [weak self] _ in
            self?.historySyncManager.disconnect()
            self?.updateConnectionStatus()
        }
        
        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel)
        
        alert.addAction(createAction)
        alert.addAction(joinAction)
        
        if !connectedDevices.isEmpty {
            alert.addAction(disconnectAction)
        }
        
        alert.addAction(cancelAction)
        
        if let popover = alert.popoverPresentationController {
            popover.barButtonItem = connectButton
        }
        
        present(alert, animated: true)
    }
    
    private func showQRConnectionController(mode: QRConnectionMode) {
        let qrController = QRConnectionViewController()
        qrController.delegate = self
        
        let navController = UINavigationController(rootViewController: qrController)
        navController.modalPresentationStyle = .fullScreen
        
        present(navController, animated: true) {
            switch mode {
            case .create:
                qrController.startNewConnection()
            case .join:
                qrController.joinExistingConnection()
            }
        }
    }
    
    enum QRConnectionMode {
        case create
        case join
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
            cell.configure(with: device, isSelected: false)
            return cell
            
        default:
            return UITableViewCell()
        }
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
            // Could implement device-specific actions here
            break
            
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
    func historySyncManager(_ manager: HistorySyncManager, didUpdateHistory entries: [HistoryEntry]) {
        DispatchQueue.main.async {
            self.loadHistory()
            self.updateConnectionStatus()
        }
    }
    
    func historySyncManager(_ manager: HistorySyncManager, didUpdateDevices devices: [P2PDeviceInfo]) {
        DispatchQueue.main.async {
            self.connectedDevices = devices
            if self.segmentControl.selectedSegmentIndex == 1 {
                self.tableView.reloadData()
            }
            self.updateConnectionStatus()
        }
    }
    
    func historySyncManager(_ manager: HistorySyncManager, didEncounterError error: Error) {
        DispatchQueue.main.async {
            self.showAlert(title: "Connection Error", message: error.localizedDescription)
            self.updateConnectionStatus()
        }
    }
}

// MARK: - QRConnectionDelegate
extension HistorySyncViewController: QRConnectionDelegate {
    func qrConnectionControllerCreateOffer(_ controller: QRConnectionViewController) {
        historySyncManager.createConnectionOffer { [weak controller] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let offer):
                    controller?.showConnectionOffer(offer)
                case .failure(let error):
                    controller?.dismiss(animated: true) {
                        self.showAlert(title: "Connection Error", message: error.localizedDescription)
                    }
                }
            }
        }
    }
    
    func qrConnectionController(_ controller: QRConnectionViewController, didScanOffer offer: String) {
        historySyncManager.processConnectionOffer(offer) { [weak controller] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let answer):
                    controller?.showConnectionAnswer(answer)
                case .failure(let error):
                    controller?.dismiss(animated: true) {
                        self.showAlert(title: "Connection Error", message: error.localizedDescription)
                    }
                }
            }
        }
    }
    
    func qrConnectionController(_ controller: QRConnectionViewController, didScanAnswer answer: String) {
        historySyncManager.completeConnection(answer) { [weak controller] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    controller?.dismiss(animated: true) {
                        self.showAlert(title: "Success", message: "Connection established!")
                        self.updateConnectionStatus()
                    }
                case .failure(let error):
                    controller?.dismiss(animated: true) {
                        self.showAlert(title: "Connection Error", message: error.localizedDescription)
                    }
                }
            }
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
    
    func configure(with device: P2PDeviceInfo, isSelected: Bool) {
        textLabel?.text = device.name
        detailTextLabel?.text = "Type: \(device.type) • Connected"
        detailTextLabel?.textColor = .systemGreen
        
        accessoryType = isSelected ? .checkmark : .none
    }
}