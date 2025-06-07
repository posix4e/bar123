/**
 * WebRTCManager.swift
 * Manages WebRTC peer connections for P2P history sync
 * 
 * This class handles:
 * - WebRTC peer connection lifecycle
 * - Data channel creation and management
 * - Signaling via WebSocket with HMAC authentication
 * - ICE candidate handling
 */

import Foundation
import WebRTC
import CryptoKit

// MARK: - WebRTC Configuration
struct WebRTCConfig {
    static let iceServers = [
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
    
    private let peerId: String
    private let roomId: String
    private let sharedSecret: String
    private let signalingServerURL: URL
    
    private var peerConnectionFactory: RTCPeerConnectionFactory!
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var dataChannels: [String: RTCDataChannel] = [:]
    private var webSocketTask: URLSessionWebSocketTask?
    private let urlSession = URLSession(configuration: .default)
    
    private let queue = DispatchQueue(label: "com.historysync.webrtc", attributes: .concurrent)
    
    // MARK: - Initialization
    init(peerId: String, roomId: String, sharedSecret: String, signalingServerURL: URL) {
        self.peerId = peerId
        self.roomId = roomId
        self.sharedSecret = sharedSecret
        self.signalingServerURL = signalingServerURL
        
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
        RTCCleanupSSL()
    }
    
    // MARK: - Connection Management
    func connect() {
        connectToSignalingServer()
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        
        queue.async(flags: .barrier) { [weak self] in
            self?.peerConnections.values.forEach { $0.close() }
            self?.peerConnections.removeAll()
            self?.dataChannels.removeAll()
        }
    }
    
    // MARK: - Signaling Server Connection
    private func connectToSignalingServer() {
        webSocketTask = urlSession.webSocketTask(with: signalingServerURL)
        webSocketTask?.resume()
        
        // Send join message
        let joinMessage: [String: Any] = [
            "type": "join",
            "roomId": roomId,
            "peerId": peerId,
            "deviceInfo": [
                "name": UIDevice.current.name,
                "type": "ios"
            ]
        ]
        
        sendSignalingMessage(joinMessage)
        receiveSignalingMessages()
    }
    
    // MARK: - HMAC Authentication
    private func generateHMAC(for data: Data) -> String {
        let key = SymmetricKey(data: sharedSecret.data(using: .utf8)!)
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
        return Data(hmac).map { String(format: "%02hhx", $0) }.joined()
    }
    
    private func verifyHMAC(_ hmac: String, for data: Data) -> Bool {
        let expectedHMAC = generateHMAC(for: data)
        return hmac == expectedHMAC
    }
    
    // MARK: - Signaling Messages
    private func sendSignalingMessage(_ data: [String: Any]) {
        guard let webSocketTask = webSocketTask else { return }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            let hmac = generateHMAC(for: jsonData)
            
            let message: [String: Any] = [
                "data": data,
                "hmac": hmac
            ]
            
            let messageData = try JSONSerialization.data(withJSONObject: message)
            let messageString = String(data: messageData, encoding: .utf8)!
            
            webSocketTask.send(.string(messageString)) { error in
                if let error = error {
                    print("WebSocket send error: \(error)")
                }
            }
        } catch {
            print("Error sending signaling message: \(error)")
        }
    }
    
