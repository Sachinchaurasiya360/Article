# Blog 1: WebSockets Fundamentals & Real-time Basics

> Everything you need to understand WebSockets — from the HTTP handshake to building a working real-time chat system. No fluff, just the mechanics that matter.

---

## Table of Contents

- [Why Real-time Matters](#why-real-time-matters)
- [The Problem with HTTP](#the-problem-with-http)
- [What Are WebSockets](#what-are-websockets)
- [HTTP vs WebSockets — The Complete Comparison](#http-vs-websockets--the-complete-comparison)
- [The WebSocket Handshake (Under the Hood)](#the-websocket-handshake-under-the-hood)
- [WebSocket Connection Lifecycle](#websocket-connection-lifecycle)
- [Building a Real-time Chat System](#building-a-real-time-chat-system)
- [WebSocket Message Framing](#websocket-message-framing)
- [Handling Disconnects and Reconnection](#handling-disconnects-and-reconnection)
- [Common Mistakes and Pitfalls](#common-mistakes-and-pitfalls)
- [When NOT to Use WebSockets](#when-not-to-use-websockets)

---

## Why Real-time Matters

Modern applications don't wait for users to hit "refresh." When someone sends a message on Slack, their teammate sees it instantly. When a stock price changes, your trading dashboard updates immediately. When a player moves in a multiplayer game, every other player sees it within milliseconds.

This is **real-time communication** — and it fundamentally breaks the traditional request-response model the web was built on.

The technologies powering this are **WebSockets** and **WebRTC**. In this first blog, we'll master WebSockets from the ground up.

---

## The Problem with HTTP

HTTP was designed for a simple world: the client asks a question, the server answers. That's it.

```
Traditional HTTP:

Client ──GET /messages──►  Server
Client ◄──200 OK──────────  Server
         (connection closes)

Client ──GET /messages──►  Server   (30 seconds later, checking for new messages)
Client ◄──200 OK──────────  Server
         (connection closes)
```

When you need real-time updates, HTTP forces you into awkward patterns:

### Short Polling

The client repeatedly asks "anything new?" at fixed intervals.

```javascript
// Short Polling — the naive approach
setInterval(async () => {
  const response = await fetch('/api/messages?since=' + lastTimestamp);
  const messages = await response.json();
  if (messages.length > 0) {
    renderMessages(messages);
    lastTimestamp = messages[messages.length - 1].timestamp;
  }
}, 3000); // Poll every 3 seconds
```

**Problems:**
- 99% of requests return nothing new — wasted bandwidth
- 3-second delay between message sent and message seen
- Polling faster means more server load; polling slower means worse UX
- Each request carries full HTTP headers (~800 bytes) for maybe 0 bytes of useful data

### Long Polling

The server holds the request open until it has something to send.

```javascript
// Long Polling — better, but still awkward
async function longPoll() {
  try {
    const response = await fetch('/api/messages/subscribe', {
      signal: AbortSignal.timeout(30000) // 30-second timeout
    });
    const messages = await response.json();
    renderMessages(messages);
  } catch (err) {
    // Timeout or error — reconnect
  }
  // Immediately start next long poll
  longPoll();
}
longPoll();
```

**Better than short polling, but still:**
- Each message requires a full HTTP request-response cycle
- Server must manage a pool of held-open connections
- No true bidirectional communication
- Timeouts, proxy interference, and connection management add complexity

### Server-Sent Events (SSE)

The server can push data to the client over a single long-lived HTTP connection.

```javascript
// Server-Sent Events — good for one-way push
const eventSource = new EventSource('/api/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  renderMessage(data);
};

eventSource.onerror = () => {
  // Browser automatically reconnects
};
```

**SSE is genuinely useful for one-way streams** (live feeds, notifications, stock tickers), but it's **unidirectional** — the client can't send messages back over the same connection. For chat, collaborative editing, or gaming, you need something truly bidirectional.

---

## What Are WebSockets

WebSockets provide a **persistent, full-duplex communication channel** over a single TCP connection. Once established, both the client and server can send messages to each other at any time, with no request-response overhead.

```
WebSocket connection:

Client ──HTTP Upgrade Request──►  Server
Client ◄──101 Switching Protocols──  Server
         (TCP connection stays open)

Client ◄──────── message ─────────  Server    (server pushes anytime)
Client ──────── message ──────────► Server    (client sends anytime)
Client ◄──────── message ─────────  Server
Client ──────── message ──────────► Server
Client ◄──────── message ─────────  Server
         ...
         (stays open until either side closes)
```

**Key properties:**
- **Full-duplex:** Both sides send and receive simultaneously
- **Persistent:** One connection, no repeated handshakes
- **Low overhead:** After handshake, messages carry just 2-14 bytes of framing (vs ~800 bytes of HTTP headers)
- **Event-driven:** Messages arrive as events, no polling needed
- **Protocol:** `ws://` (unencrypted) or `wss://` (TLS encrypted, always use this in production)

---

## HTTP vs WebSockets — The Complete Comparison

| Aspect | HTTP | WebSockets |
|---|---|---|
| Communication | Request → Response (half-duplex) | Full-duplex (both directions simultaneously) |
| Connection | New connection per request (HTTP/1.1 keep-alive reuses TCP) | Single persistent connection |
| Who initiates | Client only | Either side, anytime |
| Overhead per message | ~800 bytes (headers) | 2-14 bytes (frame header) |
| Latency | Round-trip per message | Near-zero (connection already open) |
| Scalability | Stateless (easy to load balance) | Stateful (sticky sessions or pub/sub needed) |
| Caching | Yes (HTTP caching, CDN) | No (real-time data isn't cacheable) |
| Protocol | HTTP/1.1 or HTTP/2 | WebSocket protocol (RFC 6455) |
| Proxy support | Universal | Some older proxies struggle with Upgrade |
| Use cases | APIs, page loads, file downloads | Chat, gaming, live dashboards, collaboration |

**The critical insight:** HTTP is optimized for **content delivery** (cacheable, stateless, well-understood). WebSockets are optimized for **real-time interaction** (persistent, stateful, low-latency). They're not competing — they serve different purposes, and most production apps use both.

---

## The WebSocket Handshake (Under the Hood)

WebSockets start life as an HTTP request. The client sends an `Upgrade` request, and the server agrees to switch protocols. This is the **opening handshake**.

### Client Request

```http
GET /chat HTTP/1.1
Host: server.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: chat, superchat
Origin: http://example.com
```

**Key headers explained:**
- `Upgrade: websocket` — "I want to switch to WebSocket protocol"
- `Connection: Upgrade` — "This connection should be upgraded"
- `Sec-WebSocket-Key` — A random Base64-encoded 16-byte value. Used to prove the server understood the WebSocket protocol (not for security)
- `Sec-WebSocket-Version: 13` — The WebSocket protocol version (always 13 for RFC 6455)
- `Sec-WebSocket-Protocol` — Optional sub-protocols the client supports

### Server Response

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: chat
```

**How `Sec-WebSocket-Accept` is computed:**

```javascript
const crypto = require('crypto');

function computeAcceptKey(clientKey) {
  // Concatenate with the magic GUID (defined in RFC 6455)
  const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return crypto
    .createHash('sha1')
    .update(clientKey + MAGIC_GUID)
    .digest('base64');
}

// Example:
computeAcceptKey('dGhlIHNhbXBsZSBub25jZQ==');
// → 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='
```

This isn't encryption or authentication — it's a simple proof that the server speaks WebSocket protocol and isn't accidentally accepting the upgrade. **Real authentication should be done via cookies, tokens, or query parameters during the handshake.**

### What happens after the handshake

```
TCP Connection
│
├── HTTP Request  (GET /chat, Upgrade: websocket)
├── HTTP Response (101 Switching Protocols)
│
│   ── Protocol switches from HTTP to WebSocket ──
│
├── WebSocket Frame (client → server)
├── WebSocket Frame (server → client)
├── WebSocket Frame (client → server)
├── ...
├── Close Frame (either side)
└── TCP connection closes
```

The same TCP connection that carried the HTTP handshake now carries WebSocket frames. No new connection needed.

---

## WebSocket Connection Lifecycle

A WebSocket connection goes through four states:

```
CONNECTING (0)  →  OPEN (1)  →  CLOSING (2)  →  CLOSED (3)
                     │
                     │ (normal communication happens here)
                     │
                     ▼
              Messages flow freely
              in both directions
```

### Using the Browser WebSocket API

```javascript
// Connect
const ws = new WebSocket('wss://api.example.com/chat');

// Connection opened
ws.addEventListener('open', (event) => {
  console.log('Connected to server');
  ws.send(JSON.stringify({ type: 'join', room: 'general' }));
});

// Receive messages
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
});

// Handle errors
ws.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
});

// Connection closed
ws.addEventListener('close', (event) => {
  console.log(`Connection closed: code=${event.code}, reason=${event.reason}`);
  // event.code: 1000 = normal, 1006 = abnormal, 1001 = going away
  // event.wasClean: true if closed properly (close frame exchanged)
});

// Send a message (check readyState first!)
function sendMessage(message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket is not open. ReadyState:', ws.readyState);
  }
}

// Close gracefully
ws.close(1000, 'User logged out');
```

### Close Codes (Important for debugging)

| Code | Meaning |
|---|---|
| 1000 | Normal closure |
| 1001 | Going away (page navigating, server shutting down) |
| 1002 | Protocol error |
| 1003 | Unsupported data type |
| 1006 | Abnormal closure (no close frame received — usually network issue) |
| 1008 | Policy violation |
| 1009 | Message too large |
| 1011 | Unexpected server error |
| 1012 | Server restart |
| 1013 | Try again later |

---

## Building a Real-time Chat System

Let's build a working chat system from scratch using Node.js and the `ws` library.

### Project Setup

```bash
mkdir realtime-chat && cd realtime-chat
npm init -y
npm install ws express
```

### Server (server.js)

```javascript
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients with metadata
const clients = new Map();

// Generate unique IDs
let nextId = 1;
function generateId() {
  return `user_${nextId++}`;
}

wss.on('connection', (ws, request) => {
  const userId = generateId();
  const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

  // Store client metadata
  clients.set(ws, {
    id: userId,
    username: null,
    ip: ip,
    connectedAt: new Date(),
    isAlive: true
  });

  console.log(`[${userId}] Connected from ${ip}. Total clients: ${clients.size}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: `Welcome! Your ID is ${userId}. Send a "setUsername" message to set your name.`,
    userId: userId,
    timestamp: Date.now()
  }));

  // Handle incoming messages
  ws.on('message', (rawData) => {
    let data;
    try {
      data = JSON.parse(rawData.toString());
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON format'
      }));
      return;
    }

    const client = clients.get(ws);

    switch (data.type) {
      case 'setUsername':
        handleSetUsername(ws, client, data);
        break;

      case 'chat':
        handleChatMessage(ws, client, data);
        break;

      case 'typing':
        handleTypingIndicator(ws, client, data);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  });

  // Handle pong responses (for heartbeat)
  ws.on('pong', () => {
    const client = clients.get(ws);
    if (client) client.isAlive = true;
  });

  // Handle disconnection
  ws.on('close', (code, reason) => {
    const client = clients.get(ws);
    console.log(`[${client?.id}] Disconnected. Code: ${code}`);

    if (client?.username) {
      broadcast({
        type: 'system',
        message: `${client.username} left the chat`,
        timestamp: Date.now()
      }, ws);
    }

    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${userId}] Error:`, error.message);
  });
});

// --- Message Handlers ---

function handleSetUsername(ws, client, data) {
  if (!data.username || data.username.trim().length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Username cannot be empty' }));
    return;
  }

  const oldName = client.username;
  client.username = data.username.trim().slice(0, 30); // Limit length

  // Notify everyone
  broadcast({
    type: 'system',
    message: oldName
      ? `${oldName} changed their name to ${client.username}`
      : `${client.username} joined the chat`,
    timestamp: Date.now()
  });

  // Send confirmation to the user
  ws.send(JSON.stringify({
    type: 'usernameSet',
    username: client.username,
    timestamp: Date.now()
  }));
}

function handleChatMessage(ws, client, data) {
  if (!client.username) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Set your username first'
    }));
    return;
  }

  if (!data.content || data.content.trim().length === 0) {
    return; // Silently ignore empty messages
  }

  const message = {
    type: 'chat',
    userId: client.id,
    username: client.username,
    content: data.content.trim().slice(0, 2000), // Limit message length
    timestamp: Date.now()
  };

  // Broadcast to all connected clients (including sender)
  broadcast(message);
}

function handleTypingIndicator(ws, client, data) {
  if (!client.username) return;

  broadcast({
    type: 'typing',
    username: client.username,
    isTyping: data.isTyping
  }, ws); // Exclude sender
}

// --- Broadcast utility ---

function broadcast(message, excludeWs = null) {
  const payload = JSON.stringify(message);

  for (const [ws, client] of clients) {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

// --- Heartbeat (detect dead connections) ---

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const heartbeatTimer = setInterval(() => {
  for (const [ws, client] of clients) {
    if (!client.isAlive) {
      // Didn't respond to last ping — terminate
      console.log(`[${client.id}] Heartbeat timeout — terminating`);
      clients.delete(ws);
      ws.terminate();
      return;
    }

    client.isAlive = false;
    ws.ping(); // Client should respond with pong
  }
}, HEARTBEAT_INTERVAL);

// Clean up on server shutdown
wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

// --- Start server ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
```

### Client (public/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real-time Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; flex-direction: column; }
    #chat-container { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .message { padding: 8px 12px; border-radius: 8px; max-width: 70%; }
    .message.chat { background: #16213e; align-self: flex-start; }
    .message.chat.self { background: #0f3460; align-self: flex-end; }
    .message.system { background: transparent; color: #888; font-size: 0.85em; align-self: center; }
    .message .meta { font-size: 0.75em; color: #666; margin-top: 4px; }
    .message .username { font-weight: 600; color: #e94560; font-size: 0.85em; }
    #status { padding: 8px 16px; font-size: 0.85em; color: #888; }
    #input-area { display: flex; gap: 8px; padding: 16px; background: #16213e; }
    #input-area input { flex: 1; padding: 10px 14px; border: 1px solid #333; border-radius: 6px; background: #0f3460; color: #eee; font-size: 1em; }
    #input-area button { padding: 10px 20px; border: none; border-radius: 6px; background: #e94560; color: white; cursor: pointer; font-size: 1em; }
    #input-area button:hover { background: #c81e45; }
    #typing-indicator { padding: 4px 16px; font-size: 0.8em; color: #666; height: 24px; }
  </style>
</head>
<body>
  <div id="status">Connecting...</div>
  <div id="chat-container"></div>
  <div id="typing-indicator"></div>
  <div id="input-area">
    <input type="text" id="messageInput" placeholder="Type a message..." autocomplete="off" />
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('status');
    const typingEl = document.getElementById('typing-indicator');

    let ws;
    let myUserId = null;
    let myUsername = null;
    let typingTimeout = null;

    // ── Connection management ────────────────────────

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${location.host}`);

      ws.onopen = () => {
        statusEl.textContent = 'Connected — set your username';
        statusEl.style.color = '#4ecca3';

        // Prompt for username
        const name = prompt('Enter your username:');
        if (name) {
          ws.send(JSON.stringify({ type: 'setUsername', username: name }));
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
      };

      ws.onclose = (event) => {
        statusEl.textContent = `Disconnected (code: ${event.code}). Reconnecting...`;
        statusEl.style.color = '#e94560';
        // Reconnect after delay
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        statusEl.textContent = 'Connection error';
        statusEl.style.color = '#e94560';
      };
    }

    // ── Message handling ─────────────────────────────

    function handleMessage(data) {
      switch (data.type) {
        case 'system':
          if (data.userId) myUserId = data.userId;
          appendMessage(data.message, 'system');
          break;

        case 'usernameSet':
          myUsername = data.username;
          statusEl.textContent = `Connected as ${myUsername}`;
          break;

        case 'chat':
          const isSelf = data.userId === myUserId;
          appendChatMessage(data.username, data.content, data.timestamp, isSelf);
          break;

        case 'typing':
          showTypingIndicator(data.username, data.isTyping);
          break;

        case 'error':
          appendMessage(`Error: ${data.message}`, 'system');
          break;
      }
    }

    function appendMessage(text, type) {
      const div = document.createElement('div');
      div.className = `message ${type}`;
      div.textContent = text;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendChatMessage(username, content, timestamp, isSelf) {
      const div = document.createElement('div');
      div.className = `message chat ${isSelf ? 'self' : ''}`;
      div.innerHTML = `
        <div class="username">${escapeHtml(username)}</div>
        <div>${escapeHtml(content)}</div>
        <div class="meta">${new Date(timestamp).toLocaleTimeString()}</div>
      `;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // ── Typing indicator ─────────────────────────────

    const typingUsers = new Set();

    function showTypingIndicator(username, isTyping) {
      if (isTyping) {
        typingUsers.add(username);
      } else {
        typingUsers.delete(username);
      }

      if (typingUsers.size === 0) {
        typingEl.textContent = '';
      } else if (typingUsers.size === 1) {
        typingEl.textContent = `${[...typingUsers][0]} is typing...`;
      } else {
        typingEl.textContent = `${typingUsers.size} people are typing...`;
      }
    }

    // ── Send messages ────────────────────────────────

    function sendMessage() {
      const content = messageInput.value.trim();
      if (!content || ws.readyState !== WebSocket.OPEN) return;

      ws.send(JSON.stringify({ type: 'chat', content }));
      messageInput.value = '';

      // Stop typing indicator
      ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Send typing indicator on input
    messageInput.addEventListener('input', () => {
      if (ws.readyState !== WebSocket.OPEN) return;

      ws.send(JSON.stringify({ type: 'typing', isTyping: true }));

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
      }, 2000);
    });

    // ── Utilities ────────────────────────────────────

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ── Start ────────────────────────────────────────
    connect();
  </script>
</body>
</html>
```

### How It Works — Step by Step

```
1. Server starts HTTP server + WebSocket server on same port
2. Client loads index.html, creates WebSocket connection
3. Server assigns a user ID, stores client in the Map
4. Client sends { type: "setUsername", username: "Alice" }
5. Server broadcasts "Alice joined the chat" to all clients
6. Alice types a message → client sends { type: "chat", content: "Hello!" }
7. Server broadcasts the message to ALL connected clients
8. Every 30 seconds, server pings each client (heartbeat)
9. If a client doesn't pong back, server terminates the connection
10. On disconnection, client automatically reconnects after 3 seconds
```

### Architecture Diagram

```
                    ┌───────────────────────────────────┐
                    │          Node.js Server            │
                    │                                     │
                    │  ┌─────────────────────────────┐   │
 Browser A ◄══════►│  │  WebSocket Server (ws)       │   │
 (Alice)    WSS    │  │                               │   │
                    │  │  clients: Map<ws, metadata>   │   │
 Browser B ◄══════►│  │                               │   │
 (Bob)      WSS    │  │  broadcast(message)            │   │
                    │  │  heartbeat (30s interval)      │   │
 Browser C ◄══════►│  │                               │   │
 (Carol)    WSS    │  └─────────────────────────────┘   │
                    │                                     │
                    │  ┌─────────────────────────────┐   │
                    │  │  Express (HTTP) — static files│   │
                    │  └─────────────────────────────┘   │
                    └───────────────────────────────────┘
```

---

## WebSocket Message Framing

Once the handshake is complete, data flows as **frames**. Understanding the frame format helps debug issues and understand overhead.

```
WebSocket Frame Format:

 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |           (16/64)             |
|N|V|V|V|       |S|             |   (if payload len == 126/127) |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if payload len == 127   |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - - +
:                     Payload Data continued ...                 :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                     Payload Data (continued)                   |
+---------------------------------------------------------------+
```

**Key fields:**
- **FIN (1 bit):** Is this the final fragment of a message?
- **Opcode (4 bits):** 0x1 = text, 0x2 = binary, 0x8 = close, 0x9 = ping, 0xA = pong
- **MASK (1 bit):** Client→server frames MUST be masked. Server→client frames MUST NOT be masked.
- **Payload length:** 7 bits (0-125), or 126 + 16-bit length, or 127 + 64-bit length

**Overhead comparison:**

| Message size | HTTP overhead | WebSocket overhead |
|---|---|---|
| "hello" (5 bytes) | ~800 bytes headers | 2-6 bytes frame header |
| 100 bytes | ~800 bytes headers | 2-6 bytes frame header |
| 1 KB | ~800 bytes headers | 4-8 bytes frame header |
| 64 KB | ~800 bytes headers | 10-14 bytes frame header |

For small, frequent messages (chat, game state), WebSocket overhead is **100-400× less** than HTTP.

---

## Handling Disconnects and Reconnection

Connections drop. Networks fail. Servers restart. Your application must handle this gracefully.

### Robust Client-Side Reconnection

```javascript
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      maxRetries: Infinity,
      baseDelay: 1000,      // Start with 1 second
      maxDelay: 30000,      // Cap at 30 seconds
      backoffMultiplier: 2, // Exponential backoff
      jitter: true,         // Add randomness to prevent thundering herd
      ...options
    };

    this.retryCount = 0;
    this.intentionallyClosed = false;
    this.ws = null;

    // External event handlers
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = (event) => {
      console.log('WebSocket connected');
      this.retryCount = 0; // Reset retry counter on successful connection
      if (this.onopen) this.onopen(event);
    };

    this.ws.onmessage = (event) => {
      if (this.onmessage) this.onmessage(event);
    };

    this.ws.onclose = (event) => {
      if (this.onclose) this.onclose(event);

      if (!this.intentionallyClosed && this.retryCount < this.options.maxRetries) {
        const delay = this.getReconnectDelay();
        console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount + 1})`);
        setTimeout(() => {
          this.retryCount++;
          this.connect();
        }, delay);
      }
    };

    this.ws.onerror = (event) => {
      if (this.onerror) this.onerror(event);
    };
  }

  getReconnectDelay() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
    let delay = Math.min(
      this.options.baseDelay * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxDelay
    );

    // Add jitter (±25%) to prevent all clients reconnecting simultaneously
    if (this.options.jitter) {
      const jitterRange = delay * 0.25;
      delay += (Math.random() * jitterRange * 2) - jitterRange;
    }

    return Math.round(delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('Cannot send — WebSocket is not open');
    }
  }

  close(code = 1000, reason = '') {
    this.intentionallyClosed = true;
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

// Usage:
const ws = new ReconnectingWebSocket('wss://api.example.com/chat');

ws.onopen = () => console.log('Connected!');
ws.onmessage = (event) => console.log('Received:', event.data);
ws.onclose = (event) => console.log('Disconnected:', event.code);
```

### Why Exponential Backoff with Jitter Matters

```
Without jitter — thundering herd problem:
Server restarts at T=0
├── T=1s:  All 10,000 clients reconnect simultaneously → server overloaded again
├── T=2s:  All retry again → overloaded again
└── System never recovers

With exponential backoff + jitter:
Server restarts at T=0
├── T=0.8s:  ~200 clients reconnect
├── T=1.2s:  ~300 clients reconnect
├── T=1.8s:  ~250 clients reconnect
├── T=2.5s:  ~500 clients reconnect
├── ...spread over 30 seconds...
└── Server handles load gradually
```

### Server-Side Heartbeat (Detecting Dead Connections)

TCP connections can go "half-open" — one side thinks it's connected, but the other side has disappeared (client crashed, network changed, etc.). TCP keepalive exists but operates on much longer timescales (minutes to hours).

WebSocket ping/pong solves this at the application level:

```javascript
// Server-side heartbeat implementation
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 35000;     // Give 5s grace for pong response

function setupHeartbeat(wss) {
  setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        console.log('Client heartbeat timeout — terminating');
        client.terminate(); // Hard close (no close frame)
        return;
      }

      client.isAlive = false;
      client.ping(); // Send ping frame
    }
  }, HEARTBEAT_INTERVAL);
}

// On each new connection:
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; }); // Pong received → still alive
});
```

**Note:** The browser WebSocket API automatically responds to ping frames with pong frames. You don't need to handle this in client-side JavaScript — it happens at the protocol level.

---

## Common Mistakes and Pitfalls

### 1. Not Checking readyState Before Sending

```javascript
// ❌ Crashes if connection isn't open
ws.send(JSON.stringify({ type: 'chat', content: 'hello' }));

// ✅ Always check readyState
if (ws.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({ type: 'chat', content: 'hello' }));
}
```

### 2. Sending Before the Connection is Open

```javascript
// ❌ The connection isn't open yet!
const ws = new WebSocket('wss://example.com');
ws.send('hello'); // Throws an error

// ✅ Wait for the open event
const ws = new WebSocket('wss://example.com');
ws.onopen = () => {
  ws.send('hello'); // Now it's safe
};
```

### 3. No Message Validation on the Server

```javascript
// ❌ Trust incoming data blindly
ws.on('message', (data) => {
  const msg = JSON.parse(data); // Crashes on invalid JSON
  db.query(`INSERT INTO messages (content) VALUES ('${msg.content}')`); // SQL injection!
});

// ✅ Validate everything
ws.on('message', (rawData) => {
  let data;
  try {
    data = JSON.parse(rawData.toString());
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  if (typeof data.content !== 'string' || data.content.length > 2000) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    return;
  }

  // Use parameterized queries
  db.query('INSERT INTO messages (content) VALUES ($1)', [data.content]);
});
```

### 4. No Rate Limiting

```javascript
// Without rate limiting, one client can flood the server
// Simple token bucket rate limiter per connection:

function createRateLimiter(maxTokens, refillRate) {
  let tokens = maxTokens;

  setInterval(() => {
    tokens = Math.min(maxTokens, tokens + refillRate);
  }, 1000);

  return {
    tryConsume() {
      if (tokens > 0) {
        tokens--;
        return true;
      }
      return false;
    }
  };
}

wss.on('connection', (ws) => {
  const limiter = createRateLimiter(10, 5); // 10 burst, 5 per second

  ws.on('message', (data) => {
    if (!limiter.tryConsume()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limited. Slow down.' }));
      return;
    }
    // Process message normally
  });
});
```

### 5. Memory Leaks from Uncleaned Connections

```javascript
// ❌ Adding to a Set but never removing
const connections = new Set();
wss.on('connection', (ws) => {
  connections.add(ws);
  // If ws.on('close') never removes it, the Set grows forever
});

// ✅ Always clean up on close
wss.on('connection', (ws) => {
  connections.add(ws);
  ws.on('close', () => {
    connections.delete(ws);
  });
});
```

### 6. Not Using WSS (Encrypted WebSockets) in Production

```javascript
// ❌ Unencrypted — data visible to anyone on the network
new WebSocket('ws://api.example.com/chat');

// ✅ Always use wss:// in production (TLS encrypted)
new WebSocket('wss://api.example.com/chat');
```

Without TLS: proxies and firewalls may block or corrupt WebSocket traffic. Many corporate networks actively interfere with non-TLS WebSocket connections.

---

## When NOT to Use WebSockets

WebSockets aren't always the right tool:

| Scenario | Better Alternative | Why |
|---|---|---|
| Fetching data once (API call) | HTTP REST/GraphQL | Request-response is simpler, cacheable |
| Server-only push (notifications, feeds) | Server-Sent Events (SSE) | Simpler, auto-reconnect, HTTP/2 compatible |
| File uploads | HTTP multipart/form-data | Designed for this, supports resumable uploads |
| Occasional updates (every 30+ seconds) | Short polling or SSE | WebSocket overhead not justified |
| Microservice-to-microservice | gRPC, message queues | Better tooling for service communication |
| Public API | REST | Universal support, caching, documentation |

**Use WebSockets when you need:**
- Bidirectional real-time communication
- Low-latency message delivery (< 100ms)
- High-frequency updates (multiple per second)
- Persistent connection state (who's online, typing indicators)

---

## Key Takeaways

| Concept | What to Remember |
|---|---|
| WebSocket vs HTTP | HTTP = request-response, WebSocket = persistent bidirectional |
| Handshake | Starts as HTTP Upgrade, server responds 101, then protocol switches |
| Frame overhead | 2-14 bytes vs ~800 bytes for HTTP headers |
| Close codes | 1000 = normal, 1006 = abnormal (most common in debugging) |
| Heartbeat | Ping/pong every 30s to detect dead connections |
| Reconnection | Exponential backoff + jitter to prevent thundering herd |
| Security | Always use `wss://`, validate all input, rate limit messages |
| Alternatives | SSE for one-way push, REST for request-response |

---

**Next:** [Blog 2 — Advanced WebSockets & Scaling Real-time Systems →](./02-advanced-websockets.md)
