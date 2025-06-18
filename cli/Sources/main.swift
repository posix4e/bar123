//
//  main.swift
//  bar123-cli
//
//  Command-line interface for testing bar123 sync functionality
//

import Foundation
import ArgumentParser
import AsyncHTTPClient
import NIOCore
#if os(macOS)
import AppKit
#endif

// MARK: - Main CLI Command

@main
struct Bar123CLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "bar123",
        abstract: "Test bar123 P2P sync functionality",
        subcommands: [
            TestCloudflare.self,
            Sync.self,
            Generate.self,
            Search.self,
            Monitor.self,
            ListPeers.self,
            DeletePeer.self,
            Announce.self,
            Export.self
        ]
    )
}

// MARK: - Test Cloudflare Command

struct TestCloudflare: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Test Cloudflare DNS discovery"
    )
    
    @Option(help: "API token for Cloudflare")
    var apiToken: String = ProcessInfo.processInfo.environment["API"] ?? ""
    
    @Option(help: "Zone ID for the domain")
    var zoneId: String = ProcessInfo.processInfo.environment["ZONEID"] ?? ""
    
    @Option(help: "Domain name")
    var domain: String = ProcessInfo.processInfo.environment["DNS"] ?? ""
    
    @Option(help: "Room ID for peer discovery")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    func run() async throws {
        print("🔍 Testing Cloudflare DNS Discovery")
        print("Domain: \(domain)")
        print("Zone ID: \(zoneId)")
        print("Room ID: \(roomId)")
        print()
        
        let tester = CloudflareTester(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
        
        try await tester.runTests()
    }
}

// MARK: - Sync Command

struct Sync: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Connect to peers and sync browsing history"
    )
    
    @Option(help: "Discovery method (cloudflare, websocket)")
    var method: String = "cloudflare"
    
    @Option(help: "Room ID for peer discovery")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    @Option(help: "WebSocket signaling server URL")
    var signalingServer: String = "ws://localhost:8080"
    
    @Option(help: "API token for Cloudflare")
    var apiToken: String = ProcessInfo.processInfo.environment["API"] ?? ""
    
    @Option(help: "Zone ID for the domain")
    var zoneId: String = ProcessInfo.processInfo.environment["ZONEID"] ?? ""
    
    @Option(help: "Domain name")
    var domain: String = ProcessInfo.processInfo.environment["DNS"] ?? ""
    
    @Option(help: "Pre-shared secret for authentication")
    var secret: String = ProcessInfo.processInfo.environment["SECRET"] ?? "test-secret"
    
    @Flag(help: "Send local history to peers")
    var send: Bool = false
    
    @Flag(help: "Receive history from peers")
    var receive: Bool = false
    
    func run() async throws {
        print("🔄 Starting P2P sync")
        print("Method: \(method)")
        print("Room ID: \(roomId)")
        
        if !send && !receive {
            print("Mode: Two-way sync (send and receive)")
        } else if send {
            print("Mode: Send only")
        } else {
            print("Mode: Receive only")
        }
        print()
        
        let syncer = P2PSyncClient(
            discoveryMethod: method,
            roomId: roomId,
            signalingServer: signalingServer,
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            secret: secret
        )
        
        try await syncer.startSync(sendMode: send || (!send && !receive), 
                                  receiveMode: receive || (!send && !receive))
    }
}

// MARK: - Generate Command

