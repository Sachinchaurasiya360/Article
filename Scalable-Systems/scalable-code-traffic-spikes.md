# Handling Sudden Traffic Spikes: When Your App Goes from 1K to 100K Users Overnight

*A war-room guide: what breaks first, how to diagnose it, and how to fix it - based on real production incidents.*

---

## The 3 AM Wake-Up Call

Your monitoring tool fires an alert. Response times jumped from 200ms to 12 seconds. Error rate is at 40%. Your app was handling 1,000 concurrent users just fine. Now there are 20,000.

Your CEO is texting you. Your Slack is on fire.

What do you do?

This article walks through four real scenarios, in order of how they typically hit you. Each one builds on the last, and by the end, you'll have a playbook for handling traffic spikes that doesn't involve panicking.

---

## Scenario 1: Traffic Jumps from 1K to 20K - What Breaks First?

### The Situation

Your Node.js app runs on a single server (maybe a $20/month VPS). You have one database instance. No caching. No CDN. It's been working fine for months.

Then your marketing team's campaign goes viral. Traffic spikes 20x.

### What Breaks (In This Order)

**1. Database connections exhaust first.**

Your app creates a new DB connection per request. MongoDB's default connection limit is 100. PostgreSQL's is typically 100. At 20K concurrent users, you're trying to open 20K connections. The database rejects them all.

```
MongoError: connection pool exhausted, retrying...
Error: too many clients already
```

**2. Event loop blocks.**

With connections queuing, every request is waiting. Node.js's event loop gets clogged. Even simple health checks start timing out.

**3. Memory spikes.**

Every queued request holds data in memory. 20K requests × average 50KB per request = 1GB of memory just in pending requests. Your 2GB server starts swapping to disk. Everything gets 10x slower.

**4. Frontend cascades.**

Users see loading spinners. They refresh. Each refresh doubles the load. This is called a **retry storm**, and it can turn a 20K spike into a 60K spike in minutes.

### The Immediate Fix (Triage Order)

**Step 1: Connection pooling - Fix the database bottleneck first**

```javascript
// ❌ BEFORE: Default mongoose connection (creates connections on demand, no limit)
mongoose.connect('mongodb://localhost/myapp');

// ✅ AFTER: Connection pool with explicit limits
mongoose.connect('mongodb://localhost/myapp', {
  maxPoolSize: 50,        // Max 50 connections in the pool
  minPoolSize: 10,        // Keep 10 connections warm
  serverSelectionTimeoutMS: 5000,  // Fail fast if DB is unreachable
  socketTimeoutMS: 45000,          // Kill slow queries
});
```

```javascript
// PostgreSQL equivalent with pg-pool
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  max: 50,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast
});

// Use pool.query() instead of creating new clients
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**Why 50 and not 500?** Each database connection uses memory (~10MB for PostgreSQL). 50 connections × 10MB = 500MB just for connections. Your database server has limits too. 50 connections handling requests efficiently beats 500 connections all competing for DB CPU.

**Step 2: Add request timeouts - Stop the bleeding**

```javascript
// Timeout middleware - kill requests that take too long
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    res.status(503).json({ error: 'Request timeout - server is overloaded' });
  });
  next();
});
```

**Step 3: Add basic in-memory caching for hot endpoints**

```javascript
// Quick and dirty - cache responses for frequently hit endpoints
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 }); // 60-second TTL

