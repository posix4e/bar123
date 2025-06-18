//
//  SimpleSyncManager.swift
//  bar123
//
//  Simplified sync manager for iOS app
//

import Foundation
import Combine

class SimpleSyncManager: ObservableObject {
    static let shared = SimpleSyncManager()
    
    // Published properties for SwiftUI
    @Published var isConnected = false
    @Published var historyEntries: [HistoryEntry] = []
    @Published var connectedDevices: [DeviceInfo] = []
    @Published var statusMessage = "Not connected"
    
    // Core components
    private var discoveryManager: CloudflarePeerDiscovery?
    private let storage = SimpleHistoryStorage()
    
    // Configuration
    private var config: CloudflareConfig? {
        guard let apiToken = UserDefaults.standard.string(forKey: "cloudflareApiToken"),
              let zoneId = UserDefaults.standard.string(forKey: "cloudflareZoneId"),
              let domain = UserDefaults.standard.string(forKey: "cloudflareDomain"),
              let roomId = UserDefaults.standard.string(forKey: "roomId"),
              !apiToken.isEmpty, !zoneId.isEmpty, !domain.isEmpty else {
            return nil
        }
        
        return CloudflareConfig(
            apiToken: apiToken,
            zoneId: zoneId,
            domain: domain,
            roomId: roomId
        )
    }
    
    private var deviceInfo: DeviceInfo {
        let deviceId = UserDefaults.standard.string(forKey: "deviceId") ?? {
            let id = "ios-\(UUID().uuidString.prefix(8))"
            UserDefaults.standard.set(id, forKey: "deviceId")
            return id
        }()
        
        return DeviceInfo(
            id: deviceId,
            name: UIDevice.current.name,
            type: .ios
        )
    }
    
    // MARK: - Public Methods
    
    func start() async {
        guard let config = config else {
            statusMessage = "Not configured"
            isConnected = false
            return
        }
        
        do {
            // Load history
            historyEntries = storage.load()
            
            // Start discovery
            let peerInfo = PeerInfo(
                id: deviceInfo.id,
                name: deviceInfo.name,
                type: deviceInfo.type.rawValue
            )
            
            discoveryManager = CloudflarePeerDiscovery(
                config: config,
                deviceInfo: peerInfo
            )
            
            discoveryManager?.onPeerDiscovered = { [weak self] peerId, info in
                DispatchQueue.main.async {
                    self?.handlePeerDiscovered(peerId: peerId, info: info)
                }
            }
            
            discoveryManager?.onPeerLost = { [weak self] peerId in
                DispatchQueue.main.async {
                    self?.handlePeerLost(peerId: peerId)
                }
            }
            
            try await discoveryManager?.start()
            
            await MainActor.run {
                self.isConnected = true
                self.statusMessage = "Connected to room: \(config.roomId)"
            }
            
        } catch {
            await MainActor.run {
                self.isConnected = false
                self.statusMessage = "Connection failed: \(error.localizedDescription)"
            }
        }
    }
    
    func stop() async {
        await discoveryManager?.stop()
        discoveryManager = nil
        
        await MainActor.run {
            self.isConnected = false
            self.connectedDevices.removeAll()
            self.statusMessage = "Disconnected"
        }
    }
    
    func restart() async {
        await stop()
        await start()
    }
    
    func addHistoryEntry(_ entry: HistoryEntry) {
        historyEntries.append(entry)
        historyEntries.sort { $0.visitDate > $1.visitDate }
        storage.save(historyEntries)
        
        // In real implementation, would sync to peers via WebRTC
    }
    
    func searchHistory(_ query: String) -> [HistoryEntry] {
        guard !query.isEmpty else { return historyEntries }
        
        let lowercased = query.lowercased()
        return historyEntries.filter { entry in
            entry.url.lowercased().contains(lowercased) ||
            (entry.title?.lowercased().contains(lowercased) ?? false)
        }
    }
    
    func exportHistory(format: ExportFormat = .json) -> String {
        switch format {
        case .json:
            guard let data = try? JSONEncoder().encode(historyEntries),
                  let string = String(data: data, encoding: .utf8) else {
                return "[]"
            }
            return string
            
        case .csv:
            var csv = "url,title,deviceId,deviceName,visitDate\n"
            for entry in historyEntries {
                let title = (entry.title ?? "").replacingOccurrences(of: "\"", with: "\"\"")
                csv += "\"\(entry.url)\",\"\(title)\",\"\(entry.deviceId)\",\"\(entry.deviceName)\",\"\(entry.visitDate)\"\n"
            }
            return csv
        }
    }
    
    enum ExportFormat {
        case json
        case csv
    }
    
    // MARK: - Private Methods
    
