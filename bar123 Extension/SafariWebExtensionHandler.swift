//
//  SafariWebExtensionHandler.swift
//  bar123 Extension
//
//  Created by Alex Newman on 5/22/25.
//

import SafariServices
import os.log
import Foundation
import CryptoKit

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    // P2P networking using libp2p
    private var p2pNode: LibP2PNode?
    private var isConnected = false
    private var currentRoomId: String?
    private var deviceId: String
    private var connectedPeers: Set<String> = []
    private var localHistory: [HistoryEntry] = []
    
    override init() {
        // Generate or load device ID
        if let stored = UserDefaults.standard.string(forKey: "deviceId") {
            self.deviceId = stored
        } else {
            self.deviceId = "safari_ios_\(UUID().uuidString.prefix(8))_\(Int(Date().timeIntervalSince1970))"
            UserDefaults.standard.set(self.deviceId, forKey: "deviceId")
        }
        
        super.init()
        setupP2PNode()
        loadLocalHistory()
    }

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        var responseData: [String: Any] = ["echo": message as Any]
        
        // Handle App Group storage messages
        if let messageDict = message as? [String: Any] {
            os_log(.default, "Message parsed as dictionary: %@", String(describing: messageDict))
            
            if let type = messageDict["type"] as? String {
                os_log(.default, "Message type: %@", type)
                
                switch type {
                case "saveSharedSecret":
                    if let secret = messageDict["secret"] as? String {
                        os_log(.default, "Attempting to save secret of length: %d", secret.count)
                        let success = saveSharedSecret(secret)
                        
                        // Connect to P2P network if secret provided
                        if success && !secret.isEmpty {
                            connectToP2PNetwork(secret: secret)
                        } else if secret.isEmpty {
                            disconnectFromP2PNetwork()
                        }
                        
                        responseData = [
                            "type": "saveSharedSecretResponse",
                            "success": success
                        ]
                        os_log(.default, "Saved shared secret to App Group: %@", success ? "success" : "failed")
                    } else {
                        os_log(.error, "No secret found in saveSharedSecret message")
                    }
                case "getSharedSecret":
                    let secret = getSharedSecret()
                    responseData = [
                        "type": "getSharedSecretResponse",
                        "secret": secret
                    ]
                    os_log(.default, "Retrieved shared secret from App Group: %@", secret.isEmpty ? "empty" : "found")
                case "trackHistory":
                    if let entry = parseHistoryEntry(from: messageDict) {
                        addHistoryEntry(entry)
                        responseData = [
                            "type": "trackHistoryResponse",
                            "success": true
                        ]
                    } else {
                        responseData = [
                            "type": "trackHistoryResponse",
                            "success": false,
                            "error": "Invalid history entry format"
                        ]
                    }
                case "getConnectionStats":
                    responseData = [
                        "type": "connectionStatsResponse",
                        "isConnected": isConnected,
                        "peerCount": connectedPeers.count,
                        "localHistoryCount": localHistory.count,
                        "deviceId": deviceId
                    ]
                case "syncHistory":
                    syncHistoryWithPeers()
                    responseData = [
                        "type": "syncHistoryResponse",
                        "success": true
                    ]
                default:
                    os_log(.default, "Unknown message type: %@", type)
                    responseData = ["echo": message as Any]
                }
            } else {
                os_log(.default, "No type field found in message")
            }
        } else {
            os_log(.default, "Message could not be parsed as dictionary")
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseData ]
        } else {
            response.userInfo = [ "message": responseData ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
    
    private func saveSharedSecret(_ secret: String) -> Bool {
        os_log(.default, "saveSharedSecret called with secret length: %d", secret.count)
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return false
        }
        
        os_log(.default, "Successfully accessed shared UserDefaults")
        
        if secret.isEmpty {
            os_log(.default, "Removing room secret from shared storage")
            sharedDefaults.removeObject(forKey: "roomSecret")
        } else {
            os_log(.default, "Setting room secret in shared storage")
            sharedDefaults.set(secret, forKey: "roomSecret")
        }
        
        let syncResult = sharedDefaults.synchronize()
        os_log(.default, "UserDefaults synchronize result: %@", syncResult ? "success" : "failed")
        
        // Verify the save worked
        let retrievedSecret = sharedDefaults.string(forKey: "roomSecret") ?? ""
        os_log(.default, "Verification: retrieved secret length: %d", retrievedSecret.count)
        
        return syncResult
    }
    
    private func getSharedSecret() -> String {
        os_log(.default, "getSharedSecret called")
        
        guard let sharedDefaults = UserDefaults(suiteName: "group.xyz.foo.bar123") else {
            os_log(.error, "Failed to access shared UserDefaults for App Group: group.xyz.foo.bar123")
            return ""
        }
        
        let secret = sharedDefaults.string(forKey: "roomSecret") ?? ""
        os_log(.default, "Retrieved secret from shared storage, length: %d", secret.count)
        
        return secret
    }
    
    // MARK: - P2P Networking
    
    private func setupP2PNode() {
        p2pNode = LibP2PNode()
        
        p2pNode?.onMessage { [weak self] peerId, topic, data in
            self?.handleReceivedMessage(from: peerId, topic: topic, data: data)
        }
        
        p2pNode?.onPeer { [weak self] peerId, joined in
            self?.handlePeerEvent(peerId: peerId, joined: joined)
        }
        
        if p2pNode?.initialize() == true {
            _ = p2pNode?.startListening()
            os_log(.default, "P2P node initialized and listening")
        } else {
            os_log(.error, "Failed to initialize P2P node")
        }
    }
    
    private func connectToP2PNetwork(secret: String) {
        let roomId = hashSecret(secret)
        
        if let success = p2pNode?.joinRoom(roomId: roomId), success {
            isConnected = true
            currentRoomId = roomId
            os_log(.default, "Successfully joined P2P room: %@", roomId)
            
            // Send current history to new peers
            if !localHistory.isEmpty {
                syncHistoryWithPeers()
            }
        } else {
            os_log(.error, "Failed to join P2P room: %@", roomId)
        }
    }
    
    private func disconnectFromP2PNetwork() {
        isConnected = false
        currentRoomId = nil
        connectedPeers.removeAll()
        
        // LibP2PNode will be cleaned up on deinit
        p2pNode = nil
        setupP2PNode() // Recreate for next connection
        
        os_log(.default, "Disconnected from P2P network")
    }
    
    private func hashSecret(_ secret: String) -> String {
        let data = secret.data(using: .utf8) ?? Data()
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined().prefix(16).description
    }
    
    private func handleReceivedMessage(from peerId: String, topic: String, data: Data) {
        os_log(.default, "Received message from %@ on topic %@", peerId, topic)
        
        do {
            let syncMessage = try JSONDecoder().decode(SyncMessage.self, from: data)
            handleReceivedHistory(syncMessage)
        } catch {
            os_log(.error, "Failed to decode sync message: %@", error.localizedDescription)
        }
    }
    
    private func handlePeerEvent(peerId: String, joined: Bool) {
        if joined {
            connectedPeers.insert(peerId)
            os_log(.default, "Peer joined: %@", peerId)
            
            // Send current history to new peer
            if !localHistory.isEmpty {
                syncHistoryWithPeers()
            }
        } else {
            connectedPeers.remove(peerId)
            os_log(.default, "Peer left: %@", peerId)
        }
    }
    
    private func parseHistoryEntry(from messageDict: [String: Any]) -> HistoryEntry? {
        guard let url = messageDict["url"] as? String,
              let title = messageDict["title"] as? String,
              let visitTime = messageDict["visitTime"] as? Int64 else {
            return nil
        }
        
        return HistoryEntry(
            url: url,
            title: title,
            visit_time: visitTime,
            duration: messageDict["duration"] as? Int64,
            device_id: deviceId,
            is_article: messageDict["isArticle"] as? Bool ?? false,
            content: messageDict["content"] as? String,
            reading_time: messageDict["readingTime"] as? Int32
        )
    }
    
    private func addHistoryEntry(_ entry: HistoryEntry) {
        localHistory.append(entry)
        saveLocalHistory()
        
        // Broadcast to peers if connected
        if isConnected && !connectedPeers.isEmpty {
            broadcastHistoryEntry(entry)
        }
        
        os_log(.default, "Added history entry: %@", entry.url)
    }
    
    private func handleReceivedHistory(_ syncMessage: SyncMessage) {
        os_log(.default, "Received %d history entries from %@", syncMessage.entries.count, syncMessage.device_id)
        
        var newEntries = 0
        for entry in syncMessage.entries {
            // Check if entry already exists
            if !localHistory.contains(where: { $0.url == entry.url && $0.visit_time == entry.visit_time }) {
                localHistory.append(entry)
                newEntries += 1
            }
        }
        
        if newEntries > 0 {
            saveLocalHistory()
            os_log(.default, "Added %d new history entries", newEntries)
        }
    }
    
    private func syncHistoryWithPeers() {
        guard isConnected, let p2pNode = p2pNode, !localHistory.isEmpty else {
            os_log(.debug, "Cannot sync: not connected or no history")
            return
        }
        
        if p2pNode.sendHistorySync(entries: localHistory, deviceId: deviceId) {
            os_log(.default, "Sent %d history entries to peers", localHistory.count)
        } else {
            os_log(.error, "Failed to send history sync to peers")
        }
    }
    
    private func broadcastHistoryEntry(_ entry: HistoryEntry) {
        guard isConnected, let p2pNode = p2pNode else {
            os_log(.debug, "Cannot broadcast: not connected")
            return
        }
        
        if p2pNode.sendHistorySync(entries: [entry], deviceId: deviceId) {
            os_log(.debug, "Broadcasted history entry: %@", entry.url)
        } else {
            os_log(.error, "Failed to broadcast history entry")
        }
    }
    
    private func loadLocalHistory() {
        if let data = UserDefaults.standard.data(forKey: "localHistory"),
           let entries = try? JSONDecoder().decode([HistoryEntry].self, from: data) {
            localHistory = entries
            os_log(.default, "Loaded %d history entries from storage", entries.count)
        }
    }
    
    private func saveLocalHistory() {
        if let data = try? JSONEncoder().encode(localHistory) {
            UserDefaults.standard.set(data, forKey: "localHistory")
            os_log(.debug, "Saved %d history entries to storage", localHistory.count)
        }
    }

}
