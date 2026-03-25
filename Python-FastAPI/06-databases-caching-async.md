# Databases, Caching & Async Systems -- Interview Preparation (Part 6/7)

> **Series:** Python + FastAPI Interview Prep
> **Level:** Infrastructure + Async + Databases
> **Prerequisites:** Parts 1-5 (Core Python, FastAPI fundamentals, testing, deployment)
> **Questions:** 32 across 7 sections

---

## Table of Contents

| # | Section | Questions | Key Topics |
|---|---------|-----------|------------|
| 1 | [SQL vs NoSQL](#section-1-sql-vs-nosql) | Q1-Q5 | CAP theorem, ACID vs BASE, data-model trade-offs |
| 2 | [ORM with SQLAlchemy](#section-2-orm-with-sqlalchemy) | Q6-Q10 | Models, relationships, Alembic migrations, sessions |
| 3 | [Async DB Handling](#section-3-async-db-handling) | Q11-Q14 | asyncpg, async SQLAlchemy, connection lifecycle |
| 4 | [Transactions](#section-4-transactions) | Q15-Q19 | Isolation levels, deadlocks, locking strategies |
| 5 | [Redis Caching](#section-5-redis-caching) | Q20-Q24 | Caching strategies, TTL, invalidation, data structures |
| 6 | [Message Queues](#section-6-message-queues-celery) | Q25-Q28 | Celery, task routing, retries, dead-letter queues |
| 7 | [Connection Pooling](#section-7-connection-pooling) | Q29-Q32 | Pool config, async pools, exhaustion debugging |

---

## Section 1: SQL vs NoSQL

### Q1: When would you choose a relational database over a document store, and vice versa?

**Answer:**

| Factor | Relational (PostgreSQL, MySQL) | Document (MongoDB, DynamoDB) |
|--------|-------------------------------|------------------------------|
| Schema | Strict, enforced at DB level | Flexible, schema-on-read |
| Relationships | First-class JOINs, foreign keys | Embedded docs or manual refs |
| Transactions | Full ACID across tables | Limited (single-doc atomic in Mongo; multi-doc since 4.0) |
| Scaling | Vertical first, read-replicas | Horizontal sharding built-in |
| Query flexibility | Ad-hoc SQL, complex aggregations | Index-dependent, limited JOINs |
| Best fit | Banking, ERP, anything with complex relations | Content catalogs, IoT events, user profiles |

**Real-world decision framework:**

```
Choose SQL when:
  - Data has clear relationships (users -> orders -> items)
  - You need multi-table transactions
  - Reporting / analytics queries are important
  - Data integrity is non-negotiable

Choose NoSQL when:
  - Schema evolves rapidly (early-stage products)
  - Data is naturally hierarchical or denormalized
  - You need horizontal scaling beyond a single node
  - Access patterns are known and limited (key-value lookups)
```

**Trade-off that catches candidates off-guard:** MongoDB added multi-document ACID transactions in v4.0, and PostgreSQL added `JSONB` for semi-structured data -- so the line is blurring. The real question is which _primary access pattern_ dominates.

> **Why the interviewer asks this:** They want to see you reason about trade-offs rather than recite "SQL = structured, NoSQL = unstructured."

> **Follow-up:** "Your team stores user profiles in PostgreSQL but the product manager wants to add arbitrary custom fields per user. How do you handle it without switching databases?"

---

### Q2: Explain the CAP theorem with a concrete example.

**Answer:**

The CAP theorem states that a distributed data store can guarantee **at most two** of three properties simultaneously:

| Property | Meaning |
|----------|---------|
| **Consistency** | Every read receives the most recent write (linearizability) |
| **Availability** | Every request receives a non-error response (may be stale) |
| **Partition tolerance** | The system continues operating despite network splits |

Since network partitions _will_ happen in any distributed system, the real choice is **CP vs AP** during a partition:

```
                        CAP Theorem
                       /           \
                     CP             AP
                    /                 \
          PostgreSQL (single)     Cassandra, DynamoDB
          MongoDB (default)       CouchDB
          Redis Cluster           Riak
          (rejects writes         (serves stale reads
           during partition)       during partition)
```

**Concrete scenario -- e-commerce inventory:**

```
Two data centers: DC-East, DC-West. Network link breaks.

CP choice (reject writes):
  - DC-West refuses checkout writes to avoid overselling.
  - Customers see "service unavailable" -- bad UX, but correct inventory.

AP choice (accept writes):
  - Both DCs accept orders independently.
  - After partition heals, you discover you sold 120 units of a 100-unit item.
  - Need conflict resolution (last-write-wins, CRDTs, manual merge).
```

**Common misconception:** CAP does not mean you pick two _permanently_. The trade-off only manifests _during_ a network partition. Under normal conditions, a well-designed system can appear to offer all three.

> **Why the interviewer asks this:** CAP is frequently misunderstood. They want to see you apply it to a real system, not just quote the acronym.

> **Follow-up:** "How does the PACELC extension improve on the CAP model?"

---

### Q3: Compare ACID and BASE consistency models. When is eventual consistency acceptable?

**Answer:**

```
ACID (Traditional SQL)              BASE (Many NoSQL systems)
---------------------               -------------------------
Atomicity   - all or nothing        Basically Available
Consistency - valid state to         Soft state - state may
              valid state              change without input
Isolation   - concurrent txns       Eventually consistent -
              don't interfere         system converges over time
Durability  - committed = permanent
```

**When eventual consistency is acceptable:**

1. **Social media feeds** -- a 2-second delay before a like count updates is fine.
2. **Product catalog search** -- a new product appearing 30 seconds later in search results is tolerable.
3. **Analytics dashboards** -- real-time to the second is rarely required.
4. **DNS propagation** -- inherently eventually consistent by design.

**When it is NOT acceptable:**

1. **Bank account transfers** -- double-spending is catastrophic.
2. **Inventory reservations** -- overselling costs real money.
3. **Medical records** -- reading stale data can endanger patients.

**Code example -- handling eventual consistency in FastAPI:**

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()

# Write goes to primary (strong consistency for writes)
# Reads can go to replica (eventual consistency for reads)


@app.post("/orders/")
async def create_order(order: OrderCreate, db: AsyncSession = Depends(get_primary_db)):
    """Writes always hit the primary to ensure ACID guarantees."""
    new_order = Order(**order.dict())
    db.add(new_order)
    await db.commit()
    return {"id": new_order.id}


@app.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    consistency: str = "eventual",  # caller chooses
    db_primary: AsyncSession = Depends(get_primary_db),
    db_replica: AsyncSession = Depends(get_replica_db),
):
    """
    'strong' -> read from primary (always fresh, higher latency)
    'eventual' -> read from replica (possibly stale, lower latency)
    """
    db = db_primary if consistency == "strong" else db_replica
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
```

> **Why the interviewer asks this:** To see if you can match the consistency model to the business requirement, not just default to "always ACID."

> **Follow-up:** "How would you implement a read-your-own-writes guarantee on top of an eventually consistent system?"

---

### Q4 (Debugging): A developer queries MongoDB for all orders placed today but gets inconsistent counts across repeated runs. What could be wrong?

**Answer:**

**Root causes, ranked by likelihood:**

1. **Reading from a secondary replica with replication lag:**

```python
# Problem -- default read preference may hit a lagging secondary
collection = db.get_collection(
    "orders",
    read_preference=ReadPreference.SECONDARY_PREFERRED
)

# Fix -- use PRIMARY for consistency-critical counts
collection = db.get_collection(
    "orders",
    read_preference=ReadPreference.PRIMARY
)
```

2. **Missing or incorrect index on the date field:**
   The query does a full collection scan; concurrent writes during the scan cause phantom reads.

3. **Timezone mismatch:**

```python
# Bug -- server is in UTC, developer queries in local time
db.orders.count_documents({"created_at": {"$gte": "2025-03-26"}})
# This string comparison may not match ISODate objects

# Fix -- use proper datetime objects in UTC
from datetime import datetime, timezone

start_of_day = datetime.now(timezone.utc).replace(
    hour=0, minute=0, second=0, microsecond=0
)
db.orders.count_documents({"created_at": {"$gte": start_of_day}})
```

4. **Write concern too low:**
   If `w=0` (fire-and-forget), some writes may not be acknowledged before the count query runs.

5. **Sharded cluster without a targeted query:**
   On a sharded collection, `count_documents` without the shard key may return approximate results.

> **Why the interviewer asks this:** Debugging requires systematic thinking. They want to see you enumerate causes, not guess.

> **Follow-up:** "How does MongoDB's `readConcern: 'majority'` help here, and what is the performance cost?"

---

### Q5 (Conceptual): Compare key-value, document, columnar, and graph databases with use cases.

**Answer:**

| Type | Examples | Data Model | Strengths | Weaknesses | Use Cases |
|------|----------|-----------|-----------|------------|-----------|
| **Key-Value** | Redis, DynamoDB, etcd | `key -> blob` | Sub-ms reads, simple API | No complex queries | Sessions, caches, feature flags |
| **Document** | MongoDB, CouchDB, Firestore | `key -> JSON doc` | Flexible schema, nested data | Weak JOINs, denormalization needed | Content management, user profiles |
| **Columnar** | Cassandra, HBase, ScyllaDB | `row key -> column families` | High write throughput, time-series | Poor for ad-hoc queries | IoT telemetry, event logging |
| **Graph** | Neo4j, Amazon Neptune, ArangoDB | Nodes + Edges | Relationship traversal in O(1) | Scaling is hard | Social networks, fraud detection, recommendations |
| **Relational** | PostgreSQL, MySQL | Tables + rows + FKs | ACID, JOINs, SQL ecosystem | Vertical scaling limits | Finance, ERP, anything with complex relations |

**Decision flowchart:**

```
Is the primary access pattern...
  |
  +-- exact key lookup?           -> Key-Value (Redis, DynamoDB)
  +-- hierarchical / nested data? -> Document (MongoDB)
  +-- time-ordered high-volume?   -> Columnar (Cassandra)
  +-- relationship traversal?     -> Graph (Neo4j)
  +-- complex joins / reporting?  -> Relational (PostgreSQL)
```

**Production insight:** Many real systems are **polyglot persistent** -- using PostgreSQL for transactional data, Redis for caching, and Elasticsearch for full-text search, all in the same application.

> **Why the interviewer asks this:** To verify you have breadth beyond "I know PostgreSQL and MongoDB."

> **Follow-up:** "You need to store a social graph with 500M nodes and find friends-of-friends in under 100ms. Which database and why?"

---

## Section 2: ORM with SQLAlchemy

### Q6: Show how to define a many-to-many relationship in SQLAlchemy 2.0 with proper type hints.

**Answer:**

```python
"""SQLAlchemy 2.0 many-to-many with Mapped type hints."""
from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Table,
    DateTime,
    func,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    pass


# Association table (no ORM model needed for simple M2M)
article_tag = Table(
    "article_tag",
    Base.metadata,
    Column("article_id", Integer, ForeignKey("articles.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Many-to-many relationship
    tags: Mapped[List[Tag]] = relationship(
        secondary=article_tag,
        back_populates="articles",
        lazy="selectin",  # avoids N+1 by default
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)

    articles: Mapped[List[Article]] = relationship(
        secondary=article_tag,
        back_populates="tags",
        lazy="selectin",
    )
```

**If the association itself carries data** (e.g., `tagged_by`, `tagged_at`), promote it to a full model:

```python
class ArticleTag(Base):
    """Association object pattern -- use when the link has its own columns."""

    __tablename__ = "article_tag"

    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id"), primary_key=True
    )
    tagged_by: Mapped[str] = mapped_column(String(100))
    tagged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    article: Mapped[Article] = relationship(back_populates="article_tags")
    tag: Mapped[Tag] = relationship(back_populates="article_tags")
```

**Key details interviewers look for:**

- Using `Mapped[]` type hints (SQLAlchemy 2.0 style, not legacy `Column()` only)
- `back_populates` instead of `backref` (explicit is better than implicit)
- Choosing `lazy="selectin"` to prevent N+1 queries
- Knowing when to use association table vs association object

> **Why the interviewer asks this:** M2M relationships are where ORM complexity surfaces. They want to see you handle it cleanly.

> **Follow-up:** "How would you query all articles that have ALL of a given set of tags (not just ANY)?"

---

### Q7: Write an Alembic migration that adds a column with a default value and backfills existing rows.

**Answer:**

```python
"""Add 'status' column to orders table with backfill.

Revision ID: a1b2c3d4e5f6
Revises: previous_revision_id
Create Date: 2025-03-26 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# Revision identifiers
revision = "a1b2c3d4e5f6"
down_revision = "previous_revision_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add column as nullable first (avoids locking entire table
    # with a DEFAULT on large tables in PostgreSQL < 11)
    op.add_column(
        "orders",
        sa.Column("status", sa.String(20), nullable=True),
    )

    # Step 2: Backfill in batches to avoid long-running transactions
    # Use raw SQL via op.execute for data migrations
    orders = sa.table(
        "orders",
        sa.column("id", sa.Integer),
        sa.column("status", sa.String),
    )

    # Batch update to avoid locking the entire table
    op.execute(
        orders.update()
        .where(orders.c.status.is_(None))
        .values(status="pending")
    )

    # Step 3: Now set NOT NULL constraint after backfill
    op.alter_column(
        "orders",
        "status",
        nullable=False,
        server_default="pending",
    )

    # Step 4: Add index for queries that filter by status
    op.create_index(
        "ix_orders_status",
        "orders",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_column("orders", "status")
```

**Why the three-step pattern matters:**

| Approach | Risk |
|----------|------|
| `ADD COLUMN ... NOT NULL DEFAULT 'pending'` in one step | PostgreSQL < 11 rewrites the entire table (locks it). PostgreSQL 11+ is fine but MySQL still locks. |
| Add nullable, backfill, then set NOT NULL | Safe on all databases, works in zero-downtime deployments |

**Production best practice for large tables (millions of rows):**

```python
def upgrade() -> None:
    op.add_column("orders", sa.Column("status", sa.String(20), nullable=True))

    # Backfill in batches of 10,000
    conn = op.get_bind()
    while True:
        result = conn.execute(
            sa.text(
                "UPDATE orders SET status = 'pending' "
                "WHERE id IN ("
                "  SELECT id FROM orders WHERE status IS NULL LIMIT 10000"
                ")"
            )
        )
        if result.rowcount == 0:
            break

    op.alter_column("orders", "status", nullable=False, server_default="pending")
```

> **Why the interviewer asks this:** Migrations are where theory meets production pain. They want to see you think about table locks, backfills, and rollback safety.

> **Follow-up:** "How do you handle migrations in a blue-green deployment where old and new code run simultaneously?"

---

### Q8: Explain SQLAlchemy session management in FastAPI. What goes wrong if you get it wrong?

**Answer:**

```python
"""Correct session management with dependency injection."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/mydb"

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,      # detect stale connections
    pool_recycle=3600,        # recycle connections every hour
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,   # avoid lazy-load issues after commit
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a session scoped to a single request.
    Rolls back on exception, closes on completion.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**What goes wrong with incorrect session management:**

| Mistake | Consequence |
|---------|-------------|
| **Global session shared across requests** | Race conditions -- one request's rollback undoes another's writes |
| **Forgetting to close sessions** | Connection pool exhaustion; new requests hang waiting for connections |
| **Not rolling back on exception** | Session enters an inconsistent state; subsequent operations fail with `InvalidRequestError` |
| **`expire_on_commit=True` (default) with async** | Accessing attributes after commit triggers a lazy load, which raises `MissingGreenlet` error in async context |
| **Creating engine per request** | Each request opens a new connection pool -- memory leak, hits DB connection limit |

**Anti-pattern -- the global session mistake:**

```python
# WRONG: shared session across concurrent requests
db_session = SessionLocal()


@app.get("/users/{user_id}")
async def get_user(user_id: int):
    # Two concurrent requests sharing the same session = data corruption
    return db_session.query(User).get(user_id)
```

> **Why the interviewer asks this:** Session mismanagement is the number one cause of production SQLAlchemy bugs. This tests real-world experience.

> **Follow-up:** "What is `expire_on_commit` and why should you set it to `False` in async code?"

---

### Q9 (Output): What does this code print and why?

```python
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import Session, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))


engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)

with Session(engine) as s1:
    user = User(id=1, name="Alice")
    s1.add(user)
    s1.commit()
    print(f"1: {user.name}")       # Line A

    user.name = "Bob"
    s1.flush()
    print(f"2: {user.name}")       # Line B

    s1.rollback()
    print(f"3: {user.name}")       # Line C

    with Session(engine) as s2:
        u2 = s2.get(User, 1)
        print(f"4: {u2.name}")     # Line D
```

**Answer:**

```
1: Alice
2: Bob
3: Alice
4: Alice
```

**Explanation line by line:**

- **Line A (`Alice`):** After `commit()`, `expire_on_commit=True` (default) expires all attributes. Accessing `user.name` triggers a re-load from DB, which returns `"Alice"`.
- **Line B (`Bob`):** `flush()` sends the UPDATE to the database _within the transaction_ but does not commit. The in-memory state reflects `"Bob"`, and the DB has the pending change.
- **Line C (`Alice`):** `rollback()` undoes the flushed-but-uncommitted UPDATE. SQLAlchemy also expires attributes, so accessing `user.name` re-loads from DB. The committed value is `"Alice"`.
- **Line D (`Alice`):** A separate session reads the committed state, which is `"Alice"`.

**Key takeaway:** `flush() != commit()`. A flush writes to the DB within the current transaction but is rolled back if the transaction is rolled back.

> **Why the interviewer asks this:** This tests understanding of the SQLAlchemy unit-of-work pattern, flush vs commit, and rollback behavior.

> **Follow-up:** "What changes if we set `expire_on_commit=False`?"

---

### Q10 (Coding): Write a repository pattern for SQLAlchemy that supports both sync and async usage.

**Answer:**

```python
"""Generic repository pattern supporting both sync and async."""
from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Synchronous repository."""

    def __init__(self, model: Type[ModelT], session: Session):
        self._model = model
        self._session = session

    def get_by_id(self, id: int) -> Optional[ModelT]:
        return self._session.get(self._model, id)

    def get_all(self, offset: int = 0, limit: int = 100) -> List[ModelT]:
        stmt = select(self._model).offset(offset).limit(limit)
        return list(self._session.scalars(stmt).all())

    def create(self, **kwargs) -> ModelT:
        instance = self._model(**kwargs)
        self._session.add(instance)
        self._session.flush()  # get the ID without committing
        return instance

    def update(self, id: int, **kwargs) -> Optional[ModelT]:
        instance = self.get_by_id(id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            setattr(instance, key, value)
        self._session.flush()
        return instance

    def delete(self, id: int) -> bool:
        instance = self.get_by_id(id)
        if instance is None:
            return False
        self._session.delete(instance)
        self._session.flush()
        return True


class AsyncBaseRepository(Generic[ModelT]):
    """Async repository -- same interface, async methods."""

    def __init__(self, model: Type[ModelT], session: AsyncSession):
        self._model = model
        self._session = session

    async def get_by_id(self, id: int) -> Optional[ModelT]:
        return await self._session.get(self._model, id)

    async def get_all(self, offset: int = 0, limit: int = 100) -> List[ModelT]:
        stmt = select(self._model).offset(offset).limit(limit)
        result = await self._session.scalars(stmt)
        return list(result.all())

    async def create(self, **kwargs) -> ModelT:
        instance = self._model(**kwargs)
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def update(self, id: int, **kwargs) -> Optional[ModelT]:
        instance = await self.get_by_id(id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self._session.flush()
        return instance

    async def delete(self, id: int) -> bool:
        instance = await self.get_by_id(id)
        if instance is None:
            return False
        await self._session.delete(instance)
        await self._session.flush()
        return True


# --- Usage in FastAPI ---

class UserRepository(AsyncBaseRepository["User"]):
    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> Optional["User"]:
        stmt = select(User).where(User.email == email)
        result = await self._session.scalars(stmt)
        return result.first()


# Dependency injection
async def get_user_repo(
    session: AsyncSession = Depends(get_db),
) -> UserRepository:
    return UserRepository(session)


@app.get("/users/{user_id}")
async def get_user(user_id: int, repo: UserRepository = Depends(get_user_repo)):
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

**Design decisions:**

- Repositories call `flush()` not `commit()` -- the session/dependency layer manages the transaction boundary.
- Generic typing allows reuse across all models.
- Async and sync are separate classes because mixing them with `await` conditionals is fragile.

> **Why the interviewer asks this:** Repository pattern is a common architecture question. They want clean separation of concerns and proper transaction boundaries.

> **Follow-up:** "How would you add unit-of-work pattern on top of this so multiple repositories share the same transaction?"

---

## Section 3: Async DB Handling

### Q11: Compare asyncpg, the databases library, and async SQLAlchemy. When would you choose each?

**Answer:**

| Library | Level | Async | ORM Support | Best For |
|---------|-------|-------|-------------|----------|
| **asyncpg** | Low (raw driver) | Native async | None (raw SQL) | Maximum performance, PostgreSQL only |
| **databases** | Mid (query builder) | Native async | Works with SQLAlchemy Core | Lightweight async apps, multiple DB backends |
| **SQLAlchemy 2.0 + asyncpg** | High (full ORM) | Native async via `AsyncSession` | Full ORM | Production apps that need ORM + async |

**Performance benchmarks (approximate, single query):**

```
asyncpg raw:              ~0.15ms per query
databases + SA Core:      ~0.25ms per query
SQLAlchemy ORM + asyncpg: ~0.40ms per query
```

**asyncpg -- raw performance:**

```python
import asyncpg


async def fetch_user_asyncpg(user_id: int):
    conn = await asyncpg.connect("postgresql://user:pass@localhost/db")
    try:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None
    finally:
        await conn.close()
```

**databases library -- lightweight async:**

```python
from databases import Database

database = Database("postgresql+asyncpg://user:pass@localhost/db")


async def fetch_user_databases(user_id: int):
    query = "SELECT * FROM users WHERE id = :id"
    return await database.fetch_one(query=query, values={"id": user_id})
```

**SQLAlchemy async -- full ORM:**

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select

engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/db")


async def fetch_user_sa(session: AsyncSession, user_id: int):
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

**Decision matrix:**

```
Need raw SQL performance and only use PostgreSQL?  -> asyncpg
Need async but want to stay lightweight?           -> databases
Need relationships, ORM features, migrations?      -> SQLAlchemy async
Building a prototype / microservice?               -> databases
Building a production monolith?                    -> SQLAlchemy async
```

> **Why the interviewer asks this:** They want to see you understand the abstraction-vs-performance trade-off and pick the right tool.

> **Follow-up:** "Can you use asyncpg directly as the driver underneath SQLAlchemy async? How does that work?"

---

### Q12 (Coding): Implement a FastAPI lifespan that manages async database connection lifecycle properly.

**Answer:**

```python
"""Complete async DB lifecycle management in FastAPI."""
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Module-level references (initialized during lifespan)
engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None


def create_engine_with_config() -> AsyncEngine:
    return create_async_engine(
        "postgresql+asyncpg://user:pass@localhost:5432/mydb",
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,        # seconds to wait for a connection
        pool_pre_ping=True,     # verify connections before use
        pool_recycle=1800,      # recycle connections every 30 minutes
        echo=False,             # set True for SQL logging in dev
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: create engine + session factory.
    Shutdown: dispose engine (closes all pooled connections).
    """
    global engine, async_session_factory

    engine = create_engine_with_config()
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Optional: verify connectivity at startup
    async with engine.begin() as conn:
        await conn.execute(sa.text("SELECT 1"))

    yield  # Application runs here

    # Shutdown: cleanly close all connections
    await engine.dispose()
    engine = None
    async_session_factory = None


app = FastAPI(lifespan=lifespan)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Per-request session with automatic commit/rollback."""
    if async_session_factory is None:
        raise RuntimeError("Database not initialized")

    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Verifies both app and database are healthy."""
    import sqlalchemy as sa

    result = await db.execute(sa.text("SELECT 1"))
    return {"status": "healthy", "db": result.scalar() == 1}
```

**Why `lifespan` over `on_event`:**

| Feature | `@app.on_event` (deprecated) | `lifespan` context manager |
|---------|------------------------------|---------------------------|
| Cleanup guarantee | No (if startup fails, shutdown may not run) | Yes (context manager ensures it) |
| Shared state | Globals only | Can use `app.state` or closure |
| Testing | Hard to mock | Easy to replace lifespan in tests |
| FastAPI docs | Deprecated since 0.93 | Recommended approach |

**Critical edge case:** If you forget `await engine.dispose()` on shutdown, connections may leak to the database, eventually hitting `max_connections` on the PostgreSQL server.

> **Why the interviewer asks this:** Connection lifecycle mismanagement causes production outages. They want to see you handle startup, shutdown, and error paths.

> **Follow-up:** "How would you write an integration test that uses this lifespan with a test database?"

---

### Q13 (Debugging): Your async FastAPI app throws `MissingGreenlet` errors intermittently. Diagnose and fix.

**Answer:**

**The error:**

```
sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called;
can't call await_only() here. Was IO attempted in an unexpected place?
```

**Root cause:** You are accessing a lazy-loaded relationship or expired attribute outside of an async context where SQLAlchemy can issue a database query.

**Common triggers and fixes:**

**Trigger 1: Accessing a relationship after commit with `expire_on_commit=True`**

```python
# BUG
async def create_order(db: AsyncSession):
    order = Order(user_id=1)
    db.add(order)
    await db.commit()
    # expire_on_commit=True (default) expires all attributes
    # Accessing order.user triggers a lazy load -> MissingGreenlet
    return {"user": order.user.name}  # BOOM

# FIX 1: Set expire_on_commit=False
session_factory = async_sessionmaker(engine, expire_on_commit=False)

# FIX 2: Eagerly load before commit
from sqlalchemy.orm import selectinload

stmt = select(Order).options(selectinload(Order.user)).where(Order.id == order_id)
result = await db.execute(stmt)
order = result.scalar_one()
```

**Trigger 2: Lazy relationship access in a Pydantic serializer**

```python
# BUG -- Pydantic model_validate triggers lazy load
class OrderResponse(BaseModel):
    user_name: str

    @classmethod
    def from_orm(cls, order: Order):
        return cls(user_name=order.user.name)  # lazy load -> BOOM

# FIX: Always use eager loading in queries
stmt = (
    select(Order)
    .options(selectinload(Order.user))
    .where(Order.id == order_id)
)
```

**Trigger 3: Accessing attributes in a background thread**

```python
# BUG -- running ORM code in a thread pool
import asyncio

async def handler(db: AsyncSession):
    order = await db.get(Order, 1)
    # This runs in a thread where there is no async greenlet
    name = await asyncio.to_thread(lambda: order.user.name)  # BOOM

# FIX: Load everything you need before leaving the async context
async def handler(db: AsyncSession):
    stmt = select(Order).options(selectinload(Order.user)).where(Order.id == 1)
    result = await db.execute(stmt)
    order = result.scalar_one()
    # Now order.user is already loaded -- safe to access anywhere
    name = order.user.name
```

**Prevention checklist:**

1. Set `expire_on_commit=False` on all async session factories.
2. Use `selectinload()` or `joinedload()` for any relationship you plan to access.
3. Set `lazy="raise"` on relationships to catch missing eager loads during development.
4. Never pass ORM objects to background threads without fully loading them first.

> **Why the interviewer asks this:** `MissingGreenlet` is the most common async SQLAlchemy production bug. They want to see you know the root cause, not just the workaround.

> **Follow-up:** "What is the difference between `selectinload` and `joinedload`, and when do you prefer each?"

---

### Q14 (Case Study): You are migrating a sync FastAPI app (50 endpoints, SQLAlchemy) to fully async. Outline your strategy.

**Answer:**

**Phase 0: Preparation (1-2 days)**

```
- Audit all endpoints: categorize as CPU-bound vs IO-bound
- IO-bound endpoints benefit from async; CPU-bound do not
- Inventory all ORM relationship access patterns (lazy loads = problems)
- Set up async test infrastructure
```

**Phase 1: Infrastructure swap (no endpoint changes)**

```python
# Before
engine = create_engine("postgresql://...")
SessionLocal = sessionmaker(engine)

# After -- swap the engine and session factory
engine = create_async_engine("postgresql+asyncpg://...")
async_session = async_sessionmaker(engine, expire_on_commit=False)
```

**Phase 2: Migrate the dependency layer**

```python
# Before
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# After
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

**Phase 3: Migrate endpoints in batches (the bulk of the work)**

```python
# Before
@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    return user

# After
@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    return user
```

**Phase 4: Fix all relationship loading**

```python
# Audit and add eager loading everywhere
stmt = (
    select(User)
    .options(
        selectinload(User.orders),
        selectinload(User.orders, Order.items),
    )
    .where(User.id == user_id)
)
```

**Phase 5: Migrate background tasks**

```python
# Sync Celery tasks that use the DB need their own sync sessions
# OR use async Celery with asyncio event loop
```

**Key risks and mitigations:**

| Risk | Mitigation |
|------|-----------|
| MissingGreenlet errors | Set `lazy="raise"` on all relationships during migration to catch issues early |
| Performance regression | Benchmark before/after; async overhead can hurt CPU-bound endpoints |
| Third-party libraries not async | Wrap in `asyncio.to_thread()` for IO-bound libs |
| Test suite breaks | Run sync and async test suites in parallel during migration |

**Timeline for 50 endpoints:** 2-3 weeks with a team of 2, including testing.

> **Why the interviewer asks this:** Migrations are real-world work. They want to see you plan systematically, not just say "add async/await everywhere."

> **Follow-up:** "One of your endpoints calls a sync-only third-party HTTP library. How do you handle it in an async endpoint?"

---

## Section 4: Transactions

### Q15: Explain the four SQL transaction isolation levels with concrete examples of anomalies each prevents.

**Answer:**

| Isolation Level | Dirty Read | Non-repeatable Read | Phantom Read | Performance |
|----------------|-----------|-------------------|-------------|-------------|
| **READ UNCOMMITTED** | Possible | Possible | Possible | Fastest |
| **READ COMMITTED** | Prevented | Possible | Possible | Fast (PostgreSQL default) |
| **REPEATABLE READ** | Prevented | Prevented | Possible (but not in PG) | Medium (MySQL default) |
| **SERIALIZABLE** | Prevented | Prevented | Prevented | Slowest |

**Anomaly examples:**

**Dirty Read (READ UNCOMMITTED):**

```sql
-- Transaction A                    -- Transaction B
BEGIN;
UPDATE accounts SET balance = 0
WHERE id = 1;
                                    BEGIN;
                                    -- Reads uncommitted value: balance = 0
                                    SELECT balance FROM accounts WHERE id = 1;
ROLLBACK;  -- balance reverts to 1000
                                    -- Transaction B acted on data that never existed
                                    COMMIT;
```

**Non-repeatable Read (READ COMMITTED):**

```sql
-- Transaction A                    -- Transaction B
BEGIN;
SELECT balance FROM accounts
WHERE id = 1;  -- Returns 1000
                                    BEGIN;
                                    UPDATE accounts SET balance = 500
                                    WHERE id = 1;
                                    COMMIT;
SELECT balance FROM accounts
WHERE id = 1;  -- Returns 500 (different!)
COMMIT;
```

**Phantom Read (REPEATABLE READ in MySQL):**

```sql
-- Transaction A                    -- Transaction B
BEGIN;
SELECT COUNT(*) FROM orders
WHERE status = 'pending';  -- 10
                                    BEGIN;
                                    INSERT INTO orders (status)
                                    VALUES ('pending');
                                    COMMIT;
SELECT COUNT(*) FROM orders
WHERE status = 'pending';  -- 11 (phantom row!)
COMMIT;
```

**Setting isolation in SQLAlchemy:**

```python
from sqlalchemy import create_engine

# Engine-level default
engine = create_engine(url, isolation_level="REPEATABLE READ")

# Per-transaction override
async with async_session() as session:
    await session.connection(
        execution_options={"isolation_level": "SERIALIZABLE"}
    )
    # This transaction runs at SERIALIZABLE
```

**PostgreSQL special behavior:** PG's REPEATABLE READ actually prevents phantom reads too (it uses snapshot isolation internally), making it stronger than the SQL standard requires.

> **Why the interviewer asks this:** Isolation levels directly impact correctness and performance. Many developers default to the DB default without understanding the implications.

> **Follow-up:** "Your app processes financial transfers. Which isolation level do you choose and why?"

---

### Q16 (Coding): Implement optimistic locking in SQLAlchemy to prevent lost updates.

**Answer:**

```python
"""Optimistic locking with a version column."""
from fastapi import FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase

app = FastAPI()


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    price: Mapped[float] = mapped_column()
    stock: Mapped[int] = mapped_column()

    # Version column for optimistic locking
    version_id: Mapped[int] = mapped_column(default=1)

    __mapper_args__ = {
        "version_id_col": version_id,  # SQLAlchemy auto-increments this
    }


@app.put("/products/{product_id}/stock")
async def update_stock(
    product_id: int,
    quantity_change: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Optimistic locking: SQLAlchemy automatically adds
    WHERE version_id = <expected> to the UPDATE.
    If another transaction changed the row, StaleDataError is raised.
    """
    from sqlalchemy.orm.exc import StaleDataError

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    product.stock += quantity_change

    try:
        await db.flush()
    except StaleDataError:
        await db.rollback()
        raise HTTPException(
            409,
            "Conflict: product was modified by another request. Please retry.",
        )

    return {"id": product.id, "stock": product.stock, "version": product.version_id}
```

**What SQLAlchemy generates under the hood:**

```sql
-- Instead of:
UPDATE products SET stock = 95 WHERE id = 1;

-- It generates:
UPDATE products SET stock = 95, version_id = 2
WHERE id = 1 AND version_id = 1;
-- If affected rows = 0, raise StaleDataError
```

**With retry logic for production:**

```python
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, max=1),
    retry=retry_if_exception_type(StaleDataError),
)
async def update_stock_with_retry(
    db_factory: async_sessionmaker,
    product_id: int,
    quantity_change: int,
):
    async with db_factory() as db:
        product = await db.get(Product, product_id)
        product.stock += quantity_change
        await db.commit()
        return product
```

**Optimistic vs Pessimistic locking:**

| Aspect | Optimistic | Pessimistic |
|--------|-----------|-------------|
| Mechanism | Version column, check at write time | `SELECT ... FOR UPDATE`, lock at read time |
| Conflict handling | Detect and retry | Prevent (block other transactions) |
| Best for | Low contention (most updates succeed) | High contention (many concurrent writes to same row) |
| Deadlock risk | None | Yes |
| Throughput | Higher (no locks held) | Lower (locks block readers/writers) |

> **Why the interviewer asks this:** Lost updates are a subtle bug. They want to see you implement a real solution, not just describe the concept.

> **Follow-up:** "When would pessimistic locking (`SELECT FOR UPDATE`) be a better choice?"

---

### Q17: What causes deadlocks in a database and how do you prevent them?

**Answer:**

**Classic deadlock scenario:**

```
Transaction A                      Transaction B
--------------                     --------------
BEGIN;                             BEGIN;
UPDATE accounts SET balance = 900  UPDATE accounts SET balance = 1900
WHERE id = 1;  -- locks row 1     WHERE id = 2;  -- locks row 2

UPDATE accounts SET balance = 1100 UPDATE accounts SET balance = 800
WHERE id = 2;  -- BLOCKED (B holds) WHERE id = 1;  -- BLOCKED (A holds)

-- DEADLOCK: Both waiting for each other
-- Database detects and kills one transaction
```

**Prevention strategies:**

**1. Consistent lock ordering:**

```python
async def transfer(db: AsyncSession, from_id: int, to_id: int, amount: float):
    """Always lock accounts in ID order to prevent deadlocks."""
    first_id, second_id = sorted([from_id, to_id])

    # Lock in consistent order
    first = await db.execute(
        select(Account)
        .where(Account.id == first_id)
        .with_for_update()
    )
    second = await db.execute(
        select(Account)
        .where(Account.id == second_id)
        .with_for_update()
    )

    first_account = first.scalar_one()
    second_account = second.scalar_one()

    if from_id == first_id:
        first_account.balance -= amount
        second_account.balance += amount
    else:
        second_account.balance -= amount
        first_account.balance += amount

    await db.commit()
```

**2. Lock timeouts:**

```python
# PostgreSQL: set a lock timeout to fail fast instead of waiting
await db.execute(sa.text("SET lock_timeout = '5s'"))
```

**3. Reduce transaction scope:**

```python
# BAD: Long transaction holding locks
async def process_order(db, order_id):
    order = await db.execute(select(Order).with_for_update().where(...))
    await send_email(order)      # Holds lock during network call!
    await update_inventory(db)
    await db.commit()

# GOOD: Minimize lock duration
async def process_order(db, order_id):
    order = await db.get(Order, order_id)  # Read without lock
    await send_email(order)                # No lock held

    # Lock only for the critical section
    order = await db.execute(select(Order).with_for_update().where(...))
    await update_inventory(db)
    await db.commit()  # Lock released
```

**4. Use advisory locks for application-level locking:**

```python
async def process_with_advisory_lock(db: AsyncSession, resource_id: int):
    """PostgreSQL advisory lock -- does not lock any table row."""
    await db.execute(sa.text(f"SELECT pg_advisory_xact_lock({resource_id})"))
    # Only one transaction at a time can hold this lock for this resource_id
    # Lock is released when the transaction ends
    ...
```

> **Why the interviewer asks this:** Deadlocks are a production reality. Prevention through lock ordering and scope reduction is the expected answer.

> **Follow-up:** "How would you detect deadlocks in production? What monitoring would you set up?"

---

### Q18 (Debugging): This transfer endpoint sometimes loses money. Find the bug.

```python
@app.post("/transfer")
async def transfer(from_id: int, to_id: int, amount: float, db: AsyncSession = Depends(get_db)):
    sender = await db.get(Account, from_id)
    receiver = await db.get(Account, to_id)

    if sender.balance < amount:
        raise HTTPException(400, "Insufficient funds")

    sender.balance -= amount
    receiver.balance += amount
    await db.commit()
    return {"status": "ok"}
```

**Answer:**

**The bug: race condition due to missing locks (TOCTOU -- Time of Check to Time of Use).**

Two concurrent transfers from the same account can both pass the balance check before either writes:

```
Request A: sender.balance = 1000, amount = 800 -> passes check
Request B: sender.balance = 1000, amount = 800 -> passes check
Request A: balance = 1000 - 800 = 200 -> committed
Request B: balance = 1000 - 800 = 200 -> committed (OVERWRITES A's result)
Result: 1600 was sent but only 800 was deducted
```

**Fix -- use `SELECT FOR UPDATE` (pessimistic locking):**

```python
@app.post("/transfer")
async def transfer(
    from_id: int,
    to_id: int,
    amount: float,
    db: AsyncSession = Depends(get_db),
):
    # Lock ordering prevents deadlocks
    first_id, second_id = sorted([from_id, to_id])

    result = await db.execute(
        select(Account)
        .where(Account.id.in_([first_id, second_id]))
        .order_by(Account.id)
        .with_for_update()  # Locks the rows until commit
    )
    accounts = {a.id: a for a in result.scalars().all()}

    sender = accounts[from_id]
    receiver = accounts[to_id]

    if sender.balance < amount:
        raise HTTPException(400, "Insufficient funds")

    sender.balance -= amount
    receiver.balance += amount
    await db.commit()
    return {"status": "ok"}
```

**Additional bugs in the original code:**

1. **`float` for money:** Use `Decimal` or integer cents to avoid floating-point errors.
2. **No idempotency key:** Retries could cause double transfers. Add a unique transfer ID.
3. **No audit trail:** Financial transactions need a transaction log table.

> **Why the interviewer asks this:** This is a classic concurrency bug that even experienced developers miss. They want to see you identify the race condition and apply the correct fix.

> **Follow-up:** "How would you make this endpoint idempotent so retries are safe?"

---

### Q19 (Case Study): Design the transaction strategy for an order processing system that involves inventory, payments, and notifications.

**Answer:**

```python
"""
Saga pattern for distributed transactions.
Each step has a compensating action for rollback.
"""
from enum import Enum
from dataclasses import dataclass
from typing import Optional


class OrderStatus(str, Enum):
    PENDING = "pending"
    INVENTORY_RESERVED = "inventory_reserved"
    PAYMENT_CHARGED = "payment_charged"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SagaStep:
    name: str
    action: str       # function name
    compensation: str  # rollback function name


ORDER_SAGA = [
    SagaStep("reserve_inventory", "reserve_stock", "release_stock"),
    SagaStep("charge_payment", "charge_card", "refund_card"),
    SagaStep("send_notification", "send_order_email", "noop"),
]


async def execute_order_saga(
    db: AsyncSession,
    order_id: int,
    redis: Redis,
) -> dict:
    """
    Executes the order saga with compensating transactions.
    Uses a local DB transaction for each step + Redis for idempotency.
    """
    completed_steps: list[SagaStep] = []

    try:
        # Step 1: Reserve inventory (DB transaction with row lock)
        async with db.begin_nested():  # SAVEPOINT
            order = await db.execute(
                select(Order).where(Order.id == order_id).with_for_update()
            )
            order = order.scalar_one()

            for item in order.items:
                product = await db.execute(
                    select(Product)
                    .where(Product.id == item.product_id)
                    .with_for_update()
                )
                product = product.scalar_one()
                if product.stock < item.quantity:
                    raise InsufficientStockError(product.id)
                product.stock -= item.quantity

            order.status = OrderStatus.INVENTORY_RESERVED
            completed_steps.append(ORDER_SAGA[0])

        # Step 2: Charge payment (external API call -- not in DB transaction)
        payment_result = await payment_service.charge(
            order.payment_method_id,
            order.total,
            idempotency_key=f"order-{order_id}",
        )
        if not payment_result.success:
            raise PaymentFailedError(payment_result.error)

        order.status = OrderStatus.PAYMENT_CHARGED
        order.payment_id = payment_result.transaction_id
        completed_steps.append(ORDER_SAGA[1])
        await db.flush()

        # Step 3: Send notification (async, non-critical)
        await notification_queue.enqueue(
            "order_confirmation",
            order_id=order_id,
            email=order.user.email,
        )
        completed_steps.append(ORDER_SAGA[2])

        order.status = OrderStatus.COMPLETED
        await db.commit()
        return {"status": "completed", "order_id": order_id}

    except Exception as e:
        # Compensate in reverse order
        for step in reversed(completed_steps):
            try:
                if step.name == "reserve_inventory":
                    await release_stock(db, order_id)
                elif step.name == "charge_payment":
                    await payment_service.refund(
                        order.payment_id,
                        idempotency_key=f"refund-{order_id}",
                    )
            except Exception as comp_error:
                # Log compensation failure for manual intervention
                logger.critical(
                    f"Compensation failed for {step.name}: {comp_error}",
                    extra={"order_id": order_id},
                )

        order.status = OrderStatus.FAILED
        order.failure_reason = str(e)
        await db.commit()
        raise
```

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| Saga pattern over 2PC | Distributed transactions across services (payment API) cannot use DB-level 2PC |
| `begin_nested()` for inventory | Uses SAVEPOINTs so we can roll back inventory without affecting the outer transaction |
| Idempotency keys on payments | Prevents double-charging on retries |
| Notification via queue | Non-critical -- should not block or fail the order |
| Compensations logged as CRITICAL | Failed compensations (e.g., refund failure) need human intervention |

> **Why the interviewer asks this:** System design meets code. They want to see you handle the reality that not everything fits in a single DB transaction.

> **Follow-up:** "What happens if the server crashes between charging the payment and committing the order status? How do you recover?"

---

## Section 5: Redis Caching

### Q20: Compare cache-aside, write-through, and write-behind caching strategies with code examples.

**Answer:**

**Cache-Aside (Lazy Loading) -- most common:**

```python
"""Cache-Aside: Application manages cache explicitly."""
import json
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession


async def get_product(
    product_id: int,
    redis: Redis,
    db: AsyncSession,
) -> dict:
    cache_key = f"product:{product_id}"

    # 1. Check cache first
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. Cache miss -- load from DB
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(404)

    product_data = product.to_dict()

    # 3. Populate cache for next time
    await redis.setex(cache_key, 3600, json.dumps(product_data))  # TTL: 1 hour
    return product_data


async def update_product(
    product_id: int,
    data: dict,
    redis: Redis,
    db: AsyncSession,
) -> dict:
    product = await db.get(Product, product_id)
    for key, value in data.items():
        setattr(product, key, value)
    await db.commit()

    # Invalidate cache (NOT update -- avoids race conditions)
    await redis.delete(f"product:{product_id}")
    return product.to_dict()
```

**Write-Through: Write to cache AND DB synchronously:**

```python
"""Write-Through: Every write updates both DB and cache atomically."""


async def update_product_write_through(
    product_id: int,
    data: dict,
    redis: Redis,
    db: AsyncSession,
) -> dict:
    product = await db.get(Product, product_id)
    for key, value in data.items():
        setattr(product, key, value)
    await db.commit()

    product_data = product.to_dict()

    # Update cache synchronously -- caller waits for both DB and cache
    await redis.setex(
        f"product:{product_id}",
        3600,
        json.dumps(product_data),
    )
    return product_data
```

**Write-Behind (Write-Back): Write to cache immediately, flush to DB asynchronously:**

```python
"""Write-Behind: Write to cache first, async flush to DB."""
from celery import Celery

celery_app = Celery("tasks", broker="redis://localhost:6379/1")


async def update_product_write_behind(
    product_id: int,
    data: dict,
    redis: Redis,
) -> dict:
    cache_key = f"product:{product_id}"

    # 1. Update cache immediately (fast response to client)
    cached = await redis.get(cache_key)
    product_data = json.loads(cached) if cached else {}
    product_data.update(data)
    await redis.setex(cache_key, 3600, json.dumps(product_data))

    # 2. Queue async DB write (eventual consistency)
    flush_to_db.delay(product_id, data)
    return product_data


@celery_app.task(bind=True, max_retries=3)
def flush_to_db(self, product_id: int, data: dict):
    """Background task to persist cache changes to DB."""
    try:
        with SessionLocal() as db:
            product = db.get(Product, product_id)
            for key, value in data.items():
                setattr(product, key, value)
            db.commit()
    except Exception as exc:
        self.retry(exc=exc, countdown=2 ** self.request.retries)
```

**Comparison:**

| Strategy | Read Perf | Write Perf | Consistency | Data Loss Risk | Use Case |
|----------|-----------|-----------|-------------|---------------|----------|
| **Cache-Aside** | Fast (after warm-up) | Normal (DB only) | Strong (invalidate on write) | None | General purpose, read-heavy |
| **Write-Through** | Fast | Slower (write to both) | Strong | None | Read-heavy, cache always warm |
| **Write-Behind** | Fast | Fastest (cache only) | Eventual | Yes (cache crash = lost writes) | Write-heavy, can tolerate loss |

> **Why the interviewer asks this:** Caching strategy choice directly impacts system behavior. They want to see you match the strategy to the workload.

> **Follow-up:** "How do you handle the thundering herd problem when a popular cache key expires?"

---

### Q21: How do you handle cache invalidation in a distributed system? What is the thundering herd problem?

**Answer:**

**Cache invalidation strategies:**

**1. TTL-based expiration (simplest):**

```python
await redis.setex("product:1", 300, data)  # expires in 5 minutes
# Pro: Simple, self-healing
# Con: Stale data for up to TTL duration
```

**2. Event-driven invalidation (most consistent):**

```python
async def update_product(product_id: int, data: dict, db: AsyncSession, redis: Redis):
    """Invalidate immediately on write."""
    await db.commit()
    await redis.delete(f"product:{product_id}")

    # Also invalidate related caches
    await redis.delete(f"product_list:category:{product.category_id}")

    # Publish event for other services
    await redis.publish("cache_invalidation", json.dumps({
        "type": "product_updated",
        "id": product_id,
    }))
```

**3. Version-based invalidation:**

```python
async def get_product_versioned(product_id: int, redis: Redis, db: AsyncSession):
    """Cache key includes version -- new version = automatic miss."""
    version = await redis.get(f"product_version:{product_id}")
    cache_key = f"product:{product_id}:v{version}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    product = await db.get(Product, product_id)
    await redis.setex(cache_key, 3600, json.dumps(product.to_dict()))
    return product.to_dict()


async def invalidate_product(product_id: int, redis: Redis):
    """Increment version instead of deleting -- old keys expire via TTL."""
    await redis.incr(f"product_version:{product_id}")
```

**Thundering herd problem and solutions:**

When a popular cache key expires, hundreds of concurrent requests all miss the cache simultaneously and hit the database:

```python
# SOLUTION 1: Lock-based cache refresh (recommended)
async def get_with_lock(key: str, redis: Redis, db: AsyncSession):
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)

    # Try to acquire a refresh lock (only one request rebuilds the cache)
    lock_key = f"lock:{key}"
    acquired = await redis.set(lock_key, "1", nx=True, ex=10)

    if acquired:
        try:
            # This request rebuilds the cache
            data = await fetch_from_db(db, key)
            await redis.setex(key, 3600, json.dumps(data))
            return data
        finally:
            await redis.delete(lock_key)
    else:
        # Another request is rebuilding -- wait and retry
        await asyncio.sleep(0.1)
        return await get_with_lock(key, redis, db)


# SOLUTION 2: Stale-while-revalidate
async def get_with_stale(key: str, redis: Redis, db: AsyncSession):
    """Return stale data while refreshing in background."""
    cached = await redis.get(key)
    ttl = await redis.ttl(key)

    if cached and ttl > 60:  # Fresh enough
        return json.loads(cached)

    if cached:
        # Stale but usable -- return it and refresh in background
        asyncio.create_task(refresh_cache(key, redis, db))
        return json.loads(cached)

    # True miss -- must wait for DB
    return await refresh_cache(key, redis, db)
```

> **Why the interviewer asks this:** "There are only two hard things in CS: cache invalidation and naming things." This is a direct test of that.

> **Follow-up:** "How would you cache paginated list results? What invalidation challenges does that create?"

---

### Q22 (Coding): Implement a Redis-backed rate limiter for a FastAPI endpoint using the sliding window algorithm.

**Answer:**

```python
"""Sliding window rate limiter using Redis sorted sets."""
import time
from fastapi import FastAPI, Request, HTTPException, Depends
from redis.asyncio import Redis

app = FastAPI()


class SlidingWindowRateLimiter:
    """
    Sliding window using Redis sorted sets.
    Each request is a member with its timestamp as the score.
    """

    def __init__(self, redis: Redis, max_requests: int, window_seconds: int):
        self.redis = redis
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, key: str) -> tuple[bool, dict]:
        now = time.time()
        window_start = now - self.window_seconds
        pipe = self.redis.pipeline()

        # 1. Remove expired entries (outside the window)
        pipe.zremrangebyscore(key, 0, window_start)

        # 2. Count current entries in window
        pipe.zcard(key)

        # 3. Add current request
        pipe.zadd(key, {f"{now}": now})

        # 4. Set TTL on the key to auto-cleanup
        pipe.expire(key, self.window_seconds)

        results = await pipe.execute()
        request_count = results[1]

        remaining = max(0, self.max_requests - request_count - 1)
        reset_at = int(now + self.window_seconds)

        if request_count >= self.max_requests:
            # Remove the entry we just added (request denied)
            await self.redis.zrem(key, f"{now}")
            return False, {
                "X-RateLimit-Limit": str(self.max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_at),
                "Retry-After": str(self.window_seconds),
            }

        return True, {
            "X-RateLimit-Limit": str(self.max_requests),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_at),
        }


# Dependency
async def get_redis() -> Redis:
    return Redis(host="localhost", port=6379, decode_responses=True)


async def rate_limit(
    request: Request,
    redis: Redis = Depends(get_redis),
):
    limiter = SlidingWindowRateLimiter(redis, max_requests=100, window_seconds=60)
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}"

    allowed, headers = await limiter.is_allowed(key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers=headers,
        )
    # Attach headers to response (via middleware or response model)
    request.state.rate_limit_headers = headers


@app.get("/api/data", dependencies=[Depends(rate_limit)])
async def get_data():
    return {"message": "Here is your data"}
```

**Why sorted sets over simple counters:**

| Approach | Accuracy | Memory | Complexity |
|----------|----------|--------|-----------|
| Fixed window counter (`INCR`) | Low (boundary burst) | Low | O(1) |
| Sliding window log (sorted set) | High | Higher | O(log N) |
| Sliding window counter (hybrid) | Medium | Low | O(1) |

The fixed-window approach allows 2x the rate at window boundaries (e.g., 100 requests at second 59 and 100 more at second 61). The sorted set approach gives true sliding-window accuracy.

> **Why the interviewer asks this:** Rate limiting is a practical Redis use case that tests knowledge of data structures and atomicity.

> **Follow-up:** "How would you implement distributed rate limiting across multiple API gateway instances?"

---

### Q23: What Redis data structures would you use for these scenarios?

**Answer:**

| Scenario | Data Structure | Why | Example Command |
|----------|---------------|-----|-----------------|
| Session storage | **String** (or Hash) | Simple key-value with TTL | `SETEX session:abc token 3600` |
| User profile cache | **Hash** | Partial reads/updates without deserializing | `HSET user:1 name Alice email a@b.com` |
| Leaderboard | **Sorted Set** | O(log N) rank queries | `ZADD leaderboard 9500 player:1` |
| Task queue | **List** | FIFO with blocking pop | `LPUSH queue task1; BRPOP queue 0` |
| Unique visitors | **HyperLogLog** | Probabilistic counting, 12KB per counter | `PFADD visitors:today ip1 ip2` |
| Feature flags | **String** (bitmap) | Memory-efficient boolean per user | `SETBIT feature:dark_mode 12345 1` |
| Rate limiting | **Sorted Set** | Sliding window with timestamps | `ZADD rate:ip 1679000000 req1` |
| Pub/Sub notifications | **Streams** | Persistent, consumer groups, replay | `XADD events * type order_created` |
| Mutual friends | **Set** | Set intersection in O(N) | `SINTER friends:1 friends:2` |
| Recent activity feed | **Sorted Set** (or List) | Time-ordered, capped | `ZADD feed:user1 timestamp activity` |

**Deep dive -- Redis Streams for event sourcing:**

```python
"""Using Redis Streams for order events."""
import redis.asyncio as redis


async def publish_order_event(r: redis.Redis, order_id: int, event_type: str):
    """Append event to a stream."""
    await r.xadd(
        "orders:events",
        {
            "order_id": str(order_id),
            "type": event_type,
            "timestamp": str(time.time()),
        },
        maxlen=100000,  # Cap stream length
    )


async def consume_order_events(r: redis.Redis, consumer_group: str, consumer_name: str):
    """Consumer group -- each event processed by exactly one consumer."""
    # Create consumer group (idempotent)
    try:
        await r.xgroup_create("orders:events", consumer_group, id="0", mkstream=True)
    except redis.ResponseError:
        pass  # Group already exists

    while True:
        messages = await r.xreadgroup(
            consumer_group,
            consumer_name,
            {"orders:events": ">"},  # Only new messages
            count=10,
            block=5000,  # Wait up to 5 seconds
        )
        for stream, entries in messages:
            for msg_id, data in entries:
                await process_event(data)
                await r.xack("orders:events", consumer_group, msg_id)
```

> **Why the interviewer asks this:** Redis knowledge separates "I used Redis as a cache" from "I understand Redis as a data platform."

> **Follow-up:** "When would you use Redis Streams over Kafka for event streaming?"

---

### Q24 (Debugging): Your Redis cache hit rate dropped from 95% to 40% overnight. How do you investigate?

**Answer:**

**Investigation playbook:**

**Step 1: Check Redis memory and eviction:**

```bash
redis-cli INFO memory
# Look for: used_memory_peak, maxmemory, maxmemory_policy

redis-cli INFO stats
# Look for: evicted_keys (if > 0, Redis is evicting due to memory pressure)
```

If `evicted_keys` is climbing, Redis ran out of memory and is evicting keys using its eviction policy (`allkeys-lru`, `volatile-lru`, etc.).

**Step 2: Check key expiration patterns:**

```bash
# Did someone deploy a change that set short TTLs?
redis-cli DEBUG OBJECT "product:1"
# Look at the TTL

redis-cli TTL "product:1"
# If -1 (no TTL) -> keys never expire (expected for some patterns)
# If very short -> recently changed
```

**Step 3: Analyze keyspace:**

```bash
redis-cli INFO keyspace
# db0:keys=1000,expires=900,avg_ttl=300000
# Compare with yesterday's snapshot
```

**Step 4: Check for cache-busting deployments:**

```python
# Common cause: a deployment changed the cache key format
# Before: f"product:{id}"
# After:  f"product:v2:{id}"
# Result: All existing keys become orphans, 100% cache miss
```

**Step 5: Check client connection count:**

```bash
redis-cli INFO clients
# connected_clients: if this spiked, a new service may be flooding Redis
```

**Step 6: Monitor slow queries:**

```bash
redis-cli SLOWLOG GET 10
# Look for KEYS * or other O(N) commands that block Redis
```

**Most common root causes:**

| Cause | Hit Rate Impact | Fix |
|-------|----------------|-----|
| Memory pressure + eviction | Gradual drop | Increase maxmemory or optimize key sizes |
| Cache key format change (deploy) | Immediate drop to ~0% | Fix key format or warm cache |
| TTL accidentally reduced | Gradual drop | Audit TTL settings |
| New feature writing large keys | Sudden drop (memory) | Set per-key size limits |
| Redis failover to empty replica | Instant drop to 0% | Ensure replicas are warm before promotion |

> **Why the interviewer asks this:** Debugging production cache issues is a real skill. They want to see a systematic approach, not guessing.

> **Follow-up:** "How would you implement cache warming after a Redis failover?"

---

## Section 6: Message Queues (Celery)

### Q25: Set up Celery with FastAPI including task routing, retries, and dead-letter handling.

**Answer:**

```python
"""Complete Celery setup with FastAPI."""
# celery_app.py
from celery import Celery
from kombu import Exchange, Queue

celery_app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

# Task routing -- different queues for different priorities
celery_app.conf.task_queues = (
    Queue("high_priority", Exchange("high_priority"), routing_key="high"),
    Queue("default", Exchange("default"), routing_key="default"),
    Queue("low_priority", Exchange("low_priority"), routing_key="low"),
    Queue("dead_letter", Exchange("dead_letter"), routing_key="dead"),
)

celery_app.conf.task_routes = {
    "app.tasks.send_password_reset": {"queue": "high_priority"},
    "app.tasks.generate_report": {"queue": "low_priority"},
    "app.tasks.*": {"queue": "default"},
}

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,           # ACK after task completes (not before)
    worker_prefetch_multiplier=1,  # Fetch one task at a time (for long tasks)
    task_reject_on_worker_lost=True,
    result_expires=3600,
)
```

```python
# tasks.py
import logging
from celery import Task
from celery_app import celery_app

logger = logging.getLogger(__name__)


class BaseTaskWithRetry(Task):
    """Base task with automatic retry and dead-letter routing."""

    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True        # exponential backoff: 1s, 2s, 4s
    retry_backoff_max = 60      # cap at 60 seconds
    retry_jitter = True         # add randomness to prevent thundering herd

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called after all retries are exhausted -- send to dead letter queue."""
        logger.error(
            f"Task {self.name}[{task_id}] failed permanently: {exc}",
            exc_info=einfo,
        )
        # Route to dead letter queue for manual inspection
        celery_app.send_task(
            "app.tasks.handle_dead_letter",
            args=[self.name, task_id, str(args), str(kwargs), str(exc)],
            queue="dead_letter",
        )


@celery_app.task(base=BaseTaskWithRetry, bind=True)
def send_email(self, to: str, subject: str, body: str):
    """Send email with automatic retries on failure."""
    try:
        email_service.send(to=to, subject=subject, body=body)
    except ConnectionError as exc:
        # Specific retry with custom countdown
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(base=BaseTaskWithRetry, bind=True)
def generate_report(self, report_id: int):
    """Long-running report generation."""
    self.update_state(state="PROGRESS", meta={"percent": 0})
    # ... processing ...
    self.update_state(state="PROGRESS", meta={"percent": 50})
    # ... more processing ...
    return {"report_url": f"/reports/{report_id}.pdf"}


@celery_app.task
def handle_dead_letter(task_name, task_id, args, kwargs, error):
    """Process dead-lettered tasks -- log, alert, or store for retry."""
    logger.critical(
        f"Dead letter: {task_name}[{task_id}] args={args} error={error}"
    )
    # Store in DB for admin dashboard
    with SessionLocal() as db:
        db.add(FailedTask(
            task_name=task_name,
            task_id=task_id,
            args=args,
            kwargs=kwargs,
            error=error,
        ))
        db.commit()
```

```python
# FastAPI integration
from fastapi import FastAPI
from celery.result import AsyncResult

app = FastAPI()


@app.post("/reports/")
async def create_report(report_request: ReportRequest):
    """Trigger async report generation."""
    task = generate_report.delay(report_request.report_id)
    return {"task_id": task.id, "status_url": f"/tasks/{task.id}"}


@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Poll task status."""
    result = AsyncResult(task_id, app=celery_app)
    response = {
        "task_id": task_id,
        "status": result.status,
    }
    if result.status == "PROGRESS":
        response["progress"] = result.info
    elif result.status == "SUCCESS":
        response["result"] = result.result
    elif result.status == "FAILURE":
        response["error"] = str(result.result)
    return response
```

> **Why the interviewer asks this:** Message queues are essential infrastructure. They want to see you handle routing, retries, and failure modes.

> **Follow-up:** "What happens if the Celery worker crashes mid-task? How does `acks_late` help?"

---

### Q26: Compare Celery with Redis broker vs RabbitMQ broker. When do you choose which?

**Answer:**

| Feature | Redis Broker | RabbitMQ Broker |
|---------|-------------|-----------------|
| **Setup complexity** | Minimal (reuse existing Redis) | Separate service to manage |
| **Message durability** | Optional (AOF/RDB persistence) | Built-in (disk-backed queues) |
| **Message ordering** | FIFO within a single list | FIFO per queue, with priority support |
| **Routing** | Basic (queue names only) | Advanced (exchanges, bindings, topics, headers) |
| **Priority queues** | Manual (separate queues) | Native support (up to 255 levels) |
| **Dead letter queues** | Manual implementation | Native DLX (dead letter exchange) |
| **Message acknowledgment** | Basic | Full (ACK, NACK, reject, requeue) |
| **Throughput** | Very high (~100K msg/s) | High (~50K msg/s) |
| **Monitoring** | Redis CLI, limited | RabbitMQ Management UI, detailed |
| **Memory usage** | Keeps all messages in memory | Spills to disk when memory is low |
| **Cluster support** | Redis Cluster | RabbitMQ Cluster + Quorum Queues |

**Choose Redis when:**

```
- You already have Redis in your stack (no new infrastructure)
- Tasks are short-lived and high-throughput
- Message loss is acceptable (or you have other guarantees)
- Simple routing needs (just queue names)
- Small to medium scale
```

**Choose RabbitMQ when:**

```
- Message durability is critical (financial transactions)
- You need complex routing (topic exchanges, header matching)
- You need native dead-letter handling and TTL per message
- Priority queues are required
- You need message-level acknowledgment and redelivery
- Large scale with many consumers and queue types
```

**Production consideration:** For most FastAPI applications, Redis broker is the pragmatic choice because Redis is already in the stack for caching. Switch to RabbitMQ when you outgrow Redis's message queue capabilities.

> **Why the interviewer asks this:** Technology choices should be justified. They want to see you reason about trade-offs, not just pick the one you know.

> **Follow-up:** "How do you handle message ordering guarantees in Celery when using multiple workers?"

---

### Q27 (Coding): Implement an async task pattern with progress tracking and cancellation in FastAPI.

**Answer:**

```python
"""Async task with progress tracking and cancellation."""
from fastapi import FastAPI, HTTPException
from celery import Celery, states
from celery.result import AsyncResult
from redis.asyncio import Redis
import json

app = FastAPI()
celery_app = Celery("tasks", broker="redis://localhost:6379/0", backend="redis://localhost:6379/1")


@celery_app.task(bind=True)
def process_large_dataset(self, dataset_id: int, total_rows: int):
    """
    Long-running task with progress tracking and cancellation support.
    """
    from time import sleep

    for i in range(total_rows):
        # Check for cancellation (revoke signal)
        if self.is_aborted():
            self.update_state(state="CANCELLED", meta={"processed": i})
            return {"status": "cancelled", "processed": i}

        # Simulate row processing
        sleep(0.01)

        # Update progress every 100 rows
        if i % 100 == 0:
            self.update_state(
                state="PROGRESS",
                meta={
                    "processed": i,
                    "total": total_rows,
                    "percent": round((i / total_rows) * 100, 1),
                },
            )

    return {
        "status": "completed",
        "processed": total_rows,
        "output_url": f"/datasets/{dataset_id}/result",
    }


@app.post("/datasets/{dataset_id}/process")
async def start_processing(dataset_id: int, total_rows: int = 10000):
    """Start async processing job."""
    task = process_large_dataset.delay(dataset_id, total_rows)

    # Store task metadata in Redis for fast lookup
    redis = Redis(host="localhost", port=6379, decode_responses=True)
    await redis.hset(
        f"job:{dataset_id}",
        mapping={"task_id": task.id, "status": "started"},
    )
    await redis.close()

    return {
        "task_id": task.id,
        "status_url": f"/datasets/{dataset_id}/status",
        "cancel_url": f"/datasets/{dataset_id}/cancel",
    }


@app.get("/datasets/{dataset_id}/status")
async def get_processing_status(dataset_id: int):
    """Get real-time progress of a processing job."""
    redis = Redis(host="localhost", port=6379, decode_responses=True)
    job_meta = await redis.hgetall(f"job:{dataset_id}")
    await redis.close()

    if not job_meta:
        raise HTTPException(404, "No job found for this dataset")

    result = AsyncResult(job_meta["task_id"], app=celery_app)

    response = {"task_id": result.id, "status": result.status}

    if result.status == "PROGRESS":
        response["progress"] = result.info
    elif result.status == "SUCCESS":
        response["result"] = result.result
    elif result.status == "FAILURE":
        response["error"] = str(result.result)
    elif result.status == "CANCELLED":
        response["info"] = result.info

    return response


@app.post("/datasets/{dataset_id}/cancel")
async def cancel_processing(dataset_id: int):
    """Cancel a running processing job."""
    redis = Redis(host="localhost", port=6379, decode_responses=True)
    job_meta = await redis.hgetall(f"job:{dataset_id}")
    await redis.close()

    if not job_meta:
        raise HTTPException(404, "No job found for this dataset")

    task_id = job_meta["task_id"]

    # Revoke the task
    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")

    return {"task_id": task_id, "status": "cancellation_requested"}
```

**Important caveats about task cancellation:**

| Method | Behavior | Use When |
|--------|----------|----------|
| `revoke(terminate=False)` | Prevents task from starting if still in queue | Task has not started yet |
| `revoke(terminate=True, signal='SIGTERM')` | Sends SIGTERM to the worker process | Task is running, need graceful stop |
| `AbortableTask` + `self.is_aborted()` | Cooperative cancellation via shared state | Task checks periodically, cleanest approach |

> **Why the interviewer asks this:** Long-running tasks need progress and cancellation. This tests practical Celery knowledge beyond basic `delay()`.

> **Follow-up:** "How do you handle a task that must clean up resources (temporary files, partial DB writes) when cancelled?"

---

### Q28 (Conceptual): When would you use Celery vs native asyncio vs a dedicated queue service like SQS?

**Answer:**

| Solution | Best For | Limitations |
|----------|----------|-------------|
| **Native `asyncio` (Background Tasks)** | Quick, fire-and-forget work within the same process | Lost if server restarts; no retries; no persistence |
| **Celery** | Reliable background jobs with retries, scheduling, routing | Infrastructure overhead; not ideal for sub-second latency |
| **AWS SQS / GCP Pub/Sub** | Cross-service communication, serverless, massive scale | Higher latency; vendor lock-in; no built-in scheduling |

**Decision framework:**

```
Task duration < 1 second AND loss is acceptable?
    -> FastAPI BackgroundTasks (simplest)

Task needs retries, scheduling, or survives server restart?
    -> Celery (self-hosted) or cloud queue (managed)

Cross-service event-driven architecture?
    -> SQS/SNS, Kafka, or cloud Pub/Sub

Need exactly-once processing?
    -> Kafka (with transactions) or SQS FIFO

Need complex workflows (DAGs)?
    -> Celery Canvas (chains, chords, groups)
```

**FastAPI BackgroundTasks (simplest, no guarantees):**

```python
from fastapi import BackgroundTasks

@app.post("/users/")
async def create_user(user: UserCreate, bg: BackgroundTasks):
    db_user = await create_user_in_db(user)
    # Runs after response is sent, in the same process
    bg.add_task(send_welcome_email, db_user.email)
    return db_user
```

**When BackgroundTasks is NOT enough:**

1. The task takes more than a few seconds (blocks the worker)
2. The task must retry on failure
3. The task must survive server restarts
4. You need to track task status
5. You need task scheduling (run at 2 AM daily)

> **Why the interviewer asks this:** Overengineering is as bad as underengineering. They want to see you pick the simplest tool that meets the requirements.

> **Follow-up:** "You have a FastAPI app on Kubernetes. How would you run Celery workers alongside it?"

---

## Section 7: Connection Pooling

### Q29: Why does connection pooling matter, and how does SQLAlchemy manage it?

**Answer:**

**Why pooling matters:**

Creating a new database connection involves:
1. TCP handshake (1 round trip)
2. TLS negotiation (2 round trips, if using SSL)
3. PostgreSQL authentication (1-2 round trips)
4. Connection initialization (SET statements)

**Without pooling:** ~5-20ms per connection setup. At 1000 requests/second, that is 5-20 seconds of pure overhead per second, which is impossible.

**With pooling:** Connections are reused. A request borrows a connection (~0.01ms) and returns it when done.

**SQLAlchemy pool configuration:**

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost:5432/mydb",

    # Core pool settings
    pool_size=20,          # Number of persistent connections
    max_overflow=10,       # Extra connections allowed during bursts (total max: 30)
    pool_timeout=30,       # Seconds to wait for a connection before raising error
    pool_recycle=1800,     # Recycle connections every 30 min (prevents stale connections)
    pool_pre_ping=True,    # Send "SELECT 1" before using a connection (detects dead ones)

    # Connection-level settings
    connect_args={
        "server_settings": {
            "statement_timeout": "30000",     # 30s query timeout
            "idle_in_transaction_session_timeout": "60000",  # 60s idle-in-txn timeout
        }
    },
)
```

**How the pool works internally:**

```
Request arrives
    |
    v
Pool has idle connection? --YES--> Borrow it (0.01ms)
    |
    NO
    |
    v
Pool size < pool_size + max_overflow? --YES--> Create new connection (5-20ms)
    |
    NO
    |
    v
Wait up to pool_timeout seconds
    |
    v
Still no connection? ---> Raise TimeoutError
```

**Pool types in SQLAlchemy:**

| Pool Type | Behavior | Use Case |
|-----------|----------|----------|
| `QueuePool` (default) | Fixed size, FIFO | Most applications |
| `NullPool` | No pooling, new connection per request | Serverless (Lambda), PgBouncer in front |
| `StaticPool` | Single shared connection | Testing only |
| `AsyncAdaptedQueuePool` | QueuePool for async engines | Async SQLAlchemy (default) |

**When to use `NullPool`:**

```python
# Serverless environment (AWS Lambda) -- each invocation is isolated
# OR when PgBouncer handles pooling externally
engine = create_async_engine(url, poolclass=NullPool)
```

> **Why the interviewer asks this:** Connection pooling is invisible until it breaks. They want to see you understand the mechanics, not just "use the default."

> **Follow-up:** "How do you size `pool_size` for a FastAPI app running with 4 Uvicorn workers?"

---

### Q30 (Debugging): Your FastAPI app intermittently throws "QueuePool limit reached" errors. Diagnose and fix.

**Answer:**

**The error:**

```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached,
connection timed out, timeout 30
```

**Root causes, systematically:**

**1. Connection leak -- sessions not being closed:**

```python
# BUG: Exception path skips session close
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    session = async_session_factory()
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(404)  # Session never closed!
    await session.close()
    return user

# FIX: Always use context manager or Depends
@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)  # Depends cleanup closes session
    return user
```

**2. Long-running transactions holding connections:**

```python
# BUG: Holding a connection during an external API call
async def process_order(db: AsyncSession):
    order = await db.get(Order, 1)
    # This HTTP call takes 5-30 seconds, connection is held the entire time
    payment = await httpx.post("https://payment-api.com/charge", ...)
    order.status = "paid"
    await db.commit()

# FIX: Release connection before external calls
async def process_order(db: AsyncSession):
    order = await db.get(Order, 1)
    order_id = order.id

    await db.close()  # Release connection

    payment = await httpx.post("https://payment-api.com/charge", ...)

    async with async_session_factory() as db:
        order = await db.get(Order, order_id)
        order.status = "paid"
        await db.commit()
```

**3. Pool size too small for the workload:**

```python
# Diagnosis: Check pool status
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "checkout")
def log_checkout(dbapi_conn, connection_record, connection_proxy):
    logger.info(f"Pool checkout. Checked out: {engine.pool.checkedout()}")

@event.listens_for(engine.sync_engine, "checkin")
def log_checkin(dbapi_conn, connection_record):
    logger.info(f"Pool checkin. Checked out: {engine.pool.checkedout()}")
```

**4. Background tasks sharing the same pool:**

```python
# BUG: Celery tasks and web requests share the same pool
# If Celery tasks are long-running, they exhaust web connections

# FIX: Separate engines for web and background tasks
web_engine = create_async_engine(url, pool_size=20, max_overflow=10)
celery_engine = create_engine(url, pool_size=5, max_overflow=5)
```

**Sizing formula:**

```
pool_size = (number_of_uvicorn_workers * average_concurrent_db_queries_per_worker)
max_overflow = pool_size * 0.5  (for burst capacity)

Example: 4 workers, 5 concurrent queries each = pool_size=20, max_overflow=10
Total max connections = 30 (must be < PostgreSQL max_connections)
```

**Quick diagnosis commands:**

```sql
-- PostgreSQL: Check active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Check who is holding connections
SELECT pid, state, query, query_start, wait_event
FROM pg_stat_activity
WHERE datname = 'mydb'
ORDER BY query_start;

-- Kill idle-in-transaction connections (as last resort)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
AND query_start < now() - interval '5 minutes';
```

> **Why the interviewer asks this:** Pool exhaustion causes outages. They want to see you diagnose systematically and fix the root cause, not just increase pool size.

> **Follow-up:** "How does PgBouncer change your pooling strategy?"

---

### Q31: How does async connection pooling differ from sync pooling, and what pitfalls exist?

**Answer:**

**Key difference:** In sync code, each thread holds one connection at a time. In async code, a single thread can have _many_ concurrent coroutines, each needing a connection simultaneously.

```
Sync (4 threads):
  Thread 1: [--- conn 1 ---]
  Thread 2: [--- conn 2 ---]
  Thread 3: [--- conn 3 ---]
  Thread 4: [--- conn 4 ---]
  Max connections needed: 4

Async (1 thread, 100 concurrent coroutines):
  Coroutine 1:  [--- conn 1 ---]
  Coroutine 2:  [--- conn 2 ---]
  ...
  Coroutine 50: [--- conn 50 ---]   (all running concurrently!)
  Max connections needed: 50 (or whatever your concurrency level is)
```

**Pitfall 1: Underestimating pool size for async:**

```python
# Sync: 4 workers * 1 thread each = 4 connections needed
# Async: 1 worker can handle 100+ concurrent requests = 100 connections needed

# This is too small for async:
engine = create_async_engine(url, pool_size=5, max_overflow=5)

# Better for async:
engine = create_async_engine(url, pool_size=20, max_overflow=30)
```

**Pitfall 2: Blocking calls in async context:**

```python
# BUG: Sync DB call in async handler blocks the entire event loop
@app.get("/users")
async def get_users():
    # This blocks the event loop -- all other requests stall
    with sync_engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM users"))
    return result.fetchall()

# FIX: Use async engine or run_in_executor
@app.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

**Pitfall 3: Connection not returned during `await`:**

```python
# Each `await` that is NOT a DB operation holds the connection idle
async def handler(db: AsyncSession):
    user = await db.get(User, 1)       # Uses connection
    await asyncio.sleep(10)            # Connection idle but checked out for 10s!
    user.name = "updated"
    await db.commit()                  # Uses connection again
```

**asyncpg native pool (bypasses SQLAlchemy pooling):**

```python
import asyncpg

# asyncpg has its own pool optimized for async
pool = await asyncpg.create_pool(
    "postgresql://user:pass@localhost/db",
    min_size=5,
    max_size=20,
    max_inactive_connection_lifetime=300,
    command_timeout=30,
)

async def query_with_pool():
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", 1)
        return dict(row)
```

**When to use asyncpg pool directly vs SQLAlchemy async pool:**

| Factor | asyncpg Pool | SQLAlchemy AsyncAdaptedQueuePool |
|--------|-------------|-------------------------------|
| Performance | ~15% faster (no ORM overhead) | Slightly slower |
| Features | Raw SQL only | Full ORM, relationships, migrations |
| Pool monitoring | Built-in `pool.get_size()`, `pool.get_idle_size()` | Via engine events |
| Health checks | `max_inactive_connection_lifetime` | `pool_pre_ping` |

> **Why the interviewer asks this:** Async pooling is subtle and different from sync. This tests whether you have actually run async in production.

> **Follow-up:** "How many database connections would you configure for a FastAPI app deployed with 2 Uvicorn workers, each handling up to 500 concurrent requests?"

---

### Q32 (Case Study): Design the database infrastructure for a FastAPI service that handles 10K requests/second with mixed read/write workloads.

**Answer:**

**Architecture overview:**

```
                    [Load Balancer]
                    /      |      \
              [FastAPI] [FastAPI] [FastAPI]
               Worker    Worker    Worker
                 |          |         |
            [Connection Pool per worker]
                 |          |         |
              [PgBouncer - connection multiplexer]
               /             \
    [PostgreSQL Primary]  [PostgreSQL Read Replicas x3]
         (writes)              (reads)
              |
        [Redis Cluster]
      (cache + sessions + rate limiting)
              |
        [Celery Workers]
      (background tasks)
```

**Layer 1: Application connection pooling:**

```python
# Each Uvicorn worker gets its own pool
# 4 workers * 25 connections = 100 connections to PgBouncer

write_engine = create_async_engine(
    "postgresql+asyncpg://pgbouncer:6432/mydb",
    pool_size=10,
    max_overflow=15,
    pool_pre_ping=True,
    pool_recycle=1800,
)

# Read replicas behind a load-balancing DNS or HAProxy
read_engine = create_async_engine(
    "postgresql+asyncpg://pgbouncer-reads:6432/mydb",
    pool_size=15,
    max_overflow=20,
    pool_pre_ping=True,
)

# Dependency that routes reads vs writes
async def get_write_db() -> AsyncGenerator[AsyncSession, None]:
    async with write_session_factory() as session:
        yield session

async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    async with read_session_factory() as session:
        yield session
```

**Layer 2: PgBouncer configuration:**

```ini
; pgbouncer.ini
[databases]
mydb = host=primary.db.internal port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction          ; Release connection after each transaction
max_client_conn = 1000           ; Accept up to 1000 app connections
default_pool_size = 50           ; Maintain 50 connections to PostgreSQL
reserve_pool_size = 10           ; Extra connections for burst
reserve_pool_timeout = 3         ; Seconds before using reserve pool
server_idle_timeout = 300        ; Close idle server connections after 5 min
```

**Layer 3: Read/write splitting:**

```python
@app.get("/products/{product_id}")
async def get_product(
    product_id: int,
    read_db: AsyncSession = Depends(get_read_db),
    redis: Redis = Depends(get_redis),
):
    """Read path: cache -> read replica -> primary (fallback)."""
    # Layer 1: Redis cache
    cached = await redis.get(f"product:{product_id}")
    if cached:
        return json.loads(cached)

    # Layer 2: Read replica
    product = await read_db.get(Product, product_id)
    if product:
        await redis.setex(f"product:{product_id}", 300, json.dumps(product.to_dict()))
    return product


@app.put("/products/{product_id}")
async def update_product(
    product_id: int,
    data: ProductUpdate,
    write_db: AsyncSession = Depends(get_write_db),
    redis: Redis = Depends(get_redis),
):
    """Write path: primary DB + cache invalidation."""
    product = await write_db.get(Product, product_id)
    for key, value in data.dict(exclude_unset=True).items():
        setattr(product, key, value)
    await write_db.commit()

    # Invalidate cache
    await redis.delete(f"product:{product_id}")
    return product
```

**Layer 4: Capacity planning:**

```
10K requests/second breakdown:
  - 80% reads (8K/s)
  - 20% writes (2K/s)

Redis cache hit rate 90%:
  - 800 reads/s actually hit the database
  - 2000 writes/s hit the primary

PostgreSQL capacity:
  - Primary: handles 2000 writes/s + overflow reads (easily)
  - 3 read replicas: 800/3 = ~267 reads/s each (very comfortable)

Connection math:
  - 4 Uvicorn workers * 25 pool connections = 100 app connections
  - PgBouncer in transaction mode: multiplexes 100 app connections into 50 PG connections
  - PostgreSQL max_connections = 100 (50 PgBouncer + 50 for admin/monitoring)
```

**Monitoring checklist:**

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Pool checked-out connections | SQLAlchemy events / Prometheus | > 80% of pool_size |
| PgBouncer waiting clients | PgBouncer SHOW POOLS | > 0 for > 5 seconds |
| PostgreSQL active connections | pg_stat_activity | > 80% of max_connections |
| Redis memory usage | Redis INFO | > 80% of maxmemory |
| Cache hit rate | Redis INFO stats | < 85% |
| Query duration p99 | pg_stat_statements | > 500ms |

> **Why the interviewer asks this:** System design at the infrastructure level. They want to see you combine pooling, caching, replication, and capacity planning into a coherent architecture.

> **Follow-up:** "How would you handle a sudden 5x traffic spike with this architecture?"

---

## Quick Reference Cheat Sheet

### SQLAlchemy Async Session Setup

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(url, pool_size=20, max_overflow=10, pool_pre_ping=True)
session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

### Redis Cache Pattern

```python
async def cached_get(key, redis, db, ttl=3600):
    if data := await redis.get(key):
        return json.loads(data)
    data = await fetch_from_db(db, key)
    await redis.setex(key, ttl, json.dumps(data))
    return data
```

### Celery Task with Retry

```python
@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def my_task(self, arg):
    try:
        do_work(arg)
    except TransientError as exc:
        raise self.retry(exc=exc)
```

### Connection Pool Sizing

```
pool_size = num_workers * avg_concurrent_queries_per_worker
max_overflow = pool_size * 0.5
Total DB connections = (pool_size + max_overflow) * num_workers
Ensure total < PostgreSQL max_connections
```

---

> **Next:** [Part 7/7 -- System Design & Architecture Patterns](./07-system-design-architecture.md)
