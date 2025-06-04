use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::time::Duration;

use anyhow::{anyhow, Result};
use libp2p::{
    gossipsub, identify, kad, mdns, noise, ping, tcp, yamux,
    autonat, dcutr,
    Multiaddr, PeerId, Swarm,
    swarm::NetworkBehaviour,
};
use serde::{Deserialize, Serialize};
use tokio::runtime::Runtime;
use tracing::{error, info};

// FFI-safe types
#[repr(C)]
pub struct P2PNode {
    inner: *mut NodeInner,
}

#[repr(C)]
pub struct P2PMessage {
    peer_id: *const c_char,
    topic: *const c_char,
    data: *const c_char,
    data_len: usize,
}

// Message types for history sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub url: String,
    pub title: String,
    pub visit_time: i64,
    pub duration: Option<i64>,
    pub device_id: String,
    pub is_article: bool,
    pub content: Option<String>,
    pub reading_time: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMessage {
    pub message_type: String,
    pub entries: Vec<HistoryEntry>,
    pub device_id: String,
    pub timestamp: i64,
}

// Internal node structure
struct NodeInner {
    runtime: Runtime,
    swarm: Option<Swarm<MyBehaviour>>,
    peer_id: PeerId,
    room_topic: Option<String>,
    connected_peers: HashMap<PeerId, bool>,
}

// Network behaviour
#[derive(NetworkBehaviour)]
struct MyBehaviour {
    gossipsub: gossipsub::Behaviour,
    mdns: mdns::tokio::Behaviour,
    identify: identify::Behaviour,
    kad: kad::Behaviour<kad::store::MemoryStore>,
    ping: ping::Behaviour,
    autonat: autonat::Behaviour,
    dcutr: dcutr::Behaviour,
}

// Callback function type for Swift
pub type MessageCallback = extern "C" fn(*const P2PMessage);
pub type PeerCallback = extern "C" fn(*const c_char, bool); // peer_id, joined/left

static mut MESSAGE_CALLBACK: Option<MessageCallback> = None;
static mut PEER_CALLBACK: Option<PeerCallback> = None;

impl NodeInner {
    fn new() -> Result<Self> {
        let runtime = Runtime::new()?;
        let keypair = libp2p::identity::Keypair::generate_ed25519();
        let peer_id = PeerId::from(keypair.public());
        
        Ok(Self {
            runtime,
            swarm: None,
            peer_id,
            room_topic: None,
            connected_peers: HashMap::new(),
        })
    }

    fn initialize_swarm(&mut self) -> Result<()> {
        let keypair = libp2p::identity::Keypair::generate_ed25519();
        let peer_id = PeerId::from(keypair.public());
        
        // Create gossipsub behaviour
        let gossipsub_config = gossipsub::ConfigBuilder::default()
            .heartbeat_interval(Duration::from_secs(10))
            .validation_mode(gossipsub::ValidationMode::Strict)
            .message_id_fn(|message: &gossipsub::Message| {
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                message.data.hash(&mut hasher);
                gossipsub::MessageId::from(hasher.finish().to_string())
            })
            .build()
            .map_err(|e| anyhow!("Failed to build gossipsub config: {}", e))?;

        let mut gossipsub = gossipsub::Behaviour::new(
            gossipsub::MessageAuthenticity::Signed(keypair.clone()),
            gossipsub_config,
        ).map_err(|e| anyhow!("Failed to create gossipsub behaviour: {}", e))?;

        // Subscribe to history sync topic
        let topic = gossipsub::IdentTopic::new("bar123-history-sync");
        gossipsub.subscribe(&topic)?;

        // Create other behaviours
        let mdns = mdns::tokio::Behaviour::new(mdns::Config::default(), peer_id)?;
        let identify = identify::Behaviour::new(identify::Config::new(
            "/bar123/1.0.0".to_string(),
            keypair.public(),
        ));
        
        let kad_store = kad::store::MemoryStore::new(peer_id);
        let mut kad = kad::Behaviour::new(peer_id, kad_store);
        kad.set_mode(Some(kad::Mode::Server));
        
        let ping = ping::Behaviour::new(ping::Config::new());
        
        // NAT traversal
        let autonat = autonat::Behaviour::new(peer_id, autonat::Config::default());
        let dcutr = dcutr::Behaviour::new(peer_id);

        // Combine behaviours
        let behaviour = MyBehaviour {
            gossipsub,
            mdns,
            identify,
            kad,
            ping,
            autonat,
            dcutr,
        };

        // Create swarm
        let swarm = libp2p::SwarmBuilder::with_existing_identity(keypair)
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                yamux::Config::default,
            )?
            .with_quic()
            .with_behaviour(|_| behaviour)?
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        self.swarm = Some(swarm);
        self.peer_id = peer_id;
        
