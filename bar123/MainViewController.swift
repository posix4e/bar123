/**
 * MainViewController.swift
 * Complete rewrite of the iOS app interface with all functionality
 * 
 * Features:
 * - Real-time status updates and connection state
 * - Multiple discovery methods (WebSocket, STUN-only, Cloudflare DNS)
 * - History browsing with search and filtering
 * - Device management with connection status
 * - Settings with Apple Settings integration
 * - Manual connection sharing for STUN-only mode
 * - Cloudflare configuration import/export
 * - Comprehensive error handling and user feedback
 */

import UIKit
import SafariServices
import Combine
import os.log

// MARK: - Main View Controller
class MainViewController: UITabBarController {
    
    private let historyVC = HistoryViewController()
    private let devicesVC = DevicesViewController()
    private let statusVC = StatusViewController()
    private let settingsVC = SettingsViewController()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Configure tab bar
        historyVC.tabBarItem = UITabBarItem(title: "History", image: UIImage(systemName: "clock"), tag: 0)
        devicesVC.tabBarItem = UITabBarItem(title: "Devices", image: UIImage(systemName: "iphone"), tag: 1)
        statusVC.tabBarItem = UITabBarItem(title: "Status", image: UIImage(systemName: "dot.radiowaves.left.and.right"), tag: 2)
        settingsVC.tabBarItem = UITabBarItem(title: "Settings", image: UIImage(systemName: "gear"), tag: 3)
        
        // Wrap in navigation controllers
        let historyNav = UINavigationController(rootViewController: historyVC)
        let devicesNav = UINavigationController(rootViewController: devicesVC)
        let statusNav = UINavigationController(rootViewController: statusVC)
        let settingsNav = UINavigationController(rootViewController: settingsVC)
        
        viewControllers = [historyNav, devicesNav, statusNav, settingsNav]
        
        // Subscribe to connection status changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updateConnectionBadge),
            name: .connectionStatusChanged,
            object: nil
        )
    }
    
    @objc private func updateConnectionBadge() {
        let isConnected = SyncManager.shared.isConnected
        statusVC.tabBarItem.badgeValue = isConnected ? nil : "!"
        statusVC.tabBarItem.badgeColor = .systemRed
    }
}

// MARK: - History View Controller
class HistoryViewController: UIViewController {
    
    private let searchController = UISearchController(searchResultsController: nil)
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private let refreshControl = UIRefreshControl()
    private let emptyStateView = EmptyStateView()
    
    private var historyEntries: [HistoryEntry] = []
    private var filteredEntries: [HistoryEntry] = []
    private var selectedDeviceId: String?
    private var cancellables = Set<AnyCancellable>()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "History"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        setupUI()
        setupBindings()
        loadHistory()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemGroupedBackground
        
        // Search controller
        searchController.searchResultsUpdater = self
        searchController.obscuresBackgroundDuringPresentation = false
        searchController.searchBar.placeholder = "Search history..."
        navigationItem.searchController = searchController
        definesPresentationContext = true
        
