/**
 * SettingsViewControllers.swift
 * Additional view controllers for settings screens
 */

import UIKit
import SafariServices

// MARK: - WebSocket Configuration

class WebSocketConfigViewController: UITableViewController {
    
    private let serverUrlCell = TextFieldCell()
    private let roomIdCell = TextFieldCell()
    private let secretCell = TextFieldCell()
    private let generateSecretCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "WebSocket Settings"
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Save", style: .done, target: self, action: #selector(save))
        
        setupCells()
        loadCurrentSettings()
    }
    
    private func setupCells() {
        serverUrlCell.configure(title: "Server URL", placeholder: "ws://localhost:8080", keyboardType: .URL)
        roomIdCell.configure(title: "Room ID", placeholder: "history-sync-room")
        secretCell.configure(title: "Shared Secret", placeholder: "Enter secret", isSecure: true)
        
        generateSecretCell.textLabel?.text = "Generate Secret"
        generateSecretCell.textLabel?.textColor = .systemBlue
        generateSecretCell.accessoryType = .none
    }
    
    private func loadCurrentSettings() {
        let defaults = UserDefaults.standard
        serverUrlCell.textField.text = defaults.string(forKey: "websocket.serverUrl")
        roomIdCell.textField.text = defaults.string(forKey: "websocket.roomId")
        secretCell.textField.text = defaults.string(forKey: "websocket.secret")
    }
    
    @objc private func save() {
        guard let serverUrl = serverUrlCell.textField.text, !serverUrl.isEmpty,
              let roomId = roomIdCell.textField.text, !roomId.isEmpty,
              let secret = secretCell.textField.text, !secret.isEmpty else {
            showAlert("Missing Information", "Please fill in all fields")
            return
        }
        
        // Update SyncManager configuration
        SyncManager.shared.updateWebSocketConfig(
            url: serverUrl,
            roomId: roomId,
            secret: secret
        )
        
        // Save to defaults for persistence
        let defaults = UserDefaults.standard
        defaults.set(serverUrl, forKey: "websocket.serverUrl")
        defaults.set(roomId, forKey: "websocket.roomId")
        defaults.set(secret, forKey: "websocket.secret")
        
        // Update discovery method and connect
        SyncManager.shared.discoveryMethod = .websocket
        
        Task {
            do {
                try await SyncManager.shared.connect()
                await MainActor.run {
                    self.navigationController?.popViewController(animated: true)
                }
            } catch {
                await MainActor.run {
                    self.showAlert("Connection Failed", error.localizedDescription)
                }
            }
        }
    }
    
    private func showAlert(_ title: String, _ message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - Table View
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return 2
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return section == 0 ? 3 : 1
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if indexPath.section == 0 {
            switch indexPath.row {
            case 0: return serverUrlCell
            case 1: return roomIdCell
            case 2: return secretCell
            default: return UITableViewCell()
            }
        } else {
            return generateSecretCell
        }
    }
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        if indexPath.section == 1 && indexPath.row == 0 {
            generateSecret()
        }
    }
    
    private func generateSecret() {
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        let secret = String((0..<32).map { _ in characters.randomElement()! })
        secretCell.textField.text = secret
    }
}

// MARK: - STUN Configuration

class STUNConfigViewController: UITableViewController {
    
    private let textView = UITextView()
    private let manualShareCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    private let qrCodeCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "STUN Settings"
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Save", style: .done, target: self, action: #selector(save))
        