struct Generate: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Generate mock history entries for testing"
    )
    
    @Option(help: "Number of history entries to generate")
    var entries: Int = 10
    
    @Option(help: "Output format (json, csv, text)")
    var format: String = "text"
    
    @Option(help: "Save to file path (optional)")
    var output: String?
    
    func run() async throws {
        print("📝 Generating \(entries) mock history entries")
        
        let generator = HistoryGenerator()
        let historyEntries = generator.generateEntries(count: entries)
        
        switch format.lowercased() {
        case "json":
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let jsonData = try encoder.encode(historyEntries)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? ""
            
            if let output = output {
                try jsonString.write(toFile: output, atomically: true, encoding: .utf8)
                print("✅ Saved \(entries) entries to \(output)")
            } else {
                print(jsonString)
            }
            
        case "csv":
            var csv = "id,url,title,deviceId,deviceName,visitDate\n"
            for entry in historyEntries {
                csv += "\(entry.id),\"\(entry.url)\",\"\(entry.title ?? "")\",\"\(entry.deviceId)\",\"\(entry.deviceName)\",\"\(entry.visitDate)\"\n"
            }
            
            if let output = output {
                try csv.write(toFile: output, atomically: true, encoding: .utf8)
                print("✅ Saved \(entries) entries to \(output)")
            } else {
                print(csv)
            }
            
        default: // text
            print("\nGenerated entries:")
            for (index, entry) in historyEntries.enumerated() {
                print("\n\(index + 1). \(entry.title ?? "Untitled")")
                print("   URL: \(entry.url)")
                print("   Device: \(entry.deviceName)")
                print("   Date: \(entry.visitDate)")
            }
            
            if let output = output {
                var text = ""
                for entry in historyEntries {
                    text += "\(entry.title ?? "Untitled")\n\(entry.url)\n\(entry.visitDate)\n\n"
                }
                try text.write(toFile: output, atomically: true, encoding: .utf8)
                print("\n✅ Saved \(entries) entries to \(output)")
            }
        }
    }
}

// MARK: - Search Command

struct Search: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Search synced history"
    )
    
    @Argument(help: "Search query")
    var query: String
    
    @Option(help: "Device ID to filter by")
    var device: String?
    
    func run() async throws {
        print("🔎 Searching for: \(query)")
        if let device = device {
            print("Device filter: \(device)")
        }
        print()
        
        let searcher = HistorySearcher()
        let results = await searcher.search(query: query, deviceId: device)
        
        if results.isEmpty {
            print("No results found")
        } else {
            print("Found \(results.count) result(s):")
            for (index, entry) in results.enumerated() {
                print("\n\(index + 1). \(entry.title ?? "Untitled")")
                print("   URL: \(entry.url)")
                print("   Device: \(entry.deviceName) (\(entry.deviceId))")
                print("   Date: \(entry.visitDate)")
            }
        }
    }
}

// MARK: - Monitor Command

struct Monitor: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Monitor peer discovery in real-time"
    )
    
    @Option(help: "Discovery method")
    var method: String = "cloudflare"
    
    @Option(help: "Room ID")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    @Option(help: "Duration in seconds")
    var duration: Int = 60
    
    func run() async throws {
        print("👀 Monitoring peer discovery")
        print("Method: \(method)")
        print("Room ID: \(roomId)")
        print("Duration: \(duration)s")
        print()
        
        let monitor = DiscoveryMonitor(
            method: method,
            roomId: roomId
        )
        
        try await monitor.monitor(duration: duration)
    }
}

// MARK: - List Peers Command

struct ListPeers: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "List all peer records in Cloudflare DNS"
    )
    
    @Option(help: "API token for Cloudflare")
    var apiToken: String = ProcessInfo.processInfo.environment["API"] ?? ""
    
    @Option(help: "Zone ID for the domain")
    var zoneId: String = ProcessInfo.processInfo.environment["ZONEID"] ?? ""
    
    @Option(help: "Domain name")
    var domain: String = ProcessInfo.processInfo.environment["DNS"] ?? ""
    
    @Option(help: "Room ID for peer discovery")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    func run() async throws {
        print("📋 Listing peer records")
        print("Domain: \(domain)")
        print("Room ID: \(roomId)")
        print()
        
        let manager = CloudflarePeerManager(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
        
        try await manager.listPeers()
    }
}

// MARK: - Delete Peer Command

