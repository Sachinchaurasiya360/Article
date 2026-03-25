# Part 3: Advanced SQL & Database Internals

> Dive deep into how databases actually work under the hood. Query execution plans, index internals, partitioning, locking, isolation levels, and deadlocks — the knowledge that separates senior engineers from everyone else.

---

## Table of Contents

- [3.1 Query Execution Plans — Deep Dive](#31-query-execution-plans--deep-dive)
- [3.2 Index Types & Internals](#32-index-types--internals)
- [3.3 Table Partitioning](#33-table-partitioning)
- [3.4 Sharding](#34-sharding)
- [3.5 Locks & Concurrency Control](#35-locks--concurrency-control)
- [3.6 Transaction Isolation Levels](#36-transaction-isolation-levels)
- [3.7 Deadlocks](#37-deadlocks)
- [3.8 MVCC (Multi-Version Concurrency Control)](#38-mvcc-multi-version-concurrency-control)
- [3.9 Stored Procedures, Triggers & Advanced DDL](#39-stored-procedures-triggers--advanced-ddl)
- [3.10 Advanced Query Problems & Practice](#310-advanced-query-problems--practice)

---

## 3.1 Query Execution Plans — Deep Dive

### Question: How does PostgreSQL execute a SQL query? Walk through the entire pipeline.

**Answer:**

When you run a query, PostgreSQL processes it through **five stages:**

```
SQL Query String
       │
       ▼
┌─────────────┐
│   Parser    │ → Syntax check, builds parse tree
└──────┬──────┘
       ▼
┌─────────────┐
│  Analyzer   │ → Semantic check (tables/columns exist?), resolves types
└──────┬──────┘
       ▼
┌─────────────┐
│  Rewriter   │ → Applies rules (view expansion, row-level security)
└──────┬──────┘
       ▼
┌─────────────────┐
│ Query Planner/  │ → Generates candidate plans, estimates costs, picks cheapest
│   Optimizer     │
└──────┬──────────┘
       ▼
┌─────────────┐
│  Executor   │ → Runs the chosen plan, returns results
└─────────────┘
```

#### Reading EXPLAIN ANALYZE Output

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT e.first_name, d.dept_name, e.salary
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
WHERE e.salary > 80000
ORDER BY e.salary DESC;
```

**Sample output (annotated):**

```
Sort  (cost=52.14..52.89 rows=300 width=218) (actual time=0.340..0.355 rows=250 loops=1)
  Sort Key: e.salary DESC
  Sort Method: quicksort  Memory: 45kB
  Buffers: shared hit=15
  ->  Hash Join  (cost=1.09..39.53 rows=300 width=218) (actual time=0.065..0.215 rows=250 loops=1)
        Hash Cond: (e.dept_id = d.dept_id)
        Buffers: shared hit=12
        ->  Seq Scan on employees e  (cost=0.00..33.50 rows=300 width=122) (actual time=0.012..0.098 rows=250 loops=1)
              Filter: (salary > 80000::numeric)
              Rows Removed by Filter: 750
              Buffers: shared hit=10
        ->  Hash  (cost=1.05..1.05 rows=3 width=104) (actual time=0.020..0.020 rows=3 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 9kB
              Buffers: shared hit=2
              ->  Seq Scan on departments d  (cost=0.00..1.05 rows=3 width=104) (actual time=0.005..0.008 rows=3 loops=1)
                    Buffers: shared hit=2
Planning Time: 0.285 ms
Execution Time: 0.410 ms
```

**How to read this:**

| Component | Meaning |
|---|---|
| `cost=52.14..52.89` | Estimated startup cost..total cost (arbitrary units) |
| `rows=300` | Estimated number of rows |
| `actual time=0.340..0.355` | Real wall-clock time in ms (startup..total) |
| `rows=250` | Actual rows returned |
| `loops=1` | How many times this node executed |
| `Buffers: shared hit=15` | Pages read from shared buffer cache |
| `Rows Removed by Filter: 750` | Rows that didn't pass the WHERE filter |

**Scan types explained:**

```
Sequential Scan (Seq Scan)
├── Reads every row in the table
├── Best for: small tables, low selectivity queries (>5-10% of rows)
└── O(n)

Index Scan
├── Uses index to find matching rows, then fetches full rows from table
├── Best for: high selectivity queries (<5% of rows)
└── O(log n + k) where k = matching rows

Index Only Scan
├── Reads everything from the index (never touches the table)
├── Best for: queries where all needed columns are in the index
├── Requires: covering index + visible pages in visibility map
└── O(log n + k) — fastest possible scan

Bitmap Index Scan + Bitmap Heap Scan
├── Phase 1: Bitmap Index Scan — builds a bitmap of matching page locations
├── Phase 2: Bitmap Heap Scan — reads pages in sequential order
├── Best for: medium selectivity (5-25% of rows), OR conditions
└── Combines benefits of index precision with sequential I/O
```

**Join algorithms:**

```
Nested Loop Join
├── For each row in outer table, scan inner table
├── Best for: small outer table + indexed inner table
├── Cost: O(n × m) without index, O(n × log m) with index
└── Used when one side is very small or inner side has good index

Hash Join
├── Phase 1: Build hash table from smaller table
├── Phase 2: Probe hash table with larger table
├── Best for: large tables without indexes, equi-joins
├── Cost: O(n + m)
└── Needs memory for hash table (work_mem)

Merge Join
├── Sort both inputs, then merge
├── Best for: pre-sorted data (indexed columns), large datasets
├── Cost: O(n log n + m log m) or O(n + m) if already sorted
└── Most efficient when both sides are already sorted
```

> **Why the interviewer asks this:** Senior engineers must be able to read and interpret execution plans to diagnose performance issues. This is a daily skill, not theoretical knowledge.

**Follow-up:** *What does it mean when estimated rows differ significantly from actual rows? How do you fix it?*

---

### Question: What does it mean when estimated rows differ from actual rows?

**Answer:**

A large mismatch between estimated and actual rows means the **query planner's statistics are inaccurate**, leading to a suboptimal plan choice.

```sql
-- Example: Planner estimates 10 rows, but 50,000 are actually returned
Seq Scan on events (cost=0.00..2154.00 rows=10 width=40) (actual time=0.015..45.230 rows=50000 loops=1)
```

**Common causes and fixes:**

| Cause | Fix |
|---|---|
| Stale statistics | `ANALYZE table_name;` |
| Correlated columns (planner assumes independence) | Create extended statistics: `CREATE STATISTICS s1 (dependencies) ON col1, col2 FROM table;` |
| Uneven data distribution | Increase `default_statistics_target` for the column |
| Complex expressions/functions | Create expression index or use materialized view |
| Temporary tables | Run `ANALYZE` on temp tables before querying |

```sql
-- Update statistics for a specific table
ANALYZE employees;

-- Increase statistics sampling for a frequently queried column
ALTER TABLE employees ALTER COLUMN salary SET STATISTICS 1000;
-- Default is 100; higher = more accurate stats but slower ANALYZE

-- Check current statistics
SELECT
    attname,
    n_distinct,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE tablename = 'employees' AND attname = 'dept_id';
```

> **Why the interviewer asks this:** Stale statistics are one of the top causes of sudden performance degradation in production. Understanding the statistics system is critical.

**Follow-up:** *What is `pg_stat_statements` and how do you use it to find slow queries?*

---

## 3.2 Index Types & Internals

### Question: Explain the different index types in PostgreSQL and when to use each.

**Answer:**

#### B-tree Index (Default)

```
                    [50]
                   /    \
              [25,35]   [75,90]
             /  |  \   /  |  \
          [10] [30] [40] [60] [80] [95]
           ↓    ↓    ↓    ↓    ↓    ↓
         data  data data data data data
```

```sql
-- Default index type — works for: =, <, >, <=, >=, BETWEEN, IN, IS NULL
CREATE INDEX idx_salary ON employees (salary);

-- Composite B-tree (leftmost prefix rule applies)
CREATE INDEX idx_dept_salary ON employees (dept_id, salary);

-- The B-tree structure:
-- • Balanced tree: all leaf nodes at same depth
-- • Each node fits in one disk page (8KB in PostgreSQL)
-- • Leaf nodes are linked for range scans
-- • Height is typically 3-4 for millions of rows
-- • Lookup: O(log n) — about 3-4 I/O operations for 100M rows
```

**Best for:** Equality and range queries (the vast majority of use cases).

#### Hash Index

```sql
-- Hash index: only supports equality (=) comparisons
CREATE INDEX idx_email_hash ON employees USING hash (email);

-- Hash table structure:
-- hash(email) → bucket → row pointer
-- O(1) lookup for exact matches

-- When to use:
-- • Only equality checks needed (no range queries, no sorting)
-- • Column has high cardinality
-- In practice, B-tree is almost always preferred because:
-- • B-tree supports = AND range queries
-- • Hash indexes weren't crash-safe before PostgreSQL 10
-- • B-tree performance for = is close to hash
```

**Best for:** Exact equality lookups only (rare in practice).

#### GIN (Generalized Inverted Index)

```sql
-- GIN indexes: for multi-valued data types (arrays, JSONB, full-text)

-- Full-text search
CREATE INDEX idx_articles_search ON articles USING gin (to_tsvector('english', body));

SELECT * FROM articles
WHERE to_tsvector('english', body) @@ to_tsquery('database & optimization');

-- JSONB indexing
CREATE INDEX idx_metadata ON events USING gin (metadata jsonb_path_ops);

SELECT * FROM events WHERE metadata @> '{"type": "purchase"}';

-- Array indexing
CREATE INDEX idx_tags ON articles USING gin (tags);

SELECT * FROM articles WHERE tags @> ARRAY['postgresql', 'performance'];
```

**Best for:** Full-text search, JSONB queries, array containment.

#### GiST (Generalized Search Tree)

```sql
-- GiST: for geometric, spatial, and range data

-- Geometric / PostGIS
CREATE INDEX idx_location ON stores USING gist (location);

SELECT * FROM stores
WHERE ST_DWithin(location, ST_MakePoint(-73.99, 40.73)::geography, 1000);
-- Find stores within 1km of a point

-- Range types
CREATE INDEX idx_booking_range ON bookings USING gist (date_range);

SELECT * FROM bookings
WHERE date_range && daterange('2024-01-01', '2024-01-31');
-- Find bookings that overlap with January 2024
```

**Best for:** Spatial/geographic queries (PostGIS), range overlaps, nearest-neighbor searches.

#### BRIN (Block Range Index)

```sql
-- BRIN: extremely compact index for naturally ordered data
-- Stores min/max values per block range (e.g., per 128 pages)

CREATE INDEX idx_orders_date_brin ON orders USING brin (order_date)
WITH (pages_per_range = 128);

-- Size comparison for 100M rows:
-- B-tree on order_date: ~2.1 GB
-- BRIN on order_date:   ~100 KB (20,000× smaller!)

-- BRIN works well when:
-- • Data is physically ordered by the indexed column
-- • Table is append-only (new rows have increasing values)
-- • Examples: time-series data, log tables, event streams
```

**Best for:** Very large, naturally ordered tables (time-series, logs).

**Index type summary:**

| Index Type | Operators | Best For | Size | Speed |
|---|---|---|---|---|
| B-tree | `=, <, >, <=, >=, BETWEEN` | General purpose | Medium | Fast |
| Hash | `=` only | Exact equality | Medium | Fastest for `=` |
| GIN | `@>, @@, &&` | Multi-valued (JSONB, arrays, FTS) | Large | Fast search, slow updates |
| GiST | `&&, @>, <->` | Spatial, range, nearest-neighbor | Medium | Good for overlap queries |
| BRIN | `=, <, >, <=, >=` | Sorted/append-only data | Tiny | Good for large sequential data |

> **Why the interviewer asks this:** Senior roles require choosing the right index type for specific workloads. Knowing B-tree internals shows you understand why certain queries are fast and others aren't.

**Follow-up:** *What is a covering index and how does it enable Index Only Scans?*

---

### Question: What is a covering index?

**Answer:**

A covering index includes all columns needed by a query, so the database never needs to access the table heap — it reads everything from the index.

```sql
-- Query: frequently find employee names and salaries by department
SELECT first_name, salary FROM employees WHERE dept_id = 5;

-- Regular index: must access table for first_name and salary
CREATE INDEX idx_dept ON employees (dept_id);
-- Plan: Index Scan → Heap Fetch (random I/O for each row)

-- Covering index: includes all needed columns
CREATE INDEX idx_dept_covering ON employees (dept_id) INCLUDE (first_name, salary);
-- Plan: Index Only Scan (no heap access needed!)

-- INCLUDE columns are stored in leaf nodes but NOT used for searching/sorting
-- They just "ride along" to avoid heap fetches
```

**Performance impact:**

```
Table: 10M rows, query returns 1000 rows

Index Scan + Heap Fetch:
  - 3-4 I/O for index traversal
  - 1000 random I/O for heap fetches (SLOW: random disk reads)
  - Total: ~1003 I/O operations

Index Only Scan:
  - 3-4 I/O for index traversal
  - ~10 sequential I/O for leaf pages
  - Total: ~14 I/O operations (70× fewer!)
```

> **Why the interviewer asks this:** Covering indexes are one of the most impactful optimization techniques. The `INCLUDE` clause (added in PostgreSQL 11) is modern and shows current knowledge.

**Follow-up:** *What is the visibility map and why does it matter for Index Only Scans?*

---

## 3.3 Table Partitioning

### Question: What is table partitioning and when should you use it?

**Answer:**

Partitioning divides a large table into smaller, more manageable pieces called **partitions**. Each partition is a separate physical table, but they're accessed as a single logical table.

```sql
-- Range partitioning by date (most common)
CREATE TABLE orders (
    order_id    BIGSERIAL,
    customer_id INT NOT NULL,
    order_date  DATE NOT NULL,
    total       NUMERIC(12, 2),
    status      VARCHAR(20)
) PARTITION BY RANGE (order_date);

-- Create partitions for each year
CREATE TABLE orders_2022 PARTITION OF orders
    FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');

CREATE TABLE orders_2023 PARTITION OF orders
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE orders_2024 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Default partition catches anything that doesn't match
CREATE TABLE orders_default PARTITION OF orders DEFAULT;
```

**Partition pruning — the performance benefit:**

```sql
-- Query with partition key in WHERE → only scans relevant partition
EXPLAIN SELECT * FROM orders WHERE order_date = '2024-06-15';

-- Output:
-- Append
--   ->  Seq Scan on orders_2024  ← only this partition is scanned!
--       Filter: (order_date = '2024-06-15')
-- Partitions 2022 and 2023 are completely skipped (pruned)
```

#### List Partitioning

```sql
-- Partition by discrete values
CREATE TABLE customers (
    customer_id SERIAL,
    name        VARCHAR(100),
    country     VARCHAR(2) NOT NULL,
    email       VARCHAR(100)
) PARTITION BY LIST (country);

CREATE TABLE customers_us PARTITION OF customers FOR VALUES IN ('US');
CREATE TABLE customers_uk PARTITION OF customers FOR VALUES IN ('UK');
CREATE TABLE customers_eu PARTITION OF customers FOR VALUES IN ('DE', 'FR', 'IT', 'ES');
CREATE TABLE customers_other PARTITION OF customers DEFAULT;
```

#### Hash Partitioning

```sql
-- Even distribution across partitions (when no natural range/list exists)
CREATE TABLE events (
    event_id   BIGSERIAL,
    user_id    INT NOT NULL,
    event_type VARCHAR(50),
    created_at TIMESTAMP
) PARTITION BY HASH (user_id);

CREATE TABLE events_p0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_p1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_p2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_p3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

**When to partition:**

| Use Partitioning When | Don't Partition When |
|---|---|
| Table > 100M rows | Table < 10M rows |
| Queries always filter on partition key | Queries don't use partition key |
| Need to drop old data quickly (`DROP` partition) | Random access patterns across all data |
| Different partitions have different storage needs | Uniform access patterns |
| Maintenance operations (VACUUM, REINDEX) too slow | Overhead of partition routing isn't worth it |

**Partition maintenance:**

```sql
-- Detach old partition (instant, no data movement)
ALTER TABLE orders DETACH PARTITION orders_2022;

-- Drop old data (instant — just drops the partition table)
DROP TABLE orders_2022;
-- Compare: DELETE FROM orders WHERE order_date < '2023-01-01' → slow, generates WAL

-- Attach a new partition (validates data constraints)
ALTER TABLE orders ATTACH PARTITION orders_2025
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

> **Why the interviewer asks this:** Partitioning is essential for any system handling large volumes of data. The interviewer wants to see you understand partition pruning, maintenance benefits, and when NOT to partition.

**Follow-up:** *What is the difference between partitioning and sharding?*

---

## 3.4 Sharding

### Question: What is sharding and how does it differ from partitioning?

**Answer:**

**Partitioning** splits a table across multiple physical tables **on the same server**. **Sharding** splits data across **multiple servers** (nodes).

```
Partitioning (single server):           Sharding (multiple servers):
┌─────────────────────────┐              ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Server                  │              │ Server 1 │  │ Server 2 │  │ Server 3 │
│ ┌─────┐ ┌─────┐ ┌────┐ │              │ Users    │  │ Users    │  │ Users    │
│ │2022 │ │2023 │ │2024│ │              │ A-H      │  │ I-P      │  │ Q-Z      │
│ └─────┘ └─────┘ └────┘ │              └──────────┘  └──────────┘  └──────────┘
└─────────────────────────┘
```

#### Sharding Strategies

**1. Range-based sharding:**

```
Shard Key: user_id
Shard 1: user_id 1 - 1,000,000
Shard 2: user_id 1,000,001 - 2,000,000
Shard 3: user_id 2,000,001 - 3,000,000

Pros: Simple, range queries on shard key are efficient
Cons: Uneven distribution (hotspots), hard to rebalance
```

**2. Hash-based sharding:**

```
Shard = hash(user_id) % num_shards

Shard 1: hash(user_id) % 3 == 0
Shard 2: hash(user_id) % 3 == 1
Shard 3: hash(user_id) % 3 == 2

Pros: Even distribution
Cons: Range queries require hitting ALL shards, resharding is painful
```

**3. Consistent hashing (advanced):**

```
Hash ring: 0 ────── 2^32
Nodes map to positions on the ring
Keys map to the next clockwise node

When adding/removing a node, only 1/n of keys need to move
Used by: DynamoDB, Cassandra, Redis Cluster
```

**4. Directory-based sharding:**

```
Lookup service: "user_id 42 → Shard 2"
Most flexible, but lookup service is a single point of failure
Used when sharding logic is complex or changes frequently
```

**Challenges of sharding:**

| Challenge | Description |
|---|---|
| Cross-shard queries | JOINs across shards are expensive (network round trips) |
| Distributed transactions | 2PC (two-phase commit) needed for cross-shard writes |
| Rebalancing | Moving data between shards when load is uneven |
| Schema changes | Must coordinate DDL across all shards |
| Auto-increment IDs | Can't use SERIAL — need distributed ID generation (Snowflake IDs, UUIDs) |
| Application complexity | Shard routing logic in application layer |

**Choosing a shard key:**

```
Good shard keys:
✅ user_id (queries are usually per-user)
✅ tenant_id (multi-tenant SaaS)
✅ region (geographic sharding)

Bad shard keys:
❌ timestamp (recent data gets ALL writes → hotspot)
❌ status (few distinct values → uneven distribution)
❌ auto-increment ID (all new rows go to the latest shard)
```

> **Why the interviewer asks this:** Sharding comes up in every system design interview. Understanding the trade-offs shows you can design systems that scale beyond a single machine.

**Follow-up:** *How does Vitess or Citus handle sharding transparently for the application?*

---

## 3.5 Locks & Concurrency Control

### Question: Explain PostgreSQL's locking mechanism. What types of locks exist?

**Answer:**

Locks prevent data corruption when multiple transactions access the same data concurrently.

#### Lock Granularity

```
Table-level locks
├── Coarser granularity
├── Less overhead
└── More contention (blocks more operations)

Row-level locks
├── Finer granularity
├── More overhead (tracking each locked row)
└── Less contention (other rows remain accessible)
```

#### Table-Level Lock Modes (from weakest to strongest)

```sql
-- ACCESS SHARE: SELECT (read-only, doesn't block anything except ACCESS EXCLUSIVE)
SELECT * FROM employees;

-- ROW SHARE: SELECT ... FOR UPDATE/FOR SHARE
SELECT * FROM employees WHERE emp_id = 1 FOR UPDATE;

-- ROW EXCLUSIVE: INSERT, UPDATE, DELETE
UPDATE employees SET salary = 100000 WHERE emp_id = 1;

-- SHARE: CREATE INDEX (without CONCURRENTLY)
CREATE INDEX idx_salary ON employees (salary);
-- Blocks writes but allows reads

-- ACCESS EXCLUSIVE: ALTER TABLE, DROP TABLE, TRUNCATE, VACUUM FULL
ALTER TABLE employees ADD COLUMN phone VARCHAR(20);
-- Blocks EVERYTHING — even reads!
```

**Lock compatibility matrix (simplified):**

```
                    ACCESS    ROW      ROW        SHARE    ACCESS
                    SHARE     SHARE    EXCLUSIVE           EXCLUSIVE
ACCESS SHARE         ✅        ✅       ✅         ✅        ❌
ROW SHARE            ✅        ✅       ✅         ✅        ❌
ROW EXCLUSIVE        ✅        ✅       ✅         ❌        ❌
SHARE                ✅        ✅       ❌         ✅        ❌
ACCESS EXCLUSIVE     ❌        ❌       ❌         ❌        ❌
```

#### Row-Level Locks

```sql
-- FOR UPDATE: Exclusive row lock (blocks other FOR UPDATE and writes)
BEGIN;
SELECT * FROM accounts WHERE account_id = 1 FOR UPDATE;
-- Row is now locked — other transactions trying to UPDATE or FOR UPDATE this row will WAIT
UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
COMMIT;

-- FOR SHARE: Shared row lock (allows other FOR SHARE, blocks writes)
BEGIN;
SELECT * FROM accounts WHERE account_id = 1 FOR SHARE;
-- Other transactions can also FOR SHARE, but cannot UPDATE or DELETE
COMMIT;

-- FOR UPDATE NOWAIT: Fail immediately if row is locked
BEGIN;
SELECT * FROM accounts WHERE account_id = 1 FOR UPDATE NOWAIT;
-- If locked: ERROR: could not obtain lock on row
COMMIT;

-- FOR UPDATE SKIP LOCKED: Skip locked rows (useful for job queues)
BEGIN;
SELECT * FROM tasks WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- Picks the first UNLOCKED pending task — perfect for worker queues
UPDATE tasks SET status = 'processing' WHERE task_id = ...;
COMMIT;
```

#### Advisory Locks (Application-Level)

```sql
-- Application-controlled locks (not tied to rows or tables)
-- Useful for: distributed locking, preventing duplicate cron jobs

-- Session-level advisory lock (held until session ends or explicitly released)
SELECT pg_advisory_lock(12345);  -- acquire lock with key 12345
-- ... do exclusive work ...
SELECT pg_advisory_unlock(12345);

-- Transaction-level advisory lock (released at COMMIT/ROLLBACK)
SELECT pg_advisory_xact_lock(12345);

-- Try to acquire without blocking
SELECT pg_try_advisory_lock(12345);  -- returns true/false immediately
```

> **Why the interviewer asks this:** Understanding locks is essential for writing correct concurrent code. The `SKIP LOCKED` pattern for job queues is a practical, production-relevant technique.

**Follow-up:** *What is optimistic locking vs pessimistic locking? When would you use each?*

---

### Question: Optimistic vs Pessimistic locking?

**Answer:**

```sql
-- PESSIMISTIC LOCKING: Lock the row BEFORE reading it
-- "I assume conflicts WILL happen, so I'll lock preemptively"
BEGIN;
SELECT * FROM inventory WHERE product_id = 5 FOR UPDATE;  -- lock acquired
-- Check stock, update quantity, etc.
UPDATE inventory SET stock = stock - 1 WHERE product_id = 5;
COMMIT;  -- lock released

-- Pros: Guaranteed consistency, simple logic
-- Cons: Blocks other transactions, potential for deadlocks
-- Best for: High contention (many concurrent writes to same rows)

-- OPTIMISTIC LOCKING: Don't lock — detect conflicts at write time
-- "I assume conflicts are RARE, so I'll just check before writing"

-- Add a version column:
ALTER TABLE inventory ADD COLUMN version INT DEFAULT 1;

-- Read the current state (no lock)
-- Application reads: product_id=5, stock=10, version=3

-- Update with version check:
UPDATE inventory
SET stock = stock - 1, version = version + 1
WHERE product_id = 5 AND version = 3;
-- If another transaction updated first (version is now 4):
-- 0 rows affected → conflict detected → application retries

-- Pros: No blocking, better throughput under low contention
-- Cons: Must handle retries, wasted work on conflict
-- Best for: Low contention (reads >> writes), web applications
```

| Aspect | Pessimistic | Optimistic |
|---|---|---|
| Lock timing | Before read | At write time (detect conflict) |
| Contention handling | Block/wait | Retry |
| Best for | High write contention | Read-heavy, low write contention |
| Deadlock risk | Yes | No |
| Implementation | `SELECT ... FOR UPDATE` | Version column + conditional update |

> **Why the interviewer asks this:** This is a fundamental architectural decision. Choosing wrong causes either terrible performance (unnecessary locking) or data corruption (missing conflicts).

**Follow-up:** *How does optimistic locking work in ORMs like Hibernate or Django?*

---

## 3.6 Transaction Isolation Levels

### Question: Explain the four SQL transaction isolation levels and the anomalies each prevents.

**Answer:**

Isolation levels control **what a transaction can see** when other transactions are running concurrently.

#### Anomalies (Problems)

**1. Dirty Read:** Reading uncommitted data from another transaction

```sql
-- Transaction A                    -- Transaction B
BEGIN;                              BEGIN;
UPDATE accounts SET balance = 0
WHERE id = 1;
                                    SELECT balance FROM accounts WHERE id = 1;
                                    -- Reads 0 (DIRTY — Transaction A hasn't committed!)
ROLLBACK;                           -- But the real balance was never 0!
                                    -- Transaction B made a decision based on phantom data
```

**2. Non-Repeatable Read:** Same query returns different data within one transaction

```sql
-- Transaction A                    -- Transaction B
BEGIN;                              BEGIN;
SELECT salary FROM employees
WHERE emp_id = 1;
-- Returns: 80000
                                    UPDATE employees SET salary = 90000 WHERE emp_id = 1;
                                    COMMIT;
SELECT salary FROM employees
WHERE emp_id = 1;
-- Returns: 90000 ← DIFFERENT!
COMMIT;
```

**3. Phantom Read:** Same query returns different SET of rows

```sql
-- Transaction A                    -- Transaction B
BEGIN;                              BEGIN;
SELECT COUNT(*) FROM employees
WHERE dept_id = 1;
-- Returns: 5
                                    INSERT INTO employees (dept_id, ...) VALUES (1, ...);
                                    COMMIT;
SELECT COUNT(*) FROM employees
WHERE dept_id = 1;
-- Returns: 6 ← NEW ROW APPEARED (phantom)
COMMIT;
```

**4. Serialization Anomaly:** Transaction results differ from any serial execution order

```sql
-- Transaction A: sum all balances
-- Transaction B: transfer $100 from account 1 to account 2
-- Running concurrently: A might see the debit but not the credit
-- (or vice versa), producing a sum that's $100 off
```

#### Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly |
|---|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Prevented* | Possible |
| SERIALIZABLE | Prevented | Prevented | Prevented | Prevented |

*PostgreSQL's REPEATABLE READ also prevents phantom reads (via MVCC snapshot), unlike the SQL standard's minimum guarantee.

```sql
-- Set isolation level for a transaction
BEGIN ISOLATION LEVEL SERIALIZABLE;
    -- This transaction sees a consistent snapshot
    -- Conflicts trigger serialization failures → must retry
COMMIT;

-- Set default for session
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

#### PostgreSQL's Implementation

```sql
-- READ COMMITTED (PostgreSQL default):
-- Each STATEMENT sees a new snapshot of committed data
-- Two identical SELECTs in the same transaction can return different results

-- REPEATABLE READ:
-- Transaction sees a snapshot taken at the START of the transaction
-- All queries see the same data, regardless of concurrent commits
-- Raises ERROR if a concurrent transaction modifies the same rows

-- SERIALIZABLE:
-- Like REPEATABLE READ + detects serialization anomalies
-- Uses Serializable Snapshot Isolation (SSI)
-- May fail with: ERROR: could not serialize access due to concurrent update
-- Application MUST retry failed transactions

BEGIN ISOLATION LEVEL SERIALIZABLE;
    -- If two serializable transactions have a read-write dependency cycle,
    -- one of them is aborted with a serialization error
    -- This is safe but requires retry logic:
COMMIT;
-- If you get serialization error:
-- ROLLBACK and retry the entire transaction
```

**Choosing the right isolation level:**

| Use Case | Recommended Level |
|---|---|
| Most web applications | READ COMMITTED (default, good enough) |
| Financial calculations | REPEATABLE READ or SERIALIZABLE |
| Reports needing consistent snapshot | REPEATABLE READ |
| Critical: no anomalies allowed | SERIALIZABLE (with retry logic) |

> **Why the interviewer asks this:** Isolation levels directly impact correctness and performance. The ability to explain concrete anomalies with examples (not just recite the table) is what interviewers look for.

**Follow-up:** *How does PostgreSQL implement REPEATABLE READ using MVCC?*

---

## 3.7 Deadlocks

### Question: What are deadlocks? How do you detect, prevent, and resolve them?

**Answer:**

A **deadlock** occurs when two or more transactions are waiting for each other to release locks, creating a cycle where none can proceed.

```
Transaction A                    Transaction B
BEGIN;                           BEGIN;
UPDATE accounts SET ...          UPDATE products SET ...
WHERE id = 1;                    WHERE id = 1;
-- Holds lock on accounts.1      -- Holds lock on products.1

UPDATE products SET ...          UPDATE accounts SET ...
WHERE id = 1;                    WHERE id = 1;
-- WAITING for products.1 lock   -- WAITING for accounts.1 lock
-- (held by Transaction B)        -- (held by Transaction A)

-- DEADLOCK! Neither can proceed
```

**PostgreSQL's deadlock detection:**

```sql
-- PostgreSQL runs a deadlock detector every deadlock_timeout (default: 1 second)
-- When detected, one transaction is chosen as the victim and aborted:

-- ERROR: deadlock detected
-- DETAIL: Process 12345 waits for ShareLock on transaction 67890;
--         blocked by process 67891.
--         Process 67891 waits for ShareLock on transaction 12345;
--         blocked by process 12345.
-- HINT: See server log for query details.
```

#### Prevention Strategies

**1. Consistent lock ordering — most effective:**

```sql
-- ❌ Deadlock-prone: different transactions lock tables in different order
-- Transaction A: accounts → products
-- Transaction B: products → accounts

-- ✅ Always lock in the same order (alphabetical, by ID, etc.):
-- Transaction A: accounts → products
-- Transaction B: accounts → products  (same order!)

-- For row-level: always lock rows in ascending ID order
BEGIN;
-- Lock both accounts, lowest ID first
SELECT * FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

**2. Minimize transaction duration:**

```sql
-- ❌ Long transaction holding locks
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- ... do 5 seconds of application processing ...
-- ... call external API ...
UPDATE accounts SET balance = ... WHERE id = 1;
COMMIT;

-- ✅ Keep transactions short
-- Do all processing BEFORE the transaction
BEGIN;
UPDATE accounts SET balance = calculated_value WHERE id = 1;
COMMIT;
```

**3. Use lock timeouts:**

```sql
-- Set a timeout for acquiring locks
SET lock_timeout = '5s';

BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- If lock can't be acquired within 5 seconds:
-- ERROR: canceling statement due to lock timeout
COMMIT;
```

**4. Use NOWAIT or SKIP LOCKED:**

```sql
-- NOWAIT: fail immediately if locked
SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;

-- SKIP LOCKED: skip locked rows (useful for queue processing)
SELECT * FROM tasks WHERE status = 'pending'
LIMIT 1 FOR UPDATE SKIP LOCKED;
```

**Monitoring locks:**

```sql
-- View current locks
SELECT
    pid,
    locktype,
    relation::regclass AS table_name,
    mode,
    granted,
    query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT granted;  -- show only waiting locks

-- Find blocking queries
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON blocked.pid = bl.pid AND NOT bl.granted
JOIN pg_locks kl ON bl.locktype = kl.locktype
    AND bl.database IS NOT DISTINCT FROM kl.database
    AND bl.relation IS NOT DISTINCT FROM kl.relation
    AND bl.page IS NOT DISTINCT FROM kl.page
    AND bl.tuple IS NOT DISTINCT FROM kl.tuple
    AND bl.transactionid IS NOT DISTINCT FROM kl.transactionid
    AND bl.pid <> kl.pid
    AND kl.granted
JOIN pg_stat_activity blocking ON kl.pid = blocking.pid;
```

> **Why the interviewer asks this:** Deadlocks are inevitable in concurrent systems. The interviewer wants to see you can diagnose them (via logs/pg_locks) and prevent them (lock ordering, short transactions).

**Follow-up:** *What is a livelock and how is it different from a deadlock?*

---

## 3.8 MVCC (Multi-Version Concurrency Control)

### Question: How does PostgreSQL's MVCC work?

**Answer:**

MVCC allows **readers to never block writers and writers to never block readers** by maintaining multiple versions of each row.

```
Physical storage of a row in PostgreSQL:

┌────────┬────────┬──────┬──────┬───────────────────┐
│ xmin   │ xmax   │ ctid │ ...  │ actual row data   │
│ (100)  │ (105)  │      │      │ Alice, 80000      │
└────────┴────────┴──────┴──────┴───────────────────┘

xmin: Transaction ID that CREATED this row version
xmax: Transaction ID that DELETED/UPDATED this row version (0 = still alive)
```

**How UPDATE works in MVCC:**

```sql
-- Transaction 100: INSERT INTO employees VALUES ('Alice', 80000);
-- Row version 1: xmin=100, xmax=0, data=(Alice, 80000)

-- Transaction 105: UPDATE employees SET salary = 90000 WHERE name = 'Alice';
-- Row version 1: xmin=100, xmax=105 ← marked as "expired" by txn 105
-- Row version 2: xmin=105, xmax=0, data=(Alice, 90000) ← NEW version created

-- Both versions exist simultaneously on disk!
-- Which version a transaction "sees" depends on its snapshot
```

**Snapshot visibility rules:**

```
A row version is visible to transaction T if:
1. xmin is committed AND xmin < T's snapshot
2. AND (xmax is 0 OR xmax is not committed OR xmax > T's snapshot)

In simple terms:
- "Created before my snapshot" AND "Not deleted (or deleted after my snapshot)"
```

**Example with concurrent transactions:**

```sql
-- Transaction 200 (REPEATABLE READ) starts, takes snapshot
-- Transaction 201 starts

-- Transaction 201:
UPDATE employees SET salary = 90000 WHERE name = 'Alice';
COMMIT;

-- Transaction 200:
SELECT salary FROM employees WHERE name = 'Alice';
-- Still sees 80000! (old version, because 201 committed AFTER 200's snapshot)

-- New Transaction 202:
SELECT salary FROM employees WHERE name = 'Alice';
-- Sees 90000 (new version, because 201 is committed and visible to 202)
```

**MVCC consequences — VACUUM:**

```sql
-- Dead tuples (old row versions) accumulate over time
-- They waste space and slow down sequential scans

-- VACUUM reclaims space from dead tuples
VACUUM employees;          -- mark dead space as reusable (doesn't shrink file)
VACUUM FULL employees;     -- rewrites entire table (exclusive lock!)
VACUUM ANALYZE employees;  -- vacuum + update statistics

-- Autovacuum runs automatically but may need tuning:
ALTER TABLE high_churn_table SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- vacuum when 1% of rows are dead (default: 20%)
    autovacuum_analyze_scale_factor = 0.005
);
```

**MVCC bloat problem:**

```sql
-- Long-running transactions prevent VACUUM from cleaning old versions
-- Example: a 4-hour analytics query holds a snapshot from 4 hours ago
-- ALL row versions created in those 4 hours CANNOT be vacuumed

-- Check for long-running transactions:
SELECT pid, age(clock_timestamp(), xact_start) AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Monitor dead tuples:
SELECT
    relname,
    n_dead_tup,
    n_live_tup,
    ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup, 0) * 100, 2) AS dead_pct,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
```

> **Why the interviewer asks this:** MVCC is PostgreSQL's core concurrency mechanism. Understanding it explains why VACUUM exists, why long transactions are dangerous, and how isolation levels work under the hood.

**Follow-up:** *How does MySQL's InnoDB MVCC differ from PostgreSQL's?*

---

## 3.9 Stored Procedures, Triggers & Advanced DDL

### Question: When should you use stored procedures and triggers?

**Answer:**

#### Stored Procedures / Functions

```sql
-- Function: returns a value
CREATE OR REPLACE FUNCTION get_department_budget(p_dept_id INT)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(salary), 0)
    FROM employees
    WHERE dept_id = p_dept_id;
$$ LANGUAGE SQL STABLE;

-- Usage:
SELECT dept_name, get_department_budget(dept_id)
FROM departments;

-- Procedure: performs actions (can manage transactions)
CREATE OR REPLACE PROCEDURE transfer_funds(
    p_from INT, p_to INT, p_amount NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source account % not found', p_from;
    END IF;

    UPDATE accounts SET balance = balance + p_amount WHERE id = p_to;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account % not found', p_to;
    END IF;
END;
$$;

-- Call:
CALL transfer_funds(1, 2, 500.00);
```

#### Triggers

```sql
-- Audit trigger: automatically log all changes to employees table
CREATE TABLE employee_audit (
    audit_id    SERIAL PRIMARY KEY,
    emp_id      INT,
    action      VARCHAR(10),
    old_salary  NUMERIC(10, 2),
    new_salary  NUMERIC(10, 2),
    changed_at  TIMESTAMP DEFAULT NOW(),
    changed_by  VARCHAR(50) DEFAULT current_user
);

CREATE OR REPLACE FUNCTION log_salary_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.salary <> NEW.salary THEN
        INSERT INTO employee_audit (emp_id, action, old_salary, new_salary)
        VALUES (NEW.emp_id, 'UPDATE', OLD.salary, NEW.salary);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO employee_audit (emp_id, action, new_salary)
        VALUES (NEW.emp_id, 'INSERT', NEW.salary);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO employee_audit (emp_id, action, old_salary)
        VALUES (OLD.emp_id, 'DELETE', OLD.salary);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salary_audit
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION log_salary_change();
```

**When to use / not use:**

| Use | Avoid |
|---|---|
| Audit logging (triggers) | Complex business logic (harder to debug/test) |
| Enforcing complex constraints | Performance-critical hot paths |
| Maintaining derived data | When application logic is clearer |
| Encapsulating transaction logic | When portability across databases matters |

> **Why the interviewer asks this:** Triggers and stored procedures are powerful but controversial. Interviewers want to see you understand the trade-offs, not just the syntax.

**Follow-up:** *What are the performance implications of BEFORE vs AFTER triggers?*

---

## 3.10 Advanced Query Problems & Practice

### Problem 1: Find Employees in Top 10% Salary

```sql
SELECT emp_id, first_name, salary
FROM (
    SELECT
        emp_id, first_name, salary,
        PERCENT_RANK() OVER (ORDER BY salary DESC) AS pct_rank
    FROM employees
) ranked
WHERE pct_rank <= 0.10;
```

---

### Problem 2: Gaps and Islands — Find Consecutive Date Ranges

```sql
-- Given: employee_attendance(emp_id, attendance_date)
-- Find: consecutive attendance streaks per employee

WITH numbered AS (
    SELECT
        emp_id,
        attendance_date,
        attendance_date - (ROW_NUMBER() OVER (
            PARTITION BY emp_id ORDER BY attendance_date
        ))::INT AS island_id
    FROM employee_attendance
)
SELECT
    emp_id,
    MIN(attendance_date) AS streak_start,
    MAX(attendance_date) AS streak_end,
    COUNT(*) AS streak_days
FROM numbered
GROUP BY emp_id, island_id
HAVING COUNT(*) >= 5  -- streaks of 5+ days
ORDER BY emp_id, streak_start;
```

**How it works:**
```
attendance_date | row_number | date - row_number
2024-01-01      | 1          | 2023-12-31  ← same group
2024-01-02      | 2          | 2023-12-31  ← same group
2024-01-03      | 3          | 2023-12-31  ← same group
-- gap --
2024-01-10      | 4          | 2024-01-06  ← new group
2024-01-11      | 5          | 2024-01-06  ← same group
```

---

### Problem 3: Pivot Table / Crosstab

```sql
-- Question: Show monthly revenue by product category as columns

SELECT
    DATE_TRUNC('month', o.order_date) AS month,
    SUM(CASE WHEN p.category = 'Electronics' THEN oi.unit_price * oi.quantity ELSE 0 END) AS electronics,
    SUM(CASE WHEN p.category = 'Clothing' THEN oi.unit_price * oi.quantity ELSE 0 END) AS clothing,
    SUM(CASE WHEN p.category = 'Books' THEN oi.unit_price * oi.quantity ELSE 0 END) AS books,
    SUM(oi.unit_price * oi.quantity) AS total
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
GROUP BY DATE_TRUNC('month', o.order_date)
ORDER BY month;

-- Dynamic pivot with PostgreSQL's crosstab function (requires tablefunc extension):
CREATE EXTENSION IF NOT EXISTS tablefunc;

SELECT * FROM crosstab(
    'SELECT DATE_TRUNC(''month'', o.order_date)::DATE,
            p.category,
            SUM(oi.unit_price * oi.quantity)
     FROM orders o
     JOIN order_items oi ON o.order_id = oi.order_id
     JOIN products p ON oi.product_id = p.product_id
     GROUP BY 1, 2
     ORDER BY 1, 2',
    'SELECT DISTINCT category FROM products ORDER BY category'
) AS ct(month DATE, books NUMERIC, clothing NUMERIC, electronics NUMERIC);
```

---

### Problem 4: Recursive Hierarchy — Org Chart with Levels

```sql
WITH RECURSIVE org_chart AS (
    -- Root: employees with no manager (CEO)
    SELECT
        emp_id, first_name, manager_id,
        1 AS level,
        first_name::TEXT AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive: each employee's direct reports
    SELECT
        e.emp_id, e.first_name, e.manager_id,
        oc.level + 1,
        oc.path || ' → ' || e.first_name
    FROM employees e
    INNER JOIN org_chart oc ON e.manager_id = oc.emp_id
)
SELECT level, first_name, path
FROM org_chart
ORDER BY path;

-- Output:
-- level | first_name | path
-- 1     | Alice      | Alice
-- 2     | Bob        | Alice → Bob
-- 3     | Dave       | Alice → Bob → Dave
-- 2     | Carol      | Alice → Carol
```

---

### Problem 5: Output-Based — MVCC Visibility

```sql
-- Session 1 (REPEATABLE READ):
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM employees;  -- Returns: 100

-- Session 2:
INSERT INTO employees (first_name, last_name, salary) VALUES ('New', 'Person', 50000);
COMMIT;

-- Back in Session 1:
SELECT COUNT(*) FROM employees;  -- What does this return?
```

**Answer:** Still returns **100**. REPEATABLE READ uses a snapshot taken at the start of the transaction. Session 2's insert is not visible to Session 1's snapshot, even though it's committed.

---

### Problem 6: Debugging — Slow Query Analysis

```sql
-- This query takes 45 seconds on a table with 50M rows. Why?
SELECT *
FROM orders
WHERE EXTRACT(YEAR FROM order_date) = 2024
  AND status = 'delivered'
ORDER BY total DESC
LIMIT 10;

-- Issues:
-- 1. EXTRACT(YEAR FROM order_date) prevents index use on order_date
-- 2. SELECT * fetches all columns (prevents covering index)
-- 3. ORDER BY total DESC may require sorting all matching rows

-- Fixed version:
SELECT order_id, customer_id, order_date, total, status
FROM orders
WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'
  AND status = 'delivered'
ORDER BY total DESC
LIMIT 10;

-- With supporting index:
CREATE INDEX idx_orders_date_status_total
ON orders (order_date, status, total DESC)
WHERE status = 'delivered';  -- partial index for common filter
```

---

## Key Takeaways

| Topic | What to Remember |
|---|---|
| Execution plans | Read bottom-up and inside-out; watch for row estimate mismatches |
| Index types | B-tree (default), GIN (JSONB/FTS), BRIN (time-series), GiST (spatial) |
| Covering indexes | `INCLUDE` columns enable Index Only Scan — huge performance win |
| Partitioning | Partition pruning + easy data lifecycle management |
| Sharding | Cross-shard queries are expensive; choose shard key carefully |
| Locks | Consistent lock ordering prevents deadlocks; `SKIP LOCKED` for queues |
| Isolation levels | READ COMMITTED is default; SERIALIZABLE needs retry logic |
| MVCC | Old row versions accumulate → VACUUM is essential |
| Deadlocks | PostgreSQL detects them automatically; prevent with lock ordering |

---

**Previous:** [← Part 2 — Intermediate SQL](./02-intermediate-sql.md)
**Next:** [Part 4 — NoSQL & Modern Databases →](./04-nosql.md)
