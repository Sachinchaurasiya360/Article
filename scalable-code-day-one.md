# Writing Scalable Code from Day 1: Frontend + Backend Foundations

*How a senior engineer would build things differently from the start — so you never have to "rewrite everything" later.*

---

## The Story That Repeats Itself

You join a startup. The codebase is 6 months old. There are 800 users. Everything works.

Then the product gets featured on Hacker News. Traffic jumps 20x overnight. The API starts returning 500s. The database CPU hits 100%. The frontend freezes because it's fetching the entire user list on every render.

The team spends the next 3 weeks rewriting everything.

**This article exists so you never end up in that situation.** Not because you'll over-engineer from day one — but because you'll make small, smart decisions early that compound into a system that can actually grow.

---

## Part 1: API Design — The Contract Between Your Frontend and Backend

Your API is the spine of your application. Get it wrong early, and every layer above and below it suffers.

### REST vs GraphQL: The Real Decision Framework

Forget the "GraphQL is better" or "REST is simpler" debates. Here's how you actually decide:

**Use REST when:**
- Your data model maps cleanly to resources (users, orders, products)
- Your clients are mostly your own frontend
- You need strong HTTP caching (CDN, browser cache)
- Your team is small and needs to move fast

**Use GraphQL when:**
- You have multiple clients (web, mobile, third-party) with different data needs
- Your frontend frequently needs nested/related data in one request
- Over-fetching is a real, measured problem — not a theoretical one
- You have a team that can maintain the schema and resolvers

**The mistake:** Choosing GraphQL because it "sounds modern" when you have one frontend and 10 API endpoints. You just added a query language, a schema, resolvers, and a new debugging surface — for zero benefit.

### Route Design That Scales

**Bad: Verb-based, inconsistent routes**

```
GET    /getUsers
POST   /createUser
GET    /fetchOrdersByUser?user=123
POST   /deleteProduct
GET    /api/v1/users but also /users/api
```

**Good: Resource-based, predictable routes**

```
GET    /api/v1/users              → List users
POST   /api/v1/users              → Create user
GET    /api/v1/users/:id          → Get single user
PUT    /api/v1/users/:id          → Update user
DELETE /api/v1/users/:id          → Delete user
GET    /api/v1/users/:id/orders   → Get user's orders
```

The pattern is always: `/api/version/resource/identifier/sub-resource`

### Pagination, Filtering, Versioning — Do Them from Day 1

**Pagination — The #1 thing beginners skip:**

```javascript
// ❌ BAD: Returns ALL users. Works with 50 users. Crashes with 50,000.
app.get('/api/v1/users', async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// ✅ GOOD: Cursor-based pagination from day one
app.get('/api/v1/users', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cursor = req.query.cursor;

  const query = cursor
    ? { _id: { $gt: cursor } }
    : {};

  const users = await User.find(query)
    .sort({ _id: 1 })
    .limit(limit + 1); // Fetch one extra to check if there's a next page

  const hasNext = users.length > limit;
  const results = hasNext ? users.slice(0, -1) : users;

  res.json({
    data: results,
    pagination: {
      nextCursor: hasNext ? results[results.length - 1]._id : null,
      hasNext,
    },
  });
});
```

**Why cursor-based over offset?** With offset pagination (`?page=5&limit=20`), if someone inserts a record while you're paginating, you either skip a record or see a duplicate. Cursor-based pagination is stable.

**Filtering — Build the pattern, even if you only have one filter:**

```javascript
// ✅ Consistent filtering pattern
app.get('/api/v1/products', async (req, res) => {
  const filters = {};

  if (req.query.category) filters.category = req.query.category;
  if (req.query.minPrice) filters.price = { $gte: parseFloat(req.query.minPrice) };
  if (req.query.status) filters.status = req.query.status;

  const products = await Product.find(filters)
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ data: products });
});
```

**Versioning:** Always prefix with `/api/v1/`. When you need to make breaking changes, you create `/api/v2/` and keep v1 running. This costs you nothing today and saves you everything tomorrow.

---

## Part 2: Backend Architecture — Structure That Survives Growth

### The Modular Architecture Pattern

Here's the difference between a codebase that survives 100K users and one that doesn't:

**❌ BAD: Everything in one file (the "startup special")**

```javascript
// server.js — 2000 lines of everything
const express = require('express');
const mongoose = require('mongoose');
const app = express();

mongoose.connect('mongodb://localhost/myapp');

const userSchema = new mongoose.Schema({ name: String, email: String });
const User = mongoose.model('User', userSchema);

app.post('/api/users', async (req, res) => {
  try {
    // Validation mixed with business logic mixed with DB calls
    if (!req.body.email) return res.status(400).json({ error: 'Email required' });
    if (!req.body.email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(409).json({ error: 'User exists' });

    const user = new User(req.body);
    await user.save();

    // Send welcome email inline
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport(/* ... */);
    await transporter.sendMail({
      to: user.email,
      subject: 'Welcome!',
      html: '<h1>Welcome to our app!</h1>',
    });

    res.status(201).json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Something broke' });
  }
});

// ... 50 more routes like this
```