app.get('/api/v1/products', async (req, res) => {
  const cacheKey = `products:${req.url}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return res.json(cached); // Serve from memory - 0 DB load
  }

  const products = await productService.list(req.query);
  cache.set(cacheKey, products);
  res.json(products);
});
```

**Step 4: Tell the frontend to back off**

```javascript
// Return Retry-After header when overloaded
app.use((req, res, next) => {
  if (isOverloaded()) {
    res.set('Retry-After', '30');
    return res.status(503).json({
      error: 'Server is temporarily overloaded',
      retryAfter: 30,
    });
  }
  next();
});
```

### Diagnosis Checklist

When traffic spikes, check these in order:

1. **`htop` or cloud monitoring** - CPU and memory usage
2. **Database connection count** - `db.serverStatus().connections` (Mongo) or `SELECT count(*) FROM pg_stat_activity` (Postgres)
3. **Slow query log** - What queries are taking > 1s?
4. **Event loop lag** - `process.hrtime()` or libraries like `event-loop-stats`
5. **Network I/O** - Are you saturating your bandwidth?

---

## Scenario 2: API Becomes Slow - Database Queries Are Lagging

### The Situation

You've survived the initial spike with connection pooling and basic caching. But users are complaining that pages take 5-8 seconds to load. Your API logs show that database queries account for 90% of response time.

### Finding the Problem

**Step 1: Identify the slow queries**

```javascript
// MongoDB: Enable profiling to log slow queries
db.setProfilingLevel(1, { slowms: 100 }); // Log queries taking > 100ms

// Then check:
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

```sql
-- PostgreSQL: Check currently running slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
ORDER BY duration DESC;
```

**Step 2: The usual suspects**

### Problem A: Missing Indexes (The #1 Cause)

```javascript
// This query scans every document in the collection
const orders = await Order.find({
  userId: '123',
  status: 'completed',
  createdAt: { $gte: thirtyDaysAgo },
}).sort({ createdAt: -1 });

// MongoDB explains WHY it's slow:
const explanation = await Order.find({
  userId: '123',
  status: 'completed',
}).explain('executionStats');

console.log(explanation.executionStats);
// {
//   totalDocsExamined: 500000,  ← Scanning 500K documents
//   totalKeysExamined: 0,       ← Not using any index
//   executionTimeMillis: 3200,  ← 3.2 seconds
// }

// Fix: Add a compound index that matches your query pattern
Order.collection.createIndex({
  userId: 1,
  status: 1,
  createdAt: -1,
});

// After index:
// {
//   totalDocsExamined: 47,      ← Only examines matching documents
//   totalKeysExamined: 47,      ← Uses the index
//   executionTimeMillis: 2,     ← 2 milliseconds
// }
```

### Problem B: The N+1 Query Problem

```javascript
// ❌ BAD: N+1 - Fetches 1 query for orders, then 1 query PER order for the user
app.get('/api/v1/orders', async (req, res) => {
  const orders = await Order.find({ status: 'pending' }); // 1 query

  const results = [];
  for (const order of orders) {
    const user = await User.findById(order.userId); // N queries (one per order!)
    results.push({ ...order.toObject(), user });
  }

  res.json(results);
});
// With 200 pending orders, this makes 201 database queries.

// ✅ GOOD: Batch the user lookups
app.get('/api/v1/orders', async (req, res) => {
  const orders = await Order.find({ status: 'pending' }); // 1 query

  // Get all unique user IDs, fetch them in ONE query
  const userIds = [...new Set(orders.map(o => o.userId))];
  const users = await User.find({ _id: { $in: userIds } }); // 1 query
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  const results = orders.map(order => ({
    ...order.toObject(),
    user: userMap.get(order.userId.toString()),
  }));

  res.json(results);
});
// Now it's always 2 queries, regardless of how many orders there are.
```

```javascript
// Mongoose populate alternative (still 2 queries under the hood):
const orders = await Order.find({ status: 'pending' }).populate('userId', 'name email');
```

### Problem C: Fetching Way More Data Than You Need

```javascript
// ❌ BAD: Fetching entire documents when you only need a count
const allOrders = await Order.find({ userId: '123' });
const totalOrders = allOrders.length; // Loaded 10,000 documents into memory just to count them

// ✅ GOOD: Use the database's count function
const totalOrders = await Order.countDocuments({ userId: '123' });

// ❌ BAD: Fetching all fields when you only need two
const users = await User.find({});

// ✅ GOOD: Projection - only fetch what you need
const users = await User.find({}, { name: 1, email: 1 }); // 90% less data transferred
```

### The Optimization Playbook (In Order of Impact)

1. **Add missing indexes** - Check `explain()` on every slow query
2. **Fix N+1 queries** - Batch and use `$in` or `populate`
3. **Add projections** - Only select fields you need
4. **Use countDocuments()** instead of `.find().length`
5. **Add Redis caching** for data that doesn't change every request (covered in Scenario 4)

---

## Scenario 3: Frontend Starts Lagging Under Heavy API Load

### The Situation

Your backend is holding up now, but the frontend is suffering. Users report:
- Search results take forever because every keystroke fires an API call
- The product listing page makes 15 API calls on load
- Scroll performance is terrible on long lists
- The app feels "janky" even when the network is fast

### Problem A: Every Keystroke Triggers an API Call

```jsx
// ❌ BAD: Fires API call on every single keystroke
function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleChange = async (e) => {
    const value = e.target.value;
    setQuery(value);

    // User types "react" → 5 API calls: "r", "re", "rea", "reac", "react"
    const response = await fetch(`/api/v1/search?q=${value}`);
    const data = await response.json();
    setResults(data);
    // Race condition: "rea" response might arrive AFTER "react" response
  };

  return <input value={query} onChange={handleChange} />;
}

// ✅ GOOD: Debounce + abort controller to prevent race conditions
import { useState, useEffect, useRef } from 'react';

function UserSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);

  // Debounce: Wait 300ms after user stops typing before searching
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search only fires on debounced value
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/v1/search?q=${debouncedQuery}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setResults(data))
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
// User types "react" → 1 API call (for "react") instead of 5
```

### Problem B: Too Many API Calls on Page Load

```jsx
// ❌ BAD: Dashboard makes 8 separate API calls on mount
function Dashboard() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recommendations, setRecs] = useState([]);

  useEffect(() => {
    // 6 separate HTTP requests, 6 separate DB queries on the backend
    fetch('/api/v1/user/me').then(r => r.json()).then(setUser);
    fetch('/api/v1/orders?limit=5').then(r => r.json()).then(setOrders);
    fetch('/api/v1/notifications').then(r => r.json()).then(setNotifications);
    fetch('/api/v1/stats').then(r => r.json()).then(setStats);
    fetch('/api/v1/activity?limit=10').then(r => r.json()).then(setRecentActivity);
    fetch('/api/v1/recommendations').then(r => r.json()).then(setRecs);
  }, []);

  // ...
}

