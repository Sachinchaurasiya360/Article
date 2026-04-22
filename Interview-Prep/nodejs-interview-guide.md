# Node.js Interview Preparation Guide - Zero to Advanced

> A complete, structured interview prep resource covering every critical Node.js topic with deep answers, code examples, debugging scenarios, and system design questions.

---

## Table of Contents

1. [Beginner Level](#beginner-level)
2. [Intermediate Level](#intermediate-level)
3. [Advanced Level](#advanced-level)
4. [Real-World / System Design Level](#real-world--system-design-level)

---

# Beginner Level

## Q1. What is Node.js, and why would you choose it over other server-side technologies?

**Answer:**

Node.js is a **JavaScript runtime** built on Chrome's V8 engine that lets you run JavaScript on the server. It uses an **event-driven, non-blocking I/O model** that makes it lightweight and efficient for data-intensive real-time applications.

**Node.js is NOT:**
- A framework (Express, Fastify are frameworks)
- A programming language (JavaScript is the language)
- Multi-threaded by default (it uses a single-threaded event loop)

**Why choose Node.js:**

| Concern | Traditional Server (Java/PHP) | Node.js |
|---|---|---|
| Concurrency model | Thread-per-request | Event loop (single thread) |
| I/O handling | Blocking (by default) | Non-blocking (by default) |
| Language | Different from frontend | Same JavaScript everywhere |
| Package ecosystem | Varies | npm - largest in the world |
| Real-time apps | Complex setup | Native with WebSockets |
| JSON handling | Serialization overhead | Native JavaScript objects |

**When Node.js shines:**
- Real-time applications (chat, live dashboards, collaborative tools)
- API gateways and microservices
- Streaming applications
- Server-side rendering of frontend frameworks
- CLI tools and build systems

**When Node.js is NOT ideal:**
- CPU-intensive computation (image processing, ML training)
- Heavy relational database operations with complex joins
- Applications requiring strict multi-threading

**Why interviewer asks this:** To check if you understand the architectural trade-offs, not just "it's JavaScript on the server."

**Follow-up:** *Can Node.js handle CPU-intensive tasks at all?*

Yes - using Worker Threads (introduced in Node 10.5), child processes, or offloading to external services. The event loop stays free while workers handle heavy computation.

---

## Q2. Explain the Event Loop in Node.js. How does it work?

**Answer:**

The Event Loop is the **core mechanism** that allows Node.js to perform non-blocking I/O operations despite JavaScript being single-threaded. It offloads operations to the system kernel whenever possible.

**The Event Loop has 6 phases, executed in order:**

```
   ┌───────────────────────────┐
┌─>│        timers              │  ← setTimeout, setInterval callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     pending callbacks      │  ← I/O callbacks deferred to next loop
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │       idle, prepare        │  ← internal use only
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │          poll              │  ← retrieve new I/O events; execute I/O callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │         check              │  ← setImmediate callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     close callbacks        │  ← socket.on('close', ...)
│  └──────────┴────────────────┘
│             │
└─────────────┘
```

**Between each phase**, Node.js checks for:
1. **Microtasks queue** (`process.nextTick` callbacks)
2. **Promise microtasks** (resolved Promise callbacks)

```javascript
console.log('1 - start');

setTimeout(() => console.log('2 - setTimeout'), 0);

Promise.resolve().then(() => console.log('3 - Promise'));

process.nextTick(() => console.log('4 - nextTick'));

console.log('5 - end');

// Output:
// 1 - start
// 5 - end
// 4 - nextTick
// 3 - Promise
// 2 - setTimeout
```

**Why this order?**
- Synchronous code runs first (1, 5)
- `process.nextTick` fires before any other async (4) - it's a microtask with highest priority
- Promise `.then()` fires next (3) - also a microtask but after nextTick
- `setTimeout` fires in the timers phase of the next event loop iteration (2)

**Why interviewer asks this:** The event loop is the heart of Node.js. If you can't explain it, everything else (async patterns, performance, debugging) becomes guesswork.

**Follow-up:** *What happens if you flood `process.nextTick` with recursive calls?*

It starves the event loop. `nextTick` callbacks are processed before moving to the next phase, so recursive `nextTick` calls prevent I/O from ever being handled. This is a known footgun - prefer `setImmediate` for recursive async operations.

---

## Q3. What is the difference between `require()` and `import`?

**Answer:**

These are two different module systems in Node.js:

| Feature | `require()` (CommonJS) | `import` (ES Modules) |
|---|---|---|
| Loading | Synchronous | Asynchronous |
| When parsed | Runtime | Parse time (static analysis) |
| Tree shaking | Not possible | Possible (dead code elimination) |
| Top-level await | Not supported | Supported |
| File extension | `.js` (default), `.cjs` | `.mjs` or `.js` with `"type": "module"` |
| `this` at top level | `module.exports` | `undefined` |
| Dynamic import | `require(variable)` | `import(variable)` (returns Promise) |

```javascript
// CommonJS
const fs = require('fs');
const { readFile } = require('fs');
module.exports = { myFunction };
module.exports = myFunction;

// ES Modules
import fs from 'fs';
import { readFile } from 'fs';
export { myFunction };
export default myFunction;
```

**Key gotcha - circular dependencies:**

```javascript
// CommonJS handles circular deps by returning partially loaded modules
// a.js
const b = require('./b'); // gets whatever b.js has exported SO FAR
module.exports = { fromA: true };

// b.js
const a = require('./a'); // gets {} (a.js hasn't finished exporting yet)
module.exports = { fromB: true };
```

ESM handles this differently - imports are **live bindings** (references), so they always reflect the current value.

**Why interviewer asks this:** Tests whether you understand the module system evolution and practical implications for code organization.

**Follow-up:** *Can you use `require()` inside an ES Module?*

Not directly. You'd need to use `createRequire` from the `module` package:
```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
```

---

## Q4. What are Streams in Node.js? Why are they important?

**Answer:**

Streams are **collections of data that might not be available all at once** and don't have to fit in memory. They let you process data piece-by-piece as it arrives, rather than loading everything into memory first.

**Four types of streams:**

| Type | Description | Example |
|---|---|---|
| **Readable** | Source of data | `fs.createReadStream()`, HTTP request |
| **Writable** | Destination for data | `fs.createWriteStream()`, HTTP response |
| **Duplex** | Both readable and writable | TCP socket, WebSocket |
| **Transform** | Duplex that modifies data passing through | `zlib.createGzip()`, encryption |

**Why streams matter - the memory problem:**

```javascript
// BAD - loads entire file into memory
const data = fs.readFileSync('huge-file.csv'); // 2GB file = 2GB RAM
res.send(data);

// GOOD - streams chunk by chunk (~64KB at a time)
const stream = fs.createReadStream('huge-file.csv');
stream.pipe(res); // Memory usage stays constant regardless of file size
```

**Practical example - file compression pipeline:**

```javascript
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

async function compressFile(input, output) {
  await pipeline(
    fs.createReadStream(input),
    zlib.createGzip(),
    fs.createWriteStream(output)
  );
  console.log('Compression complete');
}

compressFile('access.log', 'access.log.gz');
```

**Why interviewer asks this:** Streams are what make Node.js performant for I/O. Candidates who only use `readFileSync` everywhere reveal they don't understand Node's strengths.

**Follow-up:** *What is backpressure, and why does it matter?*

Backpressure occurs when a writable stream can't consume data as fast as the readable stream produces it. Without handling it, data queues up in memory. `pipe()` and `pipeline()` handle backpressure automatically by pausing the readable stream when the writable stream's internal buffer is full.

---

## Q5. Explain `process.nextTick()` vs `setImmediate()` vs `setTimeout()`.

**Answer:**

All three schedule asynchronous execution, but at **different points in the event loop:**

| Function | When it executes | Priority |
|---|---|---|
| `process.nextTick()` | After current operation, before event loop continues | Highest (microtask) |
| `Promise.then()` | After nextTick, before event loop continues | High (microtask) |
| `setTimeout(fn, 0)` | In the **timers** phase of the next event loop iteration | Normal |
| `setImmediate()` | In the **check** phase of the current event loop iteration | Normal |

```javascript
setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout'), 0);
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));

// Guaranteed output:
// nextTick
// promise
// Then setTimeout and setImmediate order depends on system performance
```

**Inside an I/O callback, the order IS deterministic:**

```javascript
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('setTimeout'), 0);
  setImmediate(() => console.log('setImmediate'));
});

// Always outputs:
// setImmediate (check phase runs right after poll phase)
// setTimeout (timers phase runs in next iteration)
```

**When to use which:**
- `process.nextTick`: When you need something to run immediately after the current function completes but before any I/O
- `setImmediate`: When you want to execute after I/O events in the current loop iteration
- `setTimeout(fn, 0)`: When you want to defer to the next event loop iteration

**Why interviewer asks this:** This directly tests event loop understanding. Getting the order wrong means you'll write race conditions in production.

---

## Q6. What is the difference between `__dirname`, `__filename`, and `process.cwd()`?

**Answer:**

```javascript
// Given: /home/user/projects/myapp/src/utils/helper.js

console.log(__filename);    // /home/user/projects/myapp/src/utils/helper.js
console.log(__dirname);     // /home/user/projects/myapp/src/utils
console.log(process.cwd()); // /home/user/projects/myapp (where you ran `node`)
```

| Variable | Returns | Changes with working directory? |
|---|---|---|
| `__filename` | Absolute path of the current file | No - always the file's location |
| `__dirname` | Directory of the current file | No - always the file's directory |
| `process.cwd()` | Current working directory of the process | Yes - depends on where `node` was invoked |

**In ES Modules** (`__dirname` and `__filename` don't exist):

```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**Why interviewer asks this:** Path-related bugs are common. If you use `process.cwd()` where you meant `__dirname`, your app breaks when run from a different directory.

---

## Q7. What is the purpose of `package.json`? Explain key fields.

**Answer:**

`package.json` is the **manifest file** for any Node.js project. It holds metadata, dependencies, scripts, and configuration.

**Critical fields:**

```json
{
  "name": "my-api",
  "version": "2.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "type": "module",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "test": "jest --coverage"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Dependency version semantics:**

| Prefix | Meaning | Example: `"^4.18.2"` allows |
|---|---|---|
| `^` (caret) | Compatible with version | `4.18.2` to `4.x.x` (not `5.0.0`) |
| `~` (tilde) | Approximately equivalent | `4.18.2` to `4.18.x` (not `4.19.0`) |
| None | Exact version only | Only `4.18.2` |
| `*` | Any version | Any |

**`dependencies` vs `devDependencies`:** `devDependencies` are NOT installed when `NODE_ENV=production` or when running `npm install --production`. Put test runners, linters, and build tools in `devDependencies`.

**Why interviewer asks this:** Surprisingly many developers can't explain version semantics or the difference between `dependencies` and `devDependencies`.

---

## Q8. How does error handling work in Node.js?

**Answer:**

Node.js has multiple error handling patterns depending on the context:

**1. Synchronous code - try/catch:**
```javascript
try {
  JSON.parse('invalid json');
} catch (err) {
  console.error('Parse failed:', err.message);
}
```

**2. Callbacks - error-first pattern:**
```javascript
fs.readFile('/missing.txt', (err, data) => {
  if (err) {
    console.error('Read failed:', err.message);
    return;
  }
  console.log(data.toString());
});
```

**3. Promises - .catch() or try/catch with async/await:**
```javascript
// Promise chain
fetch('https://api.example.com/data')
  .then(res => res.json())
  .catch(err => console.error('Fetch failed:', err.message));

// async/await
async function getData() {
  try {
    const res = await fetch('https://api.example.com/data');
    return await res.json();
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}
```

**4. Event emitters:**
```javascript
const stream = fs.createReadStream('file.txt');
stream.on('error', (err) => {
  console.error('Stream error:', err.message);
});
```

**5. Global handlers (last resort - not for recovery):**
```javascript
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  process.exit(1); // Always exit - state is unreliable
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
```

**Why interviewer asks this:** Unhandled errors crash Node.js processes. Knowing all the error surfaces proves production readiness.

---

# Intermediate Level

## Q9. Explain the Cluster module and how to scale Node.js across CPU cores.

**Answer:**

Node.js runs on a single thread, which means it uses only **one CPU core** by default. The `cluster` module lets you fork multiple worker processes that share the same server port.

```javascript
const cluster = require('cluster');
const http = require('http');
const os = require('os');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork(); // Auto-restart crashed workers
  });
} else {
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Handled by worker ${process.pid}\n`);
  }).listen(8000);

  console.log(`Worker ${process.pid} started`);
}
```

**How it works:**
- The **primary process** manages workers but doesn't serve requests
- Each **worker** is a separate Node.js process with its own event loop and memory
- Workers share the server port via the OS (round-robin on Linux, handle-based on Windows)
- Workers communicate with the primary via IPC (`worker.send()` / `process.on('message')`)

**In production, use PM2 instead of raw cluster:**
```bash
pm2 start app.js -i max  # Forks one worker per CPU core
pm2 reload app.js        # Zero-downtime restart
```

**Why interviewer asks this:** Tests whether you know Node.js is single-threaded AND how to work around it in production.

**Follow-up:** *How is this different from Worker Threads?*

Cluster forks separate **processes** (separate memory, separate V8 instances). Worker Threads share the same process memory and can transfer data via `SharedArrayBuffer`. Use cluster for scaling HTTP servers; use Worker Threads for CPU-intensive tasks within a single process.

---

## Q10. What are Worker Threads? When would you use them?

**Answer:**

Worker Threads (introduced Node.js 10.5) let you run JavaScript in **parallel threads within the same process**, sharing memory when needed.

```javascript
// main.js
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
  const worker = new Worker(__filename, {
    workerData: { number: 40 }
  });

  worker.on('message', (result) => {
    console.log(`Fibonacci result: ${result}`);
  });

  worker.on('error', (err) => console.error(err));
} else {
  // This runs in the worker thread
  function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  }

  const result = fibonacci(workerData.number);
  parentPort.postMessage(result);
}
```

**Worker Threads vs Cluster vs Child Process:**

| Feature | Worker Threads | Cluster | Child Process |
|---|---|---|---|
| Isolation | Same process | Separate processes | Separate processes |
| Memory sharing | Yes (`SharedArrayBuffer`) | No | No |
| Overhead | Low | High (full V8 per process) | High |
| Use case | CPU-intensive tasks | Scaling HTTP servers | Running shell commands |
| Communication | `postMessage` / shared memory | IPC | stdin/stdout/IPC |

**When to use Worker Threads:**
- Image/video processing
- Cryptographic operations
- Data compression
- CSV/JSON parsing of large files
- Any computation that would block the event loop for >50ms

**Why interviewer asks this:** Distinguishes candidates who know how to handle CPU-bound work without blocking the event loop.

---

## Q11. Explain middleware in Express.js. How does the middleware chain work?

**Answer:**

Middleware functions are functions that have access to the **request object, response object, and the `next` function**. They execute sequentially in the order they are defined.

```javascript
const express = require('express');
const app = express();