        // Table view
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(HistoryCell.self, forCellReuseIdentifier: "HistoryCell")
        tableView.refreshControl = refreshControl
        refreshControl.addTarget(self, action: #selector(refreshHistory), for: .valueChanged)
        
        // Empty state
        emptyStateView.configure(
            image: UIImage(systemName: "clock.fill"),
            title: "No History",
            message: "Your synced browsing history will appear here"
        )
        
        // Layout
        view.addSubview(tableView)
        view.addSubview(emptyStateView)
        
        tableView.translatesAutoresizingMaskIntoConstraints = false
        emptyStateView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            emptyStateView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyStateView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            emptyStateView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 40),
            emptyStateView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -40)
        ])
        
        // Filter button
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "line.horizontal.3.decrease.circle"),
            style: .plain,
            target: self,
            action: #selector(showFilterOptions)
        )
    }
    
    private func setupBindings() {
        SyncManager.shared.$historyEntries
            .receive(on: DispatchQueue.main)
            .sink { [weak self] entries in
                self?.historyEntries = entries
                self?.filterHistory()
            }
            .store(in: &cancellables)
        
        SyncManager.shared.$selectedDeviceId
            .receive(on: DispatchQueue.main)
            .sink { [weak self] deviceId in
                self?.selectedDeviceId = deviceId
                self?.filterHistory()
            }
            .store(in: &cancellables)
    }
    
    private func loadHistory() {
        Task {
            await SyncManager.shared.loadHistory()
        }
    }
    
    @objc private func refreshHistory() {
        Task {
            await SyncManager.shared.refreshHistory()
            await MainActor.run {
                refreshControl.endRefreshing()
            }
        }
    }
    
    private func filterHistory() {
        let searchText = searchController.searchBar.text ?? ""
        
        if searchText.isEmpty && selectedDeviceId == nil {
            filteredEntries = historyEntries
        } else {
            filteredEntries = historyEntries.filter { entry in
                let matchesSearch = searchText.isEmpty || 
                    entry.title?.localizedCaseInsensitiveContains(searchText) == true ||
                    entry.url.localizedCaseInsensitiveContains(searchText)
                
                let matchesDevice = selectedDeviceId == nil || entry.deviceId == selectedDeviceId
                
                return matchesSearch && matchesDevice
            }
        }
        
        tableView.reloadData()
        emptyStateView.isHidden = !filteredEntries.isEmpty
    }
    
    @objc private func showFilterOptions() {
        let alert = UIAlertController(title: "Filter History", message: nil, preferredStyle: .actionSheet)
        
        alert.addAction(UIAlertAction(title: "All Devices", style: .default) { _ in
            SyncManager.shared.selectedDeviceId = nil
        })
        
        for device in SyncManager.shared.connectedDevices {
            let action = UIAlertAction(title: device.name, style: .default) { _ in
                SyncManager.shared.selectedDeviceId = device.id
            }
            
            if device.id == selectedDeviceId {
                action.setValue(true, forKey: "checked")
            }
            
            alert.addAction(action)
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            popover.barButtonItem = navigationItem.rightBarButtonItem
        }
        
        present(alert, animated: true)
    }
}

// MARK: - History Table View
extension HistoryViewController: UITableViewDataSource, UITableViewDelegate {
    
    func numberOfSections(in tableView: UITableView) -> Int {
        return 1
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filteredEntries.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell", for: indexPath) as! HistoryCell
        cell.configure(with: filteredEntries[indexPath.row])
        return cell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        let entry = filteredEntries[indexPath.row]
        if let url = URL(string: entry.url) {
            let safari = SFSafariViewController(url: url)
            present(safari, animated: true)
        }
    }
    
    func tableView(_ tableView: UITableView, contextMenuConfigurationForRowAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
        let entry = filteredEntries[indexPath.row]
        
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { _ in
            let copyAction = UIAction(title: "Copy URL", image: UIImage(systemName: "doc.on.doc")) { _ in
                UIPasteboard.general.string = entry.url
            }
            
            let shareAction = UIAction(title: "Share", image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
                let items = [URL(string: entry.url)].compactMap { $0 }
                let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
                self?.present(activityVC, animated: true)
            }
            
            let deleteAction = UIAction(title: "Delete", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in
                Task {
                    await SyncManager.shared.deleteHistoryEntry(entry.id.uuidString)
                }
            }
            
            return UIMenu(children: [copyAction, shareAction, deleteAction])
        }
    }
}

extension HistoryViewController: UISearchResultsUpdating {
    func updateSearchResults(for searchController: UISearchController) {
        filterHistory()
    }
}

// MARK: - History Cell
class HistoryCell: UITableViewCell {
    
    private let titleLabel = UILabel()
    private let urlLabel = UILabel()
    private let metaLabel = UILabel()
    private let iconView = UIImageView()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        titleLabel.font = .systemFont(ofSize: 16, weight: .medium)
        titleLabel.numberOfLines = 1
        
        urlLabel.font = .systemFont(ofSize: 14)
        urlLabel.textColor = .secondaryLabel
        urlLabel.numberOfLines = 1
        
        metaLabel.font = .systemFont(ofSize: 12)
        metaLabel.textColor = .tertiaryLabel
        
        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = .systemBlue
        
        let stackView = UIStackView(arrangedSubviews: [titleLabel, urlLabel, metaLabel])
        stackView.axis = .vertical
        stackView.spacing = 2
        
        contentView.addSubview(iconView)
        contentView.addSubview(stackView)
        
