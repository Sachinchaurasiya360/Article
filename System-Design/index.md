# System Design - A Developer's Deep Dive

**12 Parts** | From first principles to production distributed systems

A ground-up deep dive into system design: how to reason about scale, latency, and failure, then build the core pillars — load balancing, databases, sharding, caching, consistency, messaging, APIs, reliability, and observability — before putting them together in real case studies. Written in the same "from scratch to production" style as the Redis and Kafka deep dives.

## Reading Order

| Part | Title |
|------|-------|
| 0 | [The Foundation — Thinking in Systems, Estimation, and Trade-offs](system-design-deep-dive-part-0.md) |
| 1 | [Scaling — Vertical, Horizontal, and Load Balancing](system-design-deep-dive-part-1.md) |
| 2 | [Databases and Data Modeling — SQL vs NoSQL](system-design-deep-dive-part-2.md) |
| 3 | [Replication and Sharding — Scaling the Data Layer](system-design-deep-dive-part-3.md) |
| 4 | [Caching and CDNs — Serving Data Fast](system-design-deep-dive-part-4.md) |
| 5 | [Consistency, CAP/PACELC, and Consensus](system-design-deep-dive-part-5.md) |
| 6 | [Messaging and Event-Driven Architecture](system-design-deep-dive-part-6.md) |
| 7 | [API Design — REST, gRPC, GraphQL, and Gateways](system-design-deep-dive-part-7.md) |
| 8 | [Reliability and Fault Tolerance](system-design-deep-dive-part-8.md) |
| 9 | [Observability and Operations — SLOs, Metrics, Tracing](system-design-deep-dive-part-9.md) |
| 10 | [Monolith vs Microservices and the Service Mesh](system-design-deep-dive-part-10.md) |
| 11 | [Case Studies — URL Shortener, News Feed, Chat System](system-design-deep-dive-part-11.md) |

## Who This Is For

- Engineers with 1-5 years of experience who can build a feature but freeze when asked "how would this handle 10 million users?"
- Backend and full-stack developers preparing for system design interviews
- Anyone who has used load balancers, caches, and message queues without understanding the trade-offs underneath them

## How to Read This Series

Parts 0-1 build the mental model. Parts 2-9 go pillar by pillar — each one is a lever you pull to trade cost, latency, consistency, and complexity against each other. Part 10 is about organizing those pillars into services. Part 11 puts everything together on the classic interview problems.

You can read pillars (2-9) somewhat out of order, but read Part 0 first — every later part assumes its vocabulary of latency, throughput, and trade-offs.
