# SQL + Database Interview Preparation Guide

> A complete, structured interview preparation resource covering SQL fundamentals through production-level system design. Designed for software engineers preparing for backend, full-stack, and database-focused roles.

---

## Structure

This guide is organized into **5 progressive sections**, from beginner to advanced:

| # | Section | Level | Topics |
|---|---|---|---|
| 1 | [SQL Fundamentals](./01-sql-fundamentals.md) | Beginner | SELECT, JOINs, WHERE, GROUP BY, Constraints |
| 2 | [Intermediate SQL & Query Optimization](./02-intermediate-sql.md) | Intermediate | Subqueries, Window Functions, Indexing, Normalization, ACID |
| 3 | [Advanced SQL & Database Internals](./03-advanced-sql.md) | Advanced | Execution Plans, Index Internals, Partitioning, Locks, MVCC |
| 4 | [NoSQL & Modern Databases](./04-nosql.md) | Advanced | MongoDB, Redis, Cassandra, CAP Theorem, NewSQL |
| 5 | [System Design & Real-world Scenarios](./05-system-design.md) | Expert | Scaling, Replication, Caching, E-commerce/Chat/Analytics Design |

---

## What's Covered

### Question Types
- Conceptual questions with detailed explanations
- SQL query problems with step-by-step solutions
- Debugging exercises (find the bug in this query)
- Output-based questions (what does this query return?)
- Real-world design scenarios (design the DB for X)

### For Each Question
- Detailed, interview-level answer
- "Why the interviewer asks this" - understand the intent
- Follow-up question - prepare for the next level

### SQL Syntax
- PostgreSQL-style syntax throughout
- Real queries on realistic schemas
- Performance considerations with every answer

---

## How to Use This Guide

**If you have 1 week:** Read all 5 parts sequentially, focus on the practice problems.

**If you have 3 days:** Start with Parts 1-2 for fundamentals, then jump to Part 5 for system design.

**If you have 1 day:** Read the Key Takeaways table at the end of each part, practice the query problems.

**For specific roles:**
- Backend Engineer → Parts 1, 2, 3, 5
- Full-Stack Engineer → Parts 1, 2, 4
- Data Engineer → Parts 2, 3, 5
- Database Administrator → Parts 2, 3 (deep), 5
- System Design interviews → Parts 4, 5

---

## Topic Map

```
Part 1: SQL Fundamentals
├── Databases & RDBMS
├── SELECT, INSERT, UPDATE, DELETE
├── WHERE, ORDER BY, GROUP BY, HAVING
├── JOINs (INNER, LEFT, RIGHT, FULL, CROSS, SELF)
├── Constraints (PK, FK, UNIQUE, CHECK, NOT NULL)
└── 7 Practice Problems

Part 2: Intermediate SQL
├── Subqueries (Scalar, Correlated, EXISTS vs IN)
├── CTEs (Common Table Expressions, Recursive CTEs)
├── Window Functions (RANK, ROW_NUMBER, LAG, LEAD, NTILE)
├── Indexing Basics (B-tree, Composite, When to Index)
├── Query Optimization (EXPLAIN, N+1, Function Traps)
├── Normalization (1NF → BCNF)
├── Transactions & ACID
├── Views & Materialized Views
└── 7 Practice Problems

Part 3: Advanced SQL & Internals
├── Query Execution Plans (Deep Dive)
├── Index Types (B-tree, Hash, GIN, GiST, BRIN)
├── Covering Indexes & Index Only Scans
├── Table Partitioning (Range, List, Hash)
├── Sharding Strategies
├── Locks & Concurrency (Pessimistic vs Optimistic)
├── Transaction Isolation Levels
├── Deadlocks (Detection, Prevention)
├── MVCC & VACUUM
├── Stored Procedures & Triggers
└── 6 Practice Problems

Part 4: NoSQL & Modern Databases
├── NoSQL Types (Key-Value, Document, Column-Family, Graph)
├── SQL vs NoSQL Decision Framework
├── MongoDB (Data Model, MQL, Aggregation, Indexing)
├── Redis (Data Structures, Caching Patterns)
├── DynamoDB (Single-Table Design)
├── Cassandra (Architecture, CQL, Consistency Levels)
├── Neo4j (Graph Queries, Use Cases)
├── Denormalization Strategies
├── CAP Theorem & PACELC
├── NewSQL (CockroachDB, Spanner, TiDB)
└── 5 Practice Problems

Part 5: System Design
├── Scaling Progression (1K → 100M users)
├── Read vs Write Optimization & CQRS
├── Replication (Sync, Async, Multi-Primary, Failover)
├── Caching Strategies (Stampede, Penetration, Hot Key)
├── Consistency Patterns (2PC, Saga, CDC, Outbox)
├── Handling Large Datasets (Partitioning, Archival, Compression)
├── Scenario: E-commerce Platform
├── Scenario: Analytics Pipeline
├── Scenario: Chat Application
├── Production Debugging Playbook
└── 5 System Design Problems
```

---

## Quick Reference

### SQL Execution Order
```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

### Index Decision Cheat Sheet
```
B-tree  → Default. Equality + range queries.
GIN     → JSONB, arrays, full-text search.
GiST    → Spatial/geographic, range overlaps.
BRIN    → Time-series, append-only tables (tiny size).
Hash    → Equality only (rarely needed).
```

### Database Selection Cheat Sheet
```
Need ACID + complex queries?        → PostgreSQL
Flexible schema, document-oriented? → MongoDB
Sub-ms key-value lookups / cache?   → Redis
Massive writes, time-series?        → Cassandra / TimescaleDB
Relationship traversal?             → Neo4j
Real-time analytics?                → ClickHouse
ACID + horizontal scale?            → CockroachDB / Spanner
```

---

*Built for engineers who want depth, not surface-level answers.*