        setupUI()
        loadCurrentSettings()
    }
    
    private func setupUI() {
        textView.font = .systemFont(ofSize: 14)
        textView.text = "stun:stun.l.google.com:19302\nstun:stun1.l.google.com:19302"
        
        manualShareCell.textLabel?.text = "Manual Connection"
        manualShareCell.accessoryType = .disclosureIndicator
        
        qrCodeCell.textLabel?.text = "QR Code"
        qrCodeCell.accessoryType = .disclosureIndicator
    }
    
    private func loadCurrentSettings() {
        let defaults = UserDefaults.standard
        if let servers = defaults.array(forKey: "stun.servers") as? [String] {
            textView.text = servers.joined(separator: "\n")
        }
    }
    
    @objc private func save() {
        let servers = textView.text
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        
        guard !servers.isEmpty else {
            showAlert("Missing Information", "Please provide at least one STUN server")
            return
        }
        
        // Update SyncManager configuration
        SyncManager.shared.updateSTUNConfig(servers: servers)
        
        // Save to defaults for persistence
        UserDefaults.standard.set(servers, forKey: "stun.servers")
        
        // Update discovery method and connect
        SyncManager.shared.discoveryMethod = .stunOnly
        
        Task {
            do {
                try await SyncManager.shared.connect()
                await MainActor.run {
                    self.navigationController?.popViewController(animated: true)
                }
            } catch {
                await MainActor.run {
                    self.showAlert("Connection Failed", error.localizedDescription)
                }
            }
        }
    }
    
    private func showAlert(_ title: String, _ message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - Table View
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return 2
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return section == 0 ? 1 : 2
    }
    
    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return section == 0 ? "STUN Servers (one per line)" : "Connection Methods"
    }
    
    override func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return indexPath.section == 0 ? 120 : 44
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if indexPath.section == 0 {
            let cell = UITableViewCell()
            cell.contentView.addSubview(textView)
            textView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                textView.topAnchor.constraint(equalTo: cell.contentView.topAnchor, constant: 8),
                textView.leadingAnchor.constraint(equalTo: cell.contentView.leadingAnchor, constant: 16),
                textView.trailingAnchor.constraint(equalTo: cell.contentView.trailingAnchor, constant: -16),
                textView.bottomAnchor.constraint(equalTo: cell.contentView.bottomAnchor, constant: -8)
            ])
            return cell
        } else {
            return indexPath.row == 0 ? manualShareCell : qrCodeCell
        }
    }
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        if indexPath.section == 1 {
            if indexPath.row == 0 {
                navigationController?.pushViewController(ManualShareViewController(), animated: true)
            } else {
                navigationController?.pushViewController(QRCodeViewController(), animated: true)
            }
        }
    }
}

// MARK: - Cloudflare Configuration

class CloudflareConfigViewController: UITableViewController {
    
    private let domainCell = TextFieldCell()
    private let zoneIdCell = TextFieldCell()
    private let apiTokenCell = TextFieldCell()
    private let roomIdCell = TextFieldCell()
    private let importConfigCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    private let exportConfigCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    private let debugCell = UITableViewCell(style: .default, reuseIdentifier: nil)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Cloudflare Settings"
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Save", style: .done, target: self, action: #selector(save))
        
