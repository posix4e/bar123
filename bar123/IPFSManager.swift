//
//  IPFSManager.swift
//  bar123
//
//  Created by Alex Newman on 5/28/25.
//

import Foundation
import Network
import os.log
import CryptoKit

// MARK: - IPFS History Item Model
struct IPFSHistoryItem: Codable {
    let url: String
    let title: String?
    let visitTime: Date
    let deviceId: String
    let isArticle: Bool
    let readingTime: Int?
    let excerpt: String?
    let contentHash: String?
    
    init(from historyItem: HistoryItem, deviceId: String) {
        self.url = historyItem.url
        self.title = historyItem.title
        self.visitTime = historyItem.visitTime
        self.deviceId = deviceId
        self.isArticle = historyItem.isArticle
        self.readingTime = historyItem.readingTime
        self.excerpt = historyItem.excerpt
        self.contentHash = nil
    }
}

// MARK: - IPFS Message Types
enum IPFSMessageType: String, Codable {
    case historySync = "history-sync"
    case historyRequest = "history-request"
    case historyResponse = "history-response"
    case historyDelete = "history-delete"
    case peerDiscovery = "peer-discovery"
}

struct IPFSMessage: Codable {
    let type: IPFSMessageType
    let deviceId: String
    let timestamp: Date
    let data: Data?
    
    init(type: IPFSMessageType, deviceId: String, data: Data? = nil) {
        self.type = type
        self.deviceId = deviceId
        self.timestamp = Date()
        self.data = data
    }
}

// MARK: - IPFS Manager Protocol
protocol IPFSManagerDelegate: AnyObject {
    func ipfsManager(_ manager: IPFSManager, didReceiveHistory items: [IPFSHistoryItem])
    func ipfsManager(_ manager: IPFSManager, didDiscoverPeer peerId: String)
    func ipfsManager(_ manager: IPFSManager, didLosePeer peerId: String)
    func ipfsManager(_ manager: IPFSManager, connectionStatusChanged isConnected: Bool)
}

// MARK: - IPFS Manager Implementation
class IPFSManager: NSObject, ObservableObject {
    