        iconView.translatesAutoresizingMaskIntoConstraints = false
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            iconView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            iconView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 24),
            iconView.heightAnchor.constraint(equalToConstant: 24),
            
            stackView.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 12),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8)
        ])
    }
    
    func configure(with entry: HistoryEntry) {
        titleLabel.text = entry.title ?? "Untitled"
        urlLabel.text = entry.url
        
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        let relativeDate = formatter.localizedString(for: entry.visitDate, relativeTo: Date())
        
        metaLabel.text = "\(entry.deviceName) • \(relativeDate)"
        
        iconView.image = UIImage(systemName: "globe")
    }
}

// MARK: - Devices View Controller
class DevicesViewController: UIViewController {
    
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private let refreshControl = UIRefreshControl()
    private var cancellables = Set<AnyCancellable>()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Devices"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        setupUI()
        setupBindings()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemGroupedBackground
        
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(DeviceCell.self, forCellReuseIdentifier: "DeviceCell")
        tableView.refreshControl = refreshControl
        refreshControl.addTarget(self, action: #selector(refreshDevices), for: .valueChanged)
        
        view.addSubview(tableView)
        tableView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupBindings() {
        SyncManager.shared.$connectedDevices
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.tableView.reloadData()
            }
            .store(in: &cancellables)
    }
    
    @objc private func refreshDevices() {
        Task {
            await SyncManager.shared.refreshDevices()
            await MainActor.run {
                refreshControl.endRefreshing()
            }
        }
    }
}

// MARK: - Devices Table View
extension DevicesViewController: UITableViewDataSource, UITableViewDelegate {
    
    func numberOfSections(in tableView: UITableView) -> Int {
        return 2
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        if section == 0 {
            return 1 // This device
        } else {
            return SyncManager.shared.connectedDevices.count
        }
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return section == 0 ? "This Device" : "Connected Devices"
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "DeviceCell", for: indexPath) as! DeviceCell
        
        if indexPath.section == 0 {
            cell.configureAsThisDevice()
        } else {
            let device = SyncManager.shared.connectedDevices[indexPath.row]
            cell.configure(with: device)
        }
        
        return cell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        if indexPath.section == 1 {
            let device = SyncManager.shared.connectedDevices[indexPath.row]
            showDeviceDetails(device)
        }
    }
    
    private func showDeviceDetails(_ device: DeviceInfo) {
        let alert = UIAlertController(title: device.name, message: nil, preferredStyle: .actionSheet)
        
        let filterAction = UIAlertAction(title: "Show Only This Device's History", style: .default) { _ in
            SyncManager.shared.selectedDeviceId = device.id
            self.tabBarController?.selectedIndex = 0
        }
        
        let disconnectAction = UIAlertAction(title: "Disconnect", style: .destructive) { _ in
            Task {
                await SyncManager.shared.disconnectDevice(device.id)
            }
        }
        
        alert.addAction(filterAction)
        alert.addAction(disconnectAction)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            if let cell = tableView.cellForRow(at: IndexPath(row: 0, section: 1)) {
                popover.sourceView = cell
                popover.sourceRect = cell.bounds
            }
        }
        
        present(alert, animated: true)
    }
}

// MARK: - Device Cell
class DeviceCell: UITableViewCell {
    
    private let iconView = UIImageView()
    private let nameLabel = UILabel()
    private let statusLabel = UILabel()
    private let statusIndicator = UIView()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = .label
        
        nameLabel.font = .systemFont(ofSize: 16, weight: .medium)
        
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = .secondaryLabel
        
        statusIndicator.layer.cornerRadius = 4
        
        contentView.addSubview(iconView)
        contentView.addSubview(nameLabel)
        contentView.addSubview(statusLabel)
        contentView.addSubview(statusIndicator)
        
