import Foundation
import TrysteroSwift
import os.log
import CryptoKit

struct HistoryEntry: Codable {
    let id: String
    let url: String
    let title: String
    let visitTime: TimeInterval
    let duration: TimeInterval?
    let hostname: String
    let pathname: String
    let sourceDevice: String
    let synced: Bool
    let articleContent: ArticleContent?
    
    struct ArticleContent: Codable {
        let title: String?
        let content: String?
        let excerpt: String?
        let length: Int?
        let readingTime: Int?
        let isArticle: Bool
    }
}

@MainActor
class HistoryManager: ObservableObject {
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "HistoryManager")
    private var trysteroRoom: TrysteroRoom?
    
    @Published var isConnected = false
    @Published var peerCount = 0
    @Published var recentHistory: [HistoryEntry] = []
    @Published var lastSyncTime: Date?
    
    private var currentRoom: String?
    private let deviceId: String
    private var localHistory: [HistoryEntry] = []
    
    init() {
        self.deviceId = Self.generateDeviceId()
        loadLocalHistory()
    }
    
    // MARK: - Connection Management
    
    func connect(with secret: String) async throws {
        let roomId = try await hashSecret(secret)
        currentRoom = roomId
        
        do {
            let config = RoomConfig(appId: "history-sync")
            trysteroRoom = try Trystero.joinRoom(config: config, roomId: roomId)
            
            try await trysteroRoom?.join()
            
            trysteroRoom?.onPeerJoin { [weak self] peerId in
                Task { @MainActor in
                    self?.handlePeerJoined(peerId)
                }
            }
            
            trysteroRoom?.onPeerLeave { [weak self] peerId in
                Task { @MainActor in
                    self?.handlePeerLeft(peerId)
                }
            }
            
            trysteroRoom?.onData { [weak self] data, peerId in
                Task { @MainActor in
                    await self?.handleReceivedData(data, from: peerId)
                }
            }
            
            isConnected = true
            logger.info("✅ Connected to TrysteroSwift room: \(roomId)")
            
            // Notify UI of connection
            NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
            
            // Request history from peers
            await requestHistoryFromPeers()
            
        } catch {
            logger.error("❌ Failed to connect to TrysteroSwift: \(error)")
            throw error
        }
    }
    
    func disconnect() async {
        await trysteroRoom?.leave()
        trysteroRoom = nil
        isConnected = false
        peerCount = 0
        currentRoom = nil
        logger.info("🔌 Disconnected from TrysteroSwift")
        
        // Notify UI of disconnection
        NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
    }
    
    // MARK: - History Management
    
    func addHistoryEntry(_ entry: HistoryEntry) {
        // Add to local history
        localHistory.insert(entry, at: 0)
        updateRecentHistory()
        saveLocalHistory()
        
        // Broadcast to peers
        Task {
            await broadcastHistoryEntry(entry)
        }
        
        logger.info("📚 Added history entry: \(entry.title)")
        
        // Notify UI of new entry
        NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
    }
    
    func receiveHistoryFromJS(_ jsHistoryData: [String: Any]) {
        guard let url = jsHistoryData["url"] as? String,
              let title = jsHistoryData["title"] as? String,
              let visitTime = jsHistoryData["visitTime"] as? TimeInterval else {
            logger.error("Invalid history data from JS")
            return
        }
        
        // Convert JS history to HistoryEntry
        let entry = HistoryEntry(
            id: generateEntryId(),
            url: url,
            title: title,
            visitTime: visitTime,
            duration: jsHistoryData["duration"] as? TimeInterval,
            hostname: jsHistoryData["hostname"] as? String ?? "",
            pathname: jsHistoryData["pathname"] as? String ?? "",
            sourceDevice: deviceId,
            synced: false,
            articleContent: parseArticleContent(jsHistoryData["articleContent"])
        )
        
        addHistoryEntry(entry)
    }
    
    private func parseArticleContent(_ data: Any?) -> HistoryEntry.ArticleContent? {
        guard let articleData = data as? [String: Any] else { return nil }
        
        return HistoryEntry.ArticleContent(
            title: articleData["title"] as? String,
            content: articleData["content"] as? String,
            excerpt: articleData["excerpt"] as? String,
            length: articleData["length"] as? Int,
            readingTime: articleData["readingTime"] as? Int,
            isArticle: articleData["isArticle"] as? Bool ?? false
        )
    }
    
    // MARK: - Sync Operations
    
    private func requestHistoryFromPeers() async {
        let request: [String: Any] = [
            "type": "historyRequest",
            "deviceId": deviceId,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        do {
            let data = try JSONSerialization.data(withJSONObject: request)
            try trysteroRoom?.send(data) // Broadcast to all peers
            logger.info("📤 Requested history from peers")
        } catch {
            logger.error("Failed to request history: \(error)")
        }
    }
    
    private func broadcastHistoryEntry(_ entry: HistoryEntry) async {
        let message = [
            "type": "historySync",
            "entries": [try? entry.toDictionary()].compactMap { $0 },
            "deviceId": deviceId,
            "timestamp": Date().timeIntervalSince1970
        ] as [String: Any]
        
        do {
            let data = try JSONSerialization.data(withJSONObject: message)
            try trysteroRoom?.send(data)
            logger.info("📡 Broadcasted history entry to peers")
        } catch {
            logger.error("Failed to broadcast history: \(error)")
        }
    }
    
    private func handleReceivedData(_ data: Data, from peerId: String) async {
        do {
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = json["type"] as? String else {
                logger.error("Invalid received data format")
                return
            }
            
            switch type {
            case "historyRequest":
                await sendHistoryToPeer(peerId)
            case "historySync", "historyResponse":
                await handleReceivedHistory(json)
            default:
                logger.warning("Unknown message type: \(type)")
            }
            
        } catch {
            logger.error("Failed to parse received data: \(error)")
        }
    }
    
    private func sendHistoryToPeer(_ peerId: String) async {
        let response = [
            "type": "historyResponse",
            "entries": localHistory.compactMap { try? $0.toDictionary() },
            "deviceId": deviceId,
            "timestamp": Date().timeIntervalSince1970
        ] as [String: Any]
        
        do {
            let data = try JSONSerialization.data(withJSONObject: response)
            try trysteroRoom?.send(data, to: peerId)
            logger.info("📤 Sent \(self.localHistory.count) history entries to peer \(peerId)")
        } catch {
            logger.error("Failed to send history to peer: \(error)")
        }
    }
    
    private func handleReceivedHistory(_ json: [String: Any]) async {
        guard let entriesData = json["entries"] as? [[String: Any]] else {
            logger.error("No entries in received history")
            return
        }
        
        let existingUrls = Set(localHistory.map { $0.url + String($0.visitTime) })
        var newEntries = 0
        
        for entryData in entriesData {
            if let entry = try? HistoryEntry.fromDictionary(entryData) {
                let key = entry.url + String(entry.visitTime)
                if !existingUrls.contains(key) {
                    var syncedEntry = entry
                    syncedEntry = HistoryEntry(
                        id: entry.id,
                        url: entry.url,
                        title: entry.title,
                        visitTime: entry.visitTime,
                        duration: entry.duration,
                        hostname: entry.hostname,
                        pathname: entry.pathname,
                        sourceDevice: entry.sourceDevice,
                        synced: true,
                        articleContent: entry.articleContent
                    )
                    localHistory.append(syncedEntry)
                    newEntries += 1
                }
            }
        }
        
        if newEntries > 0 {
            // Sort by visit time (newest first)
            localHistory.sort { $0.visitTime > $1.visitTime }
            updateRecentHistory()
            saveLocalHistory()
            lastSyncTime = Date()
            
            logger.info("📚 Synced \(newEntries) new history entries. Total: \(self.localHistory.count)")
            
            // Notify UI of updates
            NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
        }
    }
    
    // MARK: - Peer Management
    
    private func handlePeerJoined(_ peerId: String) {
        peerCount += 1
        logger.info("🎉 Peer joined: \(peerId). Total peers: \(self.peerCount)")
        
        // Send our history to the new peer
        Task {
            await sendHistoryToPeer(peerId)
        }
        
        // Notify UI of peer change
        NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
    }
    
    private func handlePeerLeft(_ peerId: String) {
        peerCount = max(0, peerCount - 1)
        logger.info("👋 Peer left: \(peerId). Remaining peers: \(self.peerCount)")
        
        // Notify UI of peer change
        NotificationCenter.default.post(name: NSNotification.Name("HistoryManagerUpdated"), object: nil)
    }
    
    // MARK: - Local Storage
    
    private func loadLocalHistory() {
        if let data = UserDefaults.standard.data(forKey: "localHistory"),
           let decoded = try? JSONDecoder().decode([HistoryEntry].self, from: data) {
            localHistory = decoded
            updateRecentHistory()
            logger.info("📖 Loaded \(self.localHistory.count) history entries from storage")
        }
    }
    
    private func saveLocalHistory() {
        if let encoded = try? JSONEncoder().encode(localHistory) {
            UserDefaults.standard.set(encoded, forKey: "localHistory")
            logger.info("💾 Saved \(self.localHistory.count) history entries to storage")
        }
    }
    
    private func updateRecentHistory() {
        recentHistory = Array(localHistory.prefix(10))
    }
    
    // MARK: - Utilities
    
    private static func generateDeviceId() -> String {
        if let stored = UserDefaults.standard.string(forKey: "deviceId") {
            return stored
        }
        
        let newId = "ios_swift_\(UUID().uuidString.prefix(8))_\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(newId, forKey: "deviceId")
        return newId
    }
    
    private func generateEntryId() -> String {
        return "\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString.prefix(8))"
    }
    
    private func hashSecret(_ secret: String) async throws -> String {
        let data = Data(secret.utf8)
        let hash = SHA256.hash(data: data)
        return String(hash.prefix(16).map { String(format: "%02x", $0) }.joined())
    }
}

// MARK: - HistoryEntry Extensions

extension HistoryEntry {
    func toDictionary() throws -> [String: Any] {
        let encoder = JSONEncoder()
        let data = try encoder.encode(self)
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }
    
    static func fromDictionary(_ dict: [String: Any]) throws -> HistoryEntry {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try JSONDecoder().decode(HistoryEntry.self, from: data)
    }
}