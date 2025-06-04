import Foundation
import TrysteroSwift

@main
struct TrysteroChat {
    static let relayURL = ProcessInfo.processInfo.environment["RELAY_URL"] ?? "ws://localhost:7777"
    static let roomID = ProcessInfo.processInfo.environment["ROOM_ID"] ?? "test-room"
    static let peerName = ProcessInfo.processInfo.environment["PEER_NAME"] ?? "swift-peer"
    static let isAutomated = ProcessInfo.processInfo.environment["AUTOMATED_TEST"] == "true"
    
    static func main() async throws {
        print("[CHAT] Starting Trystero chat client")
        print("[CHAT] Relay: \(relayURL)")
        print("[CHAT] Room: \(roomID)")
        print("[CHAT] Name: \(peerName)")
        
        let config = TrysteroSwift.RoomConfig(relays: [relayURL])
        let room = try Trystero.joinRoom(config: config, roomId: roomID)
        
        // Track connected peers
        var connectedPeers = Set<String>()
        
        // Set up event handlers
        room.onPeerJoin { peerId in
            print("[CHAT] Peer joined: \(peerId)")
            connectedPeers.insert(peerId)
            
            // Send introduction message
            let intro = "\(peerName) joined the room"
            if let data = intro.data(using: .utf8) {
                try? room.send(data, to: peerId)
            }
        }
        
        room.onPeerLeave { peerId in
            print("[CHAT] Peer left: \(peerId)")
            connectedPeers.remove(peerId)
        }
        
        room.onData { data, peerId in
            if let message = String(data: data, encoding: .utf8) {
                print("[CHAT] Message from \(peerId): \(message)")
                
                // In automated mode, respond to specific messages
                if isAutomated {
                    handleAutomatedResponse(message: message, from: peerId, room: room)
                }
            }
        }
        
        // Join the room
        try await room.join()
        print("[CHAT] Joined room successfully")
        
        if isAutomated {
            // Automated test mode
            await runAutomatedTest(room: room, connectedPeers: &connectedPeers)
        } else {
            // Interactive mode
            await runInteractiveChat(room: room)
        }
        
        // Clean up
        await room.leave()
        print("[CHAT] Left room")
    }
    
    static func handleAutomatedResponse(message: String, from peerId: String, room: TrysteroRoom) {
        // Respond to test messages
        switch message {
        case "ping":
            if let data = "pong".data(using: .utf8) {
                try? room.send(data, to: peerId)
            }
        case "echo-test":
            if let data = "echo-response".data(using: .utf8) {
                try? room.send(data, to: peerId)
            }
        case let msg where msg.starts(with: "test-"):
            let response = "ack-\(msg)"
            if let data = response.data(using: .utf8) {
                try? room.send(data, to: peerId)
            }
        default:
            break
        }
    }
    
    static func runAutomatedTest(room: TrysteroRoom, connectedPeers: inout Set<String>) async {
        print("[CHAT] Running in automated test mode")
        
        // Wait for peers to connect
        var attempts = 0
        while connectedPeers.isEmpty && attempts < 30 {
            print("[CHAT] Waiting for peers... (\(attempts + 1)/30)")
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            attempts += 1
        }
        
        if connectedPeers.isEmpty {
            print("[CHAT] ERROR: No peers connected after 30 seconds")
            exit(1)
        }
        
        // Send test messages
        let testMessages = [
            "Hello from Swift!",
            "test-message-1",
            "test-message-2",
            "ping"
        ]
        
        for message in testMessages {
            print("[CHAT] Sending test message: \(message)")
            if let data = message.data(using: .utf8) {
                try? room.send(data) // Broadcast to all
            }
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        }
        
        // Wait for responses
        try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
        
        print("[CHAT] Automated test completed")
    }
    
    static func runInteractiveChat(room: TrysteroRoom) async {
        print("[CHAT] Interactive mode - type messages to send, 'quit' to exit")
        
        let queue = DispatchQueue(label: "input-queue")
        var shouldQuit = false
        
        // Start input reader
        queue.async {
            while !shouldQuit {
                if let input = readLine() {
                    if input == "quit" {
                        shouldQuit = true
                        break
                    }
                    
                    let message = "\(peerName): \(input)"
                    if let data = message.data(using: .utf8) {
                        try? room.send(data) // Broadcast
                        print("[CHAT] Sent: \(input)")
                    }
                }
            }
        }
        
        // Keep running until quit
        while !shouldQuit {
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
        }
    }
}
