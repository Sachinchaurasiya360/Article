# FastAPI Advanced & Production --- Interview Preparation (Part 5/7)

> **Series:** Python + FastAPI Interview Prep
> **Level:** Advanced / Production-Grade
> **Topics:** Authentication, Background Tasks, WebSockets, Rate Limiting, Custom Middleware, Error Handling, API Versioning
> **Total Questions:** 32

---

## Table of Contents

| #  | Section                                | Questions |
|----|----------------------------------------|-----------|
| 1  | [Authentication (JWT & OAuth2)](#section-1-authentication-jwt--oauth2) | Q1 -- Q7 |
| 2  | [Background Tasks & Celery](#section-2-background-tasks--celery) | Q8 -- Q12 |
| 3  | [WebSockets](#section-3-websockets) | Q13 -- Q17 |
| 4  | [Rate Limiting](#section-4-rate-limiting) | Q18 -- Q21 |
| 5  | [Custom Middleware](#section-5-custom-middleware) | Q22 -- Q25 |
| 6  | [Error Handling](#section-6-error-handling) | Q26 -- Q29 |
| 7  | [API Versioning](#section-7-api-versioning) | Q30 -- Q32 |

---

## Section 1: Authentication (JWT & OAuth2)

### Q1: Implement a complete JWT authentication system in FastAPI with login, token generation, and protected routes.

**Answer:**

```python
# auth.py
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# --- Configuration ---
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# --- Models ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

class User(BaseModel):
    username: str
    email: str | None = None
    full_name: str | None = None
    disabled: bool | None = None

class UserInDB(User):
    hashed_password: str

# --- Security utilities ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Simulated DB
fake_users_db = {
    "alice": {
        "username": "alice",
        "full_name": "Alice Wonderland",
        "email": "alice@example.com",
        "hashed_password": pwd_context.hash("secret123"),
        "disabled": False,
    }
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(db: dict, username: str, password: str) -> UserInDB | None:
    user = db.get(username)
    if not user:
        return None
    user_obj = UserInDB(**user)
    if not verify_password(password, user_obj.hashed_password):
        return None
    return user_obj

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = fake_users_db.get(token_data.username)
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# --- App ---
app = FastAPI()

@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token, token_type="bearer")

@app.get("/users/me", response_model=User)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    return current_user
```

**Key security considerations:**

- **Never store plain-text passwords.** Always use bcrypt or argon2.
- **Keep `SECRET_KEY` out of source code.** Load it from environment variables or a secrets manager.
- **Set short token lifetimes** (15-30 min) and pair with refresh tokens.
- **Always include `WWW-Authenticate` header** in 401 responses per RFC 6750.
- **Use `timezone.utc`** explicitly for `exp` claims to avoid timezone bugs.

**Why interviewer asks this:**
JWT auth is the most common authentication mechanism in modern APIs. The interviewer wants to see that you understand the full flow: password hashing, token creation with expiration, dependency injection for route protection, and proper HTTP status codes. Mistakes here (storing secrets in code, weak hashing, missing error headers) reveal production inexperience.

**Follow-up:** How would you handle token revocation given that JWTs are stateless?

---

### Q2: Implement a token refresh mechanism with separate access and refresh tokens.

**Answer:**

```python
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

SECRET_KEY = "production-secret-loaded-from-env"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# In production, store refresh tokens in Redis or a DB table
# so they can be revoked individually.
refresh_token_store: set[str] = set()

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

def create_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": token_type})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_token_pair(username: str) -> TokenPair:
    access_token = create_token(
        data={"sub": username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )
    refresh_token = create_token(
        data={"sub": username},
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )
    refresh_token_store.add(refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)

@app.post("/token/refresh", response_model=TokenPair)
async def refresh_access_token(body: RefreshRequest):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
    )

    if body.refresh_token not in refresh_token_store:
        raise credentials_exception

    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Rotate: invalidate old refresh token, issue new pair
    refresh_token_store.discard(body.refresh_token)
    return create_token_pair(username)
```

**Trade-offs of refresh token rotation:**

| Approach | Pros | Cons |
|----------|------|------|
| **Rotation (shown above)** | Detects token theft --- if old token is reused, revoke family | More complex; requires server-side storage |
| **Long-lived refresh token** | Simpler implementation | Stolen token is valid for a long time |
| **Sliding expiration** | Good UX for active users | Potentially infinite session if user keeps refreshing |

**Why interviewer asks this:**
A single short-lived token forces frequent logins. Production apps need refresh tokens for usability. The interviewer checks whether you understand token rotation, server-side storage requirements, and the security implications of each approach.

**Follow-up:** How does refresh token rotation help detect compromised tokens?

---

### Q3: Implement OAuth2 scopes to create fine-grained permissions on endpoints.

**Answer:**

```python
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jose import JWTError, jwt
from pydantic import BaseModel

SECRET_KEY = "super-secret"
ALGORITHM = "HS256"

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="token",
    scopes={
        "users:read": "Read user information",
        "users:write": "Create and modify users",
        "items:read": "Read items",
        "items:write": "Create and modify items",
        "admin": "Full administrative access",
    },
)

class User(BaseModel):
    username: str
    scopes: list[str] = []

async def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_scopes: list[str] = payload.get("scopes", [])
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = User(username=username, scopes=token_scopes)

    for scope in security_scopes.scopes:
        if scope not in user.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions. Required scope: {scope}",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return user

@app.get("/users/me")
async def read_own_profile(
    current_user: Annotated[
        User, Security(get_current_user, scopes=["users:read"])
    ],
):
    return current_user

@app.post("/users/")
async def create_user(
    current_user: Annotated[
        User, Security(get_current_user, scopes=["users:write"])
    ],
):
    return {"msg": "User created", "created_by": current_user.username}

@app.get("/admin/dashboard")
async def admin_dashboard(
    current_user: Annotated[
        User, Security(get_current_user, scopes=["admin"])
    ],
):
    return {"msg": "Welcome to admin dashboard"}
```

**Key points:**

- `Security()` is a specialized form of `Depends()` that carries scope metadata.
- `SecurityScopes.scopes` contains the scopes required by the *current* endpoint.
- Scopes are embedded in the JWT payload at token creation time.
- The `WWW-Authenticate` header communicates required scopes to the client.
- Use `403 Forbidden` (not 401) when the user is authenticated but lacks permissions.

**Why interviewer asks this:**
Scopes are the standard way to implement fine-grained authorization in OAuth2. Interviewers want to see that you distinguish between authentication (who are you) and authorization (what can you do), and that you use FastAPI's built-in `Security` and `SecurityScopes` rather than building a custom system.

**Follow-up:** How would you implement hierarchical scopes where `admin` automatically includes all other scopes?

---

### Q4: Build an API key authentication system that works alongside JWT auth.

**Answer:**

```python
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from pydantic import BaseModel

app = FastAPI()

# Two security schemes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# In production: store hashed API keys in DB with associated permissions
API_KEYS_DB: dict[str, dict] = {
    "sk-live-abc123def456": {
        "client": "mobile-app",
        "scopes": ["items:read"],
        "rate_limit": 1000,
    },
    "sk-live-xyz789ghi012": {
        "client": "partner-service",
        "scopes": ["items:read", "items:write"],
        "rate_limit": 5000,
    },
}

class AuthenticatedEntity(BaseModel):
    identity: str
    auth_method: str  # "jwt" or "api_key"
    scopes: list[str] = []

async def get_current_entity(
    jwt_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    api_key: Annotated[str | None, Security(api_key_header)] = None,
) -> AuthenticatedEntity:
    # Try JWT first
    if jwt_token:
        # ... decode JWT, return user (omitted for brevity)
        return AuthenticatedEntity(
            identity="jwt-user", auth_method="jwt", scopes=["items:read", "items:write"]
        )

    # Fall back to API key
    if api_key:
        key_data = API_KEYS_DB.get(api_key)
        if key_data is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid API key",
            )
        return AuthenticatedEntity(
            identity=key_data["client"],
            auth_method="api_key",
            scopes=key_data["scopes"],
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No valid authentication provided. Supply a Bearer token or X-API-Key header.",
    )

@app.get("/items/")
async def list_items(
    entity: Annotated[AuthenticatedEntity, Depends(get_current_entity)],
):
    return {
        "items": ["item1", "item2"],
        "authenticated_via": entity.auth_method,
        "client": entity.identity,
    }
```

**Security considerations for API keys:**

1. **Hash keys in storage** --- store only `sha256(key)` in the database; compare hashes.
2. **Prefix keys** (`sk-live-`, `sk-test-`) so they are identifiable in logs and can be rotated by environment.
3. **Never log full keys** --- mask them in middleware (`sk-live-...f456`).
4. **Set per-key rate limits** to contain damage from compromised keys.
5. **Support key rotation** --- allow multiple active keys per client during transition periods.

**Why interviewer asks this:**
Many production APIs support both human users (JWT) and machine-to-machine clients (API keys). The interviewer wants to see a unified authentication layer that handles both schemes cleanly through dependency injection, with `auto_error=False` to allow fallback logic.

**Follow-up:** How would you implement API key rotation with zero-downtime for clients?

---

### Q5 (Debugging): The following JWT auth code never authorizes the user. Find the bug.

**Code with bug:**

```python
from jose import jwt, JWTError
from datetime import datetime, timedelta

SECRET_KEY = "my-secret"
ALGORITHM = "HS256"

def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = {"sub": username, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithm=ALGORITHM)  # BUG
        return payload.get("sub")
    except JWTError:
        return None

# Test
token = create_access_token("alice")
print(verify_token(token))  # Prints None --- why?
```

**Answer:**

The bug is on the `jwt.decode` line. The parameter name is `algorithms` (plural, expects a **list**), not `algorithm` (singular, which is the `jwt.encode` parameter).

```python
# WRONG --- 'algorithm' is silently ignored, decode uses default algorithms
payload = jwt.decode(token, SECRET_KEY, algorithm=ALGORITHM)

# CORRECT --- 'algorithms' must be a list
payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

When `algorithms` is not provided, `python-jose` may default to a different set or fail to match the token's algorithm, causing a `JWTError` that gets caught by the `except` block, which returns `None`.

**Additional issues in this code:**

- `datetime.utcnow()` is deprecated in Python 3.12+. Use `datetime.now(timezone.utc)` instead.
- The `verify_token` function silently swallows all JWT errors. In production, log the specific error for debugging.

**Why interviewer asks this:**
This is an extremely common copy-paste bug. `algorithm` vs `algorithms` is a subtle API difference between `encode` and `decode` in python-jose. It tests attention to detail and debugging methodology --- a candidate who reads the traceback vs. one who just stares at the code.

**Follow-up:** What happens if you pass `algorithms=["none"]` in `jwt.decode`? Why is this dangerous?

---

### Q6 (Output-Based): What does this code print and what is the security flaw?

```python
from jose import jwt

SECRET = "weak"
ALGORITHM = "HS256"

token = jwt.encode({"sub": "alice", "role": "admin"}, SECRET, algorithm=ALGORITHM)

# Attacker intercepts the token and does:
decoded_no_verify = jwt.decode(token, SECRET, algorithms=[ALGORITHM], options={"verify_exp": False})
print(decoded_no_verify)

# Attacker changes payload:
tampered = jwt.encode({"sub": "alice", "role": "superadmin"}, "wrong-key", algorithm=ALGORITHM)
try:
    result = jwt.decode(tampered, SECRET, algorithms=[ALGORITHM])
    print(result)
except Exception as e:
    print(f"Error: {e}")
```

**Answer / Output:**

```
{'sub': 'alice', 'role': 'admin'}
Error: Signature verification failed.
```

**Line-by-line analysis:**

1. **First `decode`:** Succeeds because the correct `SECRET` is used. Disabling `verify_exp` only skips expiration checking --- signature is still verified. Output: `{'sub': 'alice', 'role': 'admin'}`.
2. **Second `decode`:** The attacker encoded a tampered payload with `"wrong-key"`. When the server decodes with the real `SECRET`, the HMAC signature does not match, raising a `JWTError`. Output: `Error: Signature verification failed.`

**Security flaw:** The `SECRET = "weak"` is trivially brute-forceable. Tools like `jwt-cracker` can crack short HMAC secrets in seconds. In production use at minimum a 256-bit random key (`openssl rand -hex 32`).

**Why interviewer asks this:**
Tests understanding of what JWT verification actually checks (signature integrity, expiration, claims) and what `options` flags bypass. Also checks awareness that disabling `verify_exp` is sometimes needed (e.g., for refresh token decoding) but must never be used carelessly.

**Follow-up:** Can an attacker use the `"alg": "none"` attack if the server specifies `algorithms=["HS256"]`?

---

### Q7 (Case Study): Design an auth system for a multi-tenant SaaS where each tenant has its own user roles.

**Answer:**

```python
from enum import Enum
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

SECRET_KEY = "loaded-from-vault"
ALGORITHM = "HS256"

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class TenantRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"

ROLE_HIERARCHY = {
    TenantRole.OWNER: 4,
    TenantRole.ADMIN: 3,
    TenantRole.MEMBER: 2,
    TenantRole.VIEWER: 1,
}

class TenantUser(BaseModel):
    user_id: str
    tenant_id: str
    role: TenantRole

class RequireTenantRole:
    """Dependency that enforces a minimum tenant role."""

    def __init__(self, minimum_role: TenantRole):
        self.minimum_role = minimum_role

    async def __call__(
        self,
        tenant_id: str,  # From path parameter
        token: Annotated[str, Depends(oauth2_scheme)],
    ) -> TenantUser:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

        user_id = payload.get("sub")
        # In production: query DB for user's role in this specific tenant
        tenant_roles: dict[str, str] = payload.get("tenant_roles", {})
        user_role_str = tenant_roles.get(tenant_id)

        if user_role_str is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User has no access to tenant {tenant_id}",
            )

        user_role = TenantRole(user_role_str)
        if ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[self.minimum_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least {self.minimum_role.value} role",
            )

        return TenantUser(user_id=user_id, tenant_id=tenant_id, role=user_role)

# Usage with different role requirements per endpoint
@app.get("/tenants/{tenant_id}/settings")
async def get_settings(
    tenant_user: Annotated[TenantUser, Depends(RequireTenantRole(TenantRole.VIEWER))],
):
    return {"tenant": tenant_user.tenant_id, "settings": {}}

@app.put("/tenants/{tenant_id}/settings")
async def update_settings(
    tenant_user: Annotated[TenantUser, Depends(RequireTenantRole(TenantRole.ADMIN))],
):
    return {"msg": "Settings updated", "by": tenant_user.user_id}

@app.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_user: Annotated[TenantUser, Depends(RequireTenantRole(TenantRole.OWNER))],
):
    return {"msg": f"Tenant {tenant_user.tenant_id} scheduled for deletion"}
```

**Architecture decisions:**

| Decision | Rationale |
|----------|-----------|
| Roles in JWT `tenant_roles` claim | Avoids DB lookup on every request; good for low-churn roles |
| Callable class for `RequireTenantRole` | Allows parameterized dependencies with clean syntax |
| Role hierarchy as numeric levels | Simplifies "at least X" comparisons without listing all combos |
| Tenant ID from path parameter | Ensures authorization is scoped to the resource being accessed |

**Trade-off --- roles in JWT vs. DB lookup:**
- **JWT:** Fast, no DB hit. But roles are stale until token is refreshed. Fine if roles change rarely.
- **DB lookup:** Always fresh. Required if roles can be revoked in real time (e.g., removing a team member).
- **Hybrid:** Cache roles in Redis with short TTL; invalidate on role change events.

**Why interviewer asks this:**
Multi-tenancy is a real production concern. The interviewer wants to see how you scope authorization per tenant, handle role hierarchies cleanly, and reason about trade-offs between stateless JWTs and stateful lookups.

**Follow-up:** How would you handle a user who belongs to 50+ tenants? Would you still embed all roles in the JWT?

---

## Section 2: Background Tasks & Celery

### Q8: Explain the difference between FastAPI's `BackgroundTasks` and Celery. When would you use each?

**Answer:**

```python
# --- Approach 1: FastAPI BackgroundTasks (in-process) ---
from fastapi import BackgroundTasks, FastAPI

app = FastAPI()

def send_welcome_email(email: str):
    """Runs in the same process, after the response is sent."""
    # Simulate sending email
    import time
    time.sleep(2)  # Blocks a thread but response is already sent
    print(f"Email sent to {email}")

@app.post("/register")
async def register_user(email: str, background_tasks: BackgroundTasks):
    # User is created immediately
    background_tasks.add_task(send_welcome_email, email)
    return {"msg": "User registered"}  # Returns instantly


# --- Approach 2: Celery (distributed task queue) ---
# tasks.py
from celery import Celery

celery_app = Celery("tasks", broker="redis://localhost:6379/0")

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_video(self, video_id: str):
    try:
        # Heavy processing: transcoding, thumbnail generation
        # Runs in a separate worker process (possibly on a different machine)
        pass
    except Exception as exc:
        self.retry(exc=exc)

# main.py
from fastapi import FastAPI
from tasks import process_video

app = FastAPI()

@app.post("/videos/{video_id}/process")
async def start_processing(video_id: str):
    task = process_video.delay(video_id)
    return {"task_id": task.id, "status": "queued"}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    from celery.result import AsyncResult
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
```

**Comparison:**

| Feature | `BackgroundTasks` | Celery |
|---------|-------------------|--------|
| Infrastructure | None (in-process) | Requires broker (Redis/RabbitMQ) + worker processes |
| Reliability | Task lost if process crashes | Tasks persist in broker; retries built-in |
| Scalability | Limited to one server | Horizontally scalable workers |
| Use case | Send email, write log, light cleanup | Video processing, report generation, ML inference |
| Task status tracking | No | Yes (`AsyncResult`) |
| Scheduling | No | Yes (Celery Beat) |
| Latency | Near-zero overhead | Milliseconds (broker round-trip) |

**Why interviewer asks this:**
Choosing the wrong tool here is a common mistake. Using Celery for a simple email notification adds unnecessary infrastructure. Using `BackgroundTasks` for video processing will block your server. The interviewer wants to see you reason about trade-offs.

**Follow-up:** What happens to a `BackgroundTasks` task if the server restarts before it completes?

---

### Q9: Implement a Celery task with retry logic, dead-letter handling, and status tracking exposed via FastAPI.

**Answer:**

```python
# celery_config.py
from celery import Celery

celery_app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,            # Acknowledge only after task completes
    worker_prefetch_multiplier=1,   # Fetch one task at a time for fairness
    task_reject_on_worker_lost=True,
)

# tasks.py
import logging
from celery import Task
from celery_config import celery_app

logger = logging.getLogger(__name__)

class BaseTaskWithCallbacks(Task):
    """Custom base task with lifecycle hooks."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Task {task_id} failed permanently: {exc}")
        # Move to dead-letter queue / notify ops team
        celery_app.send_task(
            "tasks.handle_dead_letter",
            args=[task_id, str(exc), args, kwargs],
        )

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        logger.warning(f"Task {task_id} retrying due to: {exc}")

    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"Task {task_id} completed successfully")

@celery_app.task(
    base=BaseTaskWithCallbacks,
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,       # Exponential backoff: 1s, 2s, 4s, ...
    retry_backoff_max=300,    # Cap at 5 minutes
    retry_jitter=True,        # Add randomness to prevent thundering herd
    time_limit=600,           # Hard kill after 10 minutes
    soft_time_limit=540,      # Raise SoftTimeLimitExceeded at 9 minutes
)
def process_order(self, order_id: str) -> dict:
    from celery.exceptions import SoftTimeLimitExceeded
    try:
        # ... heavy processing logic ...
        return {"order_id": order_id, "status": "processed"}
    except SoftTimeLimitExceeded:
        # Graceful cleanup before hard kill
        logger.warning(f"Order {order_id} processing timed out, cleaning up")
        return {"order_id": order_id, "status": "timeout"}

@celery_app.task
def handle_dead_letter(task_id: str, error: str, args: list, kwargs: dict):
    """Store failed tasks for manual review."""
    logger.critical(f"Dead letter: task={task_id}, error={error}")
    # In production: write to a dead_letter_queue table in your DB

# main.py
from fastapi import FastAPI, HTTPException
from celery.result import AsyncResult
from celery_config import celery_app
from tasks import process_order

app = FastAPI()

@app.post("/orders/{order_id}/process")
async def queue_order_processing(order_id: str):
    task = process_order.delay(order_id)
    return {"task_id": task.id}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    response = {
        "task_id": task_id,
        "status": result.status,  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
    }
    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)
    return response
```

**Why interviewer asks this:**
Production Celery setups require more than just `@task`. The interviewer wants to see retry strategies (exponential backoff with jitter), time limits, dead-letter handling, late acknowledgment (`acks_late`), and proper status tracking. These are the differences between a toy setup and a production one.

**Follow-up:** What is the "visibility timeout" problem with Redis as a Celery broker, and how does `acks_late` interact with it?

---

### Q10 (Debugging): This background task silently fails. Why?

```python
from fastapi import BackgroundTasks, FastAPI
from sqlalchemy.orm import Session
from database import get_db

app = FastAPI()

def update_analytics(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    user.login_count += 1
    db.commit()

@app.post("/login")
async def login(user_id: int, background_tasks: BackgroundTasks):
    db = next(get_db())  # Get a DB session
    background_tasks.add_task(update_analytics, db, user_id)
    return {"msg": "Logged in"}
```

**Answer:**

The background task silently fails because of **database session lifecycle issues**:

1. **`get_db()` is a generator** that typically does `yield session` then `session.close()` in the `finally` block. When you call `next(get_db())`, you get the session but the generator is not fully exhausted --- the cleanup code never runs reliably.

2. **More critically**, by the time the background task runs, the response has already been sent. If `get_db()` is used as a FastAPI dependency elsewhere in the request, the session may already be **closed or rolled back** by the dependency cleanup.

3. The session object is **not thread-safe**. If the background task runs in a thread pool (which `BackgroundTasks` does for sync functions), sharing a session across threads causes race conditions.

**Fix:**

```python
def update_analytics(user_id: int):
    """Create a fresh session inside the background task."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.login_count += 1
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@app.post("/login")
async def login(user_id: int, background_tasks: BackgroundTasks):
    # Only pass serializable data, not live objects
    background_tasks.add_task(update_analytics, user_id)
    return {"msg": "Logged in"}
```

**Rule of thumb:** Never pass database sessions, file handles, or connection objects to background tasks. Pass IDs and primitive data; let the task create its own resources.

**Why interviewer asks this:**
This is one of the most common production bugs with FastAPI background tasks. It reveals whether the candidate understands SQLAlchemy session scoping, generator-based dependencies, and thread safety.

**Follow-up:** How would this change if you were using async SQLAlchemy with `AsyncSession`?

---

### Q11 (Coding): Implement a task queue using Redis and FastAPI without Celery.

**Answer:**

```python
import asyncio
import json
import uuid
from enum import Enum

import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskResult(BaseModel):
    task_id: str
    status: TaskStatus
    result: dict | None = None
    error: str | None = None

REDIS_URL = "redis://localhost:6379/0"
QUEUE_NAME = "task_queue"

redis_pool = redis.ConnectionPool.from_url(REDIS_URL)

def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=redis_pool)

@app.post("/tasks/", response_model=TaskResult)
async def enqueue_task(payload: dict):
    task_id = str(uuid.uuid4())
    r = get_redis()

    task_data = {"task_id": task_id, "payload": payload}
    await r.lpush(QUEUE_NAME, json.dumps(task_data))
    await r.hset(f"task:{task_id}", mapping={
        "status": TaskStatus.QUEUED,
        "result": "",
        "error": "",
    })

    return TaskResult(task_id=task_id, status=TaskStatus.QUEUED)

@app.get("/tasks/{task_id}", response_model=TaskResult)
async def get_task(task_id: str):
    r = get_redis()
    data = await r.hgetall(f"task:{task_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Task not found")

    status = data[b"status"].decode()
    result_str = data[b"result"].decode()
    error_str = data[b"error"].decode()

    return TaskResult(
        task_id=task_id,
        status=TaskStatus(status),
        result=json.loads(result_str) if result_str else None,
        error=error_str or None,
    )

# --- Worker (run as a separate process) ---
async def worker():
    """Continuously pulls tasks from the queue and processes them."""
    r = get_redis()
    print("Worker started, waiting for tasks...")

    while True:
        # BRPOP blocks until a task is available (timeout=0 means block forever)
        _, raw = await r.brpop(QUEUE_NAME, timeout=0)
        task_data = json.loads(raw)
        task_id = task_data["task_id"]

        await r.hset(f"task:{task_id}", "status", TaskStatus.PROCESSING)

        try:
            # Simulate processing
            result = {"processed": task_data["payload"], "doubled": 42}
            await asyncio.sleep(2)

            await r.hset(f"task:{task_id}", mapping={
                "status": TaskStatus.COMPLETED,
                "result": json.dumps(result),
            })
        except Exception as e:
            await r.hset(f"task:{task_id}", mapping={
                "status": TaskStatus.FAILED,
                "error": str(e),
            })

if __name__ == "__main__":
    asyncio.run(worker())
```

**When to use this over Celery:**

- You need a very lightweight task queue without Celery's overhead.
- Your team already uses Redis and does not want to manage Celery worker configurations.
- Tasks are simple and do not need advanced features like chords, groups, or canvas workflows.

**Why interviewer asks this:**
Building a task queue from primitives demonstrates deep understanding of message queues, Redis data structures (`LIST` for queue, `HASH` for status), and the producer-consumer pattern. It also shows you can evaluate when a framework (Celery) is overkill.

**Follow-up:** How would you add "at-least-once" delivery guarantees to this implementation?

---

### Q12 (Output-Based): What is the execution order of the following code?

```python
from fastapi import BackgroundTasks, FastAPI
from fastapi.testclient import TestClient

app = FastAPI()
execution_log: list[str] = []

def task_a():
    execution_log.append("task_a")

def task_b():
    execution_log.append("task_b")

@app.post("/run")
async def run(background_tasks: BackgroundTasks):
    execution_log.append("handler_start")
    background_tasks.add_task(task_a)
    execution_log.append("handler_middle")
    background_tasks.add_task(task_b)
    execution_log.append("handler_end")
    return {"msg": "done"}

client = TestClient(app)
response = client.post("/run")
print(execution_log)
print(response.json())
```

**Answer / Output:**

```
['handler_start', 'handler_middle', 'handler_end', 'task_a', 'task_b']
{'msg': 'done'}
```

**Explanation:**

1. The handler runs synchronously top-to-bottom: `handler_start`, `handler_middle`, `handler_end`.
2. `add_task` does **not** execute the task immediately --- it schedules it.
3. After the response is fully generated, FastAPI's `BackgroundTasks` middleware runs the queued tasks **in order**: `task_a` then `task_b`.
4. With `TestClient` (which uses `httpx` under the hood in sync mode), the background tasks complete **before** `client.post()` returns, so `execution_log` contains all five entries.
5. In a real async server, the response would be sent to the client first, and background tasks would run afterward.

**Why interviewer asks this:**
Tests understanding of `BackgroundTasks` execution timing, the difference between scheduling and execution, FIFO ordering, and the subtle behavior difference between `TestClient` (synchronous) and a real async server.

**Follow-up:** Would the output differ if you used `async def task_a()` instead of `def task_a()`?

---

## Section 3: WebSockets

### Q13: Implement a WebSocket chat room with connection management and broadcasting in FastAPI.

**Answer:**

```python
import asyncio
from dataclasses import dataclass, field
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone

app = FastAPI()

@dataclass
class ConnectionManager:
    """Manages WebSocket connections per room with thread-safe operations."""

    # room_id -> set of active WebSocket connections
    rooms: dict[str, set[WebSocket]] = field(default_factory=dict)

    async def connect(self, websocket: WebSocket, room_id: str) -> None:
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]  # Clean up empty rooms

    async def broadcast(self, room_id: str, message: dict, exclude: WebSocket | None = None) -> None:
        """Send message to all connections in a room, handling stale connections."""
        if room_id not in self.rooms:
            return

        stale_connections: list[WebSocket] = []

        async def _send(ws: WebSocket):
            try:
                await ws.send_json(message)
            except Exception:
                stale_connections.append(ws)

        tasks = [
            _send(ws)
            for ws in self.rooms[room_id]
            if ws != exclude
        ]
        await asyncio.gather(*tasks)

        # Clean up connections that failed during broadcast
        for ws in stale_connections:
            self.disconnect(ws, room_id)

    def get_room_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, set()))