**✅ GOOD: Separated into layers**

```
src/
├── routes/          → HTTP layer (req/res only)
│   └── user.routes.js
├── controllers/     → Request handling (validation, response formatting)
│   └── user.controller.js
├── services/        → Business logic (the actual "what your app does")
│   └── user.service.js
├── repositories/    → Database access (queries, models)
│   └── user.repository.js
├── middleware/       → Cross-cutting concerns (auth, logging, rate limiting)
│   ├── auth.js
│   └── errorHandler.js
├── utils/           → Shared helpers
│   └── logger.js
└── app.js           → App setup
```

```javascript
// routes/user.routes.js
const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');

router.post('/', userController.createUser);
router.get('/', authenticate, userController.listUsers);
router.get('/:id', authenticate, userController.getUser);

module.exports = router;
```

```javascript
// controllers/user.controller.js
const userService = require('../services/user.service');

exports.createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err); // Let the error handler deal with it
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const { limit, cursor } = req.query;
    const result = await userService.listUsers({ limit, cursor });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

```javascript
// services/user.service.js — This is where the REAL logic lives
const userRepository = require('../repositories/user.repository');
const emailService = require('./email.service');

class UserService {
  async createUser(data) {
    const { email, name } = data;

    if (!email || !email.includes('@')) {
      const error = new Error('Valid email is required');
      error.statusCode = 400;
      throw error;
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const error = new Error('User already exists');
      error.statusCode = 409;
      throw error;
    }

    const user = await userRepository.create({ email, name });

    // Don't await this — send email in background
    emailService.sendWelcomeEmail(user.email).catch(err => {
      logger.error('Failed to send welcome email', { userId: user.id, error: err.message });
    });

    return user;
  }

  async listUsers({ limit = 20, cursor }) {
    return userRepository.findWithPagination({ limit: Math.min(limit, 100), cursor });
  }
}

module.exports = new UserService();
```

```javascript
// repositories/user.repository.js
const User = require('../models/user.model');

class UserRepository {
  async findByEmail(email) {
    return User.findOne({ email });
  }

  async create(data) {
    const user = new User(data);
    return user.save();
  }

  async findWithPagination({ limit, cursor }) {
    const query = cursor ? { _id: { $gt: cursor } } : {};
    const users = await User.find(query).sort({ _id: 1 }).limit(limit + 1);
    const hasNext = users.length > limit;
    const results = hasNext ? users.slice(0, -1) : users;

    return {
      data: results,
      pagination: {
        nextCursor: hasNext ? results[results.length - 1]._id : null,
        hasNext,
      },
    };
  }
}

module.exports = new UserRepository();
```

**Why this matters for scaling:**

1. **You can test business logic without HTTP.** The service layer doesn't know about `req` or `res`.
2. **You can swap databases.** Change the repository — everything else stays the same.
3. **You can scale independently.** Move the email service to a queue. Move the user service to a microservice. The boundaries are already clean.
4. **New developers can find things.** "Where's the user creation logic?" → `services/user.service.js`. Always.

### Logging and Error Handling — The Things You'll Desperately Need at 3 AM

**❌ BAD: console.log and generic catches**

```javascript
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (err) {
    console.log(err); // Where does this go in production? Nowhere useful.
    res.status(500).json({ error: 'Something went wrong' }); // What went wrong? Who knows.
  }
});
```

**✅ GOOD: Structured logging + centralized error handling**

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

module.exports = logger;
```

```javascript
// middleware/errorHandler.js
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.statusCode != null; // Expected errors have statusCode

  logger.error({
    message: err.message,
    statusCode,
    stack: isOperational ? undefined : err.stack, // Only log stack for unexpected errors
    requestId: req.id,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    error: {
      message: isOperational ? err.message : 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
```

**The key insight:** You need to distinguish between *operational errors* (bad user input, resource not found) and *programmer errors* (null pointer, unhandled promise). Operational errors get clean messages. Programmer errors get logged with full stack traces and return generic 500s.

---

## Part 3: Frontend Architecture — Building for Growth

### Component Structure That Scales

**❌ BAD: God components that do everything**

```jsx
// UserDashboard.jsx — 500 lines, fetches data, manages state,
// renders everything, handles all interactions
function UserDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  // ... 400 more lines of mixed concerns
  return (
    <div>
      {/* 200 lines of JSX */}
    </div>
  );
}
```