        setupCells()
        loadCurrentSettings()
    }
    
    private func setupCells() {
        domainCell.configure(title: "Domain", placeholder: "example.com")
        zoneIdCell.configure(title: "Zone ID", placeholder: "Enter zone ID")
        apiTokenCell.configure(title: "API Token", placeholder: "Enter API token", isSecure: true)
        roomIdCell.configure(title: "Room ID", placeholder: "sync-room")
        
        importConfigCell.textLabel?.text = "Import Configuration"
        importConfigCell.textLabel?.textColor = .systemBlue
        
        exportConfigCell.textLabel?.text = "Export Configuration"
        exportConfigCell.textLabel?.textColor = .systemBlue
        
        debugCell.textLabel?.text = "Debug DNS Discovery"
        debugCell.textLabel?.textColor = .systemBlue
        debugCell.accessoryType = .disclosureIndicator
    }
    
    private func loadCurrentSettings() {
        let defaults = UserDefaults.standard
        domainCell.textField.text = defaults.string(forKey: "cloudflare.domain")
        zoneIdCell.textField.text = defaults.string(forKey: "cloudflare.zoneId")
        apiTokenCell.textField.text = defaults.string(forKey: "cloudflare.apiToken")
        roomIdCell.textField.text = defaults.string(forKey: "cloudflare.roomId")
    }
    
    @objc private func save() {
        guard let domain = domainCell.textField.text, !domain.isEmpty,
              let zoneId = zoneIdCell.textField.text, !zoneId.isEmpty,
              let apiToken = apiTokenCell.textField.text, !apiToken.isEmpty,
              let roomId = roomIdCell.textField.text, !roomId.isEmpty else {
            showAlert("Missing Information", "Please fill in all fields")
            return
        }
        
        // Update SyncManager configuration
        SyncManager.shared.updateCloudflareConfig(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
        
        // Save to defaults for persistence
        let defaults = UserDefaults.standard
        defaults.set(domain, forKey: "cloudflare.domain")
        defaults.set(zoneId, forKey: "cloudflare.zoneId")
        defaults.set(apiToken, forKey: "cloudflare.apiToken")
        defaults.set(roomId, forKey: "cloudflare.roomId")
        
        // Update discovery method and connect
        SyncManager.shared.discoveryMethod = .cloudflareDNS
        
        Task {
            do {
                try await SyncManager.shared.connect()
                await MainActor.run {
                    self.navigationController?.popViewController(animated: true)
                }
            } catch {
                await MainActor.run {
                    self.showAlert("Connection Failed", error.localizedDescription)
                }
            }
        }
    }
    
    private func showAlert(_ title: String, _ message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - Table View
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return 3
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch section {
        case 0: return 4
        case 1: return 2
        case 2: return 1
        default: return 0
        }
    }
    
    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        switch section {
        case 0: return "Cloudflare Configuration"
        case 1: return "Import/Export"
        case 2: return "Debug"
        default: return nil
        }
    }
    
    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        if section == 0 {
            return "Room ID must be identical on all devices to enable discovery. Example: 'my-devices' or 'family-sync'"
        }
        return nil
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if indexPath.section == 0 {
            switch indexPath.row {
            case 0: return domainCell
            case 1: return zoneIdCell
            case 2: return apiTokenCell
            case 3: return roomIdCell
            default: return UITableViewCell()
            }
        } else if indexPath.section == 1 {
            return indexPath.row == 0 ? importConfigCell : exportConfigCell
        } else {
            return debugCell
        }
    }
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        if indexPath.section == 1 {
            if indexPath.row == 0 {
                importConfig()
            } else {
                exportConfig()
            }
        } else if indexPath.section == 2 {
            navigationController?.pushViewController(CloudflareDebugViewController(), animated: true)
        }
    }
    
    private func importConfig() {
        let alert = UIAlertController(title: "Import Configuration", message: "Paste the configuration code", preferredStyle: .alert)
        alert.addTextField { textField in
            textField.placeholder = "Configuration code"
        }
        alert.addAction(UIAlertAction(title: "Import", style: .default) { _ in
            // TODO: Parse and import configuration
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }
    
    private func exportConfig() {
        // TODO: Generate and share configuration
        let config = "cloudflare-config-example"
        let activityVC = UIActivityViewController(activityItems: [config], applicationActivities: nil)
        present(activityVC, animated: true)
    }
}

// MARK: - Manual Share

class ManualShareViewController: UIViewController {
    
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let statusLabel = UILabel()
    private let offerTextView = UITextView()
    private let shareButton = UIButton(type: .system)
    private let pasteResponseTextView = UITextView()
    private let connectButton = UIButton(type: .system)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Manual Connection"
        view.backgroundColor = .systemBackground
        
        setupUI()
        generateOffer()
    }
    
    private func setupUI() {
        // Add views
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)
        
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stackView.isLayoutMarginsRelativeArrangement = true
        
        // Status
        statusLabel.text = "Step 1: Share this connection offer"
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        stackView.addArrangedSubview(statusLabel)
        
        // Offer
        offerTextView.isEditable = false
        offerTextView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        offerTextView.layer.borderColor = UIColor.systemGray4.cgColor
        offerTextView.layer.borderWidth = 1
        offerTextView.layer.cornerRadius = 8
        offerTextView.heightAnchor.constraint(equalToConstant: 100).isActive = true
        stackView.addArrangedSubview(offerTextView)
        
        // Share button
        shareButton.setTitle("Share Offer", for: .normal)
        shareButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        shareButton.addTarget(self, action: #selector(shareOffer), for: .touchUpInside)
        stackView.addArrangedSubview(shareButton)
        
        // Separator
        let separator = UIView()
        separator.backgroundColor = .systemGray5
        separator.heightAnchor.constraint(equalToConstant: 1).isActive = true
        stackView.addArrangedSubview(separator)
        
        // Response section
        let responseLabel = UILabel()
        responseLabel.text = "Step 2: Paste the response here"
        responseLabel.font = .systemFont(ofSize: 16, weight: .medium)
        stackView.addArrangedSubview(responseLabel)
        
        pasteResponseTextView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        pasteResponseTextView.layer.borderColor = UIColor.systemGray4.cgColor
        pasteResponseTextView.layer.borderWidth = 1
        pasteResponseTextView.layer.cornerRadius = 8
        pasteResponseTextView.heightAnchor.constraint(equalToConstant: 100).isActive = true
        stackView.addArrangedSubview(pasteResponseTextView)
        
        // Connect button
        connectButton.setTitle("Connect", for: .normal)
        connectButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        connectButton.addTarget(self, action: #selector(connect), for: .touchUpInside)
        stackView.addArrangedSubview(connectButton)
        
        contentView.addSubview(stackView)
        
        // Layout
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
            
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])
    }
    
    private func generateOffer() {
        // TODO: Generate real WebRTC offer
        offerTextView.text = "OFFER-" + UUID().uuidString
    }
    
    @objc private func shareOffer() {
        let activityVC = UIActivityViewController(
            activityItems: [offerTextView.text ?? ""],
            applicationActivities: nil
        )
        present(activityVC, animated: true)
    }
    
    @objc private func connect() {
        // TODO: Process response and establish connection
        let response = pasteResponseTextView.text ?? ""
        if response.isEmpty {
            showAlert(title: "Error", message: "Please paste a response")
            return
        }
        
        showAlert(title: "Connecting", message: "Processing response...")
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - QR Code

class QRCodeViewController: UIViewController {
    
    private let imageView = UIImageView()
    private let instructionLabel = UILabel()
    private let scanButton = UIButton(type: .system)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "QR Code"
        view.backgroundColor = .systemBackground
        
        setupUI()
        generateQRCode()
    }
    
    private func setupUI() {
        imageView.contentMode = .scaleAspectFit
        instructionLabel.text = "Scan this code with another device to connect"
        instructionLabel.textAlignment = .center
        instructionLabel.numberOfLines = 0
        
        scanButton.setTitle("Scan QR Code", for: .normal)
        scanButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        scanButton.addTarget(self, action: #selector(scanQRCode), for: .touchUpInside)
        
        let stackView = UIStackView(arrangedSubviews: [imageView, instructionLabel, scanButton])
        stackView.axis = .vertical
        stackView.spacing = 20
        stackView.alignment = .center
        
        view.addSubview(stackView)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
            stackView.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -40),
            
            imageView.widthAnchor.constraint(equalToConstant: 200),
            imageView.heightAnchor.constraint(equalToConstant: 200)
        ])
    }
    
    private func generateQRCode() {
        // TODO: Generate real QR code
        imageView.image = UIImage(systemName: "qrcode")
        imageView.tintColor = .label
    }
    
    @objc private func scanQRCode() {
        // TODO: Implement QR code scanning
        showAlert(title: "Not Implemented", message: "QR code scanning coming soon")
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - Debug

class DebugViewController: UITableViewController {
    
    private var logs: [String] = []
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Debug"
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Clear", style: .plain, target: self, action: #selector(clearLogs))
        
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "LogCell")
        loadLogs()
    }
    
    private func loadLogs() {
        // TODO: Load real logs
        logs = [
            "Connected to signaling server",
            "Peer connection established",
            "Data channel opened",
            "Synced 142 history entries",
            "Connection state: stable"
        ]
    }
    
    @objc private func clearLogs() {
        logs.removeAll()
        tableView.reloadData()
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return logs.count
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "LogCell", for: indexPath)
        cell.textLabel?.text = logs[indexPath.row]
        cell.textLabel?.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        return cell
    }
}

// MARK: - Helper Cell

class TextFieldCell: UITableViewCell {
    
    let textField = UITextField()
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        contentView.addSubview(textField)
        textField.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            textField.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            textField.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            textField.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 11),
            textField.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -11)
        ])
        
        selectionStyle = .none
    }
    
    func configure(title: String, placeholder: String, keyboardType: UIKeyboardType = .default, isSecure: Bool = false) {
        textLabel?.text = title
        textField.placeholder = placeholder
        textField.keyboardType = keyboardType
        textField.isSecureTextEntry = isSecure
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
    }
}