/**
 * Test Coordinator for synchronizing cross-platform tests
 * Provides a WebSocket server for test orchestration
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class TestCoordinator extends EventEmitter {
  constructor(port = 8899) {
    super();
    this.port = port;
    this.server = null;
    this.clients = new Map();
    this.testState = new Map();
    this.messageLog = [];
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port });
      
      this.server.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const clientId = url.searchParams.get('id') || `client-${Date.now()}`;
        const clientType = url.searchParams.get('type') || 'unknown';
        
        console.log(`Client connected: ${clientId} (${clientType})`);
        
        const client = {
          id: clientId,
          type: clientType,
          ws,
          connected: true,
          lastSeen: Date.now()
        };
        
        this.clients.set(clientId, client);
        this.emit('client-connected', client);
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(clientId, message);
          } catch (error) {
            console.error('Invalid message from', clientId, error);
          }
        });
        
        ws.on('close', () => {
          console.log(`Client disconnected: ${clientId}`);
          this.clients.delete(clientId);
          this.emit('client-disconnected', clientId);
        });
        
        ws.on('error', (error) => {
          console.error(`Client ${clientId} error:`, error);
        });
        
        // Send welcome message
        this.sendToClient(clientId, {
          type: 'welcome',
          clientId,
          timestamp: Date.now()
        });
      });
      
      this.server.on('listening', () => {
        console.log(`Test coordinator listening on port ${this.port}`);
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }

  handleMessage(clientId, message) {
    const logEntry = {
      clientId,
      message,
      timestamp: Date.now()
    };
    
    this.messageLog.push(logEntry);
    this.emit('message', logEntry);
    
    switch (message.type) {
      case 'test-state':
        this.testState.set(clientId, message.data);
        this.broadcastTestState();
        break;
        
      case 'sync-request':
        this.handleSyncRequest(clientId, message);
        break;
        
      case 'history-update':
        this.broadcastToOthers(clientId, message);
        break;
        
      case 'peer-connected':
      case 'peer-disconnected':
        this.broadcastToOthers(clientId, message);
        break;
        
      case 'test-event':
        this.emit('test-event', { clientId, event: message.event, data: message.data });
        break;
        
      default:
        console.log(`Unknown message type from ${clientId}:`, message.type);
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcastToOthers(senderId, message) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== senderId) {
        this.sendToClient(clientId, {
          ...message,
          fromClient: senderId
        });
      }
    });
  }

  broadcast(message) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  broadcastTestState() {
    const state = {};
    this.testState.forEach((value, key) => {
      state[key] = value;
    });
    
    this.broadcast({
      type: 'test-state-update',
      state,
      timestamp: Date.now()
    });
  }

  handleSyncRequest(clientId, message) {
    // Coordinate sync between clients
    const { targetClient, data } = message;
    
    if (targetClient) {
      this.sendToClient(targetClient, {
        type: 'sync-data',
        fromClient: clientId,
        data
      });
    } else {
      // Broadcast to all others
      this.broadcastToOthers(clientId, {
        type: 'sync-data',
        data
      });
    }
  }

  // Test orchestration methods
  async waitForClients(expectedClients, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const connectedTypes = Array.from(this.clients.values())
        .map(c => c.type);
      
      const hasAll = expectedClients.every(type => 
        connectedTypes.includes(type)
      );
      
      if (hasAll) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for clients: ${expectedClients.join(', ')}`);
  }

  async executeTestSequence(sequence) {
    const results = [];
    
    for (const step of sequence) {
      console.log(`Executing test step: ${step.name}`);
      
      try {
        switch (step.action) {
          case 'send-to-client':
            this.sendToClient(step.clientId, step.message);
            break;
            
          case 'broadcast':
            this.broadcast(step.message);
            break;
            
          case 'wait':
            await new Promise(resolve => setTimeout(resolve, step.duration));
            break;
            
          case 'wait-for-event':
            await this.waitForEvent(step.event, step.timeout);
            break;
            
          default:
            throw new Error(`Unknown action: ${step.action}`);
        }
        
        results.push({ step: step.name, success: true });
      } catch (error) {
        results.push({ step: step.name, success: false, error: error.message });
        
        if (!step.continueOnError) {
          break;
        }
      }
    }
    
    return results;
  }

  waitForEvent(eventName, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(eventName, handler);
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);
      
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      
      this.once(eventName, handler);
    });
  }

  getConnectedClients() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      type: client.type,
      connected: client.connected,
      lastSeen: client.lastSeen
    }));
  }

  getMessageLog(filter = {}) {
    let logs = this.messageLog;
    
    if (filter.clientId) {
      logs = logs.filter(log => log.clientId === filter.clientId);
    }
    
    if (filter.messageType) {
      logs = logs.filter(log => log.message.type === filter.messageType);
    }
    
    if (filter.since) {
      logs = logs.filter(log => log.timestamp > filter.since);
    }
    
    return logs;
  }

  async stop() {
    // Notify all clients
    this.broadcast({
      type: 'coordinator-shutdown',
      timestamp: Date.now()
    });
    
    // Close all connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    // Close server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Test coordinator stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Test sequence builder
export class TestSequenceBuilder {
  constructor() {
    this.steps = [];
  }

  sendToClient(clientId, message, name = null) {
    this.steps.push({
      name: name || `Send to ${clientId}`,
      action: 'send-to-client',
      clientId,
      message
    });
    return this;
  }

  broadcast(message, name = null) {
    this.steps.push({
      name: name || 'Broadcast message',
      action: 'broadcast',
      message
    });
    return this;
  }

  wait(duration, name = null) {
    this.steps.push({
      name: name || `Wait ${duration}ms`,
      action: 'wait',
      duration
    });
    return this;
  }

  waitForEvent(event, timeout = 10000, name = null) {
    this.steps.push({
      name: name || `Wait for ${event}`,
      action: 'wait-for-event',
      event,
      timeout
    });
    return this;
  }

  build() {
    return this.steps;
  }
}