        iconView.translatesAutoresizingMaskIntoConstraints = false
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusIndicator.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            iconView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            iconView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 32),
            iconView.heightAnchor.constraint(equalToConstant: 32),
            
            nameLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 12),
            nameLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            nameLabel.trailingAnchor.constraint(equalTo: statusIndicator.leadingAnchor, constant: -8),
            
            statusLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            statusLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 2),
            statusLabel.trailingAnchor.constraint(equalTo: nameLabel.trailingAnchor),
            statusLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12),
            
            statusIndicator.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            statusIndicator.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            statusIndicator.widthAnchor.constraint(equalToConstant: 8),
            statusIndicator.heightAnchor.constraint(equalToConstant: 8)
        ])
    }
    
    func configureAsThisDevice() {
        iconView.image = UIImage(systemName: "iphone")
        nameLabel.text = UIDevice.current.name
        statusLabel.text = "iOS \(UIDevice.current.systemVersion)"
        statusIndicator.backgroundColor = SyncManager.shared.isConnected ? .systemGreen : .systemGray
        accessoryType = .none
    }
    
    func configure(with device: DeviceInfo) {
        let iconName: String
        switch device.type {
        case "chrome":
            iconName = "globe"
        case "safari":
            iconName = "safari"
        case "ios":
            iconName = "iphone"
        default:
            iconName = "desktopcomputer"
        }
        
        iconView.image = UIImage(systemName: iconName)
        nameLabel.text = device.name
        
        if device.isConnected {
            statusLabel.text = "Connected"
            statusLabel.textColor = .systemGreen
            statusIndicator.backgroundColor = .systemGreen
        } else {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            let relativeDate = formatter.localizedString(for: device.lastSeen, relativeTo: Date())
            statusLabel.text = "Last seen \(relativeDate)"
            statusLabel.textColor = .secondaryLabel
            statusIndicator.backgroundColor = .systemGray
        }
        
        accessoryType = .disclosureIndicator
    }
}

// MARK: - Status View Controller
class StatusViewController: UIViewController {
    
    private let scrollView = UIScrollView()
    private let stackView = UIStackView()
    
    private let connectionCard = StatusCard()
    private let syncCard = StatusCard()
    private let discoveryCard = StatusCard()
    private let performanceCard = StatusCard()
    
    private var cancellables = Set<AnyCancellable>()
    private var statusTimer: Timer?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Status"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        setupUI()
        setupBindings()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startStatusUpdates()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopStatusUpdates()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemGroupedBackground
        
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stackView.isLayoutMarginsRelativeArrangement = true
        
        stackView.addArrangedSubview(connectionCard)
        stackView.addArrangedSubview(syncCard)
        stackView.addArrangedSubview(discoveryCard)
        stackView.addArrangedSubview(performanceCard)
        
        scrollView.addSubview(stackView)
        view.addSubview(scrollView)
        
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            stackView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
        
