//
//  ViewController.swift
//  bar123
//
//  Created by Alex Newman on 5/22/25.
//

import UIKit
import os.log
import CryptoKit
import TrysteroSwift

struct HistoryEntry: Codable {
    let id: String
    let url: String
    let title: String
    let visitTime: Int64
    let duration: Int?
    let deviceId: String
    let articleContent: ArticleContent?
    let synced: Bool
    
    struct ArticleContent: Codable {
        let isArticle: Bool
        let title: String?
        let content: String?
        let excerpt: String?
        let readingTime: Int
    }
}

struct ExtensionMessage: Codable {
    let type: String
    let message: [String: Any]?
    
    enum CodingKeys: String, CodingKey {
        case type, message
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        // For now, we'll handle message as optional since it's complex
        message = nil
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        // Handle message encoding if needed
    }
}

class ViewController: UIViewController {
    
    @IBOutlet var tableView: UITableView!
    
    private var historyEntries: [HistoryEntry] = []
    private var isConnected = false
    private var peerCount = 0
    private var currentRoomId: String?
    private var refreshTimer: Timer?
    
    // TrysteroSwift integration
    private var trysteroRoom: TrysteroRoom?
    
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "ViewController")

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadHistoryFromExtension()
        setupRoomConnection()
        startPeriodicRefresh()
        
        logger.info("ViewController initialized with native P2P")
    }
    
    private func setupUI() {
        // Remove web view since we're going native
        title = "History Sync"
        
        // Create table view programmatically since we removed the web view
        tableView = UITableView(frame: view.bounds, style: .plain)
        tableView.delegate = self
        tableView.dataSource = self
        tableView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(tableView)
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Register cell
        tableView.register(HistoryTableViewCell.self, forCellReuseIdentifier: "HistoryCell")
        
        // Add refresh control
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(self, action: #selector(refreshHistory), for: .valueChanged)
        tableView.refreshControl = refreshControl
    }
    
    @objc private func refreshHistory() {
        loadHistoryFromExtension()
        tableView.refreshControl?.endRefreshing()
    }
    
    private func loadHistoryFromExtension() {
        logger.info("Loading history from Safari extension via shared storage")
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            logger.error("Failed to access shared UserDefaults")
            return
        }
        
        var loadedEntries: [HistoryEntry] = []
        
        // Load full history sync if available
        if let fullHistory = sharedDefaults.array(forKey: "fullHistorySync") as? [[String: Any]] {
            logger.info("Loading full history sync with \(fullHistory.count) entries")
            for entryDict in fullHistory {
                if let entry = parseHistoryEntry(from: entryDict) {
                    loadedEntries.append(entry)
                }
            }
        }
        
        // Load pending entries
        if let pendingEntries = sharedDefaults.array(forKey: "pendingHistoryEntries") as? [[String: Any]] {
            logger.info("Loading \(pendingEntries.count) pending history entries")
            for entryDict in pendingEntries {
                if let entry = parseHistoryEntry(from: entryDict) {
                    // Check if this entry already exists to avoid duplicates
                    let key = entry.url + String(entry.visitTime)
                    let existingKeys = Set(loadedEntries.map { $0.url + String($0.visitTime) })
                    if !existingKeys.contains(key) {
                        loadedEntries.append(entry)
                    }
                }
            }
        }
        
        // Sort by visit time (newest first) and limit to 100 entries
        loadedEntries.sort { $0.visitTime > $1.visitTime }
        if loadedEntries.count > 100 {
            loadedEntries = Array(loadedEntries.prefix(100))
        }
        
        self.historyEntries = loadedEntries
        logger.info("Loaded \(loadedEntries.count) history entries from extension")
        
        DispatchQueue.main.async {
            self.tableView.reloadData()
        }
        
        // Send updated history to peers if connected
        if isConnected && !loadedEntries.isEmpty {
            sendHistoryToPeers()
        }
    }
    
    private func parseHistoryEntry(from dict: [String: Any]) -> HistoryEntry? {
        guard let id = dict["id"] as? String,
              let url = dict["url"] as? String,
              let title = dict["title"] as? String,
              let visitTime = dict["visitTime"] as? Int64,
              let deviceId = dict["sourceDevice"] as? String,
              let synced = dict["synced"] as? Bool else {
            logger.error("Failed to parse history entry from dictionary")
            return nil
        }
        
        let duration = dict["duration"] as? Int
        
        var articleContent: HistoryEntry.ArticleContent?
        if let articleDict = dict["articleContent"] as? [String: Any],
           let isArticle = articleDict["isArticle"] as? Bool,
           let readingTime = articleDict["readingTime"] as? Int {
            
            articleContent = HistoryEntry.ArticleContent(
                isArticle: isArticle,
                title: articleDict["title"] as? String,
                content: articleDict["content"] as? String,
                excerpt: articleDict["excerpt"] as? String,
                readingTime: readingTime
            )
        }
        
        return HistoryEntry(
            id: id,
            url: url,
            title: title,
            visitTime: visitTime,
            duration: duration,
            deviceId: deviceId,
            articleContent: articleContent,
            synced: synced
        )
    }
    
    private func setupRoomConnection() {
        let secret = getSharedSecret()
        if !secret.isEmpty {
            logger.info("Found room secret, setting up P2P connection")
            connectToRoom(secret: secret)
        } else {
            logger.info("No room secret found, waiting for user setup")
        }
    }
    
    private func connectToRoom(secret: String) {
        Task {
            do {
                // Initialize TrysteroSwift room
                let config = RoomConfig(relays: ["wss://relay.damus.io", "wss://relay.nostr.band"])
                let roomId = await hashSecret(secret)
                self.trysteroRoom = try Trystero.joinRoom(config: config, roomId: roomId)
                try await self.trysteroRoom?.join()
                self.setupRoomHandlers()
                
                logger.info("Connected to P2P room: \(roomId)")
                DispatchQueue.main.async {
                    self.isConnected = true
                    self.updateConnectionStatus()
                }
            } catch {
                logger.error("Failed to connect to P2P room: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self.showConnectionError(error)
                }
            }
        }
    }
    
    private func setupRoomHandlers() {
        // Set up TrysteroSwift event handlers
        trysteroRoom?.onPeerJoin { [weak self] peerId in
            self?.logger.info("Peer joined: \(peerId)")
            DispatchQueue.main.async {
                self?.peerCount += 1
                self?.updateConnectionStatus()
            }
            // Send current history to new peer
            self?.sendHistoryToPeers()
        }
        
        trysteroRoom?.onPeerLeave { [weak self] peerId in
            self?.logger.info("Peer left: \(peerId)")
            DispatchQueue.main.async {
                self?.peerCount = max(0, (self?.peerCount ?? 1) - 1)
                self?.updateConnectionStatus()
            }
        }
        
        trysteroRoom?.onData { [weak self] data, peerId in
            self?.handleReceivedData(data, from: peerId)
        }
        
        logger.info("TrysteroSwift room handlers configured")
    }
    
    private func updateConnectionStatus() {
        DispatchQueue.main.async {
            // Update UI to show connection status
            self.navigationItem.rightBarButtonItem = UIBarButtonItem(
                title: self.isConnected ? "Connected (\(self.peerCount))" : "Disconnected",
                style: .plain,
                target: nil,
                action: nil
            )
        }
    }
    
    private func handleReceivedData(_ data: Data, from peerId: String) {
        do {
            let receivedEntries = try JSONDecoder().decode([HistoryEntry].self, from: data)
            logger.info("Received \(receivedEntries.count) history entries from peer: \(peerId)")
            
            // Merge with local history
            DispatchQueue.main.async {
                self.mergeHistoryEntries(receivedEntries)
            }
        } catch {
            logger.error("Failed to decode received history data: \(error.localizedDescription)")
        }
    }
    
    private func mergeHistoryEntries(_ newEntries: [HistoryEntry]) {
        let existingUrls = Set(historyEntries.map { $0.url + String($0.visitTime) })
        
        for entry in newEntries {
            let key = entry.url + String(entry.visitTime)
            if !existingUrls.contains(key) {
                historyEntries.append(entry)
            }
        }
        
        // Sort by visit time (newest first)
        historyEntries.sort { $0.visitTime > $1.visitTime }
        
        // Limit to last 100 entries for performance
        if historyEntries.count > 100 {
            historyEntries = Array(historyEntries.prefix(100))
        }
        
        tableView.reloadData()
    }
    
    private func sendHistoryToPeers() {
        guard isConnected, let jsonData = try? JSONEncoder().encode(historyEntries) else {
            return
        }
        
        // Send data using TrysteroSwift
        do {
            try trysteroRoom?.send(jsonData)
        } catch {
            logger.error("Failed to send history to peers: \(error.localizedDescription)")
        }
        
        logger.info("Sent \(self.historyEntries.count) history entries to peers")
    }
    
    private func hashSecret(_ secret: String) async -> String {
        let data = secret.data(using: .utf8) ?? Data()
        let digest = SHA256.hash(data: data)
        return digest.compactMap { String(format: "%02x", $0) }.joined().prefix(16).lowercased()
    }
    
    private func getSharedSecret() -> String {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        return sharedDefaults?.string(forKey: "roomSecret") ?? ""
    }
    
    @IBAction func clearRoomSecret() {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        sharedDefaults?.removeObject(forKey: "roomSecret")
        sharedDefaults?.synchronize()
        
        // Disconnect from room
        Task {
            await trysteroRoom?.leave()
            trysteroRoom = nil
        }
        
        isConnected = false
        peerCount = 0
        updateConnectionStatus()
        
        // Show setup alert
        showRoomSecretSetup()
    }
    
    @IBAction func showRoomSecretSetup() {
        let alert = UIAlertController(
            title: "Setup Room Secret",
            message: "Enter a shared secret to sync history with other devices",
            preferredStyle: .alert
        )
        
        alert.addTextField { textField in
            textField.placeholder = "Room secret"
            textField.isSecureTextEntry = true
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Connect", style: .default) { _ in
            if let secret = alert.textFields?.first?.text, !secret.isEmpty {
                self.saveSharedSecret(secret)
                self.connectToRoom(secret: secret)
            }
        })
        
        present(alert, animated: true)
    }
    
    private func saveSharedSecret(_ secret: String) {
        let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123")
        sharedDefaults?.set(secret, forKey: "roomSecret")
        sharedDefaults?.synchronize()
    }
    
    private func showConnectionError(_ error: Error) {
        let alert = UIAlertController(
            title: "Connection Failed",
            message: "Failed to connect to P2P room: \(error.localizedDescription)",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in
            let secret = self.getSharedSecret()
            if !secret.isEmpty {
                self.connectToRoom(secret: secret)
            }
        })
        
        present(alert, animated: true)
    }
    
    private func startPeriodicRefresh() {
        // Refresh history from extension every 5 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.loadHistoryFromExtension()
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
    
    deinit {
        refreshTimer?.invalidate()
        Task {
            await trysteroRoom?.leave()
        }
    }
}

