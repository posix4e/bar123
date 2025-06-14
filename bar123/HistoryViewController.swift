import UIKit

class HistoryViewController: UIViewController {
    
    @IBOutlet weak var tableView: UITableView!
    @IBOutlet weak var syncStatusLabel: UILabel!
    @IBOutlet weak var lastSyncLabel: UILabel!
    @IBOutlet weak var pendingCountLabel: UILabel!
    @IBOutlet weak var syncButton: UIButton!
    
    private let historyDataManager = HistoryDataManager.shared
    private var historyItems: [HistoryItem] = []
    private let refreshControl = UIRefreshControl()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Browser History"
        
        // Setup table view
        tableView.delegate = self
        tableView.dataSource = self
        
        // Setup refresh control
        refreshControl.addTarget(self, action: #selector(refreshHistory), for: .valueChanged)
        tableView.refreshControl = refreshControl
        
        // Setup sync button
        syncButton.addTarget(self, action: #selector(forceSyncTapped), for: .touchUpInside)
        
        // Load initial data
        loadHistory()
        updateSyncStatus()
        
        // Listen for app becoming active to update status
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(updateSyncStatus),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        loadHistory()
        updateSyncStatus()
    }
    
    @objc private func refreshHistory() {
        loadHistory()
        updateSyncStatus()
        refreshControl.endRefreshing()
    }
    
    @objc private func forceSyncTapped() {
        syncButton.isEnabled = false
        syncStatusLabel.text = "Syncing..."
        
        // Send sync request to extension
        if let extensionContext = self.extensionContext {
            let request = NSExtensionItem()
            request.userInfo = ["action": "syncHistory"]
            extensionContext.completeRequest(returningItems: [request]) { _ in
                DispatchQueue.main.async {
                    self.syncButton.isEnabled = true
                    self.updateSyncStatus()
                }
            }
        } else {
            // Direct sync if not in extension context
            performSync()
        }
    }
    
    private func performSync() {
        // This would communicate with the Safari extension to trigger sync
        // For now, we'll just update the UI
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.syncButton.isEnabled = true
            self.updateSyncStatus()
        }
    }
    
    private func loadHistory() {
        historyItems = historyDataManager.getRecentHistory(limit: 100)
        tableView.reloadData()
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
extension HistoryViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return historyItems.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell") ?? UITableViewCell(style: .subtitle, reuseIdentifier: "HistoryCell")
        
        let item = historyItems[indexPath.row]
        cell.textLabel?.text = item.title ?? "Untitled"
        cell.detailTextLabel?.text = item.url
        
        // Show sync status
        if item.isSynced {
            cell.accessoryType = .checkmark
        } else {
            cell.accessoryType = .none
        }
        
        return cell
    }
}

// MARK: - UITableViewDelegate
extension HistoryViewController: UITableViewDelegate {
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
        }
    }
}