/**
 * WebRTCManager.swift
 * Manages WebRTC peer connections for P2P history sync
 * 
 * This class handles:
 * - WebRTC peer connection lifecycle
 * - Data channel creation and management
 * - Pluggable peer discovery (WebSocket, STUN-only, etc.)
 * - ICE candidate handling
 */

import Foundation
import WebRTC

// MARK: - WebRTC Configuration
struct WebRTCConfig {
    static let defaultStunServers = [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302"
    ]
    
    static let dataChannelConfig: RTCDataChannelConfiguration = {
        let config = RTCDataChannelConfiguration()
        config.isOrdered = true
        config.isNegotiated = false
        return config
    }()
}

// MARK: - WebRTCManagerDelegate
protocol WebRTCManagerDelegate: AnyObject {
    func webRTCManager(_ manager: WebRTCManager, didReceiveData data: Data, from peerId: String)
    func webRTCManager(_ manager: WebRTCManager, didConnectPeer peerId: String)
    func webRTCManager(_ manager: WebRTCManager, didDisconnectPeer peerId: String)
    func webRTCManager(_ manager: WebRTCManager, didEncounterError error: Error)
}

// MARK: - WebRTCManager
class WebRTCManager: NSObject {
    
    // MARK: - Properties
    weak var delegate: WebRTCManagerDelegate?
    static var factory: RTCPeerConnectionFactory?
    
    private let deviceInfo: PeerInfo
    private var discoveryManager: DiscoveryManager
    private var activeDiscovery: PeerDiscovery?
    
    private var peerConnectionFactory: RTCPeerConnectionFactory!
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var dataChannels: [String: RTCDataChannel] = [:]
    
    private let queue = DispatchQueue(label: "com.historysync.webrtc", attributes: .concurrent)
    
    // Configuration
    private var stunServers: [String] = WebRTCConfig.defaultStunServers
    
    // MARK: - Initialization
    init(deviceId: String, deviceName: String) {
        self.deviceInfo = PeerInfo(
            id: deviceId,
            name: deviceName,
            type: "ios",
            timestamp: Date()
        )
        self.discoveryManager = DiscoveryManager()
        
        super.init()
        
        initializeWebRTC()
    }
    
    private func initializeWebRTC() {
        RTCInitializeSSL()
        
        let videoEncoderFactory = RTCDefaultVideoEncoderFactory()
        let videoDecoderFactory = RTCDefaultVideoDecoderFactory()
        
        peerConnectionFactory = RTCPeerConnectionFactory(
            encoderFactory: videoEncoderFactory,
            decoderFactory: videoDecoderFactory
        )
        
        // Store factory for discovery implementations
        WebRTCManager.factory = peerConnectionFactory
    }
    
    deinit {
        RTCCleanupSSL()
    }
    
    // MARK: - Connection Management
    func connect(discoveryMethod: DiscoveryManager.DiscoveryMethod, fallbacks: [DiscoveryManager.DiscoveryMethod] = []) async throws {
        // Initialize discovery with the selected method
        activeDiscovery = discoveryManager.initialize(
            method: discoveryMethod,
            deviceInfo: deviceInfo,
            fallbacks: fallbacks
        )
        
        // Set ourselves as the discovery delegate
        activeDiscovery?.delegate = self
        
        // Start discovery
        try await discoveryManager.start()
    }
    
    func disconnect() async {
        await discoveryManager.stop()
        
        queue.async(flags: .barrier) { [weak self] in
            self?.peerConnections.values.forEach { $0.close() }
            self?.peerConnections.removeAll()
            self?.dataChannels.removeAll()
        }
    }
    
    // MARK: - Peer Connection Management
    private func createPeerConnection(for remotePeerId: String) -> RTCPeerConnection? {
        let config = RTCConfiguration()
        config.iceServers = stunServers.map { url in
            RTCIceServer(urlStrings: [url])
        }
        config.sdpSemantics = .unifiedPlan
        
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )
        
