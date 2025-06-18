//
//  PeerDiscovery.swift
//  bar123 Extension
//
//  Pluggable peer discovery interface for P2P connections
//

import Foundation
import WebRTC
import CryptoKit

// MARK: - Peer Discovery Protocol

protocol PeerDiscoveryDelegate: AnyObject {
    func peerDiscovery(_ discovery: PeerDiscovery, didDiscoverPeer peerId: String, info: PeerInfo)
    func peerDiscovery(_ discovery: PeerDiscovery, didLosePeer peerId: String)
    func peerDiscovery(_ discovery: PeerDiscovery, didReceiveSignalingMessage message: SignalingMessage, from peerId: String)
    func peerDiscovery(_ discovery: PeerDiscovery, didEncounterError error: Error)
}

struct PeerInfo: Codable {
    let id: String
    let name: String
    let type: String
    let timestamp: Date
}

struct SignalingMessage: Codable {
    let type: MessageType
    let data: Data
    
    enum MessageType: String, Codable {
        case offer
        case answer
        case iceCandidate = "ice-candidate"
    }
}

protocol PeerDiscovery: AnyObject {
    var delegate: PeerDiscoveryDelegate? { get set }
    var discoveredPeers: [String: PeerInfo] { get }
    
    func start() async throws
    func stop() async
    func sendSignalingMessage(_ message: SignalingMessage, to peerId: String) async throws
}

// MARK: - Base Discovery Implementation

class BasePeerDiscovery: PeerDiscovery {
    weak var delegate: PeerDiscoveryDelegate?
    private(set) var discoveredPeers: [String: PeerInfo] = [:]
    
    func start() async throws {
        fatalError("Subclasses must implement start()")
    }
    
    func stop() async {
        discoveredPeers.removeAll()
    }
    
    func sendSignalingMessage(_ message: SignalingMessage, to peerId: String) async throws {
        fatalError("Subclasses must implement sendSignalingMessage(_:to:)")
    }
    
    // Helper methods for subclasses
    internal func addPeer(_ peerId: String, info: PeerInfo) {
        discoveredPeers[peerId] = info
        delegate?.peerDiscovery(self, didDiscoverPeer: peerId, info: info)
    }
    
    internal func removePeer(_ peerId: String) {
        discoveredPeers.removeValue(forKey: peerId)
        delegate?.peerDiscovery(self, didLosePeer: peerId)
    }
    
    internal func handleSignalingMessage(_ message: SignalingMessage, from peerId: String) {
        delegate?.peerDiscovery(self, didReceiveSignalingMessage: message, from: peerId)
    }
    
    internal func handleError(_ error: Error) {
        delegate?.peerDiscovery(self, didEncounterError: error)
    }
}

// MARK: - WebSocket Discovery

class WebSocketDiscovery: BasePeerDiscovery {
    private let signalingServerUrl: String
    private let roomId: String
    private let sharedSecret: String
    private let deviceInfo: PeerInfo
    
    private var webSocket: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var isConnected = false
    
    init(signalingServerUrl: String, roomId: String, sharedSecret: String, deviceInfo: PeerInfo) {
        self.signalingServerUrl = signalingServerUrl
        self.roomId = roomId
        self.sharedSecret = sharedSecret
        self.deviceInfo = deviceInfo
        super.init()
    }
    
    override func start() async throws {
        guard let url = URL(string: signalingServerUrl) else {
            throw DiscoveryError.invalidURL
        }
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: url)
        webSocket?.resume()
        
        // Send join message
        try await sendAuthenticatedMessage([
            "type": "join",
            "roomId": roomId,
            "peerId": deviceInfo.id,
            "deviceInfo": [
                "name": deviceInfo.name,
                "type": deviceInfo.type
            ]
        ])
        
        isConnected = true
        
        // Start listening for messages
        Task {
            await receiveMessages()
        }
        
