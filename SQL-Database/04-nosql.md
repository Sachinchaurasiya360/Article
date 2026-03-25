# Part 4: NoSQL & Modern Databases

> Understand when relational databases aren't the best tool. Master NoSQL types, MongoDB, DynamoDB, Redis, the CAP theorem, and how to make the SQL vs NoSQL decision in interviews.

---

## Table of Contents

- [4.1 NoSQL Overview & Types](#41-nosql-overview--types)
- [4.2 When to Use NoSQL vs SQL](#42-when-to-use-nosql-vs-sql)
- [4.3 Document Databases — MongoDB](#43-document-databases--mongodb)
- [4.4 Key-Value Stores — Redis & DynamoDB](#44-key-value-stores--redis--dynamodb)
- [4.5 Column-Family Stores — Cassandra](#45-column-family-stores--cassandra)
- [4.6 Graph Databases — Neo4j](#46-graph-databases--neo4j)
- [4.7 Denormalization](#47-denormalization)
- [4.8 CAP Theorem](#48-cap-theorem)
- [4.9 NewSQL & Modern Hybrid Databases](#49-newsql--modern-hybrid-databases)
- [4.10 NoSQL Interview Problems & Practice](#410-nosql-interview-problems--practice)

---

## 4.1 NoSQL Overview & Types

### Question: What is NoSQL and what are the different types?

**Answer:**

NoSQL ("Not Only SQL") databases are designed for specific data models and access patterns where relational databases become bottlenecks. They trade some RDBMS guarantees (joins, strict schema, ACID) for scalability, flexibility, or performance.

```
                        NoSQL Database Types
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
   Key-Value    Document    Column-     Graph     Time-Series
                            Family
   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
   │ Redis  │  │MongoDB │  │Cassan- │  │ Neo4j  │  │Influx- │
   │DynamoDB│  │CouchDB │  │ dra    │  │Amazon  │  │  DB    │
   │Memcach.│  │Firestore│ │ HBase  │  │Neptune │  │TimescDB│
   └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

#### Key-Value Stores

```
Structure: key → value (opaque blob)

┌─────────────┬────────────────────────────┐
│ Key         │ Value                      │
├─────────────┼────────────────────────────┤
│ user:1001   │ {"name":"Alice","age":30}  │
│ session:abc │ {token, expiry, user_id}   │
│ cache:page1 │ <HTML content>             │
└─────────────┴────────────────────────────┘

Operations: GET, SET, DELETE — O(1)
No queries on values (just key lookup)
Examples: Redis, Memcached, DynamoDB
Use cases: Caching, session storage, rate limiting
```

#### Document Stores

```
Structure: key → document (JSON/BSON with nested structure)

{
    "_id": "order_1001",
    "customer": {
        "name": "Alice",
        "email": "alice@test.com"
    },
    "items": [
        {"product": "Laptop", "price": 1200, "quantity": 1},
        {"product": "Mouse",  "price": 25,   "quantity": 2}
    ],
    "total": 1250,
    "status": "delivered"
}

Operations: CRUD + queries on any field (including nested)
Rich query language (MongoDB Query Language, etc.)
Examples: MongoDB, CouchDB, Firestore
Use cases: Content management, catalogs, user profiles
```

#### Column-Family Stores

```
Structure: Row key → column families → columns

Row Key     | Column Family: "profile"        | Column Family: "activity"
────────────┼─────────────────────────────────┼──────────────────────────
user:1001   | name="Alice" | email="a@b.com"  | login:2024-01-01="NYC"
            |              |                   | login:2024-01-02="SF"
────────────┼─────────────────────────────────┼──────────────────────────
user:1002   | name="Bob"   |                   | login:2024-01-01="LA"

Key insight: Each row can have different columns
Optimized for: writes, time-series, wide rows
Examples: Cassandra, HBase, ScyllaDB
Use cases: IoT data, event logging, time-series
```

#### Graph Databases

```
Structure: Nodes + Edges (relationships)

    (Alice)──[FRIENDS_WITH]──>(Bob)
       │                        │
  [WORKS_AT]              [WORKS_AT]
       │                        │
       ▼                        ▼
   (Google)──[COMPETES_WITH]──(Meta)

Both nodes and edges can have properties
Traversal queries are O(1) per hop (vs O(n) JOIN in SQL)
Examples: Neo4j, Amazon Neptune, ArangoDB
Use cases: Social networks, recommendations, fraud detection
```

> **Why the interviewer asks this:** They want to see you can choose the right database for the job. Listing types isn't enough — you must explain the trade-offs and access patterns each type optimizes for.

**Follow-up:** *Give me a scenario where you'd migrate from SQL to NoSQL mid-project. What would trigger that decision?*

---

## 4.2 When to Use NoSQL vs SQL

### Question: How do you decide between SQL and NoSQL for a new project?

**Answer:**

This is one of the most important architectural decisions. Here's a systematic framework:

#### Choose SQL (Relational) When:

```
✅ Data has clear relationships (users → orders → items)
✅ You need ACID transactions (financial, inventory)
✅ Schema is well-defined and stable
✅ Complex queries with JOINs, aggregations, window functions
✅ Data integrity is critical (constraints, foreign keys)
✅ Moderate scale (single server can handle the load)
✅ Ad-hoc queries needed (analytics, reporting)
```

#### Choose NoSQL When:

```
✅ Massive scale needed (millions of reads/writes per second)
✅ Flexible/evolving schema (each document can differ)
✅ Horizontal scaling is a priority
✅ Specific access patterns (key lookup, document retrieval)
✅ Denormalized data is natural (embedded documents)
✅ Geographic distribution (multi-region, low latency)
✅ High availability is more important than consistency
```

#### Decision Matrix by Use Case

| Use Case | Best Fit | Why |
|---|---|---|
| Banking / Financial | PostgreSQL / MySQL | ACID transactions, consistency critical |
| E-commerce catalog | MongoDB | Flexible product attributes, nested data |
| Social media feed | Cassandra | Write-heavy, time-ordered, distributed |
| Session storage | Redis | Fast key-value lookup, TTL support |
| Fraud detection | Neo4j | Relationship traversal is core operation |
| Real-time analytics | ClickHouse / TimescaleDB | Columnar storage, aggregation speed |
| IoT sensor data | Cassandra / TimescaleDB | High write throughput, time-series |
| User profiles | MongoDB / DynamoDB | Flexible schema, key-value access |
| Search engine | Elasticsearch | Full-text search, relevance ranking |
| Chat application | Redis (pub/sub) + MongoDB | Real-time messaging + message history |
| Content management | MongoDB | Rich documents, flexible structure |
| Gaming leaderboard | Redis (sorted sets) | O(log n) ranking operations |

#### Common Anti-Patterns

```
❌ Using MongoDB for financial transactions (no multi-document ACID until v4.0)
❌ Using SQL for 100TB+ event logs (scale + write throughput issues)
❌ Using Redis as primary database (volatility — data loss on crash)
❌ Using a graph database for simple CRUD (over-engineering)
❌ "We might need to scale someday" → Don't optimize prematurely
```

#### Polyglot Persistence — Use Multiple Databases

```
Real-world architecture often uses MULTIPLE databases:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │   MongoDB    │    │    Redis     │
│  (Orders,    │    │  (Product    │    │  (Cache,     │
│   Payments)  │    │   Catalog)   │    │   Sessions)  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                    Application Layer
```

> **Why the interviewer asks this:** This question tests architectural thinking. The best answer isn't "always SQL" or "always NoSQL" — it's demonstrating you can evaluate trade-offs based on specific requirements.

**Follow-up:** *What is polyglot persistence and what challenges does it introduce?*

---

## 4.3 Document Databases — MongoDB

### Question: Explain MongoDB's data model, query language, and indexing.

**Answer:**

MongoDB stores data as **BSON documents** (Binary JSON) organized in **collections** (analogous to tables).

#### Data Modeling — Embedding vs Referencing

```javascript
// EMBEDDED (Denormalized) — store related data together
// Best for: 1:1, 1:few relationships, data accessed together
{
    "_id": ObjectId("..."),
    "name": "Alice",
    "email": "alice@test.com",
    "address": {                    // Embedded subdocument
        "street": "123 Main St",
        "city": "NYC",
        "state": "NY"
    },
    "orders": [                     // Embedded array
        {
            "order_id": 1001,
            "date": ISODate("2024-01-15"),
            "items": [
                {"product": "Laptop", "price": 1200},
                {"product": "Mouse", "price": 25}
            ],
            "total": 1225
        }
    ]
}

// REFERENCED (Normalized) — store reference ID, query separately
// Best for: 1:many, many:many, large/unbounded arrays, shared data
// users collection:
{
    "_id": ObjectId("user_1"),
    "name": "Alice",
    "email": "alice@test.com"
}

// orders collection:
{
    "_id": ObjectId("order_1001"),
    "user_id": ObjectId("user_1"),  // Reference
    "date": ISODate("2024-01-15"),
    "total": 1225,
    "items": [
        {"product_id": ObjectId("prod_1"), "quantity": 1},
        {"product_id": ObjectId("prod_2"), "quantity": 1}
    ]
}
```

**When to embed vs reference:**

| Factor | Embed | Reference |
|---|---|---|
| Relationship | 1:1, 1:few | 1:many, many:many |
| Access pattern | Always accessed together | Accessed independently |
| Data size | Small, bounded | Large, unbounded |
| Update frequency | Rarely changes | Frequently updated |
| Document size | Stays under 16MB | Would exceed 16MB |

#### MongoDB Query Language (MQL)

```javascript
// Find (SELECT equivalent)
db.employees.find(
    { dept: "Engineering", salary: { $gt: 80000 } },  // WHERE
    { name: 1, salary: 1, _id: 0 }                     // SELECT (projection)
).sort({ salary: -1 })                                  // ORDER BY
 .limit(10);                                             // LIMIT

// Equivalent SQL:
// SELECT name, salary FROM employees
// WHERE dept = 'Engineering' AND salary > 80000
// ORDER BY salary DESC LIMIT 10;

// Aggregation Pipeline (GROUP BY equivalent)
db.orders.aggregate([
    { $match: { status: "delivered" } },              // WHERE
    { $group: {                                        // GROUP BY
        _id: "$customer_id",
        total_spent: { $sum: "$total" },
        order_count: { $sum: 1 }
    }},
    { $match: { order_count: { $gte: 5 } } },        // HAVING
    { $sort: { total_spent: -1 } },                   // ORDER BY
    { $limit: 10 },                                   // LIMIT
    { $lookup: {                                       // LEFT JOIN
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer_info"
    }},
    { $unwind: "$customer_info" },                    // Flatten array
    { $project: {                                      // SELECT
        customer_name: "$customer_info.name",
        total_spent: 1,
        order_count: 1
    }}
]);
```

#### MongoDB Indexing

```javascript
// Single field index
db.employees.createIndex({ email: 1 });  // 1 = ascending, -1 = descending

// Compound index (order matters, like SQL)
db.employees.createIndex({ dept: 1, salary: -1 });

// Text index (full-text search)
db.articles.createIndex({ title: "text", body: "text" });
db.articles.find({ $text: { $search: "database optimization" } });

// TTL index (auto-delete after expiry)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
// Sessions auto-delete after 1 hour

// Partial index (like PostgreSQL's partial index)
db.orders.createIndex(
    { customer_id: 1 },
    { partialFilterExpression: { status: "pending" } }
);

// Wildcard index (for dynamic schemas)
db.events.createIndex({ "metadata.$**": 1 });
// Indexes all fields inside metadata subdocument
```

#### MongoDB Transactions (v4.0+)

```javascript
const session = client.startSession();
session.startTransaction();

try {
    await db.accounts.updateOne(
        { _id: "account_A" },
        { $inc: { balance: -500 } },
        { session }
    );
    await db.accounts.updateOne(
        { _id: "account_B" },
        { $inc: { balance: 500 } },
        { session }
    );
    await session.commitTransaction();
} catch (error) {
    await session.abortTransaction();
} finally {
    session.endSession();
}
```

> **Why the interviewer asks this:** MongoDB is the most popular NoSQL database. Understanding its data modeling trade-offs (embed vs reference), aggregation pipeline, and indexing shows practical NoSQL skills.

**Follow-up:** *What is MongoDB's WiredTiger storage engine and how does it handle concurrency?*

---

## 4.4 Key-Value Stores — Redis & DynamoDB

### Question: Explain Redis data structures and common use patterns.

**Answer:**

Redis is an **in-memory** data structure store used as a cache, message broker, and database.

#### Core Data Structures

```
┌────────────────┬─────────────────────────────────────────────┐
│ Type           │ Use Case                                    │
├────────────────┼─────────────────────────────────────────────┤
│ String         │ Caching, counters, session tokens           │
│ Hash           │ User profiles, settings (field:value pairs) │
│ List           │ Message queues, activity feeds              │
│ Set            │ Unique collections, tags, social graph      │
│ Sorted Set     │ Leaderboards, priority queues, time-series  │
│ Stream         │ Event sourcing, log aggregation             │
│ HyperLogLog    │ Cardinality estimation (unique visitors)    │
│ Bitmap         │ Feature flags, user activity tracking       │
└────────────────┴─────────────────────────────────────────────┘
```

```redis
# String operations
SET user:session:abc123 "user_id:42" EX 3600    # expires in 1 hour
GET user:session:abc123                          # → "user_id:42"
INCR page:views:homepage                         # atomic counter → 1, 2, 3...

# Hash (mini-document)
HSET user:42 name "Alice" email "alice@test.com" login_count 0
HGET user:42 name                                # → "Alice"
HINCRBY user:42 login_count 1                    # atomic field increment

# Sorted Set (leaderboard)
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2100 "player:bob"
ZADD leaderboard 1800 "player:carol"
ZREVRANGE leaderboard 0 2 WITHSCORES            # Top 3 (highest first)
# → player:bob(2100), player:carol(1800), player:alice(1500)
ZRANK leaderboard "player:alice"                 # → 0 (0-indexed from lowest)

# List (message queue)
LPUSH queue:emails "send welcome email to user:42"
RPOP queue:emails                                # FIFO: oldest first
BRPOP queue:emails 30                           # blocking pop (wait up to 30s)

# Set (unique tags, social graph)
SADD user:42:following "user:10" "user:20" "user:30"
SADD user:10:following "user:42" "user:20"
SINTER user:42:following user:10:following       # Mutual follows → {"user:20"}
```

#### Redis Caching Patterns

```
Cache-Aside (Lazy Loading):
1. Application checks cache
2. Cache miss → query database
3. Store result in cache with TTL
4. Return to user

Read-Through:
1. Application reads from cache
2. Cache itself fetches from database on miss
3. Cache returns data

Write-Through:
1. Application writes to cache
2. Cache synchronously writes to database
3. Both are always in sync (but slower writes)

Write-Behind (Write-Back):
1. Application writes to cache
2. Cache asynchronously writes to database (batch/delayed)
3. Faster writes, but risk of data loss if cache crashes
```

```python
# Cache-Aside pattern in Python
def get_user(user_id):
    # 1. Check cache
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)

    # 2. Cache miss — query database
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)

    # 3. Store in cache (TTL: 5 minutes)
    redis.setex(f"user:{user_id}", 300, json.dumps(user))

    return user
```

### DynamoDB

```
DynamoDB key concepts:
- Fully managed, serverless key-value + document store
- Provisioned or on-demand capacity
- Single-digit millisecond reads at any scale

Table structure:
┌──────────────────┬───────────────┬──────────────────────────┐
│ Partition Key(PK)│ Sort Key (SK) │ Attributes               │
├──────────────────┼───────────────┼──────────────────────────┤
│ user#42          │ profile       │ {name: "Alice", ...}     │
│ user#42          │ order#1001    │ {total: 99.99, ...}      │
│ user#42          │ order#1002    │ {total: 149.50, ...}     │
│ user#10          │ profile       │ {name: "Bob", ...}       │
└──────────────────┴───────────────┴──────────────────────────┘

PK = determines which partition stores the data (hash)
SK = sorts items within a partition (enables range queries)
PK + SK = unique item identifier
```

**Single-table design pattern:**

```
Instead of multiple tables, use ONE table with overloaded keys:

PK              | SK            | Data
USER#alice      | PROFILE       | {name, email, created_at}
USER#alice      | ORDER#001     | {total, status, date}
USER#alice      | ORDER#002     | {total, status, date}
ORDER#001       | ITEM#laptop   | {price, quantity}
ORDER#001       | ITEM#mouse    | {price, quantity}

Query: Get all of Alice's orders
  → PK = "USER#alice", SK begins_with "ORDER#"

Query: Get items in order 001
  → PK = "ORDER#001", SK begins_with "ITEM#"
```

> **Why the interviewer asks this:** Redis and DynamoDB are ubiquitous in modern backends. Understanding data structures (not just "it's a cache") and access patterns shows production experience.

**Follow-up:** *What happens when Redis runs out of memory? What eviction policies are available?*

---

## 4.5 Column-Family Stores — Cassandra

### Question: Explain Cassandra's architecture and data model. When would you choose it?

**Answer:**

Apache Cassandra is a **distributed, wide-column store** designed for massive write throughput and high availability across multiple data centers.

#### Architecture — Ring Topology

```
         Node A
        /      \
   Node F      Node B      ← All nodes are equal (no master)
       |        |           ← Data is partitioned across nodes
   Node E      Node C      ← Each piece of data is replicated
        \      /               to N nodes (configurable)
         Node D

- Partition key is hashed → determines which node stores the data
- Replication factor (RF=3): data is copied to 3 nodes
- Consistency level per query: ONE, QUORUM, ALL
```

#### Data Model

```sql
-- Cassandra CQL (looks like SQL, but very different semantics)

CREATE KEYSPACE ecommerce
WITH replication = {
    'class': 'NetworkTopologyStrategy',
    'us-east': 3,     -- 3 replicas in US East
    'eu-west': 3      -- 3 replicas in EU West
};

CREATE TABLE orders (
    customer_id UUID,
    order_date  TIMESTAMP,
    order_id    UUID,
    total       DECIMAL,
    status      TEXT,
    PRIMARY KEY (customer_id, order_date, order_id)
);
-- Partition key: customer_id (determines which node)
-- Clustering columns: order_date, order_id (sort within partition)

-- ✅ Efficient queries (aligned with partition key):
SELECT * FROM orders WHERE customer_id = ? AND order_date > '2024-01-01';

-- ❌ Inefficient (full cluster scan):
SELECT * FROM orders WHERE total > 100;
-- Cassandra REQUIRES partition key in WHERE (unless ALLOW FILTERING)
```

**Key principle: Model your tables around your queries, not your entities.**

```
In SQL:  Design schema → Write queries
In Cassandra:  Define queries → Design schema to serve them

Example:
Query 1: "Get all orders for a customer" → Table: orders_by_customer
Query 2: "Get all orders by status" → Table: orders_by_status (separate table!)

-- Same data, different partition key — denormalized by design
CREATE TABLE orders_by_status (
    status      TEXT,
    order_date  TIMESTAMP,
    order_id    UUID,
    customer_id UUID,
    total       DECIMAL,
    PRIMARY KEY (status, order_date, order_id)
);
```

#### Consistency Levels

```
ONE:     Write/Read to 1 replica → lowest latency, risk of stale data
QUORUM:  Write/Read to majority (RF/2 + 1) → balanced consistency + availability
ALL:     Write/Read to ALL replicas → highest consistency, lowest availability

Write QUORUM + Read QUORUM = strong consistency
(Guaranteed to read your own writes)

Write ONE + Read ONE = eventual consistency
(Fastest, but might read stale data briefly)
```

**When to choose Cassandra:**

| Choose Cassandra | Don't Choose Cassandra |
|---|---|
| > 10TB data, growing fast | < 100GB of data |
| Write-heavy (100K+ writes/sec) | Complex queries, JOINs, aggregations |
| Multi-region deployment | Small team (operational complexity) |
| High availability (no downtime) | Frequent schema changes |
| Time-series / event data | Transactions across multiple partitions |
| Known, predictable access patterns | Ad-hoc analytics queries |

> **Why the interviewer asks this:** Cassandra interviews test whether you understand that NoSQL requires designing data models around access patterns, not entities. The consistency level question is always asked.

**Follow-up:** *What are tombstones in Cassandra and why can they cause performance problems?*

---

## 4.6 Graph Databases — Neo4j

### Question: When would you use a graph database and how does it differ from SQL for relationship queries?

**Answer:**

Graph databases excel when **relationships between entities are the primary concern** and queries involve traversing these relationships.

#### Neo4j Data Model

```
Cypher Query Language:

// Create nodes
CREATE (alice:Person {name: 'Alice', age: 30})
CREATE (bob:Person {name: 'Bob', age: 28})
CREATE (google:Company {name: 'Google'})

// Create relationships
CREATE (alice)-[:WORKS_AT {since: 2020}]->(google)
CREATE (bob)-[:WORKS_AT {since: 2022}]->(google)
CREATE (alice)-[:FRIENDS_WITH {since: 2019}]->(bob)
```

#### SQL vs Graph — Relationship Queries

```sql
-- SQL: "Find friends of friends of Alice" (6 degrees of separation style)
-- This requires self-joins that grow exponentially:

-- 1 degree:
SELECT DISTINCT f.name
FROM friendships fs
JOIN users f ON fs.friend_id = f.id
WHERE fs.user_id = (SELECT id FROM users WHERE name = 'Alice');

-- 2 degrees:
SELECT DISTINCT f2.name
FROM friendships fs1
JOIN friendships fs2 ON fs1.friend_id = fs2.user_id
JOIN users f2 ON fs2.friend_id = f2.id
WHERE fs1.user_id = (SELECT id FROM users WHERE name = 'Alice');

-- 3 degrees: even more JOINs... (becomes impractical at 6 degrees)

-- Neo4j Cypher: elegant and performant at ANY depth
MATCH (alice:Person {name: 'Alice'})-[:FRIENDS_WITH*1..6]-(friend)
RETURN DISTINCT friend.name;
-- *1..6 = traverse 1 to 6 hops
-- Performance: O(1) per hop (follows pointers, no JOINs)
```

**Performance comparison (social network with 1M users):**

```
Query: "Find mutual friends between Alice and Bob"

SQL (with indexes):
  - JOINs scale with table size: ~500ms for 1M users
  - Performance degrades as table grows

Neo4j:
  - Traverses only connected nodes: ~5ms regardless of total graph size
  - Performance depends on local connectivity, not total data size
```

#### Use Cases for Graph Databases

```
✅ Social networks (friends, followers, mutual connections)
✅ Recommendation engines ("users who bought X also bought Y")
✅ Fraud detection (circular money transfers, identity networks)
✅ Knowledge graphs (Wikipedia-style entity relationships)
✅ Network/IT infrastructure (dependencies, impact analysis)
✅ Route planning / logistics

❌ Simple CRUD (over-engineering)
❌ Aggregations / analytics (not optimized for this)
❌ High write throughput (not Cassandra-level)
❌ Tabular data with few relationships
```

> **Why the interviewer asks this:** Graph databases are niche but powerful. Knowing when to use them (relationship-heavy, traversal queries) vs when they're unnecessary shows architectural maturity.

**Follow-up:** *How would you model a recommendation engine using a graph database?*

---

## 4.7 Denormalization

### Question: What is denormalization and when is it appropriate?

**Answer:**

Denormalization is **intentionally adding redundancy** to a database schema to improve read performance, at the cost of write complexity and data consistency risk.

```sql
-- NORMALIZED (3NF) — no redundancy
-- orders table:
-- order_id | customer_id | product_id | quantity
--
-- To get order details with customer name and product name:
SELECT o.order_id, c.name, p.product_name, o.quantity
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON o.product_id = p.product_id;
-- Requires 2 JOINs every time

-- DENORMALIZED — store customer name and product name directly
-- orders table:
-- order_id | customer_id | customer_name | product_id | product_name | quantity
--
SELECT order_id, customer_name, product_name, quantity
FROM orders;
-- No JOINs needed! Much faster for read-heavy workloads
```

#### Denormalization Strategies

```sql
-- 1. PRE-COMPUTED COLUMNS
ALTER TABLE orders ADD COLUMN total_amount NUMERIC(12, 2);
-- Updated by trigger:
CREATE TRIGGER trg_update_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- 2. SUMMARY TABLES
CREATE TABLE daily_revenue AS
SELECT DATE(order_date) AS day, SUM(total) AS revenue, COUNT(*) AS orders
FROM orders
GROUP BY DATE(order_date);
-- Refreshed periodically (materialized view pattern)

-- 3. REDUNDANT COLUMNS (copy data to avoid JOINs)
-- Store customer_name in orders table
-- Must update when customer name changes (write overhead)

-- 4. PRE-JOINED TABLES (for reporting)
CREATE TABLE order_details_flat AS
SELECT
    o.order_id, o.order_date,
    c.name AS customer_name, c.city AS customer_city,
    p.product_name, p.category,
    oi.quantity, oi.unit_price,
    oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id;
```

**Trade-offs:**

| Aspect | Normalized | Denormalized |
|---|---|---|
| Read speed | Slower (JOINs) | Faster (pre-computed) |
| Write speed | Faster (single table) | Slower (update multiple copies) |
| Storage | Less | More (redundant data) |
| Data consistency | Guaranteed | Risk of inconsistency |
| Schema flexibility | Easy to evolve | Harder to change |
| Best for | OLTP (transactions) | OLAP (analytics), caching |

> **Why the interviewer asks this:** Denormalization shows you can make pragmatic trade-offs. The key is knowing it's a deliberate decision with managed costs, not accidental schema design.

**Follow-up:** *How do you keep denormalized data consistent? What patterns exist for this?*

---

## 4.8 CAP Theorem

### Question: Explain the CAP theorem. Is it really about choosing 2 of 3?

**Answer:**

The **CAP theorem** (Eric Brewer, 2000) states that a distributed system can provide at most **two of three guarantees simultaneously:**

```
         Consistency (C)
            /\
           /  \
          /    \
         /  CP  \
        /________\
       / \      / \
      / CA\    /AP \
     /     \  /     \
    /________\/______\
Availability(A)   Partition
                  Tolerance(P)
```

- **Consistency (C):** Every read returns the most recent write (all nodes see the same data at the same time)
- **Availability (A):** Every request receives a response (even if it's not the latest data)
- **Partition Tolerance (P):** System continues to operate despite network failures between nodes

**The reality:** In a distributed system, network partitions **will** happen. So you're really choosing between:

```
CP (Consistency + Partition Tolerance):
  During a partition → reject requests rather than serve stale data
  Examples: PostgreSQL (single primary), MongoDB (with majority writes), HBase, Zookeeper
  Use case: Banking, inventory (wrong data is worse than no data)

AP (Availability + Partition Tolerance):
  During a partition → serve requests with potentially stale data
  Examples: Cassandra, DynamoDB, CouchDB, DNS
  Use case: Social media feeds, product catalog (stale data is OK temporarily)

CA (Consistency + Availability):
  Only possible when there are NO partitions (single node)
  Not achievable in a distributed system
  Examples: Single-node PostgreSQL, single-node MySQL
```

#### Beyond CAP — PACELC

The PACELC theorem extends CAP:

```
If there's a Partition (P):
  Choose Availability (A) or Consistency (C)

Else (E) when system is running normally:
  Choose Latency (L) or Consistency (C)

Database        | P → A or C | E → L or C
────────────────┼────────────┼───────────
Cassandra       | PA         | EL (tunable)
DynamoDB        | PA         | EL
MongoDB         | PC         | EC
PostgreSQL      | PC         | EC
Citus           | PC         | EC
CockroachDB     | PC         | EC
```

**Common interview misunderstanding:**

```
❌ "MongoDB is CP, so it's always consistent"
   → MongoDB is CP only with majority write concern.
   With default write concern, a write can be acknowledged before replicated.

❌ "Cassandra is AP, so it's never consistent"
   → Cassandra with consistency level ALL is strongly consistent.
   It's tunable per query.

✅ Most databases let you TUNE the consistency-availability trade-off
   per operation, not just globally.
```

> **Why the interviewer asks this:** CAP is the foundation of distributed database design. Interviewers want to see you understand it's a spectrum, not a binary choice, and that you know how real databases handle it.

**Follow-up:** *What is eventual consistency? Give me a real-world example where it's acceptable.*

---

### Question: What is eventual consistency? Give a real-world example.

**Answer:**

Eventual consistency guarantees that **if no new writes occur, all replicas will eventually converge to the same value.** There's no guarantee on *when* — it could be milliseconds or seconds.

```
Write to Node A: user.name = "Alice Smith"
                    │
  ┌─────────────────┼─────────────────┐
  ▼                 ▼                 ▼
Node A             Node B            Node C
"Alice Smith"    "Alice Jones"     "Alice Jones"
(updated)        (stale — hasn't   (stale)
                  received update)

... time passes (usually milliseconds) ...

Node A             Node B            Node C
"Alice Smith"    "Alice Smith"     "Alice Smith"
(consistent)     (updated via      (updated via
                  replication)      replication)
```

**Real-world examples where eventual consistency is acceptable:**

| Scenario | Why It's OK |
|---|---|
| Social media like count | Showing 4,999 likes instead of 5,000 for 200ms is fine |
| Product catalog | Seeing a slightly stale price for a few seconds is OK |
| DNS propagation | TTL-based caching means DNS updates take hours — and it works |
| Shopping cart | Cart state can be eventually consistent across devices |
| User profile updates | Bio change doesn't need instant consistency |

**Where eventual consistency is NOT acceptable:**

| Scenario | Why Not |
|---|---|
| Bank balance | Can't show wrong balance (double-spend risk) |
| Inventory count | Overselling if stale count shows items in stock |
| Auction bidding | Must see latest bid to avoid conflicts |
| Medical records | Stale data could be life-threatening |

---

## 4.9 NewSQL & Modern Hybrid Databases

### Question: What are NewSQL databases and why do they exist?

**Answer:**

NewSQL databases aim to combine **SQL's ACID guarantees with NoSQL's horizontal scalability.**

```
                   ACID + SQL          Scale-out
Traditional SQL:     ✅                   ❌
NoSQL:               ❌ (usually)         ✅
NewSQL:              ✅                   ✅
```

| Database | Architecture | Key Feature |
|---|---|---|
| CockroachDB | Distributed PostgreSQL-compatible | Geo-partitioning, survives region failures |
| Google Spanner | Global distributed SQL | TrueTime (atomic clocks for consistency) |
| TiDB | MySQL-compatible, distributed | Transparent sharding |
| YugabyteDB | PostgreSQL-compatible | Multi-cloud, Raft consensus |
| Vitess | MySQL sharding middleware | Used by YouTube/Slack/Square |

```sql
-- CockroachDB example — looks like PostgreSQL, scales like NoSQL
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    total DECIMAL NOT NULL,
    region STRING NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Geo-partition by region (data stays close to users)
ALTER TABLE orders PARTITION BY LIST (region) (
    PARTITION us_east VALUES IN ('us-east'),
    PARTITION us_west VALUES IN ('us-west'),
    PARTITION eu VALUES IN ('eu-west')
);

-- Pin partitions to specific data centers
ALTER PARTITION us_east OF TABLE orders CONFIGURE ZONE USING
    constraints = '[+region=us-east]';
```

**When to consider NewSQL:**

```
✅ Need ACID transactions + horizontal scaling
✅ Global distribution with strong consistency
✅ Want PostgreSQL/MySQL compatibility (no query rewrite)
✅ Multi-region deployment with data locality requirements
```

> **Why the interviewer asks this:** NewSQL is the modern answer to "how do you scale SQL?" Knowing these options shows you're aware of the current landscape beyond the classic SQL vs NoSQL debate.

**Follow-up:** *How does Google Spanner achieve global consistency without sacrificing performance?*

---

## 4.10 NoSQL Interview Problems & Practice

### Problem 1: Design a Social Media Feed Schema

```javascript
// Question: Design the data model for a Twitter-like feed using MongoDB.

// Approach 1: Fan-out on write (push model)
// When a user posts, write to ALL followers' feeds

// posts collection
{
    "_id": ObjectId("..."),
    "author_id": "user_42",
    "content": "Hello world!",
    "created_at": ISODate("2024-01-15T10:00:00Z"),
    "likes_count": 0,
    "comments_count": 0
}

// feed collection (per-user feed, pre-computed)
{
    "_id": ObjectId("..."),
    "user_id": "user_10",  // the follower
    "post_id": ObjectId("..."),
    "author_id": "user_42",
    "created_at": ISODate("2024-01-15T10:00:00Z")
}
// Index: { user_id: 1, created_at: -1 }
// Query: db.feed.find({ user_id: "user_10" }).sort({ created_at: -1 }).limit(20)

// Approach 2: Fan-out on read (pull model)
// When reading feed, query all followed users' posts

// follows collection
{ "follower": "user_10", "following": "user_42" }

// Query: Find who user_10 follows, then get their recent posts
// Two queries, but no write amplification

// Hybrid approach (used by Twitter):
// Fan-out on write for users with < 10K followers
// Fan-out on read for celebrities (> 10K followers)
```

---

### Problem 2: Redis Rate Limiter

```
Question: Design a rate limiter that allows 100 requests per minute per user.
```

```python
# Sliding window rate limiter using Redis sorted set
import time
import redis

r = redis.Redis()

def is_rate_limited(user_id, limit=100, window=60):
    key = f"rate:{user_id}"
    now = time.time()
    window_start = now - window

    pipe = r.pipeline()
    # Remove old entries outside the window
    pipe.zremrangebyscore(key, 0, window_start)
    # Count requests in current window
    pipe.zcard(key)
    # Add current request
    pipe.zadd(key, {str(now): now})
    # Set expiry on the key
    pipe.expire(key, window)
    results = pipe.execute()

    request_count = results[1]
    return request_count >= limit  # True = rate limited
```

---

### Problem 3: DynamoDB Access Pattern Design

```
Question: Design a DynamoDB table for an e-commerce platform that needs:
1. Get customer profile by customer_id
2. Get all orders for a customer (sorted by date)
3. Get order details by order_id
4. Get all orders by status (e.g., "pending")

Solution — Single-table design:

PK                | SK              | GSI1-PK    | GSI1-SK         | Attributes
──────────────────┼─────────────────┼────────────┼─────────────────┼──────────
CUSTOMER#c1       | PROFILE         |            |                 | name, email
CUSTOMER#c1       | ORDER#2024-01-15#o1 | ORDER#o1 | STATUS#pending | total=99
CUSTOMER#c1       | ORDER#2024-02-20#o2 | ORDER#o2 | STATUS#shipped | total=149
CUSTOMER#c2       | PROFILE         |            |                 | name, email
CUSTOMER#c2       | ORDER#2024-03-01#o3 | ORDER#o3 | STATUS#pending | total=75

Access patterns:
1. Customer profile: PK = "CUSTOMER#c1", SK = "PROFILE"
2. Customer orders:  PK = "CUSTOMER#c1", SK begins_with "ORDER#"
3. Order by ID:      GSI1-PK = "ORDER#o1"
4. Orders by status: GSI1-SK begins_with "STATUS#pending"
   (requires a GSI with status as partition key — or scan + filter)
```

---

### Problem 4: Conceptual — CAP Theorem Application

```
Question: You're building a global e-commerce platform. Different components
have different consistency requirements. How would you apply CAP?

Answer:

Component          | Consistency Needed | Database Choice    | Why
───────────────────┼────────────────────┼────────────────────┼──────────
User accounts      | Strong             | PostgreSQL/Spanner | Auth must be consistent
Product catalog    | Eventual (OK)      | MongoDB/DynamoDB   | Stale price for 2s is fine
Shopping cart      | Eventual (OK)      | Redis/DynamoDB     | Cart syncs eventually
Inventory          | Strong             | PostgreSQL + cache | Overselling is costly
Order processing   | Strong             | PostgreSQL         | ACID for payment flow
Product reviews    | Eventual (OK)      | MongoDB            | Delay is acceptable
Search             | Eventual (OK)      | Elasticsearch      | Index lag is fine
Recommendations    | Eventual (OK)      | Redis/Neo4j        | Slightly stale recs OK
Session management | Eventual (OK)      | Redis              | Worst case: re-login
```

---

### Problem 5: Output-Based — Redis Sorted Set

```
Question: What does this Redis sequence produce?

ZADD scores 100 "alice"
ZADD scores 200 "bob"
ZADD scores 150 "carol"
ZADD scores 200 "dave"      -- same score as bob
ZINCRBY scores 75 "alice"   -- alice: 100 + 75 = 175
ZREVRANGE scores 0 -1 WITHSCORES
```

**Answer:**

```
1) "bob"    - 200
2) "dave"   - 200
3) "alice"  - 175
4) "carol"  - 150
```

Note: bob and dave both have score 200. With equal scores, Redis sorts **lexicographically** — "bob" < "dave", so in ZREVRANGE (high to low), we reverse to get bob before dave... actually with ZREVRANGE, for equal scores the lexicographic order is also reversed, so "dave" would come first. Let me correct:

```
1) "dave"   - 200    (same score as bob, "d" > "b" lexicographically → first in reverse)
2) "bob"    - 200
3) "alice"  - 175
4) "carol"  - 150
```

---

## Key Takeaways

| Topic | What to Remember |
|---|---|
| NoSQL types | Key-Value, Document, Column-Family, Graph — each optimizes for different access patterns |
| SQL vs NoSQL | Not "which is better" but "which fits these specific requirements" |
| MongoDB | Embed for 1:few; reference for 1:many; aggregation pipeline for complex queries |
| Redis | Not just a cache — sorted sets, streams, pub/sub; choose eviction policy carefully |
| Cassandra | Model tables around queries, not entities; tunable consistency |
| CAP theorem | Really CP vs AP (partitions are inevitable); most databases are tunable |
| Denormalization | Intentional redundancy for read performance; must manage consistency |
| NewSQL | CockroachDB, Spanner, TiDB — ACID + scale; the modern compromise |

---

**Previous:** [← Part 3 — Advanced SQL & Database Internals](./03-advanced-sql.md)
**Next:** [Part 5 — System Design & Real-world Database Scenarios →](./05-system-design.md)