// Middleware execution order: top to bottom

// 1. Logging middleware (runs on EVERY request)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${Date.now()}`);
  next(); // Pass control to next middleware
});

// 2. Authentication middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
    // No next() call = chain stops here
  }
  req.user = verifyToken(token);
  next();
}

// 3. Route-specific middleware
app.get('/dashboard', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// 4. Error-handling middleware (4 arguments)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
```

**The middleware chain:**

```
Request → Logger → Auth → Route Handler → Response
                    ↓ (if no token)
                 401 Response
```

**Key rules:**
- Middleware executes **in definition order** - order matters
- Call `next()` to pass control to the next middleware
- If you don't call `next()` and don't send a response, the request hangs
- Error-handling middleware has **4 parameters** `(err, req, res, next)`
- Calling `next(err)` skips to the error-handling middleware

**Why interviewer asks this:** Middleware is the backbone of Express. Not understanding the chain means you can't debug routing issues or build proper auth/logging/validation layers.

---

## Q12. How does Node.js handle asynchronous operations under the hood?

**Answer:**

Node.js uses **libuv**, a C library that provides the event loop and a **thread pool** for operations that can't be done asynchronously at the OS level.

```
                     ┌─────────────────┐
                     │   Your JS Code  │
                     └────────┬────────┘
                              │
                     ┌────────┴────────┐
                     │    Node.js API   │
                     │  (fs, crypto,    │
                     │   dns, http)     │
                     └────────┬────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
     ┌────────┴────────┐            ┌────────┴────────┐
     │   OS Async APIs  │            │  libuv Thread   │
     │  (epoll, kqueue, │            │     Pool        │
     │   IOCP)          │            │  (4 threads     │
     │                  │            │   by default)   │
     │  - TCP/UDP       │            │  - fs ops       │
     │  - Networking    │            │  - DNS lookup   │
     └─────────────────┘            │  - crypto       │
                                    │  - zlib         │
                                    └─────────────────┘
```

**What goes where:**

| Handled by OS (truly async) | Handled by thread pool |
|---|---|
| Network I/O (HTTP, TCP, UDP) | File system operations |
| Timers | DNS lookups (`dns.lookup`) |
| Signal handling | Crypto (pbkdf2, scrypt) |
| Child processes | Compression (zlib) |

**Thread pool size:**
```bash
# Default: 4 threads
UV_THREADPOOL_SIZE=8 node app.js  # Increase to 8 (max 1024)
```

If you have heavy file I/O or crypto, increasing the thread pool size can significantly improve throughput.

**Why interviewer asks this:** Tests deep understanding beyond "Node.js is single-threaded." Candidates who know about libuv's thread pool understand why `fs` operations can still run concurrently.

---

## Q13. What is the Buffer class in Node.js?

**Answer:**

`Buffer` is a class for handling **raw binary data** directly in memory, outside the V8 heap. It's essential because JavaScript's string type is UTF-16 encoded and not suitable for binary protocols, file I/O, or network operations.

```javascript
// Creating Buffers
const buf1 = Buffer.alloc(10);           // 10 zero-filled bytes
const buf2 = Buffer.from('Hello');       // From string (UTF-8 default)
const buf3 = Buffer.from([72, 101]);     // From byte array → 'He'

// Reading Buffers
console.log(buf2.toString());            // 'Hello'
console.log(buf2.toString('hex'));       // '48656c6c6f'
console.log(buf2.toString('base64'));    // 'SGVsbG8='
console.log(buf2[0]);                    // 72 (ASCII code for 'H')

// Buffer operations
const combined = Buffer.concat([buf2, Buffer.from(' World')]);
console.log(combined.toString());        // 'Hello World'

// Comparing
Buffer.compare(buf1, buf2);             // -1, 0, or 1
buf2.equals(Buffer.from('Hello'));       // true

// Slicing (shares memory - NOT a copy!)
const slice = buf2.slice(0, 2);
slice[0] = 74; // Changes buf2 too!
console.log(buf2.toString());           // 'Jello'
```

**Common use cases:**
- Reading binary files (images, PDFs)
- Network protocols (TCP packets)
- Cryptographic operations
- Encoding/decoding (Base64, hex)
- Streaming data transformations

**Security note:** Never use `Buffer.allocUnsafe()` for data going to users - it may contain old memory contents. Use `Buffer.alloc()` which zero-fills.

**Why interviewer asks this:** Buffers are fundamental to Node.js I/O. If you're only working with strings, you're missing a core concept.

---

## Q14. Explain the difference between `spawn`, `exec`, `execFile`, and `fork` in the `child_process` module.

**Answer:**

| Method | Returns | Shell? | Use Case |
|---|---|---|---|
| `spawn` | Stream (stdout/stderr) | No | Long-running processes, large output |
| `exec` | Buffer (callback) | Yes | Short commands, need shell features |
| `execFile` | Buffer (callback) | No | Run a specific binary (safer) |
| `fork` | ChildProcess with IPC | No | Run another Node.js script |

```javascript
const { spawn, exec, execFile, fork } = require('child_process');

// spawn - streams output in real-time
const ls = spawn('ls', ['-la', '/tmp']);
ls.stdout.on('data', (data) => console.log(data.toString()));
ls.on('close', (code) => console.log(`Exited with code ${code}`));

// exec - buffers entire output, supports shell syntax
exec('ls -la | grep node', (err, stdout, stderr) => {
  console.log(stdout);
});

// execFile - runs a binary directly (no shell injection risk)
execFile('/usr/bin/git', ['status'], (err, stdout) => {
  console.log(stdout);
});

// fork - spawns a new Node.js process with IPC channel
const worker = fork('./worker.js');
worker.send({ task: 'process_data', payload: [1, 2, 3] });
worker.on('message', (result) => console.log(result));
```

**Security:** `exec` runs in a shell, so it's vulnerable to **command injection** if you pass unsanitized user input. Always prefer `spawn` or `execFile` with argument arrays when handling user input.

```javascript
// DANGEROUS - command injection
exec(`ls ${userInput}`); // userInput = "; rm -rf /"

// SAFE - arguments are escaped
spawn('ls', [userInput]);
```

**Why interviewer asks this:** Tests understanding of process management and security awareness.

---

## Q15. What is `EventEmitter`? How do you create custom events?

**Answer:**

`EventEmitter` is the foundation of Node.js's event-driven architecture. Most core modules (`http`, `fs`, `stream`, `net`) inherit from it.

```javascript
const EventEmitter = require('events');

class OrderService extends EventEmitter {
  placeOrder(order) {
    // Business logic
    this.emit('order:placed', order);

    if (order.total > 1000) {
      this.emit('order:high-value', order);
    }
  }
}

const service = new OrderService();

// Register listeners
service.on('order:placed', (order) => {
  console.log(`Order ${order.id} placed`);
});

service.on('order:placed', (order) => {
  sendConfirmationEmail(order.customer);
});

service.on('order:high-value', (order) => {
  notifyManagerSlack(order);
});

// One-time listener
service.once('order:placed', (order) => {
  console.log('First order of the session!');
});

service.placeOrder({ id: 1, total: 1500, customer: 'alice@example.com' });
```

**Important patterns:**

```javascript
// Memory leak detection - default max is 10 listeners per event
service.setMaxListeners(20);

// Remove listeners
const handler = () => console.log('hello');
service.on('event', handler);
service.removeListener('event', handler);

// Error events are special - unhandled 'error' events crash the process
service.on('error', (err) => {
  console.error('Service error:', err);
});
```

**Why interviewer asks this:** The event emitter pattern is used everywhere in Node.js. Understanding it means understanding how HTTP servers, streams, and sockets work internally.

---

## Q16. How do you handle environment variables and configuration in Node.js?

**Answer:**

Environment variables are accessed via `process.env` and are **always strings**.

```javascript
// Reading environment variables
const port = parseInt(process.env.PORT, 10) || 3000;
const dbUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

// Common pattern with dotenv
require('dotenv').config();
// Reads .env file and populates process.env
```

**.env file (never commit this):**
```
DATABASE_URL=postgres://localhost:5432/myapp
JWT_SECRET=super-secret-key
PORT=3000
NODE_ENV=development
```

**Best practices:**

```javascript
// config.js - centralized configuration with validation
const config = {
  port: requireEnv('PORT', '3000'),
  database: {
    url: requireEnv('DATABASE_URL'),
    pool: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};

function requireEnv(key, defaultValue) {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

module.exports = config;
```

**Why interviewer asks this:** Configuration management is a production-readiness signal. Hardcoded secrets and missing validation are red flags.

---

# Advanced Level

## Q17. Explain the V8 garbage collection process. How do you identify and fix memory leaks?

**Answer:**

V8 uses a **generational garbage collector** with two main spaces:

```
 Heap
 ┌─────────────────────────────────────────┐
 │  Young Generation (Semi-space)          │
 │  ┌──────────────┬──────────────┐        │
 │  │  From-space   │   To-space   │        │  ← Scavenge (minor GC)
 │  │  (active)     │   (empty)    │        │     Fast, frequent
 │  └──────────────┴──────────────┘        │     Objects that survive
 │                                          │     2 scavenges get promoted
 ├──────────────────────────────────────────┤
 │  Old Generation                          │
 │  ┌──────────────────────────────┐        │  ← Mark-Sweep-Compact
 │  │  Long-lived objects           │        │     Slower, less frequent
 │  │  Promoted from young gen      │        │
 │  └──────────────────────────────┘        │
 └──────────────────────────────────────────┘
```

**Common memory leak sources:**

```javascript
// 1. Global variables (never GC'd)
global.cache = {}; // Grows forever

// 2. Closures holding references
function createHandler() {
  const hugeData = loadGigabytesOfData();
  return (req, res) => {
    // hugeData is captured in closure - never freed
    res.json(hugeData.summary);
  };
}

// 3. Event listeners not removed
class UserConnection {
  connect(socket) {
    // New listener added on each reconnect - never removed!
    socket.on('data', this.handleData.bind(this));
  }
}

// 4. Forgotten timers
const interval = setInterval(() => {
  cache.push(fetchNewData()); // cache grows forever
}, 1000);
// Missing: clearInterval(interval) on shutdown
```

**Debugging memory leaks:**

```bash
# Start with heap inspection flags
node --inspect app.js

# Take heap snapshots
node --expose-gc -e "
  global.gc();
  const used = process.memoryUsage();
  console.log('Heap used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
"
```

```javascript
// Programmatic monitoring
setInterval(() => {
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  console.log({
    heapUsed: `${Math.round(heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(rss / 1024 / 1024)}MB`,
  });
}, 10000);
```

**Why interviewer asks this:** Memory leaks are the #1 production issue in long-running Node.js services. This question separates experienced developers from those who've only built tutorials.

---

## Q18. What is `libuv` and why is it critical to Node.js?

**Answer:**

libuv is the **C library** that provides Node.js with its event loop, async I/O, thread pool, and cross-platform abstraction layer. Without libuv, Node.js wouldn't exist.

**What libuv provides:**

| Feature | Implementation |
|---|---|
| Event loop | Platform-specific: epoll (Linux), kqueue (macOS), IOCP (Windows) |
| Thread pool | 4 threads by default, handles blocking I/O |
| Async TCP/UDP | Wraps OS-level non-blocking sockets |
| File system ops | Runs on thread pool (most OS don't support async FS) |
| DNS resolution | `dns.lookup()` on thread pool, `dns.resolve()` via c-ares (async) |
| Timers | Efficient min-heap implementation |
| Child processes | Cross-platform process spawning |
| Signal handling | Unix signals abstraction |

**Why `dns.lookup()` vs `dns.resolve()` matters:**

```javascript
// dns.lookup() - uses thread pool (can be bottleneck)
dns.lookup('example.com', (err, address) => {});

// dns.resolve() - uses c-ares library (truly async, bypasses thread pool)
dns.resolve('example.com', (err, addresses) => {});
```

If your app makes many DNS lookups and file operations simultaneously, they compete for the same 4 thread pool threads. Solutions:
1. Increase `UV_THREADPOOL_SIZE`
2. Use `dns.resolve()` instead of `dns.lookup()`
3. Use DNS caching

**Why interviewer asks this:** Shows understanding of Node.js internals beyond JavaScript. Critical for performance tuning and debugging.

---

## Q19. How do you secure a Node.js application?

**Answer:**

Security must be addressed at **multiple layers:**

**1. Input Validation and Sanitization:**
```javascript
// Use a validation library - never trust user input
const Joi = require('joi');

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(0).max(150),
  name: Joi.string().max(100).pattern(/^[a-zA-Z\s]+$/),
});

app.post('/users', (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  // Use validated `value`, not raw `req.body`
});
```

**2. HTTP Security Headers:**
```javascript
const helmet = require('helmet');
app.use(helmet()); // Sets 15+ security headers automatically

// Includes:
// - Content-Security-Policy
// - X-Content-Type-Options: nosniff
// - Strict-Transport-Security
// - X-Frame-Options
// - X-XSS-Protection
```

**3. Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,
}));
```

**4. SQL/NoSQL Injection Prevention:**
```javascript
// NEVER interpolate user input into queries
// BAD
db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);

// GOOD - parameterized queries
db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
```

**5. Authentication best practices:**
- Hash passwords with bcrypt (cost factor >= 12)
- Use short-lived JWTs with refresh tokens
- Implement CSRF protection for cookie-based auth
- Never store secrets in code or version control

**6. Dependency security:**
```bash
npm audit              # Check for known vulnerabilities
npm audit fix          # Auto-fix where possible
npx snyk test          # Deep vulnerability scanning
```

**Why interviewer asks this:** Security is non-negotiable in production. Interviewers test breadth of awareness across the OWASP Top 10.

---

## Q20. Explain how you'd implement graceful shutdown in Node.js.

**Answer:**

Graceful shutdown ensures in-flight requests complete before the process exits, preventing data corruption and dropped connections.

```javascript
const http = require('http');

const server = http.createServer(app);
const connections = new Set();

// Track all open connections
server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');

    // 3. Close database connections, flush logs, etc.
    Promise.all([
      database.disconnect(),
      messageQueue.close(),
      cache.quit(),
    ]).then(() => {
      console.log('All resources released');
      process.exit(0);
    });
  });

  // 2. Close idle keep-alive connections
  for (const conn of connections) {
    conn.end();
  }

  // 4. Force kill after timeout (safety net)
  setTimeout(() => {
    console.error('Forced shutdown - timeout exceeded');
    process.exit(1);
  }, 30000).unref(); // .unref() so timer doesn't keep process alive
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

**Why this matters:**
- **Kubernetes** sends SIGTERM before killing pods - without graceful shutdown, requests get 502 errors
- **Database transactions** in progress can be left in an inconsistent state
- **Message queue consumers** might lose unacknowledged messages

**Why interviewer asks this:** This is a production-readiness litmus test. If you've never thought about shutdown behavior, you haven't run Node.js in production.

---

## Q21. What are ES2024+ features that are important for modern Node.js development?

**Answer:**

**1. Top-Level Await (ES2022):**
```javascript
// Works in ES modules - no need to wrap in async function
const config = await loadConfig();
const db = await connectDatabase(config.dbUrl);

export { db };
```

**2. Structured Clone (Node 17+):**
```javascript
// Deep clone without JSON.parse(JSON.stringify()) hacks
const original = { date: new Date(), map: new Map([['key', 'val']]) };
const clone = structuredClone(original);
// Handles Date, Map, Set, ArrayBuffer, RegExp - JSON doesn't
```

**3. `Array.groupBy` and `Map.groupBy`:**
```javascript
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Charlie', role: 'admin' },
];

const grouped = Object.groupBy(users, (user) => user.role);
// { admin: [Alice, Charlie], user: [Bob] }
```

**4. `AbortController` for cancellation:**
```javascript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000); // 5s timeout

