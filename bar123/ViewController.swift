//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit

class ViewController: UIViewController {
    
    // UI Components
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let iconImageView = UIImageView()
    private let infoLabel = UILabel()
    private let syncStatusContainer = UIView()
    private let syncStatusLabel = UILabel()
    private let lastSyncLabel = UILabel()
    private let pendingCountLabel = UILabel()
    private let syncButton = UIButton(type: .system)
    private let historyHeaderLabel = UILabel()
    private let tableView = UITableView()
    
    // Data
    private let historyDataManager = HistoryDataManager.shared
    private var historyItems: [HistoryItem] = []
    private let refreshControl = UIRefreshControl()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadHistory()
        updateSyncStatus()
        
        // Listen for app becoming active to update status
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updateSyncStatus),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        // Listen for history updates from extension
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(historyUpdated),
            name: NSNotification.Name("HistoryUpdated"),
            object: nil
        )
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        loadHistory()
        updateSyncStatus()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Setup scroll view
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
        
        // Setup app icon
        iconImageView.image = UIImage(named: "Icon")
        iconImageView.contentMode = .scaleAspectFit
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(iconImageView)
        
        // Setup info label
        infoLabel.text = "You can turn on bar123's Safari extension in Settings."
        infoLabel.textAlignment = .center
        infoLabel.numberOfLines = 0
        infoLabel.font = .systemFont(ofSize: 17)
        infoLabel.textColor = .label
        infoLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(infoLabel)
        
        // Setup sync status container
        syncStatusContainer.backgroundColor = .secondarySystemBackground
        syncStatusContainer.layer.cornerRadius = 12
        syncStatusContainer.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(syncStatusContainer)
        
        // Setup sync status labels
        syncStatusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        syncStatusLabel.translatesAutoresizingMaskIntoConstraints = false
        syncStatusLabel.accessibilityIdentifier = "syncStatusLabel"
        syncStatusContainer.addSubview(syncStatusLabel)
        
        lastSyncLabel.font = .systemFont(ofSize: 14)
        lastSyncLabel.textColor = .secondaryLabel
        lastSyncLabel.translatesAutoresizingMaskIntoConstraints = false
        lastSyncLabel.accessibilityIdentifier = "lastSyncLabel"
        syncStatusContainer.addSubview(lastSyncLabel)
        
        pendingCountLabel.font = .systemFont(ofSize: 14)
        pendingCountLabel.textColor = .secondaryLabel
        pendingCountLabel.translatesAutoresizingMaskIntoConstraints = false
        pendingCountLabel.accessibilityIdentifier = "pendingCountLabel"
        syncStatusContainer.addSubview(pendingCountLabel)
        
        // Setup sync button
        syncButton.setTitle("Force Sync", for: .normal)
        syncButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .medium)
        syncButton.backgroundColor = .systemBlue
        syncButton.setTitleColor(.white, for: .normal)
        syncButton.layer.cornerRadius = 8
        syncButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
        syncButton.addTarget(self, action: #selector(forceSyncTapped), for: .touchUpInside)
        syncButton.accessibilityIdentifier = "syncButton"
        syncButton.translatesAutoresizingMaskIntoConstraints = false
        syncStatusContainer.addSubview(syncButton)
        
        // Setup history header
        historyHeaderLabel.text = "Recent History"
        historyHeaderLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        historyHeaderLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(historyHeaderLabel)
        
        // Setup table view
        tableView.delegate = self
        tableView.dataSource = self
        tableView.backgroundColor = .clear
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.isScrollEnabled = false
        tableView.accessibilityIdentifier = "historyTableView"
        contentView.addSubview(tableView)
        
        // Setup refresh control
        refreshControl.addTarget(self, action: #selector(refreshHistory), for: .valueChanged)
        scrollView.refreshControl = refreshControl
        
        // Setup constraints
        NSLayoutConstraint.activate([
            // Icon
            iconImageView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 40),
            iconImageView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 96),
            iconImageView.heightAnchor.constraint(equalToConstant: 96),
            
            // Info label
            infoLabel.topAnchor.constraint(equalTo: iconImageView.bottomAnchor, constant: 20),
            infoLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            infoLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            // Sync status container
            syncStatusContainer.topAnchor.constraint(equalTo: infoLabel.bottomAnchor, constant: 24),
            syncStatusContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            syncStatusContainer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            // Sync status labels and button
            syncStatusLabel.topAnchor.constraint(equalTo: syncStatusContainer.topAnchor, constant: 16),
            syncStatusLabel.leadingAnchor.constraint(equalTo: syncStatusContainer.leadingAnchor, constant: 16),
            
            lastSyncLabel.topAnchor.constraint(equalTo: syncStatusLabel.bottomAnchor, constant: 4),
            lastSyncLabel.leadingAnchor.constraint(equalTo: syncStatusContainer.leadingAnchor, constant: 16),
            
            pendingCountLabel.topAnchor.constraint(equalTo: lastSyncLabel.bottomAnchor, constant: 4),
            pendingCountLabel.leadingAnchor.constraint(equalTo: syncStatusContainer.leadingAnchor, constant: 16),
            pendingCountLabel.bottomAnchor.constraint(equalTo: syncStatusContainer.bottomAnchor, constant: -16),
            
            syncButton.centerYAnchor.constraint(equalTo: syncStatusContainer.centerYAnchor),
            syncButton.trailingAnchor.constraint(equalTo: syncStatusContainer.trailingAnchor, constant: -16),
            
            // History header
            historyHeaderLabel.topAnchor.constraint(equalTo: syncStatusContainer.bottomAnchor, constant: 32),
            historyHeaderLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            historyHeaderLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            // Table view
            tableView.topAnchor.constraint(equalTo: historyHeaderLabel.bottomAnchor, constant: 12),
            tableView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20),
            tableView.heightAnchor.constraint(greaterThanOrEqualToConstant: 300)
        ])
    }
    
    @objc private func refreshHistory() {
        loadHistory()
        updateSyncStatus()
        refreshControl.endRefreshing()
    }
    
    @objc private func historyUpdated() {
        loadHistory()
        updateSyncStatus()
    }
    
    @objc private func forceSyncTapped() {
        syncButton.isEnabled = false
        syncStatusLabel.text = "Syncing..."
        
        Task {
            let result = await SyncManager.shared.forceSyncNow()
            
            await MainActor.run {
                self.syncButton.isEnabled = true
                
                if result.success {
                    if result.syncedCount > 0 {
                        self.syncStatusLabel.text = "Synced \(result.syncedCount) items"
                        self.syncStatusLabel.textColor = .systemGreen
                    } else {
                        self.syncStatusLabel.text = "Already up to date"
                        self.syncStatusLabel.textColor = .systemGreen
                    }
                } else {
                    self.syncStatusLabel.text = result.error ?? "Sync failed"
                    self.syncStatusLabel.textColor = .systemRed
                }
                
                // Update status after a delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    self.updateSyncStatus()
                    self.loadHistory()
                }
            }
        }
    }
    
    private func loadHistory() {
        historyItems = historyDataManager.getRecentHistory(limit: 20) // Show recent 20 items
        tableView.reloadData()
        
        // Update table view height
        tableView.layoutIfNeeded()
        let height = tableView.contentSize.height
        tableView.constraints.first { $0.firstAttribute == .height }?.constant = height
    }
    
    @objc private func updateSyncStatus() {
        let pendingCount = historyDataManager.getPendingCount()
        let lastSyncTime = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)?.object(forKey: "lastSyncTime") as? Date
        
        // Update pending count
        pendingCountLabel.text = "Pending: \(pendingCount) items"
        
        // Update last sync time
        if let lastSync = lastSyncTime {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .full
            lastSyncLabel.text = "Last sync: \(formatter.localizedString(for: lastSync, relativeTo: Date()))"
        } else {
            lastSyncLabel.text = "Last sync: Never"
        }
        
        // Update sync status
        if pendingCount > 0 {
            syncStatusLabel.text = "Sync needed"
            syncStatusLabel.textColor = .systemOrange
        } else {
            syncStatusLabel.text = "Up to date"
            syncStatusLabel.textColor = .systemGreen
        }
        
        // Check if Pantry is configured
        let sharedDefaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)
        let pantryID = sharedDefaults?.string(forKey: "pantryID") ?? ""
        
        if pantryID.isEmpty {
            syncStatusLabel.text = "Not configured"
            syncStatusLabel.textColor = .systemRed
            syncButton.isEnabled = false
        } else {
            syncButton.isEnabled = true
        }
    }
}