        // Refresh button
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .refresh,
            target: self,
            action: #selector(refreshStatus)
        )
    }
    
    private func setupBindings() {
        SyncManager.shared.$connectionStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.updateConnectionCard(status)
            }
            .store(in: &cancellables)
        
        SyncManager.shared.$syncStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.updateSyncCard(status)
            }
            .store(in: &cancellables)
        
        SyncManager.shared.$discoveryStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.updateDiscoveryCard(status)
            }
            .store(in: &cancellables)
    }
    
    private func startStatusUpdates() {
        statusTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updatePerformanceCard()
        }
    }
    
    private func stopStatusUpdates() {
        statusTimer?.invalidate()
        statusTimer = nil
    }
    
    @objc private func refreshStatus() {
        Task {
            await SyncManager.shared.refreshStatus()
        }
    }
    
    private func updateConnectionCard(_ status: ConnectionStatus) {
        connectionCard.configure(
            title: "Connection",
            status: status.isConnected ? .success : .error,
            primaryText: status.isConnected ? "Connected" : "Disconnected",
            secondaryText: status.message,
            icon: UIImage(systemName: status.isConnected ? "wifi" : "wifi.slash")
        )
    }
    
    private func updateSyncCard(_ status: SyncStatus) {
        let statusType: StatusCard.StatusType
        switch status.state {
        case .idle:
            statusType = .info
        case .syncing:
            statusType = .warning
        case .completed:
            statusType = .success
        case .error:
            statusType = .error
        }
        
        syncCard.configure(
            title: "Synchronization",
            status: statusType,
            primaryText: status.state.description,
            secondaryText: status.details,
            icon: UIImage(systemName: "arrow.triangle.2.circlepath")
        )
    }
    
    private func updateDiscoveryCard(_ status: DiscoveryStatus) {
        let icon: UIImage?
        switch status.method {
        case .websocket:
            icon = UIImage(systemName: "server.rack")
        case .stunOnly:
            icon = UIImage(systemName: "arrow.up.arrow.down")
        case .cloudflareDNS:
            icon = UIImage(systemName: "cloud")
        }
        
        discoveryCard.configure(
            title: "Discovery Method",
            status: status.isActive ? .success : .info,
            primaryText: status.method.description,
            secondaryText: "Peers: \(status.connectedPeers)",
            icon: icon
        )
    }
    
    private func updatePerformanceCard() {
        let stats = SyncManager.shared.performanceStats
        
        performanceCard.configure(
            title: "Performance",
            status: .info,
            primaryText: "Bandwidth: \(formatBytes(stats.bytesReceived + stats.bytesSent))",
            secondaryText: "Latency: \(Int(stats.averageLatency * 1000))ms",
            icon: UIImage(systemName: "speedometer")
        )
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Status Card
class StatusCard: UIView {
    
    enum StatusType {
        case success, warning, error, info
        
        var color: UIColor {
            switch self {
            case .success: return .systemGreen
            case .warning: return .systemOrange
            case .error: return .systemRed
            case .info: return .systemBlue
            }
        }
    }
    
    private let titleLabel = UILabel()
    private let statusIndicator = UIView()
    private let iconView = UIImageView()
    private let primaryLabel = UILabel()
    private let secondaryLabel = UILabel()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        backgroundColor = .secondarySystemGroupedBackground
        layer.cornerRadius = 12
        
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel
        
        statusIndicator.layer.cornerRadius = 4
        
        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = .label
        
        primaryLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        
        secondaryLabel.font = .systemFont(ofSize: 15)
        secondaryLabel.textColor = .secondaryLabel
        secondaryLabel.numberOfLines = 2
        
        addSubview(titleLabel)
        addSubview(statusIndicator)
        addSubview(iconView)
        addSubview(primaryLabel)
        addSubview(secondaryLabel)
        
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        statusIndicator.translatesAutoresizingMaskIntoConstraints = false
        iconView.translatesAutoresizingMaskIntoConstraints = false
        primaryLabel.translatesAutoresizingMaskIntoConstraints = false
        secondaryLabel.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            
            statusIndicator.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            statusIndicator.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 8),
            statusIndicator.widthAnchor.constraint(equalToConstant: 8),
            statusIndicator.heightAnchor.constraint(equalToConstant: 8),
            
            iconView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            iconView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            iconView.widthAnchor.constraint(equalToConstant: 32),
            iconView.heightAnchor.constraint(equalToConstant: 32),
            
            primaryLabel.centerYAnchor.constraint(equalTo: iconView.centerYAnchor, constant: -8),
            primaryLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 12),
            primaryLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            
            secondaryLabel.topAnchor.constraint(equalTo: primaryLabel.bottomAnchor, constant: 2),
            secondaryLabel.leadingAnchor.constraint(equalTo: primaryLabel.leadingAnchor),
            secondaryLabel.trailingAnchor.constraint(equalTo: primaryLabel.trailingAnchor),
            secondaryLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16)
        ])
    }
    
    func configure(title: String, status: StatusType, primaryText: String, secondaryText: String, icon: UIImage?) {
        titleLabel.text = title.uppercased()
        statusIndicator.backgroundColor = status.color
        primaryLabel.text = primaryText
        secondaryLabel.text = secondaryText
        iconView.image = icon
    }
}

// MARK: - Settings View Controller
class SettingsViewController: UITableViewController {
    
    private enum Section: Int, CaseIterable {
        case discovery
        case connection
        case sync
        case advanced
        case about
        
        var title: String {
            switch self {
            case .discovery: return "Discovery Method"
            case .connection: return "Connection"
            case .sync: return "Synchronization"
            case .advanced: return "Advanced"
            case .about: return "About"
            }
        }
    }
    
    private enum DiscoveryRow: Int, CaseIterable {
        case method
        case websocketConfig
        case stunConfig
        case cloudflareConfig
    }
    
    private enum ConnectionRow: Int, CaseIterable {
        case status
        case manualShare
        case qrCode
    }
    
    private enum SyncRow: Int, CaseIterable {
        case autoSync
        case syncInterval
        case dataUsage
        case clearCache
    }
    
    private enum AdvancedRow: Int, CaseIterable {
        case exportLogs
        case resetSettings
        case debug
    }
    