try {
  const response = await fetch('https://api.example.com/data', {
    signal: controller.signal,
  });
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

**5. Native Fetch API (Node 18+):**
```javascript
// No more installing node-fetch or axios for simple requests
const res = await fetch('https://api.example.com/data');
const data = await res.json();
```

**6. Node.js built-in test runner (Node 18+):**
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('math', () => {
  it('should add', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
```

**Why interviewer asks this:** Shows you stay current and use modern, idiomatic patterns instead of outdated workarounds.

---

## Q22. How does Node.js handle TCP connections and the HTTP module internally?

**Answer:**

Node.js `http.createServer()` is a thin wrapper over `net.createServer()` which handles raw TCP:

```
Client Request
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  TCP Socket  │────>│  HTTP Parser  │────>│  Your Handler │
│  (net module)│     │ (llhttp in C) │     │  (req, res)   │
└─────────────┘     └──────────────┘     └──────────────┘
```

**Connection lifecycle:**

```javascript
const net = require('net');

// Raw TCP server
const server = net.createServer((socket) => {
  // socket is a Duplex stream
  console.log('Client connected:', socket.remoteAddress);

  socket.on('data', (data) => {
    // Raw bytes from client
    console.log('Received:', data.toString());
    socket.write('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nHello');
  });

  socket.on('end', () => console.log('Client disconnected'));
  socket.on('error', (err) => console.error('Socket error:', err));
});

server.listen(3000);
```

**HTTP Keep-Alive and connection pooling:**

```javascript
const http = require('http');

// Default agent reuses TCP connections
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,        // Max concurrent connections per host
  maxFreeSockets: 10,    // Max idle connections to keep alive
  timeout: 60000,        // Socket timeout
});

http.get('http://api.example.com/data', { agent }, (res) => {
  // Connection is reused for subsequent requests to same host
});
```

**Why interviewer asks this:** Understanding the TCP layer explains HTTP behavior (keep-alive, connection limits, timeouts, backpressure) and is crucial for debugging network issues.

---

## Q23. What are design patterns commonly used in Node.js?

**Answer:**

**1. Singleton (Module Caching):**
```javascript
// database.js - Node's require cache makes this a natural singleton
let connection = null;

module.exports = {
  async getConnection() {
    if (!connection) {
      connection = await createDatabaseConnection();
    }
    return connection;
  }
};

// Every require('./database') gets the same instance
```

**2. Factory Pattern:**
```javascript
function createLogger(prefix) {
  return {
    info: (msg) => console.log(`[${prefix}] INFO: ${msg}`);
    error: (msg) => console.error(`[${prefix}] ERROR: ${msg}`);
  };
}

const authLogger = createLogger('AUTH');
const dbLogger = createLogger('DB');
```

**3. Observer Pattern (EventEmitter):**
```javascript
class PaymentProcessor extends EventEmitter {
  async processPayment(payment) {
    const result = await chargeCard(payment);
    this.emit('payment:success', result);  // Decoupled side effects
  }
}

processor.on('payment:success', sendReceipt);
processor.on('payment:success', updateAnalytics);
processor.on('payment:success', notifyWarehouse);
```

**4. Middleware / Chain of Responsibility:**
```javascript
// Express middleware IS this pattern
app.use(cors());
app.use(helmet());
app.use(authenticate);
app.use(authorize('admin'));
app.use(rateLimiter);
```

**5. Repository Pattern:**
```javascript
class UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findById(id) {
    return this.db.query('SELECT * FROM users WHERE id = $1', [id]);
  }

  async create(userData) {
    return this.db.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [userData.name, userData.email]
    );
  }
}
```

**Why interviewer asks this:** Tests ability to write maintainable, testable code beyond "it works." Senior roles require pattern awareness.

---

## Q24. How does Node.js handle backpressure in streams?

**Answer:**

Backpressure occurs when a writable stream can't process data as fast as a readable stream produces it. Without proper handling, data accumulates in memory.

```javascript
// PROBLEM: No backpressure handling
readable.on('data', (chunk) => {
  writable.write(chunk); // What if writable is slow? Data buffers in memory!
});