// MARK: - UITableViewDataSource
extension ViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return historyEntries.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "HistoryCell", for: indexPath) as! HistoryTableViewCell
        let entry = historyEntries[indexPath.row]
        cell.configure(with: entry)
        return cell
    }
}

// MARK: - UITableViewDelegate
extension ViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return UITableView.automaticDimension
    }
    
    func tableView(_ tableView: UITableView, estimatedHeightForRowAt indexPath: IndexPath) -> CGFloat {
        return 80
    }
}

// MARK: - Custom Table View Cell
class HistoryTableViewCell: UITableViewCell {
    private let titleLabel = UILabel()
    private let urlLabel = UILabel()
    private let timeLabel = UILabel()
    private let articleBadge = UILabel()
    private let excerptLabel = UILabel()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupViews() {
        [titleLabel, urlLabel, timeLabel, articleBadge, excerptLabel].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview($0)
        }
        
        titleLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        titleLabel.numberOfLines = 2
        
        urlLabel.font = UIFont.systemFont(ofSize: 12)
        urlLabel.textColor = .systemBlue
        urlLabel.numberOfLines = 1
        
        timeLabel.font = UIFont.systemFont(ofSize: 11)
        timeLabel.textColor = .secondaryLabel
        
        articleBadge.font = UIFont.systemFont(ofSize: 10, weight: .medium)
        articleBadge.textColor = .systemBlue
        articleBadge.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.1)
        articleBadge.layer.cornerRadius = 4
        articleBadge.textAlignment = .center
        articleBadge.isHidden = true
        
        excerptLabel.font = UIFont.systemFont(ofSize: 12)
        excerptLabel.textColor = .secondaryLabel
        excerptLabel.numberOfLines = 2
        excerptLabel.isHidden = true
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            
            urlLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            urlLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            urlLabel.trailingAnchor.constraint(equalTo: timeLabel.leadingAnchor, constant: -8),
            
            timeLabel.centerYAnchor.constraint(equalTo: urlLabel.centerYAnchor),
            timeLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            timeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 60),
            
            articleBadge.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 4),
            articleBadge.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            articleBadge.widthAnchor.constraint(lessThanOrEqualToConstant: 120),
            articleBadge.heightAnchor.constraint(equalToConstant: 20),
            
            excerptLabel.topAnchor.constraint(equalTo: articleBadge.bottomAnchor, constant: 4),
            excerptLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            excerptLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            excerptLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8)
        ])
    }
    
    func configure(with entry: HistoryEntry) {
        titleLabel.text = entry.title.isEmpty ? "Untitled" : entry.title
        urlLabel.text = URL(string: entry.url)?.host ?? entry.url
        
        let date = Date(timeIntervalSince1970: TimeInterval(entry.visitTime / 1000))
        timeLabel.text = timeAgo(from: date)
        
        if let articleContent = entry.articleContent, articleContent.isArticle {
            articleBadge.isHidden = false
            articleBadge.text = "📖 \(articleContent.readingTime) min read"
            
            if let excerpt = articleContent.excerpt, !excerpt.isEmpty {
                excerptLabel.isHidden = false
                excerptLabel.text = excerpt
            } else {
                excerptLabel.isHidden = true
            }
        } else {
            articleBadge.isHidden = true
            excerptLabel.isHidden = true
        }
    }
    
    private func timeAgo(from date: Date) -> String {
        let now = Date()
        let seconds = Int(now.timeIntervalSince(date))
        
        if seconds < 60 { return "\(seconds)s ago" }
        if seconds < 3600 { return "\(seconds / 60)m ago" }
        if seconds < 86400 { return "\(seconds / 3600)h ago" }
        return "\(seconds / 86400)d ago"
    }
}