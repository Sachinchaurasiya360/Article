# Docker Fundamentals — Interview Preparation

> Section 3 of 7 — Understanding containers, Docker architecture, images, and core commands.

---

## Table of Contents

1. [Containers vs VMs](#q1-what-is-the-difference-between-containers-and-virtual-machines)
2. [Docker Architecture](#q2-explain-docker-architecture-in-detail)
3. [Docker Images & Layers](#q3-what-is-a-docker-image-and-how-do-layers-work)
4. [Dockerfile Deep Dive](#q4-explain-every-common-dockerfile-instruction-with-examples)
5. [Essential Docker Commands](#q5-what-are-the-essential-docker-commands-every-devops-engineer-must-know)
6. [Container Lifecycle](#q6-explain-the-container-lifecycle-and-state-transitions)
7. [Docker Networking Basics](#q7-how-does-docker-networking-work)
8. [Docker Volumes](#q8-how-does-data-persistence-work-in-docker)
9. [Debugging Containers](#q9-debugging-scenario-your-container-starts-and-immediately-exits-how-do-you-debug)
10. [Output-based Questions](#q10-output-based-what-does-this-dockerfile-produce-and-whats-wrong-with-it)

---

## Q1. What is the difference between containers and virtual machines?

**Answer:**

### Architecture Comparison

```
Virtual Machines:                    Containers:

┌──────────┐ ┌──────────┐          ┌──────────┐ ┌──────────┐
│  App A   │ │  App B   │          │  App A   │ │  App B   │
├──────────┤ ├──────────┤          ├──────────┤ ├──────────┤
│ Bins/Libs│ │ Bins/Libs│          │ Bins/Libs│ │ Bins/Libs│
├──────────┤ ├──────────┤          └──────┬───┘ └────┬─────┘
│ Guest OS │ │ Guest OS │                 │          │
│ (Ubuntu) │ │ (CentOS) │          ┌─────┴──────────┴──────┐
├──────────┤ ├──────────┤          │    Container Runtime   │
│   ████████████████████│          │      (Docker)          │
│      Hypervisor       │          ├───────────────────────┤
├───────────────────────┤          │      Host OS           │
│      Host OS          │          │     (Linux)            │
├───────────────────────┤          ├───────────────────────┤
│     Hardware          │          │     Hardware           │
└───────────────────────┘          └───────────────────────┘
```

### Key Differences

| Dimension | Virtual Machine | Container |
|---|---|---|
| **Isolation** | Full OS-level (hardware virtualized) | Process-level (kernel shared) |
| **Startup time** | 30-60 seconds | Milliseconds to seconds |
| **Size** | GBs (includes full OS) | MBs (only app + dependencies) |
| **Performance** | ~5-10% overhead (hypervisor) | Near-native (no hypervisor) |
| **Density** | 10-20 per host | 100s-1000s per host |
| **Kernel** | Each VM has its own kernel | All containers share host kernel |
| **Security** | Strong isolation (hardware boundary) | Weaker isolation (shared kernel) |

### How Containers Achieve Isolation (Linux Primitives)

Containers are NOT a single technology. They're a combination of Linux kernel features:

```
1. Namespaces — "What a container can SEE"
   ├── PID namespace  → Container sees its own process tree (PID 1)
   ├── NET namespace  → Container has its own network stack
   ├── MNT namespace  → Container has its own filesystem
   ├── UTS namespace  → Container has its own hostname
   ├── IPC namespace  → Container has its own inter-process communication
   └── USER namespace → Container has its own user IDs

2. cgroups (Control Groups) — "What a container can USE"
   ├── Memory limit    → Container can use max 512MB
   ├── CPU shares      → Container gets 25% of CPU
   ├── I/O bandwidth   → Container gets limited disk I/O
   └── Process count   → Container can have max 100 processes

3. Union Filesystem (OverlayFS) — "How the filesystem works"
   └── Layered filesystem: read-only image layers + read-write container layer
```

### When to Use Which

| Use Case | Choice | Why |
|---|---|---|
| Microservices | Containers | Lightweight, fast, easy to orchestrate |
| Different OS needed | VMs | Need Windows and Linux on same host |
| Maximum security isolation | VMs | Hardware-level isolation |
| Legacy application | VMs | May need specific OS version |
| Development environments | Containers | Fast to create/destroy |
| Running untrusted code | VMs (or gVisor) | Stronger isolation boundary |

**Why interviewer asks this:** Fundamental question — if you don't understand what a container actually IS at the Linux level, you'll struggle with debugging.

**Follow-up:** *Can you run Linux containers on a Mac or Windows machine? How?*

Not natively. Mac and Windows don't have the Linux kernel features (namespaces, cgroups). Docker Desktop runs a **lightweight Linux VM** (using HyperKit on Mac, WSL2/Hyper-V on Windows) and runs containers inside that VM. So technically, it's VMs running containers — you just don't see the VM.

---

## Q2. Explain Docker architecture in detail.

**Answer:**

Docker uses a **client-server architecture**:

```
┌────────────────────────────────────────────────────────────┐
│                     Docker Client                           │
│  docker build, docker run, docker push                      │
│  (CLI that sends commands via REST API)                     │
└───────────────────────┬────────────────────────────────────┘
                        │ REST API (unix socket or TCP)
                        ▼
┌────────────────────────────────────────────────────────────┐
│                    Docker Daemon (dockerd)                   │
│  Manages: images, containers, networks, volumes             │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  containerd   │  │ Image Manager │  │ Network Driver │  │
│  │  (runtime)    │  │               │  │                │  │
│  │    ┌──────┐   │  │  ┌─────────┐ │  │  bridge, host  │  │
│  │    │ runc │   │  │  │ BuildKit│ │  │  overlay, none │  │
│  │    └──────┘   │  │  └─────────┘ │  │                │  │
│  └──────────────┘  └───────────────┘  └────────────────┘  │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│                    Docker Registry                           │
│  Docker Hub, ECR, GCR, GitHub Container Registry            │
│  (Stores and distributes images)                            │
└────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Role |
|---|---|
| **Docker Client** | CLI tool (`docker` command). Sends API calls to the daemon. |
| **Docker Daemon** (`dockerd`) | Long-running process that manages Docker objects. |
| **containerd** | Industry-standard container runtime. Manages container lifecycle. |
| **runc** | Low-level OCI runtime. Actually creates containers using Linux primitives. |
| **BuildKit** | Modern image builder. Handles Dockerfile builds with caching and parallelism. |
| **Registry** | Stores images. Docker Hub is the default public registry. |

### What happens when you run `docker run nginx`?

```
1. Client sends "run nginx" to daemon via API

2. Daemon checks: is "nginx:latest" image available locally?
   ├── Yes → proceed
   └── No  → pull from registry (Docker Hub by default)

3. Daemon asks containerd to create a container:
   a. Create a read-write layer on top of nginx image layers
   b. Create network interface (bridge by default)
   c. Allocate IP address
   d. Configure namespaces and cgroups

4. containerd asks runc to start the container process:
   a. runc sets up namespaces (PID, NET, MNT, etc.)
   b. runc sets up cgroups (memory/CPU limits)
   c. runc executes the container's entrypoint (nginx -g "daemon off;")
   d. runc exits — containerd monitors the running process

5. Container is running:
   - Has its own PID 1 (nginx master process)
   - Has its own network interface
   - Has its own filesystem (union of image layers + writable layer)
```

### Docker Socket

```bash
# The daemon listens on a Unix socket by default:
ls -la /var/run/docker.sock
# srw-rw---- 1 root docker 0 Jan 15 10:00 /var/run/docker.sock

# This is why Docker commands need root or 'docker' group membership
sudo usermod -aG docker $USER

# WARNING: Access to docker.sock = root access to the host
# Anyone who can talk to this socket can mount the host filesystem
# Never expose docker.sock to untrusted containers
```

**Why interviewer asks this:** Understanding the architecture helps debug issues like "Docker daemon not running", "permission denied", or "image pull failures."

**Follow-up:** *What's the difference between containerd and Docker? Can you use containerd without Docker?*

Yes — containerd is an independent container runtime. Kubernetes switched from Docker to containerd directly (removing the Docker shim) in v1.24. containerd is lower-level: no `docker build`, no `docker-compose`, no CLI. It's the runtime engine. Docker adds developer tooling on top of containerd.

---

## Q3. What is a Docker image, and how do layers work?

**Answer:**

A Docker image is a **read-only template** composed of stacked **filesystem layers**. Each layer represents a single instruction in the Dockerfile.

### Layer Architecture

```
┌─────────────────────────────────┐
│   Container Layer (read-write)   │ ← Created when container starts
├─────────────────────────────────┤
│   Layer 5: COPY . /app          │ ← Your application code
├─────────────────────────────────┤
│   Layer 4: RUN npm install      │ ← Dependencies
├─────────────────────────────────┤
│   Layer 3: WORKDIR /app         │ ← Metadata (no filesystem change)
├─────────────────────────────────┤
│   Layer 2: RUN apt-get install  │ ← System packages
├─────────────────────────────────┤
│   Layer 1: FROM node:20         │ ← Base OS + Node.js runtime
└─────────────────────────────────┘
```

### How layers are cached (critical for build speed)

```dockerfile
# Dockerfile
FROM node:20-alpine          # Layer 1: cached (rarely changes)
WORKDIR /app                 # Layer 2: cached
COPY package*.json ./        # Layer 3: cached UNTIL package.json changes
RUN npm ci                   # Layer 4: cached UNTIL layer 3 changes
COPY . .                     # Layer 5: changes every build (code changed)
CMD ["node", "server.js"]    # Layer 6: cached
```

**Cache invalidation rule:** When a layer changes, ALL subsequent layers are rebuilt.

```
Build 1: All layers built from scratch
Build 2: Only code changed → Layers 1-4 cached, layers 5-6 rebuilt
Build 3: package.json changed → Layers 1-2 cached, layers 3-6 rebuilt
```

This is why you **COPY package.json BEFORE copying source code** — dependency installation is cached separately from code changes.

### Inspecting Layers

```bash
# See image layers and sizes
docker history nginx:latest
# IMAGE        CREATED     CREATED BY                              SIZE
# d453...      2 days ago  CMD ["nginx" "-g" "daemon off;"]        0B
# <missing>    2 days ago  EXPOSE 80                               0B
# <missing>    2 days ago  COPY docker-entrypoint.sh /             4.6kB
# <missing>    2 days ago  RUN /bin/sh -c set -x && addgroup...    69.3MB
# <missing>    2 days ago  ENV NJS_VERSION=0.8.2                   0B
# <missing>    2 weeks ago /bin/sh -c #(nop) ADD file:...          77.8MB

# Inspect image metadata
docker inspect nginx:latest

# Check image size
docker images nginx
# REPOSITORY   TAG     IMAGE ID     CREATED      SIZE
# nginx        latest  d453ee...    2 days ago   187MB
```

### Shared Layers Between Images

```
Image A (node:20-alpine base):    Image B (node:20-alpine base):
┌──────────────┐                  ┌──────────────┐
│ App A code   │                  │ App B code   │
├──────────────┤                  ├──────────────┤
│ npm install  │                  │ npm install  │
├──────────────┤                  ├──────────────┤
│ node:20      │ ◄── SHARED ────► │ node:20      │
│ alpine base  │    (stored once  │ alpine base  │
└──────────────┘     on disk)     └──────────────┘
```

Both images share the base layers. They're only stored once on disk and in the registry.

**Why interviewer asks this:** Layer understanding is essential for optimizing build speed and image size.

**Follow-up:** *What is a "dangling image" and how do you clean them up?*

A dangling image is a layer that's no longer referenced by any tagged image — usually created when you rebuild an image with the same tag. Clean up:

```bash
docker image prune           # Remove dangling images
docker image prune -a        # Remove ALL unused images (not just dangling)
docker system prune -a       # Nuclear option: remove everything unused
```

---

## Q4. Explain every common Dockerfile instruction with examples.

**Answer:**

```dockerfile
# ═══════════════════════════════════════════════════════════
# Complete Dockerfile Reference with DevOps Best Practices
# ═══════════════════════════════════════════════════════════

# FROM — Base image (required, must be first instruction)
FROM node:20-alpine AS builder
# Use specific tags (not 'latest') for reproducibility
# Use Alpine/slim variants for smaller images
# AS names a build stage for multi-stage builds

# LABEL — Metadata (for image management)
LABEL maintainer="devops@company.com"
LABEL version="1.2.0"
LABEL description="Production API server"

# ARG — Build-time variable (not available at runtime)
ARG NODE_ENV=production
ARG APP_VERSION=1.0.0
# Pass via: docker build --build-arg NODE_ENV=development .

# ENV — Environment variable (available at build AND runtime)
ENV NODE_ENV=$NODE_ENV
ENV PORT=3000
# Can be overridden: docker run -e PORT=8080

# WORKDIR — Set working directory (creates if doesn't exist)
WORKDIR /app
# All subsequent commands run in this directory
# Prefer WORKDIR over "RUN mkdir && cd"

# COPY — Copy files from host to image
COPY package.json package-lock.json ./
# COPY respects .dockerignore
# Use specific files, not "COPY . ." early in the Dockerfile

# ADD — Like COPY but with extras (generally prefer COPY)
ADD https://example.com/file.tar.gz /tmp/
# ADD auto-extracts tar archives and can fetch URLs
# COPY is more explicit and preferred for simple file copying

# RUN — Execute command during build (creates a layer)
RUN npm ci --only=production
# Combine related commands to reduce layers:
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
# The cleanup in the same RUN prevents the package lists from
# being stored in a layer (saves ~30MB)

# USER — Switch to non-root user
RUN addgroup --system app && adduser --system --ingroup app app
USER app
# SECURITY: Never run production containers as root

# EXPOSE — Document which ports the app listens on
EXPOSE 3000
# This is documentation only — doesn't actually publish the port
# Use -p 3000:3000 at runtime to actually map ports

# VOLUME — Declare mount point for external data
VOLUME ["/app/data"]
# Data in this path persists beyond container lifecycle

# HEALTHCHECK — Define container health verification
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
# Docker marks container as healthy/unhealthy based on this

# ENTRYPOINT — Main executable (not easily overridden)
ENTRYPOINT ["node"]
# ENTRYPOINT defines WHAT runs

# CMD — Default arguments (easily overridden)
CMD ["server.js"]
# CMD defines the DEFAULT arguments to ENTRYPOINT
# Combined: ENTRYPOINT + CMD = node server.js
# Override: docker run myapp worker.js → node worker.js
```

### ENTRYPOINT vs CMD — The Critical Distinction

```dockerfile
# Pattern 1: CMD only (most common for simple apps)
CMD ["node", "server.js"]
# Override: docker run myapp python script.py (replaces entire command)

# Pattern 2: ENTRYPOINT only (container as executable)
ENTRYPOINT ["curl"]
# Usage: docker run myapp https://example.com
# The URL is appended to curl

# Pattern 3: ENTRYPOINT + CMD (flexible default)
ENTRYPOINT ["node"]
CMD ["server.js"]
# Default: node server.js
# Override: docker run myapp worker.js → node worker.js
# You can only override CMD part easily
```

### Shell Form vs Exec Form

```dockerfile
# Exec form (preferred) — runs directly, PID 1
CMD ["node", "server.js"]
# Process receives signals (SIGTERM) correctly → graceful shutdown

# Shell form — runs via /bin/sh -c
CMD node server.js
# Actually runs: /bin/sh -c "node server.js"
# sh is PID 1, node is a child process
# SIGTERM goes to sh, NOT to node → ungraceful shutdown
```

### Complete Production Dockerfile Example

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

**Why interviewer asks this:** Dockerfile quality directly impacts security, build speed, and image size.

**Follow-up:** *What is `.dockerignore` and why is it important?*

`.dockerignore` excludes files from the Docker build context (like `.gitignore` for Docker):

```
# .dockerignore
node_modules
.git
.env
*.md
dist
.next
coverage
```

Without it, `COPY . .` sends everything to the daemon — including `node_modules` (hundreds of MBs), `.git` (potentially huge), and `.env` (secrets!). This slows builds and can leak sensitive data into images.

---

## Q5. What are the essential Docker commands every DevOps engineer must know?

**Answer:**

### Image Management

```bash
# Build image from Dockerfile
docker build -t myapp:1.0 .
docker build -t myapp:1.0 -f Dockerfile.prod .    # Specify Dockerfile
docker build --no-cache -t myapp:1.0 .             # Ignore cache

# List images
docker images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Pull/push images
docker pull nginx:1.25-alpine
docker tag myapp:1.0 registry.example.com/myapp:1.0
docker push registry.example.com/myapp:1.0

# Remove images
docker rmi myapp:1.0
docker image prune -a          # Remove all unused images
```

### Container Lifecycle

```bash
# Run a container
docker run -d \                       # Detached (background)
  --name web \                        # Container name
  -p 8080:3000 \                      # Map host:container ports
  -e DATABASE_URL=postgres://... \    # Environment variable
  -v /host/data:/app/data \           # Mount volume
  --restart unless-stopped \          # Restart policy
  --memory 512m \                     # Memory limit
  --cpus 0.5 \                        # CPU limit (half a core)
  myapp:1.0

# List containers
docker ps                    # Running only
docker ps -a                 # All (including stopped)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Stop / Start / Restart
docker stop web              # Sends SIGTERM, waits 10s, then SIGKILL
docker stop -t 30 web        # Wait 30 seconds before SIGKILL
docker start web
docker restart web

# Remove containers
docker rm web                # Remove stopped container
docker rm -f web             # Force remove (even if running)
docker container prune       # Remove all stopped containers
```

### Debugging and Inspection

```bash
# View logs
docker logs web              # All logs
docker logs -f web           # Follow (like tail -f)
docker logs --tail 100 web   # Last 100 lines
docker logs --since 30m web  # Last 30 minutes

# Execute command inside running container
docker exec -it web sh             # Interactive shell
docker exec web cat /etc/hosts     # Run single command
docker exec -u root web whoami     # Run as specific user

# Inspect container details
docker inspect web                            # Full JSON details
docker inspect --format '{{.State.Status}}' web   # Specific field
docker inspect --format '{{.NetworkSettings.IPAddress}}' web

# Resource usage
docker stats                       # Real-time CPU/memory for all containers
docker stats web                   # Specific container
docker top web                     # Running processes inside container

# Copy files
docker cp web:/app/logs/error.log ./    # From container to host
docker cp ./config.yml web:/app/        # From host to container

# View filesystem changes
docker diff web
# A = added, C = changed, D = deleted
```

### System Cleanup

```bash
# Nuclear cleanup (removes everything unused)
docker system prune -a --volumes
# Removes: stopped containers, unused networks, dangling images, unused volumes

# Check disk usage
docker system df
# TYPE           TOTAL   ACTIVE   SIZE      RECLAIMABLE
# Images         15      3        5.2GB     4.1GB (78%)
# Containers     5       2        120MB     80MB (66%)
# Volumes        8       3        2.1GB     1.5GB (71%)
```

**Why interviewer asks this:** These commands are daily tools for any DevOps engineer.

**Follow-up:** *What's the difference between `docker stop` and `docker kill`?*

- `docker stop`: Sends **SIGTERM** first (graceful shutdown), waits 10 seconds (configurable with `-t`), then sends **SIGKILL** if still running
- `docker kill`: Sends **SIGKILL** immediately — no grace period, no cleanup

Always prefer `docker stop` for production containers so the application can close database connections, finish processing requests, and flush logs.

---

## Q6. Explain the container lifecycle and state transitions.

**Answer:**

```
                    docker create
                         │
                         ▼
            ┌─────────────────────┐
            │      CREATED        │
            │  (exists but not    │
            │   running)          │
            └──────────┬──────────┘
                       │ docker start
                       ▼
            ┌─────────────────────┐
     ┌─────►│      RUNNING        │◄──────┐
     │      │  (process active)   │       │
     │      └───┬──────────┬──────┘       │
     │          │          │              │
     │  docker  │          │ docker       │ docker restart
     │  unpause │          │ pause        │ docker start
     │          │          ▼              │
     │          │  ┌──────────────┐       │
     │          │  │    PAUSED    │       │
     │          │  │  (frozen)    │       │
     │          │  └──────────────┘       │
     │          │                         │
     │          │ process exits /         │
     │          │ docker stop /           │
     │          │ docker kill             │
     │          ▼                         │
     │  ┌─────────────────────┐           │
     │  │      STOPPED        │───────────┘
     │  │  (exited, data      │
     │  │   preserved)        │
     │  └──────────┬──────────┘
     │             │ docker rm
     │             ▼
     │  ┌─────────────────────┐
     └──│      DELETED        │
        │  (gone forever)     │
        └─────────────────────┘
```

### Restart Policies

```bash
docker run --restart=no myapp           # Default: don't restart
docker run --restart=on-failure myapp   # Restart only on non-zero exit code
docker run --restart=on-failure:5 myapp # Max 5 restart attempts
docker run --restart=always myapp       # Always restart (even on manual stop after daemon restart)
docker run --restart=unless-stopped myapp # Like always, but not after manual stop
```

| Policy | On Crash | On `docker stop` | On Daemon Restart |
|---|---|---|---|
| `no` | Stay stopped | Stay stopped | Stay stopped |
| `on-failure` | Restart | Stay stopped | Stay stopped |
| `always` | Restart | Restart | Restart |
| `unless-stopped` | Restart | Stay stopped | Stay stopped |

**Why interviewer asks this:** Understanding lifecycle helps debug "container keeps restarting" or "container stopped unexpectedly" issues.

**Follow-up:** *Your container is in a restart loop (CrashLoopBackOff in Kubernetes terms). How do you debug it?*

```bash
# 1. Check exit code
docker inspect --format '{{.State.ExitCode}}' mycontainer
# 0 = clean exit, 1 = app error, 137 = OOM killed (128+9), 143 = SIGTERM

# 2. Check logs from the failed container
docker logs mycontainer

# 3. Run the image interactively to investigate
docker run -it --entrypoint sh myapp:1.0
# Now you're inside the container, can check files, run the app manually

# 4. Check if it's OOM
docker inspect --format '{{.State.OOMKilled}}' mycontainer
```

---

## Q7. How does Docker networking work?

**Answer:**

### Network Drivers

```bash
# List networks
docker network ls
# NETWORK ID    NAME      DRIVER    SCOPE
# abc123        bridge    bridge    local    ← Default
# def456        host      host      local
# ghi789        none      null      local
```

### Bridge Network (default)

```
Host Machine
┌────────────────────────────────────────────────┐
│                                                 │
│  docker0 bridge (172.17.0.1)                   │
│  ┌──────────────────────────────┐              │
│  │                              │              │
│  │  ┌──────────┐ ┌──────────┐  │              │
│  │  │ web      │ │ api      │  │              │
│  │  │172.17.0.2│ │172.17.0.3│  │              │
│  │  └──────────┘ └──────────┘  │              │
│  │                              │              │
│  └──────────────────────────────┘              │
│                                                 │
│  Port mapping: -p 8080:3000                    │
│  Host:8080 → web:3000                          │
└────────────────────────────────────────────────┘
```

```bash
# Default bridge: containers communicate by IP only (no DNS)
docker run -d --name web -p 8080:3000 myapp

# User-defined bridge: containers can use names as hostnames (DNS)
docker network create mynet
docker run -d --name web --network mynet myapp
docker run -d --name api --network mynet myapi
# web can reach api at: http://api:3000 (by name!)
```

### Host Network

```bash
docker run --network host nginx
# Container uses host's network directly
# No port mapping needed — nginx listens on host's port 80
# Best performance (no NAT overhead)
# No network isolation
```

### None Network

```bash
docker run --network none myapp
# No network at all — completely isolated
# Use case: batch processing, security-sensitive operations
```

### Container Communication Patterns

```bash
# Containers on the SAME user-defined network can talk by name:
docker network create app-net
docker run -d --name db --network app-net postgres
docker run -d --name api --network app-net -e DB_HOST=db myapi
# api connects to postgres at hostname "db"

# Containers on DIFFERENT networks are isolated:
docker network create frontend
docker network create backend
docker run -d --name api --network backend myapi
docker run -d --name web --network frontend myweb
# web CANNOT reach api

# Connect a container to multiple networks:
docker network connect frontend api
# Now api is on both frontend and backend
```

**Why interviewer asks this:** Networking is the #1 source of "container can't connect to X" issues.

**Follow-up:** *What's the difference between the default bridge and a user-defined bridge?*

| Feature | Default bridge | User-defined bridge |
|---|---|---|
| DNS resolution | No (IP only) | Yes (container names resolve) |
| Isolation | All containers on same network | Explicit connection required |
| Live connect/disconnect | No | Yes (`docker network connect/disconnect`) |
| Link containers | Legacy `--link` | Automatic DNS |

**Always use user-defined networks** in production.

---

## Q8. How does data persistence work in Docker?

**Answer:**

Containers are **ephemeral** — when removed, all data inside is lost. Docker provides three mechanisms for persistent data:

### 1. Volumes (Managed by Docker — preferred)

```bash
# Create a named volume
docker volume create pgdata

# Use the volume
docker run -d \
  --name postgres \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

# Volume persists even if container is removed
docker rm -f postgres
docker volume ls    # pgdata still exists!

# Inspect volume
docker volume inspect pgdata
# "Mountpoint": "/var/lib/docker/volumes/pgdata/_data"
```

### 2. Bind Mounts (Host directory mapped into container)

```bash
# Mount host directory into container
docker run -d \
  --name web \
  -v /home/deploy/app/config:/app/config:ro \  # Read-only mount
  -v /home/deploy/app/logs:/app/logs \          # Read-write mount
  myapp

# Common for development — mount source code for live reloading
docker run -d \
  -v $(pwd)/src:/app/src \
  -p 3000:3000 \
  myapp-dev
```

### 3. tmpfs Mounts (RAM-based, temporary)

```bash
# Data stored in memory, never written to disk
docker run -d \
  --tmpfs /tmp:rw,size=100m \
  myapp
# Use case: temporary files, secrets that shouldn't touch disk
```

### Comparison

```
┌──────────────────────────────────────────────────┐
│                Host Filesystem                    │
│                                                   │
│  Bind Mount          Volume           tmpfs       │
│  /host/path    /var/lib/docker/      (in RAM)    │
│      │         volumes/name/             │        │
│      │              │                    │        │
│      ▼              ▼                    ▼        │
│  ┌──────────────────────────────────────────┐    │
│  │            Container Filesystem           │    │
│  │                                           │    │
│  │  /app/config   /var/lib/data   /tmp      │    │
│  │  (bind mount)  (volume)        (tmpfs)   │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

| Feature | Volume | Bind Mount | tmpfs |
|---|---|---|---|
| Managed by Docker | Yes | No | No |
| Location | Docker area | Anywhere on host | RAM |
| Persistence | Survives container removal | Depends on host | No |
| Sharing between containers | Yes | Yes | No |
| Backup | `docker volume` commands | Standard file tools | N/A |
| Performance | Native | Native | Fastest |
| Security | Isolated from host | Exposes host paths | In memory only |

**Why interviewer asks this:** Data persistence is a critical production concern — losing database data is catastrophic.

**Follow-up:** *How do you back up a Docker volume?*

```bash
# Method 1: Run a temporary container that mounts the volume and creates a tar
docker run --rm \
  -v pgdata:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/pgdata-backup.tar.gz -C /source .

# Method 2: Copy from the volume's filesystem path
sudo tar czf pgdata-backup.tar.gz -C /var/lib/docker/volumes/pgdata/_data .

# Method 3: For databases, use the database's own dump tool
docker exec postgres pg_dump -U myuser mydb > backup.sql
```

---

## Q9. Debugging scenario: Your container starts and immediately exits. How do you debug?

**Answer:**

### Step-by-step debugging process

```bash
# Step 1: Check the exit code
docker ps -a --filter "name=mycontainer"
# STATUS: Exited (1) 5 seconds ago

docker inspect --format '{{.State.ExitCode}}' mycontainer
# Common exit codes:
# 0   = Clean exit (process finished successfully — is this expected?)
# 1   = Application error (check logs)
# 126 = Permission denied (can't execute entrypoint)
# 127 = Command not found (entrypoint doesn't exist)
# 137 = OOM killed (128 + 9 SIGKILL) — out of memory
# 139 = Segfault (128 + 11 SIGSEGV)
# 143 = SIGTERM (128 + 15) — graceful stop


# Step 2: Check logs
docker logs mycontainer
# Shows stdout/stderr from the container's process
# This is your primary debugging tool


# Step 3: If no logs, run interactively
docker run -it --entrypoint sh myapp:1.0
# Now you're inside — manually run the entrypoint to see errors:
# $ node server.js
# Error: Cannot find module '/app/server.js'
# ^ Found the problem!


# Step 4: Check the image's entrypoint/cmd
docker inspect --format '{{.Config.Entrypoint}} {{.Config.Cmd}}' myapp:1.0
# Verify the command actually exists in the image


# Step 5: Check file permissions
docker run -it --entrypoint sh myapp:1.0
# $ ls -la /app/server.js
# -rw-r--r-- (no execute permission)
# $ whoami
# app (non-root user — can it read the file?)


# Step 6: Check for OOM
docker inspect --format '{{.State.OOMKilled}}' mycontainer
# true = container was killed due to memory limit
# Fix: increase memory limit or fix the memory leak
```

### Common Causes and Fixes

| Exit Code | Likely Cause | Fix |
|---|---|---|
| 0 | Process ran and finished | Check if CMD is correct (maybe ran a one-shot command) |
| 1 | Application error | Check logs, fix application code |
| 126 | Permission denied | `chmod +x` the entrypoint, or check USER directive |
| 127 | Command not found | Verify the binary exists in the image |
| 137 | Out of memory | Increase `--memory` limit or fix memory leak |
| 139 | Segfault | Application bug (native code crash) |

### Real-world example: The "missing shell" problem

```bash
# This Dockerfile uses distroless (no shell):
FROM gcr.io/distroless/nodejs20

# This CMD fails:
CMD node server.js          # Shell form — needs /bin/sh, which doesn't exist!

# Fix — use exec form:
CMD ["node", "server.js"]   # Exec form — runs directly, no shell needed
```

**Why interviewer asks this:** Container debugging is daily work. Systematic approaches matter more than guessing.

**Follow-up:** *Your container runs fine locally but crashes in production. What could be different?*

1. **Environment variables** — missing or different values in production
2. **Memory limits** — production has stricter limits than local Docker
3. **Network access** — production may not be able to reach external services
4. **Secrets/config** — different database URLs, API keys
5. **CPU architecture** — built on ARM Mac, running on x86 Linux (use `--platform linux/amd64`)
6. **Volume permissions** — different user IDs between local and production

---

## Q10. Output-based: What does this Dockerfile produce, and what's wrong with it?

```dockerfile
FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y python3 python3-pip
RUN pip3 install flask
COPY . /app
WORKDIR /app
ENV FLASK_APP=app.py
ENV FLASK_SECRET_KEY=super-secret-123
EXPOSE 5000
CMD flask run --host=0.0.0.0
```

**Answer:**

### What it produces

A Docker image that runs a Flask application. It will work, but has **7 significant problems**:

### Problem 1: `ubuntu:latest` tag
```dockerfile
# BAD
FROM ubuntu:latest
# "latest" is mutable — today it's 24.04, tomorrow 24.10
# Your builds are not reproducible

# GOOD
FROM python:3.12-slim
# Use specific tags and use the official Python image instead of
# installing Python on Ubuntu
```

### Problem 2: Separate `apt-get update` and `apt-get install`
```dockerfile
# BAD — if the install line changes, the update line is cached (stale)
RUN apt-get update
RUN apt-get install -y python3

# GOOD — always combine and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    rm -rf /var/lib/apt/lists/*
```

### Problem 3: No `.dockerignore` consideration
```dockerfile
# BAD — COPY . copies everything (node_modules, .git, .env, etc.)
COPY . /app

# GOOD — use .dockerignore and copy strategically
```

### Problem 4: Poor layer ordering (cache busting)
```dockerfile
# BAD — any code change rebuilds pip install
COPY . /app
RUN pip3 install flask

# GOOD — install dependencies first, then copy code
COPY requirements.txt .
RUN pip3 install -r requirements.txt
COPY . /app
```

### Problem 5: Secret in environment variable
```dockerfile
# BAD — secret baked into the image, visible to anyone
ENV FLASK_SECRET_KEY=super-secret-123

# GOOD — pass at runtime
# docker run -e FLASK_SECRET_KEY=$SECRET myapp
```

### Problem 6: Running as root
```dockerfile
# BAD — no USER directive, runs everything as root

# GOOD
RUN useradd --create-home appuser
USER appuser
```

### Problem 7: Shell form CMD
```dockerfile
# BAD — uses shell form (PID 1 is /bin/sh, not flask)
CMD flask run --host=0.0.0.0

# GOOD — exec form, flask is PID 1
CMD ["flask", "run", "--host=0.0.0.0"]
```

### Corrected Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home appuser
USER appuser

COPY --chown=appuser:appuser . .

ENV FLASK_APP=app.py

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["flask", "run", "--host=0.0.0.0"]
```

**Why interviewer asks this:** Tests your ability to review Dockerfiles critically — a daily code review skill.

**Follow-up:** *How much smaller would the corrected image be compared to the original?*

The original (Ubuntu + Python + pip + dev tools) would be ~800MB-1GB. The corrected one (python:3.12-slim + minimal deps) would be ~150-200MB. Using a multi-stage build with a distroless final image could get it down to ~50-80MB.

---

*Next: [04 — Advanced Docker & Containerization →](./04-advanced-docker.md)*