        // Start ping timer
        await MainActor.run {
            pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
                Task {
                    try? await self.sendPing()
                }
            }
        }
    }
    
    override func stop() async {
        isConnected = false
        
        await MainActor.run {
            pingTimer?.invalidate()
            pingTimer = nil
        }
        
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        
        await super.stop()
    }
    
    override func sendSignalingMessage(_ message: SignalingMessage, to peerId: String) async throws {
        guard isConnected else {
            throw DiscoveryError.notConnected
        }
        
        let messageData: [String: Any] = [
            "type": "signal",
            "to": peerId,
            "signal": [
                "type": message.type.rawValue,
                "data": message.data.base64EncodedString()
            ]
        ]
        
        try await sendAuthenticatedMessage(messageData)
    }
    
    private func sendAuthenticatedMessage(_ data: [String: Any]) async throws {
        let payload = try JSONSerialization.data(withJSONObject: data)
        let hmac = generateHMAC(for: payload)
        
        let message: [String: Any] = [
            "payload": String(data: payload, encoding: .utf8)!,
            "hmac": hmac
        ]
        
        let messageData = try JSONSerialization.data(withJSONObject: message)
        let messageString = String(data: messageData, encoding: .utf8)!
        
        try await webSocket?.send(.string(messageString))
    }
    
    private func generateHMAC(for data: Data) -> String {
        guard let keyData = sharedSecret.data(using: .utf8) else {
            return ""
        }
        
        let key = SymmetricKey(data: keyData)
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
        
        return Data(hmac).map { String(format: "%02hhx", $0) }.joined()
    }
    
    private func verifyHMAC(_ message: [String: Any]) -> Bool {
        guard let hmacString = message["hmac"] as? String,
              let payloadString = message["payload"] as? String,
              let payloadData = payloadString.data(using: .utf8),
              let keyData = sharedSecret.data(using: .utf8) else {
            return false
        }
        
        let key = SymmetricKey(data: keyData)
        let computedHMAC = HMAC<SHA256>.authenticationCode(for: payloadData, using: key)
        let computedHMACString = Data(computedHMAC).map { String(format: "%02hhx", $0) }.joined()
        
        return hmacString == computedHMACString
    }
    
    private func receiveMessages() async {
        while isConnected {
            do {
                guard let message = try await webSocket?.receive() else { break }
                
                switch message {
                case .string(let text):
                    await handleMessage(text)
                case .data(_):
                    // Binary messages not used
                    break
                @unknown default:
                    break
                }
            } catch {
                if isConnected {
                    handleError(error)
                }
                break
            }
        }
    }
    
    private func handleMessage(_ text: String) async {
        guard let data = text.data(using: .utf8),
              let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              verifyHMAC(message),
              let payloadString = message["payload"] as? String,
              let payloadData = payloadString.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any],
              let type = payload["type"] as? String else {
            return
        }
        
        switch type {
        case "peers":
            if let peers = payload["peers"] as? [[String: Any]] {
                for peerData in peers {
                    if let peerId = peerData["id"] as? String,
                       let deviceInfo = peerData["deviceInfo"] as? [String: Any],
                       let name = deviceInfo["name"] as? String,
                       let type = deviceInfo["type"] as? String {
                        let info = PeerInfo(id: peerId, name: name, type: type, timestamp: Date())
                        addPeer(peerId, info: info)
                    }
                }
            }
            
        case "peer_joined":
            if let peerId = payload["peerId"] as? String,
               let deviceInfo = payload["deviceInfo"] as? [String: Any],
               let name = deviceInfo["name"] as? String,
               let type = deviceInfo["type"] as? String {
                let info = PeerInfo(id: peerId, name: name, type: type, timestamp: Date())
                addPeer(peerId, info: info)
            }
            
        case "peer_left":
            if let peerId = payload["peerId"] as? String {
                removePeer(peerId)
            }
            
        case "signal":
            if let from = payload["from"] as? String,
               let signal = payload["signal"] as? [String: Any],
               let signalType = signal["type"] as? String,
               let dataString = signal["data"] as? String,
               let data = Data(base64Encoded: dataString),
               let messageType = SignalingMessage.MessageType(rawValue: signalType) {
                let signalingMessage = SignalingMessage(type: messageType, data: data)
                handleSignalingMessage(signalingMessage, from: from)
            }
            
        default:
            break
        }
    }
    
    private func sendPing() async throws {
        try await sendAuthenticatedMessage(["type": "ping"])
    }
}

// MARK: - STUN-Only Discovery

class STUNOnlyDiscovery: BasePeerDiscovery {
    private let stunServers: [String]
    private let deviceInfo: PeerInfo
    private var localConnection: RTCPeerConnection?
    private var pendingConnections: [String: Data] = [:]
    
    init(stunServers: [String], deviceInfo: PeerInfo) {
        self.stunServers = stunServers
        self.deviceInfo = deviceInfo
        super.init()
    }
    
    override func start() async throws {
        // Create local connection to gather ICE candidates
        let config = RTCConfiguration()
        config.iceServers = stunServers.map { url in
            RTCIceServer(urlStrings: [url])
        }
        
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: nil
        )
        
        guard let factory = WebRTCManager.factory else {
            throw DiscoveryError.webRTCNotInitialized
        }
        