// ✅ GOOD Option 1: Create a dedicated dashboard endpoint (BFF pattern)
// Backend: One endpoint that aggregates what the dashboard needs
app.get('/api/v1/dashboard', async (req, res) => {
  const userId = req.user.id;

  // Run all queries in parallel on the server (much faster than 6 HTTP round trips)
  const [user, orders, notifications, stats] = await Promise.all([
    userService.getById(userId),
    orderService.getRecent(userId, 5),
    notificationService.getUnread(userId),
    statsService.getUserStats(userId),
  ]);

  res.json({ user, orders, notifications, stats });
});

// Frontend: Single API call
function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get('/api/v1/dashboard'),
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <>
      <UserHeader user={data.user} />
      <RecentOrders orders={data.orders} />
      <Notifications items={data.notifications} />
      <StatsPanel stats={data.stats} />
    </>
  );
}
```

```jsx
// ✅ GOOD Option 2: Parallel requests with proper loading states (if BFF isn't possible)
function Dashboard() {
  const userQuery = useQuery({ queryKey: ['user'], queryFn: fetchUser });
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  // These all fire in parallel and cache independently

  return (
    <>
      {userQuery.isLoading ? <Skeleton /> : <UserHeader user={userQuery.data} />}
      {ordersQuery.isLoading ? <Skeleton /> : <RecentOrders orders={ordersQuery.data} />}
      {statsQuery.isLoading ? <Skeleton /> : <StatsPanel stats={statsQuery.data} />}
    </>
  );
}
// Each section loads independently - users see content as it arrives
```

### Problem C: Rendering Thousands of Items

```jsx
// ❌ BAD: Renders ALL 10,000 items at once
function ProductList({ products }) {
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
// 10,000 DOM nodes. Browser freezes. Scroll is unusable.

// ✅ GOOD: Virtualized list - only renders visible items
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function ProductList({ products }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ProductCard product={products[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
// 10,000 items but only ~15 DOM nodes at any time. Butter-smooth scrolling.
```

### Problem D: Images Kill Your Page

```jsx
// ❌ BAD: All images load immediately, even below the fold
<img src={product.imageUrl} alt={product.name} />

// ✅ GOOD: Native lazy loading + proper sizing
<img
  src={product.imageUrl}
  alt={product.name}
  loading="lazy"
  width={300}
  height={200}
  decoding="async"
/>

// Even better with Next.js:
import Image from 'next/image';
<Image
  src={product.imageUrl}
  alt={product.name}
  width={300}
  height={200}
  placeholder="blur"
  blurDataURL={product.blurHash}
/>
// Automatic: lazy loading, WebP conversion, responsive sizes, CDN caching
```

---

## Scenario 4: Too Many Requests Hitting the Backend - Rate Limiting, Caching, and Queues

### The Situation

Your frontend fixes reduced the number of API calls per user. But with 20K users, even optimized traffic is massive. Your backend is getting:
- 5,000 requests/second to the products endpoint
- Repeated identical queries hitting the database
- Users spamming the "submit order" button

### Layer 1: Rate Limiting - Protect Your Backend

```javascript
const rateLimit = require('express-rate-limit');

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit on expensive endpoints
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // Only 20 search requests per minute per IP
  message: { error: 'Search rate limit exceeded' },
});

// Very strict on auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, try again in 15 minutes' },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/search', searchLimiter);
app.use('/api/v1/auth/login', authLimiter);
```

**For multi-server deployments, use Redis-backed rate limiting:**

```javascript
const RedisStore = require('rate-limit-redis');
const redis = require('redis').createClient({ url: process.env.REDIS_URL });

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  store: new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args),
  }),
});
```

### Layer 2: Redis Caching - Stop Hitting the Database

The products endpoint gets 5,000 req/s, but the product list only changes every few minutes. Why query the database 5,000 times for the same data?

```javascript
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