    private func receiveSignalingMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleSignalingMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleSignalingMessage(text)
                    }
                @unknown default:
                    break
                }
                
                // Continue receiving messages
                self.receiveSignalingMessages()
                
            case .failure(let error):
                print("WebSocket receive error: \(error)")
                self.delegate?.webRTCManager(self, didEncounterError: error)
            }
        }
    }
    
    private func handleSignalingMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let messageData = json["data"] as? [String: Any],
              let hmac = json["hmac"] as? String else {
            print("Invalid signaling message format")
            return
        }
        
        // Verify HMAC
        let dataToVerify = try! JSONSerialization.data(withJSONObject: messageData)
        guard verifyHMAC(hmac, for: dataToVerify) else {
            print("Invalid HMAC in signaling message")
            return
        }
        
        // Handle message based on type
        guard let type = messageData["type"] as? String else { return }
        
        switch type {
        case "room-peers":
            handleRoomPeers(messageData)
        case "peer-joined":
            handlePeerJoined(messageData)
        case "offer":
            handleOffer(messageData)
        case "answer":
            handleAnswer(messageData)
        case "ice-candidate":
            handleIceCandidate(messageData)
        case "peer-left":
            handlePeerLeft(messageData)
        default:
            print("Unknown message type: \(type)")
        }
    }
    
    // MARK: - Peer Connection Management
    private func createPeerConnection(for remotePeerId: String) -> RTCPeerConnection? {
        let config = RTCConfiguration()
        config.iceServers = WebRTCConfig.iceServers.map { url in
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
    
    // MARK: - Signaling Message Handlers
    private func handleRoomPeers(_ message: [String: Any]) {
        guard let peers = message["peers"] as? [[String: Any]] else { return }
        
        for peer in peers {
            guard let remotePeerId = peer["peerId"] as? String else { continue }
            
            // Create offer for each existing peer
            if let pc = createPeerConnection(for: remotePeerId) {
                createOffer(for: pc, remotePeerId: remotePeerId)
            }
        }
    }
    
    private func handlePeerJoined(_ message: [String: Any]) {
        guard let remotePeerId = message["peerId"] as? String else { return }
        
        // New peer joined, wait for their offer
        print("Peer joined: \(remotePeerId)")
    }
    
    private func handleOffer(_ message: [String: Any]) {
        guard let offerDict = message["offer"] as? [String: Any],
              let sdp = offerDict["sdp"] as? String,
              let remotePeerId = message["fromPeerId"] as? String else { return }
        
        let sessionDescription = RTCSessionDescription(type: .offer, sdp: sdp)
        
        if let pc = createPeerConnection(for: remotePeerId) {
            pc.setRemoteDescription(sessionDescription) { [weak self] error in
                if let error = error {
                    print("Error setting remote description: \(error)")
                    return
                }
                
                self?.createAnswer(for: pc, remotePeerId: remotePeerId)
            }
        }
    }
    
    private func handleAnswer(_ message: [String: Any]) {
        guard let answerDict = message["answer"] as? [String: Any],
              let sdp = answerDict["sdp"] as? String,
              let remotePeerId = message["fromPeerId"] as? String else { return }
        
        let sessionDescription = RTCSessionDescription(type: .answer, sdp: sdp)
        
        queue.sync {
            guard let pc = peerConnections[remotePeerId] else { return }
            
            pc.setRemoteDescription(sessionDescription) { error in
                if let error = error {
                    print("Error setting remote description: \(error)")
                }
            }
        }
    }
    
    private func handleIceCandidate(_ message: [String: Any]) {
        guard let candidateDict = message["candidate"] as? [String: Any],
              let sdp = candidateDict["candidate"] as? String,
              let sdpMLineIndex = candidateDict["sdpMLineIndex"] as? Int32,
              let sdpMid = candidateDict["sdpMid"] as? String,
              let remotePeerId = message["fromPeerId"] as? String else { return }
        
        let candidate = RTCIceCandidate(
            sdp: sdp,
            sdpMLineIndex: sdpMLineIndex,
            sdpMid: sdpMid
        )
        
        queue.sync {
            guard let pc = peerConnections[remotePeerId] else { return }
            pc.add(candidate)
        }
    }
    
    private func handlePeerLeft(_ message: [String: Any]) {
        guard let remotePeerId = message["peerId"] as? String else { return }
        
        queue.async(flags: .barrier) {
            self.peerConnections[remotePeerId]?.close()
            self.peerConnections.removeValue(forKey: remotePeerId)
            self.dataChannels.removeValue(forKey: remotePeerId)
        }
        
        DispatchQueue.main.async {
            self.delegate?.webRTCManager(self, didDisconnectPeer: remotePeerId)
        }
    }
    
    // MARK: - Offer/Answer Creation
    private func createOffer(for peerConnection: RTCPeerConnection, remotePeerId: String) {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
            optionalConstraints: nil
        )
        
        peerConnection.offer(for: constraints) { [weak self] sessionDescription, error in
            guard let self = self,
                  let sdp = sessionDescription else {
                print("Error creating offer: \(error?.localizedDescription ?? "Unknown")")
                return
            }
            
            peerConnection.setLocalDescription(sdp) { error in
                if let error = error {
                    print("Error setting local description: \(error)")
                    return
                }
                
                // Send offer via signaling
                let offerMessage: [String: Any] = [
                    "type": "offer",
                    "targetPeerId": remotePeerId,
                    "offer": [
                        "type": sdp.type.rawValue,
                        "sdp": sdp.sdp
                    ]
                ]
                
                self.sendSignalingMessage(offerMessage)
            }
        }
    }
    
    private func createAnswer(for peerConnection: RTCPeerConnection, remotePeerId: String) {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "false", "OfferToReceiveVideo": "false"],
            optionalConstraints: nil
        )
        
        peerConnection.answer(for: constraints) { [weak self] sessionDescription, error in
            guard let self = self,
                  let sdp = sessionDescription else {
                print("Error creating answer: \(error?.localizedDescription ?? "Unknown")")
                return
            }
            
            peerConnection.setLocalDescription(sdp) { error in
                if let error = error {
                    print("Error setting local description: \(error)")
                    return
                }
                
                // Send answer via signaling
                let answerMessage: [String: Any] = [
                    "type": "answer",
                    "targetPeerId": remotePeerId,
                    "answer": [
                        "type": sdp.type.rawValue,
                        "sdp": sdp.sdp
                    ]
                ]
                
                self.sendSignalingMessage(answerMessage)
            }
        }
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
        
        // Send ICE candidate via signaling
        let candidateMessage: [String: Any] = [
            "type": "ice-candidate",
            "targetPeerId": peerId,
            "candidate": [
                "candidate": candidate.sdp,
                "sdpMLineIndex": candidate.sdpMLineIndex,
                "sdpMid": candidate.sdpMid ?? ""
            ]
        ]
        
        sendSignalingMessage(candidateMessage)
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