        Ok(())
    }

    fn start_listening(&mut self, port: u16) -> Result<()> {
        if let Some(swarm) = &mut self.swarm {
            // Listen on TCP
            let tcp_addr = format!("/ip4/0.0.0.0/tcp/{}", port).parse::<Multiaddr>()?;
            swarm.listen_on(tcp_addr)?;
            
            // Also listen on a random UDP port for QUIC (better NAT traversal)
            let quic_addr = "/ip4/0.0.0.0/udp/0/quic-v1".parse::<Multiaddr>()?;
            swarm.listen_on(quic_addr)?;
            
            info!("Listening on TCP port {} and QUIC", port);
            
            // Bootstrap Kademlia
            swarm.behaviour_mut().kad.bootstrap()?;
            
            Ok(())
        } else {
            Err(anyhow!("Swarm not initialized"))
        }
    }

    fn join_room(&mut self, room_id: &str) -> Result<()> {
        self.room_topic = Some(format!("bar123-room-{}", room_id));
        
        if let Some(swarm) = &mut self.swarm {
            let topic = gossipsub::IdentTopic::new(self.room_topic.as_ref().unwrap().clone());
            swarm.behaviour_mut().gossipsub.subscribe(&topic)?;
            info!("Joined room: {}", room_id);
            Ok(())
        } else {
            Err(anyhow!("Swarm not initialized"))
        }
    }

    fn send_message(&mut self, data: &[u8]) -> Result<()> {
        if let (Some(swarm), Some(topic)) = (&mut self.swarm, &self.room_topic) {
            let topic = gossipsub::IdentTopic::new(topic);
            swarm.behaviour_mut().gossipsub.publish(topic, data)?;
            Ok(())
        } else {
            Err(anyhow!("Not connected to a room"))
        }
    }
}

// FFI functions
#[no_mangle]
pub extern "C" fn p2p_node_create() -> *mut P2PNode {
    match NodeInner::new() {
        Ok(inner) => {
            let node = P2PNode {
                inner: Box::into_raw(Box::new(inner)),
            };
            Box::into_raw(Box::new(node))
        }
        Err(e) => {
            error!("Failed to create P2P node: {}", e);
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_node_destroy(node: *mut P2PNode) {
    if !node.is_null() {
        unsafe {
            let node = Box::from_raw(node);
            if !node.inner.is_null() {
                let _ = Box::from_raw(node.inner);
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_node_initialize(node: *mut P2PNode) -> bool {
    if node.is_null() {
        return false;
    }
    
    unsafe {
        let inner = &mut *(*node).inner;
        match inner.initialize_swarm() {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to initialize swarm: {}", e);
                false
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_node_start_listening(node: *mut P2PNode, port: u16) -> bool {
    if node.is_null() {
        return false;
    }
    
    unsafe {
        let inner = &mut *(*node).inner;
        match inner.start_listening(port) {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to start listening: {}", e);
                false
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_node_join_room(node: *mut P2PNode, room_id: *const c_char) -> bool {
    if node.is_null() || room_id.is_null() {
        return false;
    }
    
    unsafe {
        let room_id_str = match CStr::from_ptr(room_id).to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let inner = &mut *(*node).inner;
        match inner.join_room(room_id_str) {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to join room: {}", e);
                false
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_node_send_message(
    node: *mut P2PNode,
    data: *const u8,
    data_len: usize,
) -> bool {
    if node.is_null() || data.is_null() {
        return false;
    }
    
    unsafe {
        let data_slice = std::slice::from_raw_parts(data, data_len);
        let inner = &mut *(*node).inner;
        
        match inner.send_message(data_slice) {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to send message: {}", e);
                false
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_set_message_callback(callback: MessageCallback) {
    unsafe {
        MESSAGE_CALLBACK = Some(callback);
    }
}

#[no_mangle]
pub extern "C" fn p2p_set_peer_callback(callback: PeerCallback) {
    unsafe {
        PEER_CALLBACK = Some(callback);
    }
}

// Helper functions for history sync
#[no_mangle]
pub extern "C" fn p2p_send_history_sync(
    node: *mut P2PNode,
    entries_json: *const c_char,
    device_id: *const c_char,
) -> bool {
    if node.is_null() || entries_json.is_null() || device_id.is_null() {
        return false;
    }
    
    unsafe {
        let entries_str = match CStr::from_ptr(entries_json).to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let device_id_str = match CStr::from_ptr(device_id).to_str() {
            Ok(s) => s,
            Err(_) => return false,
        };
        
        let entries: Vec<HistoryEntry> = match serde_json::from_str(entries_str) {
            Ok(e) => e,
            Err(e) => {
                error!("Failed to parse history entries: {}", e);
                return false;
            }
        };
        
        let sync_message = SyncMessage {
            message_type: "history_sync".to_string(),
            entries,
            device_id: device_id_str.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
        };
        
        let message_json = match serde_json::to_vec(&sync_message) {
            Ok(j) => j,
            Err(e) => {
                error!("Failed to serialize sync message: {}", e);
                return false;
            }
        };
        
        let inner = &mut *(*node).inner;
        match inner.send_message(&message_json) {
            Ok(_) => true,
            Err(e) => {
                error!("Failed to send history sync: {}", e);
                false
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn p2p_get_peer_id(node: *mut P2PNode) -> *const c_char {
    if node.is_null() {
        return std::ptr::null();
    }
    
    unsafe {
        let inner = &*(*node).inner;
        let peer_id_str = CString::new(inner.peer_id.to_string()).unwrap();
        peer_id_str.into_raw()
    }
}

#[no_mangle]
pub extern "C" fn p2p_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

// Initialize logging
#[no_mangle]
pub extern "C" fn p2p_init_logging() {
    tracing_subscriber::fmt::init();
    info!("libp2p FFI initialized");
}