        let peerConnection = peerConnectionFactory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: self
        )
        
        if let pc = peerConnection {
            queue.async(flags: .barrier) {
                self.peerConnections[remotePeerId] = pc
            }
            
            // Create data channel
            let dataChannel = pc.dataChannel(
                forLabel: "history-sync",
                configuration: WebRTCConfig.dataChannelConfig
            )
            
            if let dc = dataChannel {
                dc.delegate = self
                queue.async(flags: .barrier) {
                    self.dataChannels[remotePeerId] = dc
                }
            }
        }
        
        return peerConnection
    }
    
    // MARK: - Offer/Answer Creation
    private func createOffer(for peerConnection: RTCPeerConnection, remotePeerId: String) async throws {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
            optionalConstraints: nil
        )
        
        guard let sdp = try await peerConnection.offer(for: constraints) else {
            throw WebRTCError.failedToCreateOffer
        }
        
        try await peerConnection.setLocalDescription(sdp)
        
        // Send offer via discovery
        let offerDict: [String: Any] = [
            "type": sdp.type == .offer ? "offer" : "answer",
            "sdp": sdp.sdp
        ]
        let offerData = try JSONSerialization.data(withJSONObject: offerDict)
        
        let message = SignalingMessage(type: .offer, data: offerData)
        try await activeDiscovery?.sendSignalingMessage(message, to: remotePeerId)
    }
    
    private func createAnswer(for peerConnection: RTCPeerConnection, remotePeerId: String) async throws {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
            optionalConstraints: nil
        )
        
        guard let sdp = try await peerConnection.answer(for: constraints) else {
            throw WebRTCError.failedToCreateAnswer
        }
        
        try await peerConnection.setLocalDescription(sdp)
        
        // Send answer via discovery
        let answerDict: [String: Any] = [
            "type": sdp.type == .offer ? "offer" : "answer",
            "sdp": sdp.sdp
        ]
        let answerData = try JSONSerialization.data(withJSONObject: answerDict)
        
        let message = SignalingMessage(type: .answer, data: answerData)
        try await activeDiscovery?.sendSignalingMessage(message, to: remotePeerId)
    }
    
    // MARK: - Data Sending
    func sendData(_ data: Data, to peerId: String? = nil) {
        queue.sync {
            if let peerId = peerId {
                // Send to specific peer
                if let dataChannel = dataChannels[peerId],
                   dataChannel.readyState == .open {
                    let buffer = RTCDataBuffer(data: data, isBinary: true)
                    dataChannel.sendData(buffer)
                }
            } else {
                // Broadcast to all peers
                for (_, dataChannel) in dataChannels where dataChannel.readyState == .open {
                    let buffer = RTCDataBuffer(data: data, isBinary: true)
                    dataChannel.sendData(buffer)
                }
            }
        }
    }
    
    // MARK: - Configuration
    func updateSTUNServers(_ servers: [String]) {
        stunServers = servers
    }
}

// MARK: - PeerDiscoveryDelegate
extension WebRTCManager: PeerDiscoveryDelegate {
    func peerDiscovery(_ discovery: PeerDiscovery, didDiscoverPeer peerId: String, info: PeerInfo) {
        print("Discovered peer: \(peerId)")
        
        // Create peer connection and offer
        if let pc = createPeerConnection(for: peerId) {
            Task {
                do {
                    try await createOffer(for: pc, remotePeerId: peerId)
                } catch {
                    print("Failed to create offer for \(peerId): \(error)")
                    delegate?.webRTCManager(self, didEncounterError: error)
                }
            }
        }
    }
    
    func peerDiscovery(_ discovery: PeerDiscovery, didLosePeer peerId: String) {
        print("Lost peer: \(peerId)")
        
        queue.async(flags: .barrier) {
            self.peerConnections[peerId]?.close()
            self.peerConnections.removeValue(forKey: peerId)
            self.dataChannels.removeValue(forKey: peerId)
        }
        
        DispatchQueue.main.async {
            self.delegate?.webRTCManager(self, didDisconnectPeer: peerId)
        }
    }
    
    func peerDiscovery(_ discovery: PeerDiscovery, didReceiveSignalingMessage message: SignalingMessage, from peerId: String) {
        Task {
            do {
                switch message.type {
                case .offer:
                    try await handleOffer(message.data, from: peerId)
                case .answer:
                    try await handleAnswer(message.data, from: peerId)
                case .iceCandidate:
                    try await handleIceCandidate(message.data, from: peerId)
                }
            } catch {
                print("Error handling signaling message: \(error)")
                delegate?.webRTCManager(self, didEncounterError: error)
            }
        }
    }
    
    func peerDiscovery(_ discovery: PeerDiscovery, didEncounterError error: Error) {
        delegate?.webRTCManager(self, didEncounterError: error)
    }
    
    // MARK: - Signaling Message Handlers
    private func handleOffer(_ data: Data, from peerId: String) async throws {
        let offerDict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let sdp = offerDict?["sdp"] as? String else {
            throw WebRTCError.invalidSignalingMessage
        }
        
        let sessionDescription = RTCSessionDescription(type: .offer, sdp: sdp)
        
        let pc = queue.sync { peerConnections[peerId] } ?? createPeerConnection(for: peerId)
        guard let peerConnection = pc else {
            throw WebRTCError.failedToCreatePeerConnection
        }
        
        try await peerConnection.setRemoteDescription(sessionDescription)
        try await createAnswer(for: peerConnection, remotePeerId: peerId)
    }
    
    private func handleAnswer(_ data: Data, from peerId: String) async throws {
        let answerDict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let sdp = answerDict?["sdp"] as? String else {
            throw WebRTCError.invalidSignalingMessage
        }
        
        let sessionDescription = RTCSessionDescription(type: .answer, sdp: sdp)
        
        guard let peerConnection = queue.sync(execute: { peerConnections[peerId] }) else {
            throw WebRTCError.peerConnectionNotFound
        }
        
        try await peerConnection.setRemoteDescription(sessionDescription)
    }
    
