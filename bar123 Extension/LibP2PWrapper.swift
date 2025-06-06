//
//  LibP2PWrapper.swift
//  bar123 Extension
//
//  Swift wrapper for Rust libp2p FFI
//

import Foundation
import os.log

import Darwin

// Define C types to match the Rust FFI
struct P2PMessage {
    let peer_id: UnsafePointer<CChar>?
    let topic: UnsafePointer<CChar>?
    let data: UnsafePointer<CChar>?
    let data_len: UInt
}

// Dynamic library loading approach to avoid static linking issues
class LibP2PFFILoader {
    private var handle: UnsafeMutableRawPointer?
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "LibP2PFFI")
    
    // Function pointers
    private var _p2p_node_create: (@convention(c) () -> OpaquePointer?)?
    private var _p2p_node_destroy: (@convention(c) (OpaquePointer?) -> Void)?
    private var _p2p_node_initialize: (@convention(c) (OpaquePointer?) -> Bool)?
    private var _p2p_node_start_listening: (@convention(c) (OpaquePointer?, UInt16) -> Bool)?
    private var _p2p_node_join_room: (@convention(c) (OpaquePointer?, UnsafePointer<CChar>?) -> Bool)?
    private var _p2p_node_send_message: (@convention(c) (OpaquePointer?, UnsafePointer<UInt8>?, UInt) -> Bool)?
    private var _p2p_send_history_sync: (@convention(c) (OpaquePointer?, UnsafePointer<CChar>?, UnsafePointer<CChar>?) -> Bool)?
    private var _p2p_get_peer_id: (@convention(c) (OpaquePointer?) -> UnsafePointer<CChar>?)?
    private var _p2p_init_logging: (@convention(c) () -> Void)?
    
    func loadLibrary() -> Bool {
        // Try to load the dynamic library
        let libraryPath = Bundle.main.path(forResource: "liblibp2p_ffi", ofType: "dylib")
        
        guard let path = libraryPath else {
            logger.error("libp2p FFI library not found in bundle")
            return false
        }
        
        handle = dlopen(path, RTLD_LAZY)
        guard handle != nil else {
            if let error = dlerror() {
                logger.error("Failed to load libp2p FFI library: \\(String(cString: error))")
            }
            return false
        }
        
        // Load function symbols
        _p2p_node_create = unsafeBitCast(dlsym(handle, "p2p_node_create"), to: (@convention(c) () -> OpaquePointer?).self)
        _p2p_node_destroy = unsafeBitCast(dlsym(handle, "p2p_node_destroy"), to: (@convention(c) (OpaquePointer?) -> Void).self)
        _p2p_node_initialize = unsafeBitCast(dlsym(handle, "p2p_node_initialize"), to: (@convention(c) (OpaquePointer?) -> Bool).self)
        _p2p_node_start_listening = unsafeBitCast(dlsym(handle, "p2p_node_start_listening"), to: (@convention(c) (OpaquePointer?, UInt16) -> Bool).self)
        _p2p_node_join_room = unsafeBitCast(dlsym(handle, "p2p_node_join_room"), to: (@convention(c) (OpaquePointer?, UnsafePointer<CChar>?) -> Bool).self)
        _p2p_node_send_message = unsafeBitCast(dlsym(handle, "p2p_node_send_message"), to: (@convention(c) (OpaquePointer?, UnsafePointer<UInt8>?, UInt) -> Bool).self)
        _p2p_send_history_sync = unsafeBitCast(dlsym(handle, "p2p_send_history_sync"), to: (@convention(c) (OpaquePointer?, UnsafePointer<CChar>?, UnsafePointer<CChar>?) -> Bool).self)
        _p2p_get_peer_id = unsafeBitCast(dlsym(handle, "p2p_get_peer_id"), to: (@convention(c) (OpaquePointer?) -> UnsafePointer<CChar>?).self)
        _p2p_init_logging = unsafeBitCast(dlsym(handle, "p2p_init_logging"), to: (@convention(c) () -> Void).self)
        
        logger.info("libp2p FFI library loaded successfully")
        return true
    }
    
    func unloadLibrary() {
        if let handle = handle {
            dlclose(handle)
            self.handle = nil
        }
    }
    
    // Wrapper functions
    func p2p_node_create() -> OpaquePointer? {
        return _p2p_node_create?()
    }
    
    func p2p_node_destroy(_ node: OpaquePointer?) {
        _p2p_node_destroy?(node)
    }
    
    func p2p_node_initialize(_ node: OpaquePointer?) -> Bool {
        return _p2p_node_initialize?(node) ?? false
    }
    
    func p2p_node_start_listening(_ node: OpaquePointer?, _ port: UInt16) -> Bool {
        return _p2p_node_start_listening?(node, port) ?? false
    }
    
    func p2p_node_join_room(_ node: OpaquePointer?, _ room_id: UnsafePointer<CChar>?) -> Bool {
        return _p2p_node_join_room?(node, room_id) ?? false
    }
    
    func p2p_node_send_message(_ node: OpaquePointer?, _ data: UnsafePointer<UInt8>?, _ data_len: UInt) -> Bool {
        return _p2p_node_send_message?(node, data, data_len) ?? false
    }
    
    func p2p_send_history_sync(_ node: OpaquePointer?, _ entries_json: UnsafePointer<CChar>?, _ device_id: UnsafePointer<CChar>?) -> Bool {
        return _p2p_send_history_sync?(node, entries_json, device_id) ?? false
    }
    
    func p2p_get_peer_id(_ node: OpaquePointer?) -> UnsafePointer<CChar>? {
        return _p2p_get_peer_id?(node)
    }
    
    func p2p_init_logging() {
        _p2p_init_logging?()
    }
}

