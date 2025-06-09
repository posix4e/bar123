/**
 * CloudflareDNSDiscovery.swift
 * Cloudflare DNS-based peer discovery for Swift/iOS
 */

import Foundation
import Network

// MARK: - Cloudflare DNS Discovery

class CloudflareDNSDiscovery: BasePeerDiscovery {
    private let apiToken: String
    private let zoneId: String
    private let domain: String
    private let recordPrefix: String
    private let roomId: String
    private let ttl: Int
    
    private var pollTask: Task<Void, Never>?
    private let pollInterval: TimeInterval = 5.0
    private var ownRecords = Set<String>()
    
    private let baseURL = "https://api.cloudflare.com/client/v4"
    
    init(apiToken: String, zoneId: String, domain: String, roomId: String, deviceInfo: PeerInfo, recordPrefix: String = "_p2psync", ttl: Int = 120) {
        self.apiToken = apiToken
        self.zoneId = zoneId
        self.domain = domain
        self.roomId = roomId
        self.recordPrefix = recordPrefix
        self.ttl = ttl
        
        super.init()
        
        // Set device info
        self.addPeer(deviceInfo.id, info: deviceInfo)
    }
    
    override func start() async throws {
        // Verify API access
        try await verifyAccess()
        
        // Announce our presence
        try await announcePresence()
        
        // Start polling for peers
        pollTask = Task {
            while !Task.isCancelled {
                try? await self.discoverPeers()
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
            }
        }
        
        // Initial discovery
        try await discoverPeers()
    }
    
    override func stop() async {
        pollTask?.cancel()
        pollTask = nil
        
        // Clean up our DNS records
        await cleanupRecords()
        
        await super.stop()
    }
    
    override func sendSignalingMessage(_ message: SignalingMessage, to peerId: String) async throws {
        let recordName = createRecordName(type: "msg", id: peerId, timestamp: "\(Date().timeIntervalSince1970)")
        let messageData = SignalingMessageData(
            from: discoveredPeers.values.first?.id ?? "",
            to: peerId,
            type: message.type.rawValue,
            data: message.data
        )
        
        let recordData = try encodeMessage(messageData)
        try await createDNSRecord(name: recordName, content: recordData)
        ownRecords.insert(recordName)
        
        // Clean up after 30 seconds
        Task {
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            try? await deleteDNSRecord(name: recordName)
        }
    }
    
    // MARK: - Private Methods
    
    private func announcePresence() async throws {
        guard let deviceInfo = discoveredPeers.values.first else { return }
        
        let recordName = createRecordName(type: "peer", id: deviceInfo.id)
        let presenceData = PresenceData(
            id: deviceInfo.id,
            name: deviceInfo.name,
            type: deviceInfo.type,
            timestamp: Date().timeIntervalSince1970
        )
        
        let recordData = try encodeMessage(presenceData)
        try await upsertDNSRecord(name: recordName, content: recordData)
        ownRecords.insert(recordName)
    }
    
