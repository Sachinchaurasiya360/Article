# Blog 4: WebRTC Advanced — System Design for Video/Audio Applications

> Scaling WebRTC beyond 1-to-1 calls. SFU vs MCU architectures, building group video calls, simulcast, bandwidth estimation, recording, and production-grade system design for real-time communication platforms.

---

## Table of Contents

- [The Scaling Problem: Why P2P Breaks in Groups](#the-scaling-problem-why-p2p-breaks-in-groups)
- [SFU vs MCU — Media Server Architectures](#sfu-vs-mcu--media-server-architectures)
- [Building a Group Video Call with an SFU](#building-a-group-video-call-with-an-sfu)
- [Simulcast and Scalable Video Coding](#simulcast-and-scalable-video-coding)
- [Bandwidth Estimation and Adaptive Quality](#bandwidth-estimation-and-adaptive-quality)
- [Recording WebRTC Calls](#recording-webrtc-calls)
- [Latency Optimization](#latency-optimization)
- [System Design: Video Conferencing Platform](#system-design-video-conferencing-platform)
- [System Design: Live Streaming Platform](#system-design-live-streaming-platform)
- [Handling Thousands of Connections](#handling-thousands-of-connections)
- [Production Monitoring and Quality Metrics](#production-monitoring-and-quality-metrics)
- [Interview Questions and Scenarios](#interview-questions-and-scenarios)

---

## The Scaling Problem: Why P2P Breaks in Groups

In a 1-to-1 call, each peer sends 1 stream and receives 1 stream. Simple.

In a group call with **full mesh** (every peer connects to every other peer), the math explodes:

```
Full Mesh P2P:

2 participants: 1 connection each  (2 total streams per person)
3 participants: 2 connections each (4 total streams per person)
4 participants: 3 connections each (6 total streams per person)
5 participants: 4 connections each (8 total streams per person)
10 participants: 9 connections each (18 total streams per person)

Each participant sends N-1 copies of their video stream!

           Alice
          /  |  \
         /   |   \
       Bob──Dave──Carol
         \   |   /
          \  |  /
           Eve

5 people = 20 peer connections = 10 unique streams × 2 directions
Each person uploads their video 4 times (once to each peer)
```

**The problems with full mesh:**

| Participants | Upload streams per person | Total connections | Feasible? |
|---|---|---|---|
| 2 | 1 | 2 | Yes |
| 3 | 2 | 6 | Yes |
| 5 | 4 | 20 | Barely |
| 10 | 9 | 90 | No |
| 50 | 49 | 2,450 | Absolutely not |

At 5 participants, a single person uploading 720p video 4 times needs **~6 Mbps upload**. Most home connections can't sustain that, and the CPU encoding overhead is massive.

**Solution: Put a server in the middle.**

---

## SFU vs MCU — Media Server Architectures

### SFU (Selective Forwarding Unit) — The Industry Standard

The SFU receives each participant's stream **once** and **forwards it selectively** to others. No encoding/decoding — it just routes packets.

```
SFU Architecture:

     Alice                                          Bob
       │                                              │
       │── Video + Audio ──►┌──────────┐◄── Video ──│
       │                    │          │              │
       │◄── Bob's Video ───│   SFU    │── Alice's ──►│
       │◄── Carol's Video ─│  Server  │── Alice's ──►│
       │                    │          │              │
       Carol ── Video ────►└──────────┘◄── Audio ──  Dave
       Carol ◄── Alice ────                          Dave
       Carol ◄── Bob ──────               ◄── Alice ──
       Carol ◄── Dave ─────               ◄── Bob ────
                                          ◄── Carol ──

Each person uploads ONCE.
SFU forwards to N-1 others (no re-encoding).
```

**SFU characteristics:**

```
Upload per person:   1 stream (always constant regardless of group size)
Download per person: N-1 streams (one from each other participant)
Server CPU:          Low (just forwarding packets, no transcoding)
Server bandwidth:    High (N × (N-1) forwarded streams)
Latency:             Low (~50-100ms added)
Quality:             Each viewer can receive different quality (simulcast)
```

### MCU (Multipoint Control Unit) — The Mixing Approach

The MCU decodes all incoming streams, **mixes them into a single composite** stream, and sends one mixed stream to each participant.

```
MCU Architecture:

     Alice ── Video ──►┌──────────────┐
     Bob ── Video ─────►│              │── Mixed Video ──► Alice
     Carol ── Video ──►│   MCU Server  │── Mixed Video ──► Bob
     Dave ── Video ────►│  (decode +    │── Mixed Video ──► Carol
                        │   mix +       │── Mixed Video ──► Dave
                        │   encode)     │
                        └──────────────┘

     Everyone receives the same composite video
     (like a TV director view)
```

**MCU characteristics:**

```
Upload per person:   1 stream
Download per person: 1 stream (always — the mixed output)
Server CPU:          VERY HIGH (decode all + mix + re-encode)
Server bandwidth:    Low (only 1 outgoing stream per participant)
Latency:             Higher (~200-500ms due to decoding/encoding)
Quality:             Fixed layout — everyone sees the same thing
```

### SFU vs MCU Comparison

| Aspect | SFU | MCU |
|---|---|---|
| Server CPU | Low | Very high |
| Server bandwidth | High | Low |
| Client download bandwidth | High (N-1 streams) | Low (1 stream) |
| Client CPU | Higher (decode N-1) | Lower (decode 1) |
| Latency | Low (~50-100ms) | Higher (~200-500ms) |
| Video layout | Client decides | Server decides |
| Individual quality control | Yes (simulcast) | No |
| Scalability | Excellent | Poor (CPU bottleneck) |
| Cost | Bandwidth-driven | Compute-driven |
| Recording | Easy (forward streams) | Easy (already mixed) |

**The industry overwhelmingly uses SFUs:**

```
SFU-based platforms:
├── Zoom (uses SFU + client-side compositing)
├── Google Meet
├── Discord
├── Twitch (for low-latency streaming)
├── Daily.co
├── LiveKit
└── Jitsi Meet

MCU-based platforms:
├── Legacy enterprise systems
├── Some telephony bridges
└── Specific use cases (recording, TV broadcasting)

Open-source SFU implementations:
├── mediasoup (Node.js, most popular)
├── Janus (C, mature)
├── LiveKit (Go, cloud-native)
├── Pion (Go, low-level)
└── Ion-SFU (Go)
```

---

## Building a Group Video Call with an SFU

### Architecture with mediasoup (Most Popular Node.js SFU)

```
                    ┌──────────────────────┐
                    │   Signaling Server   │
                    │   (WebSocket)        │
                    └───────────┬──────────┘
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
        ┌─────────┐       ┌─────────┐       ┌─────────┐
        │  Alice  │       │   Bob   │       │  Carol  │
        │ Browser │       │ Browser │       │ Browser │
        └────┬────┘       └────┬────┘       └────┬────┘
             │                 │                  │
             │    WebRTC       │    WebRTC        │   WebRTC
             │                 │                  │
        ┌────▼─────────────────▼──────────────────▼────┐
        │              mediasoup SFU                     │
        │                                                │
        │  Router (room)                                 │
        │  ├── Producer: Alice's video                  │
        │  ├── Producer: Alice's audio                  │
        │  ├── Producer: Bob's video                    │
        │  ├── Producer: Bob's audio                    │
        │  ├── Producer: Carol's video                  │
        │  └── Producer: Carol's audio                  │
        │                                                │
        │  Consumers (per viewer):                      │
        │  ├── Alice receives: Bob(v,a) + Carol(v,a)    │
        │  ├── Bob receives: Alice(v,a) + Carol(v,a)    │
        │  └── Carol receives: Alice(v,a) + Bob(v,a)    │
        └────────────────────────────────────────────────┘
```

### mediasoup Server Setup

```javascript
const mediasoup = require('mediasoup');

// Create a mediasoup Worker (one per CPU core)
const worker = await mediasoup.createWorker({
  logLevel: 'warn',
  rtcMinPort: 10000,
  rtcMaxPort: 59999
});

// Create a Router (represents a "room" — all participants share a router)
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1
    }
  }
];

const router = await worker.createRouter({ mediaCodecs });

// Create a WebRTC Transport (one per participant direction)
async function createWebRtcTransport() {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      { ip: '0.0.0.0', announcedIp: process.env.PUBLIC_IP }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000 // 1 Mbps
  });

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  };
}
```

### Client-Side SFU Integration

```javascript
const mediasoupClient = require('mediasoup-client');

class SFUClient {
  constructor(signalingSocket) {
    this.socket = signalingSocket;
    this.device = new mediasoupClient.Device();
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map();    // My streams being sent
    this.consumers = new Map();    // Others' streams I'm receiving
  }

  // Step 1: Load the device with router capabilities
  async loadDevice() {
    const routerCapabilities = await this.request('getRouterCapabilities');
    await this.device.load({ routerRtpCapabilities: routerCapabilities });
  }

  // Step 2: Create send transport (for my audio/video)
  async createSendTransport() {
    const transportInfo = await this.request('createTransport', { direction: 'send' });

    this.sendTransport = this.device.createSendTransport(transportInfo);

    // Handle transport connection
    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.request('connectTransport', {
          transportId: this.sendTransport.id,
          dtlsParameters
        });
        callback();
      } catch (err) {
        errback(err);
      }
    });

    // Handle new producer
    this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { producerId } = await this.request('produce', {
          transportId: this.sendTransport.id,
          kind,
          rtpParameters
        });
        callback({ id: producerId });
      } catch (err) {
        errback(err);
      }
    });
  }

  // Step 3: Create receive transport (for others' audio/video)
  async createRecvTransport() {
    const transportInfo = await this.request('createTransport', { direction: 'recv' });

    this.recvTransport = this.device.createRecvTransport(transportInfo);

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.request('connectTransport', {
          transportId: this.recvTransport.id,
          dtlsParameters
        });
        callback();
      } catch (err) {
        errback(err);
      }
    });
  }

  // Step 4: Produce (send my audio/video to the SFU)
  async produce(track) {
    const producer = await this.sendTransport.produce({ track });
    this.producers.set(producer.id, producer);
    return producer;
  }

  // Step 5: Consume (receive someone else's stream from the SFU)
  async consume(producerId) {
    const consumerInfo = await this.request('consume', {
      producerId,
      rtpCapabilities: this.device.rtpCapabilities
    });

    const consumer = await this.recvTransport.consume({
      id: consumerInfo.id,
      producerId: consumerInfo.producerId,
      kind: consumerInfo.kind,
      rtpParameters: consumerInfo.rtpParameters
    });

    this.consumers.set(consumer.id, consumer);

    // Resume the consumer (paused by default on server)
    await this.request('resumeConsumer', { consumerId: consumer.id });

    return consumer;
  }

  // Signaling helper
  request(method, data = {}) {
    return new Promise((resolve, reject) => {
      this.socket.emit(method, data, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }
}
```

---

## Simulcast and Scalable Video Coding

### Simulcast — Send Multiple Quality Layers

With simulcast, the sender encodes their video at **multiple resolutions simultaneously**. The SFU then forwards the appropriate layer to each receiver based on their bandwidth and display size.

```
Simulcast from Alice:

Alice's camera ──► Encoder ──┬── High (720p, 1.5 Mbps)  ──► SFU
                             ├── Medium (360p, 500 Kbps) ──► SFU
                             └── Low (180p, 150 Kbps)    ──► SFU

SFU forwards:
├── Bob (good bandwidth, large display)   → receives High (720p)
├── Carol (moderate bandwidth)            → receives Medium (360p)
└── Dave (mobile, weak connection)        → receives Low (180p)

The SFU can switch layers instantly (no re-encoding needed!)
```

### Enabling Simulcast

```javascript
// Client-side: Enable simulcast when producing video
const videoProducer = await sendTransport.produce({
  track: videoTrack,
  encodings: [
    { maxBitrate: 150000, scaleResolutionDownBy: 4 },  // Low: 320×180
    { maxBitrate: 500000, scaleResolutionDownBy: 2 },  // Medium: 640×360
    { maxBitrate: 1500000 }                              // High: 1280×720
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
});

// Server-side: Switch layers based on viewer needs
// When a participant's display area is small (e.g., gallery view with 20 people),
// the SFU sends the Low layer. When they're the active speaker (large view),
// it sends the High layer.
```

### Scalable Video Coding (SVC) — VP9 and AV1

```
Simulcast: Separate encodes at different resolutions (3× encoding cost)
SVC: Single encode with embedded quality layers (1× encoding cost)

VP9 SVC layers:
┌─────────────────────────────────────┐
│  Spatial Layer 2 (720p)             │  ← only needs Layer 0 + 1 + 2
│  ┌─────────────────────────────┐    │
│  │  Spatial Layer 1 (360p)     │    │  ← only needs Layer 0 + 1
│  │  ┌─────────────────────┐    │    │
│  │  │ Spatial Layer 0     │    │    │  ← base layer (always sent)
│  │  │ (180p)              │    │    │
│  │  └─────────────────────┘    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

The SFU can drop higher layers for bandwidth-constrained receivers
without re-encoding. More efficient than simulcast.
```

---

## Bandwidth Estimation and Adaptive Quality

### How WebRTC Estimates Bandwidth

```
WebRTC uses several mechanisms to estimate available bandwidth:

1. REMB (Receiver Estimated Maximum Bitrate)
   ├── Receiver estimates available bandwidth from packet arrival times
   ├── Sends REMB RTCP message to sender
   └── Sender adjusts encoding bitrate accordingly

2. Transport-CC (Transport-Wide Congestion Control)
   ├── Sender adds sequence numbers to all packets
   ├── Receiver reports arrival times of all packets
   ├── Sender-side algorithm estimates bandwidth
   └── More accurate than REMB (used by Google/Chrome)

3. GCC (Google Congestion Control)
   ├── Combines delay-based and loss-based estimation
   ├── Delay increases → reduce bitrate
   ├── Packet loss > 10% → reduce bitrate
   └── Stable conditions → gradually increase bitrate
```

### Monitoring Connection Quality

```javascript
// Get real-time statistics from the peer connection
async function monitorStats(peerConnection) {
  const stats = await peerConnection.getStats();

  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      console.log('Video Inbound:', {
        bytesReceived: report.bytesReceived,
        packetsReceived: report.packetsReceived,
        packetsLost: report.packetsLost,
        jitter: report.jitter,                    // Variation in packet arrival
        framesDecoded: report.framesDecoded,
        framesDropped: report.framesDropped,
        frameWidth: report.frameWidth,
        frameHeight: report.frameHeight,
        framesPerSecond: report.framesPerSecond
      });
    }

    if (report.type === 'outbound-rtp' && report.kind === 'video') {
      console.log('Video Outbound:', {
        bytesSent: report.bytesSent,
        packetsSent: report.packetsSent,
        retransmittedPacketsSent: report.retransmittedPacketsSent,
        qualityLimitationReason: report.qualityLimitationReason,
        // 'bandwidth' | 'cpu' | 'none'
        // Tells you WHY quality was reduced
        encoderImplementation: report.encoderImplementation
      });
    }

    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      console.log('Connection:', {
        currentRoundTripTime: report.currentRoundTripTime,  // RTT in seconds
        availableOutgoingBitrate: report.availableOutgoingBitrate,
        bytesReceived: report.bytesReceived,
        bytesSent: report.bytesSent
      });
    }
  });
}

// Poll every 2 seconds
setInterval(() => monitorStats(peerConnection), 2000);
```

### Adaptive Quality Based on Network Conditions

```javascript
// Automatically adjust video quality based on network stats

class AdaptiveQuality {
  constructor(peerConnection, videoSender) {
    this.pc = peerConnection;
    this.sender = videoSender;
    this.monitor();
  }

  async monitor() {
    setInterval(async () => {
      const stats = await this.pc.getStats(this.sender);
      let packetLoss = 0;
      let rtt = 0;
      let availableBandwidth = Infinity;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp') {
          const totalPackets = report.packetsSent + (report.packetsLost || 0);
          packetLoss = totalPackets > 0
            ? (report.packetsLost || 0) / totalPackets
            : 0;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime || 0;
          availableBandwidth = report.availableOutgoingBitrate || Infinity;
        }
      });

      this.adjustQuality(packetLoss, rtt, availableBandwidth);
    }, 3000);
  }

  async adjustQuality(packetLoss, rtt, bandwidth) {
    const params = this.sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) return;

    let targetBitrate;

    if (packetLoss > 0.1 || rtt > 0.3) {
      // Bad network: drop to low quality
      targetBitrate = 150000; // 150 Kbps
      console.log('Network poor — switching to low quality');
    } else if (packetLoss > 0.03 || rtt > 0.15 || bandwidth < 800000) {
      // Moderate network: medium quality
      targetBitrate = 500000; // 500 Kbps
      console.log('Network moderate — switching to medium quality');
    } else {
      // Good network: high quality
      targetBitrate = 1500000; // 1.5 Mbps
      console.log('Network good — high quality');
    }

    params.encodings[0].maxBitrate = targetBitrate;
    await this.sender.setParameters(params);
  }
}
```

---

## Recording WebRTC Calls

### Server-Side Recording (Production Approach)

```
Recording architecture:

Participants ──WebRTC──► SFU ──────────► Recording Service
                         │                    │
                         │  Forward RTP       │ Write to disk
                         │  packets to        │ or cloud storage
                         │  recording         │
                         │  consumer          ├── audio.ogg
                         │                    ├── video.webm
                         │                    └── composite.mp4

The SFU creates additional "consumers" for each track
and forwards the media to a recording service.
```

```javascript
// mediasoup: Create a recording consumer
async function startRecording(router, producer) {
  // Create a Plain RTP transport (for piping to FFmpeg/GStreamer)
  const transport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false,
    comedia: false
  });

  // Get the transport's local port
  const { localIp, localPort, localRtcpPort } = transport.tuple;

  // Create a consumer on this transport
  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: false
  });

  // Pipe RTP to FFmpeg for recording
  const ffmpegArgs = [
    '-protocol_whitelist', 'pipe,udp,rtp',
    '-i', `rtp://${localIp}:${localPort}`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-f', 'mp4',
    `recordings/${Date.now()}.mp4`
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  return { consumer, transport, ffmpeg };
}
```

### Client-Side Recording (Simple Approach)

```javascript
// Record the received media stream in the browser
function startClientRecording(stream) {
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: 2500000 // 2.5 Mbps
  });

  const chunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    // Download the recording
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
  };

  // Request data every second (for progressive recording)
  mediaRecorder.start(1000);

  return mediaRecorder;
}
```

---

## Latency Optimization

### Sources of Latency in WebRTC

```
End-to-end latency breakdown:

Camera capture        │ 33ms  │ (at 30fps, one frame = 33ms)
Encoding              │ 15ms  │ (hardware encoder)
OS/driver buffering   │ 5ms   │
Network (local)       │ 1ms   │
NAT traversal         │ 0ms   │ (after ICE completes)
Internet transit      │ 20ms  │ (depends on distance)
Jitter buffer         │ 40ms  │ (absorbs network jitter)
Decoding              │ 10ms  │ (hardware decoder)
Rendering             │ 16ms  │ (vsync at 60fps)
──────────────────────┼───────┤
Total (typical)       │~140ms │

For reference:
├── < 150ms: feels instantaneous (good for calls)
├── 150-300ms: noticeable but usable
├── 300-500ms: uncomfortable (people start talking over each other)
└── > 500ms: unusable for real-time conversation
```

### Optimization Techniques

```javascript
// 1. Use hardware-accelerated codecs
const offer = await peerConnection.createOffer();

// Prefer H.264 (hardware encoding on most devices) over VP8 (often software)
const modifiedSdp = preferCodec(offer.sdp, 'video', 'H264');
await peerConnection.setLocalDescription({ type: 'offer', sdp: modifiedSdp });

function preferCodec(sdp, kind, codecName) {
  const lines = sdp.split('\r\n');
  // Reorder codec priority in the m= line
  // (Real implementation needs full SDP munging — simplified here)
  return lines.join('\r\n');
}

// 2. Reduce jitter buffer (trade smoothness for lower latency)
// This is controlled by the browser and not directly accessible,
// but you can influence it by requesting low-latency playout:
const receiver = peerConnection.getReceivers().find(r => r.track.kind === 'video');
if (receiver) {
  receiver.jitterBufferTarget = 0; // Request minimum jitter buffer
  // Available in Chrome 114+
}

// 3. Enable DTLS 1.3 for faster handshakes (reduces connection setup time)
// This is automatic in modern browsers.

// 4. Use TURN over TCP port 443 (works through firewalls faster than UDP TURN)
{
  urls: 'turns:turn.example.com:443',
  username: 'user',
  credential: 'pass'
}
```

---

## System Design: Video Conferencing Platform

### Requirements

```
- Support 1-to-1 and group calls (up to 100 participants)
- HD video (720p) and audio
- Screen sharing
- Chat alongside video
- Recording
- Cross-platform (web, mobile, desktop)
- Scale to 100,000 concurrent calls
```

### High-Level Architecture

```
                    ┌──────────────────────┐
                    │    CDN / Edge        │
                    │  (static assets)     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   API Gateway        │
                    │   (Auth, routing)    │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
  │ Signaling     │   │ Room          │   │ User          │
  │ Service       │   │ Service       │   │ Service       │
  │ (WebSocket)   │   │ (REST API)    │   │ (REST API)    │
  └───────┬───────┘   └───────┬───────┘   └───────────────┘
          │                    │
          │              ┌─────▼──────┐
          │              │  Redis     │
          │              │ (rooms,    │
          │              │  presence) │
          │              └────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────┐
  │            SFU Cluster                       │
  │                                              │
  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
  │  │  SFU 1  │ │  SFU 2  │ │  SFU N  │       │
  │  │mediasoup│ │mediasoup│ │mediasoup│       │
  │  │ 4 cores │ │ 4 cores │ │ 4 cores │       │
  │  └────┬────┘ └────┬────┘ └────┬────┘       │
  │       │           │           │              │
  │       └─────── Cascading ─────┘              │
  │       (for calls spanning multiple SFUs)     │
  └──────────────────────────┬──────────────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
        ┌────────────┐ ┌──────────┐ ┌────────────┐
        │ PostgreSQL │ │  S3      │ │ Recording  │
        │ (users,    │ │ (media,  │ │ Service    │
        │  rooms,    │ │ recordings│ │ (FFmpeg)   │
        │  history)  │ │          │ │            │
        └────────────┘ └──────────┘ └────────────┘
```

### SFU Assignment and Room Management

```javascript
// Room Service: Assign calls to SFU servers

class RoomService {
  constructor(redis) {
    this.redis = redis;
  }

  // When a user wants to join a call
  async joinRoom(roomId, userId) {
    // Check if room already exists (has an assigned SFU)
    let sfuId = await this.redis.hget(`room:${roomId}`, 'sfuId');

    if (!sfuId) {
      // New room — pick the least loaded SFU
      sfuId = await this.selectBestSFU();
      await this.redis.hset(`room:${roomId}`, 'sfuId', sfuId);
    }

    // Add user to room
    await this.redis.sadd(`room:${roomId}:members`, userId);

    // Get SFU connection details
    const sfuInfo = await this.redis.hgetall(`sfu:${sfuId}`);

    return {
      sfuHost: sfuInfo.host,
      sfuPort: sfuInfo.port,
      roomId
    };
  }

  async selectBestSFU() {
    // Get all SFU servers and their current load
    const sfuKeys = await this.redis.keys('sfu:*');
    let bestSFU = null;
    let lowestLoad = Infinity;

    for (const key of sfuKeys) {
      const load = parseInt(await this.redis.hget(key, 'connectionCount'));
      if (load < lowestLoad) {
        lowestLoad = load;
        bestSFU = key.replace('sfu:', '');
      }
    }

    return bestSFU;
  }
}
```

### Capacity Planning

```
Per SFU server (8 cores, 16 GB RAM):
├── Max rooms: ~200 (depends on participant count per room)
├── Max participants: ~500 (with simulcast)
├── Bandwidth per server: ~5 Gbps peak
└── Cost: ~$200/month (cloud VM)

For 100,000 concurrent calls:
├── Average 3 participants per call = 300,000 concurrent users
├── 300,000 / 500 per SFU = 600 SFU servers needed
├── Plus signaling: 20 servers (15K connections each)
├── Plus Redis cluster: 6 nodes
├── Plus PostgreSQL: Primary + 3 replicas
├── Estimated monthly cost: ~$150,000

Optimization opportunities:
├── Geographic distribution (SFU servers close to users)
├── Auto-scaling (scale down during off-peak hours)
├── Simulcast (reduce bandwidth for gallery view)
└── VP9 SVC (reduce encoding overhead)
```

---

## System Design: Live Streaming Platform

### Architecture for 1-to-Many Streaming

```
For live streaming (1 broadcaster, thousands of viewers):
WebRTC P2P doesn't work — you can't have 10,000 peer connections.

Solution: WebRTC for ingest, HLS/DASH for distribution

                    ┌──────────────┐
                    │  Broadcaster │
                    │  (WebRTC)    │
                    └──────┬───────┘
                           │
                     WebRTC│Ingest
                           │
                    ┌──────▼───────┐
                    │   SFU /      │
                    │  Media Server│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Transcoder│ │Transcoder│ │Recording │
        │  1080p   │ │  720p    │ │ Service  │
        │  720p    │ │  480p    │ │          │
        │  480p    │ │  360p    │ │          │
        └────┬─────┘ └────┬─────┘ └──────────┘
             │             │
             └──────┬──────┘
                    │
             ┌──────▼──────┐
             │   CDN       │
             │ (HLS/DASH)  │
             │ Cloudflare  │
             │ CloudFront  │
             └──────┬──────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Viewer 1    Viewer 2     Viewer N
    (HLS)       (HLS)       (HLS)
                            (10,000+ concurrent)

Latency trade-offs:
├── WebRTC ingest + WebRTC delivery: ~200ms latency, max ~1000 viewers
├── WebRTC ingest + Low-latency HLS: 2-5s latency, unlimited viewers
├── WebRTC ingest + Standard HLS: 10-30s latency, unlimited viewers
└── RTMP ingest + HLS: 15-45s latency, unlimited viewers (traditional)
```

### Scaling WebRTC Viewers (Cascading SFUs)

```
For lower-latency streaming to more viewers,
cascade SFUs in a tree structure:

                    Origin SFU
                    (broadcaster)
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
          Edge SFU   Edge SFU   Edge SFU
          (region 1) (region 2) (region 3)
             │          │          │
          ┌──┼──┐    ┌──┼──┐   ┌──┼──┐
          ▼  ▼  ▼    ▼  ▼  ▼   ▼  ▼  ▼
         Viewers    Viewers    Viewers

Each edge SFU handles ~200-500 viewers
Origin SFU sends one copy to each edge
Edge SFUs forward to local viewers

Total capacity: 500 viewers × N edge SFUs
Latency: ~200-500ms (still real-time)
```

---

## Handling Thousands of Connections

### Connection Limits and Optimization

```
Browser limits:
├── Chrome: 500 peer connections (per tab, in practice ~50-100 work well)
├── Firefox: 256 peer connections
├── Safari: Limited by memory
└── In practice: 6-10 video streams is the realistic limit per client

Server (SFU) limits per worker:
├── mediasoup: One worker per CPU core
├── Each worker: ~500 consumers (receiving)
├── With 8 cores: ~4000 consumers total
└── Bottleneck: bandwidth (not CPU, since SFU just forwards)

Optimization strategies for large meetings:

1. Active speaker detection:
   Only send video for the person currently speaking (+ last speaker)
   Others get audio only → massive bandwidth savings

2. Pagination:
   Gallery view shows 25 videos per page
   Only subscribe to visible participants' video
   Switch subscriptions when user changes page

3. Audio-only for most:
   Beyond 20 participants, only the active speaker has video
   Everyone else is audio-only with avatars

4. Quality tiers:
   Active speaker: 720p
   Gallery thumbnails: 180p
   Off-screen: audio only
```

```javascript
// Active speaker detection on the SFU
// mediasoup provides audio level notifications

const audioLevelObserver = await router.createAudioLevelObserver({
  maxEntries: 1,        // Report top 1 speaker
  threshold: -47,       // Volume threshold in dB
  interval: 800         // Check every 800ms
});

audioLevelObserver.on('volumes', (volumes) => {
  const activeSpeaker = volumes[0];
  // Notify all clients to show this speaker's video prominently
  broadcast({
    type: 'active-speaker',
    producerId: activeSpeaker.producer.id,
    volume: activeSpeaker.volume
  });
});

// Add all audio producers to the observer
audioLevelObserver.addProducer({ producerId: audioProducer.id });
```

---

## Production Monitoring and Quality Metrics

### Key Metrics to Track

```
Connection quality:
├── ICE connection success rate (should be > 98%)
├── TURN fallback rate (should be < 15%)
├── Connection setup time (P50, P95, P99)
├── Reconnection frequency
└── ICE restart frequency

Media quality:
├── Packet loss rate (< 2% is good, > 5% is degraded)
├── Jitter (< 30ms is good)
├── Round-trip time (< 150ms for calls)
├── Video bitrate (actual vs target)
├── Frame rate (actual vs target)
├── Frames dropped
├── Quality limitation reason (bandwidth, CPU, none)
└── Audio energy level (detect muted/broken audio)

Infrastructure:
├── SFU CPU utilization per worker
├── SFU memory usage
├── Network bandwidth per SFU
├── Signaling server message throughput
├── TURN server bandwidth and connection count
└── Recording pipeline lag
```

```javascript
// Client-side: Collect and report quality metrics

async function collectMetrics(peerConnection) {
  const stats = await peerConnection.getStats();
  const metrics = {};

  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      metrics.video_in = {
        packets_received: report.packetsReceived,
        packets_lost: report.packetsLost,
        jitter: report.jitter,
        frames_decoded: report.framesDecoded,
        frames_dropped: report.framesDropped,
        frame_width: report.frameWidth,
        frame_height: report.frameHeight,
        fps: report.framesPerSecond
      };
    }
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      metrics.connection = {
        rtt: report.currentRoundTripTime,
        available_bandwidth: report.availableOutgoingBitrate,
        local_candidate_type: report.localCandidateType,
        remote_candidate_type: report.remoteCandidateType
      };
    }
  });

  // Send metrics to your analytics backend
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify(metrics),
    headers: { 'Content-Type': 'application/json' }
  });
}

// Collect every 5 seconds
setInterval(() => collectMetrics(peerConnection), 5000);
```

---

## Interview Questions and Scenarios

### Question 1: "How would you design Zoom?"

**Framework answer:**

```
1. Signaling: WebSocket for session management
2. Media: SFU architecture (mediasoup/Janus/LiveKit)
3. Small calls (< 6): Each participant sends/receives all streams
4. Large calls (> 6): Active speaker gets HD, others get thumbnails
5. Screen share: Separate producer, simulcast for quality tiers
6. Recording: SFU forwards to recording consumer → FFmpeg → S3
7. Chat: WebSocket alongside the call
8. Scaling: Auto-scaling SFU cluster, geographic distribution
9. TURN: Mandatory for reliability (~15% of connections need it)
10. Quality: Simulcast + adaptive bitrate based on bandwidth estimation
```

### Question 2: "WebRTC call fails for some users. How do you debug?"

```
Debugging checklist:
1. Check ICE connection state → chrome://webrtc-internals/
2. If "failed":
   a. No TURN configured? → ~15% of users behind symmetric NAT will fail
   b. TURN server down? → Check TURN server health
   c. Firewall blocking UDP? → Use TURN over TCP port 443
3. If "connected" but no media:
   a. Check SDP exchange → were offer/answer properly exchanged?
   b. Check media permissions → did user grant camera/mic access?
   c. Check codec mismatch → do both peers support the same codec?
4. If media quality is bad:
   a. Check packet loss → > 5% means network congestion
   b. Check bandwidth → available bitrate too low for video quality
   c. Check CPU → qualityLimitationReason === 'cpu' means device is struggling
```

### Question 3: "How do you handle network changes during a call?"

```
Scenario: User switches from WiFi to mobile data mid-call

Without handling: Call drops, user must rejoin.

With ICE restart:
1. Browser detects network change (online/offline events)
2. Application triggers ICE restart:
   const offer = await pc.createOffer({ iceRestart: true });
   await pc.setLocalDescription(offer);
   // Send new offer via signaling
3. New ICE candidates are gathered for the new network
4. Connection re-establishes on the new network interface
5. Media resumes (brief interruption: 1-3 seconds)

With Opertunistic ICE (trickle ICE reset):
- Modern browsers detect new interfaces and add candidates automatically
- Less disruption than full ICE restart
```

### Question 4: "How do you reduce costs for a video conferencing platform?"

```
Top cost-saving strategies:

1. Minimize TURN relay usage:
   - Use multiple STUN servers (free)
   - Only fall back to TURN when necessary
   - Use TURN over TCP/443 to work through more firewalls (before relaying)
   - Savings: ~60% of TURN bandwidth costs

2. Use simulcast aggressively:
   - Gallery view: send 180p (not 720p) to each viewer
   - Active speaker only: only one 720p stream forwarded
   - Savings: ~70% SFU bandwidth reduction

3. Audio-only meetings:
   - When video isn't needed, disable it entirely
   - Audio uses ~50 Kbps vs video at ~1.5 Mbps
   - Savings: 97% bandwidth per participant

4. Geographic distribution:
   - SFU servers close to users → lower bandwidth transit costs
   - Edge regions for common user locations
   - Savings: 30-50% on bandwidth costs

5. Auto-scaling:
   - Scale SFU servers based on concurrent call count
   - Scale down during off-peak hours (nights, weekends)
   - Savings: 40-60% on compute costs

6. VP9/AV1 codecs:
   - 30-50% better compression than VP8/H264
   - Same quality at lower bitrate
   - Savings: 30-50% bandwidth per stream
```

---

## Key Takeaways

| Concept | What to Remember |
|---|---|
| Full mesh P2P | Breaks beyond 4-5 participants (N² complexity) |
| SFU | Industry standard — forward packets, no transcoding, low latency |
| MCU | Mixes all streams — high CPU, low client bandwidth, higher latency |
| Simulcast | Send multiple quality layers; SFU picks the right one per viewer |
| SVC (VP9/AV1) | Single encode with embedded layers — more efficient than simulcast |
| Bandwidth estimation | GCC/REMB/Transport-CC — WebRTC adapts quality automatically |
| Recording | SFU forwards to recording consumer → FFmpeg → S3 |
| Cascading SFUs | Tree structure for scaling to thousands of viewers |
| Active speaker | Only forward HD video for the current speaker — saves massive bandwidth |
| ICE restart | Handles network changes (WiFi → mobile) without dropping the call |
| Cost optimization | Simulcast + audio-only + minimize TURN + auto-scaling |

---

**Previous:** [← Blog 3 — WebRTC Fundamentals](./03-webrtc-fundamentals.md)
**Back to index:** [README](./README.md)
