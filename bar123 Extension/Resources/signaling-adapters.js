// Adapters for different signaling services
class SignalingAdapter {
    constructor(config) {
        this.config = config;
        this.onMessage = null;
        this.onConnect = null;
        this.onDisconnect = null;
    }

    async connect() {
        throw new Error('connect() must be implemented');
    }

    send(message) {
        throw new Error('send() must be implemented');
    }

    disconnect() {
        throw new Error('disconnect() must be implemented');
    }
}

// Firebase Realtime Database as signaling server
class FirebaseSignalingAdapter extends SignalingAdapter {
    constructor(config) {
        super(config);
        this.database = null;
        this.roomRef = null;
        this.deviceId = config.deviceId;
        this.roomId = config.roomId;
    }

    async connect() {
        // Use Firebase REST API (no SDK needed)
        this.baseUrl = `https://${this.config.projectId}-default-rtdb.firebaseio.com`;
        
        // Join room
        await this.joinRoom();
        
        // Listen for messages
        this.startListening();
        
        if (this.onConnect) this.onConnect();
    }

    async joinRoom() {
        const url = `${this.baseUrl}/rooms/${this.roomId}/devices/${this.deviceId}.json`;
        await fetch(url, {
            method: 'PUT',
            body: JSON.stringify({
                timestamp: Date.now(),
                status: 'online'
            })
        });

        // Notify existing devices
        const devicesUrl = `${this.baseUrl}/rooms/${this.roomId}/devices.json`;
        const response = await fetch(devicesUrl);
        const devices = await response.json();
        
        if (devices) {
            Object.keys(devices).forEach(deviceId => {
                if (deviceId !== this.deviceId) {
                    this.sendToDevice(deviceId, {
                        type: 'peer-joined',
                        deviceId: this.deviceId
                    });
                }
            });
        }
    }

    startListening() {
        // Use Server-Sent Events for real-time updates
        const url = `${this.baseUrl}/rooms/${this.roomId}/messages/${this.deviceId}.json`;
        const eventSource = new EventSource(url);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data && this.onMessage) {
                this.onMessage(data);
            }
        };
    }

    async sendToDevice(deviceId, message) {
        const url = `${this.baseUrl}/rooms/${this.roomId}/messages/${deviceId}.json`;
        await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                ...message,
                from: this.deviceId,
                timestamp: Date.now()
            })
        });
    }

    send(message) {
        if (message.to) {
            this.sendToDevice(message.to, message);
        }
    }

    disconnect() {
        // Remove device from room
        const url = `${this.baseUrl}/rooms/${this.roomId}/devices/${this.deviceId}.json`;
        fetch(url, { method: 'DELETE' });
    }
}

// PeerJS Cloud Service
class PeerJSSignalingAdapter extends SignalingAdapter {
    constructor(config) {
        super(config);
        this.peer = null;
        this.connections = new Map();
        this.deviceId = config.deviceId;
        this.roomId = config.roomId;
    }

    async connect() {
        // Use PeerJS cloud service (free tier)
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
        document.head.appendChild(script);

        await new Promise(resolve => script.onload = resolve);

        this.peer = new Peer(this.deviceId, {
            host: 'peerjs-server.herokuapp.com',
            port: 443,
            path: '/peerjs',
            secure: true
        });

        this.peer.on('open', () => {
            this.discoverPeers();
            if (this.onConnect) this.onConnect();
        });

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });

        this.peer.on('error', (error) => {
            console.error('PeerJS error:', error);
        });
    }

    async discoverPeers() {
        // Use a simple discovery mechanism via shared room name
        const roomPeerId = `room_${this.roomId}`;
        try {
            const conn = this.peer.connect(roomPeerId);
            if (conn) {
                this.setupConnection(conn);
            }
        } catch (error) {
            // Room peer doesn't exist, create it
            console.log('No existing room peer found');
        }
    }

    setupConnection(conn) {
        conn.on('data', (data) => {
            if (this.onMessage) {
                this.onMessage(data);
            }
        });

        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
        });
    }

    send(message) {
        this.connections.forEach((conn) => {
            if (conn.open) {
                conn.send(message);
            }
        });
    }

    disconnect() {
        this.connections.forEach((conn) => conn.close());
        if (this.peer) {
            this.peer.destroy();
        }
    }
}

