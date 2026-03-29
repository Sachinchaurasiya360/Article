# Blog 3: WebRTC Fundamentals - Peer-to-Peer Communication

> WebRTC lets browsers talk directly to each other - no server in the middle for audio, video, and data. But setting it up requires understanding signaling, ICE candidates, STUN/TURN servers, and NAT traversal. This blog explains all of it.

---

## Table of Contents

- [What is WebRTC](#what-is-webrtc)
- [WebRTC vs WebSockets - Different Tools for Different Jobs](#webrtc-vs-websockets--different-tools-for-different-jobs)
- [The WebRTC Architecture](#the-webrtc-architecture)
- [Signaling - The Part WebRTC Doesn't Handle](#signaling--the-part-webrtc-doesnt-handle)
- [ICE, STUN, and TURN - NAT Traversal Explained](#ice-stun-and-turn--nat-traversal-explained)
- [The Connection Process Step by Step](#the-connection-process-step-by-step)
- [Media Streams - Capturing Audio and Video](#media-streams--capturing-audio-and-video)
- [Data Channels - Sending Arbitrary Data P2P](#data-channels--sending-arbitrary-data-p2p)
- [Building a 1-to-1 Video Call](#building-a-1-to-1-video-call)
- [Common Mistakes and Debugging](#common-mistakes-and-debugging)

---

## What is WebRTC

**WebRTC (Web Real-Time Communication)** is a set of browser APIs and protocols that enable **peer-to-peer** audio, video, and data transfer directly between browsers - without routing media through a server.

```
Traditional client-server (WebSocket):

  Alice's Browser ──── Server ──── Bob's Browser
       All data flows through the server

WebRTC peer-to-peer:

  Alice's Browser ◄─────────────────► Bob's Browser
       Media flows directly between browsers
       (server only used for initial setup)
```

**Why does this matter?**

| Aspect | Server-relayed | Peer-to-peer (WebRTC) |
|---|---|---|
| Latency | Higher (2 hops: client→server→client) | Lower (1 hop: client→client) |
| Server bandwidth | Massive (all media through server) | Near-zero (media bypasses server) |
| Server cost | $$$$ (bandwidth is expensive) | $ (only signaling traffic) |
| Quality | Limited by server bandwidth | Limited by peer bandwidth |
| Privacy | Server can see all media | End-to-end encrypted by default |
| Scale | Limited by server capacity | Each peer handles its own connections |

**What WebRTC includes:**

```
WebRTC APIs and Protocols:

┌──────────────────────────────────────────────────────┐
│                    Browser APIs                       │
│                                                       │
│  getUserMedia()        - Capture camera/microphone    │
│  RTCPeerConnection     - Manage P2P connection        │
│  RTCDataChannel        - Send arbitrary data P2P      │
│  getDisplayMedia()     - Screen sharing               │
│  MediaStream           - Represent audio/video tracks │
└───────────────────────────────┬───────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────┐
│                  Under the Hood                        │
│                                                        │
│  ICE Framework        - Find the best connection path  │
│  STUN                 - Discover your public IP        │
│  TURN                 - Relay when direct fails        │
│  DTLS                 - Encryption for data            │
│  SRTP                 - Encryption for media           │
│  SDP                  - Describe media capabilities    │
│  RTP/RTCP             - Media transport + quality      │
│  SCTP                 - Data channel transport         │
└────────────────────────────────────────────────────────┘
```

**Key insight: WebRTC provides the transport, but NOT the signaling.** You still need a server (WebSocket, HTTP, or even carrier pigeon) to coordinate the initial connection setup.

---

## WebRTC vs WebSockets - Different Tools for Different Jobs

This is the most common interview question about WebRTC. Here's the definitive comparison:

```
WebSockets:                          WebRTC:
Client ◄───► Server ◄───► Client     Client ◄──────────────► Client
       (server in the middle)              (direct connection)
```

| Feature | WebSockets | WebRTC |
|---|---|---|
| Connection type | Client ↔ Server | Peer ↔ Peer |
| Transport | TCP | UDP (media), SCTP (data channels) |
| Latency | Low (~50-100ms) | Ultra-low (~10-50ms) |
| Reliability | Guaranteed delivery (TCP) | Best-effort for media; reliable option for data channels |
| Encryption | TLS (wss://) | DTLS/SRTP mandatory - always encrypted |
| Media support | Manual (send bytes) | Native (audio, video, screen share) |
| NAT traversal | Not needed (server has public IP) | Required (ICE, STUN, TURN) |
| Setup complexity | Simple | Complex (signaling, ICE, SDP) |
| Server involvement | Always (server is an endpoint) | Only for signaling; media is P2P |
| Use cases | Chat, notifications, live updates | Video calls, voice chat, P2P file transfer |

### They Work Together

In most real-world applications, you use **both**:

```
WebSocket:  Signaling, chat messages, presence, notifications
            (anything that goes through a server)

WebRTC:     Audio/video streams, screen sharing, P2P data transfer
            (anything that should be peer-to-peer)

Example - Video conferencing app:
├── WebSocket: Exchange SDP offers/answers (signaling)
├── WebSocket: Chat messages alongside the call
├── WebSocket: Participant join/leave notifications
├── WebRTC:   Audio stream (peer-to-peer)
├── WebRTC:   Video stream (peer-to-peer)
└── WebRTC:   Screen share stream (peer-to-peer)
```

---

## The WebRTC Architecture

```
                    ┌──────────────────────┐
                    │   Signaling Server   │
                    │   (WebSocket/HTTP)   │
                    └───────┬──────┬───────┘
                     SDP    │      │   SDP
                   Offer    │      │  Answer
                   + ICE    │      │  + ICE
                            │      │
                    ┌───────▼──┐ ┌─▼────────┐
                    │  Alice   │ │   Bob     │
                    │ (Browser)│ │ (Browser) │
                    └───┬──────┘ └──────┬───┘
                        │              │
                        │   STUN/TURN  │
                        │   ┌──────┐   │
                        └──►│STUN/ ├◄──┘
                            │TURN  │
                            │Server│
                            └──────┘
                                │
                    After ICE completes:
                                │
                    ┌───────────▼───────────┐
                    │  Direct P2P connection │
                    │  (or relayed via TURN) │
                    │                        │
                    │  Alice ◄══════════► Bob│
                    │  Audio, Video, Data    │
                    │  (SRTP + SCTP)         │
                    └────────────────────────┘
```

**Three distinct phases:**

```
Phase 1: Signaling (via your server)
├── Exchange SDP descriptions (what media capabilities each peer has)
├── Exchange ICE candidates (how to reach each peer)
└── All happens over WebSocket or HTTP - your choice

Phase 2: Connection Establishment (ICE)
├── Try to connect directly (host candidates)
├── If that fails, try via STUN (discover public IP)
├── If that fails, relay via TURN (guaranteed but adds latency)
└── ICE picks the best available path

Phase 3: Media/Data Flow (P2P)
├── Audio/video via SRTP (encrypted RTP)
├── Data channels via SCTP over DTLS
└── No server involvement (unless TURN relay)
```

---

## Signaling - The Part WebRTC Doesn't Handle

WebRTC deliberately does **not** define how peers discover each other and exchange connection information. This is called **signaling**, and you must implement it yourself.

### What Gets Exchanged During Signaling

**1. SDP (Session Description Protocol):**

SDP describes what a peer can send and receive - codecs, media types, encryption parameters, etc.

```
Example SDP (simplified):

v=0
o=- 7614219274584779017 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2          ← Audio codec: Opus at 48kHz
a=fmtp:111 minptime=10;useinbandfec=1
a=rtcp-mux
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98
c=IN IP4 0.0.0.0
a=rtpmap:96 VP8/90000              ← Video codec: VP8
a=rtpmap:97 rtx/90000
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtcp-fb:96 goog-remb            ← Bandwidth estimation
```

**2. ICE Candidates:**

ICE candidates are potential network addresses where a peer can be reached.

```
Types of ICE candidates:

host:      192.168.1.100:54321     (local network address)
srflx:     203.0.113.50:12345      (public IP discovered via STUN)
relay:     198.51.100.10:3478      (TURN server relay address)
```

### Signaling Flow

```
Alice (Caller)                Signaling Server              Bob (Callee)
     │                             │                             │
     │──1. Create Offer ──►        │                             │
     │   (SDP describing           │                             │
     │    Alice's capabilities)    │                             │
     │                             │──2. Forward Offer──────────►│
     │                             │                             │
     │                             │                  3. Create Answer
     │                             │                  (SDP describing
     │                             │                   Bob's capabilities)
     │                             │◄──4. Forward Answer────────│
     │◄──5. Answer received ──     │                             │
     │                             │                             │
     │──6. ICE Candidate ──►       │──7. Forward──────────────►│
     │                             │                             │
     │                             │◄──8. ICE Candidate────────│
     │◄──9. Forward ──             │                             │
     │                             │                             │
     │   (ICE candidates continue to trickle in both directions) │
     │                             │                             │
     │◄═══════════════ 10. P2P Connection Established ══════════►│
     │          (signaling server no longer needed for media)     │
```

### Implementing Signaling with WebSocket

```javascript
// Signaling server (Node.js)
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });

const rooms = new Map(); // roomId → Set<ws>

wss.on('connection', (ws) => {
  ws.on('message', (rawData) => {
    const data = JSON.parse(rawData.toString());

    switch (data.type) {
      case 'join': {
        const { roomId } = data;
        ws.roomId = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(ws);

        // Notify others in the room
        for (const peer of rooms.get(roomId)) {
          if (peer !== ws && peer.readyState === peer.OPEN) {
            peer.send(JSON.stringify({
              type: 'peer-joined',
              peerId: data.peerId
            }));
          }
        }
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        // Forward signaling messages to the target peer
        const room = rooms.get(ws.roomId);
        if (room) {
          for (const peer of room) {
            if (peer !== ws && peer.readyState === peer.OPEN) {
              peer.send(JSON.stringify(data));
            }
          }
        }
        break;
      }

      case 'leave': {
        const room = rooms.get(ws.roomId);
        if (room) {
          room.delete(ws);
          for (const peer of room) {
            if (peer.readyState === peer.OPEN) {
              peer.send(JSON.stringify({
                type: 'peer-left',
                peerId: data.peerId
              }));
            }
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId);
    if (room) {
      room.delete(ws);
    }
  });
});

console.log('Signaling server running on ws://localhost:8080');
```

---

## ICE, STUN, and TURN - NAT Traversal Explained

### The Problem: NAT

Most devices sit behind a **NAT (Network Address Translation)** router. Your device has a private IP (e.g., 192.168.1.100), but the outside world sees the router's public IP (e.g., 203.0.113.50).

```
Alice's Home Network:                    The Internet:

┌──────────────────────┐
│ Alice's Laptop       │
│ 192.168.1.100        │──►  Router (NAT)  ──►  203.0.113.50
│ (private IP)         │     ↕ translates        (public IP)
└──────────────────────┘     addresses

Bob can't send packets to 192.168.1.100 - that's a private address.
Bob needs to know 203.0.113.50:PORT - but which port?
The NAT maps internal IPs to external ports dynamically.
```

**NAT types (from easiest to hardest for WebRTC):**

```
Full Cone NAT:
├── Once a port mapping exists, ANYONE can send to that external port
├── Easiest for P2P
└── Rare in modern networks

Restricted Cone NAT:
├── External host can only reply if internal host has sent to that HOST first
├── Common in home routers
└── Works with STUN

Port-Restricted Cone NAT:
├── External host can only reply if internal host has sent to that HOST:PORT first
├── More restrictive
└── Usually works with STUN

Symmetric NAT:
├── Each connection gets a DIFFERENT external port
├── STUN doesn't help (port is different for each destination)
├── Requires TURN relay
└── Common in corporate networks and mobile carriers
```

### STUN (Session Traversal Utilities for NAT)

STUN is simple: "Hey STUN server, what's my public IP and port?"

```
Alice (behind NAT)                 STUN Server (public)
       │                                │
       │──── Request ──────────────────►│
       │     "What's my public address?"│
       │                                │
       │◄──── Response ────────────────│
       │     "You're at                 │
       │      203.0.113.50:54321"       │
       │                                │

Alice now knows her public-facing address and can share it via signaling.
```

```javascript
// STUN is configured when creating the RTCPeerConnection:
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },  // Free Google STUN
    { urls: 'stun:stun1.l.google.com:19302' }   // Backup
  ]
});
```

**STUN is free, fast, and lightweight.** It works for ~85% of connections. The remaining ~15% need TURN.

### TURN (Traversal Using Relays around NAT)

When direct P2P fails (symmetric NAT, strict firewalls), TURN acts as a **relay** - all media flows through the TURN server.

```
Without TURN (direct P2P):
Alice ◄════════════════════════► Bob
      Direct, lowest latency

With TURN (relayed):
Alice ◄════► TURN Server ◄════► Bob
      Higher latency, bandwidth cost on TURN server,
      but guaranteed to work
```

```javascript
// TURN server configuration
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user123',
      credential: 'password123'
    },
    {
      urls: 'turns:turn.example.com:443',  // TURN over TLS (works through firewalls)
      username: 'user123',
      credential: 'password123'
    }
  ]
});
```

**TURN is expensive** - it handles all media bandwidth for connections that can't go direct. Budget for it:

```
TURN server costs:
├── Bandwidth: A 720p video call uses ~1.5 Mbps each way = ~3 Mbps per call
├── 1000 concurrent calls via TURN = 3 Gbps bandwidth
├── Monthly cost at $0.09/GB: ~$29,000/month for 1000 concurrent relayed calls
└── This is why you ALWAYS try STUN first, TURN is the fallback

TURN providers:
├── Twilio (Network Traversal Service)
├── Xirsys
├── Self-hosted: coturn (open source)
└── Cloudflare Calls (newer option)
```

### ICE (Interactive Connectivity Establishment)

ICE is the framework that orchestrates the entire NAT traversal process. It gathers candidates from multiple sources and tries them systematically.

```
ICE Candidate Gathering:

1. Host candidates:     Local IP addresses (works if both peers on same network)
2. Server Reflexive:    Public IP from STUN (works through most NATs)
3. Relay candidates:    TURN server address (always works, highest latency)

ICE tries them in order of priority (host > srflx > relay):

Alice's candidates:          Bob's candidates:
├── host: 192.168.1.100     ├── host: 10.0.0.50
├── srflx: 203.0.113.50     ├── srflx: 198.51.100.25
└── relay: turn.example.com └── relay: turn.example.com

ICE connectivity checks (tries all pairs):
Alice:host     ↔ Bob:host        ❌ (different private networks)
Alice:host     ↔ Bob:srflx       ❌ (Alice's private IP can't reach Bob's public)
Alice:srflx    ↔ Bob:srflx       ✅ (both public IPs - works!)
Alice:srflx    ↔ Bob:host        ❌
Alice:relay    ↔ Bob:relay       ✅ (always works via TURN)

ICE picks the BEST working pair (srflx ↔ srflx in this case).
```

### Trickle ICE

In the original ICE spec, all candidates were gathered before creating the offer/answer. **Trickle ICE** sends candidates as they're discovered, reducing setup time:

```
Without Trickle ICE (slow):
Gather ALL candidates (2-10 seconds) → Create offer with all candidates → Send

With Trickle ICE (fast):
Create offer immediately → Send → Trickle candidates as they're discovered
├── 50ms:   Host candidate discovered → send immediately
├── 200ms:  STUN reflexive candidate → send immediately
├── 1000ms: TURN relay candidate → send immediately
└── Connection may establish before all candidates are gathered!
```

---

## The Connection Process Step by Step

Here's the complete WebRTC connection flow with code:

### Step 1: Create RTCPeerConnection

```javascript
// Both Alice and Bob create a peer connection with the same config
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
};

const peerConnection = new RTCPeerConnection(configuration);
```

### Step 2: Add Local Media Tracks

```javascript
// Alice captures her camera and microphone
const localStream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 },
  audio: true
});

// Display local video
localVideo.srcObject = localStream;

// Add tracks to the peer connection
localStream.getTracks().forEach(track => {
  peerConnection.addTrack(track, localStream);
});
```

### Step 3: Handle Remote Tracks

```javascript
// When remote tracks arrive, display them
peerConnection.ontrack = (event) => {
  const [remoteStream] = event.streams;
  remoteVideo.srcObject = remoteStream;
};
```

### Step 4: ICE Candidate Handling

```javascript
// As ICE candidates are discovered, send them to the other peer via signaling
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    signalingChannel.send(JSON.stringify({
      type: 'ice-candidate',
      candidate: event.candidate
    }));
  }
};

// Monitor ICE connection state
peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE state:', peerConnection.iceConnectionState);
  // States: new → checking → connected → completed → disconnected → failed → closed
};
```

### Step 5: Create and Exchange SDP Offer/Answer

```javascript
// === ALICE (Caller) ===

// Create offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

// Send offer to Bob via signaling server
signalingChannel.send(JSON.stringify({
  type: 'offer',
  sdp: peerConnection.localDescription
}));

// === BOB (Callee) ===

// Receive offer from Alice
signalingChannel.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'offer') {
    // Set Alice's offer as remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer back to Alice
    signalingChannel.send(JSON.stringify({
      type: 'answer',
      sdp: peerConnection.localDescription
    }));
  }

  if (data.type === 'answer') {
    // Alice receives Bob's answer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  }

  if (data.type === 'ice-candidate') {
    // Add received ICE candidate
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};
```

### Connection State Machine

```
                    Caller (Alice)                         Callee (Bob)
                         │                                      │
    createOffer()        │                                      │
    setLocalDescription()│                                      │
                         │──── SDP Offer ─────────────────────►│
                         │     (via signaling)                  │
                         │                          setRemoteDescription()
                         │                          createAnswer()
                         │                          setLocalDescription()
                         │◄──── SDP Answer ────────────────────│
                         │      (via signaling)                 │
    setRemoteDescription()                                      │
                         │                                      │
                         │◄──── ICE Candidates ───────────────►│
                         │      (trickle, both directions)      │
                         │                                      │
                         │      ICE connectivity checks         │
                         │      (STUN/TURN if needed)           │
                         │                                      │
                         │◄══════ P2P ESTABLISHED ═════════════►│
                         │     Media flows directly             │
```

---

## Media Streams - Capturing Audio and Video

### getUserMedia - Camera and Microphone

```javascript
// Basic capture
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Detailed constraints
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user'  // 'user' = front camera, 'environment' = back camera
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000
  }
});

// Display local video (muted to prevent echo)
const localVideo = document.getElementById('localVideo');
localVideo.srcObject = stream;
localVideo.muted = true; // Important! Prevent audio feedback
```

### getDisplayMedia - Screen Sharing

```javascript
// Capture screen (user picks which screen/window/tab)
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    cursor: 'always',           // Show cursor in capture
    displaySurface: 'monitor'   // Prefer full screen
  },
  audio: true  // Capture system audio (Chrome only, user must enable)
});

// Detect when user stops sharing
screenStream.getVideoTracks()[0].onended = () => {
  console.log('User stopped screen sharing');
  // Switch back to camera
};
```

### Switching Tracks Mid-Call

```javascript
// Replace camera track with screen share (without renegotiation)
async function switchToScreenShare() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];

  // Find the video sender
  const videoSender = peerConnection.getSenders().find(
    sender => sender.track && sender.track.kind === 'video'
  );

  // Replace the track (no renegotiation needed!)
  await videoSender.replaceTrack(screenTrack);

  // When user stops sharing, switch back to camera
  screenTrack.onended = async () => {
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    await videoSender.replaceTrack(cameraStream.getVideoTracks()[0]);
  };
}
```

### Mute/Unmute Without Renegotiation

```javascript
// Toggle audio
function toggleMute() {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  // enabled = false → track still sends, but with silence
  // This is better than removing the track (which requires renegotiation)
}

// Toggle video
function toggleVideo() {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  // enabled = false → sends black frames
}
```

---

## Data Channels - Sending Arbitrary Data P2P

WebRTC isn't just for audio/video. **Data channels** let you send any data peer-to-peer - text, files, game state, whatever.

### Creating a Data Channel

```javascript
// === ALICE (creates the data channel) ===
const dataChannel = peerConnection.createDataChannel('chat', {
  ordered: true,           // Guarantee message order (default: true)
  maxRetransmits: 3,       // Max retries for lost packets (use with ordered: false)
  // OR:
  // maxPacketLifeTime: 3000, // Max ms to try delivering (can't use both)
});

dataChannel.onopen = () => {
  console.log('Data channel open!');
  dataChannel.send('Hello from Alice!');
};

dataChannel.onmessage = (event) => {
  console.log('Received:', event.data);
};

dataChannel.onclose = () => {
  console.log('Data channel closed');
};

// === BOB (receives the data channel) ===
peerConnection.ondatachannel = (event) => {
  const dataChannel = event.channel;

  dataChannel.onopen = () => {
    console.log('Data channel open!');
  };

  dataChannel.onmessage = (event) => {
    console.log('Received:', event.data);
    dataChannel.send('Hello back from Bob!');
  };
};
```

### Data Channel Configuration Options

```javascript
// Reliable and ordered (like TCP) - default
const reliableChannel = peerConnection.createDataChannel('reliable', {
  ordered: true
  // No maxRetransmits or maxPacketLifeTime = unlimited retries
});
// Use for: chat messages, file transfer, game commands

// Unreliable and unordered (like UDP) - lowest latency
const unreliableChannel = peerConnection.createDataChannel('gameState', {
  ordered: false,
  maxRetransmits: 0  // Don't retry lost packets
});
// Use for: real-time game positions, cursor tracking, live sensor data

// Partially reliable - retry up to N times
const partialChannel = peerConnection.createDataChannel('video-meta', {
  ordered: true,
  maxRetransmits: 3
});
// Use for: non-critical metadata where some loss is OK
```

### File Transfer Over Data Channel

```javascript
// Send a file in chunks
async function sendFile(dataChannel, file) {
  const CHUNK_SIZE = 16384; // 16KB chunks (safe for all browsers)
  const reader = file.stream().getReader();

  // Send file metadata first
  dataChannel.send(JSON.stringify({
    type: 'file-start',
    name: file.name,
    size: file.size,
    mimeType: file.type
  }));

  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Send chunk by chunk
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      const chunk = value.slice(i, i + CHUNK_SIZE);

      // Wait if the buffer is getting full (backpressure)
      while (dataChannel.bufferedAmount > 1024 * 1024) { // 1MB buffer
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      dataChannel.send(chunk);
      offset += chunk.length;
    }
  }

  dataChannel.send(JSON.stringify({ type: 'file-end' }));
}

// Receive a file
let incomingFile = null;
let receivedChunks = [];

dataChannel.onmessage = (event) => {
  if (typeof event.data === 'string') {
    const meta = JSON.parse(event.data);

    if (meta.type === 'file-start') {
      incomingFile = meta;
      receivedChunks = [];
      console.log(`Receiving file: ${meta.name} (${meta.size} bytes)`);
    }

    if (meta.type === 'file-end') {
      const blob = new Blob(receivedChunks, { type: incomingFile.mimeType });
      const url = URL.createObjectURL(blob);
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = incomingFile.name;
      a.click();
      console.log('File received!');
    }
  } else {
    // Binary chunk
    receivedChunks.push(event.data);
  }
};
```

---

## Building a 1-to-1 Video Call

Putting it all together - a complete 1-to-1 video call with signaling.

### Complete Client Code

```javascript
class VideoCall {
  constructor(signalingUrl, roomId) {
    this.roomId = roomId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;

    // Connect to signaling server
    this.ws = new WebSocket(signalingUrl);
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'join', roomId }));
    };
    this.ws.onmessage = (event) => this.handleSignalingMessage(JSON.parse(event.data));
  }

  // Step 1: Get local media
  async startLocalStream(videoEl) {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });
    videoEl.srcObject = this.localStream;
    videoEl.muted = true;
  }

  // Step 2: Create peer connection
  createPeerConnection(remoteVideoEl) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
      ]
    });

    // Add local tracks
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      remoteVideoEl.srcObject = this.remoteStream;
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Connection state:', state);
      if (state === 'failed') {
        // Attempt ICE restart
        this.restartIce();
      }
    };
  }

  // Step 3: Initiate call (caller side)
  async call(remoteVideoEl) {
    this.createPeerConnection(remoteVideoEl);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.ws.send(JSON.stringify({
      type: 'offer',
      sdp: this.peerConnection.localDescription
    }));
  }

  // Handle signaling messages
  async handleSignalingMessage(data) {
    switch (data.type) {
      case 'peer-joined':
        console.log('Peer joined - initiating call');
        await this.call(document.getElementById('remoteVideo'));
        break;

      case 'offer':
        console.log('Received offer');
        if (!this.peerConnection) {
          this.createPeerConnection(document.getElementById('remoteVideo'));
        }
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.ws.send(JSON.stringify({
          type: 'answer',
          sdp: this.peerConnection.localDescription
        }));
        break;

      case 'answer':
        console.log('Received answer');
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
        break;

      case 'ice-candidate':
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
        break;

      case 'peer-left':
        console.log('Peer left');
        this.hangUp();
        break;
    }
  }

  // ICE restart (recover from network changes)
  async restartIce() {
    const offer = await this.peerConnection.createOffer({ iceRestart: true });
    await this.peerConnection.setLocalDescription(offer);
    this.ws.send(JSON.stringify({
      type: 'offer',
      sdp: this.peerConnection.localDescription
    }));
  }

  // Mute/unmute
  toggleAudio() {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    return audioTrack?.enabled;
  }

  toggleVideo() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
    return videoTrack?.enabled;
  }

  // End call
  hangUp() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    this.ws.send(JSON.stringify({ type: 'leave', roomId: this.roomId }));
  }
}

// Usage:
const call = new VideoCall('wss://signaling.example.com', 'room-123');
await call.startLocalStream(document.getElementById('localVideo'));
// When peer joins, call is initiated automatically via signaling
```

---

## Common Mistakes and Debugging

### 1. Forgetting to Handle the Callee Side

```javascript
// ❌ Only handling the caller's offer creation
// The callee must also create an answer!

// ✅ Both sides need proper SDP handling:
// Caller: createOffer → setLocalDescription → send offer
// Callee: receive offer → setRemoteDescription → createAnswer → setLocalDescription → send answer
// Caller: receive answer → setRemoteDescription
```

### 2. Adding ICE Candidates Before Remote Description

```javascript
// ❌ This throws an error
peerConnection.addIceCandidate(candidate);
// Error: Cannot add ICE candidate before remote description

// ✅ Queue candidates if remote description isn't set yet
const candidateQueue = [];

async function addIceCandidate(candidate) {
  if (peerConnection.remoteDescription) {
    await peerConnection.addIceCandidate(candidate);
  } else {
    candidateQueue.push(candidate);
  }
}

// After setting remote description, flush the queue
async function setRemoteDescription(sdp) {
  await peerConnection.setRemoteDescription(sdp);
  for (const candidate of candidateQueue) {
    await peerConnection.addIceCandidate(candidate);
  }
  candidateQueue.length = 0;
}
```

### 3. Not Handling ICE Connection Failures

```javascript
// ❌ Ignoring connection state changes

// ✅ Monitor and react to ICE failures
peerConnection.oniceconnectionstatechange = () => {
  switch (peerConnection.iceConnectionState) {
    case 'checking':
      statusEl.textContent = 'Connecting...';
      break;
    case 'connected':
      statusEl.textContent = 'Connected!';
      break;
    case 'disconnected':
      statusEl.textContent = 'Connection interrupted - attempting recovery...';
      // Often recovers automatically
      break;
    case 'failed':
      statusEl.textContent = 'Connection failed - restarting...';
      restartIce(); // Attempt ICE restart
      break;
    case 'closed':
      statusEl.textContent = 'Call ended';
      break;
  }
};
```

### 4. Chrome DevTools for WebRTC

```
chrome://webrtc-internals/

This page shows:
├── All active RTCPeerConnections
├── SDP offers and answers (raw text)
├── ICE candidate gathering progress
├── ICE connection state changes
├── Media statistics (bitrate, packet loss, jitter)
├── Codec information
└── Connection timing

This is the #1 debugging tool for WebRTC issues.
```

### 5. Not Using TURN as Fallback

```javascript
// ❌ STUN only - fails for ~15% of connections
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// ✅ Always include a TURN server for reliability
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:443'],
      username: 'user',
      credential: 'pass'
    }
  ]
});
```

---

## Key Takeaways

| Concept | What to Remember |
|---|---|
| WebRTC vs WebSocket | WebRTC = P2P media; WebSocket = client-server messages. Use both together. |
| Signaling | WebRTC doesn't handle discovery - you build signaling with WebSockets/HTTP |
| SDP | Describes media capabilities (codecs, encryption). Offer from caller, answer from callee. |
| ICE | Finds the best P2P path. Tries host → STUN → TURN in order. |
| STUN | "What's my public IP?" - free, works ~85% of the time |
| TURN | Relay server for when P2P fails - expensive but guaranteed |
| Data channels | P2P arbitrary data. Configurable: reliable (TCP-like) or unreliable (UDP-like) |
| Track replacement | Use `replaceTrack()` to switch camera/screen without renegotiation |
| Debugging | `chrome://webrtc-internals/` is your best friend |

---

**Previous:** [← Blog 2 - Advanced WebSockets](./02-advanced-websockets.md)
**Next:** [Blog 4 - WebRTC Advanced + System Design →](./04-webrtc-advanced.md)
