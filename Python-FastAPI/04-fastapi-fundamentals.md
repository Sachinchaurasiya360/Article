# FastAPI Fundamentals - Interview Preparation (Part 4/7)

---

**Series:** Python + FastAPI - Complete Interview Preparation from Basics to System Design
**Part:** 4 of 7 (FastAPI Basics)
**Audience:** Backend developers preparing for Python/FastAPI interviews at mid-to-senior level
**Prerequisites:** Parts 1-3 (Python Core, OOP, Async/Concurrency)
**Reading time:** ~55 minutes

---

## Recap: Where We Left Off

Parts 1-3 established the Python foundation: core language mechanics, object-oriented patterns, and asynchronous programming with `asyncio`. That async foundation is critical here - FastAPI is built entirely on top of Python's async ecosystem, and interviewers will expect you to connect these concepts seamlessly.

Now we enter FastAPI itself. This part covers the framework's fundamentals: what it is, how routing works, how Pydantic powers validation and serialization, how dependency injection structures real applications, and how middleware intercepts and processes requests. These are the topics that appear in nearly every FastAPI interview, from startups to FAANG.

---

## Table of Contents

1. [Section 1: What is FastAPI & Why Use It](#section-1-what-is-fastapi--why-use-it)
2. [Section 2: Routing & Path/Query Parameters](#section-2-routing--pathquery-parameters)
3. [Section 3: Request & Response Models with Pydantic](#section-3-request--response-models-with-pydantic)
4. [Section 4: Dependency Injection](#section-4-dependency-injection)
5. [Section 5: Validation](#section-5-validation)
6. [Section 6: Middleware Basics](#section-6-middleware-basics)
7. [Bonus: Debugging & Output-Based Questions](#bonus-debugging--output-based-questions)
8. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)
9. [What's Next in Part 5](#whats-next-in-part-5)

---

## Section 1: What is FastAPI & Why Use It

### Q1: What is FastAPI, and what makes it different from Flask and Django?

**Answer:**

FastAPI is a modern, high-performance Python web framework for building APIs, created by Sebastian Ramirez. It is built on top of **Starlette** (for the web layer) and **Pydantic** (for data validation and serialization).

The key differentiators:

| Feature | FastAPI | Flask | Django |
|---|---|---|---|
| **Type hints** | Native, required for validation | Optional, decorative only | Not used for validation |
| **Async support** | First-class (ASGI) | Bolt-on (since Flask 2.0, still WSGI) | Partial (Django 3.1+ ASGI, but ORM is sync) |
| **Data validation** | Automatic via Pydantic | Manual or extensions (Marshmallow, etc.) | Django Forms / DRF Serializers |
| **API docs** | Auto-generated (Swagger + ReDoc) | Manual or Flask-RESTX | DRF has browsable API |
| **Performance** | On par with Node.js / Go frameworks | 2-5x slower for async workloads | 2-5x slower for async workloads |
| **Learning curve** | Moderate (need type hints + async) | Low | High (batteries-included) |
| **ORM** | None built-in (use SQLAlchemy, Tortoise) | None built-in | Django ORM built-in |

```python
# Flask equivalent
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    # No automatic validation, no type safety
    # Must manually parse, validate, serialize
    return jsonify({"user_id": user_id, "name": "Alice"})


# FastAPI equivalent
from fastapi import FastAPI

app = FastAPI()

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    # user_id is automatically validated as int
    # Response is automatically serialized to JSON
    # Swagger docs are generated automatically
    return {"user_id": user_id, "name": "Alice"}
```

FastAPI gives you automatic request validation, automatic API documentation, editor autocompletion, and async performance - all from standard Python type hints.

**Why interviewer asks this:** They want to know if you understand the framework's architecture and can articulate *why* you'd choose it over alternatives, not just that you've used it.

**Follow-up:** "When would you NOT choose FastAPI over Django?"

---

### Q2: Explain ASGI vs WSGI. Why does this matter for FastAPI?

**Answer:**

**WSGI** (Web Server Gateway Interface) is the traditional Python standard for web applications (PEP 3333). It's synchronous and processes one request at a time per worker:

```
Client Request → WSGI Server (Gunicorn) → WSGI App (Flask/Django)
                                           ↓
                                    Synchronous handler
                                    (blocks until complete)
                                           ↓
                                    Response returned
```

**ASGI** (Asynchronous Server Gateway Interface) is the async evolution of WSGI. It supports HTTP, WebSockets, and long-lived connections natively:

```
Client Requests → ASGI Server (Uvicorn) → ASGI App (FastAPI/Starlette)
                                           ↓
                                    async def handler():
                                        await db_query()    # yields control
                                        await api_call()    # yields control
                                        return response
                                           ↓
                                    Event loop handles many
                                    concurrent connections
```

The key difference is concurrency. A WSGI server with 4 workers handles 4 simultaneous requests. An ASGI server with a single worker can handle thousands of concurrent I/O-bound requests because `await` yields control back to the event loop during I/O waits.

```python
# WSGI callable signature (synchronous)
def application(environ: dict, start_response: callable) -> Iterable[bytes]:
    start_response("200 OK", [("Content-Type", "text/plain")])
    return [b"Hello World"]


# ASGI callable signature (asynchronous)
async def application(scope: dict, receive: callable, send: callable):
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [[b"content-type", b"text/plain"]],
    })
    await send({
        "type": "http.response.body",
        "body": b"Hello World",
    })
```

FastAPI is an ASGI framework. It requires an ASGI server like Uvicorn or Hypercorn. This matters because:

1. **Concurrent I/O:** When your endpoint awaits a database call, the event loop serves other requests during the wait.
2. **WebSocket support:** ASGI natively handles WebSocket connections. WSGI cannot.
3. **Background tasks:** ASGI supports background tasks and server-sent events.
4. **Performance:** For I/O-bound APIs (the majority of web APIs), ASGI dramatically outperforms WSGI.

**Important caveat:** FastAPI can also run synchronous `def` endpoints. When it encounters a sync function, it runs it in a threadpool to avoid blocking the event loop. This is why FastAPI works even if you forget `async def` - but it's less efficient.

```python
# FastAPI handles both:
@app.get("/async-endpoint")
async def async_handler():
    # Runs directly on the event loop
    result = await some_async_db_call()
    return result

@app.get("/sync-endpoint")
def sync_handler():
    # Runs in a threadpool (run_in_executor)
    # Still non-blocking for the event loop, but uses a thread
    result = some_sync_db_call()
    return result
```

**Why interviewer asks this:** This tests your understanding of Python's async ecosystem and whether you know why FastAPI is fast. Many candidates use FastAPI without understanding the ASGI layer beneath it.

**Follow-up:** "What happens if you use `def` instead of `async def` for all your endpoints? What are the performance implications?"

---

### Q3: Show me FastAPI performance benchmarks. How does it compare to Node.js and Go?

**Answer:**

In TechEmpower Framework Benchmarks (Round 22) and independent benchmarks, the numbers look roughly like this for simple JSON serialization:

| Framework | Requests/sec (JSON) | Language |
|---|---|---|
| **actix-web** | ~700,000 | Rust |
| **fasthttp** | ~500,000 | Go |
| **gin** | ~350,000 | Go |
| **Express.js** | ~75,000 | Node.js |
| **FastAPI (Uvicorn)** | ~60,000-90,000 | Python |
| **Flask (Gunicorn)** | ~15,000-25,000 | Python |
| **Django (Gunicorn)** | ~10,000-18,000 | Python |

Key insights:

1. **FastAPI is 3-5x faster than Flask/Django** for I/O-bound workloads.
2. **FastAPI approaches Node.js performance** and sometimes exceeds it for async I/O patterns.
3. **Go and Rust still dominate** raw throughput - FastAPI is not a replacement for systems programming.
4. **These benchmarks measure the framework overhead**, not your application logic. In real applications, database queries, external API calls, and business logic dominate latency.

The performance comes from three layers:
- **Uvicorn:** Uses `uvloop` (a Cython wrapper around libuv, the same event loop powering Node.js).
- **Starlette:** Minimal, high-performance ASGI toolkit.
- **Pydantic v2:** Rewritten in Rust, validation is 5-50x faster than Pydantic v1.

```python
# Production deployment for maximum performance
# Command:
# uvicorn main:app --workers 4 --loop uvloop --http httptools

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,        # Multiple worker processes
        loop="uvloop",    # Faster event loop
        http="httptools",  # Faster HTTP parsing
    )
```

**Why interviewer asks this:** To verify you understand where FastAPI's performance comes from and that you don't blindly claim "FastAPI is the fastest." Interviewers want realistic, nuanced understanding.

**Follow-up:** "If FastAPI is I/O-bound optimized, what happens when you have CPU-intensive endpoints? How do you handle that?"

---

### Q4: You have an existing Flask application with 50+ endpoints. Your team wants to migrate to FastAPI. How do you approach this?

**Answer:**

This is a real-world migration scenario. The approach should be incremental, not a big-bang rewrite:

**Phase 1: Run both frameworks simultaneously**

```python
# main.py - Mount Flask inside FastAPI
from fastapi import FastAPI
from fastapi.middleware.wsgi import WSGIMiddleware
from flask_app import flask_app  # existing Flask app

app = FastAPI()

# New endpoints go here (FastAPI)
@app.get("/api/v2/users/{user_id}")
async def get_user_v2(user_id: int):
    return {"user_id": user_id, "version": "v2"}

# Legacy Flask app mounted at a sub-path
app.mount("/api/v1", WSGIMiddleware(flask_app))
```

**Phase 2: Migrate endpoint by endpoint**

Priority order:
1. Endpoints that benefit most from async (high-concurrency, I/O-heavy)
2. Endpoints with complex validation (Pydantic replaces manual validation)
3. Endpoints that need WebSocket support
4. Simple CRUD endpoints (low risk)

**Phase 3: Migration checklist per endpoint**

```python
# Before (Flask)
@flask_app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data.get("email"):
        return jsonify({"error": "email required"}), 400
    if not isinstance(data.get("age"), int):
        return jsonify({"error": "age must be integer"}), 400
    # ... 20 more lines of manual validation
    user = db.create_user(**data)
    return jsonify(user.to_dict()), 201


# After (FastAPI)
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    age: int = Field(ge=0, le=150)
    name: str = Field(min_length=1, max_length=100)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    model_config = ConfigDict(from_attributes=True)

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    db_user = await db.create_user(**user.model_dump())
    return db_user
```

**Risks to address:**
- Flask extensions (Flask-Login, Flask-SQLAlchemy) have no direct FastAPI equivalents
- Session-based auth in Flask vs. token-based auth in FastAPI
- Template rendering (Jinja2 works in both, but FastAPI is API-first)
- Testing infrastructure needs to switch from Flask test client to `httpx.AsyncClient`

**Why interviewer asks this:** Migrations are common in production. This tests your architectural thinking, risk management, and practical experience.

**Follow-up:** "How would you handle shared database sessions between the Flask and FastAPI parts during the migration?"

---

## Section 2: Routing & Path/Query Parameters

### Q5: Explain path parameters, query parameters, and how FastAPI distinguishes between them.

**Answer:**

FastAPI uses Python type hints and function signature analysis to automatically determine parameter sources:

```python
from fastapi import FastAPI, Query, Path

app = FastAPI()

# PATH parameter - declared in the URL path template
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    # user_id comes from the URL path: /users/42
    return {"user_id": user_id}

# QUERY parameter - not in the path, so it becomes a query param
@app.get("/users")
async def list_users(skip: int = 0, limit: int = 10):
    # Accessed via: /users?skip=20&limit=10
    return {"skip": skip, "limit": limit}

# BOTH path and query parameters
@app.get("/users/{user_id}/posts")
async def get_user_posts(
    user_id: int,          # Path param (in URL template)
    published: bool = True, # Query param (not in URL template)
    skip: int = 0,         # Query param
    limit: int = 10,       # Query param
):
    # /users/42/posts?published=true&skip=0&limit=10
    return {
        "user_id": user_id,
        "published": published,
        "skip": skip,
        "limit": limit,
    }
```

**The rule is simple:** If the parameter name appears in the path template (`{param_name}`), it's a path parameter. Otherwise, it's a query parameter.

**Type coercion and validation happen automatically:**

```python
# GET /users/abc → 422 Unprocessable Entity
# {
#     "detail": [
#         {
#             "type": "int_parsing",
#             "loc": ["path", "user_id"],
#             "msg": "Input should be a valid integer, unable to parse string as an integer",
#             "input": "abc"
#         }
#     ]
# }
```

**Why interviewer asks this:** This is foundational. If you can't explain how FastAPI resolves parameters, you'll struggle with everything else.

**Follow-up:** "What happens if a query parameter has no default value? How does FastAPI treat it?"

---

### Q6: How do you handle optional parameters and Enum-based parameters?

**Answer:**

```python
from enum import Enum
from typing import Optional

from fastapi import FastAPI, Query

app = FastAPI()


# --- Optional parameters ---

# Method 1: Default value of None
@app.get("/items")
async def list_items(
    category: str | None = None,  # Optional - Python 3.10+ syntax
    min_price: Optional[float] = None,  # Optional - older syntax (both work)
    sort_by: str = "created_at",  # Has default, not optional (always has a value)
):
    filters = {}
    if category is not None:
        filters["category"] = category
    if min_price is not None:
        filters["min_price"] = min_price
    return {"filters": filters, "sort_by": sort_by}

# GET /items                         → {"filters": {}, "sort_by": "created_at"}
# GET /items?category=books          → {"filters": {"category": "books"}, ...}
# GET /items?category=books&min_price=9.99 → {"filters": {"category": "books", "min_price": 9.99}, ...}


# --- Required query parameters (no default) ---

@app.get("/search")
async def search(q: str):
    # q is REQUIRED because it has no default value
    # GET /search → 422 error ("field required")
    # GET /search?q=python → {"query": "python"}
    return {"query": q}


# --- Enum parameters ---

class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"
    relevance = "relevance"

class ItemCategory(str, Enum):
    electronics = "electronics"
    books = "books"
    clothing = "clothing"

@app.get("/products")
async def list_products(
    category: ItemCategory,
    sort: SortOrder = SortOrder.relevance,
):
    # GET /products?category=books → works
    # GET /products?category=food  → 422 error (not a valid enum value)
    return {"category": category.value, "sort": sort.value}

# The Swagger UI will render these as dropdown selects - excellent UX
```

**Edge case - Enum with integer values:**

```python
class Priority(int, Enum):
    low = 1
    medium = 2
    high = 3

@app.get("/tasks")
async def list_tasks(priority: Priority = Priority.medium):
    # GET /tasks?priority=1 → {"priority": 1, "label": "low"}
    return {"priority": priority.value, "label": priority.name}
```

**Why interviewer asks this:** Optional and Enum params are everywhere in real APIs. Interviewers want to see that you handle them cleanly without manual parsing.

**Follow-up:** "How would you allow a query parameter to accept multiple values, like `?tag=python&tag=fastapi`?"

---

### Q7: What is the order of route matching in FastAPI, and why does it matter?

**Answer:**

FastAPI matches routes **in declaration order**, and the first match wins. This creates a common bug:

```python
from fastapi import FastAPI

app = FastAPI()

# BUG: This order causes problems
@app.get("/users/{user_id}")
async def get_user(user_id: str):
    return {"user_id": user_id}

@app.get("/users/me")
async def get_current_user():
    return {"user": "current user"}

# GET /users/me → matches /users/{user_id} with user_id="me"
# The /users/me endpoint is UNREACHABLE!
```

**The fix - declare specific routes before parameterized routes:**

```python
# CORRECT order
@app.get("/users/me")          # Specific route first
async def get_current_user():
    return {"user": "current user"}

@app.get("/users/{user_id}")   # Parameterized route second
async def get_user(user_id: str):
    return {"user_id": user_id}

# GET /users/me → correctly matches get_current_user
# GET /users/42 → correctly matches get_user
```

**Why this happens:** FastAPI (via Starlette) iterates through registered routes top-to-bottom. `{user_id}` is a wildcard that matches any string, including "me". Once a match is found, it stops searching.

**Another subtle case - path parameter types act as filters:**

```python
@app.get("/items/{item_id}")
async def get_item_by_id(item_id: int):
    # Only matches if item_id can be parsed as int
    return {"item_id": item_id}

@app.get("/items/{item_name}")
async def get_item_by_name(item_name: str):
    # Falls through to here if item_id was not an int
    return {"item_name": item_name}

# GET /items/42    → matches get_item_by_id (42 is a valid int)
# GET /items/phone → matches get_item_by_name ("phone" is not a valid int)
```

However, relying on type-based fallthrough is fragile and not recommended. Use explicit path prefixes instead:

```python
@app.get("/items/by-id/{item_id}")
async def get_item_by_id(item_id: int):
    return {"item_id": item_id}

@app.get("/items/by-name/{item_name}")
async def get_item_by_name(item_name: str):
    return {"item_name": item_name}
```

**Why interviewer asks this:** Route ordering bugs are a top debugging scenario. This tests whether you've encountered and solved real issues.

**Follow-up:** "How does FastAPI handle route conflicts when using APIRouter with different prefixes?"

---

### Q8 (Coding): Build a complete REST API for a book store with proper routing conventions.

**Answer:**

```python
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException, Path, Query

app = FastAPI(title="Bookstore API", version="1.0.0")


class Genre(str, Enum):
    fiction = "fiction"
    non_fiction = "non-fiction"
    science = "science"
    history = "history"
    technology = "technology"


# In-memory store for demonstration
books_db: dict[int, dict] = {
    1: {"id": 1, "title": "Clean Code", "author": "Robert Martin", "genre": "technology", "price": 29.99},
    2: {"id": 2, "title": "Dune", "author": "Frank Herbert", "genre": "fiction", "price": 14.99},
}
next_id = 3


@app.get("/books")
async def list_books(
    genre: Optional[Genre] = None,
    min_price: float = Query(default=0, ge=0, description="Minimum price filter"),
    max_price: float = Query(default=1000, ge=0, description="Maximum price filter"),
    search: Optional[str] = Query(default=None, min_length=1, max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    """List books with filtering, search, and pagination."""
    results = list(books_db.values())

    if genre:
        results = [b for b in results if b["genre"] == genre.value]
    if search:
        search_lower = search.lower()
        results = [
            b for b in results
            if search_lower in b["title"].lower()
            or search_lower in b["author"].lower()
        ]
    results = [b for b in results if min_price <= b["price"] <= max_price]

    total = len(results)
    results = results[skip : skip + limit]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": results,
    }


@app.get("/books/{book_id}")
async def get_book(
    book_id: int = Path(gt=0, description="The ID of the book to retrieve"),
):
    """Get a single book by ID."""
    if book_id not in books_db:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    return books_db[book_id]


@app.get("/books/{book_id}/similar")
async def get_similar_books(
    book_id: int = Path(gt=0),
    limit: int = Query(default=5, ge=1, le=20),
):
    """Get books similar to the given book (same genre)."""
    if book_id not in books_db:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    book = books_db[book_id]
    similar = [
        b for b in books_db.values()
        if b["genre"] == book["genre"] and b["id"] != book_id
    ]
    return similar[:limit]


@app.get("/genres/{genre}/bestsellers")
async def get_genre_bestsellers(
    genre: Genre,
    limit: int = Query(default=10, ge=1, le=50),
):
    """Get bestselling books for a specific genre."""
    genre_books = [b for b in books_db.values() if b["genre"] == genre.value]
    # In production, sort by sales count
    return genre_books[:limit]
```

**Production notes:**
- Path parameters use `Path(gt=0)` to ensure positive IDs.
- Query parameters have explicit constraints with `Query()`.
- Pagination follows the `skip`/`limit` pattern (standard in FastAPI).
- Enum parameters restrict input to valid genres at the API layer.
- The 404 handling is explicit and returns a clear error message.

**Why interviewer asks this:** They want to see if you can design a clean, RESTful API with proper parameter handling - not just know the syntax.

**Follow-up:** "How would you add sorting to the list endpoint, supporting multiple sort fields like `?sort_by=price&order=desc`?"

---

## Section 3: Request & Response Models with Pydantic

### Q9: Explain Pydantic's role in FastAPI. What is `BaseModel` and how does FastAPI use it?

**Answer:**

Pydantic is the data validation library that FastAPI uses for:
1. **Request body parsing and validation** - deserializing JSON into Python objects with type checking
2. **Response serialization** - converting Python objects to JSON with field filtering
3. **API documentation** - generating JSON Schema for Swagger/ReDoc

```python
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    """Request model - what the client sends."""
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)
    bio: Optional[str] = None

class UserResponse(BaseModel):
    """Response model - what the client receives.
    Note: password is deliberately excluded."""
    id: int
    username: str
    email: str
    bio: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserInDB(UserResponse):
    """Internal model - includes hashed password, never sent to client."""
    hashed_password: str
```

**How FastAPI uses it under the hood:**

```python
@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    # Step 1: FastAPI reads the request body (JSON)
    # Step 2: Pydantic validates the JSON against UserCreate
    #         - Checks types, constraints, required fields
    #         - Returns 422 with details if validation fails
    # Step 3: Your function receives a validated UserCreate instance
    # Step 4: You return data (dict, ORM object, or Pydantic model)
    # Step 5: FastAPI serializes the return value through UserResponse
    #         - Only fields in UserResponse are included
    #         - password is NOT leaked to the client

    hashed_pw = hash_password(user.password)
    db_user = await db.create(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw,
        bio=user.bio,
    )
    return db_user  # ORM object - from_attributes=True handles conversion
```

**The `model_config = ConfigDict(from_attributes=True)` setting** (formerly `orm_mode` in Pydantic v1) tells Pydantic to read data from object attributes, not just dict keys. This is essential when returning SQLAlchemy/Tortoise ORM objects.

```python
# Without from_attributes=True:
# Pydantic expects: {"id": 1, "username": "alice", ...}

# With from_attributes=True:
# Pydantic also accepts: user_obj.id, user_obj.username, ...
# This means you can return ORM objects directly
```

**Why interviewer asks this:** Pydantic is the backbone of FastAPI. Understanding the request/response lifecycle through Pydantic models is essential.

**Follow-up:** "What is the difference between Pydantic v1 and v2, and how did it affect FastAPI?"

---

### Q10: How do you use `Field` for constraints and metadata? Show advanced patterns.

**Answer:**

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Product(BaseModel):
    # --- Numeric constraints ---
    price: float = Field(
        gt=0,               # greater than 0 (exclusive)
        le=999999.99,       # less than or equal to (inclusive)
        description="Product price in USD",
        examples=[29.99],
    )
    quantity: int = Field(
        ge=0,               # greater than or equal to 0
        lt=1_000_000,       # less than 1 million
        default=0,
    )
    discount_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,             # 0% to 100% as decimal
        description="Discount as a decimal (0.1 = 10%)",
    )

    # --- String constraints ---
    name: str = Field(
        min_length=1,
        max_length=200,
        description="Product name",
    )
    sku: str = Field(
        pattern=r"^[A-Z]{2,4}-\d{4,8}$",  # regex pattern
        description="Stock Keeping Unit (e.g., 'ELEC-12345')",
        examples=["BOOK-0001", "ELEC-12345678"],
    )
    description: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    # --- Alias and serialization control ---
    internal_code: str = Field(
        alias="internalCode",  # Accept camelCase from client
        description="Internal product code",
    )

    # --- Default factory ---
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # --- Exclude from serialization ---
    cost_price: float = Field(exclude=True)  # Never included in response


# Usage in endpoint
@app.post("/products")
async def create_product(product: Product):
    # product.sku is guaranteed to match the regex
    # product.price is guaranteed to be > 0 and <= 999999.99
    # product.internal_code was received as "internalCode" in the JSON
    return product


# Example valid request body:
# {
#     "name": "Python Handbook",
#     "price": 49.99,
#     "sku": "BOOK-0042",
#     "internalCode": "PH-2024",
#     "cost_price": 15.00
# }
```

**Why interviewer asks this:** `Field` is where you encode business rules declaratively. Interviewers want to see if you use it properly instead of writing manual validation code.

**Follow-up:** "How would you create a field that accepts either a string or an integer (union types) with different validation rules for each?"

---

### Q11: How do you handle nested models and complex request bodies?

**Answer:**

```python
from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime


# --- Nested models ---

class Address(BaseModel):
    street: str = Field(min_length=1)
    city: str
    state: str = Field(min_length=2, max_length=2)  # e.g., "CA"
    zip_code: str = Field(pattern=r"^\d{5}(-\d{4})?$")
    country: str = "US"


class OrderItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=1000)
    unit_price: float = Field(gt=0)

    @property
    def subtotal(self) -> float:
        return self.quantity * self.unit_price


class Order(BaseModel):
    customer_id: int = Field(gt=0)
    shipping_address: Address                 # Nested model
    billing_address: Optional[Address] = None  # Optional nested model
    items: list[OrderItem] = Field(min_length=1, max_length=100)  # List of nested models
    notes: Optional[str] = None
    coupon_code: Optional[str] = None

    @model_validator(mode="after")
    def billing_defaults_to_shipping(self) -> "Order":
        """If no billing address provided, use shipping address."""
        if self.billing_address is None:
            self.billing_address = self.shipping_address.model_copy()
        return self

    @property
    def total(self) -> float:
        return sum(item.subtotal for item in self.items)


# --- Deeply nested response ---

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    shipping_address: Address
    billing_address: Address
    items: list[OrderItem]
    total: float
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@app.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(order: Order):
    # Pydantic has validated:
    # - shipping_address.zip_code matches regex
    # - items list has at least 1 item
    # - Each item has quantity > 0
    # - billing_address defaults to shipping if not provided

    db_order = await db.create_order(
        customer_id=order.customer_id,
        shipping=order.shipping_address.model_dump(),
        billing=order.billing_address.model_dump(),
        items=[item.model_dump() for item in order.items],
    )
    return db_order
```

**Example request:**

```json
{
    "customer_id": 42,
    "shipping_address": {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zip_code": "94102"
    },
    "items": [
        {"product_id": 1, "quantity": 2, "unit_price": 29.99},
        {"product_id": 5, "quantity": 1, "unit_price": 49.99}
    ]
}
```

If `billing_address` is omitted, the validator copies `shipping_address` automatically. If `zip_code` is `"9410"`, Pydantic returns a 422 error because it doesn't match the regex.

**Why interviewer asks this:** Real-world APIs have complex, nested payloads. This tests whether you can model them cleanly.

**Follow-up:** "How would you handle polymorphic models - for example, an order that can have either `ShippingAddress` or `PickupLocation` as the delivery method?"

---

### Q12: Explain `response_model`, `response_model_exclude`, and how to prevent data leaks.

**Answer:**

`response_model` is your last line of defense against accidentally sending sensitive data to the client.

```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class UserInDB(BaseModel):
    """This is what's stored in the database."""
    id: int
    username: str
    email: str
    hashed_password: str
    is_admin: bool
    internal_notes: Optional[str] = None
    ssn: Optional[str] = None  # Social Security Number

    model_config = ConfigDict(from_attributes=True)


class UserPublic(BaseModel):
    """This is what the client sees."""
    id: int
    username: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class UserAdmin(UserPublic):
    """Admins see more fields."""
    is_admin: bool
    internal_notes: Optional[str] = None


# --- Safe: response_model filters the output ---
@app.get("/users/{user_id}", response_model=UserPublic)
async def get_user(user_id: int):
    user = await db.get_user(user_id)
    # Even though `user` has hashed_password, ssn, etc.,
    # response_model=UserPublic ensures only id, username, email are sent.
    return user  # Safe! Extra fields are stripped.


# --- DANGEROUS: No response_model ---
@app.get("/users/{user_id}/unsafe")
async def get_user_unsafe(user_id: int):
    user = await db.get_user(user_id)
    return user  # DANGER: hashed_password, ssn are sent to the client!


# --- Using response_model_exclude for one-off exclusions ---
@app.get(
    "/users/{user_id}/admin",
    response_model=UserInDB,
    response_model_exclude={"hashed_password", "ssn"},
)
async def get_user_admin(user_id: int):
    user = await db.get_user(user_id)
    return user  # hashed_password and ssn are excluded


# --- Using response_model_include for allowlisting ---
@app.get(
    "/users/{user_id}/summary",
    response_model=UserInDB,
    response_model_include={"id", "username"},
)
async def get_user_summary(user_id: int):
    user = await db.get_user(user_id)
    return user  # Only id and username are included
```

**Best practices:**

1. **Always use `response_model`** - never rely on "I'll just not include that field in the dict."
2. **Prefer separate response models** over `exclude`/`include` - they're explicit and documented.
3. **Use `response_model_exclude_unset=True`** to omit fields that weren't explicitly set (useful for PATCH endpoints).

```python
@app.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(user_id: int, updates: UserUpdate):
    # response_model_exclude_unset=True would skip fields the user
    # didn't include in the PATCH body - but using separate models
    # is cleaner for this pattern.
    pass
```

**Why interviewer asks this:** Data leaks are a real security concern. This tests your security awareness.

**Follow-up:** "If you have 10 different endpoints that each need slightly different response fields, how do you organize your models to avoid duplication?"

---

### Q13 (Coding): Design a Pydantic model hierarchy for a multi-tenant SaaS application.

**Answer:**

```python
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


# --- Enums ---

class PlanTier(str, Enum):
    free = "free"
    starter = "starter"
    professional = "professional"
    enterprise = "enterprise"

class UserRole(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"
    viewer = "viewer"


# --- Shared base ---

class TimestampMixin(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Tenant (Organization) models ---

class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(
        min_length=2,
        max_length=50,
        pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$",
        description="URL-friendly identifier (e.g., 'acme-corp')",
    )
    plan: PlanTier = PlanTier.free

    @field_validator("slug")
    @classmethod
    def slug_not_reserved(cls, v: str) -> str:
        reserved = {"admin", "api", "www", "app", "help", "support"}
        if v in reserved:
            raise ValueError(f"'{v}' is a reserved slug")
        return v


class TenantResponse(TimestampMixin):
    id: int
    name: str
    slug: str
    plan: PlanTier
    member_count: int = 0
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class TenantInternal(TenantResponse):
    """Admin-only view with billing details."""
    stripe_customer_id: Optional[str] = None
    monthly_revenue: float = 0.0
    feature_flags: dict[str, bool] = Field(default_factory=dict)


# --- User models ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.member

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

class UserResponse(UserBase, TimestampMixin):
    id: int
    role: UserRole
    tenant_id: int
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    """Partial update - all fields optional."""
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[UserRole] = None


# --- Invite models ---

class InviteCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.member

    @model_validator(mode="after")
    def cannot_invite_owner(self) -> "InviteCreate":
        if self.role == UserRole.owner:
            raise ValueError("Cannot invite someone as owner")
        return self


# --- Plan limits (used for authorization) ---

PLAN_LIMITS: dict[PlanTier, dict] = {
    PlanTier.free: {"max_members": 3, "max_projects": 5, "api_rate_limit": 100},
    PlanTier.starter: {"max_members": 10, "max_projects": 25, "api_rate_limit": 1000},
    PlanTier.professional: {"max_members": 50, "max_projects": 100, "api_rate_limit": 10000},
    PlanTier.enterprise: {"max_members": 500, "max_projects": 1000, "api_rate_limit": 100000},
}


# --- Usage in endpoints ---

@app.post("/tenants/{tenant_id}/users", response_model=UserResponse, status_code=201)
async def add_user_to_tenant(
    tenant_id: int,
    user: UserCreate,
):
    tenant = await db.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    limits = PLAN_LIMITS[tenant.plan]
    current_count = await db.count_tenant_members(tenant_id)

    if current_count >= limits["max_members"]:
        raise HTTPException(
            status_code=403,
            detail=f"Plan '{tenant.plan.value}' allows max {limits['max_members']} members",
        )

    db_user = await db.create_user(tenant_id=tenant_id, **user.model_dump())
    return db_user
```

**Why interviewer asks this:** Multi-tenancy is extremely common. This tests your ability to design model hierarchies that handle authorization, validation, and data isolation.

**Follow-up:** "How would you ensure that a user in Tenant A can never access data from Tenant B through these endpoints?"

---

## Section 4: Dependency Injection

### Q14: What is dependency injection in FastAPI, and how does `Depends` work?

**Answer:**

Dependency injection (DI) in FastAPI is a system where your endpoint functions declare their dependencies, and FastAPI resolves and provides them automatically. It replaces hardcoded dependencies with injectable, testable components.

```python
from fastapi import Depends, FastAPI, HTTPException, Header

app = FastAPI()


# --- Simple dependency: a function ---

async def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db  # Yield dependency (cleaned up after request)
    finally:
        db.close()


async def get_current_user(
    authorization: str = Header(...),
    db=Depends(get_db),
):
    """Dependency that resolves the current user from the auth header."""
    token = authorization.replace("Bearer ", "")
    user = await db.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


# --- Endpoint uses dependencies via Depends() ---

@app.get("/profile")
async def get_profile(
    current_user=Depends(get_current_user),  # FastAPI calls get_current_user for us
):
    return {"username": current_user.username, "email": current_user.email}


@app.get("/settings")
async def get_settings(
    current_user=Depends(get_current_user),  # Reused across endpoints
    db=Depends(get_db),
):
    settings = await db.get_user_settings(current_user.id)
    return settings
```

**How FastAPI resolves the dependency graph:**

```
get_profile(current_user)
    └── get_current_user(authorization, db)
            ├── Header("authorization")  ← extracted from request headers
            └── get_db()                 ← creates and yields DB session
```

FastAPI:
1. Sees `Depends(get_current_user)` in `get_profile`.
2. Inspects `get_current_user`'s signature - finds it needs `authorization` (from header) and `db` (from `Depends(get_db)`).
3. Recursively resolves `get_db()` first.
4. Calls `get_current_user` with resolved values.
5. Passes the result to `get_profile`.
6. After the response is sent, runs cleanup for yield dependencies (`db.close()`).

**Key behaviors:**
- Dependencies are resolved **per request** - each request gets its own database session.
- Dependencies are **cached within a request** - if two dependencies both `Depends(get_db)`, they get the same session instance.
- Dependencies can be **nested** to arbitrary depth.

**Why interviewer asks this:** DI is how production FastAPI apps are structured. Without understanding it, you can't write testable code.

**Follow-up:** "How do you override dependencies in tests?"

---

### Q15: Explain yield dependencies and their lifecycle.

**Answer:**

Yield dependencies let you run setup code before the endpoint and teardown code after the response is sent. They're FastAPI's equivalent of context managers.

```python
from fastapi import Depends, FastAPI
from contextlib import asynccontextmanager

app = FastAPI()


# --- Basic yield dependency ---

async def get_db_session():
    """Setup → yield → teardown pattern."""
    print("1. Creating DB session")       # SETUP
    session = AsyncSession(engine)
    try:
        yield session                       # PROVIDE to endpoint
        print("3. Committing transaction")  # TEARDOWN (success)
        await session.commit()
    except Exception:
        print("3. Rolling back transaction")  # TEARDOWN (error)
        await session.rollback()
        raise
    finally:
        print("4. Closing session")         # ALWAYS runs
        await session.close()


@app.get("/users")
async def list_users(db=Depends(get_db_session)):
    print("2. Executing query")
    users = await db.execute(select(User))
    return users.scalars().all()


# Execution order (success):
# 1. Creating DB session
# 2. Executing query
# 3. Committing transaction
# 4. Closing session

# Execution order (error in endpoint):
# 1. Creating DB session
# 2. Executing query → raises exception
# 3. Rolling back transaction
# 4. Closing session
```

**Critical behavior - yield dependencies and exceptions:**

```python
async def file_handler():
    f = open("data.txt", "r")
    try:
        yield f
    finally:
        f.close()  # ALWAYS runs, even if the endpoint raises

async def transactional_db():
    session = SessionLocal()
    try:
        yield session
        await session.commit()  # Only runs on success
    except Exception:
        await session.rollback()  # Only runs on failure
        raise
    finally:
        await session.close()  # Always runs
```

**Important edge case:** Code after `yield` runs **after the response is formed but before it's sent**. If you raise an exception in the teardown, the client gets a 500 error - even if the endpoint was successful.

```python
async def risky_dependency():
    resource = acquire_resource()
    try:
        yield resource
    finally:
        # If this raises, the client gets 500 even though
        # the endpoint returned successfully
        release_resource(resource)  # Be careful here!
```

**Yield vs. regular dependencies:**

| Feature | Regular (`return`) | Yield |
|---|---|---|
| Cleanup code | Not possible | Runs after response |
| Resource management | Caller must clean up | Automatic cleanup |
| Exception handling | No post-processing | Can catch endpoint exceptions |
| Use case | Stateless computations | DB sessions, file handles, locks |

**Why interviewer asks this:** Yield dependencies are how you manage resources in production FastAPI apps. Understanding their lifecycle prevents resource leaks.

**Follow-up:** "What happens if a yield dependency's teardown code is slow? Does it delay the response to the client?"

---

### Q16: How do you create class-based dependencies and parameterized dependencies?

**Answer:**

```python
from fastapi import Depends, FastAPI, HTTPException, Query

app = FastAPI()


# --- Class-based dependency (callable class) ---

class Pagination:
    """Reusable pagination dependency."""

    def __init__(self, max_limit: int = 100):
        self.max_limit = max_limit

    def __call__(
        self,
        skip: int = Query(default=0, ge=0),
        limit: int = Query(default=20, ge=1),
    ) -> "Pagination":
        self.skip = skip
        self.limit = min(limit, self.max_limit)
        return self


# Different endpoints can use different max limits
default_pagination = Pagination(max_limit=100)
admin_pagination = Pagination(max_limit=1000)


@app.get("/posts")
async def list_posts(pagination: Pagination = Depends(default_pagination)):
    # pagination.skip, pagination.limit are set
    return {"skip": pagination.skip, "limit": pagination.limit}


@app.get("/admin/logs")
async def list_logs(pagination: Pagination = Depends(admin_pagination)):
    return {"skip": pagination.skip, "limit": pagination.limit}


# --- Parameterized dependency using closures ---

def require_role(allowed_roles: list[str]):
    """Factory that creates a dependency checking user roles."""
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' not in {allowed_roles}",
            )
        return current_user
    return role_checker


@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin=Depends(require_role(["admin", "superadmin"])),
):
    await db.delete_user(user_id)
    return {"deleted": user_id}


@app.get("/reports")
async def get_reports(
    user=Depends(require_role(["admin", "analyst", "superadmin"])),
):
    return {"reports": [...]}


# --- Dependency that modifies based on configuration ---

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}

    async def __call__(self, request: Request):
        client_ip = request.client.host
        now = time.time()

        # Clean old entries
        self.requests.setdefault(client_ip, [])
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < self.window_seconds
        ]

        if len(self.requests[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(self.window_seconds)},
            )

        self.requests[client_ip].append(now)


# Different rate limits for different endpoints
public_limiter = RateLimiter(max_requests=60, window_seconds=60)
auth_limiter = RateLimiter(max_requests=5, window_seconds=300)

@app.post("/login", dependencies=[Depends(auth_limiter)])
async def login(credentials: LoginRequest):
    ...

@app.get("/public/data", dependencies=[Depends(public_limiter)])
async def public_data():
    ...
```

**Note the `dependencies` parameter:** When you don't need the dependency's return value (like rate limiting), use `dependencies=[Depends(...)]` on the endpoint decorator instead of a function parameter.

**Why interviewer asks this:** Class-based and parameterized dependencies show you can build reusable, configurable components - a sign of production experience.

**Follow-up:** "How would you implement a dependency that caches its result across multiple requests (not just within a single request)?"

---

### Q17: How do you test endpoints with dependencies? Show the override pattern.

**Answer:**

```python
# --- app/main.py ---
from fastapi import Depends, FastAPI

app = FastAPI()

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(db=Depends(get_db)):
    # Production: decode JWT, query database
    ...

@app.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    return {"id": user.id, "name": user.name}


# --- tests/test_profile.py ---
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app, get_current_user, get_db


# Mock user for testing
class FakeUser:
    id = 1
    name = "Test User"
    email = "test@example.com"


# Override dependencies
async def override_get_current_user():
    return FakeUser()

async def override_get_db():
    # Use test database
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Test client with overridden dependencies."""
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    yield AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )

    # Clean up overrides after test
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_profile(client):
    response = await client.get("/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["name"] == "Test User"


@pytest.mark.anyio
async def test_get_profile_custom_user(client):
    """Override for a specific test."""
    class AdminUser:
        id = 99
        name = "Admin"
        email = "admin@example.com"
        role = "admin"

    async def get_admin_user():
        return AdminUser()

    app.dependency_overrides[get_current_user] = get_admin_user

    response = await client.get("/profile")
    assert response.status_code == 200
    assert response.json()["name"] == "Admin"
```

**Key points:**
- `app.dependency_overrides` is a dict mapping original dependency functions to replacement functions.
- The override function must have a compatible return type.
- Always clear overrides after tests to prevent test pollution.
- This works for the entire dependency chain - overriding `get_db` affects all dependencies that use it.

**Why interviewer asks this:** Testability is a primary reason to use DI. If you can't explain the override pattern, interviewers will doubt your testing practices.

**Follow-up:** "What are the limitations of `dependency_overrides`? Can you think of a case where it wouldn't work?"

---

## Section 5: Validation

### Q18: Beyond Pydantic `Field`, what are the different types of validators available?

**Answer:**

Pydantic v2 (used by FastAPI 0.100+) provides three levels of validation:

```python
from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
    ValidationInfo,
)
from typing import Optional


class UserRegistration(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: str
    password: str = Field(min_length=8)
    password_confirm: str
    age: Optional[int] = Field(default=None, ge=13, le=150)
    referral_code: Optional[str] = None

    # --- Level 1: field_validator (single field) ---

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (dashes and underscores allowed)")
        if v.startswith("-") or v.startswith("_"):
            raise ValueError("Username cannot start with a dash or underscore")
        return v.lower()  # Normalize to lowercase

    @field_validator("email")
    @classmethod
    def email_valid_domain(cls, v: str) -> str:
        blocked_domains = {"tempmail.com", "throwaway.email", "mailinator.com"}
        domain = v.split("@")[-1].lower()
        if domain in blocked_domains:
            raise ValueError(f"Email domain '{domain}' is not allowed")
        return v.lower()

    @field_validator("referral_code")
    @classmethod
    def validate_referral_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith("REF-"):
            raise ValueError("Referral code must start with 'REF-'")
        return v

    # --- Level 2: field_validator with mode="before" ---
    # Runs before type coercion

    @field_validator("age", mode="before")
    @classmethod
    def parse_age_from_string(cls, v):
        """Accept age as string or int."""
        if isinstance(v, str) and v.isdigit():
            return int(v)
        return v

    # --- Level 3: model_validator (cross-field validation) ---

    @model_validator(mode="after")
    def passwords_match(self) -> "UserRegistration":
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")
        return self

    @model_validator(mode="before")
    @classmethod
    def preprocess_data(cls, data: dict) -> dict:
        """Runs before any field validation.
        Useful for reshaping input data."""
        # Strip whitespace from all string values
        if isinstance(data, dict):
            return {
                k: v.strip() if isinstance(v, str) else v
                for k, v in data.items()
            }
        return data
```

**Validation order:**

```
1. model_validator(mode="before") - raw input preprocessing
2. field_validator(mode="before") - per-field, before type coercion
3. Pydantic type coercion (str → int, etc.)
4. Field constraints (min_length, ge, pattern, etc.)
5. field_validator(mode="after") - per-field, after type coercion (default mode)
6. model_validator(mode="after") - cross-field validation on the fully constructed model
```

This ordering matters. If `mode="before"`, the validator sees raw input. If `mode="after"` (default), it sees the already-coerced, constraint-checked value.

**Why interviewer asks this:** Knowing all validation levels and their execution order is critical for implementing complex business rules correctly.

**Follow-up:** "What happens if a `field_validator(mode='before')` raises an error? Do subsequent validators still run?"

---

### Q19: How do you validate path, query, and body parameters separately?

**Answer:**

FastAPI provides explicit annotation classes for each parameter source:

```python
from fastapi import Body, Depends, FastAPI, Header, Path, Query, Cookie
from pydantic import BaseModel, Field

app = FastAPI()


class ItemUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)


@app.put("/stores/{store_id}/items/{item_id}")
async def update_item(
    # --- PATH parameter validation ---
    store_id: int = Path(
        gt=0,
        description="The store ID",
        example=42,
    ),
    item_id: int = Path(
        gt=0,
        le=999999,
        description="The item ID within the store",
    ),

    # --- QUERY parameter validation ---
    dry_run: bool = Query(
        default=False,
        description="If true, validate but don't persist changes",
    ),
    reason: str = Query(
        min_length=1,
        max_length=500,
        description="Reason for the update (required for audit log)",
    ),

    # --- BODY parameter validation (Pydantic model) ---
    item: ItemUpdate = Body(
        ...,
        description="The updated item data",
        examples=[
            {
                "name": "Updated Widget",
                "price": 19.99,
            }
        ],
    ),

    # --- HEADER validation ---
    x_request_id: str = Header(
        ...,
        min_length=1,
        description="Unique request ID for tracing",
    ),
    x_api_version: str = Header(
        default="2024-01",
        pattern=r"^\d{4}-\d{2}$",
    ),

    # --- COOKIE validation ---
    session_id: str | None = Cookie(default=None),
):
    return {
        "store_id": store_id,
        "item_id": item_id,
        "dry_run": dry_run,
        "item": item.model_dump(),
        "request_id": x_request_id,
    }


# --- Multiple body parameters ---

class Item(BaseModel):
    name: str
    price: float

class User(BaseModel):
    username: str

@app.put("/items/{item_id}")
async def update_item_with_user(
    item_id: int,
    item: Item,
    user: User,
    importance: int = Body(gt=0, le=10),
):
    # When multiple Pydantic models are in the signature,
    # FastAPI expects a nested JSON body:
    # {
    #     "item": {"name": "Widget", "price": 9.99},
    #     "user": {"username": "alice"},
    #     "importance": 5
    # }
    return {"item": item, "user": user, "importance": importance}
```

**Edge case - forcing a single body param to be nested:**

```python
@app.post("/items")
async def create_item(item: Item = Body(embed=True)):
    # Without embed=True, expects: {"name": "Widget", "price": 9.99}
    # With embed=True, expects:    {"item": {"name": "Widget", "price": 9.99}}
    return item
```

**Why interviewer asks this:** Each parameter source has its own annotation class. Interviewers check if you know the full FastAPI parameter system, not just basic `BaseModel` body parsing.

**Follow-up:** "How does FastAPI determine if a parameter is a path param, query param, or body param when you don't use explicit annotations like `Path()`, `Query()`, or `Body()`?"

---

### Q20 (Debugging): What is wrong with this code? It raises a validation error unexpectedly.

```python
from fastapi import FastAPI, Query
from typing import Optional

app = FastAPI()

@app.get("/search")
async def search(
    q: str,
    page: int = 1,
    tags: list[str] = [],
):
    return {"q": q, "page": page, "tags": tags}
```

**Answer:**

There are two bugs:

**Bug 1: Mutable default argument `[]`**

Using `[]` as a default for `tags` is the classic Python mutable default argument bug. All requests share the same list object. However, in FastAPI/Pydantic, this may not cause the traditional mutation issue because Pydantic creates new objects - but it's still bad practice and triggers linting warnings.

**Bug 2: Query parameter list syntax**

`list[str]` as a query parameter without `Query()` won't work as expected for receiving multiple values. FastAPI needs the explicit `Query()` annotation:

```python
# CORRECT version
@app.get("/search")
async def search(
    q: str,
    page: int = 1,
    tags: list[str] = Query(default=[]),
):
    # Now works: /search?q=python&tags=web&tags=api
    return {"q": q, "page": page, "tags": tags}
```

Without `Query()`, FastAPI tries to parse `tags` as a JSON-encoded body field or a single query string, not as repeated query parameters.

**The corrected URL format:**
```
/search?q=python&tags=web&tags=api&tags=tutorial
→ {"q": "python", "page": 1, "tags": ["web", "api", "tutorial"]}
```

**Why interviewer asks this:** This is a common real-world bug. It tests your debugging skills and understanding of how FastAPI resolves parameter sources.

**Follow-up:** "How would you also support comma-separated values like `?tags=web,api,tutorial` in addition to repeated params?"

---

### Q21 (Output): What does this endpoint return for different inputs?

```python
from pydantic import BaseModel, Field, field_validator

class Temperature(BaseModel):
    value: float
    unit: str = Field(pattern=r"^(celsius|fahrenheit|kelvin)$")

    @field_validator("value")
    @classmethod
    def validate_temperature(cls, v: float, info) -> float:
        # info.data contains already-validated fields
        # But 'unit' hasn't been validated yet at this point!
        return v

    @model_validator(mode="after")
    def validate_physical_range(self) -> "Temperature":
        if self.unit == "kelvin" and self.value < 0:
            raise ValueError("Kelvin cannot be negative")
        if self.unit == "celsius" and self.value < -273.15:
            raise ValueError("Below absolute zero")
        return self

@app.post("/temperature")
async def check_temperature(temp: Temperature):
    return {"valid": True, "temp": temp.model_dump()}
```

**Inputs and outputs:**

```python
# Input 1: {"value": 100, "unit": "celsius"}
# Output: {"valid": true, "temp": {"value": 100.0, "unit": "celsius"}}

# Input 2: {"value": -300, "unit": "celsius"}
# Output: 422 - "Below absolute zero"

# Input 3: {"value": -5, "unit": "kelvin"}
# Output: 422 - "Kelvin cannot be negative"

# Input 4: {"value": 100, "unit": "rankine"}
# Output: 422 - String should match pattern '^(celsius|fahrenheit|kelvin)$'

# Input 5: {"value": "hot", "unit": "celsius"}
# Output: 422 - Input should be a valid number

# Input 6: {"unit": "celsius"}
# Output: 422 - Field required (value is required, no default)
```

**Key insight:** The `field_validator` for `value` runs before `unit` is validated (fields are validated in declaration order). So `info.data` inside that validator would NOT contain `unit` yet. Cross-field checks must go in `model_validator(mode="after")`.

**Why interviewer asks this:** This tests understanding of Pydantic's validation order and edge cases.

**Follow-up:** "How would you add a computed field that automatically converts the temperature to Kelvin?"

---

## Section 6: Middleware Basics

### Q22: What is middleware in FastAPI? Explain the request/response lifecycle.

**Answer:**

Middleware is code that runs **before every request** and **after every response**. It wraps the entire application, intercepting the request on the way in and the response on the way out.

```
Client Request
    ↓
┌─────────────────────────────┐
│ Middleware 1 (outermost)     │
│   ↓                         │
│ ┌─────────────────────────┐ │
│ │ Middleware 2             │ │
│ │   ↓                     │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ Middleware 3         │ │ │
│ │ │   ↓                 │ │ │
│ │ │   Route Handler     │ │ │
│ │ │   ↑                 │ │ │
│ │ │ Middleware 3         │ │ │
│ │ └─────────────────────┘ │ │
│ │ Middleware 2             │ │
│ └─────────────────────────┘ │
│ Middleware 1                 │
└─────────────────────────────┘
    ↓
Client Response
```

```python
import time
from fastapi import FastAPI, Request

app = FastAPI()


# --- Method 1: @app.middleware("http") ---

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()

    # Everything before call_next runs BEFORE the route handler
    print(f"Incoming: {request.method} {request.url.path}")

    response = await call_next(request)

    # Everything after call_next runs AFTER the route handler
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    print(f"Completed in {process_time:.4f}s with status {response.status_code}")

    return response


# --- Method 2: Starlette BaseHTTPMiddleware ---

from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        import uuid
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        # Attach to request state for use in handlers
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)
```

**Important: `call_next` consumes the response body.** After calling `call_next`, the response body is a streaming iterator that can only be consumed once. If you need to read the response body in middleware (e.g., for logging), you need special handling:

```python
from starlette.responses import StreamingResponse

@app.middleware("http")
async def log_response_body(request: Request, call_next):
    response = await call_next(request)

    # Reading the body consumes it - must reconstruct
    body_bytes = b""
    async for chunk in response.body_iterator:
        body_bytes += chunk

    # Log the body
    print(f"Response body: {body_bytes.decode()}")

    # Reconstruct the response with the consumed body
    return Response(
        content=body_bytes,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )
```

**Why interviewer asks this:** Middleware is fundamental to web application architecture. This tests your understanding of the request lifecycle.

**Follow-up:** "What are the performance implications of using `BaseHTTPMiddleware` vs. pure ASGI middleware?"

---

### Q23: How do you configure CORS in FastAPI? What are the common mistakes?

**Answer:**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- Production CORS configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://myapp.com",
        "https://staging.myapp.com",
        "https://admin.myapp.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Process-Time", "X-Request-ID"],
    max_age=600,  # Preflight cache duration in seconds
)
```

**Common mistakes:**

```python
# MISTAKE 1: allow_origins=["*"] with allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Allow all origins
    allow_credentials=True,     # Allow cookies/auth headers
    # This is INVALID per the CORS spec!
    # Browsers will reject the response.
    # If credentials=True, origins must be explicit.
)

# MISTAKE 2: Forgetting preflight requests
# OPTIONS requests are handled by CORSMiddleware automatically.
# But if you add auth middleware BEFORE CORS middleware,
# preflight OPTIONS requests will be rejected by auth.

# WRONG ORDER:
app.add_middleware(AuthMiddleware)      # Blocks OPTIONS (no auth header)
app.add_middleware(CORSMiddleware)      # Never reached for OPTIONS

# CORRECT ORDER (middleware executes bottom-to-top in add_middleware):
app.add_middleware(CORSMiddleware)      # Handles OPTIONS first
app.add_middleware(AuthMiddleware)      # Only runs for actual requests


# MISTAKE 3: Not including needed headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp.com"],
    allow_headers=["Content-Type"],  # Forgot "Authorization"!
    # Result: Frontend can't send Bearer tokens
)


# MISTAKE 4: Using allow_origins=["*"] in production
# This disables the Same-Origin Policy protection entirely.
# Always whitelist specific origins in production.
```

**Development vs. Production pattern:**

```python
import os

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "development":
    origins = ["http://localhost:3000", "http://localhost:5173"]
elif ENVIRONMENT == "staging":
    origins = ["https://staging.myapp.com"]
else:
    origins = ["https://myapp.com", "https://www.myapp.com"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)
```

**Why interviewer asks this:** CORS misconfiguration is one of the most common deployment issues. Interviewers want to see that you can configure it correctly and debug it when it fails.

**Follow-up:** "A frontend developer reports that requests work from `localhost:3000` but fail from `localhost:5173`. The error says 'CORS policy: No Access-Control-Allow-Origin header'. How do you debug this?"

---

### Q24: What is the middleware execution order in FastAPI?

**Answer:**

This is one of the most confusing aspects of FastAPI middleware. **Middleware added later wraps middleware added earlier.** This means:

```python
app = FastAPI()

# Added first → innermost (closest to the route handler)
app.add_middleware(MiddlewareA)

# Added second → outermost (first to see the request)
app.add_middleware(MiddlewareB)

# Execution order:
# Request:  MiddlewareB → MiddlewareA → Route Handler
# Response: Route Handler → MiddlewareA → MiddlewareB
```

**The reason:** `add_middleware` wraps the existing application. Each call creates a new layer around everything that was already there.

```python
import time
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        print("TIMING: before")
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        print(f"TIMING: after ({elapsed:.3f}s)")
        response.headers["X-Process-Time"] = str(elapsed)
        return response


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        print("AUTH: before")
        # Check auth...
        response = await call_next(request)
        print("AUTH: after")
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        print("LOG: before")
        response = await call_next(request)
        print("LOG: after")
        return response


# Order matters! Added first = innermost
app.add_middleware(LoggingMiddleware)    # 3rd to process request
app.add_middleware(AuthMiddleware)       # 2nd to process request
app.add_middleware(TimingMiddleware)     # 1st to process request

# Console output for a request:
# TIMING: before
# AUTH: before
# LOG: before
# (route handler executes)
# LOG: after
# AUTH: after
# TIMING: after (0.005s)
```

**Recommended ordering (outermost to innermost):**
1. **CORS** - must be outermost to handle preflight OPTIONS
2. **Request timing / logging** - captures total request time including auth
3. **Authentication** - rejects unauthorized requests early
4. **Rate limiting** - prevents abuse
5. **Request ID / tracing** - adds context for downstream logging
6. Route handler

Since `add_middleware` makes things outermost, you add them in **reverse** order:

```python
# Add in reverse order (last added = outermost)
app.add_middleware(RequestIDMiddleware)    # innermost
app.add_middleware(RateLimitMiddleware)    # ↑
app.add_middleware(AuthMiddleware)         # ↑
app.add_middleware(TimingMiddleware)       # ↑
app.add_middleware(CORSMiddleware)         # outermost
```

**Why interviewer asks this:** The reverse ordering trips up many developers. This tests whether you've debugged middleware ordering issues in practice.

**Follow-up:** "You have a middleware that modifies the request body before it reaches the handler. Where in the middleware stack should it go, and what are the challenges?"

---

### Q25 (Coding): Build a custom middleware that implements request/response logging with structured output.

**Answer:**

```python
import json
import logging
import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Structured logger
logger = logging.getLogger("api.access")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(handler)


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Production-grade request/response logging middleware."""

    SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key"}
    SENSITIVE_PATHS = {"/login", "/register", "/reset-password"}

    def __init__(self, app: ASGIApp, service_name: str = "api"):
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        start_time = time.perf_counter()

        # Attach request ID to state for use in handlers
        request.state.request_id = request_id

        # Build request log
        request_log = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
            "headers": self._safe_headers(request.headers),
        }

        try:
            response = await call_next(request)
            elapsed = time.perf_counter() - start_time

            log_entry = {
                "event": "http_request",
                "service": self.service_name,
                "level": "info" if response.status_code < 400 else "warning",
                **request_log,
                "status_code": response.status_code,
                "duration_ms": round(elapsed * 1000, 2),
            }

            # Add response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{elapsed:.4f}"

            logger.info(json.dumps(log_entry))
            return response

        except Exception as exc:
            elapsed = time.perf_counter() - start_time
            log_entry = {
                "event": "http_request",
                "service": self.service_name,
                "level": "error",
                **request_log,
                "status_code": 500,
                "duration_ms": round(elapsed * 1000, 2),
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
            logger.error(json.dumps(log_entry))
            raise

    def _safe_headers(self, headers) -> dict:
        """Redact sensitive headers."""
        return {
            k: "[REDACTED]" if k.lower() in self.SENSITIVE_HEADERS else v
            for k, v in headers.items()
        }


# --- Usage ---
app = FastAPI()
app.add_middleware(StructuredLoggingMiddleware, service_name="bookstore-api")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

**Example log output:**

```json
{
    "event": "http_request",
    "service": "bookstore-api",
    "level": "info",
    "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "method": "GET",
    "path": "/health",
    "query_params": {},
    "client_ip": "10.0.0.1",
    "user_agent": "Mozilla/5.0...",
    "headers": {
        "authorization": "[REDACTED]",
        "content-type": "application/json"
    },
    "status_code": 200,
    "duration_ms": 1.23
}
```

**Production considerations:**
- Sensitive headers are redacted (authorization, cookies, API keys).
- Sensitive paths (login, register) could additionally skip body logging.
- Request IDs enable distributed tracing across microservices.
- Duration is in milliseconds for easy alerting (e.g., alert if `duration_ms > 5000`).
- Structured JSON logs integrate with ELK Stack, Datadog, CloudWatch, etc.

**Why interviewer asks this:** Logging middleware is something you'll build in almost every production API. This tests your ability to write production-quality infrastructure code.

**Follow-up:** "How would you also log the response body for error responses (4xx/5xx) without affecting performance for successful responses?"

---

## Bonus: Debugging & Output-Based Questions

### Q26 (Debugging): This API returns 422 for a valid-looking request. Find the bug.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = None  # Bug is here

@app.post("/items")
async def create_item(item: Item):
    return item
```

**Client sends:**
```json
{"name": "Widget", "price": 9.99}
```

**Answer:**

The bug is `is_offer: bool = None`. The type annotation says `bool`, but the default is `None`. In Pydantic v2 (strict mode or depending on configuration), this creates a contradiction.

In Pydantic v2's default mode, this actually works because Pydantic coerces `None` as a valid default. But the type hint is misleading. The correct patterns are:

```python
# Option 1: Explicitly optional
is_offer: bool | None = None
is_offer: Optional[bool] = None

# Option 2: Required bool with a sensible default
is_offer: bool = False
```

However, the deeper issue is that if Pydantic strict mode is enabled or if the request sends `"is_offer": null`, the behavior differs between v1 and v2. The fix:

```python
class Item(BaseModel):
    name: str
    price: float
    is_offer: Optional[bool] = None  # Explicit about nullability
```

**Lesson:** Always make your type annotations match your default values. `bool = None` without `Optional` is a code smell even if it works in lenient mode.

**Why interviewer asks this:** This is a subtle but common Pydantic bug. It tests attention to type annotation correctness.

**Follow-up:** "What is the difference between Pydantic's `strict` mode and `lax` mode, and when would you use each?"

---

### Q27 (Debugging): This endpoint hangs indefinitely. Why?

```python
from fastapi import Depends, FastAPI

app = FastAPI()

async def get_db():
    db = DatabaseSession()
    yield db
    # Missing db.close() - but that's not the hang

async def get_user(db=Depends(get_db)):
    return await db.query_user()

async def get_permissions(user=Depends(get_user)):
    return await db.query_permissions(user.id)  # Bug!

@app.get("/dashboard")
async def dashboard(
    user=Depends(get_user),
    permissions=Depends(get_permissions),
):
    return {"user": user.name, "permissions": permissions}
```

**Answer:**

The bug is in `get_permissions`. It references `db` - but `db` is not a parameter of `get_permissions`. It would either:

1. Raise a `NameError` if `db` is not defined in the module scope.
2. Use a module-level `db` variable if one exists (wrong session, potential issues).

The **correct** version passes `db` through the dependency chain:

```python
async def get_permissions(
    user=Depends(get_user),
    db=Depends(get_db),  # Must explicitly declare the dependency
):
    return await db.query_permissions(user.id)
```

**But the "hang" is actually a different scenario.** If `db` references a module-level connection pool and `query_permissions` tries to acquire a connection from an exhausted pool, it blocks forever waiting for a connection. This is a common production issue with connection pool exhaustion.

**Additionally:** FastAPI caches dependencies within a request. Both `get_user` and `get_permissions` depend on `get_db`, and they receive the **same** session instance. This is correct behavior and avoids creating multiple sessions per request.

**Why interviewer asks this:** This tests understanding of dependency resolution, scoping, and common production hangs.

**Follow-up:** "How does FastAPI's dependency caching work? If two dependencies both `Depends(get_db)`, do they get the same or different sessions?"

---

### Q28 (Output): What status codes does this endpoint return for different scenarios?

```python
from fastapi import FastAPI, HTTPException, Path, Query
from pydantic import BaseModel, Field

app = FastAPI()

class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=150)

users_db = {1: {"name": "Alice", "age": 30}, 2: {"name": "Bob", "age": 25}}

@app.put("/users/{user_id}", status_code=200)
async def update_user(
    user_id: int = Path(gt=0),
    user: UserUpdate = ...,
):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    users_db[user_id] = user.model_dump()
    return users_db[user_id]
```

**Scenarios:**

```python
# Scenario 1: PUT /users/1  body: {"name": "Alice Updated", "age": 31}
# Status: 200 - valid path param, valid body, user exists
# Response: {"name": "Alice Updated", "age": 31}

# Scenario 2: PUT /users/99  body: {"name": "Charlie", "age": 28}
# Status: 404 - valid input but user_id 99 not in database
# Response: {"detail": "User not found"}

# Scenario 3: PUT /users/0  body: {"name": "Test", "age": 25}
# Status: 422 - Path(gt=0) constraint fails (0 is not > 0)
# Response: {"detail": [{"type": "greater_than", "loc": ["path", "user_id"], ...}]}

# Scenario 4: PUT /users/abc  body: {"name": "Test", "age": 25}
# Status: 422 - "abc" cannot be parsed as int
# Response: {"detail": [{"type": "int_parsing", "loc": ["path", "user_id"], ...}]}

# Scenario 5: PUT /users/1  body: {"name": "", "age": 25}
# Status: 422 - name min_length=1 fails for empty string
# Response: {"detail": [{"type": "string_too_short", "loc": ["body", "name"], ...}]}

# Scenario 6: PUT /users/1  body: {"name": "Alice", "age": -5}
# Status: 422 - age ge=0 fails for -5
# Response: {"detail": [{"type": "greater_than_equal", "loc": ["body", "age"], ...}]}

# Scenario 7: PUT /users/1  (no body)
# Status: 422 - request body is required
# Response: {"detail": [{"type": "missing", "loc": ["body"], ...}]}

# Scenario 8: PUT /users/1  body: {"name": "Alice"}
# Status: 422 - "age" field is required (no default)
# Response: {"detail": [{"type": "missing", "loc": ["body", "age"], ...}]}
```

**Key insight:** FastAPI validates parameters in this order:
1. Path parameters (type parsing + constraints)
2. Query parameters
3. Request body (Pydantic model validation)

If path validation fails, body validation never runs. This is why Scenario 3 returns a path error even if the body were also invalid.

**Why interviewer asks this:** Output prediction questions test deep understanding of the validation pipeline and HTTP semantics.

**Follow-up:** "How would you customize the 422 error response format to match your team's standard error schema?"

---

### Q29 (Case Study): You're building a REST API for a healthcare appointment system. Design the core endpoints with proper validation, models, and middleware.

**Answer:**

```python
import logging
import time
import uuid
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Optional

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Header,
    Path,
    Query,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from starlette.middleware.base import BaseHTTPMiddleware


# ============================================================
# Models
# ============================================================

class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"

class Specialty(str, Enum):
    general = "general"
    cardiology = "cardiology"
    dermatology = "dermatology"
    orthopedics = "orthopedics"
    pediatrics = "pediatrics"


class TimeSlot(BaseModel):
    date: date
    start_hour: int = Field(ge=8, le=17)  # 8 AM to 5 PM
    duration_minutes: int = Field(default=30, ge=15, le=120)

    @field_validator("date")
    @classmethod
    def date_not_in_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Cannot book appointments in the past")
        if v > date.today() + timedelta(days=90):
            raise ValueError("Cannot book more than 90 days in advance")
        return v

    @field_validator("date")
    @classmethod
    def no_weekends(cls, v: date) -> date:
        if v.weekday() >= 5:
            raise ValueError("Appointments are not available on weekends")
        return v


class AppointmentCreate(BaseModel):
    patient_id: int = Field(gt=0)
    doctor_id: int = Field(gt=0)
    slot: TimeSlot
    reason: str = Field(min_length=10, max_length=1000)
    is_urgent: bool = False
    notes: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def urgent_same_day_only(self) -> "AppointmentCreate":
        if self.is_urgent and self.slot.date != date.today():
            raise ValueError("Urgent appointments must be for today")
        return self


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    doctor_name: str
    slot: TimeSlot
    reason: str
    status: AppointmentStatus
    is_urgent: bool
    created_at: datetime
    confirmation_code: str

    model_config = ConfigDict(from_attributes=True)


class AppointmentUpdate(BaseModel):
    reason: Optional[str] = Field(default=None, min_length=10, max_length=1000)
    notes: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[AppointmentStatus] = None

    @field_validator("status")
    @classmethod
    def valid_status_transitions(cls, v: Optional[AppointmentStatus]) -> Optional[AppointmentStatus]:
        # Full transition validation would need the current status (model_validator)
        # Here we just block invalid target states
        if v == AppointmentStatus.scheduled:
            raise ValueError("Cannot manually set status back to 'scheduled'")
        return v


# ============================================================
# Dependencies
# ============================================================

async def get_db():
    db = AsyncSession(engine)
    try:
        yield db
    finally:
        await db.close()


async def get_current_user(
    authorization: str = Header(..., description="Bearer token"),
    db=Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]
    user = await db.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_role(roles: list[str]):
    async def checker(user=Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of: {roles}",
            )
        return user
    return checker


class AppointmentRateLimiter:
    """Limit appointment creation to prevent abuse."""
    MAX_PER_DAY = 3

    async def __call__(
        self,
        user=Depends(get_current_user),
        db=Depends(get_db),
    ):
        today_count = await db.count_appointments_today(user.id)
        if today_count >= self.MAX_PER_DAY:
            raise HTTPException(
                status_code=429,
                detail=f"Maximum {self.MAX_PER_DAY} appointments per day",
            )
        return user


# ============================================================
# Middleware
# ============================================================

class AuditLogMiddleware(BaseHTTPMiddleware):
    """HIPAA-compliant audit logging for healthcare API."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)

        # Log PHI access events
        if "/appointments" in request.url.path or "/patients" in request.url.path:
            audit_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "user_agent": request.headers.get("user-agent", ""),
                # In production: include authenticated user ID
            }
            logging.getLogger("audit").info(
                f"PHI_ACCESS: {audit_entry}"
            )

        response.headers["X-Request-ID"] = request_id
        return response


# ============================================================
# Application
# ============================================================

app = FastAPI(
    title="Healthcare Appointment API",
    version="1.0.0",
    description="HIPAA-compliant appointment management system",
)

app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://portal.healthclinic.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

rate_limiter = AppointmentRateLimiter()


# ============================================================
# Endpoints
# ============================================================

@app.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=201,
    dependencies=[Depends(rate_limiter)],
)
async def create_appointment(
    appointment: AppointmentCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # Check doctor availability
    is_available = await db.check_doctor_slot(
        appointment.doctor_id,
        appointment.slot.date,
        appointment.slot.start_hour,
    )
    if not is_available:
        raise HTTPException(
            status_code=409,
            detail="Selected time slot is not available",
        )

    # Check for patient double-booking
    has_conflict = await db.check_patient_conflict(
        appointment.patient_id,
        appointment.slot.date,
        appointment.slot.start_hour,
    )
    if has_conflict:
        raise HTTPException(
            status_code=409,
            detail="Patient already has an appointment at this time",
        )

    db_appointment = await db.create_appointment(
        **appointment.model_dump(),
        confirmation_code=f"APT-{uuid.uuid4().hex[:8].upper()}",
    )
    return db_appointment


@app.get("/appointments", response_model=list[AppointmentResponse])
async def list_appointments(
    status: Optional[AppointmentStatus] = None,
    doctor_id: Optional[int] = Query(default=None, gt=0),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    filters = {
        "patient_id": user.id,  # Users can only see their own
        "status": status,
        "doctor_id": doctor_id,
        "date_from": date_from,
        "date_to": date_to,
    }
    return await db.list_appointments(
        filters={k: v for k, v in filters.items() if v is not None},
        skip=skip,
        limit=limit,
    )


@app.patch(
    "/appointments/{appointment_id}",
    response_model=AppointmentResponse,
)
async def update_appointment(
    appointment_id: int = Path(gt=0),
    updates: AppointmentUpdate = ...,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    appointment = await db.get_appointment(appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appointment.status in (AppointmentStatus.completed, AppointmentStatus.cancelled):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot modify a {appointment.status.value} appointment",
        )

    update_data = updates.model_dump(exclude_unset=True)
    return await db.update_appointment(appointment_id, **update_data)


@app.delete("/appointments/{appointment_id}", status_code=204)
async def cancel_appointment(
    appointment_id: int = Path(gt=0),
    cancellation_reason: str = Query(min_length=5, max_length=500),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    appointment = await db.get_appointment(appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    hours_until = (
        datetime.combine(appointment.slot.date, datetime.min.time())
        - datetime.utcnow()
    ).total_seconds() / 3600

    if hours_until < 24:
        raise HTTPException(
            status_code=409,
            detail="Cannot cancel within 24 hours of appointment",
        )

    await db.cancel_appointment(appointment_id, cancellation_reason)


# Admin-only endpoint
@app.get(
    "/admin/appointments",
    response_model=list[AppointmentResponse],
)
async def admin_list_appointments(
    doctor_id: Optional[int] = Query(default=None, gt=0),
    status: Optional[AppointmentStatus] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    admin=Depends(require_role(["admin", "receptionist"])),
    db=Depends(get_db),
):
    # Admins can see all appointments (no patient_id filter)
    return await db.list_appointments(
        filters={"doctor_id": doctor_id, "status": status},
        skip=skip,
        limit=limit,
    )
```

**Design decisions explained:**
- **TimeSlot validation** prevents past dates, weekends, and 90+ day bookings at the model layer.
- **model_validator** enforces that urgent appointments must be same-day - a cross-field rule.
- **Rate limiting** via dependency prevents patients from booking excessive appointments.
- **Audit middleware** logs all access to patient data (HIPAA compliance).
- **Role-based access** via parameterized dependencies (`require_role`).
- **409 Conflict** for double-bookings instead of 400 - semantically correct.
- **24-hour cancellation policy** enforced in the endpoint logic.

**Why interviewer asks this:** Healthcare is a domain with strict requirements (HIPAA, business rules, audit logging). This tests your ability to design a complete, production-quality API.

**Follow-up:** "How would you handle appointment rescheduling as an atomic operation (cancel old + create new)?"

---

### Q30 (Case Study): Your team's FastAPI service has a P95 latency of 2 seconds. Walk through how you'd diagnose and fix it.

**Answer:**

**Step 1: Add timing middleware to identify slow layers**

```python
@app.middleware("http")
async def performance_middleware(request: Request, call_next):
    start = time.perf_counter()

    # Track dependency resolution time
    request.state.timings = {}

    response = await call_next(request)

    total = time.perf_counter() - start
    response.headers["Server-Timing"] = (
        f"total;dur={total*1000:.1f}, "
        f"db;dur={request.state.timings.get('db', 0)*1000:.1f}, "
        f"auth;dur={request.state.timings.get('auth', 0)*1000:.1f}"
    )

    if total > 1.0:
        logger.warning(f"Slow request: {request.method} {request.url.path} took {total:.2f}s")

    return response
```

**Step 2: Instrument database dependency**

```python
async def get_db(request: Request):
    start = time.perf_counter()
    db = AsyncSession(engine)
    request.state.timings["db_connect"] = time.perf_counter() - start
    try:
        yield db
    finally:
        await db.close()
```

**Step 3: Common culprits and fixes**

```python
# PROBLEM 1: Sync function blocking the event loop
# BAD - blocks the entire event loop
@app.get("/report")
async def get_report():
    data = requests.get("https://api.external.com/data")  # SYNC HTTP!
    return data.json()

# FIX - use async HTTP client
import httpx

@app.get("/report")
async def get_report():
    async with httpx.AsyncClient() as client:
        data = await client.get("https://api.external.com/data")
    return data.json()


# PROBLEM 2: N+1 query in a loop
# BAD - 1 query for users + N queries for profiles
@app.get("/users")
async def list_users(db=Depends(get_db)):
    users = await db.execute(select(User))
    result = []
    for user in users.scalars():
        profile = await db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
        result.append({**user.__dict__, "profile": profile.scalar()})
    return result

# FIX - eager loading with joinedload
from sqlalchemy.orm import joinedload

@app.get("/users")
async def list_users(db=Depends(get_db)):
    result = await db.execute(
        select(User).options(joinedload(User.profile)).limit(100)
    )
    return result.unique().scalars().all()


# PROBLEM 3: Missing connection pooling
# BAD - new connection per request
engine = create_async_engine("postgresql+asyncpg://...", pool_size=5)

# FIX - properly sized pool
engine = create_async_engine(
    "postgresql+asyncpg://...",
    pool_size=20,          # Match expected concurrent requests
    max_overflow=10,       # Allow burst traffic
    pool_timeout=30,       # Don't wait forever for a connection
    pool_recycle=3600,     # Recycle connections every hour
    pool_pre_ping=True,    # Verify connections are alive
)


# PROBLEM 4: Pydantic serialization of large objects
# BAD - serializing 10,000 ORM objects through Pydantic
@app.get("/data", response_model=list[DataItem])
async def get_data():
    items = await db.execute(select(DataItem))
    return items.scalars().all()  # Pydantic validates each of 10,000 items

# FIX - paginate + use response_model_exclude_unset
@app.get("/data", response_model=list[DataItem])
async def get_data(skip: int = 0, limit: int = Query(default=50, le=100)):
    items = await db.execute(select(DataItem).offset(skip).limit(limit))
    return items.scalars().all()
```

**Step 4: Use profiling for remaining issues**

```python
# Add to development only
import cProfile
import pstats
from io import StringIO

@app.middleware("http")
async def profiling_middleware(request: Request, call_next):
    if request.headers.get("X-Profile") == "true":
        profiler = cProfile.Profile()
        profiler.enable()
        response = await call_next(request)
        profiler.disable()

        stream = StringIO()
        stats = pstats.Stats(profiler, stream=stream)
        stats.sort_stats("cumulative")
        stats.print_stats(20)
        logger.info(f"Profile:\n{stream.getvalue()}")
        return response

    return await call_next(request)
```

**Checklist:**
1. Is there sync code inside `async def` endpoints? (use `run_in_executor` or switch to async libraries)
2. Is the database connection pool properly sized?
3. Are there N+1 queries? (add eager loading or batching)
4. Is Pydantic serializing too many objects? (add pagination)
5. Are external API calls sequential? (use `asyncio.gather` for parallel calls)
6. Is middleware doing heavy work? (especially body reading)

**Why interviewer asks this:** Performance debugging is a core senior-level skill. This tests whether you can systematically diagnose production issues.

**Follow-up:** "How would you set up continuous performance monitoring for this API so you catch regressions before they reach production?"

---

### Q31 (Output): Predict the exact behavior of this dependency chain.

```python
from fastapi import Depends, FastAPI

app = FastAPI()

call_log = []

async def dep_a():
    call_log.append("A start")
    yield "A"
    call_log.append("A end")

async def dep_b(a=Depends(dep_a)):
    call_log.append("B start")
    yield f"B({a})"
    call_log.append("B end")

async def dep_c(a=Depends(dep_a)):
    call_log.append("C start")
    yield f"C({a})"
    call_log.append("C end")

@app.get("/test")
async def test_endpoint(
    b=Depends(dep_b),
    c=Depends(dep_c),
):
    call_log.append("handler")
    return {"b": b, "c": c, "log": call_log}
```

**What is the response?**

```json
{
    "b": "B(A)",
    "c": "C(A)",
    "log": ["A start", "B start", "C start", "handler"]
}
```

**After the response is sent, call_log becomes:**
```python
["A start", "B start", "C start", "handler", "C end", "B end", "A end"]
```

**Key observations:**

1. **`dep_a` is called only ONCE** even though both `dep_b` and `dep_c` depend on it. FastAPI caches dependency results within a request.
2. **Teardown runs in reverse order** - `dep_c` (last setup) cleans up first, then `dep_b`, then `dep_a`.
3. **The response body is formed before teardown runs**, so the client sees `call_log` without the "end" entries.
4. If you need `dep_a` to be called twice (separate instances), use `Depends(dep_a, use_cache=False)`.

**Why interviewer asks this:** This tests deep understanding of FastAPI's dependency caching and lifecycle management.

**Follow-up:** "When would you use `use_cache=False`, and what are the implications?"

---

## Quick Reference Cheat Sheet

### FastAPI vs Flask vs Django at a Glance

```
FastAPI: ASGI, async-first, Pydantic validation, auto docs, no ORM
Flask:   WSGI, sync-first, minimal, micro-framework, no ORM
Django:  WSGI (ASGI partial), batteries-included, ORM, admin panel
```

### Parameter Resolution Rules

```
In path template {name}  →  Path parameter
Not in template, has default  →  Optional query parameter
Not in template, no default  →  Required query parameter
Pydantic BaseModel  →  Request body (JSON)
Depends(func)  →  Dependency injection
Header(...)  →  HTTP header
Cookie(...)  →  HTTP cookie
```

### Pydantic Validation Order

```
1. model_validator(mode="before")  →  Raw input preprocessing
2. field_validator(mode="before")  →  Per-field, before coercion
3. Type coercion                   →  str → int, etc.
4. Field constraints               →  min_length, ge, pattern
5. field_validator(mode="after")   →  Per-field, after coercion
6. model_validator(mode="after")   →  Cross-field validation
```

### Dependency Lifecycle

```
Request arrives
  → Dependencies resolved (depth-first, cached per request)
  → Yield dependencies: code before yield runs
  → Endpoint handler executes
  → Response formed
  → Yield dependencies: code after yield runs (reverse order)
  → Response sent to client
```

### Middleware Ordering

```
app.add_middleware(A)  # Added first  → innermost
app.add_middleware(B)  # Added second → outermost

Request:  B → A → Handler
Response: Handler → A → B
```

### Common HTTP Status Codes in FastAPI

```
200 OK              →  Successful GET/PUT/PATCH
201 Created         →  Successful POST (resource created)
204 No Content      →  Successful DELETE
400 Bad Request     →  Client error (manually raised)
401 Unauthorized    →  Missing/invalid authentication
403 Forbidden       →  Authenticated but not authorized
404 Not Found       →  Resource doesn't exist
409 Conflict        →  Business logic conflict (duplicate, double-booking)
422 Unprocessable   →  Pydantic validation failure (auto by FastAPI)
429 Too Many Reqs   →  Rate limit exceeded
500 Internal Error  →  Unhandled server exception
```

---

## What's Next in Part 5

Part 5 covers **Database Integration & ORM Patterns**: SQLAlchemy async sessions, Alembic migrations, repository pattern, unit of work, connection pooling, and testing with database fixtures. We'll build on the dependency injection and Pydantic patterns from this part to create a fully integrated data layer.

---

**Series Navigation:**
- Part 1: Python Core Fundamentals
- Part 2: Object-Oriented Python
- Part 3: Async Programming & Concurrency
- **Part 4: FastAPI Fundamentals** (you are here)
- Part 5: Database Integration & ORM Patterns
- Part 6: Authentication, Security & Testing
- Part 7: Deployment, Performance & System Design