class ProductService {
  async getProducts(filters) {
    const cacheKey = `products:${JSON.stringify(filters)}`;

    // 1. Try cache first
    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached); // Cache hit - 0.5ms instead of 50ms
    }

    // 2. Cache miss - query database
    const products = await productRepository.find(filters);

    // 3. Store in cache with TTL
    await client.setEx(
      cacheKey,
      120, // Cache for 2 minutes
      JSON.stringify(products)
    );

    return products;
  }

  async updateProduct(id, data) {
    const product = await productRepository.update(id, data);

    // Invalidate relevant caches when data changes
    const keys = await client.keys('products:*');
    if (keys.length > 0) {
      await client.del(keys);
    }

    return product;
  }
}
```

**Cache-aside pattern - the most common caching strategy:**

```
Request → Check Redis → Hit? → Return cached data
                       ↓ Miss
              Query database → Store in Redis → Return data
```

**What to cache and for how long:**

| Data | TTL | Reason |
|---|---|---|
| Product listings | 2-5 min | Changes infrequently, high traffic |
| User profile | 30-60 sec | Changes occasionally |
| Search results | 60 sec | Same searches happen repeatedly |
| Dashboard stats | 5-10 min | Expensive to compute, approximate is OK |
| Session data | 24 hours | Needs to persist across requests |
| Real-time data (stock prices, live scores) | Don't cache | Staleness is unacceptable |

### Layer 3: Message Queues - Handle What Can't Be Done Immediately

Some operations shouldn't happen during the HTTP request:

```javascript
// ❌ BAD: Order processing blocks the HTTP response
app.post('/api/v1/orders', async (req, res) => {
  const order = await createOrder(req.body);        // 50ms
  await chargePayment(order);                        // 2000ms (Stripe API call)
  await updateInventory(order);                      // 100ms
  await sendConfirmationEmail(order);                // 1500ms
  await notifyWarehouse(order);                      // 500ms
  await updateAnalytics(order);                      // 200ms

  res.json(order);
  // Total: ~4.3 seconds. User stares at a spinner. Server thread is blocked.
  // Under load, these pile up and kill your server.
});

// ✅ GOOD: Do the critical path sync, everything else async
const Queue = require('bull');
const orderQueue = new Queue('order-processing', process.env.REDIS_URL);

app.post('/api/v1/orders', async (req, res) => {
  const order = await createOrder(req.body);         // 50ms
  await chargePayment(order);                         // 2000ms - must be sync (user needs to know)

  // Everything else goes to the queue
  await orderQueue.add('post-order', {
    orderId: order.id,
    tasks: ['updateInventory', 'sendEmail', 'notifyWarehouse', 'analytics'],
  });

  res.status(201).json(order);
  // Total: ~2 seconds. Rest happens in background.
});

// Worker process (separate from your web server)
orderQueue.process('post-order', async (job) => {
  const { orderId } = job.data;
  const order = await getOrder(orderId);

  await updateInventory(order);
  await sendConfirmationEmail(order);
  await notifyWarehouse(order);
  await updateAnalytics(order);
});
```

**Why this matters for scaling:**

1. **Web server stays responsive.** It only does the critical path (create order + charge).
2. **Workers scale independently.** Need more email throughput? Add more workers.
3. **Retries are built in.** If the email service is down, Bull retries automatically.
4. **Backpressure is handled.** If 1,000 orders come in at once, the queue buffers them. Workers process at their own pace.

### Layer 4: CDN - Serve Static Assets from the Edge

```javascript
// ❌ BAD: Your Node.js server serves static files
app.use(express.static('public')); // Every JS, CSS, image request goes to your server