// writable.write() returns false when internal buffer exceeds highWaterMark
```

**How `pipe()` handles backpressure automatically:**

```
readable.pipe(writable)

Readable          Writable
   │                 │
   │── chunk ──────>│ buffer < highWaterMark → write returns true
   │── chunk ──────>│ buffer >= highWaterMark → write returns FALSE
   │                 │
   │ readable.pause()│ ← pipe calls pause on readable
   │                 │
   │    (waiting)    │ writable drains buffer...
   │                 │
   │ readable.resume()← 'drain' event fired, pipe resumes readable
   │                 │
   │── chunk ──────>│ continues normally
```

**Manual backpressure handling:**

```javascript
const readable = fs.createReadStream('huge-file.csv');
const writable = fs.createWriteStream('output.csv');

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);

  if (!canContinue) {
    // Buffer is full - pause until drained
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});

readable.on('end', () => writable.end());
```

**Best practice - use `pipeline()` (handles errors + backpressure):**

```javascript
const { pipeline } = require('stream/promises');

await pipeline(
  fs.createReadStream('input.csv'),
  transformStream,
  fs.createWriteStream('output.csv')
);
// Handles backpressure, error propagation, and cleanup automatically
```

**Why interviewer asks this:** Backpressure bugs cause memory exhaustion in production. This question tests whether you've worked with real data volumes.

---

# Real-World / System Design Level

## Q25. Design a rate limiter for a Node.js API.

**Answer:**

**Requirements:** Limit each user/IP to N requests per time window. Must work across multiple server instances.

**Approach: Sliding Window with Redis**

```javascript
const Redis = require('ioredis');
const redis = new Redis();

