//
//  SimpleViewController.swift
//  bar123
//
//  Simplified single-view controller for the entire app
//

import UIKit

class SimpleViewController: UIViewController {
    
    // MARK: - UI Elements
    
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let stackView = UIStackView()
    
    // Status Section
    private let statusCard = UIView()
    private let statusLabel = UILabel()
    private let connectionIndicator = UIView()
    private let roomLabel = UILabel()
    
    // Configuration Section
    private let configCard = UIView()
    private let configToggle = UISwitch()
    private let configButton = UIButton(type: .system)
    
    // History Section
    private let historyCard = UIView()
    private let searchBar = UISearchBar()
    private let historyTable = UITableView()
    
    // Data
    private var historyEntries: [HistoryEntry] = []
    private var filteredEntries: [HistoryEntry] = []
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadData()
        observeChanges()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        title = "bar123"
        view.backgroundColor = .systemBackground
        
        // Navigation items
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "gear"),
            style: .plain,
            target: self,
            action: #selector(showSettings)
        )
        
        // Main layout
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)
        contentView.addSubview(stackView)
        
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -16)
        ])
        
        stackView.axis = .vertical
        stackView.spacing = 16
        
        setupStatusCard()
        setupConfigCard()
        setupHistoryCard()
    }
    
    private func setupStatusCard() {
        statusCard.backgroundColor = .secondarySystemBackground
        statusCard.layer.cornerRadius = 12
        
        connectionIndicator.backgroundColor = .systemRed
        connectionIndicator.layer.cornerRadius = 6
        connectionIndicator.translatesAutoresizingMaskIntoConstraints = false
        
        statusLabel.text = "Disconnected"
        statusLabel.font = .systemFont(ofSize: 18, weight: .medium)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        
        roomLabel.text = "Room: Not configured"
        roomLabel.font = .systemFont(ofSize: 14)
        roomLabel.textColor = .secondaryLabel
        roomLabel.translatesAutoresizingMaskIntoConstraints = false
        
        statusCard.addSubview(connectionIndicator)
        statusCard.addSubview(statusLabel)
        statusCard.addSubview(roomLabel)
        
        NSLayoutConstraint.activate([
            statusCard.heightAnchor.constraint(equalToConstant: 80),
            
            connectionIndicator.leadingAnchor.constraint(equalTo: statusCard.leadingAnchor, constant: 16),
            connectionIndicator.centerYAnchor.constraint(equalTo: statusCard.centerYAnchor),
            connectionIndicator.widthAnchor.constraint(equalToConstant: 12),
            connectionIndicator.heightAnchor.constraint(equalToConstant: 12),
            
            statusLabel.leadingAnchor.constraint(equalTo: connectionIndicator.trailingAnchor, constant: 12),
            statusLabel.topAnchor.constraint(equalTo: statusCard.topAnchor, constant: 20),
            
            roomLabel.leadingAnchor.constraint(equalTo: statusLabel.leadingAnchor),
            roomLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 4)
        ])
        
        stackView.addArrangedSubview(statusCard)
    }
    
    private func setupConfigCard() {
        configCard.backgroundColor = .secondarySystemBackground
        configCard.layer.cornerRadius = 12
        
        let label = UILabel()
        label.text = "Cloudflare DNS Discovery"
        label.font = .systemFont(ofSize: 16)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        configToggle.isOn = UserDefaults.standard.bool(forKey: "cloudflareEnabled")
        configToggle.addTarget(self, action: #selector(toggleChanged), for: .valueChanged)
        configToggle.translatesAutoresizingMaskIntoConstraints = false
        
        configButton.setTitle("Configure", for: .normal)
        configButton.addTarget(self, action: #selector(showSettings), for: .touchUpInside)
        configButton.translatesAutoresizingMaskIntoConstraints = false
        
        configCard.addSubview(label)
        configCard.addSubview(configToggle)
        configCard.addSubview(configButton)
        
        NSLayoutConstraint.activate([
            configCard.heightAnchor.constraint(equalToConstant: 60),
            
            label.leadingAnchor.constraint(equalTo: configCard.leadingAnchor, constant: 16),
            label.centerYAnchor.constraint(equalTo: configCard.centerYAnchor),
            
            configToggle.trailingAnchor.constraint(equalTo: configCard.trailingAnchor, constant: -16),
            configToggle.centerYAnchor.constraint(equalTo: configCard.centerYAnchor),
            
            configButton.trailingAnchor.constraint(equalTo: configToggle.leadingAnchor, constant: -12),
            configButton.centerYAnchor.constraint(equalTo: configCard.centerYAnchor)
        ])
        
        stackView.addArrangedSubview(configCard)
    }
    
    private func setupHistoryCard() {
        historyCard.backgroundColor = .secondarySystemBackground
        historyCard.layer.cornerRadius = 12
        historyCard.translatesAutoresizingMaskIntoConstraints = false
        
        searchBar.placeholder = "Search history..."
        searchBar.delegate = self
        searchBar.searchBarStyle = .minimal
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        
        historyTable.dataSource = self
        historyTable.delegate = self
        historyTable.backgroundColor = .clear
        historyTable.translatesAutoresizingMaskIntoConstraints = false
        
        historyCard.addSubview(searchBar)
        historyCard.addSubview(historyTable)
        
        NSLayoutConstraint.activate([
            historyCard.heightAnchor.constraint(greaterThanOrEqualToConstant: 400),
            
            searchBar.topAnchor.constraint(equalTo: historyCard.topAnchor, constant: 8),
            searchBar.leadingAnchor.constraint(equalTo: historyCard.leadingAnchor, constant: 8),
            searchBar.trailingAnchor.constraint(equalTo: historyCard.trailingAnchor, constant: -8),
            
            historyTable.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 8),
            historyTable.leadingAnchor.constraint(equalTo: historyCard.leadingAnchor),
            historyTable.trailingAnchor.constraint(equalTo: historyCard.trailingAnchor),
            historyTable.bottomAnchor.constraint(equalTo: historyCard.bottomAnchor)
        ])
        
        stackView.addArrangedSubview(historyCard)
    }
    
    // MARK: - Data
    
    private func loadData() {
        historyEntries = SyncManager.shared.historyEntries
        filteredEntries = historyEntries
        historyTable.reloadData()
        updateStatus()
    }
    
    private func observeChanges() {
        // Observe sync manager changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(syncStateChanged),
            name: NSNotification.Name("SyncStateChanged"),
            object: nil
        )
    }
    
    private func updateStatus() {
        let status = SyncManager.shared.connectionStatus
        
        statusLabel.text = status.isConnected ? "Connected" : "Disconnected"
        connectionIndicator.backgroundColor = status.isConnected ? .systemGreen : .systemRed
        
        let roomId = UserDefaults.standard.string(forKey: "roomId") ?? "Not configured"
        roomLabel.text = "Room: \(roomId)"
        
        let peerCount = SyncManager.shared.connectedDevices.count
        if status.isConnected && peerCount > 0 {
            statusLabel.text = "Connected (\(peerCount) peer\(peerCount == 1 ? "" : "s"))"
        }
    }
    
    // MARK: - Actions
    
    @objc private func showSettings() {
        let alert = UIAlertController(title: "Cloudflare Settings", message: nil, preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "API Token"
            textField.text = UserDefaults.standard.string(forKey: "cloudflareApiToken")
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Zone ID"
            textField.text = UserDefaults.standard.string(forKey: "cloudflareZoneId")
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Domain"
            textField.text = UserDefaults.standard.string(forKey: "cloudflareDomain")
        }
        
        alert.addTextField { textField in
            textField.placeholder = "Room ID"
            textField.text = UserDefaults.standard.string(forKey: "roomId")
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Save", style: .default) { _ in
            if let apiToken = alert.textFields?[0].text,
               let zoneId = alert.textFields?[1].text,
               let domain = alert.textFields?[2].text,
               let roomId = alert.textFields?[3].text {
                
                UserDefaults.standard.set(apiToken, forKey: "cloudflareApiToken")
                UserDefaults.standard.set(zoneId, forKey: "cloudflareZoneId")
                UserDefaults.standard.set(domain, forKey: "cloudflareDomain")
                UserDefaults.standard.set(roomId, forKey: "roomId")
                
                // Restart sync with new settings
                Task {
                    await SyncManager.shared.restart()
                }
            }
        })
        
        present(alert, animated: true)
    }
    
    @objc private func toggleChanged() {
        UserDefaults.standard.set(configToggle.isOn, forKey: "cloudflareEnabled")
        
        Task {
            if configToggle.isOn {
                await SyncManager.shared.start()
            } else {
                await SyncManager.shared.stop()
            }
        }
    }
    
    @objc private func syncStateChanged() {
        DispatchQueue.main.async {
            self.loadData()
        }
    }
}

// MARK: - Table View

extension SimpleViewController: UITableViewDataSource, UITableViewDelegate {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filteredEntries.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: "HistoryCell")
        let entry = filteredEntries[indexPath.row]
        
        cell.textLabel?.text = entry.title ?? entry.url
        cell.detailTextLabel?.text = "\(entry.deviceName) • \(formatDate(entry.visitDate))"
        cell.backgroundColor = .clear
        
        return cell
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Search Bar

extension SimpleViewController: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        if searchText.isEmpty {
            filteredEntries = historyEntries
        } else {
            filteredEntries = historyEntries.filter { entry in
                entry.url.localizedCaseInsensitiveContains(searchText) ||
                (entry.title?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }
        historyTable.reloadData()
    }
}