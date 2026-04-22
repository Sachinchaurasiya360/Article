# Scaling Systems in Production: Architecture, Failures, and Recovery for 100K+ Users

*The senior engineer's field guide to building systems that don't fall over - and recover gracefully when they do.*

---

## The Reality of 100K Users

At 100K concurrent users, everything you got away with at 1K becomes a production incident:

- That in-memory session store? Your server restarts, 100K users get logged out simultaneously, and they all try to re-authenticate at once.
- That single database server? It's at 95% CPU during peak hours. One complex query tips it over.
- That monolithic server? It takes 3 minutes to deploy. During those 3 minutes, some users get errors.
- That "it works on my machine" attitude? Production has 50x the traffic, 10x the data, and network latency you never tested for.

This article is about the architecture, failure modes, and recovery strategies that separate a system serving 100K users from one that collapses under the weight.

---

## Part 1: System Design for 100K+ Users

### The Architecture Shift: Vertical to Horizontal

At 1K users, you scale **vertically** - bigger server, more RAM, faster CPU. At 100K users, vertical scaling hits a ceiling (and gets extremely expensive). You need to scale **horizontally** - more servers, not bigger servers.

```
1K users:                          100K users:
┌─────────────┐                    ┌──────────────┐
│   Browser    │                   │   Browser     │
└──────┬──────┘                    └──────┬───────┘
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌──────────────┐
│  Server     │                    │ Load Balancer │
│  (Node.js)  │                    └──────┬───────┘
└──────┬──────┘                     ┌─────┼─────┐
       │                            ▼     ▼     ▼
       ▼                         ┌─────┬─────┬─────┐
┌─────────────┐                  │ App │ App │ App │
│  Database   │                  │  1  │  2  │  3  │
└─────────────┘                  └──┬──┴──┬──┴──┬──┘
                                    │     │     │
                                    ▼     ▼     ▼
                                 ┌──────────────┐
                                 │    Redis      │
                                 │   (Cache +    │
                                 │   Sessions)   │
                                 └──────┬───────┘
                                        │
                                 ┌──────┴───────┐
                                 │   Database    │
                                 │  (Primary +   │
                                 │   Replicas)   │
                                 └──────────────┘
```

### Load Balancing - Distributing Traffic Across Servers

**Nginx as a reverse proxy and load balancer:**

```nginx
# /etc/nginx/conf.d/app.conf

upstream app_servers {
    # Round-robin by default - each request goes to the next server
    server app1:3000;
    server app2:3000;
    server app3:3000;

    # Health checks - stop sending traffic to dead servers
    # (nginx plus, or use upstream_check_module for open source)
}

server {
    listen 80;
    server_name api.yourapp.com;

    # Connection limits - protect against connection floods
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 100;

    location /api/ {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-ID $request_id;

        # Timeouts - don't wait forever for a slow server
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;

        # If one server fails, try the next one
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    # Serve static files directly from nginx (much faster than Node.js)
    location /static/ {
        root /var/www;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
    }
}
```

**Load balancing strategies - when to use each:**

| Strategy | How It Works | When to Use |
|---|---|---|
| Round Robin | Requests go to each server in turn | Default. Good when all servers are equal |
| Least Connections | Sends to the server with fewest active connections | When requests have varying processing times |
| IP Hash | Same client IP always goes to the same server | When you have sticky sessions (avoid if possible) |
| Weighted | Some servers get more traffic than others | When servers have different capacities |

### Stateless Services - The Foundation of Horizontal Scaling

**The rule:** Your application servers must not store any state locally. If a server dies, any other server should be able to handle the next request from that user.

