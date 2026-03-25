# System Design & Real-world Backend Architecture — Interview Preparation (Part 7/7)

> **Series:** Python + FastAPI Interview Prep
> **Level:** System Design & Architecture
> **Topics:** Scalable Services, Microservices, Load Balancing, API Gateway, Observability, Deployment, CI/CD
> **Total Questions:** 28

---

## Table of Contents

| #  | Section                                | Questions   |
|----|----------------------------------------|-------------|
| 1  | [Designing Scalable FastAPI Services](#section-1-designing-scalable-fastapi-services) | Q1 -- Q4   |
| 2  | [Microservices vs Monolith](#section-2-microservices-vs-monolith) | Q5 -- Q8   |
| 3  | [Load Balancing](#section-3-load-balancing) | Q9 -- Q12  |
| 4  | [API Gateway](#section-4-api-gateway)  | Q13 -- Q16 |
| 5  | [Observability](#section-5-observability) | Q17 -- Q20 |
| 6  | [Deployment](#section-6-deployment)    | Q21 -- Q24 |
| 7  | [CI/CD Strategies](#section-7-cicd-strategies) | Q25 -- Q28 |

---

## Section 1: Designing Scalable FastAPI Services

### Q1: How do you decide between horizontal and vertical scaling for a FastAPI application? What architectural changes does each require?

**Answer:**

| Aspect | Vertical Scaling (Scale Up) | Horizontal Scaling (Scale Out) |
|--------|---------------------------|-------------------------------|
| **What** | Bigger machine (more CPU/RAM) | More machines running copies |
| **Limit** | Hardware ceiling | Nearly unlimited |
| **Downtime** | Usually requires restart | Zero-downtime possible |
| **Cost curve** | Exponential | Linear |
| **State** | Can keep in-memory state | Must externalize state |
| **Complexity** | Low | Higher (LB, service discovery) |

**Architectural changes for horizontal scaling:**

```
                    ┌──────────────┐
                    │  Load        │
    Clients ──────► │  Balancer    │
                    └──────┬───────┘
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
            ┌────────┐ ┌────────┐ ┌────────┐
            │ App #1 │ │ App #2 │ │ App #3 │
            └───┬────┘ └───┬────┘ └───┬────┘
                │          │          │
         ┌──────┴──────────┴──────────┴──────┐
         │       Shared State Layer           │
         │  (Redis, PostgreSQL, S3)           │
         └────────────────────────────────────┘
```

**Key rules for horizontal readiness:**
- **No local file storage** — use S3/GCS for uploads
- **No in-process sessions** — use Redis for session/cache
- **No in-memory job queues** — use Celery + RabbitMQ/Redis
- **Database connection pooling** — use pgBouncer or SQLAlchemy pool limits

```python
# Horizontally-scalable FastAPI setup
from fastapi import FastAPI
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

app = FastAPI()

# Externalized cache — shared across all instances
redis = Redis(host="redis-cluster", port=6379, decode_responses=True)

# Connection-pooled DB — bounded per instance
engine = create_async_engine(
    "postgresql+asyncpg://user:pass@pgbouncer:6432/mydb",
    pool_size=5,         # per instance
    max_overflow=10,
)

@app.get("/items/{item_id}")
async def get_item(item_id: int):
    # Check shared cache first
    cached = await redis.get(f"item:{item_id}")
    if cached:
        return {"item": cached, "source": "cache"}
    # Fall through to DB
    async with async_sessionmaker(engine)() as session:
        result = await session.get(Item, item_id)
        await redis.setex(f"item:{item_id}", 300, result.json())
        return {"item": result, "source": "db"}
```

> **Why interviewer asks this:** They want to know if you understand the trade-offs and, more importantly, the *code-level changes* needed before you can horizontally scale. Many devs say "just add more servers" without considering stateful components.

**Follow-up:** How would you handle WebSocket connections across multiple horizontally-scaled instances? (Hint: Redis Pub/Sub or a shared message broker for cross-instance broadcasting.)

---

### Q2: What does "stateless design" mean for a FastAPI service, and how do you achieve it in practice?

**Answer:**

**Stateless** = any instance can handle any request without relying on data from a previous request stored in that instance's memory.

**Checklist to make a FastAPI service stateless:**

| Concern | Stateful (Bad) | Stateless (Good) |
|---------|---------------|------------------|
| Auth | Server-side session dict | JWT tokens (client holds state) |
| Cache | `dict` in process memory | Redis / Memcached |
| File uploads | Local `/tmp` | S3 / GCS presigned URLs |
| Rate limiting | In-memory counter | Redis sliding window |
| Background jobs | `asyncio.create_task` | Celery + broker |
| Config | Hardcoded / local file | Env vars / config service |

```python
# BAD — stateful: in-memory rate limiter breaks with multiple instances
request_counts = {}  # dies when process restarts, not shared

# GOOD — stateless: Redis-backed rate limiter
from redis.asyncio import Redis

redis = Redis(host="redis")

async def check_rate_limit(client_ip: str) -> bool:
    key = f"rate:{client_ip}"
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, 60)
    return current <= 100  # 100 req/min
```

> **Why interviewer asks this:** Stateless services are the foundation of cloud-native design. If your service is stateful, autoscaling and rolling deployments break silently.

**Follow-up:** How would you migrate an existing stateful FastAPI app to stateless without downtime?

---

### Q3: How does FastAPI's async architecture help at scale, and when can it actually hurt performance?

**Answer:**

**How async helps:**
- A single process handles thousands of concurrent I/O-bound requests (DB queries, HTTP calls, file reads)
- No thread-per-request overhead — uses Python's event loop with `uvicorn` (uvloop)
- Perfect for high-concurrency, I/O-heavy workloads (APIs, proxies, chat servers)

**When async hurts:**
- **CPU-bound work** (image processing, ML inference, heavy computation) blocks the event loop
- A single blocking call stalls ALL concurrent requests on that worker

```python
import asyncio
import time
from fastapi import FastAPI

app = FastAPI()

# BAD — blocks the event loop for ALL requests
@app.get("/bad-cpu")
async def bad_cpu_task():
    time.sleep(5)  # Blocks entire worker!
    return {"result": "done"}

# GOOD — offload CPU work to thread pool
@app.get("/good-cpu")
async def good_cpu_task():
    result = await asyncio.to_thread(cpu_heavy_function, data)
    return {"result": result}

# ALSO GOOD — use sync def (FastAPI auto-runs in threadpool)
@app.get("/also-good")
def sync_cpu_task():  # no async = auto-threadpool
    time.sleep(5)
    return {"result": "done"}

# BEST for heavy CPU — dedicated worker process
# Use Celery or a process pool
from concurrent.futures import ProcessPoolExecutor

pool = ProcessPoolExecutor(max_workers=4)

@app.get("/best-cpu")
async def best_cpu_task():
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(pool, cpu_heavy_function, data)
    return {"result": result}
```

**Scaling strategy by workload type:**

```
I/O-bound  →  More async workers (uvicorn --workers 4)
CPU-bound  →  Process pool / Celery workers / separate service
Mixed      →  Async API + offload CPU to background workers
```

> **Why interviewer asks this:** Many developers blindly use `async` everywhere. Interviewers want to see you understand the event loop and know when async is counterproductive.

**Follow-up:** What happens if you `await` a synchronous database driver (like `psycopg2`) inside an `async def` endpoint?

---

### Q4: How do you manage database connection pools in a FastAPI app running across multiple instances?

**Answer:**

**The problem:** Each FastAPI worker opens its own connection pool. With N instances x W workers x P pool_size, you can exhaust the database's `max_connections`.

```
3 instances × 4 workers × 20 pool_size = 240 connections
PostgreSQL default max_connections = 100  ← BOOM
```

**Solution architecture:**

```
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ FastAPI  │  │ FastAPI  │  │ FastAPI  │
  │ pool=5   │  │ pool=5   │  │ pool=5   │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
              ┌───────────────┐
              │   PgBouncer   │  ← connection pooler
              │  pool_size=50 │
              └───────┬───────┘
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              │ max_conn=100  │
              └───────────────┘
```

```python
# settings.py — calculate pool size safely
import os

TOTAL_INSTANCES = int(os.getenv("TOTAL_INSTANCES", "3"))
WORKERS_PER_INSTANCE = int(os.getenv("WORKERS", "4"))
DB_MAX_CONNECTIONS = int(os.getenv("DB_MAX_CONN", "100"))

# Reserve 20% for admin/migrations
USABLE_CONNECTIONS = int(DB_MAX_CONNECTIONS * 0.8)
POOL_SIZE = max(1, USABLE_CONNECTIONS // (TOTAL_INSTANCES * WORKERS_PER_INSTANCE))

# config.py
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@pgbouncer:6432/mydb",
    pool_size=POOL_SIZE,
    max_overflow=2,
    pool_timeout=30,
    pool_recycle=1800,     # recycle connections every 30 min
    pool_pre_ping=True,    # verify connection is alive before use
)
```

**Debugging: "too many connections" in production**
1. Check current connections: `SELECT count(*) FROM pg_stat_activity;`
2. Identify culprits: `SELECT usename, client_addr, count(*) FROM pg_stat_activity GROUP BY 1,2;`
3. Add PgBouncer if not present
4. Reduce `pool_size` per worker, increase `max_overflow` for burst

> **Why interviewer asks this:** Connection exhaustion is one of the most common production outages. Interviewers want to know you've dealt with real scaling pain.

**Follow-up:** What's the difference between PgBouncer's `session`, `transaction`, and `statement` pooling modes, and which works best with async SQLAlchemy?

---

## Section 2: Microservices vs Monolith

### Q5: When would you choose a monolith over microservices for a FastAPI project? Walk through the decision framework.

**Answer:**

**Decision matrix:**

| Factor | Monolith Wins | Microservices Win |
|--------|--------------|-------------------|
| Team size | < 10 devs | Multiple autonomous teams |
| Domain complexity | Single bounded context | Multiple clear domains |
| Deployment frequency | Same release cycle | Independent release needs |
| Scaling needs | Uniform load | Hotspot services need independent scaling |
| Data model | Shared DB is fine | Services need data isolation |
| Latency budget | Tight (no network hops) | Tolerant of inter-service calls |
| Timeline | MVP / startup | Mature product with known boundaries |

**The Modular Monolith — best of both worlds for many teams:**

```
project/
├── app/
│   ├── main.py              # Single FastAPI app
│   ├── modules/
│   │   ├── users/           # Bounded context
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   ├── orders/          # Bounded context
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   └── payments/        # Bounded context
│   └── shared/
│       ├── database.py
│       └── auth.py
```

```python
# main.py — modular monolith
from fastapi import FastAPI
from app.modules.users.router import router as users_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router

app = FastAPI(title="Modular Monolith")
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(orders_router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(payments_router, prefix="/api/v1/payments", tags=["payments"])

# Key rule: modules communicate via service interfaces, NOT direct DB access
# orders/service.py calls users/service.get_user(), never queries users table directly
```

> **Why interviewer asks this:** The "microservices by default" trend has caused many project failures. Interviewers want to see pragmatic judgment, not hype-driven architecture.

**Follow-up:** How would you extract the `payments` module into a separate microservice when it becomes a bottleneck? What changes to the interface?

---

### Q6: Compare REST, gRPC, and message queues for inter-service communication. When do you use each?

**Answer:**

| Aspect | REST (HTTP/JSON) | gRPC (HTTP/2 + Protobuf) | Message Queue (RabbitMQ/Kafka) |
|--------|-----------------|--------------------------|-------------------------------|
| **Pattern** | Request-response | Request-response + streaming | Async, fire-and-forget / pub-sub |
| **Latency** | Higher (JSON parse) | Low (binary, multiplexed) | Variable (queue depth) |
| **Coupling** | Moderate | Tight (shared .proto) | Loose |
| **Best for** | Public APIs, CRUD | Internal high-throughput | Event-driven, decoupled workflows |
| **Schema** | OpenAPI (optional) | Protobuf (required) | Varies (Avro, JSON Schema) |
| **Debugging** | Easy (curl, browser) | Harder (need grpcurl) | Harder (invisible messages) |

**Decision rule of thumb:**
- **Synchronous + need response now** → REST or gRPC
- **Internal + high throughput + strong typing** → gRPC
- **Don't need immediate response + reliability matters** → Message queue
- **Fan-out to multiple consumers** → Message queue (pub/sub)

```python
# REST — calling another service
import httpx

async def get_user_from_service(user_id: int):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"http://user-service:8000/api/v1/users/{user_id}",
            timeout=5.0
        )
        resp.raise_for_status()
        return resp.json()

# Message Queue — publishing an event (RabbitMQ via aio-pika)
import aio_pika, json

async def publish_order_created(order: dict):
    connection = await aio_pika.connect_robust("amqp://rabbitmq:5672")
    async with connection:
        channel = await connection.channel()
        await channel.default_exchange.publish(
            aio_pika.Message(body=json.dumps(order).encode()),
            routing_key="order.created",
        )
```

```
Sync path (REST/gRPC):
  Client → API Gateway → Order Service ──REST──► User Service
                                        └──────► Response

Async path (Message Queue):
  Client → API Gateway → Order Service ──publish──► RabbitMQ
                              │                        │
                              ▼                        ▼
                         "order accepted"     Email Service picks up
                                              Inventory Service picks up
```

> **Why interviewer asks this:** Real systems use a mix of all three. They want to see you pick the right tool per use case, not default to one pattern.

**Follow-up:** How do you handle a scenario where gRPC is used internally but the client-facing API must be REST? (Hint: API gateway with protocol translation.)

---

### Q7: How do you maintain data consistency across microservices without distributed transactions?

**Answer:**

**The Saga Pattern — choreography vs orchestration:**

```
Choreography (event-driven):

  Order Service          Payment Service        Inventory Service
       │                       │                       │
       │──order.created──►     │                       │
       │                       │──payment.charged──►   │
       │                       │                       │──inventory.reserved──►
       │◄──────────────────────────────────────────────│ (all done)
       │                                               │
  On failure: each service listens for failure events and compensates

Orchestration (central coordinator):

                    ┌──────────────┐
                    │    Saga      │
                    │ Orchestrator │
                    └──────┬───────┘
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
            Create     Charge     Reserve
            Order      Payment    Inventory
                 │         │         │
            On fail:   Refund     Unreserve
```

```python
# Saga orchestrator pattern in FastAPI
from enum import Enum
from dataclasses import dataclass

class SagaStep(Enum):
    CREATE_ORDER = "create_order"
    CHARGE_PAYMENT = "charge_payment"
    RESERVE_INVENTORY = "reserve_inventory"

@dataclass
class SagaState:
    order_id: str
    current_step: SagaStep
    completed_steps: list
    failed: bool = False

async def execute_saga(order_data: dict):
    state = SagaState(order_id=order_data["id"], current_step=SagaStep.CREATE_ORDER, completed_steps=[])

    steps = [
        (SagaStep.CREATE_ORDER, create_order, cancel_order),
        (SagaStep.CHARGE_PAYMENT, charge_payment, refund_payment),
        (SagaStep.RESERVE_INVENTORY, reserve_inventory, release_inventory),
    ]

    for step, execute_fn, compensate_fn in steps:
        state.current_step = step
        try:
            await execute_fn(order_data)
            state.completed_steps.append((step, compensate_fn))
        except Exception:
            state.failed = True
            # Compensate in reverse order
            for completed_step, comp_fn in reversed(state.completed_steps):
                await comp_fn(order_data)
            raise

    return state
```

**Eventual consistency strategies:**

| Strategy | Use When | Guarantee |
|----------|----------|-----------|
| Saga (choreography) | Simple flows, few services | Eventual consistency |
| Saga (orchestration) | Complex flows, need visibility | Eventual consistency |
| Outbox pattern | Need reliable event publishing | At-least-once delivery |
| CDC (Change Data Capture) | Stream DB changes to Kafka | Eventual consistency |

> **Why interviewer asks this:** Distributed transactions (2PC) don't scale. Interviewers want to see you handle the hard reality of eventual consistency and know compensation patterns.

**Follow-up:** How does the Outbox pattern work, and why is it preferred over publishing events directly after a DB commit?

---

### Q8: You're debugging a production issue where an order is created but the inventory is never reserved. How do you diagnose and fix this in a microservice architecture?

**Answer:**

**Systematic debugging approach:**

```
1. CHECK LOGS (correlation ID)
   ──► Order Service: "order.created event published" ✓
   ──► Message Broker: Is message in queue or dead-letter?
   ──► Inventory Service: Any consumer errors?

2. TRACE THE REQUEST (distributed tracing)
   ──► OpenTelemetry trace shows:
       order-service (200ms) → rabbitmq publish (5ms) → ??? (no span from inventory)

3. CHECK INFRASTRUCTURE
   ──► Is inventory-service consumer running? (k8s pod status)
   ──► Is the queue bound correctly? (RabbitMQ management UI)
   ──► Any network policies blocking communication?
```

**Common root causes and fixes:**

| Cause | Symptom | Fix |
|-------|---------|-----|
| Consumer crashed | No logs after publish | Fix crash, add dead-letter queue for retry |
| Queue binding wrong | Message in exchange, not queue | Fix routing key / binding |
| Message serialization mismatch | Deserialization error in consumer | Align schemas, add schema registry |
| Consumer ACK before processing | Message lost on crash | ACK *after* successful processing |
| Network partition | Intermittent failures | Add retry with exponential backoff |

```python
# Resilient consumer pattern
import aio_pika
import json
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def process_order_event(message: aio_pika.IncomingMessage):
    async with message.process(requeue=True):  # requeue on failure
        data = json.loads(message.body)
        try:
            await reserve_inventory(data["order_id"], data["items"])
            # ACK happens automatically when exiting context manager
        except Exception as e:
            logger.error(f"Failed to reserve inventory: {e}",
                        extra={"order_id": data["order_id"]})
            raise  # triggers requeue
```

> **Why interviewer asks this:** Debugging distributed systems is fundamentally harder than monoliths. This tests your systematic thinking and knowledge of observability tooling.

**Follow-up:** How would you set up a dead-letter queue to capture permanently failed messages for manual review?

---

## Section 3: Load Balancing

### Q9: Explain the key load balancing algorithms and when to use each.

**Answer:**

| Algorithm | How It Works | Best For | Weakness |
|-----------|-------------|----------|----------|
| **Round Robin** | Sequential rotation | Uniform instances, stateless | Ignores server load |
| **Weighted Round Robin** | Rotation with weight bias | Mixed-capacity servers | Static weights |
| **Least Connections** | Routes to least-busy server | Varying request durations | Overhead tracking connections |
| **IP Hash** | Hash client IP → fixed server | Session affinity needed | Uneven distribution |
| **Random** | Random server selection | Simple, surprisingly effective | Slightly less uniform |
| **Least Response Time** | Fastest server gets request | Performance-critical | Requires health monitoring |

```
Round Robin:              Least Connections:
  → Server A (req 1)       Server A: 12 conn
  → Server B (req 2)       Server B:  3 conn ← next request goes here
  → Server C (req 3)       Server C:  8 conn
  → Server A (req 4)

IP Hash:
  Client 1.2.3.4  → hash("1.2.3.4") % 3 = 1 → Server B (always)
  Client 5.6.7.8  → hash("5.6.7.8") % 3 = 0 → Server A (always)
```

**Nginx configuration examples:**

```nginx
# Round Robin (default)
upstream fastapi {
    server app1:8000;
    server app2:8000;
    server app3:8000;
}

# Weighted Round Robin
upstream fastapi_weighted {
    server app1:8000 weight=5;  # gets 5x traffic
    server app2:8000 weight=3;
    server app3:8000 weight=1;
}

# Least Connections
upstream fastapi_least {
    least_conn;
    server app1:8000;
    server app2:8000;
}

# IP Hash (sticky sessions)
upstream fastapi_sticky {
    ip_hash;
    server app1:8000;
    server app2:8000;
}
```

> **Why interviewer asks this:** Algorithm choice directly impacts user experience and resource utilization. Wrong choice causes hotspots or session loss.

**Follow-up:** If you have a mix of fast endpoints (10ms) and slow endpoints (5s), which algorithm prevents slow requests from overwhelming a single server?

---

### Q10: What's the difference between L4 and L7 load balancing, and which should you use for a FastAPI application?

**Answer:**

```
OSI Layer Reference:
  L7 ─ Application  (HTTP, gRPC, WebSocket)
  L6 ─ Presentation
  L5 ─ Session
  L4 ─ Transport    (TCP, UDP)
  L3 ─ Network      (IP)
```

| Feature | L4 (Transport) | L7 (Application) |
|---------|----------------|-------------------|
| **Inspects** | IP + port + TCP flags | Full HTTP (URL, headers, cookies, body) |
| **Speed** | Faster (no parsing) | Slower (parses HTTP) |
| **Routing** | Port-based only | URL path, header, cookie-based |
| **SSL termination** | Passthrough or terminate | Terminate + inspect |
| **WebSocket** | Works (TCP passthrough) | Works (upgrade-aware) |
| **Tools** | HAProxy (TCP mode), NLB | Nginx, HAProxy (HTTP mode), ALB, Traefik |

**When to use which for FastAPI:**

```
L4 (use when):
  - Raw TCP throughput matters (gRPC, WebSocket heavy)
  - End-to-end encryption (TLS passthrough)
  - Simple port-based routing

L7 (use when — MOST FastAPI apps):
  - Route /api/v1/* → service A, /api/v2/* → service B
  - Need header-based routing (A/B testing, canary)
  - Want to add/modify headers (X-Request-ID)
  - SSL termination at LB
  - Rate limiting at LB level
```

```nginx
# L7 load balancer — content-based routing
server {
    listen 443 ssl;

    # Route by URL path
    location /api/users {
        proxy_pass http://user-service;
    }
    location /api/orders {
        proxy_pass http://order-service;
    }

    # Route by header (canary deployment)
    location /api/ {
        if ($http_x_canary = "true") {
            proxy_pass http://canary-backend;
        }
        proxy_pass http://stable-backend;
    }
}
```

> **Why interviewer asks this:** Choosing the wrong layer wastes resources or limits capability. Most API workloads need L7, but knowing when L4 is better shows depth.

**Follow-up:** How does WebSocket load balancing differ from regular HTTP, and what problems arise with L7 balancers and long-lived connections?

---

### Q11: How do you configure health checks for a FastAPI app behind a load balancer?

**Answer:**

**Three types of health checks:**

| Type | Purpose | Endpoint | Checks |
|------|---------|----------|--------|
| **Liveness** | "Is the process alive?" | `/health/live` | Process responding |
| **Readiness** | "Can it serve traffic?" | `/health/ready` | DB, Redis, dependencies reachable |
| **Startup** | "Has it finished initializing?" | `/health/startup` | Migrations done, caches warm |

```python
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
import asyncpg
from redis.asyncio import Redis

app = FastAPI()
redis = Redis(host="redis")

@app.get("/health/live")
async def liveness():
    """Always returns 200 if the process is running."""
    return {"status": "alive"}

@app.get("/health/ready")
async def readiness():
    """Checks all dependencies. LB uses this to route traffic."""
    checks = {}

    # Check database
    try:
        conn = await asyncpg.connect("postgresql://user:pass@db:5432/mydb")
        await conn.fetchval("SELECT 1")
        await conn.close()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"fail: {e}"

    # Check Redis
    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"fail: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ready" if all_ok else "not_ready", "checks": checks},
    )
```

**Nginx health check config:**

```nginx
upstream fastapi {
    server app1:8000;
    server app2:8000;

    # Active health checks (Nginx Plus / OpenResty)
    health_check interval=5s fails=3 passes=2 uri=/health/ready;
}

# Passive health checks (open-source Nginx)
upstream fastapi_passive {
    server app1:8000 max_fails=3 fail_timeout=30s;
    server app2:8000 max_fails=3 fail_timeout=30s;
}
```

> **Why interviewer asks this:** Improper health checks cause cascading failures — e.g., a readiness check that's too strict removes all instances during a DB blip.

**Follow-up:** What happens if your readiness check queries the database and the DB is slow? How do you prevent the health check itself from causing problems?

---

### Q12: A production deployment has sticky sessions enabled, but users report intermittent 502 errors after a rolling deployment. What's happening?

**Answer:**

**Root cause analysis:**

```
Before deployment:
  Client A ──(cookie: srv=app1)──► app1 ✓  (sticky session)
  Client B ──(cookie: srv=app2)──► app2 ✓

During rolling deployment (app1 replaced):
  Client A ──(cookie: srv=app1)──► app1 ✗  (app1 is gone!)
                                     │
                                     └──► 502 Bad Gateway
```

**The problem:** Sticky sessions bind clients to specific instances via cookies or IP hash. When an instance is removed during deployment, all its sticky clients get errors.

**Solutions (pick based on requirements):**

```
1. ELIMINATE STICKINESS (best solution)
   ──► Externalize session to Redis
   ──► Any instance can serve any client
   ──► Rolling deployment = zero errors

2. GRACEFUL DRAIN (if stickiness required)
   ──► Mark instance as "draining" — stop new sessions
   ──► Existing sessions continue until timeout
   ──► Then remove instance

3. LB FALLBACK (quick fix)
   ──► Configure LB to fall back to another server
       when sticky target is unavailable
```

```nginx
# Nginx: sticky with fallback
upstream fastapi {
    ip_hash;
    server app1:8000;
    server app2:8000;
    server app3:8000;
}

server {
    location / {
        proxy_pass http://fastapi;
        proxy_next_upstream error timeout http_502;  # try next on 502
        proxy_next_upstream_tries 2;
    }
}
```

```yaml
# Kubernetes: graceful drain during rolling update
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0      # never remove before new is ready
  template:
    spec:
      terminationGracePeriodSeconds: 60  # time to drain connections
      containers:
        - name: app
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "15"]  # let LB deregister first
```

> **Why interviewer asks this:** This is a very common production issue. It tests understanding of the interaction between session management, load balancing, and deployment strategies.

**Follow-up:** How does Kubernetes handle connection draining during pod termination, and what's the role of `preStop` hooks?

---

## Section 4: API Gateway

### Q13: What role does an API gateway play, and how would you set up Kong or Traefik for a FastAPI microservices architecture?

**Answer:**

**API Gateway responsibilities:**

```
                         ┌─────────────────────────┐
  Clients ──────────────►│      API Gateway         │
                         │  ┌───────────────────┐   │
                         │  │ Rate Limiting      │   │
                         │  │ Authentication     │   │
                         │  │ Request Routing    │   │
                         │  │ SSL Termination    │   │
                         │  │ Response Caching   │   │
                         │  │ Circuit Breaking   │   │
                         │  │ Request Transform  │   │
                         │  │ Logging/Metrics    │   │
                         │  └───────────────────┘   │
                         └──────────┬────────────────┘
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              User Service    Order Service   Payment Service
```

**Traefik with Docker Compose (common for FastAPI):**

```yaml
# docker-compose.yml
version: "3.8"
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  user-service:
    build: ./user-service
    labels:
      - "traefik.http.routers.users.rule=PathPrefix(`/api/users`)"
      - "traefik.http.services.users.loadbalancer.server.port=8000"
      - "traefik.http.routers.users.middlewares=rate-limit"
      - "traefik.http.middlewares.rate-limit.ratelimit.average=100"
      - "traefik.http.middlewares.rate-limit.ratelimit.burst=50"

  order-service:
    build: ./order-service
    labels:
      - "traefik.http.routers.orders.rule=PathPrefix(`/api/orders`)"
      - "traefik.http.services.orders.loadbalancer.server.port=8000"
```

**Kong with declarative config:**

```yaml
# kong.yml
_format_version: "3.0"
services:
  - name: user-service
    url: http://user-service:8000
    routes:
      - name: user-route
        paths: ["/api/users"]
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: redis
          redis_host: redis
      - name: jwt
      - name: cors
```

> **Why interviewer asks this:** API gateways are standard in production architectures. Interviewers want to see practical config knowledge, not just theoretical understanding.

**Follow-up:** What are the trade-offs between a dedicated API gateway (Kong) vs using your cloud provider's managed gateway (AWS API Gateway)?

---

### Q14: How do you implement rate limiting at the API gateway level, and what strategies exist?

**Answer:**

**Rate limiting algorithms:**

| Algorithm | How It Works | Pros | Cons |
|-----------|-------------|------|------|
| **Fixed Window** | Count requests in fixed time slots | Simple | Burst at window edges |
| **Sliding Window Log** | Track timestamp of each request | Accurate | Memory-heavy |
| **Sliding Window Counter** | Weighted avg of current + previous window | Good balance | Slightly approximate |
| **Token Bucket** | Tokens added at fixed rate, consumed per request | Allows bursts | Slightly complex |
| **Leaky Bucket** | Requests processed at fixed rate, excess queued | Smooth output | Delayed processing |

```
Token Bucket visualization:
  Bucket capacity: 10 tokens
  Refill rate: 2 tokens/sec

  t=0:  [■■■■■■■■■■] 10 tokens → Request costs 1 token → 9 left
  t=0:  [■■■■■■■■■ ] 9 tokens  → Burst of 5 requests → 4 left
  t=1:  [■■■■■■    ] 6 tokens  → +2 refilled
  t=5:  [■■■■■■■■■■] 10 tokens → Capped at max
```

**Multi-tier rate limiting in FastAPI (behind gateway):**

```python
# Application-level rate limiting (defense in depth)
from fastapi import FastAPI, Request, HTTPException
from redis.asyncio import Redis

app = FastAPI()
redis = Redis(host="redis")

async def sliding_window_rate_limit(
    key: str, limit: int, window_seconds: int
) -> tuple[bool, int]:
    """Returns (allowed, remaining)."""
    import time
    now = time.time()
    pipe = redis.pipeline()

    # Remove expired entries
    pipe.zremrangebyscore(key, 0, now - window_seconds)
    # Add current request
    pipe.zadd(key, {f"{now}": now})
    # Count requests in window
    pipe.zcard(key)
    # Set expiry on the key
    pipe.expire(key, window_seconds)

    results = await pipe.execute()
    request_count = results[2]

    return request_count <= limit, max(0, limit - request_count)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    allowed, remaining = await sliding_window_rate_limit(
        f"rl:{client_ip}", limit=100, window_seconds=60
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Limit"] = "100"
    return response
```

> **Why interviewer asks this:** Rate limiting is essential for API security and fairness. Interviewers want to see you understand algorithms and real Redis-backed implementations.

**Follow-up:** How do you handle rate limiting across multiple API gateway instances? (Hint: centralized store like Redis, or approximate local counters with periodic sync.)

---

### Q15: Explain the circuit breaker pattern and implement it for inter-service calls in FastAPI.

**Answer:**

**Circuit breaker states:**

```
  ┌───────────┐   Failures exceed    ┌──────────┐
  │  CLOSED   │──── threshold ──────►│   OPEN   │
  │ (normal)  │                      │ (reject  │
  └───────────┘                      │  all)    │
       ▲                             └────┬─────┘
       │                                  │
   Success                          Timeout expires
   threshold                              │
   met                                    ▼
       │                           ┌──────────────┐
       └───────────────────────────│  HALF-OPEN   │
                                   │ (test one    │
                                   │  request)    │
                                   └──────────────┘
```

```python
import time
from enum import Enum
from dataclasses import dataclass, field
import httpx
from fastapi import FastAPI, HTTPException

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    recovery_timeout: int = 30
    success_threshold: int = 2

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0

    async def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise HTTPException(503, "Service unavailable (circuit open)")

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
        self.failure_count = 0

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

# Usage
app = FastAPI()
payment_circuit = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

async def call_payment_service(order_id: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://payment-service:8000/charge",
            json={"order_id": order_id}, timeout=5.0
        )
        resp.raise_for_status()
        return resp.json()

@app.post("/orders/{order_id}/pay")
async def pay_order(order_id: str):
    result = await payment_circuit.call(call_payment_service, order_id)
    return result
```

> **Why interviewer asks this:** Circuit breakers prevent cascading failures — the #1 cause of full-system outages in microservices. This is a must-know pattern.

**Follow-up:** How would you share circuit breaker state across multiple instances of the same service? (Hint: Redis-backed state or a sidecar proxy like Envoy.)

---

### Q16: How do you handle authentication and authorization at the API gateway level vs at the service level?

**Answer:**

| Concern | Gateway Level | Service Level |
|---------|--------------|---------------|
| **JWT validation** | Verify signature, expiry | Trust gateway, extract claims |
| **API key check** | Validate key exists, rate limit | N/A (handled at gateway) |
| **OAuth2 token exchange** | Handle token introspection | Trust forwarded identity |
| **RBAC / permissions** | Coarse-grained (has valid token?) | Fine-grained (can user X edit resource Y?) |

**Recommended architecture:**

```
  Client ──Bearer token──► API Gateway
                              │
                     1. Validate JWT signature
                     2. Check token expiry
                     3. Extract user claims
                     4. Forward as headers
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         User Service    Order Service   Payment Service
         (trusts         (checks: can    (checks: owns
          X-User-ID)      user edit       payment method?)
                          this order?)
```

```python
# Service-level: trust gateway-forwarded identity
from fastapi import FastAPI, Request, Depends, HTTPException

app = FastAPI()

async def get_current_user(request: Request) -> dict:
    """Extract user from headers set by API gateway."""
    user_id = request.headers.get("X-User-ID")
    user_roles = request.headers.get("X-User-Roles", "").split(",")
    if not user_id:
        raise HTTPException(401, "Missing user identity from gateway")
    return {"id": user_id, "roles": user_roles}

def require_role(role: str):
    async def check(user: dict = Depends(get_current_user)):
        if role not in user["roles"]:
            raise HTTPException(403, f"Role '{role}' required")
        return user
    return check

@app.delete("/orders/{order_id}")
async def delete_order(order_id: str, user=Depends(require_role("admin"))):
    return {"deleted": order_id, "by": user["id"]}
```

> **Why interviewer asks this:** The split between gateway auth and service auth is a common source of security bugs. Interviewers want to see you understand defense in depth without duplicating logic.

**Follow-up:** What's the risk of only doing authentication at the gateway? (Hint: if an attacker bypasses the gateway via internal network, services are unprotected.)

---

## Section 5: Observability

### Q17: How do you implement structured logging in a FastAPI application for production observability?

**Answer:**

**Structured logging** = JSON-formatted logs with consistent fields, parseable by log aggregation tools (ELK, Loki, Datadog).

```python
import logging
import json
import uuid
import time
from contextvars import ContextVar
from fastapi import FastAPI, Request

# Context variable for request-scoped correlation ID
correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "correlation_id": correlation_id.get(""),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        # Include extra fields
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

# Configure logging
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("app")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = FastAPI()

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    correlation_id.set(req_id)

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "request completed",
        extra={"extra_data": {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": request.client.host,
        }}
    )
    response.headers["X-Request-ID"] = req_id
    return response
```

**Output:**
```json
{
  "timestamp": "2026-03-26 10:15:30",
  "level": "INFO",
  "message": "request completed",
  "correlation_id": "a1b2c3d4-e5f6-7890",
  "method": "GET",
  "path": "/api/users/42",
  "status": 200,
  "duration_ms": 23.45,
  "client_ip": "10.0.0.1"
}
```

> **Why interviewer asks this:** Unstructured logs (`print()` statements) are useless at scale. Interviewers want to see you know how to produce logs that can be queried and alerted on.

**Follow-up:** How do you propagate the `correlation_id` across microservices so you can trace a request end-to-end through logs?

---

### Q18: How do you expose Prometheus metrics from a FastAPI application?

**Answer:**

```python
from fastapi import FastAPI, Request
from prometheus_client import (
    Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
)
from starlette.responses import Response
import time, psutil

app = FastAPI()

# Define metrics
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)
ACTIVE_REQUESTS = Gauge(
    "http_active_requests",
    "Currently active requests"
)
DB_POOL_SIZE = Gauge(
    "db_connection_pool_size",
    "Database connection pool size",
    ["state"]  # active, idle
)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)

    ACTIVE_REQUESTS.inc()
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    ACTIVE_REQUESTS.dec()
    return response

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

**Prometheus scrape config:**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "fastapi"
    scrape_interval: 15s
    static_configs:
      - targets: ["app1:8000", "app2:8000"]
    metrics_path: /metrics
```

**Key metrics to track (the "Four Golden Signals"):**

| Signal | Metric | Alert Threshold Example |
|--------|--------|------------------------|
| **Latency** | `http_request_duration_seconds` | p99 > 1s for 5 min |
| **Traffic** | `http_requests_total` rate | Sudden drop > 50% |
| **Errors** | `http_requests_total{status=~"5.."}` | Error rate > 5% |
| **Saturation** | `http_active_requests`, CPU, memory | > 80% capacity |

> **Why interviewer asks this:** Metrics are the foundation of alerting and capacity planning. Interviewers want to see you expose the right metrics and know the golden signals.

**Follow-up:** What's the difference between a Counter, Gauge, Histogram, and Summary in Prometheus, and when do you use each?

---

### Q19: How do you implement distributed tracing with OpenTelemetry in a FastAPI microservices setup?

**Answer:**

```
Trace visualization:

TraceID: abc123
├── Span: API Gateway (12ms)
│   └── Span: Order Service - POST /orders (45ms)
│       ├── Span: DB Query - INSERT order (8ms)
│       ├── Span: User Service - GET /users/42 (15ms)
│       │   └── Span: DB Query - SELECT user (3ms)
│       └── Span: RabbitMQ Publish - order.created (2ms)
```

```python
# tracing.py — OpenTelemetry setup for FastAPI
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource

def setup_tracing(app, service_name: str):
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    # Export to Jaeger/Tempo via OTLP
    exporter = OTLPSpanExporter(endpoint="http://otel-collector:4317")
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # Auto-instrument FastAPI, httpx, SQLAlchemy
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument(engine=db_engine)

# main.py
from fastapi import FastAPI
app = FastAPI()
setup_tracing(app, "order-service")

# Custom spans for business logic
tracer = trace.get_tracer("order-service")

@app.post("/orders")
async def create_order(order: OrderCreate):
    with tracer.start_as_current_span("validate_order") as span:
        span.set_attribute("order.total", order.total)
        validated = await validate(order)

    with tracer.start_as_current_span("process_payment"):
        # httpx call to payment service — auto-traced
        # trace context propagated via W3C Trace Context headers
        async with httpx.AsyncClient() as client:
            await client.post("http://payment-service:8000/charge", json={...})

    return {"order_id": validated.id}
```

**Docker Compose for the observability stack:**

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector:latest
    command: ["--config=/etc/otel-config.yaml"]
    ports:
      - "4317:4317"   # OTLP gRPC

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # Jaeger UI

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

> **Why interviewer asks this:** Distributed tracing is essential for debugging microservices. Interviewers want to see you can instrument code and understand trace context propagation.

**Follow-up:** How does trace context get propagated across async message queues (e.g., RabbitMQ) where there are no HTTP headers?

---

### Q20: Your FastAPI service is experiencing intermittent latency spikes (p99 jumps from 50ms to 5s). Walk through your debugging approach using observability tools.

**Answer:**

**Step-by-step investigation:**

```
Step 1: METRICS (Grafana dashboard)
  ──► When did spikes start? (correlate with deployment/config change)
  ──► Is it all endpoints or specific ones?
  ──► Check: CPU, memory, active connections, GC pauses

Step 2: TRACES (Jaeger)
  ──► Filter traces with duration > 2s
  ──► Identify which span is slow:
      - DB query?     → Check slow query log, connection pool
      - HTTP call?    → Downstream service degraded?
      - App code?     → CPU-bound work blocking event loop?

Step 3: LOGS (correlation ID from slow traces)
  ──► Search logs by trace_id
  ──► Look for errors, warnings, retry messages

Step 4: INFRASTRUCTURE (Kubernetes / Docker metrics)
  ──► Pod restarts? (OOM kills)
  ──► Network issues? (DNS resolution delays)
  ──► Noisy neighbor? (CPU throttling)
```

**Common root causes and solutions:**

| Symptom | Root Cause | Solution |
|---------|-----------|----------|
| DB span 3s | Connection pool exhausted, queries waiting | Increase pool or add pgBouncer |
| DB span 3s | Missing index on query | Add index, use `EXPLAIN ANALYZE` |
| Random spans 5s | DNS resolution timeout | Use IP-based service discovery, set `ndots:1` in K8s |
| All spans slow at same time | GC pause (Python) | Reduce object allocation, tune `gc.set_threshold()` |
| Periodic spikes every 30s | Cron job / background task competing for resources | Move to dedicated worker pod |
| Spikes after deployment | New code has N+1 query | Use eager loading, check ORM queries |

```python
# Quick diagnostic endpoint (add temporarily)
@app.get("/debug/pool-status")
async def pool_status():
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "checkedin": pool.checkedin(),
    }
```

> **Why interviewer asks this:** Debugging latency in production is a daily reality. They want to see structured thinking, not random guessing, and familiarity with real tools.

**Follow-up:** How would you set up an alert that fires only when p99 latency exceeds 1s for more than 5 minutes (avoiding alert fatigue from transient spikes)?

---

## Section 6: Deployment

### Q21: Write a production-ready multi-stage Dockerfile for a FastAPI application and explain each decision.

**Answer:**

```dockerfile
# ---- Stage 1: Build dependencies ----
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build tools (needed for some packages like psycopg2, bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy only requirements first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Stage 2: Production image ----
FROM python:3.12-slim AS production

# Security: non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Runtime dependencies only (no gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=appuser:appuser . .

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

EXPOSE 8000

# Production server with optimal settings
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--access-log"]
```

**Key decisions explained:**

| Decision | Why |
|----------|-----|
| Multi-stage build | Final image has no gcc/build tools → smaller + more secure |
| `python:3.12-slim` | ~150MB vs ~900MB for full image |
| Copy `requirements.txt` first | Docker caches this layer; code changes don't re-install deps |
| Non-root user | Principle of least privilege |
| `--no-cache-dir` | Saves space in image |
| `curl` for healthcheck | Lightweight, no Python overhead |
| `uvloop` + `httptools` | 2-3x faster than default asyncio + h11 |
| `--proxy-headers` | Correctly reads `X-Forwarded-For` behind LB |

**Image size comparison:**

```
python:3.12          →  ~900MB
python:3.12-slim     →  ~150MB
Multi-stage (above)  →  ~180MB (with runtime deps)
```

> **Why interviewer asks this:** A poorly-built Docker image means slow deployments, security vulnerabilities, and wasted resources. This tests practical DevOps knowledge.

**Follow-up:** How would you add a `.dockerignore` file, and what common files should be excluded?

---

### Q22: Write a complete Kubernetes deployment manifest for a FastAPI app with proper health probes, resource limits, and autoscaling.

**Answer:**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fastapi-app
  labels:
    app: fastapi-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fastapi-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # 1 extra pod during update
      maxUnavailable: 0     # never reduce below desired count
  template:
    metadata:
      labels:
        app: fastapi-app
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: fastapi-app
          image: myregistry/fastapi-app:v1.2.3  # always pin version
          ports:
            - containerPort: 8000

          # --- Environment variables ---
          envFrom:
            - configMapRef:
                name: fastapi-config
            - secretRef:
                name: fastapi-secrets

          # --- Health probes ---
          startupProbe:
            httpGet:
              path: /health/live
              port: 8000
            failureThreshold: 30
            periodSeconds: 2         # up to 60s to start

          livenessProbe:
            httpGet:
              path: /health/live
              port: 8000
            periodSeconds: 15
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            periodSeconds: 5
            failureThreshold: 3

          # --- Resource limits ---
          resources:
            requests:
              cpu: "250m"        # 0.25 CPU guaranteed
              memory: "256Mi"
            limits:
              cpu: "1000m"       # burst up to 1 CPU
              memory: "512Mi"    # OOM killed if exceeded

          # --- Graceful shutdown ---
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "10"]  # allow LB to deregister

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fastapi-app
spec:
  selector:
    app: fastapi-app
  ports:
    - port: 80
      targetPort: 8000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fastapi-app
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: fastapi-app
                port:
                  number: 80

---
# hpa.yaml — Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fastapi-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fastapi-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
```

> **Why interviewer asks this:** Kubernetes is the de-facto deployment platform. Interviewers want to see you configure probes, resources, and autoscaling correctly — misconfiguration causes outages.

**Follow-up:** What happens if you set memory limits too low and the app occasionally exceeds them? How does Kubernetes handle it differently from CPU limits?

---

### Q23: Explain Kubernetes health probes (startup, liveness, readiness) — when does each fire, and what happens when each fails?

**Answer:**

```
Pod lifecycle with probes:

  Container starts
       │
       ▼
  ┌──────────────┐
  │ Startup Probe│──fails──► keeps retrying (up to failureThreshold)
  │              │──fails──► kills & restarts container
  │              │──passes─┐
  └──────────────┘         │
                           ▼
                   ┌───────────────────┐
                   │ Liveness Probe    │──passes──► container healthy
                   │ (periodic)        │──fails───► kills & restarts
                   │                   │
                   │ Readiness Probe   │──passes──► added to Service endpoints
                   │ (periodic)        │──fails───► removed from Service endpoints
                   └───────────────────┘              (pod stays alive, no traffic)
```

| Probe | When | On Failure | Use For |
|-------|------|-----------|---------|
| **Startup** | Only at start, before others begin | Restart container | Slow-starting apps (migrations, cache warmup) |
| **Liveness** | Periodically after startup passes | Restart container | Deadlock detection, stuck processes |
| **Readiness** | Periodically after startup passes | Remove from LB (no restart) | Temporary inability to serve (DB down, overloaded) |

**Common mistakes:**

```yaml
# BAD: Liveness probe checks database
# If DB goes down, ALL pods restart → makes things worse
livenessProbe:
  httpGet:
    path: /health/ready  # DON'T use readiness endpoint for liveness!

# GOOD: Liveness = is the process alive?
livenessProbe:
  httpGet:
    path: /health/live   # Simple 200 OK, no dependency checks

# GOOD: Readiness = can we serve traffic?
readinessProbe:
  httpGet:
    path: /health/ready  # Checks DB, Redis, etc.
```

> **Why interviewer asks this:** Misconfigured probes are a top cause of Kubernetes outages. Using readiness checks for liveness kills all pods when a dependency goes down.

**Follow-up:** Your app takes 45 seconds to start due to database migrations. How do you configure probes so Kubernetes doesn't kill the pod during startup?

---

### Q24: How do you set resource requests and limits for a FastAPI app in Kubernetes, and what happens if you get them wrong?

**Answer:**

**Resource requests vs limits:**

| | Requests | Limits |
|--|---------|--------|
| **Meaning** | Guaranteed minimum | Maximum allowed |
| **Scheduling** | K8s uses this to place pods on nodes | Doesn't affect scheduling |
| **CPU exceeded** | N/A | Throttled (slowed down) |
| **Memory exceeded** | N/A | OOM Killed (pod restarts) |

**Sizing strategy:**

```
1. Start with estimates based on load testing
2. Deploy and observe actual usage (Grafana + metrics-server)
3. Set REQUESTS = p75 of actual usage
4. Set LIMITS = p99 + 20% headroom
```

```yaml
resources:
  requests:
    cpu: "250m"       # 25% of a core — guaranteed
    memory: "256Mi"   # 256 MB — guaranteed
  limits:
    cpu: "1000m"      # can burst to 1 full core
    memory: "512Mi"   # hard ceiling — OOM killed above this
```

**What goes wrong:**

| Mistake | Consequence |
|---------|-------------|
| Requests too low | Pod scheduled on busy node, starved for resources |
| Requests too high | Cluster wastes capacity (pods claim more than they use) |
| No memory limit | One pod's leak takes down the entire node |
| Memory limit = request | No burst headroom, frequent OOM kills |
| CPU limit too low | Constant throttling, high latency |
| No CPU limit | Acceptable — pod bursts freely when node has capacity |

**Quick check — are you being throttled?**

```bash
# Check CPU throttling for a pod
kubectl top pod fastapi-app-abc123
# NAME                  CPU    MEMORY
# fastapi-app-abc123    980m   340Mi   ← near CPU limit = likely throttled

# Check for OOM kills
kubectl describe pod fastapi-app-abc123 | grep -A5 "Last State"
# Last State: Terminated
#   Reason: OOMKilled
```

> **Why interviewer asks this:** Resource mismanagement is the #1 reason for instability in Kubernetes. OOM kills and CPU throttling are silent performance killers.

**Follow-up:** Should you set CPU limits for a FastAPI app? (Hint: Google's recommendation is often to NOT set CPU limits and only set CPU requests.)

---

## Section 7: CI/CD Strategies

### Q25: Design a GitHub Actions CI/CD pipeline for a FastAPI application with the testing pyramid.

**Answer:**

**Testing pyramid:**

```
          ╱╲
         ╱  ╲        E2E / Integration (few, slow, expensive)
        ╱ E2E╲       - Test full API flows with real DB
       ╱──────╲
      ╱  Integ ╲     Integration (moderate count)
     ╱──────────╲    - Test endpoints with test DB
    ╱   Unit     ╲   Unit (many, fast, cheap)
   ╱──────────────╲  - Test business logic, validators, utils
```

```yaml
# .github/workflows/ci-cd.yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ---- Unit Tests (fast, run first) ----
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - run: pytest tests/unit -v --tb=short -q
      - run: ruff check .
      - run: mypy app/ --strict

  # ---- Integration Tests (need DB) ----
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - run: pytest tests/integration -v --tb=short
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  # ---- Build & Push Docker Image ----
  build:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ---- Deploy to Staging ----
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: |
          kubectl set image deployment/fastapi-app \
            fastapi-app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace staging
          kubectl rollout status deployment/fastapi-app --namespace staging --timeout=300s

  # ---- Deploy to Production (manual approval) ----
  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production    # requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4
      - run: |
          kubectl set image deployment/fastapi-app \
            fastapi-app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace production
          kubectl rollout status deployment/fastapi-app --namespace production --timeout=300s
```

> **Why interviewer asks this:** CI/CD is the backbone of reliable delivery. Interviewers want to see you structure tests efficiently and automate the full path from code to production.

**Follow-up:** How would you add security scanning (dependency vulnerabilities + container scanning) to this pipeline?

---

### Q26: Compare blue-green and canary deployment strategies. When do you use each?

**Answer:**

**Blue-Green Deployment:**

```
Before:
  100% traffic ──► [Blue v1.0] (live)
                   [Green    ] (idle)

Deploy v1.1 to Green:
  100% traffic ──► [Blue v1.0] (live)
                   [Green v1.1] (tested, ready)

Switch:
  100% traffic ──► [Green v1.1] (now live)
                   [Blue v1.0]  (standby for rollback)

Rollback = instant switch back to Blue
```

**Canary Deployment:**

```
Phase 1:  95% ──► [v1.0]     5% ──► [v1.1 canary]
          Monitor error rates, latency...

Phase 2:  75% ──► [v1.0]    25% ──► [v1.1 canary]
          Still healthy...

Phase 3:   0% ──► [v1.0]   100% ──► [v1.1]
          Full rollout!
```

| Aspect | Blue-Green | Canary |
|--------|-----------|--------|
| **Traffic split** | All-or-nothing | Gradual (5% → 25% → 100%) |
| **Risk** | Higher (everyone gets new version at once) | Lower (only % of users) |
| **Rollback speed** | Instant (switch back) | Fast (route 100% back) |
| **Resource cost** | 2x (two full environments) | ~1.05-1.25x (few extra pods) |
| **Complexity** | Lower | Higher (traffic splitting) |
| **Best for** | Small teams, simple apps | High-traffic, risk-averse orgs |

**Canary with Kubernetes + Nginx Ingress:**

```yaml
# Stable deployment (receives most traffic)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fastapi-stable
spec:
  replicas: 9
  template:
    metadata:
      labels:
        app: fastapi
        version: stable
    spec:
      containers:
        - name: app
          image: myregistry/fastapi:v1.0

---
# Canary deployment (receives small % of traffic)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fastapi-canary
spec:
  replicas: 1     # 1 out of 10 total = ~10% traffic
  template:
    metadata:
      labels:
        app: fastapi
        version: canary
    spec:
      containers:
        - name: app
          image: myregistry/fastapi:v1.1

---
# Single service routes to both
apiVersion: v1
kind: Service
metadata:
  name: fastapi
spec:
  selector:
    app: fastapi    # matches BOTH stable and canary
  ports:
    - port: 80
      targetPort: 8000
```

> **Why interviewer asks this:** Deployment strategy choice directly impacts blast radius during failures. Interviewers want to see risk-aware thinking.

**Follow-up:** How would you automate canary analysis — automatically rolling back if error rate increases?

---

### Q27: How do you implement a safe rollback strategy for a FastAPI service in Kubernetes?

**Answer:**

**Rollback methods (from fastest to most involved):**

```
Method 1: kubectl rollout undo (instant)
  ──► Reverts to previous ReplicaSet
  ──► Fastest, but only goes back one version

Method 2: Redeploy previous image tag
  ──► Set image to known-good version
  ──► More controlled, can skip to any version

Method 3: GitOps revert (Argo CD / Flux)
  ──► git revert on deployment config
  ──► Full audit trail, matches git history
```

```bash
# Method 1: Instant rollback
kubectl rollout undo deployment/fastapi-app --namespace production

# Check rollout history
kubectl rollout history deployment/fastapi-app
# REVISION  CHANGE-CAUSE
# 1         image: fastapi:v1.0
# 2         image: fastapi:v1.1  ← current (broken)

# Rollback to specific revision
kubectl rollout undo deployment/fastapi-app --to-revision=1

# Method 2: Explicit image tag
kubectl set image deployment/fastapi-app \
  fastapi-app=myregistry/fastapi:v1.0 \
  --namespace production
```

**Automated rollback in CI/CD:**

```yaml
# In GitHub Actions deploy step
- name: Deploy and verify
  run: |
    # Deploy new version
    kubectl set image deployment/fastapi-app \
      fastapi-app=${{ env.IMAGE }}:${{ github.sha }} \
      --namespace production

    # Wait for rollout (fails if pods crash-loop)
    if ! kubectl rollout status deployment/fastapi-app \
      --namespace production --timeout=300s; then
      echo "Rollout failed! Initiating rollback..."
      kubectl rollout undo deployment/fastapi-app --namespace production
      kubectl rollout status deployment/fastapi-app --namespace production
      exit 1
    fi

    # Post-deploy smoke test
    sleep 10
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health/ready)
    if [ "$STATUS" != "200" ]; then
      echo "Smoke test failed (HTTP $STATUS)! Rolling back..."
      kubectl rollout undo deployment/fastapi-app --namespace production
      exit 1
    fi
```

**Database rollback considerations:**

| DB Change Type | Rollback Strategy |
|---------------|-------------------|
| Add column (nullable) | Safe — old code ignores new column |
| Remove column | DON'T — deploy in phases: stop using → deploy → drop later |
| Rename column | Create new → copy data → deploy → drop old |
| Add index | Drop index (if needed) |
| Data migration | Write reverse migration script |

> **Why interviewer asks this:** Deployments fail. What matters is how fast and safely you recover. Interviewers want to see you've thought about backward-compatible DB migrations and automated rollback.

**Follow-up:** How do you ensure database migrations are backward-compatible so that old code still works during a rollback?

---

### Q28: You've just discovered that a deployment to production introduced a bug that only affects 5% of users making payments. Walk through your incident response.

**Answer:**

**Incident response timeline:**

```
T+0:00  DETECT — Alert fires: payment error rate 5% → 12%
        ┌─────────────────────────────────────────────┐
        │ 1. Acknowledge alert, open incident channel  │
        │ 2. Assign roles: IC (Incident Commander),    │
        │    Comms lead, Engineering lead               │
        └─────────────────────────────────────────────┘

T+0:05  ASSESS — How bad is it?
        ──► Which users? (check logs with correlation IDs)
        ──► What changed? (diff recent deployment)
        ──► Is it getting worse? (check real-time metrics)

T+0:10  MITIGATE — Stop the bleeding
        Option A: Rollback deployment (if clearly caused by new code)
          $ kubectl rollout undo deployment/payment-service -n production

        Option B: Feature flag off (if isolated to specific feature)
          $ curl -X PUT config-service/flags/new-payment-flow -d '{"enabled":false}'

        Option C: Traffic shift (if canary — route to stable)
          $ kubectl scale deployment/payment-canary --replicas=0

T+0:20  VERIFY — Is the fix working?
        ──► Error rate dropping?
        ──► Affected users retrying successfully?

T+0:30  COMMUNICATE
        ──► Status page update
        ──► Internal stakeholder notification
```

**Post-incident (blameless postmortem):**

```
## Incident Report: Payment Failures 2026-03-26

### Timeline
- 14:00 — v2.3.1 deployed to production
- 14:12 — Alert: payment error rate > 10%
- 14:17 — Rollback initiated
- 14:19 — Error rate returning to baseline
- 14:25 — Incident resolved

### Root Cause
New payment serializer used `Decimal` precision of 2, but 5% of
products have prices with 3 decimal places → validation error.

### Why Tests Didn't Catch It
- Test fixtures only had 2-decimal prices
- No property-based testing for price edge cases

### Action Items
| Action | Owner | Due |
|--------|-------|-----|
| Add property-based tests for price fields | @dev1 | 2026-04-02 |
| Add canary stage with 5% traffic before full rollout | @devops | 2026-04-05 |
| Monitor payment error rate as deploy gate | @dev2 | 2026-04-05 |
| Seed test DB with real (anonymized) production data | @dev3 | 2026-04-09 |
```

> **Why interviewer asks this:** This tests your incident management skills — not just technical ability, but communication, prioritization, and structured thinking under pressure.

**Follow-up:** How do you prevent similar incidents? (Hint: canary deployments with automated error rate gating, better test data generation, and feature flags.)

---

## Quick Reference Cheat Sheet

### Scaling Decisions

```
┌─────────────────────────────────────────────────────────┐
│ Is your app stateless?                                   │
│   NO  → Make it stateless first (externalize state)     │
│   YES → Horizontal scale behind a load balancer         │
│                                                         │
│ CPU-bound or I/O-bound?                                 │
│   I/O  → More async workers (uvicorn --workers N)       │
│   CPU  → Offload to Celery / process pool               │
│   Both → Separate API (async) from workers (CPU)        │
│                                                         │
│ Monolith or Microservices?                              │
│   Start monolith → modular monolith → extract when needed│
└─────────────────────────────────────────────────────────┘
```

### Communication Patterns

| Pattern | Use When |
|---------|----------|
| REST | Public API, simple CRUD, browser clients |
| gRPC | Internal, high throughput, streaming |
| Message Queue | Async workflows, event-driven, fan-out |
| GraphQL | Multiple frontends needing different data shapes |

### Kubernetes Probes Summary

| Probe | Checks | On Fail | Endpoint |
|-------|--------|---------|----------|
| Startup | "Has the app booted?" | Restart | `/health/live` |
| Liveness | "Is the process alive?" | Restart | `/health/live` |
| Readiness | "Can it serve traffic?" | Remove from LB | `/health/ready` |

### The Four Golden Signals

| Signal | Metric | Alert On |
|--------|--------|----------|
| Latency | `request_duration_seconds` | p99 > threshold |
| Traffic | `requests_total` rate | Drop > 50% |
| Errors | `requests_total{status=5xx}` rate | > 5% |
| Saturation | CPU, memory, connections | > 80% |

### Docker Best Practices

```
✓ Multi-stage build (small + secure)
✓ Non-root user
✓ Pin dependency versions
✓ .dockerignore (exclude .git, __pycache__, .env)
✓ HEALTHCHECK instruction
✓ Copy requirements.txt before code (layer caching)
```

### Deployment Strategy Decision

```
Low risk / small team     → Blue-Green
High traffic / cautious   → Canary (5% → 25% → 100%)
Feature isolation          → Feature Flags
Database changes           → Backward-compatible migrations
Rollback plan              → Always have one BEFORE deploying
```

### CI/CD Pipeline Stages

```
Code Push → Lint/Type Check → Unit Tests → Integration Tests
  → Build Docker Image → Push to Registry
  → Deploy Staging → Smoke Tests
  → Manual Approval → Deploy Production → Health Verification
  → (Auto-rollback on failure)
```

---

> **End of Part 7/7** — System Design & Real-world Backend Architecture
>
> **Full Series:**
> 1. Python Fundamentals
> 2. Intermediate Python
> 3. Advanced Python
> 4. FastAPI Fundamentals
> 5. FastAPI Advanced & Production
> 6. Databases & ORMs
> 7. **System Design & Architecture** (this file)