// ✅ GOOD: CDN serves static files, your server only handles API
// In your frontend build config (Next.js example):
// next.config.js
module.exports = {
  assetPrefix: process.env.CDN_URL || '', // e.g., https://cdn.yourapp.com
  images: {
    domains: ['cdn.yourapp.com'],
  },
};

// For non-Next.js apps, configure your reverse proxy (nginx):
// location /static/ {
//     proxy_pass https://cdn.yourapp.com/;
//     expires 1y;
//     add_header Cache-Control "public, immutable";
// }
```

**What a CDN does for you:**
- Static files served from 200+ locations worldwide (50ms → 5ms)
- Your server's bandwidth isn't wasted on serving JS/CSS/images
- Built-in DDoS protection
- Automatic compression (gzip/brotli)

---

## The Traffic Spike Decision Tree

When your system is under heavy load, work through this checklist:

```
Is the database overloaded?
├── Yes → Add connection pooling
│         Check for missing indexes (explain())
│         Fix N+1 queries
│         Add Redis caching for hot queries
│
├── Is the API server CPU/memory maxed?
│   ├── Yes → Add request timeouts
│   │         Add rate limiting
│   │         Offload heavy work to queues
│   │         Consider horizontal scaling (more servers)
│   │
│   └── Is the frontend making too many requests?
│       ├── Yes → Add debouncing on search/autocomplete
│       │         Batch API calls (BFF pattern)
│       │         Add client-side caching (React Query staleTime)
│       │         Virtualize long lists
│       │
│       └── Is bandwidth the bottleneck?
│           ├── Yes → Put static assets on CDN
│           │         Compress API responses (gzip)
│           │         Lazy load images
│           │         Reduce payload sizes (field selection)
│           │
│           └── Check application-level issues:
│               ├── Memory leaks (growing heap over time)
│               ├── Synchronous blocking operations
│               └── Missing error handling causing retries
```

---

## Trade-Offs You Need to Understand

### Caching Trade-Offs

| Benefit | Cost |
|---|---|
| Dramatically reduces DB load | Stale data (users might see outdated info) |
| Sub-millisecond response times | Cache invalidation complexity |
| Protects against traffic spikes | Extra infrastructure (Redis) |
| | Memory cost for cached data |

**When caching goes wrong:** User updates their profile. The cache still serves the old profile for 2 minutes. User thinks the update didn't work. They submit again. Now you have duplicate data.

**Solution:** Invalidate on write, or use short TTLs for user-specific data.

### Rate Limiting Trade-Offs

| Benefit | Cost |
|---|---|
| Protects your server from overload | Legitimate users might get blocked |
| Prevents abuse and scraping | Need to tune limits per endpoint |
| Predictable resource usage | Shared IPs (corporate offices, VPNs) hit limits fast |

**Solution:** Use user-based rate limiting (not just IP-based) for authenticated endpoints. Provide clear `Retry-After` headers.

### Queue Trade-Offs

| Benefit | Cost |
|---|---|
| Faster API responses | Eventual consistency (email might be delayed) |
| Backend resilience under load | More infrastructure to manage |
| Automatic retry on failure | Harder to debug (distributed system) |
| Independent scaling | Need monitoring for queue depth |

**When queues go wrong:** Your queue worker crashes. 10,000 unprocessed jobs pile up. When the worker restarts, it tries to process them all at once, overwhelming the downstream services.

**Solution:** Set concurrency limits on workers, implement dead-letter queues, and monitor queue depth.

---

## Monitoring - How to See Problems Before Users Do

Set up these alerts from day one:

```javascript
// Health check endpoint with real information
app.get('/health', async (req, res) => {
  const checks = {};

  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    checks.database = { status: 'error', message: err.message };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    checks.redis = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    checks.redis = { status: 'error', message: err.message };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks,
  });
});
```

**Key metrics to monitor:**
- **Response time (p95, p99)** - not averages. If your p99 is 5s, 1 in 100 users waits 5+ seconds.
- **Error rate** - % of 5xx responses. Alert at > 1%.
- **Database connection pool utilization** - Alert at > 80%.
- **Memory usage trend** - Gradually increasing = memory leak.
- **Queue depth** - Growing queue = workers can't keep up.

---

*Next up: [Blog 3 - Scaling to 100K+ users: load balancing, horizontal scaling, failure recovery, and the architecture that makes it all work.](scalable-code-production-scaling.md)*