    private func handleIceCandidate(_ data: Data, from peerId: String) async throws {
        let candidateDict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let sdp = candidateDict?["candidate"] as? String,
              let sdpMLineIndex = candidateDict?["sdpMLineIndex"] as? Int32,
              let sdpMid = candidateDict?["sdpMid"] as? String else {
            throw WebRTCError.invalidSignalingMessage
        }
        
        let candidate = RTCIceCandidate(
            sdp: sdp,
            sdpMLineIndex: sdpMLineIndex,
            sdpMid: sdpMid
        )
        
        guard let peerConnection = queue.sync(execute: { peerConnections[peerId] }) else {
            throw WebRTCError.peerConnectionNotFound
        }
        
        try await peerConnection.add(candidate)
    }
}

// MARK: - RTCPeerConnectionDelegate
extension WebRTCManager: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        print("Signaling state changed: \(stateChanged)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        // Not used for data channels
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        // Not used for data channels
    }
    
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        print("Peer connection should negotiate")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        print("ICE connection state changed: \(newState)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        print("ICE gathering state changed: \(newState)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        // Find remote peer ID for this connection
        var remotePeerId: String?
        queue.sync {
            for (peerId, pc) in peerConnections where pc === peerConnection {
                remotePeerId = peerId
                break
            }
        }
        
        guard let peerId = remotePeerId else { return }
        
        // Send ICE candidate via discovery
        Task {
            do {
                let candidateDict: [String: Any] = [
                    "candidate": candidate.sdp,
                    "sdpMLineIndex": Int(candidate.sdpMLineIndex),
                    "sdpMid": candidate.sdpMid ?? ""
                ]
                let candidateData = try JSONSerialization.data(withJSONObject: candidateDict)
                
                let message = SignalingMessage(type: .iceCandidate, data: candidateData)
                try await activeDiscovery?.sendSignalingMessage(message, to: peerId)
            } catch {
                print("Failed to send ICE candidate: \(error)")
            }
        }
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {
        // Handle removed candidates if needed
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        print("Data channel opened: \(dataChannel.label)")
        dataChannel.delegate = self
        
        // Find remote peer ID and update data channel reference
        queue.async(flags: .barrier) {
            for (peerId, pc) in self.peerConnections where pc === peerConnection {
                self.dataChannels[peerId] = dataChannel
                
                DispatchQueue.main.async {
                    self.delegate?.webRTCManager(self, didConnectPeer: peerId)
                }
                break
            }
        }
    }
}

// MARK: - RTCDataChannelDelegate
extension WebRTCManager: RTCDataChannelDelegate {
    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        print("Data channel state changed: \(dataChannel.readyState)")
    }
    
    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        // Find peer ID for this data channel
        var remotePeerId: String?
        queue.sync {
            for (peerId, dc) in dataChannels where dc === dataChannel {
                remotePeerId = peerId
                break
            }
        }
        
        guard let peerId = remotePeerId else { return }
        
        DispatchQueue.main.async {
            self.delegate?.webRTCManager(self, didReceiveData: buffer.data, from: peerId)
        }
    }
}

// MARK: - Errors
enum WebRTCError: LocalizedError {
    case failedToCreateOffer
    case failedToCreateAnswer
    case failedToCreatePeerConnection
    case invalidSignalingMessage
    case peerConnectionNotFound
    
    var errorDescription: String? {
        switch self {
        case .failedToCreateOffer:
            return "Failed to create WebRTC offer"
        case .failedToCreateAnswer:
            return "Failed to create WebRTC answer"
        case .failedToCreatePeerConnection:
            return "Failed to create peer connection"
        case .invalidSignalingMessage:
            return "Invalid signaling message format"
        case .peerConnectionNotFound:
            return "Peer connection not found"
        }
    }
}

// MARK: - Async Extensions for WebRTC
extension RTCPeerConnection {
    func offer(for constraints: RTCMediaConstraints) async throws -> RTCSessionDescription? {
        return try await withCheckedThrowingContinuation { continuation in
            self.offer(for: constraints) { sdp, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: sdp)
                }
            }
        }
    }
    
    func answer(for constraints: RTCMediaConstraints) async throws -> RTCSessionDescription? {
        return try await withCheckedThrowingContinuation { continuation in
            self.answer(for: constraints) { sdp, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: sdp)
                }
            }
        }
    }
    
    func setLocalDescription(_ sdp: RTCSessionDescription) async throws {
        return try await withCheckedThrowingContinuation { continuation in
            self.setLocalDescription(sdp) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
    
    func setRemoteDescription(_ sdp: RTCSessionDescription) async throws {
        return try await withCheckedThrowingContinuation { continuation in
            self.setRemoteDescription(sdp) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
    
    func add(_ candidate: RTCIceCandidate) async throws {
        return try await withCheckedThrowingContinuation { continuation in
            self.add(candidate) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
}