```javascript
// ❌ BAD: State stored in the application process
const activeSessions = new Map();     // Gone when server restarts
const rateLimitCounters = {};          // Each server has different counts
let cachedProducts = null;             // Different on each server
const uploadProgress = new Map();      // Lost on server switch

app.post('/api/login', (req, res) => {
  const sessionId = generateId();
  activeSessions.set(sessionId, { userId: req.body.userId }); // Only exists on THIS server
  res.cookie('session', sessionId);
  res.json({ success: true });
});

// ✅ GOOD: All state in external stores
const redis = require('redis').createClient({ url: process.env.REDIS_URL });
const session = require('express-session');
const RedisStore = require('connect-redis').default;

// Sessions in Redis - accessible by any server
app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, maxAge: 86400000 },
}));

// File uploads go to S3/cloud storage, not local disk
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET,
    key: (req, file, cb) => cb(null, `uploads/${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Cache in Redis, not in memory
async function getProducts(filters) {
  const cacheKey = `products:${JSON.stringify(filters)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const products = await db.query('SELECT * FROM products WHERE ...');
  await redis.setEx(cacheKey, 120, JSON.stringify(products));
  return products;
}
```

**Stateless checklist:**

- [ ] Sessions stored in Redis/database, not in-memory
- [ ] File uploads go to cloud storage (S3, GCS), not local disk
- [ ] Cache is in Redis, not in-process
- [ ] No global variables holding user/request state
- [ ] WebSocket state is in Redis (for multi-server pub/sub)
- [ ] Scheduled jobs use a distributed scheduler (not `setInterval`)

---

## Part 2: Backend Scaling Deep Dive

### Caching Architecture with Redis

Beyond simple key-value caching, here's how Redis fits into a production system:

```javascript
const Redis = require('ioredis');

// Use a Redis cluster for high availability
const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
]);

class CacheService {
  // Pattern 1: Cache-aside (most common)
  async getOrSet(key, fetchFn, ttl = 120) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }

  // Pattern 2: Cache stampede prevention
  // Without this: If cache expires, 1000 simultaneous requests all hit the DB
  async getOrSetWithLock(key, fetchFn, ttl = 120) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const lockKey = `lock:${key}`;
    const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10); // Lock for 10s

    if (acquired) {
      // We got the lock - fetch from DB and populate cache
      try {
        const data = await fetchFn();
        await redis.setex(key, ttl, JSON.stringify(data));
        return data;
      } finally {
        await redis.del(lockKey);
      }
    } else {
      // Another request is already fetching - wait and retry from cache
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getOrSetWithLock(key, fetchFn, ttl);
    }
  }

  // Pattern 3: Cache invalidation by pattern
  async invalidatePattern(pattern) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

// Usage
const cacheService = new CacheService();

// In your product service:
async function getProducts(filters) {
  const key = `products:${JSON.stringify(filters)}`;
  return cacheService.getOrSetWithLock(key, () => {
    return productRepository.find(filters);
  }, 300); // Cache for 5 minutes
}

// When a product is updated:
async function updateProduct(id, data) {
  await productRepository.update(id, data);
  await cacheService.invalidatePattern('products:*');
}
```

### Queue Systems - Choosing the Right Tool

**Bull (Redis-based) - Good for most applications:**

```javascript
const Queue = require('bull');

// Define queues for different job types
const emailQueue = new Queue('emails', process.env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000, // Keep last 1000 completed jobs
    removeOnFail: 5000,     // Keep last 5000 failed jobs
  },
});

const reportQueue = new Queue('reports', process.env.REDIS_URL);

// Producer: Add jobs from your API handlers
app.post('/api/v1/orders', async (req, res) => {
  const order = await orderService.create(req.body);

  // Add jobs to different queues
  await emailQueue.add('order-confirmation', {
    orderId: order.id,
    email: req.user.email,
  });

  await emailQueue.add('notify-warehouse', {
    orderId: order.id,
    items: order.items,
  }, {
    delay: 5000, // Wait 5 seconds (in case order is cancelled immediately)
  });

  res.status(201).json({ data: order });
});

// Consumer: Process jobs (run in separate worker process)
// worker.js - run with: node worker.js
emailQueue.process('order-confirmation', 5, async (job) => { // 5 concurrent
  const { orderId, email } = job.data;
  const order = await orderService.getById(orderId);
  await emailService.send({
    to: email,
    template: 'order-confirmation',
    data: { order },
  });
});

emailQueue.process('notify-warehouse', 3, async (job) => {
  const { orderId, items } = job.data;
  await warehouseService.notify(orderId, items);
});

// Monitor queue health
emailQueue.on('failed', (job, err) => {
  logger.error('Job failed', {
    queue: 'emails',
    jobId: job.id,
    jobName: job.name,
    attempts: job.attemptsMade,
    error: err.message,
  });
});

emailQueue.on('stalled', (jobId) => {
  logger.warn('Job stalled', { queue: 'emails', jobId });
});
```

**When to use what:**

| Tool | Best For | Scale |
|---|---|---|
| **Bull** (Redis) | Most web apps. Task queues, delayed jobs, retries | Up to ~10K jobs/sec |
| **BullMQ** (Redis) | Bull's successor. Better API, more features | Up to ~10K jobs/sec |
| **RabbitMQ** | Complex routing, multiple consumers, pub/sub | Up to ~50K msgs/sec |
| **Kafka** | Event streaming, log aggregation, data pipelines | 100K+ msgs/sec, data retention |

**Decision framework:**
- Sending emails, processing images, generating reports? → **Bull/BullMQ**
- Microservices need to communicate with complex routing? → **RabbitMQ**
- You need to process millions of events, replay history, or build event-driven architecture? → **Kafka**

### Database Optimization for Scale

**Read Replicas - Scale reads without touching your primary:**

```javascript
// PostgreSQL with read replicas
const { Pool } = require('pg');

const primaryPool = new Pool({
  host: process.env.DB_PRIMARY_HOST,
  max: 30,
});

const replicaPool = new Pool({
  host: process.env.DB_REPLICA_HOST,
  max: 50, // More connections for reads since they're lighter
});

class UserRepository {
  // Writes go to primary
  async create(data) {
    return primaryPool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [data.name, data.email]
    );
  }

  // Reads go to replica
  async findById(id) {
    return replicaPool.query('SELECT * FROM users WHERE id = $1', [id]);
  }

  // Complex reports go to replica (never slow down writes with heavy reads)
  async getAnalytics(startDate, endDate) {
    return replicaPool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as signups
      FROM users
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate, endDate]);
  }
}
```

**Query optimization patterns:**

```sql
-- ❌ BAD: Selecting everything, no index, sorting in application
SELECT * FROM orders WHERE user_id = 123;
-- Then sorting in Node.js: orders.sort((a, b) => b.created_at - a.created_at)

-- ✅ GOOD: Select only needed columns, use index, sort in DB
SELECT id, status, total, created_at
FROM orders
WHERE user_id = 123
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;

-- With covering index (all queried columns are in the index):
CREATE INDEX idx_orders_user_status ON orders(user_id, status, created_at DESC)
INCLUDE (total);
-- The DB can answer this query entirely from the index, without touching the table.
```

**Connection pooling with PgBouncer (for PostgreSQL at scale):**

Instead of each app server maintaining 30 connections to the database (3 servers × 30 = 90 connections), use PgBouncer as a connection multiplexer:

```
3 App Servers (30 connections each = 90 total)
          │
          ▼
┌──────────────────┐
│    PgBouncer     │ ← Maintains a pool of 30 real DB connections
│  (Connection     │    Multiplexes 90 app connections onto 30 real ones
│   Pooler)        │
└────────┬─────────┘
         ▼
┌──────────────────┐
│   PostgreSQL     │ ← Only sees 30 connections, not 90
└──────────────────┘
```

This lets you scale to many more app servers without exhausting database connections.

---

## Part 3: Frontend Scaling

### CDN - The Biggest Frontend Performance Win

```
Without CDN:
User (Tokyo) → Server (US East) → Send 2MB of JS/CSS/images
Round trip: 300ms × many requests = seconds of load time

With CDN:
User (Tokyo) → CDN Edge (Tokyo) → Serve from cache (5ms)
                  ↓ (cache miss only)
            Origin Server (US East)
```

**Setting up CDN with your frontend build:**

```javascript
// next.config.js - Next.js with CDN
module.exports = {
  // All static assets get served from CDN
  assetPrefix: process.env.NODE_ENV === 'production'
    ? 'https://cdn.yourapp.com'
    : '',

  // Image optimization through CDN
  images: {
    loader: 'custom',
    loaderFile: './lib/imageLoader.js',
  },

  // Generate hashed filenames for cache-busting
  generateBuildId: async () => {
    return process.env.GIT_SHA || 'development';
  },
};
```

```javascript
// For non-Next.js: Configure webpack to use CDN for assets
// webpack.config.js
module.exports = {
  output: {
    publicPath: process.env.NODE_ENV === 'production'
      ? 'https://cdn.yourapp.com/'
      : '/',
    filename: '[name].[contenthash].js', // Hash in filename = infinite cache
  },
};
```

**Cache headers that make CDN effective:**

```nginx
# Static assets with content hash in filename - cache forever
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML files - don't cache (they reference the hashed assets)
location ~* \.html$ {
    add_header Cache-Control "no-cache";
}

# API responses - short cache or no cache
location /api/ {
    add_header Cache-Control "private, no-cache";
}
```

### Lazy Loading and Code Splitting

```jsx
// ❌ BAD: Entire app loads upfront
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import Analytics from './pages/Analytics';
import UserSettings from './pages/UserSettings';
import ReportBuilder from './pages/ReportBuilder';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<UserSettings />} />
      <Route path="/reports" element={<ReportBuilder />} />
    </Routes>
  );
}
// Bundle size: 2MB. Every user downloads the admin panel, analytics,
// and report builder - even if they never visit those pages.

// ✅ GOOD: Load each route only when needed
import { lazy, Suspense } from 'react';

// These are only downloaded when the user navigates to the route
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Analytics = lazy(() => import('./pages/Analytics'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<UserSettings />} />
        <Route path="/reports" element={<ReportBuilder />} />
      </Routes>
    </Suspense>
  );
}
// Initial bundle: 200KB. Other pages load on demand.
```

**Lazy load heavy components within a page:**

```jsx
import { lazy, Suspense, useState } from 'react';

// Chart library is 500KB - don't load it until user clicks "Show Chart"
const HeavyChart = lazy(() => import('./components/HeavyChart'));

function AnalyticsPage({ data }) {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <DataTable data={data} />
      <button onClick={() => setShowChart(true)}>Show Chart</button>

      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <HeavyChart data={data} />
        </Suspense>
      )}
    </div>
  );
}
```

### Bundle Analysis - Know What You're Shipping

```bash
# Next.js: Built-in bundle analyzer
# Install: npm install @next/bundle-analyzer
# next.config.js:
# const withBundleAnalyzer = require('@next/bundle-analyzer')({
#   enabled: process.env.ANALYZE === 'true',
# });
# module.exports = withBundleAnalyzer({ /* ... */ });

ANALYZE=true npm run build
# Opens a visual treemap of your bundle - you'll immediately see what's too big
```

**Common findings:**
- `moment.js` (300KB) → Replace with `date-fns` (30KB, tree-shakeable) or `dayjs` (2KB)
- `lodash` (70KB) → Import individual functions: `import debounce from 'lodash/debounce'`
- Unused dependencies → Remove them
- Duplicate libraries → Deduplicate in webpack config

---

## Part 4: Failure Scenarios and How to Handle Them

At 100K users, failures aren't hypothetical - they're scheduled. You need to design for failure, not just hope it doesn't happen.

### Failure 1: Server Crashes Mid-Request

**What happens:** Your Node.js process crashes (unhandled exception, out of memory, segfault). 1,000 in-flight requests get dropped. Users see connection reset errors.

**Prevention + Recovery:**

```javascript
// 1. Use a process manager that auto-restarts (PM2)
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: 'src/server.js',
    instances: 'max',         // One process per CPU core
    exec_mode: 'cluster',     // Cluster mode for zero-downtime restarts
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    env: {
      NODE_ENV: 'production',
    },
  }],
};

// 2. Graceful shutdown - finish in-flight requests before dying
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connections
    await mongoose.connection.close();
    await redis.quit();

    logger.info('All connections closed, exiting');
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);
});

// 3. Catch unhandled errors - log them and exit cleanly
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason });
  // Let PM2 restart us - don't swallow the error
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
```

**With load balancer:** When one server crashes, the load balancer detects it via health checks and routes traffic to healthy servers. Users might see one failed request, but the next one succeeds.

### Failure 2: Database Overload

**What happens:** Your database is at 100% CPU. Queries that normally take 5ms now take 30 seconds. Every request is waiting on the database. Your connection pool is exhausted. Your app servers start queuing requests. Memory climbs. Everything cascades.

**The Circuit Breaker Pattern:**

```javascript
// Instead of sending requests to a failing database until it dies completely,
// "break the circuit" - fail fast and give the database time to recover.

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED = normal, OPEN = failing, HALF_OPEN = testing
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();

      // Success - reset the circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
      }
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.warn('Circuit breaker OPENED', {
          failures: this.failureCount,
          resetIn: `${this.resetTimeout / 1000}s`,
        });
      }

      throw error;
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
});

async function getUser(id) {
  return dbCircuitBreaker.execute(async () => {
    return db.query('SELECT * FROM users WHERE id = $1', [id]);
  });
}

// When the DB is overloaded:
// - First 5 requests fail normally
// - Circuit opens - next requests fail INSTANTLY (no DB load)
// - After 30 seconds, one request is allowed through (half-open)
// - If it succeeds, circuit closes and normal traffic resumes
// - If it fails, circuit stays open for another 30 seconds
```

**Combine with caching for resilience:**

```javascript
async function getProducts(filters) {
  const cacheKey = `products:${JSON.stringify(filters)}`;

  // Always try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    // Try database through circuit breaker
    const products = await dbCircuitBreaker.execute(async () => {
      return productRepository.find(filters);
    });
    await redis.setex(cacheKey, 300, JSON.stringify(products));
    return products;
  } catch (err) {
    // If DB is down, try stale cache (cache with longer TTL)
    const staleCache = await redis.get(`stale:${cacheKey}`);
    if (staleCache) {
      logger.warn('Serving stale cache due to DB failure', { key: cacheKey });
      return JSON.parse(staleCache);
    }

    throw err; // No cache, no DB - we have to fail
  }
}
```

### Failure 3: Memory Leaks

**The silent killer.** Your app starts fine, using 200MB. Over 24 hours, it climbs to 1.5GB. Then the OOM killer terminates your process. PM2 restarts it. The cycle repeats.

**Common causes in Node.js:**

```javascript
// ❌ LEAK 1: Growing arrays/maps that never get cleaned
const requestLog = []; // Never cleared - grows forever

app.use((req, res, next) => {
  requestLog.push({
    path: req.path,
    timestamp: Date.now(),
    headers: req.headers, // Each entry is ~2KB
  });
  next();
});
// After 1M requests: requestLog holds 2GB of data

// ✅ FIX: Use a bounded data structure or external storage
const LRU = require('lru-cache');
const requestLog = new LRU({ max: 1000 }); // Only keeps last 1000 entries

// Or better: use proper logging infrastructure
const logger = require('./logger'); // Winston writes to file/service, not memory
```

```javascript
// ❌ LEAK 2: Event listeners that accumulate
class OrderWatcher {
  watch(orderId) {
    // Every call adds a NEW listener - they never get removed
    eventEmitter.on('order-update', (data) => {
      if (data.orderId === orderId) {
        this.handleUpdate(data);
      }
    });
  }
}

// ✅ FIX: Remove listeners when done
class OrderWatcher {
  watch(orderId) {
    const handler = (data) => {
      if (data.orderId === orderId) {
        this.handleUpdate(data);
        eventEmitter.off('order-update', handler); // Clean up
      }
    };
    eventEmitter.on('order-update', handler);

    // Safety net: remove after timeout
    setTimeout(() => eventEmitter.off('order-update', handler), 300000);
  }
}
```

```javascript
// ❌ LEAK 3: Closures holding references to large objects
app.get('/api/reports', async (req, res) => {
  const hugeDataset = await db.query('SELECT * FROM events'); // 500MB result set

  // This closure captures hugeDataset - it stays in memory until the timer fires
  setTimeout(() => {
    logger.info('Report generated', { count: hugeDataset.length });
  }, 60000);

  const summary = summarize(hugeDataset);
  res.json(summary);
  // hugeDataset should be GC'd here, but the setTimeout closure keeps it alive
});

// ✅ FIX: Extract what you need, let the rest be GC'd
app.get('/api/reports', async (req, res) => {
  const hugeDataset = await db.query('SELECT * FROM events');
  const count = hugeDataset.length; // Extract just the number
  const summary = summarize(hugeDataset);
  // hugeDataset is now eligible for GC

  setTimeout(() => {
    logger.info('Report generated', { count }); // Closure only holds the number
  }, 60000);

  res.json(summary);
});
```

**Detecting memory leaks:**

```javascript
// Add memory monitoring to your health check
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    uptime: `${Math.round(process.uptime() / 60)} minutes`,
  });
});

// Alert if: heapUsed increases consistently over time relative to uptime
// Normal: heapUsed fluctuates between 100-300MB regardless of uptime
// Leak: heapUsed climbs from 100MB → 400MB → 800MB over 6 hours
```

---

## Part 5: Recovery Strategies

### Auto-Scaling - Let Infrastructure Respond to Load

**Kubernetes Horizontal Pod Autoscaler (HPA):**

```yaml
# kubernetes/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3           # Always run at least 3 pods
  maxReplicas: 20          # Scale up to 20 pods max
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # Scale up when average CPU > 70%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80   # Scale up when average memory > 80%
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60     # Wait 60s before scaling up more
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60              # Add at most 4 pods per minute
    scaleDown:
      stabilizationWindowSeconds: 300    # Wait 5 min before scaling down
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120             # Remove at most 1 pod per 2 minutes
```

**Why scale-down is slower:** If your traffic spikes and then drops, you don't want to immediately remove servers. The spike might come back in waves. Slow scale-down prevents thrashing.

### Graceful Degradation - Serve Something, Not Nothing

When parts of your system fail, don't show a blank page. Degrade gracefully.

```jsx
// Frontend: Degrade features, not the entire page
function Dashboard() {
  const userQuery = useQuery({ queryKey: ['user'], queryFn: fetchUser });
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
  const recsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchRecommendations,
    retry: 1, // Non-critical - don't retry aggressively
  });

  // Critical data failed - show error page
  if (userQuery.error) {
    return <ErrorPage message="Unable to load your profile" retry={userQuery.refetch} />;
  }

  return (
    <div>
      <UserHeader user={userQuery.data} />

      {/* Orders are important but not critical */}
      {ordersQuery.error ? (
        <div className="degraded-notice">
          Unable to load recent orders.
          <button onClick={ordersQuery.refetch}>Try again</button>
        </div>
      ) : (
        <RecentOrders orders={ordersQuery.data} loading={ordersQuery.isLoading} />
      )}

      {/* Recommendations are nice-to-have - just hide if they fail */}
      {recsQuery.data && <Recommendations items={recsQuery.data} />}
    </div>
  );
}
```

```javascript
// Backend: Degrade functionality when dependencies fail
app.get('/api/v1/dashboard', async (req, res) => {
  const userId = req.user.id;

  // Use Promise.allSettled - don't fail everything if one thing fails
  const results = await Promise.allSettled([
    userService.getById(userId),             // Critical
    orderService.getRecent(userId, 5),       // Important
    notificationService.getUnread(userId),   // Nice to have
    recommendationService.get(userId),       // Nice to have
  ]);

  const [userResult, ordersResult, notificationsResult, recsResult] = results;

  // Critical failure - can't serve anything useful
  if (userResult.status === 'rejected') {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  res.json({
    user: userResult.value,
    orders: ordersResult.status === 'fulfilled' ? ordersResult.value : null,
    notifications: notificationsResult.status === 'fulfilled' ? notificationsResult.value : null,
    recommendations: recsResult.status === 'fulfilled' ? recsResult.value : null,
    _degraded: results.filter(r => r.status === 'rejected').length > 0,
  });
});
```

---

## The Production Scaling Checklist

### Infrastructure
- [ ] Load balancer in front of multiple app servers
- [ ] All app servers are stateless (sessions, files, cache external)
- [ ] Database has read replicas for read-heavy workloads
- [ ] Redis for caching and session storage
- [ ] CDN for static assets
- [ ] Auto-scaling configured with proper thresholds

### Backend
- [ ] Connection pooling (app-level and/or PgBouncer)
- [ ] Circuit breakers on external service calls
- [ ] Queue system for non-critical background work
- [ ] Proper database indexes (check `EXPLAIN` regularly)
- [ ] Request timeouts on all endpoints
- [ ] Rate limiting (global + per-endpoint)
- [ ] Structured logging with request IDs

### Frontend
- [ ] Code splitting / lazy loading for routes
- [ ] Bundle size under control (analyze regularly)
- [ ] Proper caching headers on static assets
- [ ] Images lazy-loaded and properly sized
- [ ] Debouncing on search/autocomplete
- [ ] Virtualization for long lists
- [ ] Graceful degradation when API is slow/down

### Monitoring & Recovery
- [ ] Health check endpoints with real dependency checks
- [ ] Alerts on p95 latency, error rate, memory, CPU
- [ ] Graceful shutdown handling (SIGTERM)
- [ ] Process manager with auto-restart (PM2 or container orchestration)
- [ ] Dead-letter queues for failed background jobs
- [ ] Memory leak detection (trending heap usage)
- [ ] Runbooks for common failure scenarios

---

## Final Thought: Scaling Is a Mindset, Not a Destination

The difference between a system that handles 1K users and one that handles 100K isn't some magical architecture diagram. It's a series of deliberate decisions:

- **Connection pooling** instead of connect-per-request
- **Pagination** instead of return-everything
- **Caching** instead of query-every-time
- **Queues** instead of do-everything-synchronously
- **Circuit breakers** instead of retry-until-death
- **Graceful degradation** instead of all-or-nothing

Each of these is a small decision. Together, they're the difference between a 3 AM wake-up call and a good night's sleep.

---

*This is Part 3 of a 3-part series:*
1. *[Writing Scalable Code from Day 1](scalable-code-day-one.md) - Foundations*
2. *[Handling Sudden Traffic Spikes](scalable-code-traffic-spikes.md) - From 1K to 100K*
3. *Scaling Systems in Production - Architecture, Failures, Recovery (this article)*