struct DeletePeer: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Delete peer records from Cloudflare DNS"
    )
    
    @Option(help: "API token for Cloudflare")
    var apiToken: String = ProcessInfo.processInfo.environment["API"] ?? ""
    
    @Option(help: "Zone ID for the domain")
    var zoneId: String = ProcessInfo.processInfo.environment["ZONEID"] ?? ""
    
    @Option(help: "Domain name")
    var domain: String = ProcessInfo.processInfo.environment["DNS"] ?? ""
    
    @Option(help: "Room ID for peer discovery")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    @Option(help: "Specific peer ID to delete (if not provided, will prompt)")
    var peerId: String?
    
    @Flag(help: "Delete all peer records without prompting")
    var all: Bool = false
    
    func run() async throws {
        print("🗑️ Delete peer records")
        print("Domain: \(domain)")
        print("Room ID: \(roomId)")
        print()
        
        let manager = CloudflarePeerManager(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
        
        if all {
            try await manager.deleteAllPeers()
        } else if let peerId = peerId {
            try await manager.deletePeer(peerId: peerId)
        } else {
            try await manager.interactiveDelete()
        }
    }
}

// MARK: - Announce Command

struct Announce: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Announce this device as a peer in Cloudflare DNS"
    )
    
    @Option(help: "API token for Cloudflare")
    var apiToken: String = ProcessInfo.processInfo.environment["API"] ?? ""
    
    @Option(help: "Zone ID for the domain")
    var zoneId: String = ProcessInfo.processInfo.environment["ZONEID"] ?? ""
    
    @Option(help: "Domain name")
    var domain: String = ProcessInfo.processInfo.environment["DNS"] ?? ""
    
    @Option(help: "Room ID for peer discovery")
    var roomId: String = ProcessInfo.processInfo.environment["ROOMID"] ?? "test-room"
    
    @Option(help: "Device name")
    var name: String = "CLI Device"
    
    @Option(help: "Device type")
    var type: String = "cli"
    
    @Option(help: "TTL in seconds")
    var ttl: Int = 120
    
    @Flag(help: "Keep announcing (refresh every TTL/2 seconds)")
    var keepAlive: Bool = false
    
    func run() async throws {
        print("📢 Announcing device as peer")
        print("Room ID: \(roomId)")
        print("Device name: \(name)")
        print()
        
        let announcer = PeerAnnouncer(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId,
            deviceName: name,
            deviceType: type,
            ttl: ttl
        )
        
        if keepAlive {
            print("Keeping peer announcement alive (Ctrl+C to stop)...")
            try await announcer.announceWithKeepAlive()
        } else {
            try await announcer.announceOnce()
            print("\n✅ Peer announced successfully")
            print("Note: This announcement will expire in \(ttl) seconds")
        }
    }
}

// MARK: - Export Command

struct Export: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Export received history to stdout in various formats"
    )
    
    @Option(help: "Export format (json, csv, jsonl)")
    var format: String = "json"
    
    @Option(help: "History file path (defaults to ~/.bar123/history.json)")
    var historyFile: String?
    
    @Option(help: "Filter by device ID")
    var device: String?
    
    @Option(help: "Filter by date (YYYY-MM-DD)")
    var since: String?
    
    @Flag(help: "Pretty print JSON output")
    var pretty: Bool = false
    
    func run() async throws {
        let historyPath = historyFile ?? NSHomeDirectory() + "/.bar123/history.json"
        
        // Load history from file
        guard FileManager.default.fileExists(atPath: historyPath) else {
            throw ExportError.historyNotFound(historyPath)
        }
        
        let data = try Data(contentsOf: URL(fileURLWithPath: historyPath))
        var entries = try JSONDecoder().decode([HistoryEntry].self, from: data)
        
        // Apply filters
        if let device = device {
            entries = entries.filter { $0.deviceId == device }
        }
        
        if let since = since {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            if let sinceDate = formatter.date(from: since) {
                entries = entries.filter { $0.visitDate >= sinceDate }
            }
        }
        
        // Export based on format
        switch format.lowercased() {
        case "json":
            let encoder = JSONEncoder()
            if pretty {
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            }
            let output = try encoder.encode(entries)
            print(String(data: output, encoding: .utf8) ?? "")
            
        case "csv":
            print("url,title,deviceId,deviceName,visitDate")
            for entry in entries {
                let title = (entry.title ?? "").replacingOccurrences(of: "\"", with: "\"\"")
                let url = entry.url.replacingOccurrences(of: "\"", with: "\"\"")
                print("\"\(url)\",\"\(title)\",\"\(entry.deviceId)\",\"\(entry.deviceName)\",\"\(ISO8601DateFormatter().string(from: entry.visitDate))\"")
            }
            
        case "jsonl":
            let encoder = JSONEncoder()
            for entry in entries {
                if let line = try? encoder.encode(entry),
                   let jsonString = String(data: line, encoding: .utf8) {
                    print(jsonString)
                }
            }
            
        default:
            throw ExportError.unsupportedFormat(format)
        }
    }
    
    enum ExportError: Error {
        case historyNotFound(String)
        case unsupportedFormat(String)
    }
}

