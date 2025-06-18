//
//  CloudflareSetupHelper.swift
//  bar123
//
//  Helper view to guide users through Cloudflare setup
//

import UIKit
import SafariServices

class CloudflareSetupHelper: UITableViewController {
    
    private let steps = [
        SetupStep(
            title: "Create API Token",
            subtitle: "Get a Cloudflare API token with DNS edit permissions",
            action: .openURL("https://dash.cloudflare.com/profile/api-tokens"),
            icon: "key.fill"
        ),
        SetupStep(
            title: "Find Zone ID",
            subtitle: "Copy your domain's Zone ID from Cloudflare dashboard",
            action: .openURL("https://dash.cloudflare.com"),
            icon: "globe"
        ),
        SetupStep(
            title: "Enter Configuration",
            subtitle: "Input your credentials in the settings",
            action: .navigate,
            icon: "gear"
        ),
        SetupStep(
            title: "Test Connection",
            subtitle: "Verify everything is working correctly",
            action: .test,
            icon: "checkmark.circle.fill"
        )
    ]
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Cloudflare Setup Guide"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(close)
        )
        
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "Cell")
        
        // Add header
        let headerView = createHeaderView()
        tableView.tableHeaderView = headerView
    }
    
    private func createHeaderView() -> UIView {
        let view = UIView()
        view.backgroundColor = .systemBackground
        
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.alignment = .center
        stackView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stackView)
        
        // Icon
        let iconView = UIImageView(image: UIImage(systemName: "cloud.fill"))
        iconView.tintColor = .systemBlue
        iconView.contentMode = .scaleAspectFit
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 60),
            iconView.heightAnchor.constraint(equalToConstant: 60)
        ])
        
        // Title
        let titleLabel = UILabel()
        titleLabel.text = "Cloudflare DNS Discovery"
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textAlignment = .center
        
        // Description
        let descLabel = UILabel()
        descLabel.text = "Use Cloudflare DNS to discover peers without a signaling server"
        descLabel.font = .systemFont(ofSize: 16)
        descLabel.textColor = .secondaryLabel
        descLabel.textAlignment = .center
        descLabel.numberOfLines = 0
        
        stackView.addArrangedSubview(iconView)
        stackView.addArrangedSubview(titleLabel)
        stackView.addArrangedSubview(descLabel)
        
        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stackView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])
        
        view.frame.size.height = 180
        
        return view
    }
    
    @objc private func close() {
        dismiss(animated: true)
    }
    
    // MARK: - Table View
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return 2
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return section == 0 ? steps.count : 1
    }
    
    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return section == 0 ? "Setup Steps" : "Resources"
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        
        if indexPath.section == 0 {
            let step = steps[indexPath.row]
            cell.textLabel?.text = "\(indexPath.row + 1). \(step.title)"
            cell.detailTextLabel?.text = step.subtitle
            cell.imageView?.image = UIImage(systemName: step.icon)
            cell.imageView?.tintColor = .systemBlue
            cell.accessoryType = .disclosureIndicator
        } else {
            cell.textLabel?.text = "View Setup Documentation"
            cell.textLabel?.textColor = .systemBlue
            cell.imageView?.image = UIImage(systemName: "book.fill")
            cell.imageView?.tintColor = .systemBlue
        }
        
        return cell
    }
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        if indexPath.section == 0 {
            let step = steps[indexPath.row]
            
            switch step.action {
            case .openURL(let urlString):
                if let url = URL(string: urlString) {
                    let safari = SFSafariViewController(url: url)
                    present(safari, animated: true)
                }
                
            case .navigate:
                // Navigate to Cloudflare settings
                navigationController?.popViewController(animated: false)
                if let tabBar = presentingViewController as? UITabBarController {
                    tabBar.selectedIndex = 3 // Settings tab
                    
                    // Navigate to Cloudflare settings
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        NotificationCenter.default.post(
                            name: .navigateToCloudflareSettings,
                            object: nil
                        )
                    }
                }
                dismiss(animated: true)
                
            case .test:
                // Show debug view
                let debugVC = CloudflareDebugViewController()
                navigationController?.pushViewController(debugVC, animated: true)
            }
        } else {
            // Show documentation
            showDocumentation()
        }
    }
    
    private func showDocumentation() {
        let docVC = DocumentationViewController()
        docVC.loadMarkdown("""
        # Quick Setup Guide
        
        ## 1. Create API Token
        - Go to Cloudflare → My Profile → API Tokens
        - Click "Create Token"
        - Use "Edit zone DNS" template
        - Select your domain
        - Save the token (you'll need it!)
        
        ## 2. Find Zone ID
        - Go to your domain overview
        - Find "Zone ID" in the right sidebar
        - Click to copy
        
        ## 3. Configure in App
        - Domain: `example.com`
        - Zone ID: `[paste from Cloudflare]`
        - API Token: `[paste from step 1]`
        - Room ID: `my-devices` (same on all devices!)
        
        ## 4. Test
        - Use "Debug DNS Discovery" to verify
        - Green checkmarks = success!
        
        ## Troubleshooting
        - **Most common issue**: Different Room IDs on different devices
        - **API errors**: Check token has DNS edit permission
        - **No peers found**: Wait 30 seconds, DNS takes time
        """)
        navigationController?.pushViewController(docVC, animated: true)
    }
}

// MARK: - Supporting Types

private struct SetupStep {
    let title: String
    let subtitle: String
    let action: Action
    let icon: String
    
    enum Action {
        case openURL(String)
        case navigate
        case test
    }
}

extension Notification.Name {
    static let navigateToCloudflareSettings = Notification.Name("navigateToCloudflareSettings")
}

// MARK: - Documentation View Controller

class DocumentationViewController: UIViewController {
    private let textView = UITextView()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Documentation"
        view.backgroundColor = .systemBackground
        
        textView.isEditable = false
        textView.font = .systemFont(ofSize: 16)
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)
        
        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            textView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            textView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    func loadMarkdown(_ markdown: String) {
        // Simple markdown to attributed string
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 4
        
        let attributedString = NSMutableAttributedString()
        
        for line in markdown.components(separatedBy: "\n") {
            if line.hasPrefix("# ") {
                // H1
                let text = String(line.dropFirst(2))
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 24, weight: .bold),
                    .paragraphStyle: paragraphStyle
                ]
                attributedString.append(NSAttributedString(string: text + "\n\n", attributes: attrs))
            } else if line.hasPrefix("## ") {
                // H2
                let text = String(line.dropFirst(3))
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 20, weight: .semibold),
                    .paragraphStyle: paragraphStyle
                ]
                attributedString.append(NSAttributedString(string: text + "\n\n", attributes: attrs))
            } else if line.hasPrefix("- ") {
                // Bullet point
                let text = String(line.dropFirst(2))
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 16),
                    .paragraphStyle: paragraphStyle
                ]
                attributedString.append(NSAttributedString(string: "• " + text + "\n", attributes: attrs))
            } else if line.hasPrefix("**") && line.hasSuffix("**") {
                // Bold
                let text = String(line.dropFirst(2).dropLast(2))
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 16, weight: .semibold),
                    .paragraphStyle: paragraphStyle
                ]
                attributedString.append(NSAttributedString(string: text + "\n", attributes: attrs))
            } else if !line.isEmpty {
                // Regular text
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 16),
                    .paragraphStyle: paragraphStyle
                ]
                attributedString.append(NSAttributedString(string: line + "\n", attributes: attrs))
            } else {
                // Empty line
                attributedString.append(NSAttributedString(string: "\n"))
            }
        }
        
        textView.attributedText = attributedString
    }
}