// Socket.IO free services (like socket.io's demo server)
class SocketIOSignalingAdapter extends SignalingAdapter {
    constructor(config) {
        super(config);
        this.socket = null;
        this.deviceId = config.deviceId;
        this.roomId = config.roomId;
    }

    async connect() {
        // Load Socket.IO client
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        document.head.appendChild(script);

        await new Promise(resolve => script.onload = resolve);

        // Connect to free Socket.IO service (or your deployed one)
        this.socket = io(this.config.serverUrl || 'https://socketio-demo.herokuapp.com');

        this.socket.on('connect', () => {
            this.socket.emit('join-room', this.roomId, this.deviceId);
            if (this.onConnect) this.onConnect();
        });

        this.socket.on('signaling-message', (message) => {
            if (this.onMessage) {
                this.onMessage(message);
            }
        });

        this.socket.on('peer-joined', (deviceId) => {
            if (this.onMessage) {
                this.onMessage({
                    type: 'peer-joined',
                    deviceId: deviceId
                });
            }
        });

        this.socket.on('disconnect', () => {
            if (this.onDisconnect) this.onDisconnect();
        });
    }

    send(message) {
        if (this.socket) {
            this.socket.emit('signaling-message', this.roomId, message);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// GitHub Gist as simple message relay (creative but works!)
class GistSignalingAdapter extends SignalingAdapter {
    constructor(config) {
        super(config);
        this.gistId = config.gistId; // Public gist for message relay
        this.deviceId = config.deviceId;
        this.pollInterval = null;
        this.lastMessageTime = 0;
    }

    async connect() {
        this.startPolling();
        if (this.onConnect) this.onConnect();
    }

    startPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`https://api.github.com/gists/${this.gistId}`);
                const gist = await response.json();
                
                const content = gist.files['messages.json']?.content;
                if (content) {
                    const messages = JSON.parse(content);
                    messages.forEach(message => {
                        if (message.timestamp > this.lastMessageTime && 
                            message.to === this.deviceId && 
                            this.onMessage) {
                            this.onMessage(message);
                            this.lastMessageTime = message.timestamp;
                        }
                    });
                }
            } catch (error) {
                console.error('Gist polling error:', error);
            }
        }, 2000);
    }

    async send(message) {
        // This would require GitHub token and is read-only for public gists
        // Better used as a fallback option
        console.log('Gist signaling send:', message);
    }

    disconnect() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}

// Factory function to create appropriate adapter
function createSignalingAdapter(type, config) {
    switch (type) {
        case 'firebase':
            return new FirebaseSignalingAdapter(config);
        case 'peerjs':
            return new PeerJSSignalingAdapter(config);
        case 'socketio':
            return new SocketIOSignalingAdapter(config);
        case 'gist':
            return new GistSignalingAdapter(config);
        case 'websocket':
        default:
            return new WebSocketSignalingAdapter(config);
    }
}

// Original WebSocket adapter for compatibility
class WebSocketSignalingAdapter extends SignalingAdapter {
    constructor(config) {
        super(config);
        this.websocket = null;
        this.serverUrl = config.serverUrl;
        this.deviceId = config.deviceId;
        this.roomId = config.roomId;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(this.serverUrl);
            
            this.websocket.onopen = () => {
                this.websocket.send(JSON.stringify({
                    type: 'join',
                    room: this.roomId,
                    deviceId: this.deviceId
                }));
                if (this.onConnect) this.onConnect();
                resolve();
            };

            this.websocket.onmessage = (event) => {
                if (this.onMessage) {
                    this.onMessage(JSON.parse(event.data));
                }
            };

            this.websocket.onclose = () => {
                if (this.onDisconnect) this.onDisconnect();
            };

            this.websocket.onerror = (error) => {
                reject(error);
            };
        });
    }

    send(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }

    disconnect() {
        if (this.websocket) {
            this.websocket.close();
        }
    }
}