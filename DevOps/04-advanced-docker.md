# Advanced Docker & Containerization — Interview Preparation

> Section 4 of 7 — Multi-stage builds, Docker Compose, image optimization, security, and production patterns.

---

## Table of Contents

1. [Multi-stage Builds](#q1-what-are-multi-stage-builds-and-why-are-they-essential)
2. [Docker Compose Deep Dive](#q2-explain-docker-compose-and-write-a-production-grade-configuration)
3. [Image Optimization](#q3-how-do-you-optimize-docker-image-size)
4. [Docker Security Best Practices](#q4-what-are-docker-security-best-practices)
5. [Docker Networking Advanced](#q5-explain-advanced-docker-networking-patterns)
6. [Container Orchestration Patterns](#q6-what-happens-when-a-single-docker-host-isnt-enough)
7. [Docker Registry Management](#q7-how-do-you-manage-a-private-docker-registry)
8. [Container Resource Management](#q8-how-do-you-set-and-manage-container-resource-limits)
9. [Docker Build Optimization](#q9-how-do-you-optimize-docker-build-speed-in-cicd)
10. [Debugging Production Containers](#q10-debugging-scenario-your-container-is-consuming-excessive-memory-in-production)

---

## Q1. What are multi-stage builds and why are they essential?

**Answer:**

Multi-stage builds let you use **multiple `FROM` statements** in a single Dockerfile. Each `FROM` starts a new build stage. You can selectively copy artifacts from one stage to another, leaving behind build tools and intermediate files.

### The Problem

```dockerfile
# Single-stage build — BLOATED IMAGE
FROM node:20
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build   # Generates /app/dist
CMD ["node", "dist/server.js"]

# Image contains:
# - Full Node.js (including npm, yarn, dev headers) ~350MB
# - Source code (unnecessary at runtime)
# - node_modules including devDependencies (~200MB)
# - Build tools (TypeScript compiler, webpack, etc.)
# Total: ~600-900MB
```

### The Solution: Multi-stage

```dockerfile
# ═══════ Stage 1: Build ═══════
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci                          # All dependencies (including dev)

COPY . .
RUN npm run build                   # Produces /app/dist
RUN npm prune --production          # Remove devDependencies

# ═══════ Stage 2: Production ═══════
FROM node:20-alpine AS production
WORKDIR /app

# Copy ONLY what we need from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 3000
CMD ["node", "dist/server.js"]

# Image contains ONLY:
# - Alpine Node.js runtime (~50MB)
# - Production node_modules (~80MB)
# - Compiled dist/ (~5MB)
# Total: ~135MB (85% smaller!)
```

### Advanced: Three-stage build (with testing)

```dockerfile
# ═══════ Stage 1: Dependencies ═══════
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ═══════ Stage 2: Test ═══════
FROM deps AS test
COPY . .
RUN npm run lint
RUN npm run test
RUN npm run build

# ═══════ Stage 3: Production ═══════
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=test /app/dist ./dist
COPY package.json ./

RUN npm prune --production
RUN addgroup --system app && adduser --system --ingroup app app
USER app

CMD ["node", "dist/server.js"]
```

### Go example (extreme optimization)

```dockerfile
# Build stage: full Go toolchain (~800MB)
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

# Production stage: scratch (0MB base!)
FROM scratch
COPY --from=builder /app/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/server"]
# Final image: ~10-15MB (just the binary + CA certs)
```

### Targeting specific stages

```bash
# Build only up to the test stage (CI)
docker build --target test -t myapp:test .

# Build the full production image
docker build --target production -t myapp:prod .

# Build only the deps stage (for caching in CI)
docker build --target deps -t myapp:deps .
```

**Why interviewer asks this:** Multi-stage builds are the standard for production Dockerfiles. Not using them is a red flag.

**Follow-up:** *Can you copy files from an external image (not a build stage)?*

Yes — you can copy from any image:
```dockerfile
FROM alpine
COPY --from=nginx:latest /etc/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=busybox:latest /bin/wget /usr/local/bin/wget
```

---

## Q2. Explain Docker Compose and write a production-grade configuration.

**Answer:**

Docker Compose is a tool for defining and running **multi-container applications** using a YAML file.

### Complete production example: Full-stack application

```yaml
# docker-compose.yml
# (or compose.yml — modern standard)

services:
  # ─────────── Application ───────────
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
      target: production
      args:
        NODE_ENV: production
    image: myapp-api:${VERSION:-latest}
    container_name: api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://appuser:${DB_PASSWORD}@postgres:5432/mydb
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    networks:
      - frontend
      - backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ─────────── Worker (Background Jobs) ───────────
  worker:
    build:
      context: ./api
      target: production
    command: ["node", "dist/worker.js"]
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://appuser:${DB_PASSWORD}@postgres:5432/mydb
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    networks:
      - backend

  # ─────────── Database ───────────
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G
    networks:
      - backend
    # Never expose DB port to host in production!
    # ports:
    #   - "5432:5432"  # Only for development

  # ─────────── Cache ───────────
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
    networks:
      - backend

  # ─────────── Reverse Proxy ───────────
  nginx:
    image: nginx:1.25-alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static-files:/usr/share/nginx/html:ro
    depends_on:
      - api
    networks:
      - frontend

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  static-files:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access — only service-to-service
```

### Essential Compose Commands

```bash
# Start all services
docker compose up -d                   # Detached
docker compose up -d --build           # Rebuild images first

# Stop all services
docker compose down                    # Stop and remove containers
docker compose down -v                 # Also remove volumes (DATA LOSS!)

# Scale specific service
docker compose up -d --scale worker=3  # Run 3 worker instances

# View logs
docker compose logs -f api             # Follow API logs
docker compose logs --tail 50          # Last 50 lines of all services

# Execute command in service
docker compose exec api sh             # Shell into api container
docker compose exec postgres psql -U appuser mydb

# Check status
docker compose ps
docker compose top                     # Processes in all containers
```

### Environment Variables with `.env`

```bash
# .env (auto-loaded by Docker Compose)
VERSION=1.2.0
DB_PASSWORD=strong-random-password
JWT_SECRET=another-strong-secret
REDIS_PASSWORD=redis-secret
```

**Why interviewer asks this:** Docker Compose is the standard for local development and small production deployments.

**Follow-up:** *When should you NOT use Docker Compose in production?*

When you need:
- **Multi-host deployment** — Compose runs on a single machine
- **Auto-scaling** — Compose doesn't auto-scale based on load
- **Rolling updates with zero downtime** — Compose restarts cause brief downtime
- **Service mesh features** — no built-in load balancing, circuit breaking

At that point, you need **Kubernetes**, **Docker Swarm**, or a managed container service (ECS, Cloud Run).

---

## Q3. How do you optimize Docker image size?

**Answer:**

### Strategy 1: Choose minimal base images

```
Image                     Size
─────                     ────
ubuntu:22.04              77MB
debian:12-slim            74MB
node:20                   1.1GB
node:20-slim              220MB
node:20-alpine            135MB
python:3.12               1.0GB
python:3.12-slim          150MB
python:3.12-alpine        55MB
gcr.io/distroless/nodejs  ~30MB
scratch                   0MB
```

### Strategy 2: Multi-stage builds (covered in Q1)

### Strategy 3: Minimize layers and clean up in the same layer

```dockerfile
# BAD — package lists persist in layer 1 even though removed in layer 2
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# GOOD — cleanup happens in same layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### Strategy 4: Use `.dockerignore`

```
# .dockerignore
.git
node_modules
*.md
.env
.env.*
dist
coverage
.next
__pycache__
*.pyc
.DS_Store
Dockerfile
docker-compose*.yml
```

### Strategy 5: Production-only dependencies

```dockerfile
# Node.js
RUN npm ci --only=production
# or after building:
RUN npm prune --production

# Python
RUN pip install --no-cache-dir -r requirements.txt

# Go (static binary — no runtime needed)
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/server .
# -s removes symbol table, -w removes DWARF debug info
```

### Strategy 6: Squash layers (when needed)

```bash
# Export and re-import to flatten layers
docker build -t myapp:build .
docker export $(docker create myapp:build) | docker import - myapp:squashed
# WARNING: loses CMD, ENV, EXPOSE metadata — use as last resort
```

### Real Optimization Example

```
Before optimization:
  FROM node:20                        → 1.1GB base
  COPY . .                            → +500MB (node_modules copied!)
  RUN npm install                     → +300MB (duplicate deps)
  Total: ~1.9GB

After optimization:
  FROM node:20-alpine AS builder      → 135MB (build stage, not in final)
  COPY package*.json .
  RUN npm ci
  COPY . .
  RUN npm run build && npm prune --production

  FROM node:20-alpine                 → 135MB base
  COPY --from=builder /app/dist       → ~5MB
  COPY --from=builder /app/node_modules → ~80MB (production only)
  Total: ~220MB (88% smaller!)
```

### Analyzing image layers

```bash
# See layer sizes
docker history myapp:latest

# Use dive tool for interactive exploration
dive myapp:latest
# Shows each layer and what files it added/modified
```

**Why interviewer asks this:** Image size affects pull time, startup time, storage costs, and attack surface.

**Follow-up:** *What is a distroless image and when would you use it?*

Distroless images (by Google) contain **only the application runtime** — no shell, no package manager, no utilities. Example: `gcr.io/distroless/nodejs20` has Node.js but no `sh`, `bash`, `apt`, `curl`, etc.

**Pros:** Minimal attack surface (no shell = can't get a shell if compromised), smallest possible size.
**Cons:** Can't `docker exec` into it for debugging. Use a separate debug image for troubleshooting.

---

## Q4. What are Docker security best practices?

**Answer:**

### 1. Never run as root

```dockerfile
# Create non-root user and switch to it
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Copy files with correct ownership
COPY --chown=app:app . .

USER app
```

### 2. Use read-only filesystem

```bash
docker run --read-only \
  --tmpfs /tmp \
  --tmpfs /var/run \
  myapp
```

```yaml
# docker-compose.yml
services:
  api:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

### 3. Drop all capabilities and add only what's needed

```bash
docker run \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \
  myapp
```

```
Default capabilities include dangerous ones:
  CAP_NET_RAW        → packet sniffing
  CAP_SYS_CHROOT     → escape chroot
  CAP_SETUID/SETGID  → privilege escalation
```

### 4. Scan images for vulnerabilities

```bash
# Trivy (most popular open-source scanner)
trivy image myapp:latest
# Output:
# Total: 15 (CRITICAL: 2, HIGH: 5, MEDIUM: 8)
# ┌───────────────┬──────────┬──────────┬─────────────────────┐
# │   Library     │ Vuln ID  │ Severity │ Installed → Fixed   │
# ├───────────────┼──────────┼──────────┼─────────────────────┤
# │ openssl       │ CVE-XXX  │ CRITICAL │ 3.0.1 → 3.0.12     │
# └───────────────┴──────────┴──────────┴─────────────────────┘

# Scan in CI (fail on critical)
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

### 5. Never store secrets in images

```dockerfile
# BAD — secret baked into image layer (visible with docker history)
ENV API_KEY=sk-secret123
COPY .env /app/.env
RUN echo "password" > /app/config

# GOOD — pass at runtime
# docker run -e API_KEY=$API_KEY myapp
# Or use Docker secrets (Swarm) or external secret managers
```

```bash
# Build-time secrets (for private npm registries, etc.)
docker build --secret id=npmrc,src=.npmrc .

# In Dockerfile:
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
# The secret is available during build but NOT stored in any layer
```

### 6. Pin image digests for reproducibility

```dockerfile
# Tags are mutable — node:20-alpine today might differ from tomorrow
FROM node:20-alpine

# Digests are immutable — always the exact same image
FROM node:20-alpine@sha256:abc123...
```

### 7. Limit container resources

```bash
docker run \
  --memory 512m \
  --memory-swap 512m \      # Same as memory = no swap
  --cpus 0.5 \
  --pids-limit 100 \        # Prevent fork bombs
  --ulimit nofile=1024:1024 \
  myapp
```

### 8. Network isolation

```yaml
# docker-compose.yml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true    # No internet access — only service-to-service

services:
  api:
    networks: [frontend, backend]
  postgres:
    networks: [backend]      # DB can't reach internet
  nginx:
    networks: [frontend]     # Nginx can't reach DB directly
```

### Security Checklist

```
[ ] Non-root user in Dockerfile
[ ] Read-only root filesystem
[ ] Minimal base image (Alpine or distroless)
[ ] No secrets in image layers
[ ] Image vulnerability scanning in CI
[ ] Dropped capabilities (--cap-drop ALL)
[ ] Resource limits (memory, CPU, PIDs)
[ ] Network segmentation (internal networks)
[ ] Signed images (Docker Content Trust)
[ ] Regular base image updates
[ ] .dockerignore excludes sensitive files
```

**Why interviewer asks this:** Container security is a critical production concern. One misconfigured container can compromise the entire host.

**Follow-up:** *Why is mounting `/var/run/docker.sock` into a container dangerous?*

The Docker socket provides **full control over the Docker daemon**. A container with access to it can:
1. Create a new privileged container that mounts the host's root filesystem
2. Read any secret from any other container
3. Stop or destroy any container
4. Effectively gain **root access to the host**

If you must mount it (e.g., for CI runners), use a read-only proxy like `docker-socket-proxy` that exposes only the API endpoints you need.

---

## Q5. Explain advanced Docker networking patterns.

**Answer:**

### Pattern 1: Reverse Proxy with Multiple Services

```
Internet
    │
    ▼
┌────────────┐
│   nginx    │ ← Port 80/443
│  (proxy)   │
└──┬─────┬───┘
   │     │
   ▼     ▼
┌──────┐ ┌──────┐
│ api  │ │ web  │    ← frontend network
│:3000 │ │:8080 │
└──┬───┘ └──────┘
   │
   ▼
┌──────┐ ┌──────┐
│  db  │ │redis │    ← backend network (internal)
│:5432 │ │:6379 │
└──────┘ └──────┘
```

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [frontend]

  api:
    build: ./api
    networks: [frontend, backend]
    # No ports exposed to host!

  web:
    build: ./web
    networks: [frontend]

  postgres:
    image: postgres:16-alpine
    networks: [backend]

networks:
  frontend:
  backend:
    internal: true
```

```nginx
# nginx.conf — routes traffic by path
upstream api_backend {
    server api:3000;
}

upstream web_backend {
    server web:8080;
}

server {
    listen 80;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://web_backend;
    }
}
```

### Pattern 2: Service Discovery with DNS

```bash
# Docker's embedded DNS (127.0.0.11) resolves container names
# on user-defined networks

# If you scale a service, DNS returns all IPs (round-robin)
docker compose up -d --scale api=3

# From another container:
nslookup api
# Server:  127.0.0.11
# Name:    api
# Address: 172.20.0.3
# Address: 172.20.0.4
# Address: 172.20.0.5
```

### Pattern 3: Overlay Network (Multi-host — Docker Swarm)

```bash
# Create overlay network (spans multiple Docker hosts)
docker network create --driver overlay --attachable my-overlay

# Containers on different hosts can communicate
# Host A:
docker run --network my-overlay --name api myapi

# Host B:
docker run --network my-overlay --name worker myworker
# worker can reach api by name, even though they're on different machines
```

### Pattern 4: macvlan (Container gets real IP on LAN)

```bash
# Container appears as a physical device on the network
docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  my-macvlan

docker run --network my-macvlan --ip 192.168.1.50 myapp
# Container is accessible at 192.168.1.50 on the local network
# Use case: legacy apps that need to be on the same network as physical machines
```

**Why interviewer asks this:** Complex applications require sophisticated networking. Understanding these patterns is essential for designing microservice architectures.

**Follow-up:** *How does Docker DNS resolution work internally?*

Docker runs an embedded DNS server at `127.0.0.11` on every user-defined network. When a container does a DNS lookup for another container's name, the request goes to this embedded DNS. It resolves container names, service names (Compose), and aliases. If the name doesn't match a Docker resource, it forwards the query to the host's DNS resolver (configured in the container's `/etc/resolv.conf`).

---

## Q6. What happens when a single Docker host isn't enough?

**Answer:**

### The Scaling Problem

```
Single Host:
┌────────────────────────────┐
│ Docker Host                 │
│ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │ api │ │ api │ │ api │  │
│ └─────┘ └─────┘ └─────┘  │
│ ┌─────┐ ┌─────┐          │
│ │ db  │ │redis│          │
│ └─────┘ └─────┘          │
└────────────────────────────┘
Problems:
- Single point of failure
- CPU/memory limited to one machine
- Can't handle traffic spikes
```

### Solutions (Increasing Complexity)

#### Level 1: Docker Compose + Load Balancer

```yaml
# Simple: multiple instances behind nginx
services:
  api:
    build: ./api
    deploy:
      replicas: 3
  nginx:
    image: nginx
    ports: ["80:80"]
    depends_on: [api]
```

Still single host, but multiple container instances.

#### Level 2: Docker Swarm (Built-in Orchestration)

```bash
# Initialize swarm
docker swarm init

# Add worker nodes
docker swarm join --token SWMTKN-xxx manager:2377

# Deploy a stack
docker stack deploy -c docker-compose.yml myapp

# Scale services
docker service scale myapp_api=5
```

```
Manager Node                Worker Node 1            Worker Node 2
┌──────────────┐           ┌──────────────┐         ┌──────────────┐
│ ┌────┐┌────┐ │           │ ┌────┐┌────┐ │         │ ┌────┐       │
│ │api1││api2│ │           │ │api3││api4│ │         │ │api5│       │
│ └────┘└────┘ │           │ └────┘└────┘ │         │ └────┘       │
│ ┌────┐       │           │              │         │              │
│ │ db │       │           │              │         │              │
│ └────┘       │           │              │         │              │
└──────────────┘           └──────────────┘         └──────────────┘
         ↑                         ↑                        ↑
         └─────── Overlay Network (swarm routing mesh) ─────┘
```

#### Level 3: Kubernetes (Industry Standard)

```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: myapp-api:1.2.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "128Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "1000m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

### Comparison

| Feature | Compose | Swarm | Kubernetes |
|---|---|---|---|
| Multi-host | No | Yes | Yes |
| Auto-scaling | No | Basic | Advanced (HPA) |
| Rolling updates | Basic | Yes | Yes (configurable) |
| Self-healing | Restart only | Yes | Yes |
| Complexity | Low | Medium | High |
| Ecosystem | Docker only | Docker only | Massive (Helm, Istio, etc.) |
| Production use | Small apps | Medium apps | Large-scale |

**Why interviewer asks this:** Shows understanding of when to graduate from Docker Compose to real orchestration.

**Follow-up:** *Why did the industry standardize on Kubernetes instead of Docker Swarm?*

Kubernetes won because of: broader feature set (RBAC, namespaces, CRDs, operators), backing by all major cloud providers (EKS, GKE, AKS), a massive ecosystem (Helm, Istio, ArgoCD, Prometheus), and custom resource definitions that let you extend K8s for any use case. Swarm was simpler but couldn't match K8s at enterprise scale.

---

## Q7. How do you manage a private Docker registry?

**Answer:**

### Option 1: Cloud-managed registries (recommended)

```bash
# AWS ECR
aws ecr create-repository --repository-name myapp
aws ecr get-login-password | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:1.0

# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker push ghcr.io/myorg/myapp:1.0

# Google Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/my-project/my-repo/myapp:1.0
```

### Option 2: Self-hosted registry

```yaml
# docker-compose.yml for private registry
services:
  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - registry-data:/var/lib/registry
      - ./auth:/auth
      - ./certs:/certs
    environment:
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: "Private Registry"
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_HTTP_TLS_CERTIFICATE: /certs/registry.crt
      REGISTRY_HTTP_TLS_KEY: /certs/registry.key
    restart: unless-stopped

volumes:
  registry-data:
```

```bash
# Create auth credentials
htpasswd -Bc auth/htpasswd admin

# Push to private registry
docker tag myapp:1.0 registry.company.com:5000/myapp:1.0
docker push registry.company.com:5000/myapp:1.0

# List images in registry
curl -u admin https://registry.company.com:5000/v2/_catalog
```

### Image tagging strategy

```bash
# Semantic versioning + commit SHA
docker build \
  -t myapp:1.2.3 \             # Specific version
  -t myapp:1.2 \               # Minor version (mutable)
  -t myapp:latest \             # Latest (mutable)
  -t myapp:$(git rev-parse --short HEAD) \  # Git SHA (immutable)
  .

# In production: use SHA or specific version, NEVER "latest"
# "latest" is mutable and can change under you
```

### Image lifecycle management

```bash
# ECR lifecycle policy (auto-delete old images)
aws ecr put-lifecycle-policy --repository-name myapp --lifecycle-policy-text '{
  "rules": [{
    "rulePriority": 1,
    "description": "Keep only 10 most recent images",
    "selection": {
      "tagStatus": "any",
      "countType": "imageCountMoreThan",
      "countNumber": 10
    },
    "action": {
      "type": "expire"
    }
  }]
}'
```

**Why interviewer asks this:** Registry management is a core DevOps responsibility — image storage, access control, and cleanup.

**Follow-up:** *How do you handle image signing and verification?*

Use **Docker Content Trust (DCT)** or **Cosign** (from Sigstore):

```bash
# Cosign (modern approach)
cosign sign --key cosign.key registry.com/myapp:1.0
cosign verify --key cosign.pub registry.com/myapp:1.0

# In Kubernetes, use admission controllers (Kyverno, OPA Gatekeeper)
# to reject unsigned images
```

---

## Q8. How do you set and manage container resource limits?

**Answer:**

### Memory Limits

```bash
# Hard memory limit (container killed if exceeded)
docker run --memory 512m myapp

# Memory + swap limit
docker run --memory 512m --memory-swap 1g myapp
# Container can use 512MB RAM + 512MB swap
# --memory-swap 512m → no swap (swap = total - memory = 0)

# Memory reservation (soft limit for scheduling)
docker run --memory 1g --memory-reservation 512m myapp
```

### CPU Limits

```bash
# Limit to 1.5 CPU cores
docker run --cpus 1.5 myapp

# CPU shares (relative weight, default 1024)
docker run --cpu-shares 512 myapp     # Half priority
docker run --cpu-shares 2048 myapp    # Double priority
# Only matters when CPU is contested — not a hard limit

# Pin to specific CPU cores
docker run --cpuset-cpus "0,1" myapp  # Only use cores 0 and 1
```

### Understanding OOM (Out of Memory) Kills

```bash
# Check if container was OOM killed
docker inspect --format '{{.State.OOMKilled}}' mycontainer
# true = container exceeded memory limit

# Check from host kernel logs
dmesg | grep -i "oom\|killed"

# Prevention:
# 1. Set appropriate memory limits (monitor actual usage first)
docker stats mycontainer
# CONTAINER   CPU %   MEM USAGE / LIMIT     MEM %
# mycontainer 2.5%    245.3MiB / 512MiB     47.91%

# 2. Disable OOM killer for critical containers (use with caution)
docker run --oom-kill-disable --memory 1g myapp
```

### Docker Compose Resource Limits

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    # For docker compose (not swarm), also use:
    mem_limit: 512m
    cpus: 1.0
```

### Monitoring Resource Usage

```bash
# Real-time stats for all containers
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
# NAME    CPU %    MEM USAGE / LIMIT    NET I/O          BLOCK I/O
# api     5.2%     245MiB / 512MiB      12.3kB / 8.4kB   0B / 4.1MB
# db      12.1%    389MiB / 1GiB        5.6kB / 3.2kB    8.2MB / 45MB
```

**Why interviewer asks this:** Resource management prevents noisy neighbor problems and OOM kills in production.

**Follow-up:** *A Java application in Docker keeps getting OOM killed at 512MB limit, but the app only uses 300MB heap. Why?*

JVM memory = Heap + Metaspace + Thread stacks + Direct buffers + Code cache + GC overhead. The 300MB is just the heap. Total JVM memory can be 1.5-2x the heap size. Fix: either increase the container memory limit or use `-XX:MaxRAMPercentage=75` to let the JVM auto-size its heap relative to the container's memory limit.

---

## Q9. How do you optimize Docker build speed in CI/CD?

**Answer:**

### 1. Layer caching with proper ordering

```dockerfile
# Dependencies change less often than source code
# Put them FIRST to cache the expensive install step

COPY package.json package-lock.json ./   # Changes rarely
RUN npm ci                                # Cached until package.json changes
COPY . .                                  # Changes every build
RUN npm run build
```

### 2. BuildKit cache mounts

```dockerfile
# syntax=docker/dockerfile:1

# Cache npm packages across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Cache apt packages
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y curl

# Cache Go modules
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app/server .
```

### 3. CI cache strategies

```yaml
# GitHub Actions — cache Docker layers
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build with cache
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: myapp:${{ github.sha }}
    cache-from: type=gha          # GitHub Actions cache
    cache-to: type=gha,mode=max
```

### 4. Parallel builds for multi-stage

```dockerfile
# BuildKit builds independent stages in parallel!
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json .
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim AS backend-builder
WORKDIR /backend
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
RUN python -m pytest

# These two stages build simultaneously ↑

FROM python:3.12-slim
COPY --from=backend-builder /backend /app
COPY --from=frontend-builder /frontend/dist /app/static
CMD ["python", "/app/server.py"]
```

### 5. Use `DOCKER_BUILDKIT=1`

```bash
# Enable BuildKit (default in Docker 23+, but be explicit)
DOCKER_BUILDKIT=1 docker build -t myapp .

# Benefits:
# - Parallel stage building
# - Better caching
# - Secret mounts (--mount=type=secret)
# - Cache mounts (--mount=type=cache)
# - Smaller build context transfer
```

### Build time comparison

```
Without optimization:
  Full build: 5 minutes
  Rebuild after code change: 5 minutes (no cache)

With optimization:
  Full build: 5 minutes
  Rebuild after code change: 30 seconds (layers 1-3 cached)
  Rebuild after dependency change: 2 minutes (layer 1 cached)
```

**Why interviewer asks this:** Slow builds kill developer productivity and CI costs. This is a practical optimization skill.

**Follow-up:** *What is `docker buildx` and when would you use it?*

`buildx` is Docker's extended builder based on BuildKit. Key features:
- **Multi-platform builds**: `docker buildx build --platform linux/amd64,linux/arm64` — builds for both Intel and ARM from one machine
- **Remote builders**: build on remote machines (faster CI)
- **Advanced cache backends**: registry cache, S3 cache, GitHub Actions cache

---

## Q10. Debugging scenario: Your container is consuming excessive memory in production.

**Answer:**

### Step 1: Identify the problem

```bash
# Check current memory usage
docker stats --no-stream
# CONTAINER    MEM USAGE / LIMIT    MEM %
# api-1        487MiB / 512MiB     95.12%  ← Almost at limit!
# api-2        491MiB / 512MiB     95.90%  ← Both instances!

# Check if OOM kills have occurred
docker inspect --format '{{.State.OOMKilled}}' api-1
# Check host dmesg
dmesg | tail -20
```

### Step 2: Profile the application

```bash
# Exec into the container
docker exec -it api-1 sh

# For Node.js — check heap usage
node -e "console.log(process.memoryUsage())"
# { rss: 485MB, heapTotal: 380MB, heapUsed: 350MB, external: 50MB }

# Generate heap dump for analysis
kill -USR2 $(pgrep node)   # If node is configured for heap dumps on signal
# Or connect Chrome DevTools to the Node.js inspector
```

### Step 3: Common causes and fixes

```
Cause 1: Memory leak in application code
  Symptom: Memory grows continuously over time
  Debug: Take heap snapshots at intervals, diff them
  Fix: Find and fix the leak (unclosed connections, growing caches, event listeners)

Cause 2: Insufficient memory limit
  Symptom: Memory stable but near limit
  Debug: docker stats shows consistent high usage
  Fix: Increase limit if the app genuinely needs more

Cause 3: No memory limit set at all
  Symptom: Container uses all host memory
  Debug: docker inspect shows "Memory": 0 (unlimited)
  Fix: Set explicit limits

Cause 4: Runtime-specific issues
  Node.js: Default heap limit is 1.5GB — set --max-old-space-size
  Java: JVM doesn't respect container limits by default (older versions)
         Use: -XX:MaxRAMPercentage=75 -XX:+UseContainerSupport
  Python: Memory fragmentation in long-running processes
```

### Step 4: Set up proper monitoring

```yaml
# docker-compose.yml with resource limits and healthcheck
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
    healthcheck:
      test: ["CMD", "node", "-e",
        "const used = process.memoryUsage().heapUsed / 1024 / 1024; process.exit(used > 450 ? 1 : 0)"]
      interval: 30s
      timeout: 5s
      retries: 3
```

```bash
# Quick monitoring script
while true; do
  docker stats --no-stream --format "{{.Name}}: {{.MemUsage}} ({{.MemPerc}})"
  sleep 10
done
```

**Why interviewer asks this:** Memory issues are the most common container production problem.

**Follow-up:** *How would you implement automatic restart when memory usage hits 90% but BEFORE it gets OOM killed?*

Use the healthcheck approach above combined with restart policy, or use a sidecar monitoring container that watches memory and triggers a graceful restart. In Kubernetes, this is handled by **Vertical Pod Autoscaler (VPA)** or custom **liveness probes** that check memory usage.

---

*Next: [05 — CI/CD Pipelines & Automation →](./05-cicd-pipelines.md)*
