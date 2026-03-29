# Blog 2: Advanced WebSockets & Scaling Real-time Systems

> A single Node.js process handles thousands of connections beautifully. But what happens when you need millions? This blog covers Socket.IO, pub/sub with Redis, horizontal scaling, authentication, and designing a production-grade real-time architecture.

---

## Table of Contents

- [Socket.IO - When Raw WebSockets Aren't Enough](#socketio--when-raw-websockets-arent-enough)
- [Authentication & Authorization](#authentication--authorization)
- [Message Protocols - Designing Your Wire Format](#message-protocols--designing-your-wire-format)
- [Scaling WebSockets Horizontally](#scaling-websockets-horizontally)
- [Redis Pub/Sub for Cross-Server Communication](#redis-pubsub-for-cross-server-communication)
- [Load Balancing WebSocket Connections](#load-balancing-websocket-connections)
- [Handling Backpressure](#handling-backpressure)
- [Message Ordering and Delivery Guarantees](#message-ordering-and-delivery-guarantees)
- [Designing a Scalable Chat Application](#designing-a-scalable-chat-application)
- [Performance Benchmarks and Limits](#performance-benchmarks-and-limits)
- [Production Checklist](#production-checklist)

---

## Socket.IO - When Raw WebSockets Aren't Enough

The raw `ws` library gives you pure WebSocket connections. **Socket.IO** builds on top of WebSockets and adds features you'll inevitably need in production:

### What Socket.IO adds over raw WebSockets

| Feature | Raw WebSocket | Socket.IO |
|---|---|---|
| Auto-reconnection | Manual (you build it) | Built-in with backoff |
| Fallback transport | WebSocket only | WebSocket → HTTP long-polling |
| Rooms/namespaces | Manual (you build it) | Built-in API |
| Broadcasting | Loop through connections | `io.to(room).emit()` |
| Acknowledgments | Manual request-response | Built-in callback pattern |
| Binary support | Yes (raw) | Yes (auto-detect) |
| Middleware | Manual | Express-like middleware chain |
| Connection state recovery | Manual | Built-in (v4.6+) |

### Socket.IO Server

```javascript
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'https://yourapp.com',
    methods: ['GET', 'POST']
  },
  // Performance tuning
  pingInterval: 25000,    // How often to ping clients
  pingTimeout: 20000,     // How long to wait for pong
  maxHttpBufferSize: 1e6, // 1MB max message size
  // Enable connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Middleware - authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = verifyJWT(token); // Your auth function
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Namespaces - separate concerns
const chatNamespace = io.of('/chat');
const notificationsNamespace = io.of('/notifications');

chatNamespace.on('connection', (socket) => {
  console.log(`${socket.user.name} connected to chat`);

  // Join a room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    // Notify the room
    socket.to(roomId).emit('userJoined', {
      userId: socket.user.id,
      username: socket.user.name
    });
  });

  // Send message to a room
  socket.on('message', (data, callback) => {
    const { roomId, content } = data;

    // Validate
    if (!content || content.length > 2000) {
      return callback({ error: 'Invalid message' });
    }

    const message = {
      id: generateId(),
      userId: socket.user.id,
      username: socket.user.name,
      content: content,
      roomId: roomId,
      timestamp: Date.now()
    };

    // Broadcast to room (including sender)
    chatNamespace.to(roomId).emit('message', message);

    // Acknowledge receipt to sender
    callback({ success: true, messageId: message.id });
  });

  // Typing indicator
  socket.on('typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('typing', {
      username: socket.user.name,
      isTyping
    });
  });

  // Leave room
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('userLeft', {
      userId: socket.user.id,
      username: socket.user.name
    });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`${socket.user.name} disconnected: ${reason}`);
  });
});

httpServer.listen(3000);
```

### Socket.IO Client

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.example.com/chat', {
  auth: {
    token: 'your-jwt-token'
  },
  // Reconnection settings
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,  // Jitter
  // Transport settings
  transports: ['websocket'],  // Skip polling, go straight to WebSocket
  upgrade: false              // Don't try to upgrade from polling
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('joinRoom', 'room_general');
});

// Send message with acknowledgment
socket.emit('message',
  { roomId: 'room_general', content: 'Hello everyone!' },
  (response) => {
    if (response.error) {
      console.error('Failed to send:', response.error);
    } else {
      console.log('Message sent, ID:', response.messageId);
    }
  }
);

// Receive messages
socket.on('message', (msg) => {
  console.log(`${msg.username}: ${msg.content}`);
});

// Handle connection errors
socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
  if (err.message === 'Authentication failed') {
    // Redirect to login
  }
});
```

### When to Use Socket.IO vs Raw WebSocket

```
Use raw ws library when:
├── You need minimal overhead (IoT, gaming)
├── You control both client and server
├── You don't need fallback transports
└── You want full protocol control

Use Socket.IO when:
├── You need rooms and broadcasting
├── You need auto-reconnection with state recovery
├── You need to support older browsers/restrictive networks
├── You want built-in middleware and auth patterns
└── You're building a typical chat/notification system
```

**Performance note:** Socket.IO adds ~10-15% overhead over raw WebSockets due to its protocol wrapper. For most applications, this is negligible. For ultra-low-latency scenarios (financial trading, gaming), use raw `ws`.

---

## Authentication & Authorization

WebSocket connections need authentication just like HTTP endpoints. Here's how to do it properly.

### Strategy 1: Token in Handshake (Recommended)

```javascript
// Client: Send token during connection
const socket = io('wss://api.example.com', {
  auth: {
    token: localStorage.getItem('authToken')
  }
});

// Server: Verify token in middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.users.findById(decoded.userId);

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user; // Attach user to socket for later use
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

### Strategy 2: Cookie-Based (For Same-Origin)

```javascript
// Server: Read cookie from handshake
io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const sessionId = cookies['session_id'];

  if (!sessionId) {
    return next(new Error('No session'));
  }

  // Validate session from your session store
  sessionStore.get(sessionId, (err, session) => {
    if (err || !session) {
      return next(new Error('Invalid session'));
    }
    socket.user = session.user;
    next();
  });
});
```

### Authorization - Room-Level Permissions

```javascript
// Middleware for room join authorization
socket.on('joinRoom', async (roomId) => {
  // Check if user has permission to join this room
  const hasAccess = await checkRoomPermission(socket.user.id, roomId);

  if (!hasAccess) {
    socket.emit('error', { message: 'You do not have access to this room' });
    return;
  }

  socket.join(roomId);
  socket.emit('joinedRoom', { roomId });
});
```

### Token Refresh for Long-Lived Connections

```javascript
// Problem: JWT expires after 1 hour, but WebSocket connection lasts for hours

// Client: Send refreshed token periodically
setInterval(async () => {
  const newToken = await refreshAuthToken();
  socket.emit('refreshToken', { token: newToken });
}, 50 * 60 * 1000); // Refresh 10 minutes before expiry

// Server: Handle token refresh
socket.on('refreshToken', async ({ token }) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = await db.users.findById(decoded.userId);
    socket.emit('tokenRefreshed');
  } catch (err) {
    socket.emit('error', { message: 'Token refresh failed' });
    socket.disconnect();
  }
});
```

---

## Message Protocols - Designing Your Wire Format

Every message needs a structure. Here's a protocol design that scales.

### The Envelope Pattern

```javascript
// Every message follows the same envelope structure:
{
  "type": "chat.message",        // Dot-separated namespace
  "id": "msg_abc123",            // Unique message ID (for dedup and ack)
  "timestamp": 1706400000000,    // Server timestamp (ms since epoch)
  "payload": {                   // Type-specific data
    "roomId": "room_general",
    "content": "Hello!",
    "mentions": ["user_42"]
  }
}

// Message types follow a verb pattern:
// chat.message      - new chat message
// chat.edit         - edit existing message
// chat.delete       - delete message
// chat.typing       - typing indicator
// user.online       - user came online
// user.offline      - user went offline
// room.join         - user joined room
// room.leave        - user left room
// system.error      - error from server
// system.ack        - acknowledgment
```

### Why This Design Works

```
1. "type" field enables routing without parsing the entire message
2. "id" field enables deduplication (important with retries)
3. "timestamp" field is set by SERVER (clients can't be trusted for ordering)
4. "payload" is type-specific - keeps the envelope stable while payloads evolve
5. Dot-separated types enable wildcard subscriptions: "chat.*"
```

### Message Serialization - JSON vs Binary

```javascript
// JSON - simple, debuggable, universal
// Overhead: ~40% larger than binary for typical messages
ws.send(JSON.stringify({
  type: 'position',
  payload: { x: 123.456, y: 789.012, z: 45.678 }
}));
// → 62 bytes as JSON string

// MessagePack - binary, ~30% smaller than JSON
const msgpack = require('msgpack-lite');
ws.send(msgpack.encode({
  type: 'position',
  payload: { x: 123.456, y: 789.012, z: 45.678 }
}));
// → ~42 bytes as binary

// Protocol Buffers - smallest, fastest, but requires schema definition
// Best for high-frequency messages (game state, financial data)
// position.proto:
// message Position {
//   float x = 1;
//   float y = 2;
//   float z = 3;
// }
// → ~14 bytes
```

**When to use which:**

| Format | Size | Speed | Debuggability | Use Case |
|---|---|---|---|---|
| JSON | Largest | Slowest | Excellent | Chat, notifications, general apps |
| MessagePack | Medium | Fast | Medium (binary) | Mobile apps (bandwidth sensitive) |
| Protocol Buffers | Smallest | Fastest | Poor (need schema) | Gaming, financial trading |

For most applications, **JSON is the right choice**. Only switch to binary formats when you've measured a real bottleneck.

---

## Scaling WebSockets Horizontally

A single Node.js process can handle **10,000-50,000 concurrent WebSocket connections** (depending on message frequency and processing complexity). Beyond that, you need multiple servers.

### The Problem: Server Affinity

```
With a single server, broadcasting is easy:
Server A has all clients → loop through all and send

With multiple servers, it breaks:
Server A has Alice, Bob
Server B has Carol, Dave

Alice sends a message → Server A broadcasts to Bob
But Carol and Dave (on Server B) never see it!
```

### Architecture for Horizontal Scaling

```
                        Load Balancer
                     (sticky sessions)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         ┌─────────┐  ┌─────────┐  ┌─────────┐
         │Server A │  │Server B │  │Server C │
         │Alice,Bob│  │Carol    │  │Dave,Eve │
         └────┬────┘  └────┬────┘  └────┬────┘
              │            │             │
              └────────────┼─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Redis     │
                    │  Pub/Sub    │
                    └─────────────┘

Flow when Alice sends a message:
1. Alice's WebSocket → Server A receives it
2. Server A publishes message to Redis channel "room:general"
3. ALL servers subscribed to "room:general" receive the message
4. Each server sends to its locally connected clients in that room
5. Carol (Server B) and Dave/Eve (Server C) receive the message
```

---

## Redis Pub/Sub for Cross-Server Communication

### Using Socket.IO with Redis Adapter

```javascript
// This is the easiest way to scale Socket.IO across servers

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

async function createSocketServer(httpServer) {
  const io = new Server(httpServer);

  // Create Redis clients (pub and sub need separate connections)
  const pubClient = createClient({ url: 'redis://redis-host:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  // Attach the Redis adapter
  io.adapter(createAdapter(pubClient, subClient));

  // Now io.to('room').emit() automatically works across servers!
  io.on('connection', (socket) => {
    socket.on('message', ({ roomId, content }) => {
      // This broadcast reaches ALL servers via Redis
      io.to(roomId).emit('message', {
        username: socket.user.name,
        content,
        timestamp: Date.now()
      });
    });
  });

  return io;
}
```

**How it works under the hood:**

```
1. Server A calls io.to('room1').emit('message', data)
2. Socket.IO Redis adapter publishes to Redis channel: socket.io#room1
3. Redis broadcasts to all subscribed servers (B, C, D...)
4. Each server's adapter receives the message
5. Each server sends to its local clients in 'room1'
```

### Custom Redis Pub/Sub (Without Socket.IO)

```javascript
// For raw WebSocket servers, implement pub/sub yourself:

const Redis = require('ioredis');

class RedisPubSub {
  constructor(redisUrl) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.handlers = new Map(); // channel → Set<callback>
  }

  async subscribe(channel, handler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel).add(handler);
  }

  async unsubscribe(channel, handler) {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }
  }

  async publish(channel, message) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  start() {
    this.subscriber.on('message', (channel, rawMessage) => {
      const message = JSON.parse(rawMessage);
      const handlers = this.handlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    });
  }
}

// Usage with raw ws:
const pubsub = new RedisPubSub('redis://localhost:6379');
pubsub.start();

wss.on('connection', (ws) => {
  ws.on('message', (rawData) => {
    const data = JSON.parse(rawData.toString());

    if (data.type === 'joinRoom') {
      const handler = (message) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(message));
        }
      };

      pubsub.subscribe(`room:${data.roomId}`, handler);

      // Clean up on disconnect
      ws.on('close', () => {
        pubsub.unsubscribe(`room:${data.roomId}`, handler);
      });
    }

    if (data.type === 'chat') {
      pubsub.publish(`room:${data.roomId}`, {
        type: 'chat',
        username: ws.user.name,
        content: data.content,
        timestamp: Date.now()
      });
    }
  });
});
```

### Redis Pub/Sub Limitations

```
Redis Pub/Sub is fire-and-forget:
- If a server is down when a message is published, it MISSES the message
- No message persistence - Redis doesn't store pub/sub messages
- No delivery guarantees

For guaranteed delivery, consider:
- Redis Streams (persistent, consumer groups, replay)
- Kafka (persistent, partitioned, replayable)
- NATS JetStream (lightweight, persistent)
```

### Redis Streams - Persistent Alternative

```javascript
// Redis Streams provide persistence + consumer groups

const Redis = require('ioredis');
const redis = new Redis();

// Publish message (persisted in stream)
await redis.xadd('room:general', '*',
  'type', 'chat',
  'username', 'Alice',
  'content', 'Hello!',
  'timestamp', Date.now().toString()
);

// Create consumer group (each server is a consumer)
await redis.xgroup('CREATE', 'room:general', 'chat-servers', '0', 'MKSTREAM');

// Read new messages (blocking read)
async function consumeMessages(serverId) {
  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', 'chat-servers', serverId,
      'BLOCK', 5000,  // Block for 5 seconds
      'COUNT', 100,
      'STREAMS', 'room:general', '>'
    );

    if (results) {
      for (const [stream, messages] of results) {
        for (const [id, fields] of messages) {
          // Process and broadcast to local clients
          broadcastToLocalClients(fieldsToObject(fields));
          // Acknowledge processing
          await redis.xack('room:general', 'chat-servers', id);
        }
      }
    }
  }
}
```

---

## Load Balancing WebSocket Connections

### The Sticky Session Requirement

Unlike HTTP (where any server can handle any request), WebSocket connections are **stateful**. Once a client connects to Server A, all subsequent WebSocket frames must go to Server A.

```
Without sticky sessions:
Client ──WS Connect──► Server A (connection established)
Client ──WS Frame──►   Server B (??? doesn't know this connection)
→ Connection fails!

With sticky sessions:
Client ──WS Connect──► Server A (connection established)
Client ──WS Frame──►   Server A (same server, works!)
```

### Nginx Configuration for WebSocket Load Balancing

```nginx
upstream websocket_servers {
    # ip_hash ensures the same client always reaches the same server
    ip_hash;

    server ws-server-1:3000;
    server ws-server-2:3000;
    server ws-server-3:3000;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location /ws {
        proxy_pass http://websocket_servers;

        # Required for WebSocket upgrade
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Pass client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        # Timeouts (keep connection alive)
        proxy_read_timeout 86400s;  # 24 hours
        proxy_send_timeout 86400s;

        # Buffer settings
        proxy_buffering off;
    }
}
```

### Connection Distribution Strategies

```
ip_hash:
├── Pros: Simple, no external state
├── Cons: Uneven distribution if many users share an IP (corporate NAT)
└── Best for: Simple deployments

Cookie-based (sticky session cookie):
├── Pros: Even distribution, survives IP changes
├── Cons: Requires cookie support
└── Best for: Browser-based clients

Custom header/token routing:
├── Pros: Full control, works for all clients
├── Cons: Application must set the routing header
└── Best for: Mobile apps, complex routing needs

Consistent hashing (by user ID):
├── Pros: Deterministic, survives server restarts
├── Cons: Requires application-level routing
└── Best for: Large-scale systems with many servers
```

---

## Handling Backpressure

When a client can't consume messages as fast as they're produced, messages queue up. If unchecked, this consumes all server memory and crashes the process.

### Detecting Backpressure

```javascript
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data);

    // Check bufferedAmount before sending
    // bufferedAmount = bytes queued for sending but not yet transmitted
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {

        // If the client has more than 1MB buffered, skip them
        if (client.bufferedAmount > 1024 * 1024) {
          console.warn('Client has high backpressure, skipping message');
          continue;
        }

        client.send(JSON.stringify(message));
      }
    }
  });
});
```

### Strategies for Handling Backpressure

```javascript
// Strategy 1: Drop messages for slow clients
function sendToClient(ws, message) {
  if (ws.readyState !== ws.OPEN) return;
  if (ws.bufferedAmount > MAX_BUFFER) {
    // Client is too slow - drop this message
    ws.slowClientDropCount = (ws.slowClientDropCount || 0) + 1;
    if (ws.slowClientDropCount > 100) {
      ws.close(1008, 'Client too slow');
    }
    return;
  }
  ws.send(JSON.stringify(message));
}

// Strategy 2: Message coalescing (batch updates)
// Instead of sending 60 position updates per second,
// batch them into 1 update every 50ms
class MessageCoalescer {
  constructor(ws, flushInterval = 50) {
    this.ws = ws;
    this.buffer = [];
    this.timer = setInterval(() => this.flush(), flushInterval);
  }

  add(message) {
    this.buffer.push(message);
  }

  flush() {
    if (this.buffer.length === 0) return;
    if (this.ws.readyState !== this.ws.OPEN) return;

    // Send all buffered messages as a single batch
    this.ws.send(JSON.stringify({
      type: 'batch',
      messages: this.buffer
    }));
    this.buffer = [];
  }

  destroy() {
    clearInterval(this.timer);
    this.buffer = [];
  }
}

// Strategy 3: Priority queues (send important messages first)
// During high load, drop "typing" indicators but always deliver "chat" messages
```

---

## Message Ordering and Delivery Guarantees

### The Problem

```
Client sends: Message A, then Message B
Server receives: Message B, then Message A (network reordering)

Or worse:
Client sends Message A → network drops it → client never knows
```

### Implementing Ordered, Acknowledged Delivery

```javascript
// Client-side: Track sent messages and handle acknowledgments
class ReliableMessageSender {
  constructor(socket) {
    this.socket = socket;
    this.pending = new Map();  // id → { message, timestamp, retryCount }
    this.sequence = 0;

    // Check for unacknowledged messages every 5 seconds
    this.retryTimer = setInterval(() => this.retryPending(), 5000);

    // Handle acks from server
    this.socket.on('ack', ({ messageId }) => {
      this.pending.delete(messageId);
    });
  }

  send(type, payload) {
    const message = {
      id: `msg_${++this.sequence}_${Date.now()}`,
      type,
      payload,
      sequence: this.sequence
    };

    this.pending.set(message.id, {
      message,
      timestamp: Date.now(),
      retryCount: 0
    });

    this.socket.emit('message', message);
    return message.id;
  }

  retryPending() {
    const now = Date.now();
    for (const [id, entry] of this.pending) {
      if (now - entry.timestamp > 5000) {
        if (entry.retryCount >= 3) {
          // Give up - notify the UI
          this.pending.delete(id);
          this.onMessageFailed?.(entry.message);
          continue;
        }

        entry.retryCount++;
        entry.timestamp = now;
        this.socket.emit('message', entry.message);
      }
    }
  }

  destroy() {
    clearInterval(this.retryTimer);
  }
}

// Server-side: Deduplicate and acknowledge
const processedMessages = new Map(); // messageId → timestamp

socket.on('message', (message) => {
  // Deduplicate
  if (processedMessages.has(message.id)) {
    // Already processed - just re-send ack
    socket.emit('ack', { messageId: message.id });
    return;
  }

  // Process the message
  processMessage(message);

  // Track as processed (clean up after 5 minutes)
  processedMessages.set(message.id, Date.now());
  setTimeout(() => processedMessages.delete(message.id), 5 * 60 * 1000);

  // Acknowledge
  socket.emit('ack', { messageId: message.id });
});
```

---

## Designing a Scalable Chat Application

Let's design a chat system that handles **1 million concurrent users**.

### Architecture

```
                          ┌─────────────────┐
                          │   CloudFlare     │
                          │   (DDoS, TLS)    │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   API Gateway    │
                          │   (Nginx/HAProxy)│
                          │   Sticky sessions│
                          └────────┬─────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 ▼                 ▼                 ▼
          ┌────────────┐   ┌────────────┐   ┌────────────┐
          │  WS Server │   │  WS Server │   │  WS Server │
          │    (1)     │   │    (2)     │   │    (N)     │
          │ Socket.IO  │   │ Socket.IO  │   │ Socket.IO  │
          └──────┬─────┘   └──────┬─────┘   └──────┬─────┘
                 │                │                 │
                 └────────────────┼─────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌──────────┐ ┌──────────┐ ┌──────────────┐
             │  Redis   │ │ Postgres │ │   S3/CDN     │
             │ Cluster  │ │ Cluster  │ │  (media)     │
             │ (pub/sub,│ │ (messages│ │              │
             │  presence,│ │  users,  │ │              │
             │  cache)  │ │  rooms)  │ │              │
             └──────────┘ └──────────┘ └──────────────┘
```

### Data Flow - Sending a Message

```
Step-by-step:

1. Alice types "Hello" and hits Enter
2. Client sends: { type: "chat.message", payload: { roomId: "r1", content: "Hello" } }
3. WS Server 1 receives the message
4. Server validates: is Alice in room r1? Is the content valid?
5. Server writes to PostgreSQL: INSERT INTO messages (...)
6. Server publishes to Redis: PUBLISH room:r1 { ... message data ... }
7. ALL WS servers subscribed to room:r1 receive the Redis message
8. Each WS server sends the message to its local clients in room r1
9. Bob (on WS Server 2) and Carol (on WS Server 3) receive the message
10. Server sends ACK back to Alice's client

Total latency: ~10-50ms (depending on network)
```

### Message Persistence Layer

```javascript
// Write messages to PostgreSQL with optimized batching

const messageBuffer = [];
const FLUSH_INTERVAL = 100; // Flush every 100ms
const MAX_BATCH_SIZE = 500;

// Buffer incoming messages
function bufferMessage(message) {
  messageBuffer.push(message);
  if (messageBuffer.length >= MAX_BATCH_SIZE) {
    flushMessages();
  }
}

// Flush buffer to database in batch
async function flushMessages() {
  if (messageBuffer.length === 0) return;

  const batch = messageBuffer.splice(0, MAX_BATCH_SIZE);

  // Use PostgreSQL's multi-row INSERT (much faster than individual inserts)
  const values = batch.map((m, i) => {
    const offset = i * 5;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
  }).join(', ');

  const params = batch.flatMap(m => [
    m.id, m.roomId, m.userId, m.content, new Date(m.timestamp)
  ]);

  await db.query(
    `INSERT INTO messages (id, room_id, user_id, content, created_at)
     VALUES ${values}`,
    params
  );
}

// Periodic flush
setInterval(flushMessages, FLUSH_INTERVAL);
```

### Presence System (Who's Online)

```javascript
// Redis-based presence system

class PresenceService {
  constructor(redis) {
    this.redis = redis;
    this.PRESENCE_TTL = 60; // Seconds before user considered offline
  }

  // Called on each heartbeat (every 30s)
  async setOnline(userId) {
    const pipeline = this.redis.pipeline();
    pipeline.set(`presence:${userId}`, Date.now(), 'EX', this.PRESENCE_TTL);
    pipeline.sadd('online_users', userId);
    await pipeline.exec();
  }

  async setOffline(userId) {
    const pipeline = this.redis.pipeline();
    pipeline.del(`presence:${userId}`);
    pipeline.srem('online_users', userId);
    await pipeline.exec();
  }

  async isOnline(userId) {
    return await this.redis.exists(`presence:${userId}`);
  }

  async getOnlineUsersInRoom(roomId) {
    // Get room members from Redis Set
    const members = await this.redis.smembers(`room:${roomId}:members`);
    // Check which are online
    const pipeline = this.redis.pipeline();
    for (const userId of members) {
      pipeline.exists(`presence:${userId}`);
    }
    const results = await pipeline.exec();

    return members.filter((_, i) => results[i][1] === 1);
  }
}
```

### Message History and Pagination

```sql
-- PostgreSQL table for messages (partitioned by month for performance)
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES rooms(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Index for the primary access pattern: loading chat history
CREATE INDEX idx_messages_room_time ON messages (room_id, created_at DESC);

-- Cursor-based pagination (better than OFFSET for chat):
-- "Give me 50 messages in room X before timestamp Y"
SELECT id, user_id, content, message_type, created_at
FROM messages
WHERE room_id = $1 AND created_at < $2
ORDER BY created_at DESC
LIMIT 50;

-- The client passes the oldest message's timestamp as cursor for the next page
-- No OFFSET needed → consistent performance regardless of how deep they scroll
```

### Capacity Planning

```
1 million concurrent connections:
├── Each WebSocket connection: ~10-50 KB of memory
├── Per server (16 GB RAM): ~50,000 connections
├── Servers needed: 20 WS servers (with headroom)
├── Redis cluster: 3 nodes (for pub/sub and presence)
├── PostgreSQL: Primary + 2 read replicas
└── Messages per second: ~50,000 (at peak)

Cost drivers:
├── Bandwidth: Each message × number of recipients in room
├── Redis pub/sub: One publish per message per room
├── Database writes: Batched (500 messages per insert)
└── CPU: JSON parsing, authentication, message routing
```

---

## Performance Benchmarks and Limits

### Node.js WebSocket Limits (Single Process)

```
Connections:
├── Idle connections: 100,000+ (limited by file descriptors and memory)
├── Active connections (1 msg/sec each): ~50,000
├── High-frequency (10 msg/sec each): ~10,000
└── Limiting factor: CPU for JSON parse/stringify + event loop

Messages per second:
├── Small messages (< 100 bytes): ~200,000 msg/sec
├── Medium messages (1 KB): ~100,000 msg/sec
├── Large messages (10 KB): ~30,000 msg/sec
└── Limiting factor: Bandwidth and serialization

Optimization tips:
├── Use worker_threads for CPU-intensive processing
├── Use clustering (one process per CPU core)
├── Use binary protocols (MessagePack/Protobuf) for high-frequency data
├── Enable compression (permessage-deflate) for large messages
└── Use batching for database writes
```

### Compression

```javascript
// Enable per-message deflate compression
const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3  // Compression level (1=fast, 9=best compression)
    },
    threshold: 1024  // Only compress messages > 1KB
  }
});

// Compression reduces bandwidth by 60-80% for text data
// But adds CPU overhead - profile before enabling
// Don't use for already-compressed data (images, audio)
```

---

## Production Checklist

```
Connection Management:
□ Heartbeat/ping-pong implemented (30s interval)
□ Reconnection with exponential backoff + jitter
□ Connection state recovery (Socket.IO v4.6+ or custom)
□ Maximum connections per IP rate-limited
□ Graceful server shutdown (close code 1012)

Security:
□ WSS (TLS) only - no unencrypted ws://
□ Authentication on handshake (JWT or session)
□ Message validation and sanitization (prevent XSS)
□ Rate limiting per connection (token bucket)
□ Maximum message size enforced
□ Origin header validation
□ CORS configuration

Scaling:
□ Redis pub/sub or Streams for cross-server communication
□ Sticky sessions on load balancer
□ Connection pooling for database and Redis
□ Horizontal auto-scaling based on connection count

Monitoring:
□ Connected clients count (per server and total)
□ Messages per second (in and out)
□ Average message latency (send to deliver)
□ Error rates (connection failures, message errors)
□ Redis pub/sub lag
□ Memory usage per server
□ WebSocket frame errors

Reliability:
□ Graceful degradation (if Redis is down, local-only broadcast)
□ Message deduplication (idempotent processing)
□ Dead letter queue for failed messages
□ Health check endpoints for load balancer
□ Automated failover
```

---

## Key Takeaways

| Concept | What to Remember |
|---|---|
| Socket.IO vs ws | Socket.IO adds rooms, reconnection, fallbacks; ws is lighter |
| Authentication | Token in handshake, refresh for long-lived connections |
| Scaling | Redis pub/sub for cross-server broadcast; sticky sessions for LB |
| Backpressure | Check bufferedAmount; drop or batch for slow clients |
| Message ordering | Sequence numbers + acks + dedup on server |
| Presence | Redis SET with TTL; heartbeat refreshes TTL |
| Message storage | Batch inserts to PostgreSQL; cursor-based pagination |
| Performance | 50K connections per Node.js process; JSON is fine for most apps |

---

**Previous:** [← Blog 1 - WebSocket Fundamentals](./01-websockets-fundamentals.md)
**Next:** [Blog 3 - WebRTC Fundamentals →](./03-webrtc-fundamentals.md)
