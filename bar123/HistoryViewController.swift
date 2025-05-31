import UIKit
import TrysteroSwift
import os.log

class HistoryViewController: UIViewController {
    
    private let connectionStatusLabel = UILabel()
    private let peerCountLabel = UILabel()
    private let historyTableView = UITableView()
    private let secretTextField = UITextField()
    private let connectButton = UIButton(type: .system)
    private let disconnectButton = UIButton(type: .system)
    private let setupView = UIView()
    private let historyView = UIView()
    
    private var historyManager = HistoryManager()
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "HistoryViewController")
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        createUI()
        setupUI()
        setupTableView()
        setupNotificationListener()
        checkForExistingSecret()
        
        logger.info("HistoryViewController loaded with TrysteroSwift")
    }
    
    private func createUI() {
        view.backgroundColor = .systemBackground
        
        // Add all subviews
        [setupView, historyView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        
        // Setup view styling
        setupView.backgroundColor = .systemBackground
        historyView.backgroundColor = .systemBackground
        
        // Create setup view elements
        let titleLabel = UILabel()
        titleLabel.text = "History Sync Setup"
        titleLabel.font = UIFont.boldSystemFont(ofSize: 24)
        titleLabel.textAlignment = .center
        
        let instructionLabel = UILabel()
        instructionLabel.text = "Enter a room secret to start syncing browser history across devices"
        instructionLabel.font = UIFont.systemFont(ofSize: 16)
        instructionLabel.textColor = .systemGray
        instructionLabel.textAlignment = .center
        instructionLabel.numberOfLines = 0
        
        secretTextField.placeholder = "Enter room secret..."
        secretTextField.borderStyle = .roundedRect
        secretTextField.font = UIFont.systemFont(ofSize: 16)
        
        connectButton.setTitle("Connect", for: .normal)
        connectButton.titleLabel?.font = UIFont.boldSystemFont(ofSize: 18)
        connectButton.backgroundColor = .systemBlue
        connectButton.setTitleColor(.white, for: .normal)
        connectButton.layer.cornerRadius = 8
        
        [titleLabel, instructionLabel, secretTextField, connectButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            setupView.addSubview($0)
        }
        
        // Create history view elements
        connectionStatusLabel.font = UIFont.boldSystemFont(ofSize: 16)
        connectionStatusLabel.textAlignment = .center
        
        peerCountLabel.font = UIFont.systemFont(ofSize: 14)
        peerCountLabel.textColor = .systemGray
        peerCountLabel.textAlignment = .center
        
        disconnectButton.setTitle("Disconnect", for: .normal)
        disconnectButton.titleLabel?.font = UIFont.systemFont(ofSize: 16)
        disconnectButton.setTitleColor(.systemRed, for: .normal)
        
        historyTableView.backgroundColor = .systemBackground
        
        [connectionStatusLabel, peerCountLabel, disconnectButton, historyTableView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            historyView.addSubview($0)
        }
        
        // Setup constraints
        NSLayoutConstraint.activate([
            // Setup view constraints
            setupView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            setupView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            setupView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            setupView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            titleLabel.topAnchor.constraint(equalTo: setupView.topAnchor, constant: 40),
            titleLabel.leadingAnchor.constraint(equalTo: setupView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: setupView.trailingAnchor, constant: -20),
            
            instructionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 20),
            instructionLabel.leadingAnchor.constraint(equalTo: setupView.leadingAnchor, constant: 20),
            instructionLabel.trailingAnchor.constraint(equalTo: setupView.trailingAnchor, constant: -20),
            
            secretTextField.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 40),
            secretTextField.leadingAnchor.constraint(equalTo: setupView.leadingAnchor, constant: 20),
            secretTextField.trailingAnchor.constraint(equalTo: setupView.trailingAnchor, constant: -20),
            secretTextField.heightAnchor.constraint(equalToConstant: 44),
            
            connectButton.topAnchor.constraint(equalTo: secretTextField.bottomAnchor, constant: 20),
            connectButton.leadingAnchor.constraint(equalTo: setupView.leadingAnchor, constant: 20),
            connectButton.trailingAnchor.constraint(equalTo: setupView.trailingAnchor, constant: -20),
            connectButton.heightAnchor.constraint(equalToConstant: 50),
            
            // History view constraints
            historyView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            historyView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            historyView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            historyView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            connectionStatusLabel.topAnchor.constraint(equalTo: historyView.topAnchor, constant: 20),
            connectionStatusLabel.leadingAnchor.constraint(equalTo: historyView.leadingAnchor, constant: 20),
            connectionStatusLabel.trailingAnchor.constraint(equalTo: historyView.trailingAnchor, constant: -20),
            
            peerCountLabel.topAnchor.constraint(equalTo: connectionStatusLabel.bottomAnchor, constant: 8),
            peerCountLabel.leadingAnchor.constraint(equalTo: historyView.leadingAnchor, constant: 20),
            peerCountLabel.trailingAnchor.constraint(equalTo: historyView.trailingAnchor, constant: -20),
            
            disconnectButton.topAnchor.constraint(equalTo: peerCountLabel.bottomAnchor, constant: 16),
            disconnectButton.centerXAnchor.constraint(equalTo: historyView.centerXAnchor),
            
            historyTableView.topAnchor.constraint(equalTo: disconnectButton.bottomAnchor, constant: 20),
            historyTableView.leadingAnchor.constraint(equalTo: historyView.leadingAnchor),
            historyTableView.trailingAnchor.constraint(equalTo: historyView.trailingAnchor),
            historyTableView.bottomAnchor.constraint(equalTo: historyView.bottomAnchor)
        ])
    }
    
    private func setupUI() {
        title = "History Sync"
        
        // Configure buttons
        connectButton.addTarget(self, action: #selector(connectPressed), for: .touchUpInside)
        disconnectButton.addTarget(self, action: #selector(disconnectPressed), for: .touchUpInside)
        
        // Initially show setup view
        showSetupView()
    }
    
    private func setupTableView() {
        historyTableView.delegate = self
        historyTableView.dataSource = self
        historyTableView.register(HistoryTableViewCell.self, forCellReuseIdentifier: "HistoryCell")
        historyTableView.rowHeight = UITableView.automaticDimension
        historyTableView.estimatedRowHeight = 80
    }
    
    private func setupNotificationListener() {
        // Listen for history entries from Safari extension
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleHistoryEntryFromExtension),
            name: NSNotification.Name("HistoryEntryReceived"),
            object: nil
        )
        
        // Listen for HistoryManager updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(historyManagerUpdated),
            name: NSNotification.Name("HistoryManagerUpdated"),
            object: nil
        )
    }
    
    @objc private func handleHistoryEntryFromExtension(notification: Notification) {
        guard let historyData = notification.userInfo as? [String: Any] else {
            logger.error("Invalid history data from extension notification")
            return
        }
        
        logger.info("📝 Received history entry from Safari extension")
        historyManager.receiveHistoryFromJS(historyData)
    }
    
    @objc private func historyManagerUpdated() {
        DispatchQueue.main.async {
            self.updateUI()
        }
    }
    
    private func checkForExistingSecret() {
        let secret = getSharedSecret()
        if !secret.isEmpty {
            secretTextField.text = secret
            connectToTrystero(secret: secret)
        }
    }
    
    @objc private func connectPressed() {
        guard let secret = secretTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !secret.isEmpty else {
            showAlert(title: "Error", message: "Please enter a room secret")
            return
        }
        
        saveSharedSecret(secret)
        connectToTrystero(secret: secret)
    }
    
    @objc private func disconnectPressed() {
        Task {
            await historyManager.disconnect()
            clearSharedSecret()
            DispatchQueue.main.async {
                self.showSetupView()
            }
        }
    }
    
    private func connectToTrystero(secret: String) {
        Task {
            do {
                try await historyManager.connect(with: secret)
                DispatchQueue.main.async {
                    self.showHistoryView()
                    self.updateUI()
                }
                logger.info("✅ Connected to TrysteroSwift successfully")
            } catch {
                logger.error("❌ Failed to connect to TrysteroSwift: \(error)")
                DispatchQueue.main.async {
                    self.showAlert(title: "Connection Failed", message: error.localizedDescription)
                }
            }
        }
    }
    
    private func updateUI() {
        connectionStatusLabel.text = historyManager.isConnected ? "Connected" : "Disconnected"
        connectionStatusLabel.textColor = historyManager.isConnected ? .systemGreen : .systemRed
        
        peerCountLabel.text = "\(historyManager.peerCount) peers"
        
        historyTableView.reloadData()
        
        if let lastSync = historyManager.lastSyncTime {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            navigationItem.prompt = "Last sync: \(formatter.string(from: lastSync))"
        }
    }
    
    private func showSetupView() {
        setupView.isHidden = false
        historyView.isHidden = true
    }
    
    private func showHistoryView() {
        setupView.isHidden = true
        historyView.isHidden = false
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - UserDefaults
    
    private func getSharedSecret() -> String {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        return sharedDefaults?.string(forKey: "roomSecret") ?? ""
    }
    
    private func saveSharedSecret(_ secret: String) {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        sharedDefaults?.set(secret, forKey: "roomSecret")
        sharedDefaults?.synchronize()
    }
    
    private func clearSharedSecret() {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        sharedDefaults?.removeObject(forKey: "roomSecret")
        sharedDefaults?.synchronize()
        secretTextField.text = ""
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - TableView DataSource & Delegate

extension HistoryViewController: UITableViewDataSource, UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return historyManager.recentHistory.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell", for: indexPath) as! HistoryTableViewCell
        let entry = historyManager.recentHistory[indexPath.row]
        cell.configure(with: entry)
        return cell
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return historyManager.recentHistory.isEmpty ? nil : "Last 10 Sites"
    }
}

