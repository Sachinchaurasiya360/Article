# Part 5: System Design & Real-world Database Scenarios

> Apply everything you've learned to production systems. Design scalable databases, optimize reads and writes, implement replication, caching, and handle the real-world problems interviewers love to ask about.

---

## Table of Contents

- [5.1 Designing Scalable Database Systems](#51-designing-scalable-database-systems)
- [5.2 Read vs Write Optimization](#52-read-vs-write-optimization)
- [5.3 Database Replication](#53-database-replication)
- [5.4 Caching Strategies](#54-caching-strategies)
- [5.5 Data Consistency Trade-offs](#55-data-consistency-trade-offs)
- [5.6 Handling Large Datasets](#56-handling-large-datasets)
- [5.7 Real-world Scenario: E-commerce Platform](#57-real-world-scenario-e-commerce-platform)
- [5.8 Real-world Scenario: Analytics Pipeline](#58-real-world-scenario-analytics-pipeline)
- [5.9 Real-world Scenario: Chat Application](#59-real-world-scenario-chat-application)
- [5.10 System Design Interview Problems](#510-system-design-interview-problems)

---

## 5.1 Designing Scalable Database Systems

### Question: How do you design a database system that scales from 1,000 to 100,000,000 users?

**Answer:**

Database scaling is not a one-time decision - it's a progression. Here's the roadmap:

#### Stage 1: Single Server (0 – 10K users)

```
┌─────────────────────────┐
│   Application Server    │
│          │              │
│    ┌─────▼──────┐       │
│    │ PostgreSQL │       │
│    │ (single)   │       │
│    └────────────┘       │
└─────────────────────────┘

Actions:
✅ Proper indexing
✅ Query optimization
✅ Connection pooling (PgBouncer)
✅ Appropriate schema design (3NF)
✅ Monitoring (pg_stat_statements)
```

#### Stage 2: Vertical Scaling + Read Replicas (10K – 500K users)

```
                 ┌──────────────┐
                 │   App Server │
                 └──────┬───────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
        ┌──────────┐ ┌──────┐ ┌──────┐
        │ Primary  │ │Read  │ │Read  │
        │ (writes) │ │Rep 1 │ │Rep 2 │
        └──────────┘ └──────┘ └──────┘
              │           ▲         ▲
              └───────────┴─────────┘
                 Streaming Replication

Actions:
✅ Read replicas for read-heavy workloads
✅ Bigger server (more CPU, RAM, SSD)
✅ Redis cache for hot data
✅ CDN for static assets
✅ Table partitioning for large tables
```

#### Stage 3: Caching + Specialized Stores (500K – 5M users)

```
        ┌──────────────┐
        │  App Servers  │ (multiple, load-balanced)
        └───────┬───────┘
                │
    ┌───────────┼────────────┬─────────────┐
    ▼           ▼            ▼             ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐
│ Redis  │ │PostgreSQL│ │Elastic-  │ │  S3 +      │
│ Cache  │ │ Primary  │ │search    │ │  CDN       │
│        │ │+ Replicas│ │(search)  │ │ (files)    │
└────────┘ └────────┘ └──────────┘ └────────────┘

Actions:
✅ Application-level caching (Redis)
✅ Elasticsearch for full-text search
✅ Object storage for files/images
✅ Message queue (Kafka/RabbitMQ) for async processing
✅ Materialized views for dashboards
```

#### Stage 4: Sharding + Microservices (5M – 100M users)

```
               Load Balancer
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  User    │  │  Order   │  │ Product  │
│ Service  │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
│ User DB  │  │Order DB  │  │Product DB│
│(sharded) │  │(sharded) │  │(replicas)│
│  by ID   │  │ by user  │  │          │
└──────────┘  └──────────┘  └──────────┘

Actions:
✅ Database per service (microservice architecture)
✅ Horizontal sharding for large tables
✅ CQRS pattern (separate read/write models)
✅ Event sourcing for audit trails
✅ Multi-region replication
```

**Scaling checklist (in order of effort/impact):**

```
1. ✅ Indexing & query optimization (10× improvement, low effort)
2. ✅ Connection pooling (5× connection efficiency)
3. ✅ Redis caching (100× for cached reads)
4. ✅ Read replicas (2-5× read capacity)
5. ✅ Vertical scaling (2-4× raw power)
6. ✅ Table partitioning (10× for time-range queries)
7. ✅ Materialized views (50× for complex aggregations)
8. ✅ Database per service (isolates failure domains)
9. ✅ Horizontal sharding (near-linear scaling, high complexity)
10. ✅ Multi-region (global low latency, highest complexity)
```

> **Why the interviewer asks this:** This is the most common database system design question. They want to see progressive thinking - not jumping straight to sharding for a small application.

**Follow-up:** *At what point would you introduce sharding, and what would be your shard key?*

---

## 5.2 Read vs Write Optimization

### Question: How do you optimize a system for reads vs writes? What patterns exist?

**Answer:**

Most systems are either **read-heavy** or **write-heavy**. The optimization strategies are fundamentally different.

#### Read-Heavy Systems (100:1 read-to-write ratio)

```
Examples: Product catalog, news website, Wikipedia

Optimization strategies:
┌────────────────────────────────────────────────┐
│ 1. Read Replicas                               │
│    Primary (writes) → Replica 1, 2, 3 (reads)  │
│    Load balance reads across replicas           │
│                                                 │
│ 2. Caching layers                              │
│    L1: Application cache (in-memory)            │
│    L2: Redis/Memcached (distributed cache)      │
│    L3: CDN (edge caching for static content)    │
│                                                 │
│ 3. Materialized views                          │
│    Pre-compute expensive aggregations           │
│    Refresh periodically or on-demand            │
│                                                 │
│ 4. Denormalization                             │
│    Store pre-joined data to avoid JOINs         │
│    Duplicate data for different access patterns │
│                                                 │
│ 5. Covering indexes                            │
│    Index includes all columns needed by query   │
│    Eliminates table heap access entirely        │
└────────────────────────────────────────────────┘
```

```sql
-- Example: Read-optimized product catalog

-- Covering index for the most common query
CREATE INDEX idx_products_category_covering
ON products (category, price)
INCLUDE (product_name, image_url, rating);

-- Materialized view for category page aggregations
CREATE MATERIALIZED VIEW mv_category_stats AS
SELECT
    category,
    COUNT(*) AS product_count,
    AVG(price) AS avg_price,
    MIN(price) AS min_price,
    MAX(price) AS max_price,
    AVG(rating) AS avg_rating
FROM products
WHERE active = true
GROUP BY category;

CREATE UNIQUE INDEX ON mv_category_stats (category);
-- Refresh every 5 minutes via cron / pg_cron
```

#### Write-Heavy Systems (1:100 write-to-read ratio)

```
Examples: IoT sensors, logging, event tracking, analytics ingestion

Optimization strategies:
┌────────────────────────────────────────────────────┐
│ 1. Write-Ahead Log (WAL) optimization             │
│    Batch commits, async replication                 │
│                                                     │
│ 2. Append-only tables                              │
│    Never UPDATE, only INSERT (time-series pattern)  │
│    BRIN indexes for time-ordered data               │
│                                                     │
│ 3. Minimal indexes                                 │
│    Each index slows down writes                     │
│    Only index what you query                        │
│                                                     │
│ 4. Batch inserts                                   │
│    COPY command (10-100× faster than INSERT)        │
│    Bulk INSERT with multi-row VALUES                │
│                                                     │
│ 5. Partitioning                                    │
│    Smaller indexes per partition                    │
│    Fast data lifecycle (drop old partitions)        │
│                                                     │
│ 6. Unlogged tables (for staging/temp data)         │
│    No WAL = much faster writes                      │
│    Data lost on crash (acceptable for staging)      │
└────────────────────────────────────────────────────┘
```

```sql
-- Example: Write-optimized event logging

-- Partitioned by month (append-only)
CREATE TABLE events (
    event_id   BIGSERIAL,
    user_id    INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Minimal indexes (only what's needed for reads)
CREATE INDEX idx_events_user ON events (user_id, created_at DESC);
-- BRIN index for time-range queries (tiny, doesn't slow writes much)
CREATE INDEX idx_events_time_brin ON events USING brin (created_at);

-- Batch inserts using COPY (fastest way to load data in PostgreSQL)
COPY events (user_id, event_type, payload, created_at)
FROM '/tmp/events_batch.csv'
WITH (FORMAT csv, HEADER true);

-- Or multi-row INSERT (10× faster than individual inserts)
INSERT INTO events (user_id, event_type, payload) VALUES
    (1, 'click', '{"page": "/home"}'),
    (2, 'click', '{"page": "/product"}'),
    (3, 'purchase', '{"amount": 99.99}');
-- ... up to 1000 rows per INSERT
```

#### CQRS Pattern (Command Query Responsibility Segregation)

```
For systems that need BOTH fast reads AND fast writes:

Writes (Commands)                    Reads (Queries)
      │                                    │
      ▼                                    ▼
┌──────────────┐    Event Bus      ┌──────────────┐
│ Write Model  │ ──────────────>   │  Read Model  │
│ (Normalized) │   (Kafka/SQS)    │(Denormalized)│
│ PostgreSQL   │                   │ Elasticsearch│
│              │                   │ Redis        │
│ Optimized    │                   │ Optimized    │
│ for writes   │                   │ for reads    │
└──────────────┘                   └──────────────┘

Write side: Normalized, minimal indexes, ACID
Read side: Denormalized, heavily indexed, eventually consistent
Event bus: Propagates changes from write to read model
```

> **Why the interviewer asks this:** This question tests whether you can make targeted optimizations based on workload characteristics, rather than applying generic "best practices."

**Follow-up:** *How would you implement CQRS with event sourcing for an e-commerce order system?*

---

## 5.3 Database Replication

### Question: Explain database replication strategies and their trade-offs.

**Answer:**

Replication copies data from one database server (primary) to one or more replicas to improve **availability, read scalability, and disaster recovery.**

#### Synchronous Replication

```
Client writes → Primary
                  │
                  ├──► Replica 1 (ACK) ──┐
                  ├──► Replica 2 (ACK) ──┤
                  │                      │
                  ◄──────────────────────┘
                  │
              COMMIT confirmed to client

Timeline:
Client ──write──► Primary ──replicate──► Replicas ──ACK──► Primary ──confirm──► Client
                                    ▲
                             Waits for ALL replicas
```

```sql
-- PostgreSQL synchronous replication configuration
-- postgresql.conf on primary:
-- synchronous_standby_names = 'FIRST 1 (replica1, replica2)'
-- This means: wait for at least 1 replica to confirm before committing

-- Trade-offs:
-- ✅ Zero data loss (RPO = 0)
-- ✅ Replicas always have latest data
-- ❌ Higher write latency (must wait for replica ACK)
-- ❌ Primary blocks if replica is down (unless FIRST N configuration)
```

#### Asynchronous Replication

```
Client writes → Primary → COMMIT confirmed to client
                  │
                  └──► Replica 1 (eventually)
                  └──► Replica 2 (eventually)

Timeline:
Client ──write──► Primary ──confirm──► Client
                     │
                     └──replicate──► Replicas (later, no waiting)
```

```sql
-- PostgreSQL async replication (default):
-- Streaming replication sends WAL records continuously
-- Replica lag: typically < 1 second, but can grow under load

-- Check replication lag:
SELECT
    client_addr,
    sent_lsn,
    replay_lsn,
    sent_lsn - replay_lsn AS replication_lag_bytes,
    replay_lag
FROM pg_stat_replication;

-- Trade-offs:
-- ✅ Lower write latency (don't wait for replicas)
-- ✅ Primary unaffected by slow replicas
-- ❌ Potential data loss if primary crashes before replication
-- ❌ Replicas may serve stale data (replication lag)
```

#### Semi-Synchronous Replication

```
Wait for at least 1 replica (out of N) to acknowledge:

Client writes → Primary
                  │
                  ├──► Replica 1 (ACK) ──► Primary confirms to client
                  ├──► Replica 2 (still replicating...)
                  └──► Replica 3 (still replicating...)

-- Best of both worlds:
-- ✅ At least 1 copy confirmed (fault tolerance)
-- ✅ Don't wait for ALL replicas (better latency than full sync)
-- ❌ 2nd+ replicas may lag
```

#### Multi-Primary (Multi-Master) Replication

```
┌──────────┐    ◄──────────►    ┌──────────┐
│ Primary A│    bidirectional    │ Primary B│
│ (US-East)│    replication      │ (EU-West)│
└──────────┘                    └──────────┘

Both accept writes → CONFLICT RESOLUTION needed!

Conflict resolution strategies:
1. Last-write-wins (LWW): timestamp decides → may lose data
2. Application-level: custom merge logic
3. CRDT: Conflict-free Replicated Data Types → auto-merge
```

**Replication topology comparison:**

| Strategy | Data Loss Risk | Write Latency | Read Scalability | Complexity |
|---|---|---|---|---|
| Sync (all replicas) | None | High | High | Medium |
| Semi-sync (1 replica) | Very low | Medium | High | Medium |
| Async | Possible | Low | High | Low |
| Multi-primary | Conflict risk | Low | Very high | Very high |

#### Failover

```
Primary failure scenario:

Automatic failover (e.g., Patroni for PostgreSQL):
1. Health check detects primary is down
2. Elect the most up-to-date replica as new primary
3. Reconfigure other replicas to follow new primary
4. Update connection routing (VIP, DNS, proxy)
5. Application reconnects to new primary

                Before:                          After:
    ┌─────────┐                        ┌─────────┐
    │ Primary │  ← DEAD                │Replica 1│ ← NEW PRIMARY
    └─────────┘                        └─────────┘
    ┌─────────┐  ┌─────────┐          ┌─────────┐
    │Replica 1│  │Replica 2│          │Replica 2│ ← follows new primary
    └─────────┘  └─────────┘          └─────────┘

Key metrics:
- RTO (Recovery Time Objective): How long until service is restored
  → Patroni: ~10-30 seconds
- RPO (Recovery Point Objective): How much data can you afford to lose
  → Sync replication: 0 data loss
  → Async replication: potentially seconds of writes
```

> **Why the interviewer asks this:** Replication is fundamental to any production database setup. Understanding sync vs async trade-offs and failover mechanics is expected for senior roles.

**Follow-up:** *How does Patroni handle split-brain scenarios?*

---

## 5.4 Caching Strategies

### Question: Design a caching strategy for a high-traffic application.

**Answer:**

Caching is the single most effective way to reduce database load. Here's a comprehensive strategy:

#### Cache Hierarchy

```
Request
   │
   ▼
┌──────────────────┐
│ Browser Cache    │ TTL: seconds-hours (Cache-Control headers)
│ (per user)       │ Hit ratio: ~30-50%
└────────┬─────────┘
         ▼
┌──────────────────┐
│ CDN Cache        │ TTL: minutes-hours (Cloudflare, CloudFront)
│ (edge locations) │ Hit ratio: ~60-80% for static content
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Application Cache│ TTL: seconds-minutes (in-memory, per server)
│ (local memory)   │ Hit ratio: ~50-70%
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Distributed Cache│ TTL: minutes-hours (Redis/Memcached cluster)
│ (shared)         │ Hit ratio: ~80-95%
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Database         │ The source of truth
│ (PostgreSQL)     │
└──────────────────┘
```

#### Cache Invalidation Strategies

```
The two hardest problems in computer science:
1. Cache invalidation
2. Naming things
3. Off-by-one errors

Strategy 1: TTL-Based Expiration
─────────────────────────────────
SET user:42 "{...}" EX 300    # expires in 5 minutes
- Simple, predictable
- Data can be stale up to TTL duration
- Best for: data that changes infrequently

Strategy 2: Write-Through (Invalidate on Write)
─────────────────────────────────────────────────
On UPDATE → DELETE cache key → next read will re-cache
- Always consistent (eventually)
- Extra write operation
- Best for: data that changes moderately

Strategy 3: Write-Behind (Async Invalidation)
─────────────────────────────────────────────
On UPDATE → publish event → worker invalidates cache
- Decoupled from write path
- Small window of inconsistency
- Best for: high-write systems where cache staleness is OK

Strategy 4: Cache-Aside with Versioning
────────────────────────────────────────
Cache key includes version: "user:42:v3"
On UPDATE → increment version → old cache naturally expires
- No explicit invalidation needed
- Old versions auto-expire via TTL
- Best for: systems where exact invalidation is hard
```

#### Common Caching Problems

**1. Cache Stampede (Thundering Herd)**

```
Problem: Popular cache key expires → 1000 requests hit database simultaneously

          TTL expires
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Request 1  Request 2  Request 3  ... Request 1000
    │          │          │              │
    └──────────┴──────────┴──────────────┘
                    │
              Database ← OVERLOADED!

Solutions:

1. Lock-based: Only one request fetches from DB; others wait
```

```python
def get_with_lock(key):
    value = redis.get(key)
    if value:
        return value

    # Try to acquire lock
    lock_acquired = redis.set(f"lock:{key}", "1", nx=True, ex=10)
    if lock_acquired:
        # I won the lock - fetch from DB
        value = db.query(...)
        redis.setex(key, 300, value)
        redis.delete(f"lock:{key}")
        return value
    else:
        # Someone else is fetching - wait and retry
        time.sleep(0.1)
        return get_with_lock(key)
```

```
2. Probabilistic early refresh: Refresh before TTL expires (jitter)
3. Stale-while-revalidate: Serve stale data while refreshing in background
```

**2. Cache Penetration**

```
Problem: Querying for data that doesn't exist → always misses cache → always hits DB

Request for user_id = 99999999 (doesn't exist)
→ Cache miss → DB query → No result → Nothing cached → Repeat forever

Solutions:
1. Cache negative results: SET user:99999999 "NOT_FOUND" EX 60
2. Bloom filter: Check if key possibly exists before hitting DB
3. Input validation: Reject obviously invalid IDs before cache lookup
```

**3. Hot Key Problem**

```
Problem: One cache key receives disproportionate traffic (celebrity post, flash sale)

Solution:
1. Local cache (in-memory on each app server) with short TTL
2. Key replication: Store copies as "key:1", "key:2", "key:3"
   → Randomly pick one → distributes load across Redis nodes
3. Rate limiting on the specific key
```

> **Why the interviewer asks this:** Caching is involved in virtually every system design question. The cache stampede problem specifically is a favorite interview topic.

**Follow-up:** *How would you handle cache warming for a new deployment?*

---

## 5.5 Data Consistency Trade-offs

### Question: How do you maintain data consistency in a distributed system?

**Answer:**

In a distributed system, you can't have perfect consistency and availability simultaneously (CAP theorem). Here are the practical patterns:

#### Strong Consistency Patterns

**1. Two-Phase Commit (2PC)**

```
Coordinator asks: "Can you commit?"

Phase 1 (Prepare):
  Coordinator ──PREPARE──► Participant A ──VOTE YES──► Coordinator
  Coordinator ──PREPARE──► Participant B ──VOTE YES──► Coordinator

Phase 2 (Commit):
  Coordinator ──COMMIT──► Participant A ──ACK──► Coordinator
  Coordinator ──COMMIT──► Participant B ──ACK──► Coordinator

If ANY participant votes NO → ROLLBACK all

Problems:
- Blocking: If coordinator crashes during Phase 2, participants are stuck
- Performance: High latency (multiple network round trips)
- Not partition-tolerant
```

**2. Saga Pattern (for microservices)**

```
Distributed transaction across services WITHOUT 2PC:

Order Service → Payment Service → Inventory Service → Shipping Service
     │                │                  │                  │
  Create Order    Charge Card       Reserve Stock      Create Shipment

If Inventory fails:
  ← Compensating transactions (rollback)
  Refund Card ← Uncharge        Cancel Order ← Mark cancelled

Two types of Sagas:
1. Choreography: Each service publishes events, next service reacts
2. Orchestration: Central orchestrator tells each service what to do
```

```
Choreography:
  Order Created ─event─► Payment Charged ─event─► Stock Reserved ─event─► Shipped

Orchestration:
  ┌──────────────┐
  │ Saga         │──1. Create Order──►  Order Service
  │ Orchestrator │──2. Charge Card──►   Payment Service
  │              │──3. Reserve Stock──► Inventory Service
  │              │──4. Ship──►          Shipping Service
  └──────────────┘
```

#### Eventual Consistency Patterns

**1. Change Data Capture (CDC)**

```
┌──────────────┐                    ┌──────────────┐
│  PostgreSQL  │ ──WAL stream──►    │   Debezium   │ ──events──►  Kafka
│  (source)    │                    │   (CDC tool)  │
└──────────────┘                    └──────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     ▼                    ▼                    ▼
              ┌────────────┐      ┌────────────┐      ┌────────────┐
              │ Elasticsearch│     │   Redis    │      │  Data Lake │
              │  (search)    │     │  (cache)   │      │ (analytics)│
              └────────────┘      └────────────┘      └────────────┘

CDC captures every change in the source database and streams it
to downstream consumers. This ensures all systems eventually converge.
```

**2. Outbox Pattern**

```sql
-- Problem: How to reliably publish events when updating the database?
-- Risk: DB update succeeds but event publish fails → inconsistency

-- Solution: Write event to an "outbox" table in the SAME transaction

BEGIN;
    -- Business update
    UPDATE orders SET status = 'confirmed' WHERE order_id = 42;

    -- Event in same transaction (atomic)
    INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
    VALUES ('Order', 42, 'OrderConfirmed', '{"order_id": 42, "status": "confirmed"}');
COMMIT;

-- Separate process reads outbox and publishes to Kafka:
-- 1. SELECT * FROM outbox WHERE published = false ORDER BY id LIMIT 100;
-- 2. Publish to Kafka
-- 3. UPDATE outbox SET published = true WHERE id IN (...)
-- 4. Periodically clean up old published events
```

**3. Idempotency for At-Least-Once Delivery**

```sql
-- Problem: Message queues may deliver the same event multiple times
-- Solution: Make handlers idempotent

-- Track processed events
CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Before processing:
INSERT INTO processed_events (event_id)
VALUES ('evt-123-456')
ON CONFLICT (event_id) DO NOTHING;

-- If INSERT affected 0 rows → already processed, skip
-- If INSERT affected 1 row → first time, process it
```

**Consistency strategy decision matrix:**

| Pattern | Consistency | Latency | Complexity | Use Case |
|---|---|---|---|---|
| 2PC | Strong | High | Medium | Cross-database transactions |
| Saga | Eventual | Medium | High | Microservice transactions |
| CDC | Eventual | Low-Medium | Medium | Keeping derived stores in sync |
| Outbox | Eventual | Low | Low | Reliable event publishing |
| Dual Writes | NONE (broken!) | Low | Low | NEVER USE - race conditions |

> **Why the interviewer asks this:** Distributed consistency is the hardest problem in distributed systems. The Saga and Outbox patterns are expected knowledge for senior backend roles.

**Follow-up:** *Why are dual writes (writing to DB and cache/queue in sequence) dangerous?*

---

## 5.6 Handling Large Datasets

### Question: How do you handle a 10TB+ database that's growing 100GB per day?

**Answer:**

#### Data Lifecycle Management

```sql
-- 1. PARTITIONING: Organize data by time for easy lifecycle management

CREATE TABLE events (
    event_id    BIGSERIAL,
    event_type  VARCHAR(50),
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Automatic partition creation (pg_partman extension)
SELECT partman.create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_type := 'range',
    p_interval := 'monthly',
    p_premake := 3  -- create 3 months ahead
);

-- 2. DATA ARCHIVAL: Move old data to cheaper storage

-- Archive to separate tablespace on cheaper storage
CREATE TABLESPACE archive_storage LOCATION '/mnt/hdd/archive';

ALTER TABLE events_2022_01 SET TABLESPACE archive_storage;

-- Or archive to object storage (S3, GCS) using foreign data wrapper
CREATE EXTENSION IF NOT EXISTS parquet_s3_fdw;

CREATE FOREIGN TABLE events_archive_2022 (
    event_id BIGINT,
    event_type VARCHAR(50),
    payload JSONB,
    created_at TIMESTAMPTZ
)
SERVER s3_server
OPTIONS (filename 's3://data-archive/events/2022/');

-- 3. DATA RETENTION: Automatically drop old partitions

-- Drop partitions older than 2 years (instant operation)
DROP TABLE IF EXISTS events_2022_01;
DROP TABLE IF EXISTS events_2022_02;
-- ... vs DELETE which would take hours and generate massive WAL
```

#### Compression

```sql
-- PostgreSQL TOAST: automatic compression for large values (JSONB, TEXT)
-- Columns > 2KB are automatically compressed and stored out-of-line

-- For TimescaleDB (PostgreSQL extension for time-series):
ALTER TABLE events SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'event_type',
    timescaledb.compress_orderby = 'created_at DESC'
);

-- Compress chunks older than 7 days
SELECT compress_chunk(i) FROM show_chunks('events', older_than => INTERVAL '7 days') i;
-- Typical compression ratio: 10-20× for time-series data
```

#### Aggregation Pipeline for Analytics

```sql
-- Raw events: 100GB/day, kept for 30 days (3TB)
-- Minute aggregates: kept for 1 year
-- Hourly aggregates: kept for 5 years
-- Daily aggregates: kept forever

-- Continuous aggregation (TimescaleDB or custom)
CREATE MATERIALIZED VIEW hourly_metrics AS
SELECT
    time_bucket('1 hour', created_at) AS hour,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT (payload->>'user_id')) AS unique_users
FROM events
GROUP BY hour, event_type;

-- Refresh policy
SELECT add_continuous_aggregate_policy('hourly_metrics',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

#### Scaling Reads on Large Datasets

```
Strategy: Tiered data architecture

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Hot Data   │     │  Warm Data   │     │  Cold Data   │
│  (< 7 days)  │     │ (7d - 1 yr)  │     │  (> 1 year)  │
│              │     │              │     │              │
│  PostgreSQL  │     │ Aggregated   │     │  S3/Parquet  │
│  + Redis     │     │ PostgreSQL   │     │  + Athena    │
│  SSD storage │     │ HDD storage  │     │  Object store│
│              │     │              │     │              │
│  Fast reads  │     │ Moderate     │     │  Slow but    │
│  Full detail │     │ Aggregated   │     │  cheap       │
└──────────────┘     └──────────────┘     └──────────────┘
```

> **Why the interviewer asks this:** Handling large datasets is a daily reality for senior engineers. The interviewer wants to see you know about partitioning, archival, compression, and tiered storage - not just "add more servers."

**Follow-up:** *How would you migrate a 10TB table to a partitioned schema with zero downtime?*

---

## 5.7 Real-world Scenario: E-commerce Platform

### Question: Design the database architecture for a large-scale e-commerce platform.

**Answer:**

#### Requirements

```
- 10M registered users
- 500K products
- 50K orders per day, growing 20% annually
- Peak: Black Friday (10× normal traffic)
- Global users (US, EU, Asia)
- Features: search, cart, checkout, order tracking, reviews, recommendations
```

#### Database Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Application Layer                           │
└───────────┬──────────┬──────────┬──────────┬──────────┬───────────┘
            │          │          │          │          │
     ┌──────▼───┐ ┌────▼────┐ ┌──▼───┐ ┌───▼────┐ ┌───▼─────┐
     │PostgreSQL│ │ MongoDB │ │Redis │ │Elastic-│ │ClickHse│
     │          │ │         │ │      │ │search  │ │         │
     │• Users   │ │• Product│ │• Cart│ │• Search│ │• Analyti│
     │• Orders  │ │  Catalog│ │• Sess│ │  Index │ │  cs     │
     │• Payments│ │• Reviews│ │• Rate│ │        │ │• Reports│
     │• Invntry │ │         │ │  Lmt │ │        │ │         │
     └──────────┘ └─────────┘ └──────┘ └────────┘ └─────────┘
```

#### Schema Design

```sql
-- PostgreSQL: Transactional data (ACID required)

-- Users (strong consistency, auth)
CREATE TABLE users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name        VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (partitioned by month, critical ACID)
CREATE TABLE orders (
    order_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
    subtotal    NUMERIC(12,2) NOT NULL,
    tax         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total       NUMERIC(12,2) NOT NULL,
    shipping_address JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Inventory (requires pessimistic locking for stock)
CREATE TABLE inventory (
    product_id  UUID PRIMARY KEY,
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    reserved    INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    version     INT NOT NULL DEFAULT 1,
    CHECK (reserved <= stock)
);

-- Checkout flow: Atomic inventory reservation
BEGIN ISOLATION LEVEL SERIALIZABLE;
    -- Reserve stock
    UPDATE inventory
    SET reserved = reserved + 1, version = version + 1
    WHERE product_id = $1 AND stock - reserved >= 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Out of stock';
    END IF;

    -- Create order
    INSERT INTO orders (...) VALUES (...);
    INSERT INTO order_items (...) VALUES (...);
COMMIT;
```

```javascript
// MongoDB: Product catalog (flexible schema, read-heavy)
{
    "_id": ObjectId("..."),
    "name": "MacBook Pro 16\"",
    "slug": "macbook-pro-16",
    "category": ["Electronics", "Laptops", "Apple"],
    "brand": "Apple",
    "price": {
        "amount": 2499.00,
        "currency": "USD",
        "discount": { "percent": 10, "valid_until": ISODate("2024-12-31") }
    },
    "attributes": {
        "processor": "M3 Pro",
        "ram": "18GB",
        "storage": "512GB SSD",
        "screen_size": "16.2 inches"
    },
    "images": ["url1.jpg", "url2.jpg"],
    "rating": { "average": 4.7, "count": 2341 },
    "in_stock": true,
    "variants": [
        { "sku": "MBP16-M3P-18-512", "color": "Space Black", "price": 2499 },
        { "sku": "MBP16-M3M-36-1TB", "color": "Silver", "price": 3499 }
    ]
}

// Why MongoDB for catalog:
// - Each product category has different attributes
// - Nested data (variants, images) is natural
// - Read-heavy (10000× more reads than writes)
// - Flexible schema for new product types
```

```python
# Redis: Shopping cart + session + rate limiting

# Shopping cart (hash per user, 7-day TTL)
# HSET cart:{user_id} {product_id} {quantity}
redis.hset("cart:user_42", "prod_abc", 2)
redis.hset("cart:user_42", "prod_xyz", 1)
redis.expire("cart:user_42", 604800)  # 7 days

# Rate limiting (sliding window, 100 requests/minute)
# Implemented with sorted sets (see Part 4)

# Session storage (with 30-minute sliding expiry)
redis.setex("session:abc123", 1800, json.dumps({"user_id": 42, "role": "customer"}))
```

#### Handling Black Friday (10× traffic)

```
Pre-Black-Friday preparation:
1. ✅ Pre-warm Redis cache with popular products
2. ✅ Scale read replicas: 2 → 8
3. ✅ Enable connection pooling (PgBouncer max_connections: 200 → 1000)
4. ✅ Pre-compute product listing pages (materialized views)
5. ✅ Queue-based checkout (don't process in real-time)
6. ✅ Circuit breaker for non-critical services (reviews, recommendations)

During Black Friday:
- Cart operations → Redis (sub-ms latency)
- Inventory checks → Redis cache (refresh every 5s from PostgreSQL)
- Checkout → Kafka queue → process sequentially per product (prevents overselling)
- Search → Elasticsearch (pre-indexed, read-only during peak)
```

> **Why the interviewer asks this:** E-commerce is the most common system design scenario. It tests polyglot persistence, ACID requirements, caching, and scaling strategies all in one question.

**Follow-up:** *How would you handle inventory for flash sales where 10,000 people try to buy 100 items simultaneously?*

---

## 5.8 Real-world Scenario: Analytics Pipeline

### Question: Design a real-time analytics dashboard that processes 1 million events per minute.

**Answer:**

```
Data flow:

  App Servers           Message Queue         Stream Processing
  (events)              (buffer)              (transform)
     │                     │                      │
     ▼                     ▼                      ▼
┌─────────┐          ┌──────────┐          ┌──────────────┐
│ Events  │───CDC──►│  Kafka   │────────►│  Flink/      │
│ (writes)│          │  Topics  │          │  Spark       │
└─────────┘          └──────────┘          │  Streaming   │
                                           └──────┬───────┘
                                                  │
                          ┌───────────────────────┼──────────┐
                          ▼                       ▼          ▼
                   ┌────────────┐          ┌──────────┐ ┌────────┐
                   │ClickHouse │          │TimescaleDB│ │  S3    │
                   │(real-time  │          │(recent    │ │(cold   │
                   │ analytics) │          │ detailed) │ │archive)│
                   └─────┬──────┘          └──────────┘ └────────┘
                         │
                    ┌────▼─────┐
                    │Dashboard │
                    │ (Grafana)│
                    └──────────┘
```

```sql
-- ClickHouse: Optimized for analytical queries on billions of rows
-- (Column-oriented storage, massive compression, parallel execution)

CREATE TABLE events
(
    event_id     UUID,
    user_id      UInt64,
    event_type   LowCardinality(String),  -- dictionary encoding
    page_url     String,
    country      LowCardinality(String),
    device_type  LowCardinality(String),
    event_time   DateTime,
    properties   Map(String, String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_type, user_id, event_time)  -- determines sort on disk
TTL event_time + INTERVAL 90 DAY;           -- auto-delete after 90 days

-- This query scans 1 billion rows in < 1 second:
SELECT
    toStartOfHour(event_time) AS hour,
    event_type,
    uniqExact(user_id) AS unique_users,
    count() AS events
FROM events
WHERE event_time >= now() - INTERVAL 24 HOUR
GROUP BY hour, event_type
ORDER BY hour DESC;
-- ClickHouse processes this at ~1-10 billion rows/second
```

#### Real-Time Aggregation Layer

```sql
-- Pre-aggregated tables for dashboard queries

-- ClickHouse materialized view (auto-aggregates on insert)
CREATE MATERIALIZED VIEW mv_hourly_stats
ENGINE = SummingMergeTree()
ORDER BY (hour, event_type, country)
AS SELECT
    toStartOfHour(event_time) AS hour,
    event_type,
    country,
    count() AS event_count,
    uniq(user_id) AS unique_users
FROM events
GROUP BY hour, event_type, country;

-- Dashboard query (reads from pre-aggregated table - instant):
SELECT hour, SUM(event_count), SUM(unique_users)
FROM mv_hourly_stats
WHERE hour >= now() - INTERVAL 7 DAY
GROUP BY hour
ORDER BY hour;
```

> **Why the interviewer asks this:** Analytics pipelines test knowledge of columnar databases, stream processing, and the difference between real-time and batch processing architectures.

**Follow-up:** *How would you ensure exactly-once processing in this pipeline?*

---

## 5.9 Real-world Scenario: Chat Application

### Question: Design the database layer for a WhatsApp-like messaging system.

**Answer:**

#### Requirements

```
- 100M users
- 1:1 and group messages
- Message history (persisted)
- Online/offline status
- Read receipts
- Media messages (images, files)
```

#### Architecture

```
                    ┌───────────────┐
                    │ API Gateway   │
                    │ + WebSocket   │
                    └───────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │  Cassandra │    │   Redis    │    │    S3      │
  │            │    │            │    │            │
  │• Messages  │    │• Presence  │    │• Media     │
  │• Channels  │    │• Unread cnt│    │• Files     │
  │            │    │• Pub/Sub   │    │            │
  └────────────┘    └────────────┘    └────────────┘
```

#### Data Model (Cassandra)

```sql
-- Messages: Partitioned by channel, sorted by timestamp
-- Access pattern: "Get last 50 messages for a channel"

CREATE TABLE messages (
    channel_id  UUID,
    message_id  TIMEUUID,        -- time-based UUID (sortable)
    sender_id   UUID,
    content     TEXT,
    media_url   TEXT,
    msg_type    TEXT,             -- 'text', 'image', 'file'
    created_at  TIMESTAMP,
    PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
-- DESC: newest messages first (chat apps scroll from bottom)

-- Query: Get last 50 messages
SELECT * FROM messages
WHERE channel_id = ?
LIMIT 50;

-- Query: Load more (pagination using message_id)
SELECT * FROM messages
WHERE channel_id = ?
  AND message_id < ?    -- older than last seen message
LIMIT 50;

-- Channel members (for group chats)
CREATE TABLE channel_members (
    channel_id UUID,
    user_id    UUID,
    role       TEXT,      -- 'admin', 'member'
    joined_at  TIMESTAMP,
    PRIMARY KEY (channel_id, user_id)
);

-- User's channels (reverse lookup: "which channels am I in?")
CREATE TABLE user_channels (
    user_id     UUID,
    channel_id  UUID,
    channel_name TEXT,
    last_message_at TIMESTAMP,
    unread_count INT,
    PRIMARY KEY (user_id, last_message_at, channel_id)
) WITH CLUSTERING ORDER BY (last_message_at DESC, channel_id ASC);
-- Sorted by most recent activity (like WhatsApp's chat list)
```

```python
# Redis: Real-time features

# Online/offline presence
redis.setex(f"presence:{user_id}", 30, "online")  # heartbeat every 25s
# If key expires → user is offline

# Unread message count
redis.hincrby(f"unread:{user_id}", channel_id, 1)  # increment on new message
redis.hset(f"unread:{user_id}", channel_id, 0)     # reset when user reads

# Pub/Sub for real-time delivery
redis.publish(f"channel:{channel_id}", json.dumps(message))
# Each connected WebSocket server subscribes to relevant channels
```

**Why Cassandra for messages?**

```
✅ Write-heavy (millions of messages per second)
✅ Partition per channel (bounded, efficient)
✅ Time-sorted within partition (natural for chat)
✅ Multi-region replication (low latency globally)
✅ Linear scalability (add nodes as users grow)

❌ NOT PostgreSQL because:
   - 100M users × avg 50 messages/day = 5 billion messages/day
   - Single-server PostgreSQL can't handle this write volume
   - Sharding PostgreSQL adds complexity that Cassandra handles natively
```

> **Why the interviewer asks this:** Chat systems test your understanding of write-heavy workloads, real-time systems, and data modeling for specific access patterns (not generic CRUD).

**Follow-up:** *How would you implement end-to-end encryption at the database level?*

---

## 5.10 System Design Interview Problems

### Problem 1: Design a URL Shortener Database

```
Requirements: 100M URLs, 1000 reads/sec, 100 writes/sec

Database: PostgreSQL (moderate scale, ACID not critical but simple)

CREATE TABLE short_urls (
    id          BIGSERIAL PRIMARY KEY,
    short_code  VARCHAR(10) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    user_id     UUID,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    click_count BIGINT DEFAULT 0
);

CREATE INDEX idx_short_code ON short_urls (short_code);
-- This is the primary lookup pattern

Caching layer:
- Redis: SET url:{short_code} "{original_url}" EX 86400
- Cache hit ratio: ~80% (popular URLs are accessed repeatedly)
- 800 of 1000 reads/sec served from Redis (sub-ms)
- 200 reads/sec hit PostgreSQL (with index, <1ms each)

URL generation:
- Base62 encoding of auto-increment ID
- ID 1000000 → "4c92" (short and unique)
- Or use random 7-char strings with collision check
```

---

### Problem 2: Design a Notification System Database

```
Requirements: 50M users, 500M notifications/day, real-time delivery

Architecture:
- PostgreSQL: User preferences, notification templates
- Cassandra: Notification history (write-heavy, time-sorted)
- Redis: Real-time notification queue, unread counts
- Kafka: Event bus for notification generation

Cassandra schema:
CREATE TABLE user_notifications (
    user_id       UUID,
    created_at    TIMEUUID,
    notification_type TEXT,
    title         TEXT,
    body          TEXT,
    read          BOOLEAN,
    action_url    TEXT,
    PRIMARY KEY (user_id, created_at)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND default_time_to_live = 7776000;  -- 90 days TTL

-- Get unread notifications
-- (Don't query Cassandra for this - use Redis counter)
Redis: HGET unread_notifications {user_id}  → "7"
```

---

### Problem 3: Design a Leaderboard System

```
Requirements: 10M players, real-time rankings, top-100 queries

Solution: Redis Sorted Set (O(log n) operations)

# Add/update score
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2100 "player:bob"

# Get rank (0-indexed)
ZREVRANK leaderboard "player:alice"  → 42  (43rd place)

# Get top 100
ZREVRANGE leaderboard 0 99 WITHSCORES

# Get player's neighborhood (5 above, 5 below)
rank = ZREVRANK leaderboard "player:alice"
ZREVRANGE leaderboard (rank-5) (rank+5) WITHSCORES

# Time-scoped leaderboards:
ZADD leaderboard:2024:01 1500 "player:alice"  # January 2024
# Delete old leaderboards: DEL leaderboard:2023:12

Performance with 10M entries:
- ZADD: O(log n) = ~23 operations → microseconds
- ZREVRANK: O(log n) → microseconds
- ZREVRANGE 0 99: O(log n + 100) → microseconds
```

---

### Problem 4: Database Migration with Zero Downtime

```
Question: You need to split the "users" table into "users" and "user_profiles"
on a live system with 50M rows. How?

Step-by-step:

Phase 1: Create new table + dual-write
──────────────────────────────────────
CREATE TABLE user_profiles (
    user_id    UUID PRIMARY KEY REFERENCES users(user_id),
    bio        TEXT,
    avatar_url TEXT,
    ...
);

-- Application writes to BOTH tables
-- Code change: on user update, also write to user_profiles

Phase 2: Backfill historical data
──────────────────────────────────
-- Migrate in batches (not one giant query)
DO $$
DECLARE
    batch_size INT := 10000;
    last_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    LOOP
        INSERT INTO user_profiles (user_id, bio, avatar_url)
        SELECT user_id, bio, avatar_url
        FROM users
        WHERE user_id > last_id
        ORDER BY user_id
        LIMIT batch_size
        ON CONFLICT (user_id) DO NOTHING;  -- skip already-migrated rows

        GET DIAGNOSTICS batch_size = ROW_COUNT;
        EXIT WHEN batch_size = 0;

        SELECT MAX(user_id) INTO last_id FROM user_profiles;
        PERFORM pg_sleep(0.1);  -- throttle to avoid overloading
    END LOOP;
END $$;

Phase 3: Verify consistency
─────────────────────────
SELECT COUNT(*) FROM users
WHERE user_id NOT IN (SELECT user_id FROM user_profiles);
-- Should be 0

Phase 4: Switch reads to new table
────────────────────────────────
-- Application reads profile data from user_profiles
-- Still dual-writing for safety

Phase 5: Remove old columns + stop dual-write
──────────────────────────────────────────────
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN avatar_url;
-- Now single-write to appropriate table
```

---

### Problem 5: Debugging - Production Incident

```
Question: Your application is suddenly experiencing 10× slower database queries.
The database CPU is at 95%. Walk through your debugging process.

Step 1: Identify the problem queries
──────────────────────────────────────
-- Check currently running queries
SELECT pid, age(clock_timestamp(), query_start) AS duration,
       state, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Check which queries consume the most time (requires pg_stat_statements)
SELECT
    query,
    calls,
    mean_exec_time,
    total_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

Step 2: Check for locks and blocking
──────────────────────────────────────
SELECT blocked.pid, blocked.query AS blocked_query,
       blocking.pid, blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON blocked.pid = bl.pid AND NOT bl.granted
JOIN pg_locks kl ON bl.locktype = kl.locktype
    AND bl.relation IS NOT DISTINCT FROM kl.relation
    AND bl.pid <> kl.pid AND kl.granted
JOIN pg_stat_activity blocking ON kl.pid = blocking.pid;

Step 3: Check for missing indexes
──────────────────────────────────
-- Sequential scans on large tables
SELECT relname, seq_scan, idx_scan,
       seq_scan - idx_scan AS too_many_seq_scans
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;

Step 4: Check for bloat (dead tuples)
──────────────────────────────────────
SELECT relname, n_dead_tup, n_live_tup,
       ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1)
       AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

Step 5: Check connection count
──────────────────────────────
SELECT count(*) FROM pg_stat_activity;
-- If near max_connections → connection exhaustion
-- Fix: PgBouncer connection pooling

Step 6: Check replication lag (if using replicas)
──────────────────────────────────────────────────
SELECT client_addr, replay_lag
FROM pg_stat_replication;

Common root causes:
1. Missing index → add index (most common)
2. Long-running transaction → kill it
3. Table bloat → VACUUM
4. N+1 queries → batch/JOIN
5. Connection exhaustion → connection pooling
6. Bad query plan (stale stats) → ANALYZE
```

---

## Key Takeaways

| Topic | What to Remember |
|---|---|
| Scaling progression | Index → Cache → Replicas → Vertical → Partition → Shard → Multi-region |
| Read optimization | Replicas, caching layers, covering indexes, materialized views, denormalization |
| Write optimization | Batch inserts, minimal indexes, BRIN, partitioning, append-only |
| CQRS | Separate read/write models for systems needing both fast reads and fast writes |
| Replication | Sync (zero data loss, high latency) vs Async (fast, risk of data loss) |
| Caching | Cache stampede, penetration, hot key - know the problems and solutions |
| Consistency | 2PC for strong, Saga for microservices, Outbox for reliable events |
| Large datasets | Partition + archive + compress + tiered storage |
| Production debugging | pg_stat_activity → pg_locks → pg_stat_statements → EXPLAIN ANALYZE |

---

## Final Interview Preparation Checklist

```
□ Can explain SELECT execution order and NULL behavior
□ Can write window functions (RANK, LAG, running totals)
□ Can read EXPLAIN ANALYZE and identify bottlenecks
□ Understand B-tree index internals and composite index rules
□ Know all normalization forms and when to denormalize
□ Can explain ACID and transaction isolation levels with examples
□ Understand MVCC, VACUUM, and dead tuple management
□ Know when to choose SQL vs NoSQL (with specific database examples)
□ Can design a caching strategy (patterns, invalidation, stampede prevention)
□ Can explain CAP theorem and consistency models
□ Can design a database schema for common systems (e-commerce, chat, analytics)
□ Know the scaling progression from single server to sharded multi-region
□ Can debug a slow query systematically
□ Understand replication (sync vs async), failover, and split-brain prevention
□ Can handle zero-downtime migrations and schema changes
```

---

**Previous:** [← Part 4 - NoSQL & Modern Databases](./04-nosql.md)
**Back to index:** [README](./README.md)
