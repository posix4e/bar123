/**
 * P2PConnectionManager.swift
 * Serverless P2P connection management using QR codes
 * 
 * This class handles:
 * - Creating connection offers with embedded ICE candidates
 * - Processing offers and generating answers
 * - WebRTC peer connection lifecycle
 * - Data channel management
 * - HMAC-based authentication
 */

import Foundation
import WebRTC
import CryptoKit

// MARK: - Connection Bundle Types
struct ConnectionBundle: Codable {
    let version: String
    let type: String // "offer" or "answer"
    let connectionId: String
    let peerId: String
    let deviceInfo: DeviceInfo
    let timestamp: String
    let sdp: String
    let iceCandidates: [IceCandidateData]
    let sharedSecret: String?
    let signature: String?
}

struct DeviceInfo: Codable {
    let name: String
    let type: String
}

struct IceCandidateData: Codable {
    let candidate: String
    let sdpMLineIndex: Int32
    let sdpMid: String
}

// MARK: - P2PConnectionManagerDelegate
protocol P2PConnectionManagerDelegate: AnyObject {
    func p2pManager(_ manager: P2PConnectionManager, didConnectPeer peerId: String, deviceInfo: DeviceInfo)
    func p2pManager(_ manager: P2PConnectionManager, didDisconnectPeer peerId: String)
    func p2pManager(_ manager: P2PConnectionManager, didReceiveData data: Data, from peerId: String)
    func p2pManager(_ manager: P2PConnectionManager, didEncounterError error: Error)
}

// MARK: - P2PConnectionManager
class P2PConnectionManager: NSObject {
    
    // MARK: - Properties
    weak var delegate: P2PConnectionManagerDelegate?
    
    let deviceId: String
    let deviceInfo: DeviceInfo
    var sharedSecret: String
    
    private var peerConnectionFactory: RTCPeerConnectionFactory!
    private var peers: [String: PeerConnection] = [:]
    private var pendingConnections: [String: PendingConnection] = [:]
    
    private let queue = DispatchQueue(label: "com.historysync.p2p", attributes: .concurrent)
    
    // WebRTC Configuration
    private let rtcConfig: RTCConfiguration = {
        let config = RTCConfiguration()
        config.iceServers = [
            RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun2.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun3.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun4.l.google.com:19302"])
        ]
        config.iceCandidatePoolSize = 10
        config.sdpSemantics = .unifiedPlan
        return config
    }()
    
    // MARK: - Types
    struct PeerConnection {
        let peerConnection: RTCPeerConnection
        let dataChannel: RTCDataChannel?
        let deviceInfo: DeviceInfo
        let connectionId: String
    }
    
    struct PendingConnection {
        let peerConnection: RTCPeerConnection
        let dataChannel: RTCDataChannel?
        let connectionId: String
        let timestamp: Date
        var iceCandidates: [RTCIceCandidate] = []
        let completionHandler: ((String) -> Void)?
    }
    
    // MARK: - Initialization
    init(deviceId: String, deviceInfo: DeviceInfo, sharedSecret: String? = nil) {
        self.deviceId = deviceId
        self.deviceInfo = deviceInfo
        self.sharedSecret = sharedSecret ?? P2PConnectionManager.generateSharedSecret()
        
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
    }
    
    deinit {
        disconnectAll()
        RTCCleanupSSL()
    }
    
    // MARK: - Shared Secret Generation
    static func generateSharedSecret() -> String {
        let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return String((0..<32).map { _ in letters.randomElement()! })
    }
    