// MARK: - Cloudflare Tester

class CloudflareTester {
    let apiToken: String
    let zoneId: String
    let domain: String
    let roomId: String
    let httpClient: HTTPClient
    
    init(apiToken: String, zoneId: String, domain: String, roomId: String) {
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.roomId = roomId
        self.httpClient = HTTPClient(eventLoopGroupProvider: .singleton)
    }
    
    deinit {
        try? httpClient.syncShutdown()
    }
    
    func runTests() async throws {
        print("1️⃣ Testing API access...")
        try await testAPIAccess()
        
        print("\n2️⃣ Listing existing peer records...")
        try await listPeerRecords()
        
        print("\n3️⃣ Creating test peer announcement...")
        let recordId = try await createTestRecord()
        
        print("\n4️⃣ Verifying record is discoverable...")
        try await verifyRecord()
        
        if let recordId = recordId {
            print("\n5️⃣ Cleaning up test record...")
            try await deleteRecord(recordId)
        }
        
        print("\n✅ All tests passed!")
    }
    
    private func testAPIAccess() async throws {
        var request = HTTPClientRequest(url: "https://api.cloudflare.com/client/v4/zones/\(zoneId)")
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        
        if response.status == .ok {
            print("✅ API access verified")
        } else {
            print("❌ API access failed: \(response.status)")
            throw TestError.apiAccessFailed
        }
    }
    
    private func listPeerRecords() async throws {
        let url = "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT&name=_p2psync-\(roomId)"
        var request = HTTPClientRequest(url: url)
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        var body = try await response.body.collect(upTo: 1024 * 1024) // 1MB max
        
        if let data = body.readData(length: body.readableBytes),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let result = json["result"] as? [[String: Any]] {
            print("Found \(result.count) DNS record(s)")
            for record in result.prefix(5) {
                if let name = record["name"] as? String {
                    print("  - \(name)")
                }
            }
        }
    }
    