**✅ GOOD: Separated by responsibility**

```
components/
├── users/
│   ├── UserDashboard.jsx        → Page-level layout and coordination
│   ├── UserList.jsx             → Renders the list (presentational)
│   ├── UserListItem.jsx         → Single user row
│   ├── UserSearch.jsx           → Search input with debounce
│   ├── UserEditModal.jsx        → Edit form in a modal
│   └── useUsers.js              → Custom hook for user data fetching
```

```jsx
// useUsers.js — Data fetching logic, completely separated from UI
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../utils/apiClient';

export function useUsers({ search, sortBy } = {}) {
  const [data, setData] = useState({ users: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async (cursor = null) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sortBy) params.set('sortBy', sortBy);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const result = await apiClient.get(`/api/v1/users?${params}`);

      setData(prev => ({
        users: cursor ? [...prev.users, ...result.data] : result.data,
        pagination: result.pagination,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const loadMore = () => {
    if (data.pagination?.nextCursor) {
      fetchUsers(data.pagination.nextCursor);
    }
  };

  return { ...data, loading, error, loadMore, refetch: fetchUsers };
}
```

```jsx
// UserDashboard.jsx — Clean, coordinating component
import { useState } from 'react';
import { useUsers } from './useUsers';
import { UserSearch } from './UserSearch';
import { UserList } from './UserList';

export function UserDashboard() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const { users, loading, error, loadMore, pagination } = useUsers({ search, sortBy });

  return (
    <div className="dashboard">
      <h1>Users</h1>
      <UserSearch value={search} onChange={setSearch} />
      <UserList
        users={users}
        loading={loading}
        error={error}
        onLoadMore={loadMore}
        hasMore={pagination?.hasNext}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
    </div>
  );
}
```

### State Management — The Decision That Haunts You

Here's the real framework:

| What you're storing | Where to put it |
|---|---|
| Server data (users, products, orders) | React Query / SWR / TanStack Query |
| UI state (modal open, sidebar collapsed) | Local component state (`useState`) |
| Shared UI state (theme, current user session) | React Context |
| Complex cross-component state | Zustand (lightweight) or Redux (if you need middleware/devtools) |

**The #1 mistake:** Putting server data in Redux/Zustand. This means YOU are now responsible for caching, invalidation, loading states, error states, refetching, and deduplication. Libraries like TanStack Query handle all of this:

```jsx
// ❌ BAD: Managing server state manually
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/users')
    .then(r => r.json())
    .then(data => setUsers(data))
    .catch(err => setError(err))
    .finally(() => setLoading(false));
}, []);
// You haven't handled: caching, deduplication, background refetch,
// stale data, window focus refetch, retry logic, pagination...

// ✅ GOOD: Let a purpose-built library handle it
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/api/v1/users'),
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
  });
  // Caching, deduplication, background refetch, retry — all handled.
}
```

### API Handling — Stop Over-Fetching

**❌ BAD: Fetching everything, using 10%**

```jsx
// Dashboard only shows user name and avatar
// But this fetches: name, email, address, phone, orders, preferences,
// activity history, payment methods...
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetch(`/api/v1/users/${userId}`).then(r => r.json()),
});

// Only uses: data.name, data.avatar
```

**✅ GOOD: Request only what you need**

```javascript
// Backend: Support field selection
app.get('/api/v1/users/:id', async (req, res) => {
  const fields = req.query.fields?.split(',') || null;
  const projection = fields
    ? fields.reduce((acc, f) => ({ ...acc, [f.trim()]: 1 }), {})
    : null;

  const user = await User.findById(req.params.id, projection);
  res.json({ data: user });
});

// Frontend: Request specific fields
const { data } = useQuery({
  queryKey: ['user', userId, 'summary'],
  queryFn: () => apiClient.get(`/api/v1/users/${userId}?fields=name,avatar`),
});
```

---

## Part 4: Database Decisions — SQL vs NoSQL

### The Real Decision Framework

**Use PostgreSQL (SQL) when:**
- Your data has clear relationships (users → orders → products)
- You need transactions (payment processing, inventory management)
- You need complex queries (reporting, analytics)
- Data integrity is critical
- **Default choice for most applications**

**Use MongoDB (NoSQL) when:**
- Your data schema genuinely varies between records
- You're storing documents/content (CMS, logging, event streams)
- You need horizontal scaling from the start (rare at early stage)
- Nested/hierarchical data that doesn't map well to tables

**The mistake most people make:** Choosing MongoDB because "it's easier" or "no migrations." Then 6 months later, you need to find all users who ordered a specific product in the last 30 days, and you're writing aggregation pipelines that would have been a simple SQL JOIN.