    // MARK: - Connection Creation
    func createConnectionOffer(completion: @escaping (Result<String, Error>) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                let connectionId = self.generateConnectionId()
                let pc = try self.createPeerConnection()
                
                // Create data channel
                let channelConfig = RTCDataChannelConfiguration()
                channelConfig.isOrdered = true
                
                let dataChannel = pc.dataChannel(forLabel: "history-sync", configuration: channelConfig)
                dataChannel?.delegate = self
                
                // Create offer
                let constraints = RTCMediaConstraints(
                    mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
                    optionalConstraints: nil
                )
                
                // Create pending connection
                let pending = PendingConnection(
                    peerConnection: pc,
                    dataChannel: dataChannel,
                    connectionId: connectionId,
                    timestamp: Date(),
                    completionHandler: nil
                )
                
                self.queue.async(flags: .barrier) {
                    self.pendingConnections[connectionId] = pending
                }
                
                pc.offer(for: constraints) { sessionDescription, error in
                    if let error = error {
                        completion(.failure(error))
                        return
                    }
                    
                    guard let sdp = sessionDescription else {
                        completion(.failure(NSError(domain: "P2P", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create offer"])))
                        return
                    }
                    
                    pc.setLocalDescription(sdp) { error in
                        if let error = error {
                            completion(.failure(error))
                            return
                        }
                        
                        // Collect ICE candidates
                        self.collectIceCandidates(for: connectionId) { candidates in
                            // Create connection bundle
                            let bundle = ConnectionBundle(
                                version: "1.0",
                                type: "offer",
                                connectionId: connectionId,
                                peerId: self.deviceId,
                                deviceInfo: self.deviceInfo,
                                timestamp: ISO8601DateFormatter().string(from: Date()),
                                sdp: sdp.sdp,
                                iceCandidates: candidates.map { IceCandidateData(
                                    candidate: $0.sdp,
                                    sdpMLineIndex: $0.sdpMLineIndex,
                                    sdpMid: $0.sdpMid ?? ""
                                )},
                                sharedSecret: self.sharedSecret,
                                signature: nil
                            )
                            
                            // Sign and encode
                            do {
                                let signedBundle = try self.signBundle(bundle)
                                let encoded = try self.encodeBundle(signedBundle)
                                completion(.success(encoded))
                            } catch {
                                completion(.failure(error))
                            }
                        }
                    }
                }
            } catch {
                completion(.failure(error))
            }
        }
    }
    
    // MARK: - Process Connection Offer
    func processConnectionOffer(_ offerBundle: String, completion: @escaping (Result<String, Error>) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                // Decode and verify bundle
                let bundle = try self.decodeBundle(offerBundle)
                guard self.verifyBundle(bundle) else {
                    throw NSError(domain: "P2P", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid bundle signature"])
                }
                
                // Extract shared secret if first connection
                if bundle.sharedSecret != nil && self.sharedSecret.isEmpty {
                    self.sharedSecret = bundle.sharedSecret!
                }
                
                let pc = try self.createPeerConnection()
                let remotePeerId = bundle.peerId
                
                // Set remote description
                let sessionDescription = RTCSessionDescription(type: .offer, sdp: bundle.sdp)
                
                pc.setRemoteDescription(sessionDescription) { error in
                    if let error = error {
                        completion(.failure(error))
                        return
                    }
                    
                    // Add remote ICE candidates
                    for candidateData in bundle.iceCandidates {
                        let candidate = RTCIceCandidate(
                            sdp: candidateData.candidate,
                            sdpMLineIndex: candidateData.sdpMLineIndex,
                            sdpMid: candidateData.sdpMid
                        )
                        pc.add(candidate)
                    }
                    
                    // Create answer
                    let constraints = RTCMediaConstraints(
                        mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
                        optionalConstraints: nil
                    )
                    
                    pc.answer(for: constraints) { sessionDescription, error in
                        if let error = error {
                            completion(.failure(error))
                            return
                        }
                        
                        guard let sdp = sessionDescription else {
                            completion(.failure(NSError(domain: "P2P", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to create answer"])))
                            return
                        }
                        
                        pc.setLocalDescription(sdp) { error in
                            if let error = error {
                                completion(.failure(error))
                                return
                            }
                            
                            // Store peer connection
                            let peer = PeerConnection(
                                peerConnection: pc,
                                dataChannel: nil, // Will be set when received
                                deviceInfo: bundle.deviceInfo,
                                connectionId: bundle.connectionId
                            )
                            
                            self.queue.async(flags: .barrier) {
                                self.peers[remotePeerId] = peer
                            }
                            
                            // Collect ICE candidates and create answer bundle
                            self.collectIceCandidates(for: bundle.connectionId) { candidates in
                                let answerBundle = ConnectionBundle(
                                    version: "1.0",
                                    type: "answer",
                                    connectionId: bundle.connectionId,
                                    peerId: self.deviceId,
                                    deviceInfo: self.deviceInfo,
                                    timestamp: ISO8601DateFormatter().string(from: Date()),
                                    sdp: sdp.sdp,
                                    iceCandidates: candidates.map { IceCandidateData(
                                        candidate: $0.sdp,
                                        sdpMLineIndex: $0.sdpMLineIndex,
                                        sdpMid: $0.sdpMid ?? ""
                                    )},
                                    sharedSecret: nil,
                                    signature: nil
                                )
                                
                                // Sign and encode
                                do {
                                    let signedBundle = try self.signBundle(answerBundle)
                                    let encoded = try self.encodeBundle(signedBundle)
                                    completion(.success(encoded))
                                } catch {
                                    completion(.failure(error))
                                }
                            }
                        }
                    }
                }
            } catch {
                completion(.failure(error))
            }
        }
    }
    
    // MARK: - Complete Connection
    func completeConnection(_ answerBundle: String, completion: @escaping (Result<Void, Error>) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                // Decode and verify bundle
                let bundle = try self.decodeBundle(answerBundle)
                guard self.verifyBundle(bundle) else {
                    throw NSError(domain: "P2P", code: 4, userInfo: [NSLocalizedDescriptionKey: "Invalid bundle signature"])
                }
                
                // Find pending connection
                guard let pending = self.pendingConnections[bundle.connectionId] else {
                    throw NSError(domain: "P2P", code: 5, userInfo: [NSLocalizedDescriptionKey: "No pending connection found"])
                }
                
                let pc = pending.peerConnection
                let remotePeerId = bundle.peerId
                
                // Set remote description
                let sessionDescription = RTCSessionDescription(type: .answer, sdp: bundle.sdp)
                
                pc.setRemoteDescription(sessionDescription) { error in
                    if let error = error {
                        completion(.failure(error))
                        return
                    }
                    
                    // Add remote ICE candidates
                    for candidateData in bundle.iceCandidates {
                        let candidate = RTCIceCandidate(
                            sdp: candidateData.candidate,
                            sdpMLineIndex: candidateData.sdpMLineIndex,
                            sdpMid: candidateData.sdpMid
                        )
                        pc.add(candidate)
                    }
                    
                    // Store peer connection
                    let peer = PeerConnection(
                        peerConnection: pc,
                        dataChannel: pending.dataChannel,
                        deviceInfo: bundle.deviceInfo,
                        connectionId: bundle.connectionId
                    )
                    
                    self.queue.async(flags: .barrier) {
                        self.peers[remotePeerId] = peer
                        self.pendingConnections.removeValue(forKey: bundle.connectionId)
                    }
                    
                    completion(.success(()))
                }
            } catch {
                completion(.failure(error))
            }
        }
    }
    
    // MARK: - Helper Methods
    private func createPeerConnection() throws -> RTCPeerConnection {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
        )
        
        guard let pc = peerConnectionFactory.peerConnection(with: rtcConfig, constraints: constraints, delegate: self) else {
            throw NSError(domain: "P2P", code: 6, userInfo: [NSLocalizedDescriptionKey: "Failed to create peer connection"])
        }
        
        return pc
    }
    