// MARK: - UITableViewDataSource
extension ViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return historyItems.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cellIdentifier = "HistoryCell"
        let cell = tableView.dequeueReusableCell(withIdentifier: cellIdentifier) ?? UITableViewCell(style: .subtitle, reuseIdentifier: cellIdentifier)
        
        let item = historyItems[indexPath.row]
        cell.textLabel?.text = item.title ?? "Untitled"
        cell.textLabel?.font = .systemFont(ofSize: 16)
        cell.detailTextLabel?.text = item.url
        cell.detailTextLabel?.font = .systemFont(ofSize: 14)
        cell.detailTextLabel?.textColor = .secondaryLabel
        
        // Show sync status
        if item.isSynced {
            cell.accessoryType = .checkmark
            cell.tintColor = .systemGreen
        } else {
            cell.accessoryType = .none
        }
        
        return cell
    }
}

// MARK: - UITableViewDelegate
extension ViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        let item = historyItems[indexPath.row]
        if let url = URL(string: item.url ?? "") {
            UIApplication.shared.open(url)
        }
    }
    
    func tableView(_ tableView: UITableView, canEditRowAt indexPath: IndexPath) -> Bool {
        return true
    }
    
    func tableView(_ tableView: UITableView, commit editingStyle: UITableViewCell.EditingStyle, forRowAt indexPath: IndexPath) {
        if editingStyle == .delete {
            let item = historyItems[indexPath.row]
            historyDataManager.deleteHistoryItem(item)
            historyItems.remove(at: indexPath.row)
            tableView.deleteRows(at: [indexPath], with: .fade)
            updateSyncStatus()
            
            // Update table view height
            tableView.layoutIfNeeded()
            let height = tableView.contentSize.height
            tableView.constraints.first { $0.firstAttribute == .height }?.constant = height
        }
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 60
    }
}