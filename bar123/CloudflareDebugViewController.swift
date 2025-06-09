//
//  CloudflareDebugViewController.swift
//  bar123
//
//  Debug view for Cloudflare DNS discovery
//

import UIKit

class CloudflareDebugViewController: UIViewController {
    
    private let textView = UITextView()
    private let testButton = UIButton(type: .system)
    private let clearButton = UIButton(type: .system)
    
    private var apiToken: String = ""
    private var zoneId: String = ""
    private var domain: String = ""
    private var roomId: String = ""
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        title = "Cloudflare DNS Debug"
        view.backgroundColor = .systemBackground
        
        setupUI()
        loadConfig()
    }
    
    private func setupUI() {
        // Text view for logs
        textView.isEditable = false
        textView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.backgroundColor = .secondarySystemBackground
        textView.layer.cornerRadius = 8
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)
        
        // Test button
        testButton.setTitle("Test Cloudflare DNS", for: .normal)
        testButton.addTarget(self, action: #selector(testCloudflare), for: .touchUpInside)
        testButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(testButton)
        
        // Clear button
        clearButton.setTitle("Clear Logs", for: .normal)
        clearButton.addTarget(self, action: #selector(clearLogs), for: .touchUpInside)
        clearButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(clearButton)
        
        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            textView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            textView.bottomAnchor.constraint(equalTo: testButton.topAnchor, constant: -16),
            
            testButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            testButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            
            clearButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            clearButton.centerYAnchor.constraint(equalTo: testButton.centerYAnchor)
        ])
    }
    
    private func loadConfig() {
        let defaults = UserDefaults.standard
        
        if let data = defaults.data(forKey: "config.cloudflare"),
           let config = try? JSONDecoder().decode([String: String].self, from: data) {
            apiToken = config["apiToken"] ?? ""
            zoneId = config["zoneId"] ?? ""
            domain = config["domain"] ?? ""
            roomId = config["roomId"] ?? ""
            
            log("Loaded Cloudflare config:")
            log("  Domain: \(domain)")
            log("  Zone ID: \(zoneId)")
            log("  Room ID: \(roomId)")
            log("  API Token: \(apiToken.prefix(8))...")
        } else {
            log("No Cloudflare configuration found")
        }
    }
    
    @objc private func testCloudflare() {
        log("\n=== Starting Cloudflare DNS Test ===")
        
        guard !apiToken.isEmpty && !zoneId.isEmpty && !domain.isEmpty else {
            log("ERROR: Missing configuration. Please configure Cloudflare DNS in settings.")
            return
        }
        
        Task {
            await runTests()
        }
    }
    
    private func runTests() async {
        // Test 1: Verify API Access
        log("\n1. Testing API access...")
        do {
            let verified = try await verifyAPIAccess()
            if verified {
                log("✅ API access verified")
            } else {
                log("❌ API access failed")
                return
            }
        } catch {
            log("❌ API error: \(error.localizedDescription)")
            return
        }
        
        // Test 2: List existing DNS records
        log("\n2. Listing existing DNS records...")
        do {
            let records = try await listDNSRecords()
            log("Found \(records.count) DNS records")
            for record in records.prefix(5) {
                log("  - \(record.name): \(record.content)")
            }
        } catch {
            log("❌ List records error: \(error.localizedDescription)")
        }
        
        // Test 3: Create a test record
        log("\n3. Creating test DNS record...")
        let testRecordName = "_p2psync-test-\(UUID().uuidString.prefix(8)).\(domain)"
        do {
            try await createDNSRecord(name: testRecordName, content: "test-content")
            log("✅ Created test record: \(testRecordName)")
            
            // Clean up after 5 seconds
            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                log("\n4. Cleaning up test record...")
                try? await deleteDNSRecord(name: testRecordName)
                log("✅ Deleted test record")
            }
        } catch {
            log("❌ Create record error: \(error.localizedDescription)")
        }
        
        log("\n=== Test Complete ===")
    }
    
    private func verifyAPIAccess() async throws -> Bool {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(zoneId)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            log("API Response: \(httpResponse.statusCode)")
            return httpResponse.statusCode == 200
        }
        return false
    }
    
    private func listDNSRecords() async throws -> [DNSRecord] {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        struct Response: Decodable {
            let result: [DNSRecord]?
        }
        
        let response = try JSONDecoder().decode(Response.self, from: data)
        return response.result ?? []
    }
    
    private func createDNSRecord(name: String, content: String) async throws {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "type": "TXT",
            "name": name,
            "content": content,
            "ttl": 120
        ] as [String: Any]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            log("Create response: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                throw NSError(domain: "CloudflareAPI", code: httpResponse.statusCode, userInfo: nil)
            }
        }
    }
    
    private func deleteDNSRecord(name: String) async throws {
        // First find the record
        let records = try await listDNSRecords()
        guard let record = records.first(where: { $0.name == name }) else {
            log("Record not found: \(name)")
            return
        }
        
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records/\(record.id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            log("Delete response: \(httpResponse.statusCode)")
        }
    }
    
    @objc private func clearLogs() {
        textView.text = ""
    }
    
    private func log(_ message: String) {
        DispatchQueue.main.async {
            self.textView.text += message + "\n"
            
            // Auto-scroll to bottom
            if self.textView.text.count > 0 {
                let bottom = NSMakeRange(self.textView.text.count - 1, 1)
                self.textView.scrollRangeToVisible(bottom)
            }
        }
    }
}

// DNS Record model
private struct DNSRecord: Decodable {
    let id: String
    let name: String
    let content: String
    let type: String
}