async function slidingWindowRateLimiter(req, res, next) {
  const key = `rate:${req.ip}`;
  const windowMs = 60 * 1000;  // 1 minute
  const maxRequests = 100;
  const now = Date.now();

  // Use Redis sorted set: score = timestamp, member = unique request ID
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, now - windowMs);  // Remove expired entries
  pipeline.zadd(key, now, `${now}:${Math.random()}`); // Add current request
  pipeline.zcard(key);                                  // Count requests in window
  pipeline.expire(key, Math.ceil(windowMs / 1000));    // TTL cleanup

  const results = await pipeline.exec();
  const requestCount = results[2][1];

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': Math.max(0, maxRequests - requestCount),
    'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
  });

  if (requestCount > maxRequests) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(windowMs / 1000),
    });
  }

  next();
}

app.use('/api/', slidingWindowRateLimiter);
```

**Why sliding window over fixed window?**

| Algorithm | Pros | Cons |
|---|---|---|
| Fixed window | Simple, low memory | Burst at window boundary (2x rate) |
| Sliding window log | Accurate | More memory (stores all timestamps) |
| Sliding window counter | Good balance | Slight approximation |
| Token bucket | Allows controlled bursts | More complex |

**Scaling considerations:**
- Redis makes this work across multiple Node.js instances
- Use `MULTI/EXEC` or Lua scripts for atomic operations
- Consider separate limits for different endpoints (login stricter than read)
- Add IP allowlisting for internal services

**Why interviewer asks this:** Tests distributed systems thinking, Redis knowledge, and understanding of API protection patterns.

---

## Q26. How would you design a job queue system in Node.js?

**Answer:**

**Requirements:** Process background tasks (emails, image resize, reports) reliably, with retries and concurrency control.

**Architecture:**

```
Producer (API Server)          Queue (Redis)          Consumer (Worker)
     │                            │                        │
     │── enqueue job ──────────> │                        │
     │                            │ <── poll for jobs ─── │
     │                            │ ── deliver job ──────>│
     │                            │                        │── process
     │                            │ <── ack/nack ──────── │
     │                            │                        │