    private func handlePeerDiscovered(peerId: String, info: PeerInfo) {
        let device = DeviceInfo(
            id: peerId,
            name: info.name,
            type: DeviceInfo.DeviceType(rawValue: info.type) ?? .unknown,
            lastSeen: Date(timeIntervalSince1970: info.timestamp)
        )
        
        if !connectedDevices.contains(where: { $0.id == peerId }) {
            connectedDevices.append(device)
        }
    }
    
    private func handlePeerLost(peerId: String) {
        connectedDevices.removeAll { $0.id == peerId }
    }
}

// MARK: - Simple History Storage

private class SimpleHistoryStorage {
    private let key = "bar123_history"
    
    func save(_ entries: [HistoryEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
    
    func load() -> [HistoryEntry] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let entries = try? JSONDecoder().decode([HistoryEntry].self, from: data) else {
            return []
        }
        return entries
    }
}

// MARK: - Simplified Cloudflare Discovery

private class CloudflarePeerDiscovery {
    private let config: CloudflareConfig
    private let deviceInfo: PeerInfo
    private var recordId: String?
    private var timer: Timer?
    
    var onPeerDiscovered: ((String, PeerInfo) -> Void)?
    var onPeerLost: ((String) -> Void)?
    
    private var knownPeers: Set<String> = []
    
    init(config: CloudflareConfig, deviceInfo: PeerInfo) {
        self.config = config
        self.deviceInfo = deviceInfo
    }
    
    func start() async throws {
        // Create our peer record
        recordId = try await createPeerRecord()
        
        // Start discovery timer
        await MainActor.run {
            timer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
                Task {
                    await self.discoverPeers()
                }
            }
        }
        
        // Initial discovery
        await discoverPeers()
    }
    
    func stop() async {
        timer?.invalidate()
        timer = nil
        
        if let recordId = recordId {
            try? await deletePeerRecord(recordId)
            self.recordId = nil
        }
        
        knownPeers.removeAll()
    }
    
    private func createPeerRecord() async throws -> String {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(config.zoneId)/dns_records")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let recordName = "\(config.recordPrefix)-\(config.roomId)-peer-\(deviceInfo.id).\(config.domain)"
        let peerData = try JSONEncoder().encode(deviceInfo)
        let content = peerData.base64EncodedString()
        
        let body: [String: Any] = [
            "type": "TXT",
            "name": recordName,
            "content": content,
            "ttl": config.ttl
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        struct Response: Decodable {
            struct Result: Decodable {
                let id: String
            }
            let result: Result?
        }
        
        let response = try JSONDecoder().decode(Response.self, from: data)
        guard let id = response.result?.id else {
            throw NSError(domain: "CloudflareError", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to create record"])
        }
        
        return id
    }
    
    private func deletePeerRecord(_ recordId: String) async throws {
        let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(config.zoneId)/dns_records/\(recordId)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, _) = try await URLSession.shared.data(for: request)
    }
    
    private func discoverPeers() async {
        do {
            let url = URL(string: "https://api.cloudflare.com/client/v4/zones/\(config.zoneId)/dns_records?type=TXT&per_page=100")!
            
            var request = URLRequest(url: url)
            request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
            
            let (data, _) = try await URLSession.shared.data(for: request)
            
            struct Response: Decodable {
                struct Record: Decodable {
                    let name: String
                    let content: String
                }
                let result: [Record]?
            }
            
            let response = try JSONDecoder().decode(Response.self, from: data)
            
            let roomPrefix = "\(config.recordPrefix)-\(config.roomId)"
            let peerRecords = response.result?.filter { record in
                record.name.contains(roomPrefix) && 
                record.name.contains("-peer-") &&
                !record.name.contains(deviceInfo.id)
            } ?? []
            
            var currentPeers = Set<String>()
            
            for record in peerRecords {
                if let peerInfo = try? decodePeerInfo(from: record.content) {
                    currentPeers.insert(peerInfo.id)
                    
                    if !knownPeers.contains(peerInfo.id) {
                        knownPeers.insert(peerInfo.id)
                        onPeerDiscovered?(peerInfo.id, peerInfo)
                    }
                }
            }
            
            // Check for lost peers
            let lostPeers = knownPeers.subtracting(currentPeers)
            for peerId in lostPeers {
                knownPeers.remove(peerId)
                onPeerLost?(peerId)
            }
            
        } catch {
            print("Discovery error: \(error)")
        }
    }
    
    private func decodePeerInfo(from content: String) throws -> PeerInfo {
        let unquotedContent = content.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        guard let data = Data(base64Encoded: unquotedContent) else {
            throw NSError(domain: "DecodeError", code: 0)
        }
        return try JSONDecoder().decode(PeerInfo.self, from: data)
    }
}