    weak var delegate: IPFSManagerDelegate?
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "IPFSManager")
    
    // IPFS/Helia connection state
    @Published var isConnected = false
    @Published var peerCount = 0
    @Published var currentTopic: String?
    
    // Device identification
    private let deviceId: String
    private var roomSecret: String?
    
    // History management
    private var localHistory: [IPFSHistoryItem] = []
    private var discoveredPeers: Set<String> = []
    
    // Simulated IPFS connection (placeholder for actual IPFS/Helia integration)
    private var connectionTimer: Timer?
    private var heartbeatTimer: Timer?
    
    init(deviceId: String? = nil) {
        self.deviceId = deviceId ?? "ios_native_\(UUID().uuidString.prefix(8))_\(Int(Date().timeIntervalSince1970))"
        super.init()
        
        logger.info("IPFSManager initialized with deviceId: \(self.deviceId)")
    }
    
    deinit {
        disconnect()
    }
    
    // MARK: - Public Interface
    
    func connect(roomSecret: String) {
        self.roomSecret = roomSecret
        self.currentTopic = hashRoomSecret(roomSecret)
        
        logger.info("Connecting to IPFS topic: \(self.currentTopic ?? "unknown")")
        
        // Simulate IPFS/Helia connection process
        // In a real implementation, this would:
        // 1. Initialize Helia IPFS node
        // 2. Subscribe to pubsub topic derived from room secret
        // 3. Start peer discovery
        // 4. Set up message handlers
        
        simulateIPFSConnection()
    }
    
    func disconnect() {
        logger.info("Disconnecting from IPFS...")
        
        connectionTimer?.invalidate()
        heartbeatTimer?.invalidate()
        
        isConnected = false
        peerCount = 0
        discoveredPeers.removeAll()
        currentTopic = nil
        roomSecret = nil
        
        delegate?.ipfsManager(self, connectionStatusChanged: isConnected)
        logger.info("Disconnected from IPFS")
    }
    
    func broadcastHistory(_ history: [IPFSHistoryItem]) {
        guard isConnected, let topic = currentTopic else {
            logger.warning("Cannot broadcast history: not connected to IPFS")
            return
        }
        
        logger.info("Broadcasting \(history.count) history items to IPFS topic: \(topic)")
        
        do {
            let historyData = try JSONEncoder().encode(history)
            let message = IPFSMessage(type: .historySync, deviceId: deviceId, data: historyData)
            
            // Simulate IPFS pubsub message broadcasting
            simulateBroadcastMessage(message)
            
        } catch {
            logger.error("Failed to encode history for broadcast: \(error)")
        }
    }
    
    func requestHistoryFromPeers() {
        guard isConnected, let topic = currentTopic else {
            logger.warning("Cannot request history: not connected to IPFS")
            return
        }
        
        logger.info("Requesting history from peers on topic: \(topic)")
        
        let message = IPFSMessage(type: .historyRequest, deviceId: deviceId)
        simulateBroadcastMessage(message)
    }
    
    func deleteHistoryItem(url: String) {
        guard isConnected, let topic = currentTopic else {
            logger.warning("Cannot delete history: not connected to IPFS")
            return
        }
        
        logger.info("Broadcasting history deletion for URL: \(url)")
        
        do {
            let deleteData = try JSONEncoder().encode(["url": url])
            let message = IPFSMessage(type: .historyDelete, deviceId: deviceId, data: deleteData)
            
            simulateBroadcastMessage(message)
            
        } catch {
            logger.error("Failed to encode deletion for broadcast: \(error)")
        }
    }
    
    // MARK: - Private Implementation
    
    private func hashRoomSecret(_ secret: String) -> String {
        let data = Data(secret.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined().prefix(16).description
    }
    
    private func simulateIPFSConnection() {
        // Simulate connection delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self = self else { return }
            
            self.isConnected = true
            self.delegate?.ipfsManager(self, connectionStatusChanged: self.isConnected)
            
            self.logger.info("✅ Simulated IPFS connection established")
            
            // Start peer discovery simulation
            self.startPeerDiscoverySimulation()
            
            // Start heartbeat to maintain connection
            self.startHeartbeat()
        }
    }
    
    private func startPeerDiscoverySimulation() {
        // Simulate discovering peers over time
        connectionTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            // Randomly add/remove peers to simulate real P2P behavior
            if self.discoveredPeers.count < 3 && Bool.random() {
                let newPeerId = "peer_\(UUID().uuidString.prefix(8))"
                self.discoveredPeers.insert(newPeerId)
                self.peerCount = self.discoveredPeers.count
                
                self.delegate?.ipfsManager(self, didDiscoverPeer: newPeerId)
                self.logger.info("🎉 Discovered new peer: \(newPeerId)")
                
                // Simulate receiving history from new peer
                self.simulateReceiveHistoryFromPeer(newPeerId)
            }
        }
    }
    
    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            // Send periodic peer discovery messages
            let message = IPFSMessage(type: .peerDiscovery, deviceId: self.deviceId)
            self.simulateBroadcastMessage(message)
        }
    }
    
    private func simulateBroadcastMessage(_ message: IPFSMessage) {
        // In a real implementation, this would publish to IPFS pubsub
        logger.info("📡 Broadcasting IPFS message: \(message.type.rawValue) from \(message.deviceId)")
        
        // Simulate message delivery delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            // Simulate receiving our own message (which we would filter out in real implementation)
        }
    }
    
    private func simulateReceiveHistoryFromPeer(_ peerId: String) {
        // Simulate receiving history data from a peer
        let sampleHistory = [
            IPFSHistoryItem(
                from: HistoryItem(
                    url: "https://example.com/article-\(Int.random(in: 1...100))",
                    title: "Sample Article from \(peerId)",
                    isArticle: true,
                    readingTime: Int.random(in: 2...10),
                    excerpt: "This is a sample article excerpt from peer \(peerId)..."
                ),
                deviceId: peerId
            )
        ]
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.delegate?.ipfsManager(self!, didReceiveHistory: sampleHistory)
        }
    }
    
    private func handleReceivedMessage(_ message: IPFSMessage) {
        // Skip our own messages
        guard message.deviceId != deviceId else { return }
        
        logger.info("📥 Received IPFS message: \(message.type.rawValue) from \(message.deviceId)")
        
        switch message.type {
        case .historySync:
            if let data = message.data {
                do {
                    let history = try JSONDecoder().decode([IPFSHistoryItem].self, from: data)
                    delegate?.ipfsManager(self, didReceiveHistory: history)
                } catch {
                    logger.error("Failed to decode history sync: \(error)")
                }
            }
            
        case .historyRequest:
            // Respond with our local history
            broadcastHistory(localHistory)
            
        case .historyResponse:
            if let data = message.data {
                do {
                    let history = try JSONDecoder().decode([IPFSHistoryItem].self, from: data)
                    delegate?.ipfsManager(self, didReceiveHistory: history)
                } catch {
                    logger.error("Failed to decode history response: \(error)")
                }
            }
            
        case .historyDelete:
            if let data = message.data {
                do {
                    let deleteInfo = try JSONDecoder().decode([String: String].self, from: data)
                    if let url = deleteInfo["url"] {
                        // Handle deletion locally and notify delegate
                        logger.info("🗑️ Received deletion request for URL: \(url)")
                    }
                } catch {
                    logger.error("Failed to decode deletion request: \(error)")
                }
            }
            
        case .peerDiscovery:
            // Handle peer discovery
            if !discoveredPeers.contains(message.deviceId) {
                discoveredPeers.insert(message.deviceId)
                peerCount = discoveredPeers.count
                delegate?.ipfsManager(self, didDiscoverPeer: message.deviceId)
            }
        }
    }
    
    // MARK: - History Management
    
    func updateLocalHistory(_ history: [IPFSHistoryItem]) {
        localHistory = history
        logger.info("Updated local history cache: \(history.count) items")
    }
    
    func addHistoryItem(_ item: IPFSHistoryItem) {
        localHistory.append(item)
        
        // Broadcast new item to peers
        broadcastHistory([item])
    }
    
    // MARK: - Real IPFS Integration Placeholder
    
    /*
     TODO: Replace simulation with real IPFS/Helia integration
     
     This would involve:
     1. Adding IPFS/Helia Swift SDK dependency
     2. Initializing IPFS node with proper configuration
     3. Setting up libp2p networking
     4. Implementing pubsub for real-time messaging
     5. Adding content addressing for history data
     6. Implementing proper peer discovery
     7. Adding encryption for private room communication
     
     Example integration points:
     - Use Helia's createHelia() to initialize node
     - Use @helia/pubsub for topic-based messaging
     - Use @helia/dag-json for content addressing
     - Use libp2p for peer discovery and networking
     */
}

// MARK: - IPFS Manager Extensions

extension IPFSManager {
    
    /// Get connection status summary
    var connectionStatus: String {
        if isConnected {
            return "Connected to IPFS (\(peerCount) peers)"
        } else {
            return "Disconnected from IPFS"
        }
    }
    
    /// Get current room information
    var roomInfo: String {
        if let topic = currentTopic {
            return "Room: \(topic)"
        } else {
            return "No active room"
        }
    }
}