### Indexing — The Cheapest Performance Win

```javascript
// MongoDB: You MUST index fields you query on
// Without index on 'email': Full collection scan — O(n)
// With index on 'email': Index lookup — O(log n)

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true }, // unique creates an index
  name: String,
  status: String,
  createdAt: { type: Date, default: Date.now },
});

// Compound index for queries that filter on status AND sort by createdAt
userSchema.index({ status: 1, createdAt: -1 });
```

```sql
-- PostgreSQL equivalent
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_created ON users(status, created_at DESC);
```

**Rule of thumb:** If you have a `WHERE` clause or a `.find()` filter on a field, that field needs an index. Check your slow query logs regularly — they'll tell you exactly which indexes you're missing.

---

## Part 5: The Beginner Mistakes That Kill Scalability

### Mistake 1: Tight Coupling

```javascript
// ❌ BAD: Controller directly uses mongoose, sends emails, logs to specific service
app.post('/api/users', async (req, res) => {
  const user = new mongoose.model('User')(req.body);
  await user.save();
  await sendgrid.send({ to: user.email, template: 'welcome' });
  await slackWebhook.send(`New user: ${user.email}`);
  res.json(user);
});
// Want to switch from SendGrid to SES? Change this route handler.
// Want to switch from MongoDB to Postgres? Change this route handler.
// Want to add tests? You need a running MongoDB, SendGrid, and Slack.

// ✅ GOOD: Depend on abstractions, not implementations
// The controller calls userService.createUser()
// The service calls emailService.sendWelcome() and notificationService.notify()
// Each service can be swapped, mocked, or scaled independently
```

### Mistake 2: No Error Handling Strategy

```javascript
// ❌ BAD: Silent failures
async function processOrder(orderId) {
  try {
    const order = await getOrder(orderId);
    await chargePayment(order);
    await updateInventory(order);
    await sendConfirmation(order);
  } catch (err) {
    console.log('error', err); // That's it? What failed? Is the order half-processed?
  }
}

// ✅ GOOD: Each step is explicit about failure
async function processOrder(orderId) {
  const order = await getOrder(orderId);
  if (!order) throw new NotFoundError(`Order ${orderId} not found`);

  try {
    await chargePayment(order);
  } catch (err) {
    logger.error('Payment failed', { orderId, error: err.message });
    await updateOrderStatus(orderId, 'payment_failed');
    throw new PaymentError(`Payment failed for order ${orderId}`);
  }

  try {
    await updateInventory(order);
  } catch (err) {
    logger.error('Inventory update failed, initiating refund', { orderId });
    await refundPayment(order); // Compensating transaction
    throw err;
  }

  // Email is non-critical — don't fail the order if it doesn't send
  sendConfirmation(order).catch(err => {
    logger.warn('Confirmation email failed', { orderId, error: err.message });
  });
}
```

### Mistake 3: No Scalability Thinking

```javascript
// ❌ BAD: Storing sessions in memory
const sessions = {}; // Dies when server restarts, can't work with multiple servers

// ✅ GOOD: External session store from day one
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis').createClient({ url: process.env.REDIS_URL });

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
```

```javascript
// ❌ BAD: Processing heavy work synchronously in the request
app.post('/api/reports', async (req, res) => {
  const data = await generateHugeReport(req.body); // Takes 30 seconds
  res.json(data); // User's request hangs for 30 seconds. Server thread is blocked.
});

// ✅ GOOD: Offload to a background job, return immediately
app.post('/api/reports', async (req, res) => {
  const jobId = await jobQueue.add('generate-report', req.body);
  res.status(202).json({
    message: 'Report generation started',
    jobId,
    statusUrl: `/api/reports/status/${jobId}`,
  });
});
```

---

## The Foundation Checklist

Before you write your first line of production code, make sure you have:

- [ ] **API versioning** (`/api/v1/`)
- [ ] **Pagination** on all list endpoints
- [ ] **Structured logging** (not `console.log`)
- [ ] **Centralized error handling** middleware
- [ ] **Separated layers** (routes → controllers → services → repositories)
- [ ] **Database indexes** on fields you query
- [ ] **External session/state store** (Redis), not in-memory
- [ ] **Environment variables** for all configuration
- [ ] **Health check endpoint** (`GET /health`)
- [ ] **Request ID tracking** through the entire request lifecycle

None of these require extra infrastructure. None of these slow you down. But all of them will save you when traffic goes from 1K to 100K.

---

*Next up: [Blog 2 — What actually breaks when your traffic jumps 20x overnight, and how to fix it in real-time.](scalable-code-traffic-spikes.md)*