manager = ConnectionManager()

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    username = websocket.query_params.get("username", "Anonymous")

    await manager.connect(websocket, room_id)
    await manager.broadcast(room_id, {
        "type": "system",
        "content": f"{username} joined the room",
        "users_online": manager.get_room_count(room_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(room_id, {
                "type": "message",
                "username": username,
                "content": data.get("content", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        await manager.broadcast(room_id, {
            "type": "system",
            "content": f"{username} left the room",
            "users_online": manager.get_room_count(room_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
```

**Production considerations:**

- **Multi-server:** This in-memory manager only works on a single server instance. For horizontal scaling, use Redis Pub/Sub or a dedicated WebSocket service (e.g., Centrifugo, Pusher).
- **Authentication:** Validate JWT tokens during the `connect` phase before calling `accept()`.
- **Heartbeats:** Implement ping/pong frames to detect dead connections (browser navigated away without closing).
- **Message size limits:** Set `max_size` in the WebSocket configuration to prevent abuse.

**Why interviewer asks this:**
WebSocket management is a common production task. The interviewer wants to see room-based grouping, graceful disconnect handling, stale connection cleanup during broadcast, and awareness of scaling limitations.

**Follow-up:** How would you scale this to 10 server instances behind a load balancer?

---

### Q14: How do you authenticate WebSocket connections in FastAPI?

**Answer:**

```python
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    Query,
    WebSocket,
    WebSocketException,
    status,
)
from jose import JWTError, jwt

SECRET_KEY = "from-env"
ALGORITHM = "HS256"

app = FastAPI()

async def get_ws_user(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    session: str | None = Cookie(default=None),
) -> str:
    """
    Authenticate WebSocket connections.

    WebSockets cannot use Authorization headers in browsers,
    so we accept tokens via:
    1. Query parameter: ws://host/ws?token=xxx
    2. Cookie: Useful for browser-based apps
    """
    auth_token = token or session

    if auth_token is None:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing authentication token",
        )

    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
        return username
    except JWTError:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid token",
        )

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    username: str = Depends(get_ws_user),
):
    await websocket.accept()
    await websocket.send_json({"msg": f"Welcome, {username}!"})

    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"{username}: {data}")
    except Exception:
        pass
```

**Why browsers cannot use `Authorization` headers with WebSockets:**

The WebSocket API in browsers (`new WebSocket(url)`) does not support custom headers. You have three options:

1. **Query parameter** (`?token=xxx`): Simple but tokens appear in server logs and browser history.
2. **Cookie**: Browser sends it automatically; use `Secure`, `HttpOnly`, `SameSite=Strict`.
3. **First-message auth**: Accept the connection, expect the first message to be a token, validate, then proceed or close. More complex but avoids URL exposure.

**Why interviewer asks this:**
WebSocket auth is fundamentally different from HTTP auth because of browser limitations. This catches candidates who assume `Authorization` headers work with WebSockets.

**Follow-up:** What are the security implications of passing a JWT token in a WebSocket URL query parameter?

---

### Q15 (Coding): Implement a WebSocket endpoint that sends server-side events (e.g., stock price updates) to multiple clients.

**Answer:**

```python
import asyncio
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

class StockTicker:
    """Simulates real-time stock price updates using pub/sub pattern."""

    def __init__(self):
        self.subscribers: dict[str, set[WebSocket]] = {}
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._generate_prices())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def subscribe(self, symbol: str, ws: WebSocket):
        if symbol not in self.subscribers:
            self.subscribers[symbol] = set()
        self.subscribers[symbol].add(ws)

    def unsubscribe(self, symbol: str, ws: WebSocket):
        if symbol in self.subscribers:
            self.subscribers[symbol].discard(ws)

    async def _generate_prices(self):
        """Simulate price changes and push to subscribers."""
        prices = {"AAPL": 150.0, "GOOG": 2800.0, "TSLA": 250.0}

        while self._running:
            for symbol, price in prices.items():
                # Random walk
                change = random.uniform(-2.0, 2.0)
                prices[symbol] = round(price + change, 2)

                if symbol in self.subscribers:
                    message = {
                        "symbol": symbol,
                        "price": prices[symbol],
                        "change": round(change, 2),
                    }
                    stale = []
                    for ws in self.subscribers[symbol]:
                        try:
                            await ws.send_json(message)
                        except Exception:
                            stale.append(ws)
                    for ws in stale:
                        self.subscribers[symbol].discard(ws)

            await asyncio.sleep(1)

ticker = StockTicker()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ticker.start()
    yield
    await ticker.stop()

app = FastAPI(lifespan=lifespan)

@app.websocket("/ws/stocks/{symbol}")
async def stock_feed(websocket: WebSocket, symbol: str):
    symbol = symbol.upper()
    await websocket.accept()
    ticker.subscribe(symbol, websocket)

    try:
        while True:
            # Keep connection alive; client can send commands
            data = await websocket.receive_json()
            if data.get("action") == "subscribe":
                new_symbol = data["symbol"].upper()
                ticker.subscribe(new_symbol, websocket)
            elif data.get("action") == "unsubscribe":
                old_symbol = data["symbol"].upper()
                ticker.unsubscribe(old_symbol, websocket)
    except WebSocketDisconnect:
        ticker.unsubscribe(symbol, websocket)
```

**Key design points:**

- Uses FastAPI's `lifespan` context manager (not deprecated `on_event`) to start/stop the ticker.
- Clients can dynamically subscribe/unsubscribe to symbols.
- Stale connections are cleaned up during broadcast.
- The price generator runs as a single `asyncio.Task`, not per-client, which is efficient.

**Why interviewer asks this:**
This tests the ability to combine WebSockets with server-side event generation, lifecycle management, and the pub/sub pattern. It is a realistic use case (financial data, IoT, dashboards).

**Follow-up:** How would you handle back-pressure if a client cannot keep up with the message rate?

---

### Q16 (Debugging): This WebSocket endpoint crashes intermittently. Why?

```python
from fastapi import FastAPI, WebSocket

app = FastAPI()
connections: list[WebSocket] = []

@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)

    try:
        while True:
            msg = await websocket.receive_text()
            # Broadcast to all
            for conn in connections:
                await conn.send_text(msg)
    except Exception:
        connections.remove(websocket)
```

**Answer:**

There are **three bugs** in this code:

**Bug 1 --- Modifying a list while iterating over it (indirectly):**
If `conn.send_text(msg)` fails because a connection is dead, the `except` block calls `connections.remove(websocket)` --- but that removes the *sender*, not the dead connection. Meanwhile, the dead connection stays in the list and causes errors on the next broadcast.

**Bug 2 --- `RuntimeError: list changed size during iteration`:**
If two clients disconnect simultaneously, one coroutine's `connections.remove()` can mutate the list while another coroutine is iterating over it in the `for conn in connections:` loop.

**Bug 3 --- No distinction between send and receive errors:**
The broad `except Exception` catches both `receive_text()` failures (client disconnected) and `send_text()` failures (a *different* client disconnected). These should be handled differently.

**Fix:**

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio

app = FastAPI()
connections: set[WebSocket] = set()  # Use a set for O(1) removal

@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)

    try:
        while True:
            msg = await websocket.receive_text()
            # Broadcast to all: iterate over a snapshot copy
            stale: list[WebSocket] = []
            for conn in list(connections):  # list() creates a snapshot
                try:
                    await conn.send_text(msg)
                except Exception:
                    stale.append(conn)
            for conn in stale:
                connections.discard(conn)
    except WebSocketDisconnect:
        connections.discard(websocket)
```

**Why interviewer asks this:**
Concurrent mutation of shared state is the most common WebSocket bug. The interviewer checks whether you understand asyncio concurrency (even without threads, `await` yields control) and defensive broadcasting patterns.

**Follow-up:** Is a Python `set` truly thread-safe here, or do we need a lock?

---

### Q17 (Conceptual): What is the difference between WebSockets, Server-Sent Events (SSE), and long polling? When would you use each?

**Answer:**

| Feature | WebSocket | SSE | Long Polling |
|---------|-----------|-----|-------------|
| Direction | Bidirectional | Server-to-client only | Simulated bidirectional |
| Protocol | `ws://` / `wss://` (upgrade from HTTP) | HTTP (text/event-stream) | HTTP (repeated requests) |
| Reconnection | Manual (client must implement) | Built-in (`EventSource` auto-reconnects) | Built-in (client re-requests) |
| Binary data | Yes | No (text only) | Yes |
| Proxy/CDN support | Often problematic | Excellent | Excellent |
| Connection overhead | Low (one persistent connection) | Low (one persistent connection) | High (new connection per poll) |
| Browser support | All modern browsers | All except old IE | Universal |

**When to use each:**

- **WebSocket:** Real-time bidirectional --- chat, collaborative editing, gaming, live trading.
- **SSE:** Server-push only --- live dashboards, notification feeds, log streaming. Simpler than WebSockets and works through most proxies/CDNs.
- **Long polling:** Fallback when WebSockets/SSE are not available due to infrastructure constraints. Higher latency and server load.

**SSE in FastAPI:**

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def event_generator():
    count = 0
    while True:
        count += 1
        yield f"data: {{\"count\": {count}}}\n\n"
        await asyncio.sleep(1)

@app.get("/events")
async def stream_events():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
```

**Why interviewer asks this:**
Choosing the right real-time communication mechanism is an architectural decision. Using WebSockets for a simple notification feed is over-engineering; using long polling for a chat app creates poor UX. The interviewer checks architectural judgment.

**Follow-up:** How does HTTP/2 server push differ from SSE?

---

## Section 4: Rate Limiting

### Q18: Implement rate limiting in FastAPI using `slowapi`. Then explain when you would build a custom solution.

**Answer:**

```python
from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="redis://localhost:6379/2",  # Use Redis for distributed rate limiting
)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/public")
@limiter.limit("30/minute")
async def public_endpoint(request: Request):
    return {"msg": "This endpoint allows 30 requests per minute per IP"}

@app.get("/premium")
@limiter.limit("200/minute")
async def premium_endpoint(request: Request):
    return {"msg": "Premium users get higher limits"}

# Dynamic rate limiting based on user tier
def get_rate_limit_by_user(request: Request) -> str:
    """Return different rate limits based on API key or user tier."""
    api_key = request.headers.get("X-API-Key", "")
    tier_limits = {
        "free": "10/minute",
        "pro": "100/minute",
        "enterprise": "1000/minute",
    }
    # In production: look up user tier from API key
    tier = "free"  # Default
    return tier_limits.get(tier, "10/minute")

@app.get("/dynamic")
@limiter.limit(get_rate_limit_by_user)
async def dynamic_rate_limited(request: Request):
    return {"msg": "Rate limit depends on your tier"}
```

**When to build a custom solution:**

- `slowapi` is a wrapper around `limits` library --- it is good for simple per-route limits.
- Build custom when you need: sliding window (not just fixed window), token-based limits (not IP-based), rate limiting across microservices, or complex rules (e.g., "100 reads/min AND 10 writes/min simultaneously").

**Why interviewer asks this:**
Rate limiting is essential for production APIs. The interviewer wants to see you use the right tool (`slowapi` for simple cases) and know its limitations. Dynamic rate limiting based on user tier is a very common real-world requirement.

**Follow-up:** What is the difference between fixed-window and sliding-window rate limiting?

---

### Q19 (Coding): Implement a Token Bucket rate limiter from scratch as FastAPI middleware.

**Answer:**

```python
import asyncio
import time
from dataclasses import dataclass, field

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

@dataclass
class TokenBucket:
    """
    Token Bucket Algorithm:
    - Bucket holds up to `capacity` tokens.
    - Tokens are added at `refill_rate` tokens per second.
    - Each request consumes one token.
    - If bucket is empty, request is rejected.
    """

    capacity: int
    refill_rate: float  # tokens per second
    tokens: float = field(init=False)
    last_refill: float = field(init=False)

    def __post_init__(self):
        self.tokens = float(self.capacity)
        self.last_refill = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

    @property
    def retry_after(self) -> float:
        """Seconds until the next token is available."""
        if self.tokens >= 1.0:
            return 0.0
        return (1.0 - self.tokens) / self.refill_rate

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        capacity: int = 60,
        refill_rate: float = 1.0,  # 1 token per second = 60/minute
    ):
        super().__init__(app)
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets: dict[str, TokenBucket] = {}
        self._lock = asyncio.Lock()
        self._cleanup_interval = 300  # Clean up stale buckets every 5 minutes

    def _get_client_key(self, request: Request) -> str:
        """Identify client by IP + optional API key."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
        return ip

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/docs", "/openapi.json"):
            return await call_next(request)

        client_key = self._get_client_key(request)

        async with self._lock:
            if client_key not in self.buckets:
                self.buckets[client_key] = TokenBucket(
                    capacity=self.capacity,
                    refill_rate=self.refill_rate,
                )
            bucket = self.buckets[client_key]
            allowed = bucket.consume()
            remaining = int(bucket.tokens)
            retry_after = bucket.retry_after

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
                headers={
                    "Retry-After": str(int(retry_after) + 1),
                    "X-RateLimit-Limit": str(self.capacity),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.capacity)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

app = FastAPI()
app.add_middleware(RateLimitMiddleware, capacity=60, refill_rate=1.0)

@app.get("/")
async def root():
    return {"msg": "Hello"}
```

**How the Token Bucket algorithm works:**

1. A bucket starts full with `capacity` tokens.
2. Every second, `refill_rate` tokens are added (up to `capacity`).
3. Each request removes one token.
4. If the bucket is empty, the request gets `429 Too Many Requests`.
5. This allows **bursts** up to `capacity` followed by a steady rate of `refill_rate` requests/second.

**Why Token Bucket over Fixed Window:**

- Fixed window allows 2x burst at window boundaries (e.g., 60 requests at 0:59 and 60 more at 1:01).
- Token bucket smooths traffic naturally and handles bursts gracefully.
- Token bucket is the algorithm used by AWS API Gateway, Stripe, and most production APIs.

**Why interviewer asks this:**
Implementing a rate limiter from scratch tests algorithm knowledge, concurrency awareness (the `asyncio.Lock`), HTTP standards (`429` status, `Retry-After` header, `X-RateLimit-*` headers), and middleware patterns.

**Follow-up:** How would you make this distributed across multiple server instances?

---

### Q20 (Conceptual): Compare rate limiting algorithms --- Fixed Window, Sliding Window, Token Bucket, and Leaky Bucket.

**Answer:**

| Algorithm | How It Works | Burst Behavior | Memory | Use Case |
|-----------|-------------|----------------|--------|----------|
| **Fixed Window** | Count requests in fixed time slots (e.g., per minute) | Allows 2x burst at window boundary | O(1) per client | Simple APIs, low traffic |
| **Sliding Window Log** | Keep timestamp of every request; count those within the window | Precise, no boundary burst | O(n) per client (stores each timestamp) | When accuracy matters and traffic is low |
| **Sliding Window Counter** | Weighted average of current and previous window counts | Near-precise, low memory | O(1) per client | Good balance of accuracy and efficiency |
| **Token Bucket** | Tokens refill at steady rate; each request takes a token | Allows controlled bursts up to bucket capacity | O(1) per client | Most common in production (AWS, Stripe) |
| **Leaky Bucket** | Requests enter a queue (bucket); processed at fixed rate | No bursts --- strictly smoothed output | O(queue size) | Traffic shaping, network buffering |

**Visual comparison for "10 requests/minute" limit:**

```
Fixed Window:
|--- minute 1 ---|--- minute 2 ---|
[10 requests OK]  [10 requests OK]
        ^ 20 requests in 2 seconds at boundary!

Token Bucket (capacity=10, refill=10/min):
Allows instant burst of 10, then 1 every 6 seconds.
Refills gradually --- smoother than fixed window.

Leaky Bucket (rate=10/min):
Processes exactly 1 request every 6 seconds.
Excess requests are queued or dropped.
```

**Why interviewer asks this:**
Algorithm selection impacts user experience and system behavior. Token bucket is the most common but not always the best. The interviewer wants to see you can reason about trade-offs for a specific system.

**Follow-up:** If your API is behind an API Gateway that already does rate limiting, would you still implement application-level rate limiting? Why?

---

### Q21 (Case Study): Design a rate limiting strategy for a public API with free and paid tiers.

**Answer:**

```python
import time
from fastapi import Depends, FastAPI, HTTPException, Request
from starlette.responses import JSONResponse

app = FastAPI()

# Tier configuration
TIER_CONFIG = {
    "anonymous": {"rpm": 10, "daily": 100, "burst": 5},
    "free": {"rpm": 30, "daily": 1000, "burst": 15},
    "pro": {"rpm": 200, "daily": 50000, "burst": 50},
    "enterprise": {"rpm": 2000, "daily": 500000, "burst": 200},
}

class MultiLayerRateLimiter:
    """
    Production rate limiting strategy:
    1. Per-minute limit (Token Bucket for burst tolerance)
    2. Daily quota (Fixed counter)
    3. Per-endpoint limits (some endpoints cost more)
    """

    def __init__(self):
        # In production, use Redis with Lua scripts for atomicity:
        # KEYS: rate:{client}:minute, rate:{client}:daily
        self.minute_counts: dict[str, list] = {}  # client -> [timestamps]
        self.daily_counts: dict[str, int] = {}

    async def check_rate_limit(
        self,
        client_id: str,
        tier: str,
        cost: int = 1,  # Some endpoints cost more "tokens"
    ) -> dict:
        config = TIER_CONFIG.get(tier, TIER_CONFIG["anonymous"])
        now = time.time()

        # --- Per-minute check (sliding window log) ---
        key = client_id
        if key not in self.minute_counts:
            self.minute_counts[key] = []

        # Remove timestamps older than 60 seconds
        self.minute_counts[key] = [
            ts for ts in self.minute_counts[key] if now - ts < 60
        ]

        if len(self.minute_counts[key]) + cost > config["rpm"]:
            oldest = self.minute_counts[key][0] if self.minute_counts[key] else now
            retry_after = int(60 - (now - oldest)) + 1
            return {
                "allowed": False,
                "reason": "Per-minute rate limit exceeded",
                "retry_after": retry_after,
                "limit": config["rpm"],
                "remaining": max(0, config["rpm"] - len(self.minute_counts[key])),
            }

        # --- Daily quota check ---
        daily_key = f"{client_id}:{int(now // 86400)}"
        current_daily = self.daily_counts.get(daily_key, 0)
        if current_daily + cost > config["daily"]:
            return {
                "allowed": False,
                "reason": "Daily quota exceeded",
                "retry_after": int(86400 - (now % 86400)),
                "limit": config["daily"],
                "remaining": 0,
            }

        # Record the request
        for _ in range(cost):
            self.minute_counts[key].append(now)
        self.daily_counts[daily_key] = current_daily + cost

        return {
            "allowed": True,
            "rpm_remaining": config["rpm"] - len(self.minute_counts[key]),
            "daily_remaining": config["daily"] - self.daily_counts[daily_key],
        }

rate_limiter = MultiLayerRateLimiter()

async def rate_limit_dependency(request: Request):
    api_key = request.headers.get("X-API-Key", "")
    # In production: look up tier from API key in cache/DB
    client_id = api_key or (request.client.host if request.client else "unknown")
    tier = "anonymous" if not api_key else "free"

    # Some endpoints cost more
    cost_map = {"/search": 5, "/export": 10}
    cost = cost_map.get(request.url.path, 1)

    result = await rate_limiter.check_rate_limit(client_id, tier, cost)

    if not result["allowed"]:
        raise HTTPException(
            status_code=429,
            detail=result["reason"],
            headers={
                "Retry-After": str(result["retry_after"]),
                "X-RateLimit-Limit": str(result["limit"]),
                "X-RateLimit-Remaining": str(result["remaining"]),
            },
        )
    return result

@app.get("/items", dependencies=[Depends(rate_limit_dependency)])
async def list_items():
    return {"items": []}

@app.get("/search", dependencies=[Depends(rate_limit_dependency)])
async def search_items(q: str):
    return {"results": [], "query": q}
```

**Key design decisions:**

1. **Multi-layer limits** --- per-minute for abuse prevention, daily for cost control.
2. **Variable cost endpoints** --- a search or export costs more than a simple read.
3. **Tier-based configuration** --- clean separation of business logic from rate limiting logic.
4. **Standard headers** --- `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` for client-friendly behavior.
5. **Redis in production** --- use Lua scripts for atomic check-and-increment to avoid race conditions.

**Why interviewer asks this:**
This is a system design question disguised as a coding question. The interviewer wants to see multi-dimensional rate limiting, cost-weighted endpoints, tier management, and awareness of distributed concerns.

**Follow-up:** How would you communicate rate limit status to API consumers in a way that helps them implement proper backoff?

---

## Section 5: Custom Middleware

### Q22: Write a request logging middleware that captures timing, request details, and response status.

**Answer:**

```python
import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Context variable for request-scoped correlation ID
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

logger = logging.getLogger("api.access")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Production-grade request logging middleware.

    Logs:
    - Correlation ID for distributed tracing
    - HTTP method, path, query parameters
    - Response status code and duration
    - Client IP (respects X-Forwarded-For)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_var.set(request_id)

        # Client IP
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )

        start_time = time.perf_counter()

        # Log request
        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params),
                "client_ip": client_ip,
                "user_agent": request.headers.get("User-Agent", ""),
            },
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                "Request failed with unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(exc),
                },
            )
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add headers to response
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            log_level,
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "client_ip": client_ip,
            },
        )

        return response

app = FastAPI()
app.add_middleware(RequestLoggingMiddleware)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Production improvements:**

- Use structured logging (JSON) for log aggregation tools (ELK, Datadog).
- Use `ContextVar` so the `request_id` is accessible in any handler or service function without passing it explicitly.
- Use `time.perf_counter()` (not `time.time()`) for precise duration measurement.
- Avoid logging request/response bodies by default (PII, large payloads), but allow it for specific debug routes.

**Why interviewer asks this:**
Logging middleware is foundational for production observability. The interviewer checks whether you handle correlation IDs, timing, error cases, client IP extraction, and structured logging.

**Follow-up:** How does `BaseHTTPMiddleware` differ from a pure ASGI middleware, and when would you choose one over the other?

---

### Q23: Implement a middleware that adds security headers to all responses.

**Answer:**

```python
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds OWASP-recommended security headers to all responses.
    """

    SECURITY_HEADERS = {
        # Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        # Prevent clickjacking
        "X-Frame-Options": "DENY",
        # Enable XSS filter in older browsers
        "X-XSS-Protection": "1; mode=block",
        # Only send referrer for same-origin requests
        "Referrer-Policy": "strict-origin-when-cross-origin",
        # Restrict browser features
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        # Content Security Policy
        "Content-Security-Policy": "default-src 'self'; script-src 'self'",
        # Force HTTPS for 1 year (only enable if you are fully on HTTPS)
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        # Prevent caching of sensitive data
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        for header, value in self.SECURITY_HEADERS.items():
            # Do not overwrite headers already set by the application
            if header not in response.headers:
                response.headers[header] = value

        # Remove server identification headers
        response.headers.pop("server", None)
        response.headers.pop("X-Powered-By", None)

        return response


app = FastAPI()
app.add_middleware(SecurityHeadersMiddleware)

@app.get("/")
async def root():
    return {"msg": "Secure response"}
```

**Important notes:**

- **CSP (`Content-Security-Policy`)** must be customized for your app. The restrictive default above will break Swagger UI. For the docs endpoint, you may need to relax CSP or skip it.
- **HSTS** should only be enabled when you are fully committed to HTTPS; otherwise, it can lock out HTTP users.
- **Cache-Control: no-store** is appropriate for API responses, but static asset endpoints may need different caching headers.

**Why interviewer asks this:**
Security headers are a low-effort, high-impact defense layer. The interviewer checks whether you know the standard headers, understand their purpose, and know the gotchas (CSP breaking Swagger, HSTS lock-in).

**Follow-up:** How would you conditionally skip certain headers for the `/docs` and `/openapi.json` endpoints?

---

### Q24 (Coding): Write a pure ASGI middleware (not using `BaseHTTPMiddleware`) that modifies the request body.

**Answer:**

```python
from fastapi import FastAPI, Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send
import json

class RequestBodyTransformMiddleware:
    """
    Pure ASGI middleware that reads and modifies the request body.

    Why not BaseHTTPMiddleware?
    - BaseHTTPMiddleware reads the entire body into memory and wraps
      the response in a StreamingResponse, which can break streaming
      endpoints and adds overhead.
    - Pure ASGI middleware gives full control over the byte stream.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Only transform JSON POST/PUT/PATCH requests
        method = scope.get("method", "GET")
        if method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        # Read the full request body
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            body += message.get("body", b"")
            more_body = message.get("more_body", False)

        # Transform the body: add a server timestamp to all JSON payloads
        try:
            data = json.loads(body)
            if isinstance(data, dict):
                from datetime import datetime, timezone
                data["_server_received_at"] = datetime.now(timezone.utc).isoformat()
            body = json.dumps(data).encode("utf-8")
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # Not JSON, pass through unmodified

        # Create a new receive callable that returns our modified body
        body_sent = False
        async def modified_receive() -> Message:
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            # After body is consumed, return empty to signal completion
            return {"type": "http.request", "body": b"", "more_body": False}

        # Update content-length header if body size changed
        headers = dict(scope.get("headers", []))
        if b"content-length" in headers:
            new_headers = [
                (k, v) if k != b"content-length" else (k, str(len(body)).encode())
                for k, v in scope["headers"]
            ]
            scope = dict(scope)
            scope["headers"] = new_headers

        await self.app(scope, modified_receive, send)


app = FastAPI()
app.add_middleware(RequestBodyTransformMiddleware)

@app.post("/items")
async def create_item(request: Request):
    body = await request.json()
    return {"received": body}

# POST {"name": "widget"} ->
# {"received": {"name": "widget", "_server_received_at": "2026-03-26T..."}}
```

**When to use pure ASGI middleware over `BaseHTTPMiddleware`:**

1. When you need to **modify the request body** before it reaches the handler.
2. When working with **streaming responses** --- `BaseHTTPMiddleware` buffers the entire response.
3. When you need **maximum performance** --- pure ASGI avoids extra wrapping layers.
4. When handling **WebSocket** connections --- `BaseHTTPMiddleware` only works with HTTP.

**Why interviewer asks this:**
This is an advanced question. Most developers only know `BaseHTTPMiddleware`. Writing pure ASGI middleware demonstrates deep understanding of the ASGI protocol: `scope`, `receive`, `send`, and how to intercept the byte stream.

**Follow-up:** What is the "request body consuming" problem with `BaseHTTPMiddleware`, and how does the ASGI approach solve it?

---

### Q25 (Output-Based): What is the execution order of middleware in this app?

```python
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

class MiddlewareA(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print("A: before")
        response = await call_next(request)
        print("A: after")
        return response

class MiddlewareB(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print("B: before")
        response = await call_next(request)
        print("B: after")
        return response

class MiddlewareC(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print("C: before")
        response = await call_next(request)
        print("C: after")
        return response

app.add_middleware(MiddlewareA)
app.add_middleware(MiddlewareB)
app.add_middleware(MiddlewareC)

@app.get("/")
async def root():
    print("Handler")
    return {"msg": "ok"}
```

**Answer / Output:**

```
C: before
B: before
A: before
Handler
A: after
B: after
C: after
```

**Explanation:**

In Starlette/FastAPI, `add_middleware` **wraps the application**. Each call wraps the existing app with a new layer. So:

- After `add_middleware(MiddlewareA)`: app = `A(original_app)`
- After `add_middleware(MiddlewareB)`: app = `B(A(original_app))`
- After `add_middleware(MiddlewareC)`: app = `C(B(A(original_app)))`

The **last added middleware is the outermost layer** and runs first. The order is LIFO (Last In, First Out), like an onion:

```
Request  ->  C.before -> B.before -> A.before -> Handler
Response <-  C.after  <- B.after  <- A.after  <- Handler
```

This is counter-intuitive because the **last `add_middleware` call runs first**. If you want MiddlewareA to run first, add it last.

**Why interviewer asks this:**
Middleware ordering bugs are very common. If logging middleware must run before auth middleware (to log unauthenticated requests), the order of `add_middleware` calls matters. This question exposes whether the candidate has been bitten by this in production.

**Follow-up:** How would the output change if MiddlewareB raised an exception instead of calling `call_next()`?

---

## Section 6: Error Handling

### Q26: Implement a comprehensive error handling system with custom exception classes, handlers, and consistent error response format.

**Answer:**

```python
import logging
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# --- Consistent error response schema ---
class ErrorDetail(BaseModel):
    code: str
    message: str
    field: str | None = None

class ErrorResponse(BaseModel):
    error: str
    status_code: int
    details: list[ErrorDetail] = []
    request_id: str | None = None

# --- Custom exception hierarchy ---
class AppException(Exception):
    """Base exception for all application-specific errors."""

    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        details: list[ErrorDetail] | None = None,
    ):
        self.status_code = status_code
        self.error = error
        self.message = message
        self.details = details or []

class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: Any):
        super().__init__(
            status_code=404,
            error="NOT_FOUND",
            message=f"{resource} with id '{resource_id}' not found",
        )

class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(
            status_code=409,
            error="CONFLICT",
            message=message,
        )

class BusinessRuleException(AppException):
    def __init__(self, message: str, details: list[ErrorDetail] | None = None):
        super().__init__(
            status_code=422,
            error="BUSINESS_RULE_VIOLATION",
            message=message,
            details=details or [],
        )

# --- Exception handlers ---
def create_error_response(
    request: Request, status_code: int, error: str, message: str,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    body = ErrorResponse(
        error=error,
        status_code=status_code,
        details=details or [],
        request_id=request_id,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning(
        f"AppException: {exc.error} - {exc.message}",
        extra={"status_code": exc.status_code},
    )
    return create_error_response(
        request, exc.status_code, exc.error, exc.message, exc.details
    )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return create_error_response(
        request, exc.status_code, "HTTP_ERROR", str(exc.detail)
    )

async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Transform Pydantic validation errors into our consistent format."""
    details = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        details.append(
            ErrorDetail(
                code=error["type"],
                message=error["msg"],
                field=field_path,
            )
        )
    return create_error_response(
        request, 422, "VALIDATION_ERROR", "Request validation failed", details
    )

async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected errors. Never expose internals to client."""
    logger.error(
        f"Unhandled exception: {exc}",
        extra={"traceback": traceback.format_exc()},
    )
    return create_error_response(
        request, 500, "INTERNAL_ERROR", "An unexpected error occurred"
    )

# --- App setup ---
app = FastAPI()

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# --- Usage ---
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    # Simulated DB lookup
    if user_id != 1:
        raise NotFoundException("User", user_id)
    return {"id": 1, "name": "Alice"}

@app.post("/orders")
async def create_order(quantity: int):
    if quantity > 100:
        raise BusinessRuleException(
            message="Order exceeds maximum quantity",
            details=[
                ErrorDetail(
                    code="MAX_QUANTITY_EXCEEDED",
                    message="Maximum order quantity is 100",
                    field="quantity",
                )
            ],
        )
    return {"order_id": 1, "quantity": quantity}
```

**Consistent error response format:**

```json
{
    "error": "NOT_FOUND",
    "status_code": 404,
    "details": [],
    "request_id": "abc-123"
}
```

```json
{
    "error": "VALIDATION_ERROR",
    "status_code": 422,
    "details": [
        {
            "code": "int_parsing",
            "message": "Input should be a valid integer",
            "field": "body -> quantity"
        }
    ],
    "request_id": "def-456"
}
```

**Why interviewer asks this:**
Inconsistent error formats are a sign of an immature API. The interviewer wants to see: a custom exception hierarchy, consistent response schema across all error types (validation, business logic, not found, unexpected), proper logging (with tracebacks for 500s but not for expected errors), and never exposing internal details to clients.

**Follow-up:** How would you ensure third-party library exceptions (e.g., from SQLAlchemy or httpx) are also caught and formatted consistently?

---

### Q27 (Debugging): This error handler does not catch validation errors. Why?

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

@app.exception_handler(Exception)
async def global_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Something went wrong"},
    )

class Item(BaseModel):
    name: str
    price: float

@app.post("/items")
async def create_item(item: Item):
    return item
```

**Sending `{"name": "widget", "price": "not-a-number"}` still returns FastAPI's default 422 response, not the custom handler.**

**Answer:**

FastAPI's `RequestValidationError` is **not a subclass of `Exception`** in terms of how Starlette's exception handling works. Starlette has a specific handler resolution order:

1. **`HTTPException` handlers** are checked first (and `RequestValidationError` is handled by a built-in handler registered by FastAPI).
2. **`Exception` handlers** are a fallback for truly unhandled exceptions.

FastAPI internally registers its own handler for `RequestValidationError` before your `Exception` handler. Your global handler only catches exceptions that are **not** already handled by a more specific handler.

**Fix --- register a handler specifically for `RequestValidationError`:**

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "VALIDATION_ERROR",
            "details": exc.errors(),
        },
    )

@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Something went wrong"},
    )
```

**Why interviewer asks this:**
This is a very common source of confusion. Developers expect `Exception` to catch everything, but FastAPI/Starlette's exception handler resolution is more nuanced. The interviewer is testing understanding of the exception handling hierarchy.

**Follow-up:** What is the difference between `RequestValidationError` and `pydantic.ValidationError` in FastAPI?

---

### Q28 (Coding): Implement a retry-aware error handler that returns different responses based on whether the error is retryable.

**Answer:**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

class RetryableError(Exception):
    """Errors where the client should retry after a delay."""

    def __init__(self, message: str, retry_after_seconds: int = 5):
        self.message = message
        self.retry_after_seconds = retry_after_seconds

class PermanentError(Exception):
    """Errors where retrying will not help."""

    def __init__(self, message: str, error_code: str = "PERMANENT_ERROR"):
        self.message = message
        self.error_code = error_code

@app.exception_handler(RetryableError)
async def retryable_error_handler(request: Request, exc: RetryableError):
    return JSONResponse(
        status_code=503,
        content={
            "error": "SERVICE_TEMPORARILY_UNAVAILABLE",
            "message": exc.message,
            "retryable": True,
            "retry_after_seconds": exc.retry_after_seconds,
        },
        headers={"Retry-After": str(exc.retry_after_seconds)},
    )

@app.exception_handler(PermanentError)
async def permanent_error_handler(request: Request, exc: PermanentError):
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "retryable": False,
        },
    )

# --- Usage examples ---
@app.get("/external-data")
async def fetch_external_data():
    """Simulates calling an external service that is temporarily down."""
    import random
    if random.random() < 0.3:
        raise RetryableError(
            message="Upstream payment service is temporarily unavailable",
            retry_after_seconds=10,
        )
    return {"data": "from external service"}

@app.post("/validate")
async def validate_something(data: dict):
    if "required_field" not in data:
        raise PermanentError(
            message="'required_field' is mandatory and cannot be empty",
            error_code="MISSING_REQUIRED_FIELD",
        )
    return {"valid": True}
```

**Why the `retryable` flag matters for API clients:**

Well-designed API clients use the `retryable` field and `Retry-After` header to implement exponential backoff. Without this signal, clients either retry everything (wasting resources on permanent errors) or retry nothing (losing data when transient errors occur).

**Standard HTTP status codes for retryable vs. permanent errors:**

| Status | Retryable? | Use case |
|--------|-----------|----------|
| 400 | No | Invalid request data |
| 404 | No | Resource does not exist |
| 409 | Maybe | Conflict; retry may work after state changes |
| 429 | Yes | Rate limited; retry after `Retry-After` |
| 500 | Maybe | Server bug; unlikely to resolve on retry |
| 502/503 | Yes | Upstream/service unavailable; retry after delay |
| 504 | Yes | Timeout; retry may succeed |

**Why interviewer asks this:**
This tests API design maturity. Production-grade APIs must communicate error recoverability to clients. The interviewer wants to see proper use of status codes, `Retry-After` headers, and structured error responses.

**Follow-up:** How would you implement circuit breaking in addition to retry guidance?

---

### Q29 (Output-Based): What does this code return for the request `GET /items/abc`?

```python
from fastapi import FastAPI, HTTPException, Request, Path
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

app = FastAPI()

@app.exception_handler(HTTPException)
async def custom_http_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"custom": True, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def custom_validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,  # Changed from default 422
        content={"custom": True, "validation_errors": len(exc.errors())},
    )

@app.get("/items/{item_id}")
async def get_item(item_id: int = Path(..., gt=0)):
    if item_id == 999:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item_id": item_id}
```

**Answer:**

For `GET /items/abc`, the response is:

```json
// Status: 400
{
    "custom": true,
    "validation_errors": 1
}
```

**Explanation:**

1. The path parameter `item_id` is declared as `int`. The value `"abc"` cannot be parsed as an integer.
2. FastAPI raises a `RequestValidationError` *before* the handler function is called.
3. Our custom `custom_validation_handler` catches it and returns status `400` with our custom format.
4. Note: the default FastAPI behavior would return `422`. Our handler deliberately changes it to `400`, which is a valid design choice (some API standards prefer 400 for all client errors).

**For `GET /items/999`:**

```json
// Status: 404
{
    "custom": true,
    "detail": "Item not found"
}
```

**For `GET /items/-5`:**

```json
// Status: 400
{
    "custom": true,
    "validation_errors": 1
}
```

This one also triggers `RequestValidationError` because of the `gt=0` constraint on the `Path` parameter.

**Why interviewer asks this:**
Tests understanding of when `RequestValidationError` vs. `HTTPException` is raised, what happens before the handler runs (path parameter parsing), and how custom exception handlers override default behavior.

**Follow-up:** What would happen if you removed the `RequestValidationError` handler but kept the `HTTPException` handler?

---

## Section 7: API Versioning

### Q30: Compare API versioning strategies and implement URL-based and header-based versioning in FastAPI.

**Answer:**

**Strategy 1: URL Path Versioning (Most Common)**

```python
from fastapi import APIRouter, FastAPI

app = FastAPI()

# --- V1 ---
v1_router = APIRouter(prefix="/api/v1", tags=["v1"])

@v1_router.get("/users/{user_id}")
async def get_user_v1(user_id: int):
    return {"version": 1, "user_id": user_id, "name": "Alice"}

# --- V2 (breaking change: added "email" field, renamed "name" to "full_name") ---
v2_router = APIRouter(prefix="/api/v2", tags=["v2"])

@v2_router.get("/users/{user_id}")
async def get_user_v2(user_id: int):
    return {
        "version": 2,
        "user_id": user_id,
        "full_name": "Alice Wonderland",
        "email": "alice@example.com",
    }

app.include_router(v1_router)
app.include_router(v2_router)
```

**Strategy 2: Header-Based Versioning**

```python
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.routing import APIRoute

app = FastAPI()

async def get_api_version(
    accept: str = Header(default="application/vnd.myapi.v2+json"),
) -> int:
    """Parse version from Accept header: application/vnd.myapi.v{N}+json"""
    import re
    match = re.search(r"vnd\.myapi\.v(\d+)\+json", accept)
    if match:
        return int(match.group(1))
    return 2  # Default to latest

@app.get("/api/users/{user_id}")
async def get_user(user_id: int, api_version: int = Header(alias="X-API-Version", default=2)):
    if api_version == 1:
        return {"version": 1, "user_id": user_id, "name": "Alice"}
    elif api_version == 2:
        return {
            "version": 2,
            "user_id": user_id,
            "full_name": "Alice Wonderland",
            "email": "alice@example.com",
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported API version: {api_version}")
```

**Strategy 3: Router-Based Versioning with Shared Logic**

```python
from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel

app = FastAPI()

# Shared business logic
class UserService:
    async def get_user(self, user_id: int) -> dict:
        # In production: query DB
        return {
            "id": user_id,
            "full_name": "Alice Wonderland",
            "email": "alice@example.com",
            "phone": "+1234567890",
        }

def get_user_service() -> UserService:
    return UserService()

# V1 response model (subset of fields)
class UserResponseV1(BaseModel):
    id: int
    name: str  # V1 used "name" not "full_name"

# V2 response model (full fields)
class UserResponseV2(BaseModel):
    id: int
    full_name: str
    email: str

v1 = APIRouter(prefix="/api/v1", tags=["v1"])
v2 = APIRouter(prefix="/api/v2", tags=["v2"])

@v1.get("/users/{user_id}", response_model=UserResponseV1)
async def get_user_v1(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    data = await service.get_user(user_id)
    # Transform to V1 format
    return UserResponseV1(id=data["id"], name=data["full_name"].split()[0])

@v2.get("/users/{user_id}", response_model=UserResponseV2)
async def get_user_v2(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    data = await service.get_user(user_id)
    return UserResponseV2(**data)

app.include_router(v1)
app.include_router(v2)
```

**Comparison of strategies:**

| Strategy | Pros | Cons |
|----------|------|------|
| **URL versioning** (`/api/v1/`) | Simple, explicit, cache-friendly, easy to route in API gateways | URL changes; can lead to code duplication |
| **Header versioning** (`X-API-Version: 2`) | Clean URLs, easy to default to latest | Not visible in browser; harder to test; harder to cache |
| **Accept header** (`application/vnd.myapi.v2+json`) | RESTful purist approach | Complex to implement; poor tooling support |
| **Query param** (`?version=2`) | Easy to use | Pollutes query space; caching issues |

**Why interviewer asks this:**
API versioning is a critical architectural decision that is hard to change later. The interviewer wants to see you weigh trade-offs: URL versioning is the pragmatic industry standard (GitHub, Stripe, Twilio all use it), but the candidate should know alternatives and their downsides.

**Follow-up:** How would you deprecate V1 and communicate the deprecation timeline to API consumers?

---

### Q31 (Coding): Implement API version deprecation with sunset headers and automatic warnings.

**Answer:**

```python
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

# Version registry
VERSION_CONFIG = {
    "v1": {
        "status": "deprecated",
        "sunset_date": date(2026, 6, 1),
        "successor": "v2",
        "deprecation_message": "API v1 is deprecated. Please migrate to v2 by June 1, 2026.",
    },
    "v2": {
        "status": "active",
        "sunset_date": None,
        "successor": None,
        "deprecation_message": None,
    },
    "v3": {
        "status": "beta",
        "sunset_date": None,
        "successor": None,
        "deprecation_message": "API v3 is in beta. Breaking changes may occur.",
    },
}

class VersionDeprecationMiddleware(BaseHTTPMiddleware):
    """
    Adds RFC 8594 Sunset header and Deprecation header for old API versions.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Extract version from URL path
        path = request.url.path
        version = None
        for v in VERSION_CONFIG:
            if f"/api/{v}/" in path or path.endswith(f"/api/{v}"):
                version = v
                break

        if version and version in VERSION_CONFIG:
            config = VERSION_CONFIG[version]

            if config["status"] == "deprecated":
                response.headers["Deprecation"] = "true"
                response.headers["Link"] = (
                    f'</api/{config["successor"]}>; rel="successor-version"'
                )
                if config["sunset_date"]:
                    # RFC 8594 Sunset header
                    sunset_str = config["sunset_date"].strftime("%a, %d %b %Y 00:00:00 GMT")
                    response.headers["Sunset"] = sunset_str
                response.headers["X-Deprecation-Notice"] = config["deprecation_message"]

            elif config["status"] == "beta":
                response.headers["X-API-Status"] = "beta"
                response.headers["X-API-Warning"] = config["deprecation_message"]

        return response


class VersionGateMiddleware(BaseHTTPMiddleware):
    """Block requests to sunset (fully retired) versions."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        for v, config in VERSION_CONFIG.items():
            if (f"/api/{v}/" in path or path.endswith(f"/api/{v}")):
                if config["status"] == "deprecated" and config["sunset_date"]:
                    if date.today() > config["sunset_date"]:
                        return JSONResponse(
                            status_code=410,
                            content={
                                "error": "API_VERSION_RETIRED",
                                "message": f"API {v} has been retired as of {config['sunset_date']}.",
                                "migrate_to": f"/api/{config['successor']}/",
                            },
                        )
        return await call_next(request)


app.add_middleware(VersionDeprecationMiddleware)
app.add_middleware(VersionGateMiddleware)

# --- Routers ---
v1 = APIRouter(prefix="/api/v1", tags=["v1 (deprecated)"])
v2 = APIRouter(prefix="/api/v2", tags=["v2"])

@v1.get("/users")
async def list_users_v1():
    return [{"name": "Alice"}]

@v2.get("/users")
async def list_users_v2():
    return [{"full_name": "Alice Wonderland", "email": "alice@example.com"}]

app.include_router(v1)
app.include_router(v2)
```

**Response headers for a V1 request:**

```
HTTP/1.1 200 OK
Deprecation: true
Sunset: Mon, 01 Jun 2026 00:00:00 GMT
Link: </api/v2>; rel="successor-version"
X-Deprecation-Notice: API v1 is deprecated. Please migrate to v2 by June 1, 2026.
```

**After the sunset date, V1 returns:**

```json
// Status: 410 Gone
{
    "error": "API_VERSION_RETIRED",
    "message": "API v1 has been retired as of 2026-06-01.",
    "migrate_to": "/api/v2/"
}
```

**Why interviewer asks this:**
Deprecation is part of the API lifecycle. The interviewer wants to see RFC-compliant headers (`Sunset`, `Deprecation`, `Link`), a clear migration path, and a hard cutoff mechanism. Many teams skip this and end up supporting old versions indefinitely.

**Follow-up:** How would you track which clients are still using deprecated versions so you can notify them before sunset?

---

### Q32 (Case Study): You are building a large FastAPI application with 5 teams contributing to the same codebase. Design the project structure and versioning approach.

**Answer:**

```
project/
+-- app/
|   +-- __init__.py
|   +-- main.py              # App factory, middleware, exception handlers
|   +-- core/
|   |   +-- config.py        # Settings (pydantic-settings)
|   |   +-- security.py      # JWT, OAuth2 dependencies
|   |   +-- database.py      # Engine, session factory
|   +-- api/
|   |   +-- __init__.py
|   |   +-- v1/
|   |   |   +-- __init__.py  # v1_router aggregation
|   |   |   +-- users.py     # Team A owns this
|   |   |   +-- orders.py    # Team B owns this
|   |   |   +-- payments.py  # Team C owns this
|   |   +-- v2/
|   |   |   +-- __init__.py
|   |   |   +-- users.py     # Updated by Team A
|   |   |   +-- orders.py    # Shares logic with v1 via services
|   +-- services/             # Business logic (version-agnostic)
|   |   +-- user_service.py
|   |   +-- order_service.py
|   |   +-- payment_service.py
|   +-- models/               # SQLAlchemy models (shared across versions)
|   |   +-- user.py
|   |   +-- order.py
|   +-- schemas/              # Pydantic models per version
|   |   +-- v1/
|   |   |   +-- user.py
|   |   |   +-- order.py
|   |   +-- v2/
|   |       +-- user.py
|   |       +-- order.py
+-- tests/
|   +-- v1/
|   +-- v2/
+-- alembic/                  # DB migrations
```

**`main.py` --- App factory pattern:**

```python
from fastapi import FastAPI
from app.api.v1 import v1_router
from app.api.v2 import v2_router
from app.core.config import settings

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    )

    # Middleware (order matters: last added runs first)
    from app.middleware.logging import RequestLoggingMiddleware
    from app.middleware.security import SecurityHeadersMiddleware
    from app.middleware.versioning import VersionDeprecationMiddleware

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(VersionDeprecationMiddleware)

    # Exception handlers
    from app.core.exceptions import register_exception_handlers
    register_exception_handlers(app)

    # Routers
    app.include_router(v1_router, prefix="/api/v1")
    app.include_router(v2_router, prefix="/api/v2")

    return app

app = create_app()
```

**`api/v1/__init__.py` --- Version router aggregation:**

```python
from fastapi import APIRouter
from app.api.v1.users import router as users_router
from app.api.v1.orders import router as orders_router
from app.api.v1.payments import router as payments_router

v1_router = APIRouter(tags=["v1"])
v1_router.include_router(users_router, prefix="/users", tags=["users"])
v1_router.include_router(orders_router, prefix="/orders", tags=["orders"])
v1_router.include_router(payments_router, prefix="/payments", tags=["payments"])
```

**`api/v2/users.py` --- V2 endpoint using shared service:**

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from app.schemas.v2.user import UserResponseV2
from app.services.user_service import UserService, get_user_service

router = APIRouter()

@router.get("/{user_id}", response_model=UserResponseV2)
async def get_user(
    user_id: int,
    service: Annotated[UserService, Depends(get_user_service)],
):
    user = await service.get_by_id(user_id)
    return user  # Pydantic V2 schema filters/transforms the response
```

**Key principles for multi-team versioning:**

1. **Services are version-agnostic.** Business logic lives in `services/` and is shared across all API versions. Only the API layer and Pydantic schemas are versioned.

2. **Database models are never versioned.** Alembic migrations always move forward. V1 and V2 read from the same tables but present different views via schemas.

3. **Each team owns specific routers.** Code ownership is enforced via CODEOWNERS:
   ```
   # .github/CODEOWNERS
   app/api/*/users.py    @team-a
   app/api/*/orders.py   @team-b
   app/api/*/payments.py @team-c
   app/services/         @platform-team
   ```

4. **Version-specific schemas handle transformation.** V1 might return `{"name": "Alice"}` while V2 returns `{"full_name": "Alice Wonderland"}` --- both from the same service call. The Pydantic `response_model` handles the difference.

5. **Tests mirror the version structure.** Each version has its own test directory. V1 tests are not removed until V1 is sunset.

**Why interviewer asks this:**
This is a system design question for senior/staff engineers. It tests ability to structure a large codebase for multiple teams, minimize code duplication across versions, and enforce ownership boundaries. The separation of services (shared) from API layer (versioned) is the critical insight.

**Follow-up:** How would you handle a database schema change that breaks V1's assumptions while V1 is still active?

---

## Quick Reference: Key Imports Cheat Sheet

```python
# Authentication
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, APIKeyHeader, SecurityScopes
from fastapi import Security, Depends
from jose import jwt, JWTError
from passlib.context import CryptContext

# Background Tasks
from fastapi import BackgroundTasks
from celery import Celery

# WebSockets
from fastapi import WebSocket, WebSocketDisconnect, WebSocketException

# Rate Limiting
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

# Error Handling
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Versioning
from fastapi import APIRouter
```

---

## Summary Table

| Topic | Key Takeaway |
|-------|-------------|
| **JWT Auth** | Short-lived access tokens + refresh token rotation; never store secrets in code |
| **OAuth2 Scopes** | Use `Security()` + `SecurityScopes` for fine-grained authorization |
| **API Keys** | Hash keys, prefix them, support multiple active keys per client |
| **BackgroundTasks** | In-process, no persistence; use for lightweight fire-and-forget |
| **Celery** | Distributed, persistent, retryable; use for heavy processing |
| **WebSockets** | Room-based management, stale connection cleanup, auth via query/cookie |
| **Rate Limiting** | Token bucket for production; multi-layer (per-minute + daily) for tiered APIs |
| **Middleware** | LIFO ordering; use pure ASGI for body modification or streaming |
| **Error Handling** | Consistent schema; separate handlers for validation, HTTP, and unhandled errors |
| **API Versioning** | URL versioning with shared services; version schemas, not business logic |

---

> **Next:** [Part 6/7 --- Testing, Deployment & Performance Optimization](./06-fastapi-testing-deployment.md)
> **Previous:** [Part 4/7 --- FastAPI Intermediate Concepts](./04-fastapi-intermediate.md)
