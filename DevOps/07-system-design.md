# System Design & Real-World DevOps Scenarios - Interview Preparation

> Section 7 of 7 - Kubernetes essentials, microservices deployment, high availability, disaster recovery, and real-world architecture.

---

## Table of Contents

1. [Kubernetes Essentials](#q1-explain-kubernetes-architecture-and-core-concepts)
2. [Deploying Microservices on K8s](#q2-design-a-microservices-deployment-on-kubernetes)
3. [GitOps with ArgoCD](#q3-what-is-gitops-and-how-does-argocd-work)
4. [High Availability Design](#q4-design-a-high-availability-system-that-survives-region-failure)
5. [Disaster Recovery](#q5-explain-disaster-recovery-strategies-and-their-trade-offs)
6. [Scalable CI/CD Pipeline Design](#q6-design-a-cicd-pipeline-for-a-team-of-100-developers-with-20-microservices)
7. [Zero-Downtime Database Migrations](#q7-how-do-you-perform-zero-downtime-database-migrations)
8. [Service Mesh & Observability](#q8-what-is-a-service-mesh-and-when-do-you-need-one)
9. [Incident Management](#q9-walk-through-a-production-incident-from-detection-to-postmortem)
10. [Full System Design: E-Commerce Platform](#q10-design-the-complete-infrastructure-for-an-e-commerce-platform-handling-100k-concurrent-users)

---

## Q1. Explain Kubernetes architecture and core concepts.

**Answer:**

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Control Plane (Master)                      │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  API Server   │  │   Scheduler  │  │  Controller Manager     │ │
│  │  (kube-api)   │  │              │  │  - Deployment controller│ │
│  │  Entry point  │  │  Decides     │  │  - ReplicaSet controller│ │
│  │  for all      │  │  which node  │  │  - Node controller      │ │
│  │  operations   │  │  runs a pod  │  │  - Job controller       │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │    etcd       │  │ Cloud        │                              │
│  │  (key-value   │  │ Controller   │                              │
│  │   store)      │  │ Manager      │                              │
│  │  Source of    │  │ (AWS/GCP     │                              │
│  │  truth       │  │  integration)│                              │
│  └──────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│     Worker Node 1     │  │     Worker Node 2     │
│                       │  │                       │
│  ┌─────────────────┐ │  │  ┌─────────────────┐ │
│  │     kubelet      │ │  │  │     kubelet      │ │
│  │ (node agent)     │ │  │  │                  │ │
│  └─────────────────┘ │  │  └─────────────────┘ │
│                       │  │                       │
│  ┌─────────────────┐ │  │  ┌─────────────────┐ │
│  │   kube-proxy     │ │  │  │   kube-proxy     │ │
│  │ (networking)     │ │  │  │                  │ │
│  └─────────────────┘ │  │  └─────────────────┘ │
│                       │  │                       │
│  ┌─────────────────┐ │  │  ┌─────────────────┐ │
│  │  Container       │ │  │  │  Container       │ │
│  │  Runtime         │ │  │  │  Runtime         │ │
│  │  (containerd)    │ │  │  │  (containerd)    │ │
│  └─────────────────┘ │  │  └─────────────────┘ │
│                       │  │                       │
│  ┌─────┐ ┌─────┐    │  │  ┌─────┐ ┌─────┐    │
│  │Pod A│ │Pod B│    │  │  │Pod C│ │Pod D│    │
│  └─────┘ └─────┘    │  │  └─────┘ └─────┘    │
└──────────────────────┘  └──────────────────────┘
```

### Core Objects

**Pod** - Smallest deployable unit. One or more containers sharing network and storage.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api
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
```

**Deployment** - Manages ReplicaSets. Handles rolling updates, rollbacks, scaling.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
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
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

**Service** - Stable network endpoint for a set of pods.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  type: ClusterIP              # Internal only
  ports:
    - port: 80                 # Service port
      targetPort: 3000         # Pod port
# Accessible at: api.namespace.svc.cluster.local
```

**Ingress** - Routes external HTTP traffic to services.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

**ConfigMap & Secret** - Configuration and sensitive data.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: "info"
  API_URL: "https://api.example.com"

---
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
data:
  DATABASE_URL: cG9zdGdyZXM6Ly8uLi4=    # base64 encoded

---
# Reference in Deployment
env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: api-config
        key: LOG_LEVEL
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: api-secrets
        key: DATABASE_URL
```

### Key Commands

```bash
# Cluster info
kubectl cluster-info
kubectl get nodes

# Deployments
kubectl get deployments
kubectl describe deployment api
kubectl scale deployment api --replicas=5
kubectl rollout status deployment api
kubectl rollout undo deployment api

# Pods
kubectl get pods -o wide
kubectl logs api-pod-abc123 -f
kubectl exec -it api-pod-abc123 -- sh
kubectl top pods

# Debug
kubectl describe pod api-pod-abc123    # Events, conditions
kubectl get events --sort-by='.lastTimestamp'
```

**Why interviewer asks this:** Kubernetes is the industry standard for container orchestration. Understanding its architecture is essential for senior DevOps roles.

**Follow-up:** *What's the difference between a liveness probe and a readiness probe?*

- **Liveness probe**: "Is the container alive?" If it fails, K8s **restarts** the container. Use for: deadlocks, infinite loops.
- **Readiness probe**: "Can the container serve traffic?" If it fails, K8s **stops sending traffic** but doesn't restart. Use for: app still starting up, dependency temporarily unavailable.

---

## Q2. Design a microservices deployment on Kubernetes.

**Answer:**

### Architecture

```
Internet
    │
    ▼
┌──────────────┐
│   Ingress    │ (NGINX Ingress Controller / AWS ALB)
│   Controller │
└──────┬───────┘
       │
       ├── api.example.com/users   → User Service
       ├── api.example.com/orders  → Order Service
       ├── api.example.com/payment → Payment Service
       └── www.example.com         → Frontend

┌─────────────────────────────────────────────────────────┐
│                 Kubernetes Cluster                        │
│                                                          │
│  Namespace: production                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ User Service│ │Order Service│ │Payment Svc  │       │
│  │ (3 replicas)│ │(3 replicas) │ │(2 replicas) │       │
│  │ Node.js     │ │ Go          │ │ Java        │       │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │
│         │               │               │               │
│  ┌──────▼──────────────▼───────────────▼──────┐        │
│  │              Service Mesh (Istio)            │        │
│  │  - mTLS between services                     │        │
│  │  - Circuit breaking                           │        │
│  │  - Retry policies                             │        │
│  │  - Traffic splitting                          │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  Namespace: data                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ PostgreSQL  │ │   Redis     │ │ RabbitMQ    │       │
│  │ (StatefulSet│ │ (Sentinel)  │ │ (Cluster)   │       │
│  │  w/ PVC)    │ │             │ │             │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  Namespace: monitoring                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Prometheus  │ │  Grafana    │ │ Fluent Bit  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Namespace Isolation

```yaml
# Create namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    istio-injection: enabled

---
apiVersion: v1
kind: Namespace
metadata:
  name: data

---
# Network policy: only production namespace can access data namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-production-only
  namespace: data
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: production
```

### Helm Chart Structure

```
charts/
└── user-service/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-staging.yaml
    ├── values-production.yaml
    └── templates/
        ├── deployment.yaml
        ├── service.yaml
        ├── hpa.yaml
        ├── configmap.yaml
        └── ingress.yaml
```

```yaml
# values-production.yaml
replicaCount: 3
image:
  repository: ghcr.io/myorg/user-service
  tag: "1.2.0"

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilization: 60

ingress:
  enabled: true
  host: api.example.com
  path: /users
```

```bash
# Deploy with Helm
helm upgrade --install user-service ./charts/user-service \
  -f charts/user-service/values-production.yaml \
  --namespace production \
  --set image.tag=$GIT_SHA
```

**Why interviewer asks this:** Real-world K8s deployments are complex. This tests architectural thinking.

**Follow-up:** *How do services communicate in this architecture?*

1. **Synchronous (HTTP/gRPC):** Service A calls Service B via its Kubernetes DNS name (`order-service.production.svc.cluster.local`)
2. **Asynchronous (Message Queue):** Service A publishes to RabbitMQ, Service B consumes. Better for decoupling, handles spikes gracefully
3. The service mesh (Istio) provides mTLS (encrypted), retries, circuit breaking, and observability for all synchronous communication

---

## Q3. What is GitOps and how does ArgoCD work?

**Answer:**

### GitOps Principles

```
Traditional deployment:
  Developer → CI → "kubectl apply" → Cluster
  (Push-based: CI pushes changes to cluster)
  Problem: CI has cluster credentials, drift can occur

GitOps:
  Developer → Git (source of truth) ← ArgoCD (syncs cluster to Git)
  (Pull-based: cluster pulls desired state from Git)
  Benefit: Git = the only source of truth for cluster state
```

### Core Concepts

1. **Git is the source of truth** - desired cluster state is declared in Git
2. **Pull-based** - agent in cluster watches Git and applies changes
3. **Declarative** - you describe WHAT, not HOW
4. **Self-healing** - if someone manually changes the cluster, ArgoCD reverts it

### ArgoCD Architecture

```
┌─────────────┐     ┌──────────────────────┐
│   Git Repo  │     │   Kubernetes Cluster  │
│             │     │                       │
│ k8s/        │◄────│  ┌──────────────┐    │
│  ├─ staging │     │  │   ArgoCD     │    │
│  └─ prod    │     │  │   Server     │    │
│             │     │  │              │    │
│ Desired     │     │  │ Watches Git  │    │
│ State       │     │  │ Compares to  │    │
│             │     │  │ live state   │    │
└─────────────┘     │  │ Auto-syncs   │    │
                    │  └──────┬───────┘    │
                    │         │ applies     │
                    │         ▼             │
                    │  ┌──────────────┐    │
                    │  │  Deployments │    │
                    │  │  Services    │    │
                    │  │  ConfigMaps  │    │
                    │  └──────────────┘    │
                    └──────────────────────┘
```

### ArgoCD Application

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/k8s-manifests.git
    targetRevision: main
    path: production/api          # Directory in Git with K8s manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true                 # Delete resources removed from Git
      selfHeal: true              # Revert manual changes
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        maxDuration: 3m
```

### GitOps Deployment Workflow

```
1. Developer changes code → pushes to app repo
2. CI pipeline builds, tests, pushes Docker image
3. CI updates the image tag in the k8s-manifests repo
   (either directly or via PR)
4. ArgoCD detects the change in Git
5. ArgoCD compares Git state to cluster state
6. ArgoCD applies the diff to the cluster
7. Deployment rolls out gradually

Rollback:
  git revert <commit>  → ArgoCD automatically reverts the deployment
```

### Why Git as Source of Truth?

```
Benefits:
✓ Full audit trail (who changed what, when, why - Git blame)
✓ Peer review for infrastructure changes (PRs)
✓ Easy rollback (git revert)
✓ Disaster recovery (recreate entire cluster from Git)
✓ Consistency (cluster always matches Git)
✓ Security (no direct cluster access needed for developers)
```

**Why interviewer asks this:** GitOps is the modern standard for Kubernetes deployments.

**Follow-up:** *How do you handle secrets in GitOps? You can't commit secrets to Git.*

Use **Sealed Secrets** (Bitnami) or **External Secrets Operator**:
- **Sealed Secrets**: Encrypt secrets locally, commit encrypted version to Git, controller in cluster decrypts
- **External Secrets**: Store secrets in AWS Secrets Manager/Vault, ExternalSecret CRD references them, operator syncs to K8s Secrets

---

## Q4. Design a high availability system that survives region failure.

**Answer:**

### Multi-Region Architecture

```
                    ┌─────────────────┐
                    │  Route 53       │
                    │  (DNS failover) │
                    │  Latency-based  │
                    │  routing        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ us-east-1  │ │ eu-west-1  │ │ ap-south-1 │
     │ (primary)  │ │ (active)   │ │ (active)   │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │               │               │
     ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
     │ EKS Cluster│ │ EKS Cluster│ │ EKS Cluster│
     │ - API      │ │ - API      │ │ - API      │
     │ - Workers  │ │ - Workers  │ │ - Workers  │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │               │               │
     ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
     │ Aurora     │ │ Aurora     │ │ Aurora     │
     │ Primary    │ │ Read       │ │ Read       │
     │ (writes)   │ │ Replica    │ │ Replica    │
     └────────────┘ └────────────┘ └────────────┘
           │                               ▲
           └── Async replication ──────────┘
```

### Availability Targets

```
Availability    Downtime/year    Downtime/month    Design
─────────────────────────────────────────────────────────
99%     (two 9s)   3.65 days       7.3 hours     Single server
99.9%   (three 9s) 8.76 hours      43.8 minutes  Multi-AZ
99.99%  (four 9s)  52.6 minutes    4.4 minutes   Multi-region
99.999% (five 9s)  5.26 minutes    26.3 seconds  Active-active multi-region
```

### DNS Failover Configuration

```hcl
# Route 53 health check
resource "aws_route53_health_check" "us_east" {
  fqdn              = "us-east.api.example.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10
}

# Primary record (us-east-1)
resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name    = aws_lb.us_east.dns_name
    zone_id = aws_lb.us_east.zone_id
  }

  set_identifier = "us-east-1"

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.us_east.id
}

# Secondary record (eu-west-1) - activated on primary failure
resource "aws_route53_record" "secondary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name    = aws_lb.eu_west.dns_name
    zone_id = aws_lb.eu_west.zone_id
  }

  set_identifier = "eu-west-1"

  failover_routing_policy {
    type = "SECONDARY"
  }
}
```

### Data Replication Strategy

```
Active-Passive (simpler):
  us-east-1: Primary (reads + writes)
  eu-west-1: Read replica (reads only, failover target)
  RPO: seconds (async replication lag)
  RTO: minutes (promote replica + DNS failover)

Active-Active (complex):
  us-east-1: Reads + writes for US users
  eu-west-1: Reads + writes for EU users
  Challenge: conflict resolution for concurrent writes
  Solutions: CRDTs, last-write-wins, or partition writes by user region
```

**Why interviewer asks this:** High availability is a critical requirement for production systems.

**Follow-up:** *What's the difference between RPO and RTO?*

- **RPO (Recovery Point Objective)**: How much data can you afford to lose? If RPO is 1 hour, you need backups at least every hour.
- **RTO (Recovery Time Objective)**: How long can you be down? If RTO is 15 minutes, your failover must complete in under 15 minutes.

---

## Q5. Explain disaster recovery strategies and their trade-offs.

**Answer:**

### DR Strategies (Increasing Cost & Speed)

```
Strategy           Cost    RTO          RPO          Description
─────────────────────────────────────────────────────────────────
Backup & Restore   $       Hours        Hours        Regular backups, restore from scratch
Pilot Light        $$      30-60 min    Minutes      Core infra running, scale up on disaster
Warm Standby       $$$     Minutes      Seconds      Scaled-down copy always running
Multi-Site Active  $$$$    Near-zero    Near-zero    Full copies in multiple regions
```

### 1. Backup & Restore

```
Normal:
  Region A: ████ Application running ████
  Region B: (nothing)
  S3: Backups stored daily

Disaster:
  Region A: ✗ DOWN
  Region B: Provision infra → restore from backup → start services
  Time: 4-24 hours
```

```bash
# Automated backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Database backup
pg_dump -h db.example.com -U admin mydb | gzip > db-$TIMESTAMP.sql.gz
aws s3 cp db-$TIMESTAMP.sql.gz s3://backups/database/

# Kubernetes state backup (Velero)
velero backup create daily-$TIMESTAMP --include-namespaces production

# Verify backup
aws s3 ls s3://backups/database/ --recursive | tail -5
```

### 2. Pilot Light

```
Normal:
  Region A: ████ Full application ████
  Region B: Database replica (minimal compute)

Disaster:
  Region A: ✗ DOWN
  Region B: Promote DB replica → scale up compute → switch DNS
  Time: 30-60 minutes
```

### 3. Warm Standby

```
Normal:
  Region A: ████ Full application (10 instances) ████
  Region B: ██ Reduced application (2 instances) ██ + DB replica

Disaster:
  Region A: ✗ DOWN
  Region B: Scale up to full capacity → switch DNS
  Time: 5-15 minutes
```

### 4. Multi-Site Active-Active

```
Normal:
  Region A: ████ Full application ████ ←→ shared data
  Region B: ████ Full application ████

Disaster:
  Region A: ✗ DOWN
  Region B: Already serving traffic, absorbs all load
  Time: DNS TTL (seconds to minutes)
```

### DR Testing

```
You must TEST your DR plan regularly:

1. Tabletop exercise (quarterly):
   - Walk through the DR runbook as a team
   - Identify gaps: "We don't have a step for X"

2. Failover drill (semi-annually):
   - Actually trigger failover to DR region
   - Measure: How long did it take? What failed?

3. Chaos engineering (continuously):
   - Kill random instances, inject network failures
   - Tools: Chaos Monkey, Litmus Chaos, Gremlin

4. Backup restoration test (monthly):
   - Actually restore from backup to a test environment
   - Verify: Is the data complete? Can the app start?
```

**Why interviewer asks this:** DR planning is a critical responsibility for DevOps/SRE teams.

**Follow-up:** *Your company has RTO of 15 minutes and RPO of 0 (no data loss). Which strategy?*

**Multi-Site Active-Active** with synchronous database replication. This is the most expensive option, but it's the only way to achieve RPO=0 (zero data loss) and near-instant failover. You'd use Aurora Global Database with write forwarding, or CockroachDB for multi-region writes.

---

## Q6. Design a CI/CD pipeline for a team of 100 developers with 20 microservices.

**Answer:**

### Challenges at Scale

```
Small team (5 devs, 1 service):
  - Single repo, single pipeline, simple

Large team (100 devs, 20 services):
  - 100+ PRs per day
  - Pipeline runs consume thousands of CI minutes
  - Shared libraries used by multiple services
  - Coordinated deployments needed
  - Different services owned by different teams
```

### Architecture: Monorepo with Selective Builds

```
monorepo/
├── .github/workflows/
│   ├── ci.yml              ← Runs on all PRs (lint, type-check)
│   └── deploy.yml          ← Per-service deployment
├── services/
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   └── package.json
│   ├── order-service/
│   ├── payment-service/
│   └── ...
├── libs/
│   ├── shared-utils/        ← Shared code
│   ├── auth-middleware/
│   └── database-client/
├── infra/
│   ├── terraform/
│   └── k8s-manifests/
└── tools/
    └── scripts/
```

### CI Pipeline (Runs on Every PR)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            user-service:
              - 'services/user-service/**'
              - 'libs/shared-utils/**'
              - 'libs/auth-middleware/**'
            order-service:
              - 'services/order-service/**'
              - 'libs/shared-utils/**'
              - 'libs/database-client/**'
            payment-service:
              - 'services/payment-service/**'
              - 'libs/shared-utils/**'

  test:
    needs: detect-changes
    if: needs.detect-changes.outputs.services != '[]'
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    runs-on: ubuntu-latest-8-cores
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd services/${{ matrix.service }}
          npm ci
          npm run lint
          npm run test -- --ci --shard=${{ strategy.job-index + 1 }}/4
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  detect-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Need previous commit to detect changes

      - name: Detect changed services
        id: changes
        run: |
          CHANGED=$(git diff --name-only HEAD~1 HEAD | \
            grep "^services/" | \
            cut -d'/' -f2 | \
            sort -u | \
            jq -R -s -c 'split("\n")[:-1]')
          echo "services=$CHANGED" >> $GITHUB_OUTPUT

      - name: Build and deploy each changed service
        run: |
          for SERVICE in $(echo '${{ steps.changes.outputs.services }}' | jq -r '.[]'); do
            echo "Building $SERVICE..."
            docker build -t ghcr.io/myorg/$SERVICE:${{ github.sha }} services/$SERVICE
            docker push ghcr.io/myorg/$SERVICE:${{ github.sha }}

            echo "Deploying $SERVICE to staging..."
            helm upgrade --install $SERVICE charts/$SERVICE \
              --set image.tag=${{ github.sha }} \
              --namespace staging
          done
```

### Key Design Decisions

```
1. Monorepo: Shared libraries are co-located and versioned together
   → Atomic changes across service + library

2. Path-based filtering: Only build/test what changed
   → 100 PRs/day but each PR only triggers 1-2 service pipelines

3. Self-hosted runners: Large cache, faster builds
   → 8-core runners with persistent Docker cache

4. Shared CI templates: Reusable workflow files
   → New service pipeline = 10 lines of YAML

5. Service ownership (CODEOWNERS):
   /services/user-service/ @team-identity
   /services/payment-service/ @team-payments
   → Right team reviews the right code
```

**Why interviewer asks this:** Scaling CI/CD is a real challenge as organizations grow.

**Follow-up:** *How do you handle breaking changes in shared libraries?*

1. **Semantic versioning** for shared libs
2. **Backward compatibility** - new versions must not break existing consumers
3. **Deprecation cycle** - mark old APIs deprecated, give teams time to migrate
4. Run **affected service tests** when a shared lib changes (the path filter handles this)

---

## Q7. How do you perform zero-downtime database migrations?

**Answer:**

### The Expand-Contract Pattern

```
Phase 1: EXPAND (backward compatible)
─────────────────────────────────────
  - Add new column/table (don't remove old)
  - Old code continues to work
  - New code writes to both old and new

Phase 2: MIGRATE
─────────────────
  - Deploy code that uses new schema
  - Backfill old data to new format
  - Both schemas exist simultaneously

Phase 3: CONTRACT (cleanup)
───────────────────────────
  - Remove old column/table
  - Remove backward-compatibility code
```

### Example: Renaming a Column

```
Goal: Rename "name" column to "full_name" in users table

Step 1: Add new column (expand)
  ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

Step 2: Deploy code that writes to BOTH columns
  INSERT INTO users (name, full_name, ...) VALUES ($1, $1, ...);
  -- Reads from full_name with fallback to name

Step 3: Backfill existing data
  UPDATE users SET full_name = name WHERE full_name IS NULL;

Step 4: Deploy code that only uses full_name

Step 5: Drop old column (contract)
  ALTER TABLE users DROP COLUMN name;
```

### Example: Splitting a Table

```
Goal: Move 'address' fields from 'users' table to 'addresses' table

Step 1: Create new table
  CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    street VARCHAR(255),
    city VARCHAR(255),
    ...
  );

Step 2: Deploy code that writes to BOTH tables
  -- On user creation: insert into users AND addresses
  -- On read: join or read from addresses with fallback to users

Step 3: Backfill
  INSERT INTO addresses (user_id, street, city)
  SELECT id, street, city FROM users WHERE street IS NOT NULL;

Step 4: Deploy code that only reads from addresses

Step 5: Drop columns from users table
  ALTER TABLE users DROP COLUMN street, DROP COLUMN city;
```

### Migration Safety Rules

```
SAFE operations (no downtime):
  ✓ ADD COLUMN (nullable or with default)
  ✓ CREATE TABLE
  ✓ CREATE INDEX CONCURRENTLY (PostgreSQL)
  ✓ ADD CONSTRAINT (with NOT VALID, then VALIDATE separately)

UNSAFE operations (cause locks/downtime):
  ✗ DROP COLUMN (if code still references it)
  ✗ RENAME COLUMN (breaks existing queries)
  ✗ ADD NOT NULL constraint (full table scan)
  ✗ CREATE INDEX (without CONCURRENTLY - locks writes)
  ✗ ALTER COLUMN type (full table rewrite)
```

```sql
-- SAFE: Create index without locking writes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- SAFE: Add NOT NULL constraint in two steps
ALTER TABLE users ADD CONSTRAINT users_email_nn CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_email_nn;
-- NOT VALID: constraint added without checking existing rows (fast)
-- VALIDATE: checks existing rows in background (doesn't lock)
```

**Why interviewer asks this:** Database migrations are the most dangerous part of any deployment.

**Follow-up:** *A migration accidentally dropped a column with production data. How do you recover?*

1. **Immediate:** If you have point-in-time recovery (PITR) enabled on RDS/Cloud SQL, restore to a point before the migration
2. **If no PITR:** Restore from the most recent backup (you did take a backup before migrating, right?)
3. **Partial recovery:** If only one column was lost, create a new database from backup, extract just that column, and update production
4. **Prevention:** Always take a backup before migrations, use expand-contract pattern, never drop columns in the same deployment as the code change

---

## Q8. What is a service mesh and when do you need one?

**Answer:**

### The Problem

```
Without service mesh (20 microservices):
  - Each service implements its own:
    - TLS/mTLS
    - Retry logic
    - Circuit breaking
    - Tracing
    - Load balancing
  - 20 services × 5 concerns = 100 implementations to maintain
  - Different languages = different libraries for each
```

### What a Service Mesh Does

```
┌────────────────────────────────────────────────┐
│                Service Mesh                     │
│                                                 │
│  ┌─────────┐      ┌─────────┐                 │
│  │ Service A│      │ Service B│                 │
│  │ (code)   │      │ (code)   │                 │
│  └────┬─────┘      └────┬─────┘                │
│       │                  │                      │
│  ┌────▼─────┐      ┌────▼─────┐               │
│  │ Sidecar  │─mTLS─│ Sidecar  │               │
│  │ Proxy    │      │ Proxy    │               │
│  │ (Envoy)  │      │ (Envoy)  │               │
│  └──────────┘      └──────────┘               │
│                                                 │
│  Control Plane:                                 │
│  - Istiod (Istio) or Linkerd                   │
│  - Manages proxy configuration                 │
│  - Issues certificates                         │
│  - Collects telemetry                          │
└────────────────────────────────────────────────┘
```

The sidecar proxy handles all cross-cutting concerns **transparently** - the application code doesn't change.

### What it provides

| Feature | Without Mesh | With Mesh |
|---|---|---|
| **mTLS** | Each service implements TLS | Automatic, zero-code |
| **Retries** | Library in each service | Configured declaratively |
| **Circuit breaking** | Library in each service | Configured declaratively |
| **Tracing** | Manual instrumentation | Automatic span propagation |
| **Traffic splitting** | Custom load balancer | Declarative (canary, A/B) |
| **Rate limiting** | Custom middleware | Declarative per-service |
| **Observability** | Custom metrics | Automatic L7 metrics |

### Istio Traffic Management

```yaml
# Canary deployment: 90% to v1, 10% to v2
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api
spec:
  hosts:
    - api
  http:
    - route:
        - destination:
            host: api
            subset: v1
          weight: 90
        - destination:
            host: api
            subset: v2
          weight: 10
      retries:
        attempts: 3
        perTryTimeout: 2s
      timeout: 10s

---
# Circuit breaker
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api
spec:
  host: api
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 60s
      maxEjectionPercent: 50
```

### When You DON'T Need a Mesh

```
Skip the service mesh if:
  - You have < 5 services
  - All services use the same language
  - You don't need mTLS (internal VPC is sufficient)
  - The operational complexity isn't justified
  - Your team doesn't have K8s expertise yet

The mesh adds: CPU overhead (15-20%), memory per pod (~50MB sidecar),
  operational complexity, and debugging difficulty.
```

**Why interviewer asks this:** Service mesh is a senior-level architecture decision.

**Follow-up:** *What's the difference between Istio and Linkerd?*

- **Istio**: More features (traffic management, security policies, extensibility via Wasm), but more complex and resource-heavy
- **Linkerd**: Simpler, lighter, easier to operate, fewer features but covers 90% of use cases. Rust-based proxy (smaller footprint)

---

## Q9. Walk through a production incident from detection to postmortem.

**Answer:**

### Timeline of a Real Incident

```
14:30  DETECTION
       Prometheus alert fires: "Error rate > 5% for 5 minutes"
       PagerDuty pages on-call engineer

14:32  ACKNOWLEDGEMENT
       On-call engineer acknowledges alert
       Opens incident channel in Slack: #incident-2024-01-15

14:35  TRIAGE
       Check dashboards → 30% of requests returning 500
       Check recent deployments → Deploy at 14:25 (5 minutes before alert)
       Hypothesis: The deployment caused it

14:38  MITIGATION
       Rollback deployment:
       $ kubectl rollout undo deployment/api -n production
       $ kubectl rollout status deployment/api -n production

14:42  VERIFICATION
       Error rate dropping → back to <1% by 14:45
       Status page updated: "Incident resolved"

14:45  COMMUNICATION
       Post in Slack: "Incident resolved. Rolled back deploy abc123.
       Root cause investigation ongoing. No data loss."
```

### Postmortem Template

```markdown
# Incident Report: API Error Rate Spike - 2024-01-15

## Summary
A deployment at 14:25 UTC caused 30% of API requests to return 500 errors
for approximately 15 minutes. The deployment was rolled back at 14:38 UTC.

## Impact
- Duration: 15 minutes
- Users affected: ~2,000 (estimated from error count)
- Revenue impact: ~$500 in failed transactions
- SLA impact: 99.95% → 99.92% (below 99.95% target)

## Timeline
| Time (UTC) | Event |
|---|---|
| 14:25 | Deploy commit abc123 to production |
| 14:30 | Alert: error rate > 5% |
| 14:32 | On-call acknowledged |
| 14:35 | Identified recent deploy as likely cause |
| 14:38 | Initiated rollback |
| 14:42 | Error rate returned to normal |
| 14:45 | Incident closed |

## Root Cause
The deployment included a database migration that added a NOT NULL constraint
to the `users.email` column. Approximately 3,000 legacy users had NULL email
addresses, causing all queries involving those users to fail with a
constraint violation error.

## What Went Well
- Alert fired within 5 minutes of issue start
- Rollback completed in 4 minutes
- Clear incident communication

## What Went Wrong
- Migration was not tested against production-like data
- No canary deployment - 100% of traffic hit the new version immediately
- Staging database didn't have NULL email records

## Action Items
| Action | Owner | Due |
|---|---|---|
| Add production data sampling to staging DB refresh | @dbadmin | Jan 22 |
| Implement canary deployments for API service | @devops | Jan 29 |
| Add migration safety checker to CI pipeline | @platform | Feb 5 |
| Backfill NULL emails for legacy users | @backend | Jan 19 |
```

### Incident Severity Levels

```
SEV1 (Critical):
  - Complete service outage
  - Data loss/corruption
  - Security breach
  Response: All hands, war room, exec notification

SEV2 (Major):
  - Partial outage (>10% users affected)
  - Significant performance degradation
  Response: On-call + escalation to team lead

SEV3 (Minor):
  - Small impact (<10% users)
  - Workaround available
  Response: On-call addresses during business hours

SEV4 (Low):
  - No user impact
  - Internal tooling issue
  Response: Normal priority ticket
```

### Blameless Postmortem Culture

```
BAD:
  "John pushed a bad deploy. John should be more careful."
  (Blame the person → people hide mistakes → culture of fear)

GOOD:
  "The system allowed a migration with a NOT NULL constraint to reach
   production without being validated against production-like data."
  (Blame the system → fix the system → prevents recurrence)

Key principle: If a human can make a mistake that causes an outage,
              the system should prevent that mistake.
```

**Why interviewer asks this:** Incident management is a core SRE/DevOps competency.

**Follow-up:** *How do you prevent the same incident from happening again?*

Focus on **systemic fixes**, not process fixes:
- **Don't:** "Engineers must be more careful with migrations" (process fix - will fail)
- **Do:** "CI pipeline automatically checks migrations for unsafe operations" (systemic fix - enforced by tooling)

---

## Q10. Design the complete infrastructure for an e-commerce platform handling 100K concurrent users.

**Answer:**

### Requirements

```
Functional:
- Product catalog (10M products)
- User accounts and authentication
- Shopping cart
- Order processing and payment
- Search with filters
- Admin dashboard
- Email notifications

Non-functional:
- 100K concurrent users
- 99.99% availability (52 min downtime/year)
- < 200ms P95 latency for reads
- < 500ms P95 latency for writes
- Handle 10x traffic spikes (flash sales)
```

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                           CloudFront CDN                            │
│  Static assets, product images, cached API responses               │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                       AWS WAF + Shield                              │
│  DDoS protection, rate limiting, SQL injection blocking            │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                   Application Load Balancer                         │
│                                                                     │
│  /api/products/*  → Product Service                                │
│  /api/cart/*      → Cart Service                                   │
│  /api/orders/*    → Order Service                                  │
│  /api/auth/*      → Auth Service                                   │
│  /api/search/*    → Search Service                                 │
│  /admin/*         → Admin Service                                  │
│  /*               → Frontend (Next.js)                             │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                      EKS Cluster (Multi-AZ)                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │ Product Service  │ Cart Service │ Order Service         │      │
│  │ (10 pods, HPA)   │ (5 pods)     │ (5 pods)             │      │
│  │ Read-heavy       │ Redis-backed │ Event-driven          │      │
│  │ Cached           │ Fast ops     │ Async processing     │      │
│  ├──────────────────┼──────────────┼──────────────────────┤      │
│  │ Auth Service     │ Search Svc   │ Notification Service │      │
│  │ (3 pods)         │ (3 pods)     │ (3 pods, workers)    │      │
│  │ JWT + sessions   │ Elasticsearch│ Email/SMS            │      │
│  ├──────────────────┼──────────────┼──────────────────────┤      │
│  │ Frontend (SSR)   │ Admin API    │ Payment Service      │      │
│  │ Next.js (5 pods) │ (2 pods)     │ (3 pods, Stripe)    │      │
│  └──────────────────┴──────────────┴──────────────────────┘      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │              Message Queue (Amazon SQS / RabbitMQ)       │      │
│  │                                                          │      │
│  │  order-placed → Payment processing                       │      │
│  │  payment-confirmed → Inventory update                    │      │
│  │  order-shipped → Email notification                     │      │
│  └─────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                       Data Layer                                    │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │ Aurora          │  │ ElastiCache    │  │ Elasticsearch     │   │
│  │ PostgreSQL      │  │ (Redis)        │  │                   │   │
│  │                 │  │                │  │ Product search    │   │
│  │ Primary + 2     │  │ Cluster mode   │  │ Full-text         │   │
│  │ read replicas   │  │ 3 shards       │  │ Faceted filters   │   │
│  │                 │  │                │  │                   │   │
│  │ Users, orders,  │  │ Sessions,      │  │ Inverted index    │   │
│  │ products,       │  │ cart,          │  │ of all products   │   │
│  │ inventory       │  │ rate limits,   │  │                   │   │
│  │                 │  │ product cache  │  │                   │   │
│  └────────────────┘  └────────────────┘  └───────────────────┘   │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐                           │
│  │ S3              │  │ DynamoDB       │                           │
│  │ Product images  │  │ Cart data      │                           │
│  │ Static assets   │  │ (key-value,    │                           │
│  │ Backups         │  │  auto-scale)   │                           │
│  └────────────────┘  └────────────────┘                           │
└────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                      Observability                                  │
│                                                                     │
│  Prometheus → Grafana (metrics & dashboards)                       │
│  Fluent Bit → Elasticsearch → Kibana (logs)                       │
│  AWS X-Ray / Jaeger (distributed tracing)                          │
│  PagerDuty (alerting & on-call)                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Scaling Strategy for Flash Sales

```
Normal traffic: 10K concurrent users
Flash sale:     100K concurrent users (10x spike)

Preparation (24 hours before):
1. Pre-scale: Set minimum replicas to 3x normal
2. Warm up caches: Pre-populate Redis with sale products
3. Pre-scale database: Increase read replicas from 2 to 5
4. Enable queue-based ordering: Orders go through SQS queue
5. Prepare static fallback: If site crashes, serve static page

During sale:
1. HPA scales pods based on CPU/request rate
2. Cluster Autoscaler adds EC2 nodes if pods can't be scheduled
3. Redis absorbs read traffic (cache hit rate > 95%)
4. SQS absorbs write bursts (order processing is async)
5. CloudFront serves cached product pages

After sale:
1. Auto-scaling brings capacity back down
2. Async order processing continues until queue is drained
3. Send order confirmation emails
```

### Cost Estimate

```
EKS Control Plane:      $73/month
EC2 Nodes (10 × m5.xl): $1,500/month
Aurora (Multi-AZ):       $800/month
ElastiCache (3 nodes):   $400/month
Elasticsearch (3 nodes): $500/month
ALB:                     $200/month
CloudFront:              $300/month
S3:                      $50/month
NAT Gateway:             $100/month
Monitoring:              $200/month
──────────────────────────────────
Total:                  ~$4,100/month

With reserved instances: ~$2,800/month (32% savings)
```

### Infrastructure as Code

```bash
# Everything managed through Terraform + Helm

# Infrastructure (Terraform)
terraform/
├── modules/
│   ├── vpc/
│   ├── eks/
│   ├── rds/
│   ├── elasticache/
│   └── elasticsearch/
├── environments/
│   ├── staging/
│   └── production/
└── main.tf

# Application (Helm + ArgoCD)
k8s-manifests/
├── base/
│   ├── product-service/
│   ├── order-service/
│   └── ...
├── staging/
└── production/
```

### Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Container orchestration | EKS (Kubernetes) | Team expertise, ecosystem, portability |
| Database | Aurora PostgreSQL | Multi-AZ, read replicas, managed |
| Cache | Redis (ElastiCache) | Fast reads, session storage, pub/sub |
| Search | Elasticsearch | Full-text search, faceted filtering |
| Queue | SQS | Managed, auto-scaling, no ops overhead |
| CDN | CloudFront | Integrated with S3, global edge |
| Deployment | ArgoCD (GitOps) | Audit trail, self-healing, declarative |
| Monitoring | Prometheus + Grafana | Industry standard, powerful PromQL |
| CI/CD | GitHub Actions | Integrated with repo, scalable runners |

**Why interviewer asks this:** This is the ultimate system design question - tests everything from compute to data to observability.

**Follow-up:** *What's the single most important thing to get right in this architecture?*

**Caching strategy.** At 100K concurrent users, you can't afford to hit the database for every request. Redis caching with proper invalidation (TTL + event-based) is what makes the difference between a system that handles 100K users and one that falls over at 10K. If your cache hit rate is >95%, your database load is manageable. If it's <80%, you'll need 5x the database capacity (and cost).

---

## Appendix: Quick Reference - Kubernetes Commands

```bash
# ──── Cluster ────
kubectl cluster-info
kubectl get nodes -o wide
kubectl top nodes

# ──── Deployments ────
kubectl get deployments -A
kubectl describe deployment <name>
kubectl scale deployment <name> --replicas=5
kubectl rollout status deployment <name>
kubectl rollout history deployment <name>
kubectl rollout undo deployment <name>

# ──── Pods ────
kubectl get pods -o wide
kubectl describe pod <name>
kubectl logs <pod> -f --tail=100
kubectl exec -it <pod> -- sh
kubectl top pods
kubectl delete pod <name>

# ──── Services & Networking ────
kubectl get svc,ingress
kubectl port-forward svc/<name> 8080:80

# ──── Config ────
kubectl get configmaps,secrets
kubectl create secret generic my-secret --from-literal=key=value

# ──── Debugging ────
kubectl get events --sort-by='.lastTimestamp'
kubectl describe node <name> | grep -A5 "Conditions"
kubectl run debug --image=busybox -it --rm -- sh
```

---

*This completes the 7-part DevOps + Docker interview preparation guide. Master these 70 questions and you'll be prepared for any DevOps interview - from startup to FAANG.*

*← Back to [01 - DevOps Fundamentals](./01-devops-fundamentals.md)*
