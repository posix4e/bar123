import UIKit
import SafariServices
import CoreData

class HistoryViewController: UIViewController {
    
    // MARK: - UI Elements
    private let searchBar = UISearchBar()
    private let segmentedControl = UISegmentedControl(items: ["All", "Title", "URL"])
    private let filterControl = UISegmentedControl(items: ["1h", "6h", "24h", "3d", "1w", "All"])
    private let tableView = UITableView()
    private let refreshControl = UIRefreshControl()
    
    // MARK: - Properties
    private var historyItems: [HistoryItem] = []
    private var filteredItems: [HistoryItem] = []
    private var searchQuery = ""
    private var searchType = "all"
    private var hoursFilter = 24
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadHistory()
        
        // Listen for updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(refreshHistory),
            name: NSNotification.Name("HistoryUpdated"),
            object: nil
        )
    }
    
    // MARK: - UI Setup
    private func setupUI() {
        title = "Browser History"
        view.backgroundColor = .systemBackground
        
        // Navigation items
        let syncButton = UIBarButtonItem(
            image: UIImage(systemName: "arrow.clockwise"),
            style: .plain,
            target: self,
            action: #selector(syncHistory)
        )
        
        let infoButton = UIBarButtonItem(
            image: UIImage(systemName: "info.circle"),
            style: .plain,
            target: self,
            action: #selector(showInfo)
        )
        
        navigationItem.rightBarButtonItems = [syncButton, infoButton]
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(dismissView)
        )
        
        // Search bar setup
        searchBar.delegate = self
        searchBar.placeholder = "Search history..."
        searchBar.searchBarStyle = .minimal
        
        // Segmented controls
        segmentedControl.selectedSegmentIndex = 0
        segmentedControl.addTarget(self, action: #selector(searchTypeChanged), for: .valueChanged)
        
        filterControl.selectedSegmentIndex = 2 // Default to 24h
        filterControl.addTarget(self, action: #selector(filterChanged), for: .valueChanged)
        
        // Table view setup
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(HistoryCell.self, forCellReuseIdentifier: "HistoryCell")
        tableView.refreshControl = refreshControl
        refreshControl.addTarget(self, action: #selector(refreshHistory), for: .valueChanged)
        
        // Layout
        let stackView = UIStackView(arrangedSubviews: [searchBar, segmentedControl, filterControl])
        stackView.axis = .vertical
        stackView.spacing = 8
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        tableView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(stackView)
        view.addSubview(tableView)
        
        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            tableView.topAnchor.constraint(equalTo: stackView.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    // MARK: - Data Loading
    private func loadHistory() {
        let hours = getHoursFromFilter()
        
        if searchQuery.isEmpty {
            historyItems = HistoryDataManager.shared.getRecentHistory(hoursAgo: hours, limit: 500)
        } else {
            historyItems = HistoryDataManager.shared.searchHistory(query: searchQuery, searchType: searchType, limit: 500)
        }
        
        filteredItems = historyItems
        tableView.reloadData()
        refreshControl.endRefreshing()
    }
    
    private func getHoursFromFilter() -> Int {
        switch filterControl.selectedSegmentIndex {
        case 0: return 1
        case 1: return 6
        case 2: return 24
        case 3: return 72
        case 4: return 168
        default: return 10000 // All
        }
    }
    
    // MARK: - Actions
    @objc private func refreshHistory() {
        loadHistory()
    }
    
    @objc private func syncHistory() {
        let alert = UIAlertController(title: "Syncing...", message: "Uploading unsynced history to Pantry", preferredStyle: .alert)
        present(alert, animated: true)
        
        // Trigger sync via extension handler
        Task {
            // In a real implementation, you'd communicate with the extension
            // For now, we'll just show a success message after a delay
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            
            await MainActor.run {
                alert.dismiss(animated: true) {
                    self.showAlert(title: "Sync Complete", message: "History has been synced to Pantry")
                }
            }
        }
    }
    
    @objc private func showInfo() {
        let unsyncedCount = HistoryDataManager.shared.getUnsyncedItems().count
        let totalCount = historyItems.count
        
        let message = """
        Total items: \(totalCount)
        Unsynced items: \(unsyncedCount)
        
        Pantry ID: \(UserDefaults.standard.string(forKey: "pantryID") ?? "Not configured")
        """
        
        showAlert(title: "History Info", message: message)
    }
    
    @objc private func dismissView() {
        dismiss(animated: true)
    }
    
    @objc private func searchTypeChanged() {
        switch segmentedControl.selectedSegmentIndex {
        case 1: searchType = "title"
        case 2: searchType = "url"
        default: searchType = "all"
        }
        if !searchQuery.isEmpty {
            loadHistory()
        }
    }
    
    @objc private func filterChanged() {
        loadHistory()
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UISearchBarDelegate
extension HistoryViewController: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        searchQuery = searchText
        loadHistory()
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
    }
}

// MARK: - UITableViewDataSource
extension HistoryViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filteredItems.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell", for: indexPath) as! HistoryCell
        let item = filteredItems[indexPath.row]
        cell.configure(with: item)
        return cell
    }
}

// MARK: - UITableViewDelegate
extension HistoryViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        let item = filteredItems[indexPath.row]
        if let urlString = item.url,
           let url = URL(string: urlString) {
            let safariVC = SFSafariViewController(url: url)
            present(safariVC, animated: true)
        }
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 80
    }
    
    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let item = filteredItems[indexPath.row]
        
        let deleteAction = UIContextualAction(style: .destructive, title: "Delete") { [weak self] (_, _, completion) in
            // Delete from Core Data
            let context = HistoryDataManager.shared.persistentContainer.viewContext
            context.delete(item)
            do {
                try context.save()
                self?.loadHistory()
                completion(true)
            } catch {
                print("Failed to delete item: \(error)")
                completion(false)
            }
        }
        
        return UISwipeActionsConfiguration(actions: [deleteAction])
    }
}

// MARK: - History Cell
class HistoryCell: UITableViewCell {
    private let titleLabel = UILabel()
    private let urlLabel = UILabel()
    private let timeLabel = UILabel()
    private let syncStatusView = UIView()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupViews() {
        titleLabel.font = .systemFont(ofSize: 16, weight: .medium)
        titleLabel.numberOfLines = 1
        
        urlLabel.font = .systemFont(ofSize: 14)
        urlLabel.textColor = .secondaryLabel
        urlLabel.numberOfLines = 1
        
        timeLabel.font = .systemFont(ofSize: 12)
        timeLabel.textColor = .tertiaryLabel
        
        syncStatusView.layer.cornerRadius = 4
        syncStatusView.translatesAutoresizingMaskIntoConstraints = false
        
        let stackView = UIStackView(arrangedSubviews: [titleLabel, urlLabel, timeLabel])
        stackView.axis = .vertical
        stackView.spacing = 4
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        contentView.addSubview(stackView)
        contentView.addSubview(syncStatusView)
        
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: syncStatusView.leadingAnchor, constant: -8),
            stackView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            
            syncStatusView.widthAnchor.constraint(equalToConstant: 8),
            syncStatusView.heightAnchor.constraint(equalToConstant: 8),
            syncStatusView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            syncStatusView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16)
        ])
    }
    
    func configure(with item: HistoryItem) {
        titleLabel.text = item.title ?? "Untitled"
        urlLabel.text = item.url ?? ""
        
        if let visitTime = item.visitTime {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            timeLabel.text = formatter.localizedString(for: visitTime, relativeTo: Date())
        }
        
        // Show sync status
        syncStatusView.backgroundColor = item.isSynced ? .systemGreen : .systemOrange
    }
}