    private func generateConnectionId() -> String {
        return "\(deviceId)-\(Date().timeIntervalSince1970)-\(UUID().uuidString.prefix(8))"
    }
    
    private func collectIceCandidates(for connectionId: String, completion: @escaping ([RTCIceCandidate]) -> Void) {
        var collectedCandidates: [RTCIceCandidate] = []
        
        // Set up a timer to wait for ICE gathering
        let timeout = DispatchTime.now() + .seconds(5)
        
        DispatchQueue.global().asyncAfter(deadline: timeout) { [weak self] in
            self?.queue.sync {
                if let pending = self?.pendingConnections[connectionId] {
                    collectedCandidates = pending.iceCandidates
                } else if let peerId = self?.peers.first(where: { $0.value.connectionId == connectionId })?.key,
                          let peer = self?.peers[peerId] {
                    // Handle case where connection might have moved from pending to active
                }
            }
            completion(collectedCandidates)
        }
    }
    
    // MARK: - Bundle Encoding/Decoding
    private func encodeBundle(_ bundle: ConnectionBundle) throws -> String {
        let encoder = JSONEncoder()
        let data = try encoder.encode(bundle)
        return data.base64EncodedString()
    }
    
    private func decodeBundle(_ encoded: String) throws -> ConnectionBundle {
        guard let data = Data(base64Encoded: encoded) else {
            throw NSError(domain: "P2P", code: 7, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 encoding"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(ConnectionBundle.self, from: data)
    }
    
    // MARK: - HMAC Signing
    private func signBundle(_ bundle: ConnectionBundle) throws -> ConnectionBundle {
        var bundleToSign = bundle
        bundleToSign.signature = nil
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let data = try encoder.encode(bundleToSign)
        
        let key = SymmetricKey(data: sharedSecret.data(using: .utf8)!)
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
        let signature = Data(hmac).base64EncodedString()
        
        var signedBundle = bundle
        signedBundle.signature = signature
        return signedBundle
    }
    
    private func verifyBundle(_ bundle: ConnectionBundle) -> Bool {
        guard let signature = bundle.signature else { return false }
        
        var bundleToVerify = bundle
        bundleToVerify.signature = nil
        
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            let data = try encoder.encode(bundleToVerify)
            
            let key = SymmetricKey(data: sharedSecret.data(using: .utf8)!)
            let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
            let expectedSignature = Data(hmac).base64EncodedString()
            
            return signature == expectedSignature
        } catch {
            return false
        }
    }
    
    // MARK: - Data Sending
    func sendData(_ data: Data, to peerId: String? = nil) {
        queue.sync {
            if let peerId = peerId {
                // Send to specific peer
                if let peer = peers[peerId],
                   let dataChannel = peer.dataChannel,
                   dataChannel.readyState == .open {
                    let buffer = RTCDataBuffer(data: data, isBinary: true)
                    dataChannel.sendData(buffer)
                }
            } else {
                // Broadcast to all peers
                for (_, peer) in peers {
                    if let dataChannel = peer.dataChannel,
                       dataChannel.readyState == .open {
                        let buffer = RTCDataBuffer(data: data, isBinary: true)
                        dataChannel.sendData(buffer)
                    }
                }
            }
        }
    }
    
    // MARK: - Connection Management
    func disconnectPeer(_ peerId: String) {
        queue.async(flags: .barrier) { [weak self] in
            if let peer = self?.peers[peerId] {
                peer.peerConnection.close()
                self?.peers.removeValue(forKey: peerId)
            }
        }
    }
    
    func disconnectAll() {
        queue.async(flags: .barrier) { [weak self] in
            self?.peers.values.forEach { $0.peerConnection.close() }
            self?.peers.removeAll()
            
            self?.pendingConnections.values.forEach { $0.peerConnection.close() }
            self?.pendingConnections.removeAll()
        }
    }
    
    func getConnectedPeers() -> [(peerId: String, deviceInfo: DeviceInfo)] {
        return queue.sync {
            peers.map { ($0.key, $0.value.deviceInfo) }
        }
    }
}

// MARK: - RTCPeerConnectionDelegate
extension P2PConnectionManager: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        // Handle signaling state changes
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        // Not used for data channels
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        // Not used for data channels
    }
    
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        // Handle negotiation
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        // Handle ICE connection state changes
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        // Handle ICE gathering state changes
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        // Store ICE candidate for pending connections
        queue.async(flags: .barrier) {
            for (connectionId, pending) in self.pendingConnections {
                if pending.peerConnection === peerConnection {
                    self.pendingConnections[connectionId]?.iceCandidates.append(candidate)
                    break
                }
            }
        }
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {
        // Handle removed candidates
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        dataChannel.delegate = self
        
        // Find peer and update data channel reference
        queue.async(flags: .barrier) {
            for (peerId, peer) in self.peers {
                if peer.peerConnection === peerConnection {
                    self.peers[peerId] = PeerConnection(
                        peerConnection: peer.peerConnection,
                        dataChannel: dataChannel,
                        deviceInfo: peer.deviceInfo,
                        connectionId: peer.connectionId
                    )
                    
                    DispatchQueue.main.async {
                        self.delegate?.p2pManager(self, didConnectPeer: peerId, deviceInfo: peer.deviceInfo)
                    }
                    break
                }
            }
        }
    }
}

// MARK: - RTCDataChannelDelegate
extension P2PConnectionManager: RTCDataChannelDelegate {
    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        if dataChannel.readyState == .open {
            // Find peer for this data channel
            queue.sync {
                for (peerId, peer) in peers {
                    if peer.dataChannel === dataChannel {
                        DispatchQueue.main.async {
                            self.delegate?.p2pManager(self, didConnectPeer: peerId, deviceInfo: peer.deviceInfo)
                        }
                        break
                    }
                }
            }
        }
    }
    
    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        // Find peer ID for this data channel
        var remotePeerId: String?
        var deviceInfo: DeviceInfo?
        
        queue.sync {
            for (peerId, peer) in peers {
                if peer.dataChannel === dataChannel {
                    remotePeerId = peerId
                    deviceInfo = peer.deviceInfo
                    break
                }
            }
        }
        
        guard let peerId = remotePeerId else { return }
        
        DispatchQueue.main.async {
            self.delegate?.p2pManager(self, didReceiveData: buffer.data, from: peerId)
        }
    }
}