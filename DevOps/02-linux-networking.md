# Linux & Networking for DevOps — Interview Preparation

> Section 2 of 7 — Core system knowledge every DevOps engineer must have.

---

## Table of Contents

1. [Essential Linux Commands](#q1-what-are-the-essential-linux-commands-every-devops-engineer-must-know)
2. [File Permissions](#q2-explain-linux-file-permissions-in-depth)
3. [Process Management](#q3-how-do-you-manage-processes-in-linux)
4. [systemd & Services](#q4-what-is-systemd-and-how-do-you-manage-services)
5. [Shell Scripting for DevOps](#q5-write-a-shell-script-that-monitors-disk-usage-and-alerts-when-above-80)
6. [TCP/IP & OSI Model](#q6-explain-the-tcpip-model-and-how-a-web-request-flows-through-it)
7. [DNS Resolution](#q7-explain-how-dns-resolution-works-step-by-step)
8. [HTTP vs HTTPS & TLS](#q8-explain-how-https-and-tls-work)
9. [Networking Debugging](#q9-your-application-cannot-reach-an-external-api-how-do-you-debug-this)
10. [SSH & Port Management](#q10-explain-ssh-key-based-authentication-and-ssh-tunneling)

---

## Q1. What are the essential Linux commands every DevOps engineer must know?

**Answer:**

### File and Directory Operations

```bash
# Navigate
pwd                         # Print current directory
ls -la                      # List all files with permissions and sizes
cd /var/log                 # Change directory
tree -L 2                   # Directory tree, 2 levels deep

# Create / Remove
mkdir -p /app/config/env    # Create nested directories
touch config.yml            # Create empty file
rm -rf /tmp/old-builds      # Recursive force delete (DANGEROUS — double check path)
cp -r source/ dest/         # Copy directory recursively
mv old.conf new.conf        # Move/rename

# Find files
find / -name "*.log" -mtime +7 -size +100M    # Logs older than 7 days, >100MB
find /app -type f -name "*.tmp" -delete        # Find and delete temp files
locate nginx.conf                              # Fast search (uses updatedb index)
which kubectl                                  # Find binary location
```

### Text Processing (Critical for Log Analysis)

```bash
# View files
cat /etc/hosts              # Print entire file
less /var/log/syslog        # Paginated view (q to quit)
head -50 app.log            # First 50 lines
tail -f app.log             # Follow log in real-time (live tail)
tail -100 app.log | less    # Last 100 lines, paginated

# Search and filter
grep -r "ERROR" /var/log/           # Recursive search
grep -i "timeout" app.log           # Case-insensitive
grep -c "500" access.log            # Count matches
grep -v "healthcheck" access.log    # Exclude lines (inverse match)
grep -A 3 -B 1 "Exception" app.log # 3 lines after, 1 before match

# Text manipulation
awk '{print $1, $9}' access.log          # Print columns 1 and 9
awk '$9 >= 500 {print}' access.log       # Lines where column 9 >= 500 (HTTP 5xx)
sed 's/old-domain/new-domain/g' config   # Replace text
cut -d':' -f1 /etc/passwd               # Cut fields by delimiter
sort | uniq -c | sort -rn                # Count unique values, sort by frequency
```

### Disk and System Information

```bash
# Disk usage
df -h                       # Filesystem usage (human-readable)
du -sh /var/log/*           # Size of each item in directory
du -sh /var/log/ --max-depth=1

# System info
uname -a                    # Kernel version
cat /etc/os-release         # OS details
uptime                      # System uptime and load average
free -h                     # Memory usage
nproc                       # Number of CPU cores
lscpu                       # Detailed CPU info
```

### Real-world DevOps one-liners

```bash
# Find the 10 largest files on the system
du -ah / 2>/dev/null | sort -rh | head -10

# Count HTTP status codes in nginx access log
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Find processes using the most memory
ps aux --sort=-%mem | head -10

# Watch a command output every 2 seconds
watch -n 2 'docker ps'

# Check which process is using port 8080
lsof -i :8080
# or
ss -tlnp | grep 8080
```

**Why interviewer asks this:** Linux is the operating system of the cloud. If you can't navigate a Linux terminal confidently, you can't debug production systems.

**Follow-up:** *What's the difference between `>`, `>>`, `2>`, and `2>&1`?*

```bash
command > file      # Redirect stdout to file (overwrite)
command >> file     # Redirect stdout to file (append)
command 2> file     # Redirect stderr to file
command 2>&1        # Redirect stderr to stdout
command > file 2>&1 # Redirect BOTH stdout and stderr to file
command &> file     # Shorthand for the above (bash only)

# Example: Save both output and errors to a log
./deploy.sh > deploy.log 2>&1
```

---

## Q2. Explain Linux file permissions in depth.

**Answer:**

### Permission Model

Every file/directory has three permission groups and three permission types:

```
  Owner  Group  Others
   rwx    rwx    rwx

   r = read    (4)
   w = write   (2)
   x = execute (1)
```

### Reading `ls -la` Output

```bash
$ ls -la
-rw-r--r--  1 deploy  apps   4096 Jan 15 10:30 config.yml
drwxr-xr-x  3 deploy  apps   4096 Jan 15 10:30 scripts/
-rwxr-x---  1 deploy  apps   8192 Jan 15 10:30 deploy.sh
lrwxrwxrwx  1 root    root     24 Jan 15 10:30 current -> /app/releases/v1.2.3
```

```
-rw-r--r--
│├──┤├──┤├──┤
│  │   │   └── Others: read only (r--)
│  │   └────── Group:  read only (r--)
│  └────────── Owner:  read+write (rw-)
└───────────── Type: - = file, d = directory, l = symlink
```

### Numeric (Octal) Permissions

```
rwx = 4+2+1 = 7
rw- = 4+2+0 = 6
r-x = 4+0+1 = 5
r-- = 4+0+0 = 4
--- = 0+0+0 = 0
```

```bash
# Common permission patterns
chmod 755 deploy.sh     # Owner: rwx, Group: r-x, Others: r-x
chmod 644 config.yml    # Owner: rw-, Group: r--, Others: r--
chmod 600 id_rsa        # Owner: rw-, Group: ---, Others: --- (SSH keys!)
chmod 700 .ssh/         # Owner: rwx, Group: ---, Others: ---

# Symbolic mode
chmod u+x script.sh     # Add execute for owner
chmod g-w config.yml    # Remove write for group
chmod o-rwx secret.key  # Remove all permissions for others
chmod a+r readme.txt    # Add read for all
```

### Ownership

```bash
# Change owner
chown deploy:apps config.yml      # Set owner and group
chown -R deploy:apps /app/        # Recursive

# Change group only
chgrp apps config.yml
```

### Special Permissions

```bash
# SUID (Set User ID) — execute as file owner, not as runner
chmod u+s /usr/bin/passwd    # This is why normal users can change passwords
# Shows as: -rwsr-xr-x

# SGID (Set Group ID) — new files inherit directory's group
chmod g+s /shared/project/   # All files created here get 'project' group
# Shows as: drwxr-sr-x

# Sticky Bit — only file owner can delete files (used on /tmp)
chmod +t /tmp/
# Shows as: drwxrwxrwt
```

### DevOps Relevance

```bash
# Docker volume permissions issue (extremely common):
# Container runs as UID 1000, but mounted volume is owned by root
docker run -v /host/data:/app/data myapp
# Fix: match UIDs or use --user flag
docker run --user 1000:1000 -v /host/data:/app/data myapp

# SSH key permissions (connection refused if wrong):
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa         # Private key — must be 600
chmod 644 ~/.ssh/id_rsa.pub     # Public key
chmod 644 ~/.ssh/authorized_keys
```

**Why interviewer asks this:** Permission issues are the cause of countless production bugs. "Permission denied" errors are daily DevOps work.

**Follow-up:** *A junior developer sets a deploy script to `chmod 777`. Why is this a security risk?*

`777` means everyone can read, write, and execute. Any user on the system (including a compromised web server process) can:
1. **Read** the script (may contain secrets or logic they shouldn't see)
2. **Modify** the script (inject malicious commands that run during next deployment)
3. **Execute** the script (run deployments they shouldn't)

Correct permission: `750` (owner: full, group: read+execute, others: nothing), with the deploy user as owner and a deploy group.

---

## Q3. How do you manage processes in Linux?

**Answer:**

### Viewing Processes

```bash
# Snapshot of all processes
ps aux
# USER  PID  %CPU  %MEM  VSZ  RSS  TTY  STAT  START  TIME  COMMAND

# Real-time process monitor
top                  # Classic
htop                 # Better UI (if installed)

# Process tree (shows parent-child relationships)
pstree -p

# Find specific process
ps aux | grep nginx
pgrep -la nginx      # Cleaner: just the PIDs and names
```

### Signals

```bash
# Graceful stop (SIGTERM — 15)
kill 1234            # Sends SIGTERM — process can clean up
kill -15 1234        # Same as above, explicit

# Force kill (SIGKILL — 9)
kill -9 1234         # Immediate termination — no cleanup
# Use only as last resort! Can cause data corruption.

# Reload configuration (SIGHUP — 1)
kill -HUP $(pgrep nginx)   # Nginx reloads config without downtime

# Kill by name
pkill -f "node server.js"
killall python3

# Kill all processes on a port
fuser -k 8080/tcp
```

### Signal Hierarchy

```
SIGTERM (15) — "Please stop" — process can catch, clean up, exit
SIGINT  (2)  — Ctrl+C — like SIGTERM but from keyboard
SIGHUP  (1)  — "Hangup" — traditionally reload config
SIGKILL (9)  — "Die immediately" — cannot be caught or ignored
SIGSTOP (19) — "Freeze" — cannot be caught (like Ctrl+Z but forced)
```

### Background Processes

```bash
# Run in background
./long-task.sh &            # & puts it in background
nohup ./long-task.sh &      # Survives terminal close

# Job control
jobs                        # List background jobs
fg %1                       # Bring job 1 to foreground
bg %1                       # Resume stopped job in background
Ctrl+Z                      # Suspend current foreground process

# Modern: use screen or tmux for persistent sessions
tmux new -s deploy          # New named session
# ... run deployment ...
Ctrl+B, D                   # Detach (process keeps running)
tmux attach -t deploy       # Reattach later
```

### Resource Monitoring

```bash
# CPU and memory per process
top -p 1234                 # Monitor specific PID
pidstat -p 1234 1           # CPU stats every 1 second

# Open files by process
lsof -p 1234                # All open files for PID
lsof -i :8080               # What's using port 8080

# /proc filesystem (kernel's process info)
cat /proc/1234/status       # Process details
cat /proc/1234/limits       # Resource limits
ls -la /proc/1234/fd/       # Open file descriptors
```

### Debugging Scenario: Container process keeps getting OOM killed

```bash
# Check if OOM killer was triggered
dmesg | grep -i "oom\|killed"
# Output: "Out of memory: Killed process 1234 (java) total-vm:4096000kB"

# Check memory limits
cat /sys/fs/cgroup/memory/memory.limit_in_bytes

# Check actual usage
cat /proc/1234/status | grep -i "vmrss\|vmsize"

# Solution: either increase container memory limit or fix the memory leak
docker run -m 2g myapp      # Set 2GB limit
```

**Why interviewer asks this:** Process management is essential for debugging production incidents — hanging processes, resource leaks, zombie processes.

**Follow-up:** *What's a zombie process, and how do you deal with it?*

A zombie is a process that has **finished executing** but whose parent hasn't called `wait()` to collect its exit status. It shows as `Z` in `ps` output.

```bash
ps aux | grep Z              # Find zombies
# Can't kill a zombie (it's already dead)
# Solution: kill the PARENT process — that releases the zombie
kill $(ps -o ppid= -p <zombie_pid>)
```

In containers, this is why you need an **init process** — PID 1 must reap zombies. Use `--init` flag or Tini:
```bash
docker run --init myapp
```

---

## Q4. What is systemd and how do you manage services?

**Answer:**

systemd is the **init system and service manager** for most modern Linux distributions. It's PID 1 — the first process that starts and manages all others.

### Service Management

```bash
# Start/stop/restart
systemctl start nginx
systemctl stop nginx
systemctl restart nginx        # Stop then start
systemctl reload nginx         # Reload config without downtime

# Enable/disable auto-start on boot
systemctl enable nginx         # Start on boot
systemctl disable nginx        # Don't start on boot
systemctl enable --now nginx   # Enable AND start immediately

# Status
systemctl status nginx
# Shows: loaded, active, PID, memory usage, recent logs

# List all services
systemctl list-units --type=service
systemctl list-units --type=service --state=running
```

### Creating a Custom Service (Real-world Example)

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Node.js Application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/node /opt/myapp/server.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StartLimitBurst=3
StartLimitIntervalSec=60

# Environment
EnvironmentFile=/opt/myapp/.env

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/myapp/data

# Resource limits
MemoryMax=512M
CPUQuota=80%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp

[Install]
WantedBy=multi-user.target
```

```bash
# After creating/modifying service file:
systemctl daemon-reload        # Reload systemd config
systemctl enable --now myapp   # Enable and start
```

### Journal Logs (systemd logging)

```bash
# View service logs
journalctl -u nginx              # All logs for nginx
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx -f           # Follow (like tail -f)
journalctl -u nginx -n 100       # Last 100 lines
journalctl -u nginx --no-pager   # Don't paginate

# System-wide logs
journalctl -b                    # Since last boot
journalctl --disk-usage          # How much space logs use
journalctl --vacuum-size=500M    # Trim logs to 500MB
```

**Why interviewer asks this:** systemd manages every service on a Linux server. You'll create custom service files for applications that aren't containerized.

**Follow-up:** *What does `Restart=on-failure` vs `Restart=always` mean?*

- `on-failure`: Restart only if the process exits with a non-zero code (crash). If it exits cleanly (code 0), don't restart. Good for workers that should stop when done.
- `always`: Restart regardless of exit code. Good for long-running services (web servers) that should never stop.

---

## Q5. Write a shell script that monitors disk usage and alerts when above 80%.

**Answer:**

```bash
#!/bin/bash
# disk-monitor.sh — Monitor disk usage and alert via webhook

set -euo pipefail

THRESHOLD=80
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
HOSTNAME=$(hostname)
ALERT_FILE="/tmp/disk-alert-sent"

check_disk_usage() {
    # df output: Filesystem Size Used Avail Use% Mounted
    # -P ensures POSIX output (single-line per filesystem)
    df -hP | awk 'NR>1 {print $5, $6}' | while read usage mount; do
        # Strip the % sign
        percent=${usage%\%}

        if [ "$percent" -ge "$THRESHOLD" ]; then
            local alert_key="${ALERT_FILE}-${mount//\//_}"

            # Don't spam — only alert once per mount until resolved
            if [ ! -f "$alert_key" ]; then
                echo "[ALERT] ${HOSTNAME}: ${mount} is at ${usage} usage"
                send_alert "$mount" "$usage"
                touch "$alert_key"
            fi
        else
            # Clear alert flag if usage dropped below threshold
            local alert_key="${ALERT_FILE}-${mount//\//_}"
            rm -f "$alert_key" 2>/dev/null
        fi
    done
}

send_alert() {
    local mount="$1"
    local usage="$2"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"🚨 Disk Alert on ${HOSTNAME}\",
                \"blocks\": [{
                    \"type\": \"section\",
                    \"text\": {
                        \"type\": \"mrkdwn\",
                        \"text\": \"*Disk usage critical*\nHost: \`${HOSTNAME}\`\nMount: \`${mount}\`\nUsage: *${usage}*\nThreshold: ${THRESHOLD}%\"
                    }
                }]
            }"
    fi

    # Also log to syslog
    logger -t disk-monitor "ALERT: ${mount} at ${usage} on ${HOSTNAME}"
}

check_disk_usage
```

### Making it run automatically with cron

```bash
# Edit crontab
crontab -e

# Run every 5 minutes
*/5 * * * * /opt/scripts/disk-monitor.sh >> /var/log/disk-monitor.log 2>&1

# Cron format:
# ┌──── minute (0-59)
# │ ┌──── hour (0-23)
# │ │ ┌──── day of month (1-31)
# │ │ │ ┌──── month (1-12)
# │ │ │ │ ┌──── day of week (0-7, 0 and 7 = Sunday)
# │ │ │ │ │
# * * * * *  command
```

### Key shell scripting concepts shown

```bash
set -euo pipefail
# -e: Exit on any error
# -u: Treat unset variables as errors
# -o pipefail: Pipe fails if ANY command fails (not just the last)

# Variable substitution
${usage%\%}           # Remove trailing % from "85%"
${mount//\//_}        # Replace all / with _ in mount path

# Default value
${SLACK_WEBHOOK_URL:-}  # Empty string if not set (no error with -u)
```

**Why interviewer asks this:** Shell scripting is daily work for DevOps. This tests practical scripting ability, not just theoretical knowledge.

**Follow-up:** *How would you improve this for production use?*

1. Replace with **Prometheus node_exporter** — it already monitors disk usage with proper metric history
2. Use **Alertmanager** for deduplication, routing, silencing, and escalation
3. If keeping the script, add **exponential backoff** for alerts and write to a **metrics endpoint** instead of Slack
4. Use **systemd timer** instead of cron (better logging, dependency management)

---

## Q6. Explain the TCP/IP model and how a web request flows through it.

**Answer:**

### The Four Layers

```
┌─────────────────────────────────────────────┐
│ Layer 4: Application                         │
│ HTTP, HTTPS, DNS, FTP, SMTP, SSH             │
│ "What the user sees"                         │
├─────────────────────────────────────────────┤
│ Layer 3: Transport                           │
│ TCP, UDP                                     │
│ "Reliable delivery (TCP) or fast delivery    │
│  (UDP)"                                      │
├─────────────────────────────────────────────┤
│ Layer 2: Internet                            │
│ IP, ICMP, ARP                                │
│ "Addressing and routing between networks"    │
├─────────────────────────────────────────────┤
│ Layer 1: Network Access                      │
│ Ethernet, Wi-Fi, ARP                         │
│ "Physical transmission of bits"              │
└─────────────────────────────────────────────┘
```

### A Web Request: Step by Step

When you type `https://api.example.com/users` and press Enter:

```
1. DNS Resolution (Application Layer)
   Browser → "What's the IP of api.example.com?"
   DNS resolver → "It's 93.184.216.34"

2. TCP Connection (Transport Layer)
   Client → SYN → Server
   Client ← SYN-ACK ← Server
   Client → ACK → Server
   (Three-way handshake complete — connection established)

3. TLS Handshake (between Application and Transport)
   Client → ClientHello (supported ciphers)
   Server → ServerHello + Certificate
   Client → Verify certificate, generate session key
   Both → Encrypted channel established

4. HTTP Request (Application Layer)
   GET /users HTTP/1.1
   Host: api.example.com
   Authorization: Bearer eyJ...

5. IP Routing (Internet Layer)
   Packet: src=192.168.1.100 → dst=93.184.216.34
   Routed through gateway → ISP → internet → destination

6. Physical Transmission (Network Access Layer)
   Bits → Ethernet frames → through switches/routers → fiber/copper

7. Response flows back through all layers in reverse
```

### TCP vs UDP

| Feature | TCP | UDP |
|---|---|---|
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | Guaranteed delivery, ordering | Best effort, no guarantees |
| Speed | Slower (overhead for reliability) | Faster (no overhead) |
| Use cases | HTTP, SSH, FTP, database | DNS, video streaming, gaming, VoIP |
| Header size | 20-60 bytes | 8 bytes |

### DevOps-Critical Networking Commands

```bash
# Test connectivity
ping 93.184.216.34              # ICMP echo (is the host alive?)
traceroute api.example.com      # Show the route packets take
mtr api.example.com             # Combined ping + traceroute (real-time)

# Test specific port/service
telnet api.example.com 443      # Can I reach port 443?
nc -zv api.example.com 443      # Same but better (netcat)
curl -v https://api.example.com # Full HTTP request with headers

# DNS lookup
dig api.example.com             # DNS query
nslookup api.example.com        # Simpler DNS query
dig +short api.example.com A    # Just the IP

# Network interfaces and routing
ip addr show                    # Network interfaces
ip route show                   # Routing table
ss -tlnp                        # Listening ports (replaces netstat)
```

**Why interviewer asks this:** Networking issues are the most common production problems. Understanding TCP/IP is fundamental to debugging.

**Follow-up:** *What happens when a TCP connection times out? How do retries work?*

TCP uses **exponential backoff** for retransmissions. First retry after ~1 second, then 2s, 4s, 8s, etc. After a configurable number of retries (`net.ipv4.tcp_retries2`, default 15, totaling ~15 minutes), the connection is considered dead and the kernel reports a timeout error to the application. This is why "connection timeout" errors can take several minutes to surface.

---

## Q7. Explain how DNS resolution works step by step.

**Answer:**

```
User types: www.example.com

Step 1: Browser Cache
  └── Checked first. If found, done.

Step 2: OS Cache (/etc/hosts, OS resolver cache)
  └── If found in /etc/hosts or OS cache, done.

Step 3: Recursive Resolver (ISP or 8.8.8.8, 1.1.1.1)
  └── Checks its cache. If found, returns.
  └── If not cached, starts recursive lookup:

Step 4: Root Nameserver (13 clusters worldwide)
  └── "I don't know www.example.com, but .com is handled by these servers"
  └── Returns: TLD nameserver addresses for .com

Step 5: TLD Nameserver (.com)
  └── "I don't know www.example.com, but example.com's authoritative server is ns1.example.com"
  └── Returns: authoritative nameserver address

Step 6: Authoritative Nameserver (ns1.example.com)
  └── "www.example.com = 93.184.216.34"
  └── Returns: A record with IP address + TTL

Step 7: Response flows back
  └── Recursive resolver caches result (for TTL duration)
  └── OS caches it
  └── Browser caches it
  └── User's request uses IP 93.184.216.34
```

### DNS Record Types

| Type | Purpose | Example |
|---|---|---|
| **A** | Domain → IPv4 | `example.com → 93.184.216.34` |
| **AAAA** | Domain → IPv6 | `example.com → 2606:2800:220:1:248:1893:25c8:1946` |
| **CNAME** | Domain → another domain (alias) | `www.example.com → example.com` |
| **MX** | Mail server | `example.com → mail.example.com (priority 10)` |
| **TXT** | Arbitrary text (SPF, DKIM, verification) | `example.com → "v=spf1 include:_spf.google.com"` |
| **NS** | Authoritative nameserver | `example.com → ns1.example.com` |
| **SRV** | Service discovery | `_http._tcp.example.com → web1.example.com:8080` |

### DNS Debugging

```bash
# Full DNS resolution trace
dig +trace www.example.com

# Query specific DNS server
dig @8.8.8.8 example.com

# Check all record types
dig example.com ANY

# Reverse lookup (IP → domain)
dig -x 93.184.216.34

# Check TTL (time-to-live)
dig +noall +answer example.com
# example.com.  300  IN  A  93.184.216.34
#                ↑
#              TTL = 300 seconds (5 minutes)

# Check propagation (query multiple DNS servers)
for dns in 8.8.8.8 1.1.1.1 208.67.222.222; do
  echo "=== $dns ==="
  dig @$dns example.com +short
done
```

### Common DevOps DNS Issues

```bash
# Problem: "DNS resolution failed" in a Docker container
# Cause: Container can't reach host DNS
# Fix: Check Docker DNS settings
docker run --dns 8.8.8.8 myapp
# Or in daemon.json:
# { "dns": ["8.8.8.8", "1.1.1.1"] }

# Problem: DNS change not taking effect
# Cause: TTL hasn't expired (old record cached)
# Debug: Check the TTL
dig +noall +answer example.com
# Fix: Wait for TTL, or lower TTL before making changes
# Best practice: Set TTL to 300 (5min) before a migration, then back to 3600 after

# Problem: Service discovery in Kubernetes
# Kubernetes has internal DNS: <service>.<namespace>.svc.cluster.local
kubectl exec -it debug-pod -- nslookup my-service.default.svc.cluster.local
```

**Why interviewer asks this:** DNS is involved in almost every networking issue. "It's always DNS" is a meme for a reason.

**Follow-up:** *You changed a DNS A record 2 hours ago, but some users still see the old IP. Why?*

TTL (Time to Live). The old record had a TTL of 3600 (1 hour), and some ISP resolvers respect the TTL while others are more aggressive about caching. Some corporate DNS resolvers override TTLs with longer values. Best practice: **lower TTL to 60 seconds 24-48 hours before** a planned DNS change, make the change, verify, then raise TTL back.

---

## Q8. Explain how HTTPS and TLS work.

**Answer:**

### TLS Handshake (TLS 1.3 — current standard)

```
Client                                 Server
  │                                      │
  │──── ClientHello ─────────────────►   │
  │     (supported cipher suites,        │
  │      key share, random bytes)        │
  │                                      │
  │   ◄──── ServerHello ────────────── │
  │         (chosen cipher suite,        │
  │          key share, random bytes)    │
  │                                      │
  │   ◄──── Certificate ───────────── │
  │         (server's public cert)       │
  │                                      │
  │   ◄──── CertificateVerify ──────── │
  │         (signed with private key)    │
  │                                      │
  │  [Client verifies certificate        │
  │   against trusted CA list]           │
  │                                      │
  │  [Both derive session keys from      │
  │   shared secret via key exchange]    │
  │                                      │
  │──── Finished (encrypted) ────────►   │
  │   ◄──── Finished (encrypted) ──────  │
  │                                      │
  │  ═══════ Encrypted data ═══════════  │
```

### Certificate Chain of Trust

```
Root CA (pre-installed in browsers/OS)
  └── Intermediate CA (signed by root)
        └── Server Certificate (signed by intermediate)
              └── Your domain: api.example.com
```

```bash
# View certificate chain
openssl s_client -connect api.example.com:443 -showcerts

# Check certificate expiry
openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates
# notBefore=Jan  1 00:00:00 2024 GMT
# notAfter=Apr  1 00:00:00 2025 GMT

# Check from CLI (curl)
curl -vI https://api.example.com 2>&1 | grep -i "expire\|issuer\|subject"
```

### SSL/TLS Certificate Management for DevOps

```bash
# Generate self-signed cert (development only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=localhost"

# Let's Encrypt (production — free, automated)
# Using certbot:
certbot certonly --nginx -d example.com -d www.example.com

# Auto-renewal (certbot installs a timer)
certbot renew --dry-run

# In Kubernetes — use cert-manager
# Automatically provisions and renews TLS certificates
```

### Nginx TLS Configuration (Production)

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/private/privkey.pem;

    # Modern TLS settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS (force HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # OCSP stapling (faster cert validation)
    ssl_stapling on;
    ssl_stapling_verify on;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

**Why interviewer asks this:** TLS misconfiguration is a top security vulnerability. DevOps engineers manage certificates and TLS termination.

**Follow-up:** *Your TLS certificate expires in production at 2 AM. What's your process to prevent this?*

**Prevention:**
1. **Automated renewal** — Let's Encrypt + certbot timer, or cert-manager in K8s
2. **Monitoring** — Prometheus `ssl_certificate_expiry_seconds` metric with alert at 30 days, 7 days, and 1 day before expiry
3. **External checks** — services like UptimeRobot or Blackbox Exporter that probe the endpoint and alert on cert issues

---

## Q9. Your application cannot reach an external API. How do you debug this?

**Answer:**

### Systematic debugging — layer by layer

```
Step 1: Is DNS working?
─────────────────────
$ dig api.external.com +short
93.184.216.34                          ← Success
(empty)                                ← DNS failure

If DNS fails:
$ cat /etc/resolv.conf                 # Check DNS server config
$ dig @8.8.8.8 api.external.com       # Try a known-good DNS
$ nslookup api.external.com            # Alternative check


Step 2: Is the host reachable (network level)?
──────────────────────────────────────────────
$ ping -c 3 93.184.216.34
3 packets received                     ← Network path exists
0 packets received                     ← Network unreachable or ICMP blocked

$ traceroute api.external.com          # Where does the path break?
$ mtr --report api.external.com        # Better — statistical view


Step 3: Is the specific port open?
──────────────────────────────────
$ nc -zv api.external.com 443
Connection to api.external.com 443 port [tcp/https] succeeded!  ← Port open
Connection timed out                   ← Firewall blocking

$ curl -v --connect-timeout 5 https://api.external.com/health
# Shows TCP connection, TLS handshake, HTTP response


Step 4: Is it a firewall issue?
──────────────────────────────
$ iptables -L -n                       # Local firewall rules
$ ss -tlnp                             # What's listening locally?

# If in a cloud environment:
# Check: Security Groups, NACLs, Route Tables
# Common issue: outbound rule missing for port 443


Step 5: Is it a TLS issue?
──────────────────────────
$ openssl s_client -connect api.external.com:443
# Verify return code: 0 (ok)          ← Certificate valid
# Verify return code: 20              ← Unable to get local issuer cert

# Common in containers — missing CA certificates
$ apt-get install ca-certificates && update-ca-certificates


Step 6: Is the application-level request correct?
─────────────────────────────────────────────────
$ curl -v -H "Authorization: Bearer $TOKEN" https://api.external.com/users
# Check: status code, response headers, error body
# 401 → auth issue, 403 → IP allow list, 429 → rate limited
# 503 → external API is down
```

### Container-Specific Debugging

```bash
# Inside a Docker container:
docker exec -it mycontainer sh

# DNS inside container
cat /etc/resolv.conf
# nameserver 127.0.0.11  ← Docker's embedded DNS

# If DNS fails inside container:
docker run --dns 8.8.8.8 myapp

# If network unreachable:
docker network inspect bridge
# Check if container is on the right network

# Tools may not be installed in minimal images:
# Install temporarily:
apt-get update && apt-get install -y curl dnsutils iputils-ping netcat-traditional
```

**Why interviewer asks this:** This is the most common real-world debugging scenario. The systematic approach matters more than knowing any single tool.

**Follow-up:** *The `curl` works from the host but not from inside the Docker container. What's likely wrong?*

Common causes:
1. **DNS resolution** — container using different DNS server. Check `/etc/resolv.conf` inside container.
2. **Network mode** — container on a bridge network that can't reach external networks. Check Docker network settings.
3. **Missing CA certificates** — minimal images (Alpine, distroless) may not have CA bundles. Install `ca-certificates`.
4. **Proxy configuration** — host has `HTTP_PROXY` set but container doesn't inherit it. Pass via `docker run -e HTTP_PROXY=...`.

---

## Q10. Explain SSH key-based authentication and SSH tunneling.

**Answer:**

### SSH Key Authentication

```
How it works:

1. Generate key pair (once, on your machine):
   $ ssh-keygen -t ed25519 -C "deploy@company.com"
   Creates:
     ~/.ssh/id_ed25519      ← Private key (NEVER share)
     ~/.ssh/id_ed25519.pub  ← Public key (share freely)

2. Copy public key to server:
   $ ssh-copy-id user@server
   # This adds your public key to server's ~/.ssh/authorized_keys

3. Connect:
   $ ssh user@server
   # Client proves identity using private key
   # No password needed
```

### Authentication Flow

```
Client                              Server
  │                                    │
  │── "I want to connect as user" ──► │
  │                                    │
  │  ◄── "Prove you are user" ─────── │
  │      (sends random challenge)      │
  │                                    │
  │── Signs challenge with ──────────► │
  │   private key                      │
  │                                    │
  │                          Verifies signature
  │                          using stored public key
  │                                    │
  │  ◄── "Access granted" ──────────── │
```

### SSH Config File (Productivity Multiplier)

```bash
# ~/.ssh/config

# Jump through bastion host to reach private servers
Host bastion
    HostName 54.23.100.50
    User ec2-user
    IdentityFile ~/.ssh/deploy-key.pem

Host production-web
    HostName 10.0.1.100          # Private IP
    User deploy
    ProxyJump bastion            # Go through bastion first
    IdentityFile ~/.ssh/deploy-key.pem

Host staging-*
    HostName %h.staging.internal
    User deploy
    ProxyJump bastion
    ForwardAgent yes

# Now you can just type:
# ssh production-web
# ssh staging-api
```

### SSH Tunneling (Port Forwarding)

```bash
# Local Port Forwarding — access remote service through local port
# "I want to access the database on the remote server from my laptop"
ssh -L 5432:db.internal:5432 bastion
# Now: localhost:5432 → bastion → db.internal:5432

# Remote Port Forwarding — expose local service to remote server
# "I want the remote server to access my local dev server"
ssh -R 8080:localhost:3000 remote-server
# Now: remote-server:8080 → your laptop:3000

# Dynamic Port Forwarding (SOCKS proxy)
# "I want to route ALL traffic through the remote server"
ssh -D 9090 bastion
# Configure browser SOCKS proxy to localhost:9090
# All traffic goes through bastion
```

### Diagram: Accessing a Database Through a Bastion

```
Your Laptop          Bastion (public)        DB Server (private)
localhost:5432  ──►  54.23.100.50  ──────►  10.0.1.50:5432
     │                    │                       │
     └── SSH tunnel ──────┘                       │
          encrypted                               │
                          └── private network ────┘

Command:
ssh -L 5432:10.0.1.50:5432 ec2-user@54.23.100.50

Then locally:
psql -h localhost -p 5432 -U myuser mydb
```

### SSH Security Best Practices

```bash
# /etc/ssh/sshd_config — on the server

# Disable password authentication (keys only)
PasswordAuthentication no

# Disable root login
PermitRootLogin no

# Use only strong algorithms
KexAlgorithms curve25519-sha256
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com

# Limit login attempts
MaxAuthTries 3

# Idle timeout
ClientAliveInterval 300
ClientAliveCountMax 2

# Restrict to specific users
AllowUsers deploy admin
```

**Why interviewer asks this:** SSH is how you access every server. Tunneling is how you securely access internal resources.

**Follow-up:** *What's the difference between `ssh-agent forwarding` and `ProxyJump`?*

- **Agent forwarding** (`-A`): Your SSH private key is accessible on the remote server (via the agent). Risky — if the bastion is compromised, your key can be used.
- **ProxyJump** (`-J`): The SSH connection is proxied through the bastion, but your private key **never leaves your machine**. More secure. Always prefer `ProxyJump`.

---

*Next: [03 — Docker Fundamentals →](./03-docker-fundamentals.md)*