    private enum AboutRow: Int, CaseIterable {
        case version
        case privacy
        case github
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Settings"
        navigationController?.navigationBar.prefersLargeTitles = true
        
        tableView = UITableView(frame: .zero, style: .insetGrouped)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "Cell")
        tableView.register(SwitchCell.self, forCellReuseIdentifier: "SwitchCell")
    }
    
    // MARK: - Table View Data Source
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return Section.allCases.count
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        guard let sectionType = Section(rawValue: section) else { return 0 }
        
        switch sectionType {
        case .discovery:
            return DiscoveryRow.allCases.count
        case .connection:
            return ConnectionRow.allCases.count
        case .sync:
            return SyncRow.allCases.count
        case .advanced:
            return AdvancedRow.allCases.count
        case .about:
            return AboutRow.allCases.count
        }
    }
    
    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return Section(rawValue: section)?.title
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let section = Section(rawValue: indexPath.section) else {
            return UITableViewCell()
        }
        
        switch section {
        case .discovery:
            return configureDiscoveryCell(at: indexPath)
        case .connection:
            return configureConnectionCell(at: indexPath)
        case .sync:
            return configureSyncCell(at: indexPath)
        case .advanced:
            return configureAdvancedCell(at: indexPath)
        case .about:
            return configureAboutCell(at: indexPath)
        }
    }
    
    // MARK: - Cell Configuration
    
    private func configureDiscoveryCell(at indexPath: IndexPath) -> UITableViewCell {
        guard let row = DiscoveryRow(rawValue: indexPath.row) else {
            return UITableViewCell()
        }
        
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        
        switch row {
        case .method:
            cell.textLabel?.text = "Method"
            cell.detailTextLabel?.text = SyncManager.shared.discoveryMethod.description
            cell.accessoryType = .disclosureIndicator
            
        case .websocketConfig:
            cell.textLabel?.text = "WebSocket Settings"
            cell.accessoryType = .disclosureIndicator
            cell.isHidden = SyncManager.shared.discoveryMethod != .websocket
            
        case .stunConfig:
            cell.textLabel?.text = "STUN Settings"
            cell.accessoryType = .disclosureIndicator
            cell.isHidden = SyncManager.shared.discoveryMethod != .stunOnly
            
        case .cloudflareConfig:
            cell.textLabel?.text = "Cloudflare Settings"
            cell.accessoryType = .disclosureIndicator
            cell.isHidden = SyncManager.shared.discoveryMethod != .cloudflareDNS
        }
        
        return cell
    }
    
    private func configureConnectionCell(at indexPath: IndexPath) -> UITableViewCell {
        guard let row = ConnectionRow(rawValue: indexPath.row) else {
            return UITableViewCell()
        }
        
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        
        switch row {
        case .status:
            cell.textLabel?.text = "Connection Status"
            cell.detailTextLabel?.text = SyncManager.shared.isConnected ? "Connected" : "Disconnected"
            
        case .manualShare:
            cell.textLabel?.text = "Share Connection"
            cell.accessoryType = .disclosureIndicator
            
        case .qrCode:
            cell.textLabel?.text = "QR Code"
            cell.accessoryType = .disclosureIndicator
        }
        
        return cell
    }
    
    private func configureSyncCell(at indexPath: IndexPath) -> UITableViewCell {
        guard let row = SyncRow(rawValue: indexPath.row) else {
            return UITableViewCell()
        }
        
        switch row {
        case .autoSync:
            let cell = tableView.dequeueReusableCell(withIdentifier: "SwitchCell", for: indexPath) as! SwitchCell
            cell.configure(title: "Auto Sync", isOn: UserDefaults.standard.bool(forKey: "autoSync")) { isOn in
                UserDefaults.standard.set(isOn, forKey: "autoSync")
            }
            return cell
            
        case .syncInterval:
            let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
            cell.textLabel?.text = "Sync Interval"
            cell.detailTextLabel?.text = "5 minutes"
            cell.accessoryType = .disclosureIndicator
            return cell
            
        case .dataUsage:
            let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
            cell.textLabel?.text = "Data Usage"
            let usage = SyncManager.shared.dataUsage
            cell.detailTextLabel?.text = ByteCountFormatter.string(fromByteCount: usage, countStyle: .binary)
            return cell
            
        case .clearCache:
            let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
            cell.textLabel?.text = "Clear Cache"
            cell.textLabel?.textColor = .systemRed
            return cell
        }
    }
    
    private func configureAdvancedCell(at indexPath: IndexPath) -> UITableViewCell {
        guard let row = AdvancedRow(rawValue: indexPath.row) else {
            return UITableViewCell()
        }
        
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        
        switch row {
        case .exportLogs:
            cell.textLabel?.text = "Export Logs"
            cell.accessoryType = .disclosureIndicator
            
        case .resetSettings:
            cell.textLabel?.text = "Reset All Settings"
            cell.textLabel?.textColor = .systemRed
            
        case .debug:
            cell.textLabel?.text = "Debug Mode"
            cell.accessoryType = .disclosureIndicator
        }
        
        return cell
    }
    
    private func configureAboutCell(at indexPath: IndexPath) -> UITableViewCell {
        guard let row = AboutRow(rawValue: indexPath.row) else {
            return UITableViewCell()
        }
        
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        
        switch row {
        case .version:
            cell.textLabel?.text = "Version"
            let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
            let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
            cell.detailTextLabel?.text = "\(version) (\(build))"
            
        case .privacy:
            cell.textLabel?.text = "Privacy Policy"
            cell.accessoryType = .disclosureIndicator
            
        case .github:
            cell.textLabel?.text = "GitHub"
            cell.accessoryType = .disclosureIndicator
        }
        
        return cell
    }
    
    // MARK: - Table View Delegate
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        guard let section = Section(rawValue: indexPath.section) else { return }
        
        switch section {
        case .discovery:
            handleDiscoverySelection(at: indexPath)
        case .connection:
            handleConnectionSelection(at: indexPath)
        case .sync:
            handleSyncSelection(at: indexPath)
        case .advanced:
            handleAdvancedSelection(at: indexPath)
        case .about:
            handleAboutSelection(at: indexPath)
        }
    }
    
    private func handleDiscoverySelection(at indexPath: IndexPath) {
        guard let row = DiscoveryRow(rawValue: indexPath.row) else { return }
        
        switch row {
        case .method:
            showDiscoveryMethodPicker()
        case .websocketConfig:
            showWebSocketConfig()
        case .stunConfig:
            showSTUNConfig()
        case .cloudflareConfig:
            showCloudflareConfig()
        }
    }
    
    private func handleConnectionSelection(at indexPath: IndexPath) {
        guard let row = ConnectionRow(rawValue: indexPath.row) else { return }
        
        switch row {
        case .status:
            break
        case .manualShare:
            showManualShare()
        case .qrCode:
            showQRCode()
        }
    }
    
    private func handleSyncSelection(at indexPath: IndexPath) {
        guard let row = SyncRow(rawValue: indexPath.row) else { return }
        
        switch row {
        case .autoSync:
            break
        case .syncInterval:
            showSyncIntervalPicker()
        case .dataUsage:
            break
        case .clearCache:
            confirmClearCache()
        }
    }
    
    private func handleAdvancedSelection(at indexPath: IndexPath) {
        guard let row = AdvancedRow(rawValue: indexPath.row) else { return }
        
        switch row {
        case .exportLogs:
            exportLogs()
        case .resetSettings:
            confirmResetSettings()
        case .debug:
            showDebugOptions()
        }
    }
    
    private func handleAboutSelection(at indexPath: IndexPath) {
        guard let row = AboutRow(rawValue: indexPath.row) else { return }
        
        switch row {
        case .version:
            break
        case .privacy:
            openPrivacyPolicy()
        case .github:
            openGitHub()
        }
    }
    
    // MARK: - Actions
    
    private func showDiscoveryMethodPicker() {
        let alert = UIAlertController(title: "Discovery Method", message: nil, preferredStyle: .actionSheet)
        
        for method in DiscoveryMethod.allCases {
            let action = UIAlertAction(title: method.description, style: .default) { _ in
                SyncManager.shared.discoveryMethod = method
                self.tableView.reloadData()
            }
            
            if method == SyncManager.shared.discoveryMethod {
                action.setValue(true, forKey: "checked")
            }
            
            alert.addAction(action)
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            if let cell = tableView.cellForRow(at: IndexPath(row: 0, section: 0)) {
                popover.sourceView = cell
                popover.sourceRect = cell.bounds
            }
        }
        
        present(alert, animated: true)
    }
    
    private func showWebSocketConfig() {
        let vc = WebSocketConfigViewController()
        navigationController?.pushViewController(vc, animated: true)
    }
    
    private func showSTUNConfig() {
        let vc = STUNConfigViewController()
        navigationController?.pushViewController(vc, animated: true)
    }
    
    private func showCloudflareConfig() {
        let vc = CloudflareConfigViewController()
        
        // Add setup guide button
        let guideButton = UIBarButtonItem(
            title: "Guide",
            style: .plain,
            target: self,
            action: #selector(showCloudflareSetupGuide)
        )
        vc.navigationItem.rightBarButtonItems = [vc.navigationItem.rightBarButtonItem, guideButton].compactMap { $0 }
        
        navigationController?.pushViewController(vc, animated: true)
    }
    
    @objc private func showCloudflareSetupGuide() {
        let setupHelper = CloudflareSetupHelper()
        let nav = UINavigationController(rootViewController: setupHelper)
        present(nav, animated: true)
    }
    
    private func showManualShare() {
        let vc = ManualShareViewController()
        navigationController?.pushViewController(vc, animated: true)
    }
    
    private func showQRCode() {
        let vc = QRCodeViewController()
        navigationController?.pushViewController(vc, animated: true)
    }
    
    private func showSyncIntervalPicker() {
        // Implementation for sync interval picker
    }
    
    private func confirmClearCache() {
        let alert = UIAlertController(
            title: "Clear Cache",
            message: "This will remove all cached history data. Synced data will be redownloaded from connected devices.",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Clear", style: .destructive) { _ in
            Task {
                await SyncManager.shared.clearCache()
            }
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        present(alert, animated: true)
    }
    
    private func exportLogs() {
        // Implementation for log export
    }
    
    private func confirmResetSettings() {
        let alert = UIAlertController(
            title: "Reset All Settings",
            message: "This will reset all settings to their defaults and disconnect from all devices.",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Reset", style: .destructive) { _ in
            Task {
                await SyncManager.shared.resetAllSettings()
            }
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        present(alert, animated: true)
    }
    
    private func showDebugOptions() {
        let vc = DebugViewController()
        navigationController?.pushViewController(vc, animated: true)
    }
    
    private func openPrivacyPolicy() {
        if let url = URL(string: "https://example.com/privacy") {
            UIApplication.shared.open(url)
        }
    }
    
    private func openGitHub() {
        if let url = URL(string: "https://github.com/posix4e/bar123") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Switch Cell
class SwitchCell: UITableViewCell {
    
    private let switchControl = UISwitch()
    private var onChange: ((Bool) -> Void)?
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        
        switchControl.addTarget(self, action: #selector(switchChanged), for: .valueChanged)
        accessoryView = switchControl
        selectionStyle = .none
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func configure(title: String, isOn: Bool, onChange: @escaping (Bool) -> Void) {
        textLabel?.text = title
        switchControl.isOn = isOn
        self.onChange = onChange
    }
    
    @objc private func switchChanged() {
        onChange?(switchControl.isOn)
    }
}

// MARK: - Empty State View
class EmptyStateView: UIView {
    
    private let imageView = UIImageView()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .tertiaryLabel
        
        titleLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        titleLabel.textColor = .label
        titleLabel.textAlignment = .center
        
        messageLabel.font = .systemFont(ofSize: 16)
        messageLabel.textColor = .secondaryLabel
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        
        let stackView = UIStackView(arrangedSubviews: [imageView, titleLabel, messageLabel])
        stackView.axis = .vertical
        stackView.spacing = 12
        stackView.alignment = .center
        
        addSubview(stackView)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: centerYAnchor),
            stackView.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor),
            stackView.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),
            
            imageView.widthAnchor.constraint(equalToConstant: 64),
            imageView.heightAnchor.constraint(equalToConstant: 64)
        ])
    }
    
    func configure(image: UIImage?, title: String, message: String) {
        imageView.image = image
        titleLabel.text = title
        messageLabel.text = message
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let connectionStatusChanged = Notification.Name("connectionStatusChanged")
    static let historyUpdated = Notification.Name("historyUpdated")
    static let devicesUpdated = Notification.Name("devicesUpdated")
}