```

**Implementation with BullMQ:**

```javascript
// producer.js
const { Queue } = require('bullmq');

const emailQueue = new Queue('emails', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600 },  // Keep completed jobs for 24h
    removeOnFail: { age: 7 * 24 * 3600 },  // Keep failed jobs for 7 days
  },
});

// Add jobs from your API
app.post('/users', async (req, res) => {
  const user = await createUser(req.body);

  await emailQueue.add('welcome-email', {
    userId: user.id,
    email: user.email,
    template: 'welcome',
  }, {
    priority: 1,           // Higher priority
    delay: 5000,           // Send after 5 seconds
  });

  res.status(201).json(user);
});
```

```javascript
// worker.js
const { Worker } = require('bullmq');

const worker = new Worker('emails', async (job) => {
  console.log(`Processing ${job.name} for ${job.data.email}`);

  switch (job.name) {
    case 'welcome-email':
      await sendEmail(job.data.email, job.data.template);
      break;
    case 'password-reset':
      await sendPasswordReset(job.data.email, job.data.token);
      break;
  }
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5,   // Process 5 jobs simultaneously
  limiter: {
    max: 50,         // Max 50 jobs per duration
    duration: 60000, // Per minute (respect email API rate limits)
  },
});

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err));
```

**Key design decisions:**
- **Persistence:** Redis ensures jobs survive process restarts
- **Retry with backoff:** Exponential backoff (2s, 4s, 8s) prevents hammering failing services
- **Dead letter queue:** After max attempts, jobs move to a failed state for investigation
- **Concurrency control:** Limit parallel processing to prevent resource exhaustion
- **Idempotency:** Workers must handle duplicate delivery (at-least-once semantics)

**Why interviewer asks this:** Background job processing is essential in production systems. Tests architecture thinking and reliability engineering.

---

## Q27. How would you implement a real-time notification system with Node.js?

**Answer:**

**Architecture:**

```
Client A ←── WebSocket ──→ Node.js Server 1 ←──┐
                                                 ├── Redis Pub/Sub