    private func discoverPeers() async throws {
        let records = try await listDNSRecords()
        let now = Date().timeIntervalSince1970
        let maxAge: TimeInterval = 60.0 // 1 minute
        
        // Process peer announcements
        let peerRecords = records.filter { record in
            record.name.contains("\(recordPrefix)-\(roomId)-peer-") &&
            !record.name.contains("-peer-\(discoveredPeers.values.first?.id ?? "")")
        }
        
        for record in peerRecords {
            do {
                let peerInfo: PresenceData = try decodeMessage(record.content)
                
                // Skip stale peers
                if now - peerInfo.timestamp > maxAge {
                    continue
                }
                
                // Add or update peer
                if discoveredPeers[peerInfo.id] == nil {
                    let info = PeerInfo(id: peerInfo.id, name: peerInfo.name, type: peerInfo.type, timestamp: Date(timeIntervalSince1970: peerInfo.timestamp))
                    addPeer(peerInfo.id, info: info)
                }
            } catch {
                print("Failed to decode peer record: \(error)")
            }
        }
        
        // Process signaling messages for us
        let ourId = discoveredPeers.values.first?.id ?? ""
        let messageRecords = records.filter { record in
            record.name.contains("\(recordPrefix)-\(roomId)-msg-\(ourId)-")
        }
        
        for record in messageRecords {
            do {
                let messageData: SignalingMessageData = try decodeMessage(record.content)
                
                if messageData.to == ourId {
                    let message = SignalingMessage(
                        type: SignalingMessage.MessageType(rawValue: messageData.type) ?? .offer,
                        data: messageData.data
                    )
                    handleSignalingMessage(message, from: messageData.from)
                    
                    // Delete processed message
                    try await deleteDNSRecord(name: record.name)
                }
            } catch {
                print("Failed to process message record: \(error)")
            }
        }
        
        // Check for stale peers
        let currentPeerIds = Set(peerRecords.compactMap { record -> String? in
            guard let match = record.name.match(pattern: "-peer-([^.]+)") else { return nil }
            return String(match[1])
        })
        
        for (peerId, _) in discoveredPeers {
            if peerId != ourId && !currentPeerIds.contains(peerId) {
                removePeer(peerId)
            }
        }
    }
    
    private func createRecordName(type: String, id: String, timestamp: String = "") -> String {
        var parts = [recordPrefix, roomId, type, id]
        if !timestamp.isEmpty {
            parts.append(timestamp)
        }
        return parts.joined(separator: "-") + "." + domain
    }
    
    private func encodeMessage<T: Encodable>(_ data: T) throws -> String {
        let jsonData = try JSONEncoder().encode(data)
        let compressed = compress(String(data: jsonData, encoding: .utf8) ?? "")
        let encoded = compressed.data(using: .utf8)?.base64EncodedString() ?? ""
        
        // DNS TXT records have a 255 character limit
        if encoded.count > 255 {
            print("Warning: Message too large for single DNS record")
            return String(encoded.prefix(252)) + "..."
        }
        
        return encoded
    }
    
    private func decodeMessage<T: Decodable>(_ content: String) throws -> T {
        guard !content.hasSuffix("...") else {
            throw DiscoveryError.invalidMessage
        }
        
        guard let data = Data(base64Encoded: content),
              let decompressed = String(data: data, encoding: .utf8) else {
            throw DiscoveryError.invalidMessage
        }
        
        let jsonString = decompress(decompressed)
        guard let jsonData = jsonString.data(using: .utf8) else {
            throw DiscoveryError.invalidMessage
        }
        
        return try JSONDecoder().decode(T.self, from: jsonData)
    }
    
    // Simple compression by replacing common patterns
    private func compress(_ str: String) -> String {
        return str
            .replacingOccurrences(of: "candidate:", with: "c:")
            .replacingOccurrences(of: "typ host", with: "th")
            .replacingOccurrences(of: "typ srflx", with: "ts")
            .replacingOccurrences(of: "generation", with: "g")
            .replacingOccurrences(of: "ufrag", with: "u")
            .replacingOccurrences(of: "pwd", with: "p")
            .replacingOccurrences(of: "fingerprint", with: "f")
            .replacingOccurrences(of: "setup", with: "s")
            .replacingOccurrences(of: "protocol", with: "pr")
            .replacingOccurrences(of: "sdpMLineIndex", with: "mi")
            .replacingOccurrences(of: "sdpMid", with: "m")
    }
    
    private func decompress(_ str: String) -> String {
        return str
            .replacingOccurrences(of: "c:", with: "candidate:")
            .replacingOccurrences(of: "th", with: "typ host")
            .replacingOccurrences(of: "ts", with: "typ srflx")
            .replacingOccurrences(of: "g", with: "generation")
            .replacingOccurrences(of: "u", with: "ufrag")
            .replacingOccurrences(of: "p", with: "pwd")
            .replacingOccurrences(of: "f", with: "fingerprint")
            .replacingOccurrences(of: "s", with: "setup")
            .replacingOccurrences(of: "pr", with: "protocol")
            .replacingOccurrences(of: "mi", with: "sdpMLineIndex")
            .replacingOccurrences(of: "m", with: "sdpMid")
    }
    