        localConnection = factory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: nil
        )
        
        // Create data channel to trigger ICE gathering
        _ = localConnection?.dataChannel(
            forLabel: "discovery",
            configuration: RTCDataChannelConfiguration()
        )
        
        // Create offer to start ICE gathering
        if let offer = try await localConnection?.offer(for: constraints) {
            try await localConnection?.setLocalDescription(offer)
        }
        
        // STUN-only mode requires manual peer exchange
        print("STUN-only discovery started. Manual peer exchange required.")
    }
    
    override func stop() async {
        localConnection?.close()
        localConnection = nil
        pendingConnections.removeAll()
        await super.stop()
    }
    
    override func sendSignalingMessage(_ message: SignalingMessage, to peerId: String) async throws {
        // In STUN-only mode, store messages for manual exchange
        pendingConnections[peerId] = message.data
        
        // Notify delegate that manual exchange is needed
        handleError(DiscoveryError.manualExchangeRequired(peerId: peerId))
    }
    
    // Manual peer addition for STUN-only mode
    func addManualPeer(_ peerId: String, connectionData: Data) async throws {
        let info = PeerInfo(id: peerId, name: "Manual Peer", type: "unknown", timestamp: Date())
        addPeer(peerId, info: info)
        
        // Process any pending messages for this peer
        if pendingConnections[peerId] != nil {
            pendingConnections.removeValue(forKey: peerId)
            // In real implementation, this would establish the connection
            print("Processing pending connection for peer: \(peerId)")
        }
    }
    
    func getLocalConnectionInfo() async throws -> Data {
        // Return serialized connection information for manual exchange
        // This would include ICE candidates, offer/answer, etc.
        let info: [String: Any] = [
            "deviceId": deviceInfo.id,
            "deviceInfo": [
                "name": deviceInfo.name,
                "type": deviceInfo.type
            ],
            "timestamp": Date().timeIntervalSince1970
        ]
        
        return try JSONSerialization.data(withJSONObject: info)
    }
}

// MARK: - Discovery Manager

class DiscoveryManager {
    enum DiscoveryMethod {
        case websocket(url: String, roomId: String, secret: String)
        case stunOnly(servers: [String])
        case cloudflareDNS(apiToken: String, zoneId: String, domain: String, roomId: String)
    }
    
    private var activeDiscovery: PeerDiscovery?
    private var fallbackDiscoveries: [PeerDiscovery] = []
    
    func initialize(method: DiscoveryMethod, deviceInfo: PeerInfo, fallbacks: [DiscoveryMethod] = []) -> PeerDiscovery {
        // Stop any existing discovery
        Task {
            await activeDiscovery?.stop()
        }
        
        // Create primary discovery
        activeDiscovery = createDiscovery(method: method, deviceInfo: deviceInfo)
        
        // Create fallback discoveries
        fallbackDiscoveries = fallbacks.map { fallback in
            createDiscovery(method: fallback, deviceInfo: deviceInfo)
        }
        
        return activeDiscovery!
    }
    
    func start() async throws {
        guard let discovery = activeDiscovery else {
            throw DiscoveryError.notInitialized
        }
        
        do {
            try await discovery.start()
        } catch {
            // Try fallbacks
            for fallback in fallbackDiscoveries {
                do {
                    await activeDiscovery?.stop()
                    activeDiscovery = fallback
                    try await fallback.start()
                    return
                } catch {
                    continue
                }
            }
            
            // All fallbacks failed
            throw error
        }
    }
    
    func stop() async {
        await activeDiscovery?.stop()
        for fallback in fallbackDiscoveries {
            await fallback.stop()
        }
    }
    
    private func createDiscovery(method: DiscoveryMethod, deviceInfo: PeerInfo) -> PeerDiscovery {
        switch method {
        case .websocket(let url, let roomId, let secret):
            return WebSocketDiscovery(
                signalingServerUrl: url,
                roomId: roomId,
                sharedSecret: secret,
                deviceInfo: deviceInfo
            )
            
        case .stunOnly(let servers):
            return STUNOnlyDiscovery(
                stunServers: servers,
                deviceInfo: deviceInfo
            )
            
        case .cloudflareDNS(let apiToken, let zoneId, let domain, let roomId):
            return CloudflareDNSDiscovery(
                apiToken: apiToken,
                zoneId: zoneId,
                domain: domain,
                roomId: roomId,
                deviceInfo: deviceInfo
            )
        }
    }
}

// MARK: - Errors

enum DiscoveryError: LocalizedError {
    case invalidURL
    case notConnected
    case notInitialized
    case webRTCNotInitialized
    case manualExchangeRequired(peerId: String)
    case invalidMessage
    case authenticationFailed
    case networkError
    case invalidConfiguration
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid signaling server URL"
        case .notConnected:
            return "Not connected to discovery service"
        case .notInitialized:
            return "Discovery not initialized"
        case .webRTCNotInitialized:
            return "WebRTC not initialized"
        case .manualExchangeRequired(let peerId):
            return "Manual connection exchange required for peer: \(peerId)"
        case .invalidMessage:
            return "Invalid message format"
        case .authenticationFailed:
            return "Authentication failed"
        case .networkError:
            return "Network error occurred"
        case .invalidConfiguration:
            return "Invalid configuration"
        }
    }
}