Client B ←── WebSocket ──→ Node.js Server 2 ←──┘
                                                 │
API Server ── publish event ────────────────────┘
```

**Implementation:**

```javascript
// server.js
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const http = require('http');

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Redis pub/sub for multi-server communication
const subscriber = new Redis();
const publisher = new Redis();

// Track connected users
const userConnections = new Map(); // userId -> Set<WebSocket>

wss.on('connection', (ws, req) => {
  const userId = authenticateWebSocket(req);

  // Register connection
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(ws);

  ws.on('close', () => {
    userConnections.get(userId)?.delete(ws);
    if (userConnections.get(userId)?.size === 0) {
      userConnections.delete(userId);
    }
  });

  // Send pending notifications on connect
  sendPendingNotifications(userId, ws);
});

// Subscribe to notification channel
subscriber.subscribe('notifications');
subscriber.on('message', (channel, message) => {
  const { userId, payload } = JSON.parse(message);
  const connections = userConnections.get(userId);

  if (connections) {
    for (const ws of connections) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }
  }
});

// API to send notifications (called from any service)
async function sendNotification(userId, notification) {
  // Persist to database (for offline users)
  await db.query(
    'INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3)',
    [userId, notification.type, JSON.stringify(notification.data)]
  );

  // Publish to all server instances
  publisher.publish('notifications', JSON.stringify({
    userId,
    payload: notification,
  }));
}
```

**Key design decisions:**
- **Redis Pub/Sub** ensures notifications reach users regardless of which server they're connected to
- **Database persistence** handles offline users - they receive notifications on reconnect
- **Multiple connections per user** (multiple browser tabs)
- **Heartbeat mechanism** to detect dead connections
- **Exponential reconnect** on the client side

**Why interviewer asks this:** Combines WebSockets, pub/sub, database design, and multi-server architecture. A complete system design question.

---

## Q28. How do you monitor and debug a Node.js application in production?

**Answer:**

**1. Health Checks:**
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});
```

**2. Structured Logging:**
```javascript
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    req: pino.stdSerializers.req,
    err: pino.stdSerializers.err,
  },
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
    });
  });
  next();
});
```