// MARK: - Custom TableViewCell

class HistoryTableViewCell: UITableViewCell {
    
    private let titleLabel = UILabel()
    private let urlLabel = UILabel()
    private let excerptLabel = UILabel()
    private let timeLabel = UILabel()
    private let articleBadge = UILabel()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }
    
    private func setupCell() {
        // Configure labels
        titleLabel.font = UIFont.boldSystemFont(ofSize: 16)
        titleLabel.numberOfLines = 2
        
        urlLabel.font = UIFont.systemFont(ofSize: 12)
        urlLabel.textColor = .systemGray
        
        excerptLabel.font = UIFont.systemFont(ofSize: 13)
        excerptLabel.textColor = .systemGray2
        excerptLabel.numberOfLines = 2
        
        timeLabel.font = UIFont.systemFont(ofSize: 11)
        timeLabel.textColor = .systemGray
        
        articleBadge.font = UIFont.boldSystemFont(ofSize: 10)
        articleBadge.textColor = .white
        articleBadge.backgroundColor = .systemGreen
        articleBadge.layer.cornerRadius = 8
        articleBadge.clipsToBounds = true
        articleBadge.textAlignment = .center
        
        // Add to content view
        [titleLabel, urlLabel, excerptLabel, timeLabel, articleBadge].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview($0)
        }
        
        // Setup constraints
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            
            urlLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            urlLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            urlLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            
            excerptLabel.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 4),
            excerptLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            excerptLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            
            timeLabel.topAnchor.constraint(equalTo: excerptLabel.bottomAnchor, constant: 8),
            timeLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            timeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            
            articleBadge.centerYAnchor.constraint(equalTo: timeLabel.centerYAnchor),
            articleBadge.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            articleBadge.widthAnchor.constraint(greaterThanOrEqualToConstant: 60),
            articleBadge.heightAnchor.constraint(equalToConstant: 16)
        ])
    }
    
    func configure(with entry: HistoryEntry) {
        titleLabel.text = entry.title
        urlLabel.text = entry.hostname
        
        if let excerpt = entry.articleContent?.excerpt, !excerpt.isEmpty {
            excerptLabel.text = excerpt
            excerptLabel.isHidden = false
        } else {
            excerptLabel.isHidden = true
        }
        
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        timeLabel.text = formatter.string(from: Date(timeIntervalSince1970: entry.visitTime))
        
        if let content = entry.articleContent, content.isArticle, let readingTime = content.readingTime {
            articleBadge.text = "📖 \(readingTime)m"
            articleBadge.isHidden = false
        } else {
            articleBadge.isHidden = true
        }
        
        // Set background color for articles
        if entry.articleContent?.isArticle == true {
            backgroundColor = UIColor.systemGreen.withAlphaComponent(0.05)
        } else {
            backgroundColor = UIColor.systemBackground
        }
    }
}