// Global FFI loader instance
private let ffiLoader = LibP2PFFILoader()

// Swift data structures matching Rust
public struct HistoryEntry: Codable {
    let url: String
    let title: String
    let visit_time: Int64
    let duration: Int64?
    let device_id: String
    let is_article: Bool
    let content: String?
    let reading_time: Int32?
}

public struct SyncMessage: Codable {
    let message_type: String
    let entries: [HistoryEntry]
    let device_id: String
    let timestamp: Int64
}

// Swift wrapper class
public class LibP2PNode {
    private var node: OpaquePointer?
    private let logger = Logger(subsystem: "xyz.foo.bar123", category: "LibP2P")
    private var messageHandler: ((String, String, Data) -> Void)?
    private var peerHandler: ((String, Bool) -> Void)?
    
    // Static callbacks to bridge C and Swift
    private static var sharedInstance: LibP2PNode?
    
    private static let messageCallbackWrapper: (@convention(c) (UnsafeRawPointer?) -> Void) = { messagePtr in
        guard let instance = LibP2PNode.sharedInstance,
              let messagePtr = messagePtr else { return }
        
        let message = messagePtr.assumingMemoryBound(to: P2PMessage.self).pointee
        let peerId = message.peer_id.map { String(cString: $0) } ?? ""
        let topic = message.topic.map { String(cString: $0) } ?? ""
        let data = message.data.map { 
            Data(bytes: $0, count: Int(message.data_len))
        } ?? Data()
        
        instance.messageHandler?(peerId, topic, data)
    }
    
    private static let peerCallbackWrapper: (@convention(c) (UnsafePointer<CChar>?, Bool) -> Void) = { peerIdPtr, joined in
        guard let instance = LibP2PNode.sharedInstance,
              let peerIdPtr = peerIdPtr else { return }
        
        let peerId = String(cString: peerIdPtr)
        instance.peerHandler?(peerId, joined)
    }
    
    public init() {
        p2p_init_logging()
        self.node = p2p_node_create()
        
        // Set this as the shared instance for callbacks
        LibP2PNode.sharedInstance = self
        
        // Set the C callbacks
        p2p_set_message_callback(LibP2PNode.messageCallbackWrapper)
        p2p_set_peer_callback(LibP2PNode.peerCallbackWrapper)
        
        logger.info("LibP2P node created")
    }
    
    deinit {
        if let node = node {
            p2p_node_destroy(node)
        }
        LibP2PNode.sharedInstance = nil
    }
    
    public func initialize() -> Bool {
        guard let node = node else { return false }
        let success = p2p_node_initialize(node)
        logger.info("LibP2P node initialized: \(success)")
        return success
    }
    
    public func startListening(port: UInt16 = 0) -> Bool {
        guard let node = node else { return false }
        let success = p2p_node_start_listening(node, port)
        logger.info("LibP2P node listening on port \(port): \(success)")
        return success
    }
    
    public func joinRoom(roomId: String) -> Bool {
        guard let node = node else { return false }
        
        return roomId.withCString { roomIdPtr in
            let success = p2p_node_join_room(node, roomIdPtr)
            logger.info("LibP2P joined room '\(roomId)': \(success)")
            return success
        }
    }
    
    public func sendMessage(data: Data) -> Bool {
        guard let node = node else { return false }
        
        return data.withUnsafeBytes { bytes in
            guard let baseAddress = bytes.baseAddress else { return false }
            let success = p2p_node_send_message(node, baseAddress.assumingMemoryBound(to: UInt8.self), UInt(data.count))
            logger.debug("LibP2P sent message (\(data.count) bytes): \(success)")
            return success
        }
    }
    
    public func sendHistorySync(entries: [HistoryEntry], deviceId: String) -> Bool {
        guard let node = node else { return false }
        
        do {
            let jsonData = try JSONEncoder().encode(entries)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
            
            return jsonString.withCString { jsonPtr in
                deviceId.withCString { devicePtr in
                    let success = p2p_send_history_sync(node, jsonPtr, devicePtr)
                    logger.info("LibP2P sent history sync (\(entries.count) entries): \(success)")
                    return success
                }
            }
        } catch {
            logger.error("Failed to encode history entries: \(error)")
            return false
        }
    }
    
    public func getPeerId() -> String? {
        guard let node = node else { return nil }
        
        if let peerIdPtr = p2p_get_peer_id(node) {
            let peerId = String(cString: peerIdPtr)
            p2p_free_string(UnsafeMutablePointer(mutating: peerIdPtr))
            return peerId
        }
        return nil
    }
    
    // Event handlers
    public func onMessage(_ handler: @escaping (String, String, Data) -> Void) {
        self.messageHandler = handler
    }
    
    public func onPeer(_ handler: @escaping (String, Bool) -> Void) {
        self.peerHandler = handler
    }
}