**3. Metrics (Prometheus):**
```javascript
const promClient = require('prom-client');

// Default Node.js metrics (event loop lag, heap size, GC)
promClient.collectDefaultMetrics();

// Custom metrics
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

**4. Error Tracking:**
```javascript
// Sentry integration
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**5. Remote Debugging (production-safe):**
```bash
# Send SIGUSR1 to enable inspector on running process
kill -SIGUSR1 <pid>
# Then connect Chrome DevTools to port 9229
```

**Why interviewer asks this:** Observability is non-negotiable for production services. This tests operational maturity.

---

## Q29. How would you design a file upload service that handles large files?

**Answer:**

**Approach: Chunked upload with streaming to object storage**

```javascript
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PassThrough } = require('stream');
const crypto = require('crypto');

const s3 = new S3Client({ region: 'us-east-1' });

// Stream directly to S3 - never buffer full file in memory
async function uploadToS3(fileStream, filename, contentType) {
  const key = `uploads/${Date.now()}-${crypto.randomUUID()}-${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  }));

  return key;
}

// Multer with memory limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 5,                     // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const key = await uploadToS3(
      PassThrough().end(req.file.buffer),
      req.file.originalname,
      req.file.mimetype
    );
    res.json({ key, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

**For very large files (>100MB), use multipart upload with presigned URLs:**

```javascript
const { CreateMultipartUploadCommand, UploadPartCommand,
        CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// 1. Client requests upload session
app.post('/upload/initiate', async (req, res) => {
  const { uploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET,
    Key: req.body.filename,
  }));

  // Generate presigned URLs for each part (client uploads directly to S3)
  const partCount = Math.ceil(req.body.fileSize / (10 * 1024 * 1024)); // 10MB parts
  const urls = [];

  for (let i = 1; i <= partCount; i++) {
    const url = await getSignedUrl(s3, new UploadPartCommand({
      Bucket: process.env.S3_BUCKET,
      Key: req.body.filename,
      UploadId: uploadId,
      PartNumber: i,
    }), { expiresIn: 3600 });
    urls.push({ partNumber: i, url });
  }

  res.json({ uploadId, parts: urls });
});

// 2. Client uploads parts directly to S3 (server is not a bottleneck)
// 3. Client signals completion
app.post('/upload/complete', async (req, res) => {
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET,
    Key: req.body.filename,
    UploadId: req.body.uploadId,
    MultipartUpload: { Parts: req.body.parts },
  }));
  res.json({ status: 'complete' });
});
```

**Key design decisions:**
- **Stream, don't buffer** - never hold full files in Node.js memory
- **Presigned URLs** for large files - clients upload directly to S3, bypassing your server
- **File type validation** - check MIME types, not just extensions
- **Virus scanning** - trigger async scan after upload (ClamAV, S3 event -> Lambda)
- **Size limits** at both application and reverse proxy (nginx) level

**Why interviewer asks this:** File uploads are deceptively complex. This tests streaming knowledge, cloud architecture, security awareness, and scalability thinking.

---

## Q30. Design a caching strategy for a Node.js API.

**Answer:**

**Multi-layer caching architecture:**

```
Client → CDN Cache → Reverse Proxy Cache → App (In-Memory) → Redis → Database
         (static)      (nginx)               (LRU)           (shared)
```

**Layer 1: In-memory cache (per-instance, fastest):**

```javascript
const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 500,                  // Max 500 entries
  ttl: 1000 * 60 * 5,       // 5-minute TTL
  maxSize: 50 * 1024 * 1024, // 50MB max memory
  sizeCalculation: (value) => JSON.stringify(value).length,
});

function withMemoryCache(keyFn, ttl) {
  return async (req, res, next) => {
    const key = keyFn(req);
    const cached = cache.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Override res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, data, { ttl });
      return originalJson(data);
    };

    next();
  };
}

app.get('/api/products/:id',
  withMemoryCache((req) => `product:${req.params.id}`, 60000),
  productController.getById
);
```

**Layer 2: Redis cache (shared across instances):**

```javascript
const Redis = require('ioredis');
const redis = new Redis();

async function cacheGet(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function cacheSet(key, data, ttlSeconds) {
  await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

// Cache-aside pattern
async function getProduct(id) {
  const cacheKey = `product:${id}`;

  // 1. Check cache
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // 2. Cache miss - fetch from DB
  const product = await db.query('SELECT * FROM products WHERE id = $1', [id]);

  // 3. Populate cache
  await cacheSet(cacheKey, product, 300); // 5 min TTL

  return product;
}
```

**Cache invalidation strategies:**

```javascript
// 1. Event-driven invalidation (best for consistency)
async function updateProduct(id, data) {
  await db.query('UPDATE products SET ... WHERE id = $1', [id]);

  // Invalidate all related cache keys
  await redis.del(`product:${id}`);
  await redis.del('products:list');

  // Publish invalidation to all instances
  await redis.publish('cache:invalidate', JSON.stringify({
    keys: [`product:${id}`, 'products:list'],
  }));
}

// 2. Subscribe to invalidation events (each server instance)
const subscriber = new Redis();
subscriber.subscribe('cache:invalidate');
subscriber.on('message', (channel, message) => {
  const { keys } = JSON.parse(message);
  keys.forEach((key) => cache.delete(key)); // Clear local LRU cache
});
```

**Layer 3: HTTP caching headers:**

```javascript
// Immutable assets
app.use('/static', express.static('public', {
  maxAge: '1y',
  immutable: true,
}));

// API responses
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(products);
});
```

**Cache pattern decision guide:**

| Pattern | Use When | Consistency |
|---|---|---|
| Cache-aside | General purpose, read-heavy | Eventual |
| Write-through | Write consistency critical | Strong |
| Write-behind | High write volume | Eventual |
| Read-through | Simplify application code | Eventual |

**The two hardest problems:**
1. **Cache invalidation** - use event-driven invalidation + short TTLs as a safety net
2. **Cache stampede** - when cache expires, 1000 requests all hit the DB. Solution: use a lock or "stale-while-revalidate" pattern

**Why interviewer asks this:** Caching strategy reveals system design maturity. Getting it wrong means either stale data or no performance benefit.

---

> **Preparation tip:** For each question, practice explaining your answer out loud in under 2 minutes. Interviewers value clarity and structure over exhaustive detail. Lead with the "what" and "why," then dive into code only when asked.