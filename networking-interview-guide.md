# Computer Networking Interview Guide for Full-Stack Developers

> A complete, structured guide covering networking fundamentals, HTTP/HTTPS, DNS, TCP/IP, and real-world concepts every full-stack developer must know for interviews.

---

## Table of Contents

1. [How the Internet Actually Works](#how-the-internet-actually-works)
2. [OSI Model & TCP/IP Model](#osi-model--tcpip-model)
3. [IP Addressing & DNS](#ip-addressing--dns)
4. [TCP vs UDP](#tcp-vs-udp)
5. [HTTP Deep Dive](#http-deep-dive)
6. [HTTPS & TLS/SSL](#https--tlsssl)
7. [How HTTPS Works Step by Step](#how-https-works-step-by-step)
8. [Cookies, Sessions & Tokens](#cookies-sessions--tokens)
9. [CORS](#cors)
10. [WebSockets](#websockets)
11. [REST vs GraphQL vs gRPC](#rest-vs-graphql-vs-grpc)
12. [Caching](#caching)
13. [CDN](#cdn)
14. [Load Balancers & Reverse Proxies](#load-balancers--reverse-proxies)
15. [Common Interview Questions](#common-interview-questions)

---

## How the Internet Actually Works

When you type `https://www.google.com` in your browser and hit Enter, here is what happens end-to-end:

```
You (Browser)
   |
   |  1. DNS Lookup - "What is the IP of www.google.com?"
   v
DNS Server  -->  Returns IP: 142.250.190.4
   |
   |  2. TCP Connection - Three-way handshake (SYN, SYN-ACK, ACK)
   v
Google's Server (142.250.190.4, Port 443)
   |
   |  3. TLS Handshake - Establish encrypted connection
   v
Secure Channel Established
   |
   |  4. HTTP Request - GET / HTTP/2
   v
Server Processes Request
   |
   |  5. HTTP Response - 200 OK + HTML content
   v
Browser Renders the Page
```

**In short:** DNS resolves the name -> TCP establishes a reliable connection -> TLS encrypts it -> HTTP carries the actual data.

---

## OSI Model & TCP/IP Model

### The OSI Model (7 Layers)

Think of it as layers of an onion. Each layer adds its own header to the data (encapsulation).

```
Layer 7 - Application    : HTTP, HTTPS, FTP, SMTP, DNS
Layer 6 - Presentation   : Encryption/Decryption, Compression (TLS lives here conceptually)
Layer 5 - Session         : Manages sessions/connections
Layer 4 - Transport       : TCP, UDP (port numbers, reliability)
Layer 3 - Network         : IP (IP addresses, routing)
Layer 2 - Data Link       : MAC addresses, Ethernet, Wi-Fi frames
Layer 1 - Physical        : Cables, radio signals, electrical pulses
```

### The TCP/IP Model (4 Layers) - What is Actually Used

```
Application    : HTTP, DNS, FTP, SMTP      (OSI 5-7)
Transport      : TCP, UDP                   (OSI 4)
Internet       : IP, ICMP                   (OSI 3)
Network Access : Ethernet, Wi-Fi            (OSI 1-2)
```

**Interview tip:** The OSI model is theoretical. The TCP/IP model is what the real internet uses. Know both, but understand TCP/IP practically.

### How Data Flows Through Layers

```
Sending side:
[Data] -> [TCP Header + Data] -> [IP Header + TCP Header + Data] -> [Frame Header + IP + TCP + Data]

Receiving side reverses the process (decapsulation).
```

---

## IP Addressing & DNS

### IP Addresses

```
IPv4: 192.168.1.1         (32-bit, ~4.3 billion addresses)
IPv6: 2001:0db8:85a3::1   (128-bit, practically unlimited)
```

**Private IP ranges (not routable on internet):**
```
10.0.0.0     - 10.255.255.255      (Class A)
172.16.0.0   - 172.31.255.255      (Class B)
192.168.0.0  - 192.168.255.255     (Class C)
```

**Special addresses:**
- `127.0.0.1` - localhost (your own machine)
- `0.0.0.0` - listen on all interfaces
- `255.255.255.255` - broadcast

### Ports

A port identifies a specific process/service on a machine. IP gets you to the machine, port gets you to the app.

```
Port 80    - HTTP
Port 443   - HTTPS
Port 22    - SSH
Port 3306  - MySQL
Port 5432  - PostgreSQL
Port 27017 - MongoDB
Port 6379  - Redis
Port 3000  - Your React dev server (convention)
Port 8080  - Your backend dev server (convention)
```

**Total ports:** 0-65535. Ports 0-1023 are "well-known" (need root/admin to bind).

### DNS - Domain Name System

DNS is like the phonebook of the internet. It converts human-readable names to IP addresses.

```
Browser: "What is the IP for www.example.com?"

Step 1: Check browser cache
Step 2: Check OS cache (/etc/hosts)
Step 3: Ask Recursive Resolver (usually your ISP)
Step 4: Ask Root Name Server -> "Go ask .com TLD server"
Step 5: Ask .com TLD Server -> "Go ask example.com's authoritative server"
Step 6: Ask Authoritative Name Server -> "93.184.216.34"
Step 7: Cache the result, return to browser
```

**DNS Record Types:**
| Record | Purpose | Example |
|--------|---------|---------|
| A | Domain to IPv4 | `example.com -> 93.184.216.34` |
| AAAA | Domain to IPv6 | `example.com -> 2606:2800:220:1:...` |
| CNAME | Alias to another domain | `www.example.com -> example.com` |
| MX | Mail server | `example.com -> mail.example.com` |
| TXT | Text data (verification, SPF) | `"v=spf1 include:_spf.google.com"` |
| NS | Name server for the domain | `example.com -> ns1.example.com` |

**TTL (Time To Live):** How long DNS results are cached. Lower TTL = faster propagation of changes, but more DNS queries.

---

## TCP vs UDP

### TCP (Transmission Control Protocol)

**Reliable, ordered, connection-oriented.**

```
Three-Way Handshake (Connection Setup):

Client              Server
  |--- SYN ----------->|    "Hey, I want to connect"
  |<-- SYN-ACK --------|    "OK, I acknowledge. I want to connect too"
  |--- ACK ----------->|    "Great, connection established"
  
Now data flows...

Four-Way Teardown (Connection Close):
  |--- FIN ----------->|    "I'm done sending"
  |<-- ACK ------------|    "OK, noted"
  |<-- FIN ------------|    "I'm done too"
  |--- ACK ----------->|    "OK, connection closed"
```

**TCP guarantees:**
- Data arrives in order
- No duplicate packets
- Lost packets are retransmitted
- Flow control (don't overwhelm the receiver)
- Congestion control (don't overwhelm the network)

### UDP (User Datagram Protocol)

**Fast, no guarantees, connectionless.**

```
Client              Server
  |--- Data Packet --->|    "Here's some data, good luck"
  |--- Data Packet --->|    "Here's more, hope you got the first one"
```

**No handshake. No ordering. No retransmission.**

### When to Use What

| Feature | TCP | UDP |
|---------|-----|-----|
| Reliability | Guaranteed delivery | Best effort |
| Ordering | Guaranteed order | No order |
| Speed | Slower (overhead) | Faster |
| Use cases | HTTP, Email, File transfer, DB connections | Video streaming, Gaming, DNS lookups, VoIP |

**As a full-stack dev:** Almost everything you do uses TCP (HTTP/HTTPS runs on TCP). You rarely deal with UDP directly unless you're building real-time features (and even then, WebSockets use TCP).

---

## HTTP Deep Dive

### HTTP (HyperText Transfer Protocol)

HTTP is a **request-response** protocol. The client sends a request, the server sends a response. It's **stateless** - each request is independent, the server doesn't remember previous requests.

### HTTP Methods

```
GET     - Read/retrieve data              (Safe, Idempotent)
POST    - Create new resource             (Not safe, Not idempotent)
PUT     - Replace entire resource          (Not safe, Idempotent)
PATCH   - Partially update resource        (Not safe, Not idempotent)
DELETE  - Remove resource                  (Not safe, Idempotent)
HEAD    - Same as GET but no body          (Safe, Idempotent)
OPTIONS - What methods are allowed?        (Safe, Idempotent) -- used in CORS preflight
```

**Idempotent** = calling it multiple times has the same effect as calling once. `DELETE /user/5` three times still results in user 5 being deleted. `POST /users` three times creates three users.

### HTTP Status Codes

```
1xx - Informational
  100 Continue

2xx - Success
  200 OK                    - Standard success
  201 Created               - Resource created (after POST)
  204 No Content            - Success, but no body (after DELETE)

3xx - Redirection
  301 Moved Permanently     - URL changed forever, update your bookmarks
  302 Found                 - Temporary redirect
  304 Not Modified          - Use your cached version

4xx - Client Error
  400 Bad Request           - Malformed request
  401 Unauthorized          - Not authenticated (who are you?)
  403 Forbidden             - Authenticated but not allowed (you can't do this)
  404 Not Found             - Resource doesn't exist
  405 Method Not Allowed    - Right URL, wrong HTTP method
  409 Conflict              - Conflicts with current state
  429 Too Many Requests     - Rate limited

5xx - Server Error
  500 Internal Server Error - Generic server error
  502 Bad Gateway           - Upstream server gave invalid response
  503 Service Unavailable   - Server overloaded or in maintenance
  504 Gateway Timeout       - Upstream server didn't respond in time
```

### HTTP Headers You Must Know

**Request Headers:**
```
Host: www.example.com                    - Which domain (required for virtual hosting)
Authorization: Bearer eyJhbGci...        - Auth token
Content-Type: application/json           - Format of request body
Accept: application/json                 - What format you want in response
Cookie: session_id=abc123                - Send cookies
User-Agent: Mozilla/5.0...              - Browser/client info
Origin: https://myapp.com               - Where the request came from (CORS)
```

**Response Headers:**
```
Content-Type: application/json           - Format of response body
Set-Cookie: session_id=abc123; HttpOnly  - Tell browser to store cookie
Cache-Control: max-age=3600              - Cache for 1 hour
Access-Control-Allow-Origin: *           - CORS permission
Location: /users/123                     - Redirect URL (with 3xx status)
```

### HTTP/1.1 vs HTTP/2 vs HTTP/3

```
HTTP/1.1 (1997):
  - One request per TCP connection at a time
  - Head-of-line blocking (request 2 waits for request 1)
  - Text-based headers
  - Workaround: browsers open 6 parallel TCP connections

HTTP/2 (2015):
  - Multiplexing: multiple requests on ONE TCP connection
  - Binary framing (faster parsing)
  - Header compression (HPACK)
  - Server push (server can send resources before client asks)
  - Still uses TCP

HTTP/3 (2022):
  - Uses QUIC (based on UDP) instead of TCP
  - No TCP head-of-line blocking
  - Faster connection setup (0-RTT)
  - Built-in encryption
```

---

## HTTPS & TLS/SSL

### What is HTTPS?

HTTPS = HTTP + TLS (Transport Layer Security). Same HTTP protocol, but the connection is **encrypted**.

```
HTTP:  Client <---- plain text ----> Server     (anyone can read it)
HTTPS: Client <==== encrypted =====> Server     (only client & server can read)
```

### Why HTTPS Matters

1. **Encryption** - Data can't be read by attackers in the middle
2. **Integrity** - Data can't be modified in transit without detection
3. **Authentication** - You're actually talking to the real server, not an imposter

### SSL vs TLS

- **SSL** (Secure Sockets Layer) - The old version, deprecated, insecure
- **TLS** (Transport Layer Security) - The modern replacement
- People still say "SSL" but they mean TLS. Current version is TLS 1.3

### Certificates

A certificate proves a server's identity. It's like a digital passport.

```
Certificate contains:
  - Domain name (e.g., www.google.com)
  - Public key of the server
  - Who issued it (Certificate Authority - CA)
  - Expiry date
  - Digital signature from the CA
```

**Certificate Authority (CA):** A trusted third party (e.g., Let's Encrypt, DigiCert, Comodo) that verifies the domain owner and signs the certificate. Your browser/OS has a pre-installed list of trusted CAs.

**Chain of Trust:**
```
Root CA (pre-installed in your OS/browser)
  └── Intermediate CA (signed by Root CA)
       └── Your Server's Certificate (signed by Intermediate CA)
```

---

## How HTTPS Works Step by Step

This is the **TLS 1.3 Handshake** - the most commonly asked networking question for developers.

### Symmetric vs Asymmetric Encryption

First, understand two types of encryption:

```
Asymmetric (Public/Private Key):
  - Two keys: public key (share with everyone) and private key (keep secret)
  - Encrypt with public key -> only private key can decrypt
  - Slow, but solves the key distribution problem
  - Used during: TLS handshake

Symmetric (Shared Secret):
  - One key: both sides use the same key to encrypt/decrypt
  - Fast, efficient
  - Problem: how do both sides get the same key securely?
  - Used during: actual data transfer after handshake
```

**TLS uses BOTH:** Asymmetric encryption to safely exchange a symmetric key, then symmetric encryption for all actual data.

### The TLS 1.3 Handshake (Simplified)

```
Client (Browser)                              Server (e.g., google.com)
      |                                              |
      |  1. CLIENT HELLO                             |
      |  - "I support TLS 1.3"                       |
      |  - "I support these cipher suites"           |
      |  - "Here's my random number"                 |
      |  - "Here's my key share" (DH public key)     |
      |--------------------------------------------->|
      |                                              |
      |  2. SERVER HELLO                             |
      |  - "Let's use TLS 1.3"                       |
      |  - "Let's use this cipher suite"             |
      |  - "Here's my random number"                 |
      |  - "Here's my key share" (DH public key)     |
      |  + Certificate (proving identity)            |
      |  + Certificate Verify (signed with priv key) |
      |  + Finished                                  |
      |<---------------------------------------------|
      |                                              |
      |  Both sides now compute the SAME             |
      |  session key using Diffie-Hellman             |
      |  key exchange (math magic)                    |
      |                                              |
      |  3. Client verifies:                          |
      |  - Is the certificate valid?                  |
      |  - Is it signed by a trusted CA?              |
      |  - Does the domain match?                     |
      |  - Is it expired?                             |
      |                                              |
      |  4. FINISHED                                 |
      |  - "I'm done, here's my verification"        |
      |--------------------------------------------->|
      |                                              |
      |  === ENCRYPTED DATA TRANSFER BEGINS ===      |
      |  All HTTP data is now encrypted with          |
      |  the shared symmetric session key             |
      |<=============================================>|
```

### Diffie-Hellman Key Exchange (The Core Idea)

This is how two strangers agree on a shared secret over a public channel:

```
Analogy: Mixing paint colors

1. Alice and Bob publicly agree on a base color: YELLOW
2. Alice picks a secret color: RED
3. Bob picks a secret color: BLUE
4. Alice mixes YELLOW + RED = ORANGE, sends ORANGE to Bob (public)
5. Bob mixes YELLOW + BLUE = GREEN, sends GREEN to Alice (public)
6. Alice mixes GREEN + RED = BROWN (shared secret)
7. Bob mixes ORANGE + BLUE = BROWN (same shared secret!)

An attacker sees: YELLOW, ORANGE, GREEN
But can't figure out BROWN without knowing RED or BLUE.

In real TLS, "mixing" = mathematical operations on very large numbers 
that are easy to do but practically impossible to reverse.
```

### What Happens if HTTPS Fails?

```
Self-signed certificate   -> Browser shows "Not Secure" warning
Expired certificate       -> Browser blocks with error
Domain mismatch           -> Browser blocks with error  
Revoked certificate       -> Browser blocks (checks CRL/OCSP)
Man-in-the-middle attack  -> Certificate won't match, connection refused
```

---

## Cookies, Sessions & Tokens

HTTP is stateless. These mechanisms add state.

### Cookies

```
Server sets a cookie:
  HTTP/1.1 200 OK
  Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600

Browser automatically sends it back on every request:
  GET /dashboard
  Cookie: session_id=abc123
```

**Cookie Attributes:**
| Attribute | Purpose |
|-----------|---------|
| `HttpOnly` | Can't be accessed by JavaScript (prevents XSS theft) |
| `Secure` | Only sent over HTTPS |
| `SameSite=Strict` | Not sent in cross-site requests (prevents CSRF) |
| `SameSite=Lax` | Sent with top-level navigations, not with AJAX |
| `SameSite=None` | Sent everywhere (requires `Secure`) |
| `Domain` | Which domains receive the cookie |
| `Path` | Which paths receive the cookie |
| `Max-Age` / `Expires` | When the cookie dies |

### Session-Based Auth vs Token-Based Auth

```
Session-Based (Traditional):
  1. User logs in with username/password
  2. Server creates a session, stores it in memory/DB/Redis
  3. Server sends back session_id as a cookie
  4. Browser sends cookie on every request
  5. Server looks up session_id to identify user

  Pros: Easy to revoke (delete session from server)
  Cons: Server must store state, hard to scale horizontally

Token-Based (JWT):
  1. User logs in with username/password
  2. Server creates a JWT (JSON Web Token), signs it with a secret
  3. Server sends JWT to client
  4. Client stores JWT (localStorage, cookie, memory)
  5. Client sends JWT in Authorization header: Bearer <token>
  6. Server verifies JWT signature - no lookup needed

  Pros: Stateless, scales easily, works across services
  Cons: Can't easily revoke (until expiry), token size is larger
```

### JWT Structure

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMjN9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ
 |                      |                        |
 Header (base64)       Payload (base64)         Signature
 {"alg":"HS256"}       {"user_id":123}          HMAC(header.payload, secret)
```

**Important:** JWT payload is **base64 encoded, NOT encrypted**. Anyone can decode and read it. The signature only guarantees it wasn't tampered with.

---

## CORS

### Cross-Origin Resource Sharing

**Same-Origin Policy:** Browsers block requests from one origin to a different origin by default.

```
Origin = Protocol + Domain + Port

https://app.com:443   and   https://app.com:443     = Same Origin
https://app.com       and   http://app.com          = Different (protocol)
https://app.com       and   https://api.app.com     = Different (subdomain)
https://app.com       and   https://app.com:8080    = Different (port)
```

### How CORS Works

**Simple Requests** (GET, POST with simple headers): Browser sends the request and checks `Access-Control-Allow-Origin` in the response.

**Preflight Requests** (PUT, DELETE, custom headers, JSON content-type):

```
Step 1: Browser sends a preflight OPTIONS request

  OPTIONS /api/users HTTP/1.1
  Origin: https://myapp.com
  Access-Control-Request-Method: DELETE
  Access-Control-Request-Headers: Authorization

Step 2: Server responds with what's allowed

  HTTP/1.1 204 No Content
  Access-Control-Allow-Origin: https://myapp.com
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE
  Access-Control-Allow-Headers: Authorization, Content-Type
  Access-Control-Max-Age: 86400   (cache preflight for 24 hours)

Step 3: If allowed, browser sends the actual request

  DELETE /api/users/5 HTTP/1.1
  Origin: https://myapp.com
  Authorization: Bearer eyJhbGci...
```

### Common CORS Fixes (for developers)

```javascript
// Express.js
const cors = require('cors');
app.use(cors({
  origin: 'https://myapp.com',     // Don't use '*' in production with credentials
  credentials: true,                 // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

**Interview answer for "What is CORS?"** - CORS is a browser security mechanism that restricts cross-origin HTTP requests. The server must explicitly allow other origins to access its resources by setting appropriate `Access-Control-Allow-*` headers.

---

## WebSockets

### The Problem with HTTP for Real-Time

```
HTTP: Client always initiates. Server can only respond.

Polling (wasteful):
  Client: "Any new messages?"  -> Server: "No"
  Client: "Any new messages?"  -> Server: "No"
  Client: "Any new messages?"  -> Server: "Yes, here!"

Long Polling (better but hacky):
  Client: "Any new messages?" -> Server: *holds connection open*
                               -> Server: "Yes, here!" (after 30s)
  Client: "Any new messages?" -> (repeat)
```

### WebSocket Solution

```
1. Starts as HTTP request (upgrade handshake):

  GET /chat HTTP/1.1
  Upgrade: websocket
  Connection: Upgrade

  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket

2. Connection upgraded to full-duplex WebSocket:

  Client <======= both can send anytime =======> Server
```

**Use cases:** Chat apps, live notifications, collaborative editing, real-time dashboards, multiplayer games.

```javascript
// Client
const ws = new WebSocket('wss://api.example.com/chat');
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: 'general' }));
ws.onmessage = (event) => console.log(JSON.parse(event.data));

// Server (Node.js with ws library)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Broadcast to all clients
    wss.clients.forEach(client => client.send(data));
  });
});
```

---

## REST vs GraphQL vs gRPC

| Feature | REST | GraphQL | gRPC |
|---------|------|---------|------|
| Protocol | HTTP | HTTP | HTTP/2 |
| Data format | JSON | JSON | Protobuf (binary) |
| Endpoints | Multiple (`/users`, `/posts`) | Single (`/graphql`) | Service methods |
| Over-fetching | Common problem | You ask for exactly what you need | Defined by proto schema |
| Under-fetching | Need multiple requests | One request gets all | Streaming support |
| Best for | Simple CRUD APIs, public APIs | Complex UIs, mobile apps | Microservices, internal APIs |
| Learning curve | Low | Medium | Higher |

### REST Example
```
GET /api/users/123          -> Full user object
GET /api/users/123/posts    -> All posts (separate request)
```

### GraphQL Example
```graphql
query {
  user(id: 123) {
    name
    email
    posts(limit: 5) {
      title
    }
  }
}
# One request, exactly the data you need
```

### gRPC
```protobuf
service UserService {
  rpc GetUser(UserRequest) returns (UserResponse);
  rpc ListUsers(Empty) returns (stream UserResponse);  // server streaming
}
```

---

## Caching

### Browser Caching (HTTP Cache Headers)

```
Cache-Control: max-age=3600              -> Cache for 1 hour
Cache-Control: no-cache                  -> Always revalidate with server
Cache-Control: no-store                  -> Never cache (sensitive data)
Cache-Control: public, max-age=31536000  -> Cache for 1 year (static assets)

ETag: "abc123"                           -> Fingerprint of the resource
If-None-Match: "abc123"                  -> "Has it changed?" -> 304 Not Modified
```

### Caching Layers (from closest to farthest)

```
1. Browser Cache        - In user's browser (Cache-Control, ETag)
2. CDN Cache            - Edge servers worldwide (Cloudflare, AWS CloudFront)
3. Reverse Proxy Cache  - Nginx, Varnish at your infrastructure
4. Application Cache    - Redis, Memcached in your backend
5. Database Cache       - Query cache, materialized views
```

### Common Caching Strategy for Full-Stack Apps

```
Static assets (JS, CSS, images):
  - Cache-Control: public, max-age=31536000 (1 year)
  - Use content hashes in filenames: bundle.a1b2c3.js
  - When content changes, filename changes, cache busts automatically

API responses:
  - Cache-Control: no-cache (or short max-age)
  - Use ETag for conditional requests
  - Cache frequently-read data in Redis

HTML pages:
  - Cache-Control: no-cache
  - Always serve fresh (might contain user-specific data)
```

---

## CDN

### Content Delivery Network

A CDN is a network of servers distributed globally that caches your content closer to users.

```
Without CDN:
  User in Tokyo -> Request travels to Server in New York -> Slow (high latency)

With CDN:
  User in Tokyo -> Request goes to CDN edge in Tokyo -> Fast (low latency)
                   (CDN caches static content from your origin server)
```

**What CDNs cache:** Static files (JS, CSS, images, fonts, videos), sometimes API responses.

**Popular CDNs:** Cloudflare, AWS CloudFront, Akamai, Fastly, Vercel Edge Network.

**How it works:**
1. First request: CDN fetches from origin server, caches it, serves to user
2. Subsequent requests: CDN serves directly from cache (cache hit)
3. Cache expires: CDN fetches fresh copy from origin

---

## Load Balancers & Reverse Proxies

### Load Balancer

Distributes incoming traffic across multiple servers.

```
                        ┌──> Server 1 (handles 33% traffic)
Client -> Load Balancer ├──> Server 2 (handles 33% traffic)
                        └──> Server 3 (handles 33% traffic)
```

**Load Balancing Algorithms:**
- **Round Robin** - Rotate through servers one by one
- **Least Connections** - Send to server with fewest active connections
- **IP Hash** - Same client always goes to same server (sticky sessions)
- **Weighted** - Send more traffic to more powerful servers

### Reverse Proxy

Sits in front of your servers and handles requests on their behalf.

```
Client -> Reverse Proxy (Nginx) -> Your App Server
```

**What reverse proxies do:**
- SSL termination (handle HTTPS so your app doesn't have to)
- Load balancing
- Caching static assets
- Compression (gzip/brotli)
- Rate limiting
- Security (hide internal server details)

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location /api/ {
        proxy_pass http://localhost:3000;
    }

    location / {
        root /var/www/html;          # Serve static files directly
        try_files $uri /index.html;  # SPA fallback
    }
}
```

### Forward Proxy vs Reverse Proxy

```
Forward Proxy:  Client -> [Proxy] -> Internet    (hides the client, e.g., VPN)
Reverse Proxy:  Internet -> [Proxy] -> Server    (hides the server, e.g., Nginx)
```

---

## Common Interview Questions

### Q1. What happens when you type a URL in the browser?

**Answer:** DNS lookup resolves domain to IP -> TCP three-way handshake establishes connection -> TLS handshake encrypts the channel -> Browser sends HTTP request -> Server processes and returns HTTP response -> Browser parses HTML, fetches CSS/JS/images -> Browser renders the page. (Expand on each step as needed.)

---

### Q2. What is the difference between HTTP and HTTPS?

**Answer:** HTTPS is HTTP over TLS. The HTTP protocol is identical, but HTTPS wraps the communication in an encrypted TLS channel. This provides three things: **encryption** (data can't be read in transit), **integrity** (data can't be modified), and **authentication** (you're talking to the real server, verified by a certificate from a trusted CA).

---

### Q3. How does TLS/SSL work?

**Answer:** TLS uses a handshake to establish a secure connection. The client and server exchange supported cipher suites, perform a Diffie-Hellman key exchange to derive a shared session key, and the server proves its identity with a certificate. After the handshake, all data is encrypted with symmetric encryption using the shared session key. TLS 1.3 completes this in just 1 round trip (vs 2 in TLS 1.2).

---

### Q4. What is the difference between TCP and UDP?

**Answer:** TCP is connection-oriented, reliable, and ordered - it guarantees delivery through acknowledgments and retransmission. UDP is connectionless, faster, but unreliable - packets may arrive out of order, duplicated, or not at all. HTTP uses TCP. Real-time applications like video streaming or gaming often use UDP.

---

### Q5. Explain the difference between 401 and 403.

**Answer:** **401 Unauthorized** means the server doesn't know who you are - you haven't authenticated (no token, expired token, invalid credentials). **403 Forbidden** means the server knows who you are but you don't have permission to access this resource. Fix for 401: log in. Fix for 403: get proper permissions.

---

### Q6. What is CORS and why does it exist?

**Answer:** CORS (Cross-Origin Resource Sharing) is a browser security mechanism that restricts web pages from making requests to a different origin. It exists to prevent malicious websites from making unauthorized requests to other sites using the user's cookies. The server must explicitly whitelist allowed origins via `Access-Control-Allow-Origin` headers.

---

### Q7. What is the difference between cookie, localStorage, and sessionStorage?

**Answer:**

| Feature | Cookie | localStorage | sessionStorage |
|---------|--------|-------------|----------------|
| Capacity | ~4KB | ~5-10MB | ~5-10MB |
| Sent with requests | Yes, automatically | No | No |
| Expiry | Set by server/client | Never (manual) | Tab close |
| Accessible from | Server + Client | Client only | Client only |
| Scope | Defined by domain/path | Per origin | Per origin + tab |

---

### Q8. How do WebSockets differ from HTTP?

**Answer:** HTTP is request-response and half-duplex (client initiates). WebSocket starts as an HTTP upgrade request, then becomes a persistent, full-duplex connection where both client and server can send messages at any time. WebSocket is ideal for real-time features like chat, notifications, and live data.

---

### Q9. What is a CDN and why would you use one?

**Answer:** A CDN (Content Delivery Network) is a distributed network of servers that caches content at edge locations close to users. Benefits: reduced latency (content served from nearby), reduced load on origin server, DDoS protection, and improved availability. Use it for static assets, media files, and sometimes API responses.

---

### Q10. What is DNS and what happens during a DNS lookup?

**Answer:** DNS (Domain Name System) translates domain names to IP addresses. The lookup follows a hierarchy: browser cache -> OS cache -> recursive resolver (ISP) -> root name server -> TLD name server (.com) -> authoritative name server. The result is cached at each level according to the TTL value to speed up future lookups.

---

### Q11. What is the difference between PUT and PATCH?

**Answer:** **PUT** replaces the entire resource. If you PUT a user object, you must send all fields - missing fields are removed. **PATCH** partially updates a resource. You only send the fields you want to change. PUT is idempotent. PATCH may or may not be idempotent depending on implementation.

---

### Q12. Explain HTTP/2 improvements over HTTP/1.1.

**Answer:** Key improvements: **Multiplexing** (multiple requests/responses over a single TCP connection, eliminating head-of-line blocking at HTTP level), **header compression** (HPACK reduces redundant header data), **binary framing** (faster parsing than text-based HTTP/1.1), and **server push** (server can proactively send resources). These changes are backward-compatible - same HTTP semantics, better transport.

---

### Q13. What are the common security headers every full-stack dev should know?

**Answer:**
```
Content-Security-Policy: default-src 'self'          - Prevent XSS
Strict-Transport-Security: max-age=31536000          - Force HTTPS
X-Content-Type-Options: nosniff                       - Prevent MIME sniffing
X-Frame-Options: DENY                                 - Prevent clickjacking
Referrer-Policy: strict-origin-when-cross-origin      - Control referer leakage
Permissions-Policy: camera=(), microphone=()          - Restrict browser features
```

---

### Q14. What is rate limiting and how is it implemented?

**Answer:** Rate limiting restricts the number of requests a client can make in a time window. Common algorithms:
- **Fixed Window:** 100 requests per minute, resets every minute
- **Sliding Window:** Smooth rate tracking over rolling time period
- **Token Bucket:** Tokens added at fixed rate, each request costs a token, allows bursts
- **Leaky Bucket:** Requests processed at constant rate, excess queued or dropped

Implementation: Usually at the reverse proxy (Nginx), API gateway, or application level using Redis to track request counts per client IP or API key.

---

### Q15. Explain the concept of idempotency in APIs.

**Answer:** An operation is idempotent if performing it multiple times produces the same result as performing it once. `GET /user/5` is idempotent (always returns same user). `DELETE /user/5` is idempotent (user is deleted, calling again still results in user being deleted). `POST /users` is NOT idempotent (each call creates a new user). Idempotency is critical for reliability - if a network error occurs, the client can safely retry idempotent requests without side effects.

---

> **Final Tip:** As a full-stack developer, you don't need to memorize RFCs or know packet-level details. But you MUST understand the request lifecycle (DNS -> TCP -> TLS -> HTTP -> Response), how HTTPS keeps data safe, how caching and CDNs improve performance, and how CORS/cookies/tokens handle authentication across origins. These concepts come up in system design interviews, debugging production issues, and building secure, performant applications.