    private func createTestRecord() async throws -> String? {
        let testId = "cli-test-\(UUID().uuidString.prefix(8))"
        let recordName = "_p2psync-\(roomId)-peer-\(testId).\(domain)"
        
        let testData: [String: Any] = [
            "id": testId,
            "name": "CLI Test Peer",
            "type": "cli",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        let jsonData = try JSONSerialization.data(withJSONObject: testData)
        let encodedData = jsonData.base64EncodedString()
        
        let body: [String: Any] = [
            "type": "TXT",
            "name": recordName,
            "content": encodedData,
            "ttl": 120
        ]
        
        var request = HTTPClientRequest(url: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records")
        request.method = .POST
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        request.headers.add(name: "Content-Type", value: "application/json")
        request.body = .bytes(ByteBuffer(data: try JSONSerialization.data(withJSONObject: body)))
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        
        if response.status == .ok {
            print("✅ Created test record: \(recordName)")
            
            // Extract record ID for cleanup
            var responseBody = try await response.body.collect(upTo: 1024 * 1024)
            if let data = responseBody.readData(length: responseBody.readableBytes),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let result = json["result"] as? [String: Any],
               let recordId = result["id"] as? String {
                return recordId
            }
        } else {
            print("❌ Failed to create record: \(response.status)")
        }
        
        return nil
    }
    
    private func verifyRecord() async throws {
        // Wait a bit for DNS propagation
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        print("✅ Record should now be discoverable by other peers")
    }
    
    private func deleteRecord(_ recordId: String) async throws {
        var request = HTTPClientRequest(url: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records/\(recordId)")
        request.method = .DELETE
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        
        if response.status == .ok {
            print("✅ Test record deleted")
        } else {
            print("⚠️ Failed to delete test record")
        }
    }
    
    enum TestError: Error {
        case apiAccessFailed
    }
}

// MARK: - History Generator

class HistoryGenerator {
    func generateEntries(count: Int) -> [HistoryEntry] {
        let domains = ["github.com", "stackoverflow.com", "apple.com", "google.com", "wikipedia.org", "reddit.com", "news.ycombinator.com"]
        let titles = ["Home", "Documentation", "Search Results", "Article", "Dashboard", "Profile", "Settings", "API Reference"]
        let paths = ["/", "/docs", "/search", "/article", "/dashboard", "/user", "/settings", "/api", "/help", "/about"]
        
        return (0..<count).map { index in
            let domain = domains.randomElement()!
            let path = paths.randomElement()!
            let title = "\(titles.randomElement()!) - \(domain)"
            let url = "https://\(domain)\(path)?q=\(index)"
            
            return HistoryEntry(
                url: url,
                title: title,
                deviceId: "cli-device-\(ProcessInfo.processInfo.processIdentifier)",
                deviceName: ProcessInfo.processInfo.hostName,
                visitDate: Date().addingTimeInterval(Double(-index * 3600)) // 1 hour apart
            )
        }
    }
}

// MARK: - P2P Sync Client

class P2PSyncClient {
    let discoveryMethod: String
    let roomId: String
    let signalingServer: String
    let apiToken: String
    let zoneId: String
    let domain: String
    let secret: String
    let httpClient: HTTPClient
    
    init(discoveryMethod: String, roomId: String, signalingServer: String,
         apiToken: String, zoneId: String, domain: String, secret: String) {
        self.discoveryMethod = discoveryMethod
        self.roomId = roomId
        self.signalingServer = signalingServer
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.secret = secret
        self.httpClient = HTTPClient(eventLoopGroupProvider: .singleton)
    }
    
    deinit {
        try? httpClient.syncShutdown()
    }
    
    func startSync(sendMode: Bool, receiveMode: Bool) async throws {
        print("🔍 Discovering peers using \(discoveryMethod)...")
        
        switch discoveryMethod.lowercased() {
        case "cloudflare":
            try await syncViaCloudflare(sendMode: sendMode, receiveMode: receiveMode)
        case "websocket":
            try await syncViaWebSocket(sendMode: sendMode, receiveMode: receiveMode)
        default:
            throw SyncError.unsupportedMethod(discoveryMethod)
        }
    }
    
    private func syncViaCloudflare(sendMode: Bool, receiveMode: Bool) async throws {
        // This is a simplified version - in reality, you'd need WebRTC implementation
        print("Using Cloudflare DNS for peer discovery")
        print("Room: \(roomId)")
        
        // List current peers
        let manager = CloudflarePeerManager(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
        
        print("\nDiscovering peers...")
        try await manager.listPeers()
        
        print("\n⚠️ Note: Full P2P sync requires WebRTC implementation")
        print("This is a demonstration of peer discovery via Cloudflare DNS")
        
        // In a real implementation:
        // 1. Announce ourselves as a peer
        // 2. Discover other peers
        // 3. Exchange WebRTC offers/answers via DNS records
        // 4. Establish P2P connections
        // 5. Sync data over data channels
    }
    
    private func syncViaWebSocket(sendMode: Bool, receiveMode: Bool) async throws {
        print("Using WebSocket signaling server: \(signalingServer)")
        print("Room: \(roomId)")
        
        print("\n⚠️ Note: Full P2P sync requires WebRTC implementation")
        print("This would connect to the signaling server and establish P2P connections")
    }
    
    enum SyncError: Error {
        case unsupportedMethod(String)
        case connectionFailed
        case authenticationFailed
    }
}

// MARK: - Peer Announcer

class PeerAnnouncer {
    let apiToken: String
    let zoneId: String
    let domain: String
    let roomId: String
    let deviceName: String
    let deviceType: String
    let ttl: Int
    let httpClient: HTTPClient
    let deviceId: String
    
    init(apiToken: String, zoneId: String, domain: String, roomId: String,
         deviceName: String, deviceType: String, ttl: Int) {
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.roomId = roomId
        self.deviceName = deviceName
        self.deviceType = deviceType
        self.ttl = ttl
        self.httpClient = HTTPClient(eventLoopGroupProvider: .singleton)
        self.deviceId = "cli-\(UUID().uuidString.prefix(8))"
    }
    
    deinit {
        try? httpClient.syncShutdown()
    }
    
    func announceOnce() async throws {
        let recordName = "_p2psync-\(roomId)-peer-\(deviceId).\(domain)"
        
        // Create peer announcement data
        let peerData: [String: Any] = [
            "id": deviceId,
            "name": deviceName,
            "type": deviceType,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]
        
        let jsonData = try JSONSerialization.data(withJSONObject: peerData)
        let content = jsonData.base64EncodedString()
        
        print("Creating peer record: \(recordName)")
        
        // Create or update DNS record
        var request = HTTPClientRequest(url: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records")
        request.method = .POST
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        request.headers.add(name: "Content-Type", value: "application/json")
        
        let body: [String: Any] = [
            "type": "TXT",
            "name": recordName,
            "content": content,
            "ttl": ttl
        ]
        
        request.body = .bytes(ByteBuffer(data: try JSONSerialization.data(withJSONObject: body)))
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        
        if response.status == .ok {
            print("✅ Peer announced: \(deviceId)")
            print("   Name: \(deviceName)")
            print("   Type: \(deviceType)")
            print("   TTL: \(ttl)s")
        } else {
            print("❌ Failed to announce peer: \(response.status)")
        }
    }
    
    func announceWithKeepAlive() async throws {
        // Initial announcement
        try await announceOnce()
        
        // Keep refreshing before TTL expires
        let refreshInterval = max(30, ttl / 2) // Refresh at half TTL, minimum 30 seconds
        
        while true {
            try await Task.sleep(nanoseconds: UInt64(refreshInterval) * 1_000_000_000)
            print("\n🔄 Refreshing peer announcement...")
            try await announceOnce()
        }
    }
}

// MARK: - History Searcher

class HistorySearcher {
    private var historyCache: [HistoryEntry] = []
    
    init() {
        // Load mock data for testing
        loadMockHistory()
    }
    
    func search(query: String, deviceId: String?) async -> [HistoryEntry] {
        let lowercasedQuery = query.lowercased()
        
        return historyCache.filter { entry in
            let matchesQuery = entry.url.lowercased().contains(lowercasedQuery) ||
                             (entry.title?.lowercased().contains(lowercasedQuery) ?? false)
            
            let matchesDevice = deviceId == nil || entry.deviceId == deviceId
            
            return matchesQuery && matchesDevice
        }
    }
    
    private func loadMockHistory() {
        historyCache = [
            HistoryEntry(
                url: "https://github.com/anthropics/claude",
                title: "Claude Repository - GitHub",
                deviceId: "device-1",
                deviceName: "MacBook Pro"
            ),
            HistoryEntry(
                url: "https://stackoverflow.com/questions/swift-async",
                title: "Swift Async/Await - Stack Overflow",
                deviceId: "device-2",
                deviceName: "iPhone"
            ),
            HistoryEntry(
                url: "https://developer.apple.com/documentation/swift",
                title: "Swift Documentation - Apple Developer",
                deviceId: "device-1",
                deviceName: "MacBook Pro"
            )
        ]
    }
}

// MARK: - Discovery Monitor

class DiscoveryMonitor {
    let method: String
    let roomId: String
    
    init(method: String, roomId: String) {
        self.method = method
        self.roomId = roomId
    }
    
    func monitor(duration: Int) async throws {
        print("Starting monitoring... (Press Ctrl+C to stop)")
        
        let startTime = Date()
        var peerCount = 0
        
        while Date().timeIntervalSince(startTime) < Double(duration) {
            // Simulate peer discovery events
            if Int.random(in: 0..<10) < 3 {
                peerCount += 1
                print("[\(timestamp())] 🟢 Peer discovered: peer-\(peerCount) (Total: \(peerCount))")
            }
            
            if peerCount > 0 && Int.random(in: 0..<10) < 1 {
                peerCount -= 1
                print("[\(timestamp())] 🔴 Peer disconnected (Total: \(peerCount))")
            }
            
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        }
        
        print("\nMonitoring complete")
        print("Final peer count: \(peerCount)")
    }
    
    private func timestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: Date())
    }
}

// MARK: - Cloudflare Peer Manager

class CloudflarePeerManager {
    let apiToken: String
    let zoneId: String
    let domain: String
    let roomId: String
    let httpClient: HTTPClient
    
    init(apiToken: String, zoneId: String, domain: String, roomId: String) {
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.roomId = roomId
        self.httpClient = HTTPClient(eventLoopGroupProvider: .singleton)
    }
    
    deinit {
        try? httpClient.syncShutdown()
    }
    
    struct DNSRecord: Decodable {
        let id: String
        let name: String
        let content: String
        let created_on: String?
        let modified_on: String?
    }
    
    struct CloudflareListResponse: Decodable {
        let result: [DNSRecord]?
        let success: Bool
    }
    
    func listPeers() async throws {
        // Search for all records in this room
        let searchPrefix = "_p2psync-\(roomId)"
        let url = "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT&per_page=100"
        
        var request = HTTPClientRequest(url: url)
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        var body = try await response.body.collect(upTo: 1024 * 1024)
        
        guard let data = body.readData(length: body.readableBytes) else {
            print("❌ Failed to read response data")
            return
        }
        
        let listResponse = try JSONDecoder().decode(CloudflareListResponse.self, from: data)
        
        // Filter for peer records in this room
        let peerRecords = listResponse.result?.filter { record in
            record.name.contains(searchPrefix) && record.name.contains("-peer-")
        } ?? []
        
        if peerRecords.isEmpty {
            print("No peer records found for room '\(roomId)'")
            return
        }
        
        print("Found \(peerRecords.count) peer record(s):\n")
        
        for (index, record) in peerRecords.enumerated() {
            print("\(index + 1). \(record.name)")
            
            // Try to decode peer info
            if let peerInfo = try? decodePeerInfo(from: record.content) {
                print("   ID: \(peerInfo.id)")
                print("   Name: \(peerInfo.name)")
                print("   Type: \(peerInfo.type)")
                print("   Created: \(record.created_on ?? "Unknown")")
            } else {
                print("   Content: \(record.content)")
            }
            print()
        }
    }
    
    func deletePeer(peerId: String) async throws {
        // Find the record with this peer ID
        let searchName = "_p2psync-\(roomId)-peer-\(peerId).\(domain)"
        
        print("Searching for peer record: \(searchName)")
        
        let url = "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT&name=\(searchName)"
        var request = HTTPClientRequest(url: url)
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        var body = try await response.body.collect(upTo: 1024 * 1024)
        
        guard let data = body.readData(length: body.readableBytes) else {
            print("❌ Failed to read response data")
            return
        }
        
        let listResponse = try JSONDecoder().decode(CloudflareListResponse.self, from: data)
        
        guard let record = listResponse.result?.first else {
            print("❌ No record found for peer ID: \(peerId)")
            return
        }
        
        // Delete the record
        try await deleteRecord(recordId: record.id, recordName: record.name)
    }
    
    func deleteAllPeers() async throws {
        print("⚠️ Deleting ALL peer records for room '\(roomId)'")
        
        // List all peer records
        let searchPrefix = "_p2psync-\(roomId)"
        let url = "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records?type=TXT&per_page=100"
        
        var request = HTTPClientRequest(url: url)
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        var body = try await response.body.collect(upTo: 1024 * 1024)
        
        guard let data = body.readData(length: body.readableBytes) else {
            print("❌ Failed to read response data")
            return
        }
        
        let listResponse = try JSONDecoder().decode(CloudflareListResponse.self, from: data)
        
        let peerRecords = listResponse.result?.filter { record in
            record.name.contains(searchPrefix) && record.name.contains("-peer-")
        } ?? []
        
        if peerRecords.isEmpty {
            print("No peer records found to delete")
            return
        }
        
        print("Found \(peerRecords.count) record(s) to delete")
        
        for record in peerRecords {
            try await deleteRecord(recordId: record.id, recordName: record.name)
        }
        
        print("\n✅ Deleted \(peerRecords.count) peer record(s)")
    }
    
    func interactiveDelete() async throws {
        // List peers first
        try await listPeers()
        
        print("\nEnter peer ID to delete (or 'all' to delete all): ", terminator: "")
        guard let input = readLine()?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            print("❌ No input provided")
            return
        }
        
        if input.lowercased() == "all" {
            print("\n⚠️ Are you sure you want to delete ALL peer records? (yes/no): ", terminator: "")
            guard let confirm = readLine()?.lowercased(),
                  confirm == "yes" || confirm == "y" else {
                print("Cancelled")
                return
            }
            try await deleteAllPeers()
        } else {
            try await deletePeer(peerId: input)
        }
    }
    
    private func deleteRecord(recordId: String, recordName: String) async throws {
        print("Deleting: \(recordName)")
        
        var request = HTTPClientRequest(url: "https://api.cloudflare.com/client/v4/zones/\(zoneId)/dns_records/\(recordId)")
        request.method = .DELETE
        request.headers.add(name: "Authorization", value: "Bearer \(apiToken)")
        
        let response = try await httpClient.execute(request, timeout: .seconds(30))
        
        if response.status == .ok {
            print("✅ Deleted successfully")
        } else {
            print("❌ Failed to delete (status: \(response.status))")
        }
    }
    
    private func decodePeerInfo(from content: String) throws -> (id: String, name: String, type: String) {
        // Remove quotes if present
        let unquotedContent = content.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        
        guard let data = Data(base64Encoded: unquotedContent),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = json["id"] as? String,
              let name = json["name"] as? String,
              let type = json["type"] as? String else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Invalid peer data"))
        }
        
        return (id: id, name: name, type: type)
    }
}

// MARK: - Models (Simplified versions)

struct HistoryEntry: Codable {
    let id: String
    let url: String
    let title: String?
    let visitDate: Date
    let deviceId: String
    let deviceName: String
    
    init(url: String, title: String?, deviceId: String, deviceName: String, visitDate: Date = Date()) {
        self.id = UUID().uuidString
        self.url = url
        self.title = title
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.visitDate = visitDate
    }
    
    enum CodingKeys: String, CodingKey {
        case id, url, title, visitDate, deviceId, deviceName
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        url = try container.decode(String.self, forKey: .url)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        deviceId = try container.decode(String.self, forKey: .deviceId)
        deviceName = try container.decode(String.self, forKey: .deviceName)
        
        // Handle both ISO8601 string and TimeInterval
        if let dateString = try? container.decode(String.self, forKey: .visitDate) {
            if let date = ISO8601DateFormatter().date(from: dateString) {
                visitDate = date
            } else {
                throw DecodingError.dataCorruptedError(forKey: .visitDate, in: container, debugDescription: "Invalid date format")
            }
        } else if let timeInterval = try? container.decode(Double.self, forKey: .visitDate) {
            visitDate = Date(timeIntervalSince1970: timeInterval)
        } else {
            visitDate = Date()
        }
    }
}