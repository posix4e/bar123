//
//  CloudflareDNS.swift
//  Bar123Core
//
//  Shared Cloudflare DNS discovery implementation
//

import Foundation

// MARK: - DNS Record

public struct DNSRecord: Codable {
    public let id: String
    public let name: String
    public let type: String
    public let content: String
    public let ttl: Int
    public let created_on: String?
    public let modified_on: String?
}

// MARK: - Cloudflare Response

public struct CloudflareResponse<T: Codable>: Codable {
    public let success: Bool
    public let errors: [CloudflareError]?
    public let result: T?
}

public struct CloudflareError: Codable, Error {
    public let code: Int
    public let message: String
}

// MARK: - Cloudflare Client

public class CloudflareClient {
    private let config: CloudflareConfig
    private let baseURL = "https://api.cloudflare.com/client/v4"
    private let session: URLSession
    
    public init(config: CloudflareConfig, session: URLSession = .shared) {
        self.config = config
        self.session = session
    }
    
    // MARK: - Public Methods
    
    public func listPeerRecords() async throws -> [DNSRecord] {
        let url = URL(string: "\(baseURL)/zones/\(config.zoneId)/dns_records?type=TXT&per_page=100")!
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudflareError(code: 0, message: "Network error")
        }
        
        let result = try JSONDecoder().decode(CloudflareResponse<[DNSRecord]>.self, from: data)
        
        // Filter for our room's peer records
        let roomPrefix = "\(config.recordPrefix)-\(config.roomId)"
        return result.result?.filter { record in
            record.name.contains(roomPrefix) && record.name.contains("-peer-")
        } ?? []
    }
    
    public func createPeerRecord(peerId: String, peerInfo: PeerInfo) async throws -> String {
        let recordName = "\(config.recordPrefix)-\(config.roomId)-peer-\(peerId).\(config.domain)"
        
        // Encode peer info
        let peerData = try JSONEncoder().encode(peerInfo)
        let content = peerData.base64EncodedString()
        
        let url = URL(string: "\(baseURL)/zones/\(config.zoneId)/dns_records")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "type": "TXT",
            "name": recordName,
            "content": content,
            "ttl": config.ttl
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudflareError(code: 0, message: "Failed to create record")
        }
        
        let result = try JSONDecoder().decode(CloudflareResponse<DNSRecord>.self, from: data)
        return result.result?.id ?? ""
    }
    
    public func deletePeerRecord(recordId: String) async throws {
        let url = URL(string: "\(baseURL)/zones/\(config.zoneId)/dns_records/\(recordId)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(config.apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudflareError(code: 0, message: "Failed to delete record")
        }
    }
    
    public func decodePeerInfo(from content: String) throws -> PeerInfo {
        // Remove quotes if present (Cloudflare adds them to TXT records)
        let unquotedContent = content.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        
        guard let data = Data(base64Encoded: unquotedContent) else {
            throw CloudflareError(code: 0, message: "Invalid base64 content")
        }
        
        return try JSONDecoder().decode(PeerInfo.self, from: data)
    }
}

// MARK: - Peer Discovery Manager

public class PeerDiscoveryManager {
    private let client: CloudflareClient
    private let config: CloudflareConfig
    private let deviceInfo: PeerInfo
    
    private var ownRecordId: String?
    private var discoveryTimer: Timer?
    private var refreshTimer: Timer?
    
    public var onPeerDiscovered: ((String, PeerInfo) -> Void)?
    public var onPeerLost: ((String) -> Void)?
    
    private var knownPeers: [String: PeerInfo] = [:]
    
    public init(config: CloudflareConfig, deviceInfo: PeerInfo) {
        self.config = config
        self.deviceInfo = deviceInfo
        self.client = CloudflareClient(config: config)
    }
    
    public func start() async throws {
        // Create our own peer announcement
        ownRecordId = try await client.createPeerRecord(peerId: deviceInfo.id, peerInfo: deviceInfo)
        
        // Start discovery loop
        startDiscoveryTimer()
        
        // Start refresh timer (update our record before TTL expires)
        startRefreshTimer()
        
        // Do initial discovery
        await discoverPeers()
    }
    
    public func stop() async {
        // Stop timers
        discoveryTimer?.invalidate()
        discoveryTimer = nil
        
        refreshTimer?.invalidate()
        refreshTimer = nil
        
        // Delete our record
        if let recordId = ownRecordId {
            try? await client.deletePeerRecord(recordId: recordId)
            ownRecordId = nil
        }
        
        // Clear known peers
        knownPeers.removeAll()
    }
    
    private func startDiscoveryTimer() {
        discoveryTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            Task {
                await self.discoverPeers()
            }
        }
    }
    
    private func startRefreshTimer() {
        let refreshInterval = Double(config.ttl) / 2.0
        refreshTimer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { _ in
            Task {
                await self.refreshOwnRecord()
            }
        }
    }
    
    private func discoverPeers() async {
        do {
            let records = try await client.listPeerRecords()
            var currentPeerIds = Set<String>()
            
            for record in records {
                guard let peerInfo = try? client.decodePeerInfo(from: record.content),
                      peerInfo.id != deviceInfo.id else {
                    continue
                }
                
                currentPeerIds.insert(peerInfo.id)
                
                // Check if this is a new peer
                if knownPeers[peerInfo.id] == nil {
                    knownPeers[peerInfo.id] = peerInfo
                    onPeerDiscovered?(peerInfo.id, peerInfo)
                }
            }
            
            // Check for lost peers
            let lostPeerIds = Set(knownPeers.keys).subtracting(currentPeerIds)
            for peerId in lostPeerIds {
                knownPeers.removeValue(forKey: peerId)
                onPeerLost?(peerId)
            }
            
        } catch {
            print("Discovery error: \(error)")
        }
    }
    
    private func refreshOwnRecord() async {
        guard let recordId = ownRecordId else { return }
        
        do {
            // Delete old record
            try await client.deletePeerRecord(recordId: recordId)
            
            // Create new record with updated timestamp
            let updatedInfo = PeerInfo(
                id: deviceInfo.id,
                name: deviceInfo.name,
                type: deviceInfo.type,
                timestamp: Date()
            )
            
            ownRecordId = try await client.createPeerRecord(peerId: deviceInfo.id, peerInfo: updatedInfo)
        } catch {
            print("Failed to refresh own record: \(error)")
        }
    }
}