    // MARK: - Cloudflare API
    
    private func verifyAccess() async throws {
        let url = URL(string: "\(baseURL)/zones/\(zoneId)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DiscoveryError.authenticationFailed
        }
    }
    
    private func listDNSRecords() async throws -> [DNSRecord] {
        let url = URL(string: "\(baseURL)/zones/\(zoneId)/dns_records?type=TXT&name=\(recordPrefix)-\(roomId)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DiscoveryError.networkError
        }
        
        let result = try JSONDecoder().decode(CloudflareResponse<[DNSRecord]>.self, from: data)
        return result.result ?? []
    }
    
    private func createDNSRecord(name: String, content: String) async throws {
        let url = URL(string: "\(baseURL)/zones/\(zoneId)/dns_records")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "type": "TXT",
            "name": name,
            "content": content,
            "ttl": ttl
        ] as [String: Any]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DiscoveryError.networkError
        }
    }
    
    private func upsertDNSRecord(name: String, content: String) async throws {
        let existing = try await listDNSRecords()
        if let record = existing.first(where: { $0.name == name }) {
            try await updateDNSRecord(id: record.id, content: content)
        } else {
            try await createDNSRecord(name: name, content: content)
        }
    }
    
    private func updateDNSRecord(id: String, content: String) async throws {
        let url = URL(string: "\(baseURL)/zones/\(zoneId)/dns_records/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["content": content]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DiscoveryError.networkError
        }
    }
    
    private func deleteDNSRecord(name: String) async throws {
        let records = try await listDNSRecords()
        guard let record = records.first(where: { $0.name == name }) else { return }
        
        let url = URL(string: "\(baseURL)/zones/\(zoneId)/dns_records/\(record.id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DiscoveryError.networkError
        }
    }
    
    private func cleanupRecords() async {
        for recordName in ownRecords {
            try? await deleteDNSRecord(name: recordName)
        }
        ownRecords.removeAll()
    }
}

// MARK: - Data Models

private struct PresenceData: Codable {
    let id: String
    let name: String
    let type: String
    let timestamp: TimeInterval
}

private struct SignalingMessageData: Codable {
    let from: String
    let to: String
    let type: String
    let data: Data
}

private struct DNSRecord: Codable {
    let id: String
    let name: String
    let content: String
    let type: String
}

private struct CloudflareResponse<T: Codable>: Codable {
    let success: Bool
    let result: T?
    let errors: [CloudflareError]?
}

private struct CloudflareError: Codable {
    let code: Int
    let message: String
}

// MARK: - String Extension for Regex

extension String {
    func match(pattern: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(location: 0, length: self.utf16.count)
        guard let match = regex.firstMatch(in: self, range: range) else { return nil }
        
        return (0..<match.numberOfRanges).compactMap { index in
            let range = match.range(at: index)
            guard range.location != NSNotFound else { return nil }
            return (self as NSString).substring(with: range)
        }
    }
}

// MARK: - Cloudflare Configuration

struct CloudflareConfig: Codable {
    let domain: String
    let zoneId: String
    let apiToken: String
    let roomId: String
    let recordPrefix: String
    let ttl: Int
    
    static func decode(from shareCode: String) throws -> CloudflareConfig {
        guard let data = Data(base64Encoded: shareCode),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let config = json["config"] as? [String: Any],
              let domain = config["domain"] as? String,
              let zoneId = config["zoneId"] as? String,
              let apiToken = config["apiToken"] as? String,
              let roomId = config["roomId"] as? String else {
            throw DiscoveryError.invalidConfiguration
        }
        
        return CloudflareConfig(
            domain: domain,
            zoneId: zoneId,
            apiToken: apiToken,
            roomId: roomId,
            recordPrefix: config["recordPrefix"] as? String ?? "_p2psync",
            ttl: config["ttl"] as? Int ?? 120
        )
    }
}