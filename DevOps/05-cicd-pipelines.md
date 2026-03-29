# CI/CD Pipelines & Automation - Interview Preparation

> Section 5 of 7 - Pipeline design, GitHub Actions, GitLab CI, deployment strategies, rollbacks, and artifact management.

---

## Table of Contents

1. [Pipeline Design Principles](#q1-what-makes-a-good-cicd-pipeline)
2. [GitHub Actions Deep Dive](#q2-write-a-complete-production-github-actions-pipeline)
3. [GitLab CI/CD](#q3-write-the-equivalent-pipeline-in-gitlab-ci)
4. [Deployment Strategies](#q4-explain-the-different-deployment-strategies)
5. [Rollback Strategies](#q5-how-do-you-implement-rollbacks)
6. [Environment Management](#q6-how-do-you-manage-multiple-environments-in-cicd)
7. [Secrets Management in CI/CD](#q7-how-do-you-handle-secrets-in-cicd-pipelines)
8. [Artifact Management](#q8-what-is-artifact-management-and-why-does-it-matter)
9. [Pipeline Optimization](#q9-how-do-you-optimize-pipeline-speed)
10. [Debugging Failed Pipelines](#q10-debugging-scenario-your-pipeline-passes-locally-but-fails-in-ci)

---

## Q1. What makes a good CI/CD pipeline?

**Answer:**

### The Core Principles

```
A good pipeline is:

FAST        → Developers shouldn't wait more than 10 minutes
RELIABLE    → Same code + same pipeline = same result (deterministic)
INFORMATIVE → Clear feedback on what failed and why
SECURE      → Doesn't leak secrets, scans for vulnerabilities
INCREMENTAL → Only runs what's needed (caching, conditional jobs)
```

### Pipeline Stages (Standard Order)

```
┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
│  Build   │──►│   Test   │──►│  Scan    │──►│ Package │──►│  Deploy  │
│          │   │          │   │          │   │         │   │          │
│ Compile  │   │ Unit     │   │ SAST     │   │ Docker  │   │ Staging  │
│ Deps     │   │ Integ    │   │ SCA      │   │ Image   │   │ Prod     │
│ Lint     │   │ E2E      │   │ Secrets  │   │ Helm    │   │          │
└─────────┘   └──────────┘   └──────────┘   └─────────┘   └──────────┘
     │              │              │               │             │
     ▼              ▼              ▼               ▼             ▼
   < 2min        < 5min        < 3min          < 2min        < 5min
                                                        Total: < 15min
```

### What each stage validates

| Stage | Gate | Failure Means |
|---|---|---|
| **Build** | Code compiles, dependencies resolve | Syntax error, missing dependency |
| **Lint** | Code follows standards | Style violation, potential bugs |
| **Unit Test** | Business logic correct | Bug in application code |
| **Integration Test** | Components work together | API contract broken, DB schema mismatch |
| **Security Scan** | No known vulnerabilities | CVE in dependency, SQL injection in code |
| **Package** | Artifact builds successfully | Docker build error, missing files |
| **Deploy Staging** | App runs in staging | Configuration error, infra issue |
| **Smoke Test** | Critical paths work in staging | Feature broken in real environment |
| **Deploy Production** | App runs in production | (Hopefully never fails at this point) |

### Pipeline Anti-patterns

```
BAD:
❌ Pipeline takes 45 minutes
❌ Flaky tests that randomly fail
❌ No caching (fresh install every time)
❌ Deploys directly to production (no staging)
❌ Secrets hardcoded in pipeline config
❌ No artifact versioning
❌ Manual steps that aren't documented

GOOD:
✓ Pipeline completes in < 15 minutes
✓ Tests are deterministic
✓ Dependencies cached between runs
✓ Progressive deployment (staging → prod)
✓ Secrets from vault/environment
✓ Every artifact has a unique version (git SHA)
✓ Fully automated, documented, reproducible
```

**Why interviewer asks this:** Tests whether you can design a pipeline, not just use one someone else built.

**Follow-up:** *What's the most important metric for a CI/CD pipeline?*

**Lead time** - the time from code push to running in production. If this is under 1 hour, your pipeline is effective. If it's over a day, something is wrong. Secondary metrics: pipeline success rate (should be >95%), flaky test rate (should be <1%), and cost per build.

---

## Q2. Write a complete production GitHub Actions pipeline.

**Answer:**

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

# Cancel in-progress runs for the same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}
  NODE_VERSION: '20'

jobs:
  # ═══════════════ Stage 1: Quality Checks ═══════════════
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

  # ═══════════════ Stage 2: Tests (parallel) ═══════════════
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm test -- --coverage --ci

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb

      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  # ═══════════════ Stage 3: Security ═══════════════
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Dependency audit
        run: npm audit --audit-level=high

      - name: SAST scan
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript

  # ═══════════════ Stage 4: Build & Push ═══════════════
  build-and-push:
    name: Build & Push Image
    needs: [lint-and-typecheck, unit-tests, integration-tests, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    permissions:
      contents: read
      packages: write

    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          exit-code: 1
          severity: CRITICAL

  # ═══════════════ Stage 5: Deploy Staging ═══════════════
  deploy-staging:
    name: Deploy to Staging
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          kubectl set image deployment/api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace staging
        env:
          KUBECONFIG_DATA: ${{ secrets.KUBE_CONFIG_STAGING }}

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/api --namespace staging --timeout=300s

      - name: Smoke tests
        run: |
          sleep 10
          curl -f https://staging.example.com/health || exit 1

  # ═══════════════ Stage 6: Deploy Production ═══════════════
  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production          # ← Requires manual approval in GitHub settings
      url: https://example.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          kubectl set image deployment/api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace production
        env:
          KUBECONFIG_DATA: ${{ secrets.KUBE_CONFIG_PRODUCTION }}

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/api --namespace production --timeout=300s

      - name: Production smoke test
        run: |
          sleep 15
          curl -f https://example.com/health || exit 1

      - name: Notify team
        if: always()
        run: |
          STATUS=${{ job.status }}
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"Production deploy ${STATUS}: ${{ github.sha }}\"}"
```

### Key Design Decisions Explained

```
1. Concurrency control: cancels previous runs on same branch
   → Saves CI minutes, shows latest results only

2. Service containers: Postgres + Redis for integration tests
   → Tests run against real databases, not mocks

3. Cache: npm cache + Docker layer cache (type=gha)
   → Builds go from 5min to ~90 seconds

4. Environment protection: production requires manual approval
   → Prevents accidental production deploys

5. Image scanning after build: fails on CRITICAL vulnerabilities
   → Never deploys a known-vulnerable image

6. Smoke tests after deploy: verifies the deployment actually works
   → Catches configuration issues that tests can't
```

**Why interviewer asks this:** Writing production pipelines is core DevOps work.

**Follow-up:** *How do you handle monorepo CI where you have multiple services but only want to build/deploy changed ones?*

Use **path-based triggers** and **conditional jobs**:

```yaml
on:
  push:
    paths:
      - 'services/api/**'
      - 'libs/shared/**'

# Or use dorny/paths-filter action for per-job filtering
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      api:
        - 'services/api/**'
      web:
        - 'services/web/**'

- name: Build API
  if: steps.changes.outputs.api == 'true'
  run: docker build services/api
```

---

## Q3. Write the equivalent pipeline in GitLab CI.

**Answer:**

```yaml
# .gitlab-ci.yml
stages:
  - quality
  - test
  - security
  - build
  - deploy-staging
  - deploy-production

variables:
  REGISTRY: registry.gitlab.com/$CI_PROJECT_PATH
  NODE_VERSION: "20"
  DOCKER_BUILDKIT: "1"

# ─────── Shared cache configuration ───────
.node-cache: &node-cache
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
    policy: pull

.node-setup: &node-setup
  image: node:${NODE_VERSION}-alpine
  before_script:
    - npm ci --cache .npm --prefer-offline
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
      - node_modules/

# ═══════════════ Stage: Quality ═══════════════
lint:
  stage: quality
  <<: *node-setup
  script:
    - npm run lint
    - npx tsc --noEmit
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"

# ═══════════════ Stage: Test ═══════════════
unit-tests:
  stage: test
  <<: *node-setup
  script:
    - npm test -- --coverage --ci
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  coverage: '/All files\s*\|\s*(\d+\.?\d*)\%/'

integration-tests:
  stage: test
  <<: *node-setup
  services:
    - name: postgres:16-alpine
      alias: postgres
      variables:
        POSTGRES_DB: testdb
        POSTGRES_USER: testuser
        POSTGRES_PASSWORD: testpass
    - name: redis:7-alpine
      alias: redis
  variables:
    DATABASE_URL: "postgresql://testuser:testpass@postgres:5432/testdb"
    REDIS_URL: "redis://redis:6379"
  script:
    - npm run db:migrate
    - npm run test:integration

# ═══════════════ Stage: Security ═══════════════
dependency-scan:
  stage: security
  <<: *node-setup
  script:
    - npm audit --audit-level=high
  allow_failure: true   # Don't block pipeline, but report

container-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity CRITICAL $REGISTRY:$CI_COMMIT_SHORT_SHA
  needs: ["build-image"]

# ═══════════════ Stage: Build ═══════════════
build-image:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build
        --cache-from $REGISTRY:latest
        --tag $REGISTRY:$CI_COMMIT_SHORT_SHA
        --tag $REGISTRY:latest
        .
    - docker push $REGISTRY:$CI_COMMIT_SHORT_SHA
    - docker push $REGISTRY:latest
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# ═══════════════ Stage: Deploy Staging ═══════════════
deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context staging
    - kubectl set image deployment/api api=$REGISTRY:$CI_COMMIT_SHORT_SHA -n staging
    - kubectl rollout status deployment/api -n staging --timeout=300s
    - "curl -f https://staging.example.com/health || exit 1"
  environment:
    name: staging
    url: https://staging.example.com
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# ═══════════════ Stage: Deploy Production ═══════════════
deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context production
    - kubectl set image deployment/api api=$REGISTRY:$CI_COMMIT_SHORT_SHA -n production
    - kubectl rollout status deployment/api -n production --timeout=300s
  environment:
    name: production
    url: https://example.com
  when: manual   # ← Manual approval gate
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

**Why interviewer asks this:** Many companies use GitLab. Knowing both GitHub Actions and GitLab CI shows breadth.

**Follow-up:** *What are the key differences between GitHub Actions and GitLab CI?*

| Feature | GitHub Actions | GitLab CI |
|---|---|---|
| Config file | `.github/workflows/*.yml` | `.gitlab-ci.yml` (single file) |
| Runner | GitHub-hosted or self-hosted | GitLab runners (shared/specific) |
| Caching | `actions/cache` or built-in | Keyword-based cache config |
| Secrets | Repository/Org secrets | CI/CD variables |
| Services | `services` keyword in job | `services` keyword in job |
| Artifacts | `actions/upload-artifact` | `artifacts` keyword |
| Environments | Environment protection rules | `environment` + `when: manual` |
| Marketplace | 15,000+ reusable actions | Templates + includes |

---

## Q4. Explain the different deployment strategies.

**Answer:**

### 1. Recreate (Big Bang)

```
Old version ████████████ → STOP → ████████████ New version
                              ↑
                         Downtime window
```

- **How:** Stop all old instances, start all new instances
- **Downtime:** Yes (could be seconds to minutes)
- **Rollback:** Redeploy old version (slow)
- **Use when:** Acceptable downtime windows (e.g., nightly maintenance), incompatible database migrations

### 2. Rolling Update

```
Time 0:  [v1] [v1] [v1] [v1]
Time 1:  [v2] [v1] [v1] [v1]  ← 1 instance updated
Time 2:  [v2] [v2] [v1] [v1]  ← 2 instances updated
Time 3:  [v2] [v2] [v2] [v1]  ← 3 instances updated
Time 4:  [v2] [v2] [v2] [v2]  ← Complete!
```

- **How:** Replace instances one by one
- **Downtime:** Zero (some instances always running)
- **Rollback:** Reverse the rolling update
- **Risk:** Both versions run simultaneously - must be backward compatible

```yaml
# Kubernetes rolling update
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1    # At most 1 pod down at a time
      maxSurge: 1          # At most 1 extra pod during update
```

### 3. Blue-Green Deployment

```
           Load Balancer
              │
    ┌─────────┴─────────┐
    │                    │
    ▼                    ▼
┌────────┐         ┌────────┐
│ BLUE   │         │ GREEN  │
│ (v1)   │ ◄──┐   │ (v2)   │
│ LIVE   │    │   │ IDLE   │
└────────┘    │   └────────┘
              │
              │ After verification, switch:
              │
┌────────┐    │   ┌────────┐
│ BLUE   │    └──►│ GREEN  │
│ (v1)   │        │ (v2)   │
│ IDLE   │        │ LIVE   │
└────────┘        └────────┘
```

- **How:** Run two identical environments. Deploy to idle, test, then switch traffic
- **Downtime:** Zero (instant switch)
- **Rollback:** Switch traffic back to old environment (instant)
- **Cost:** 2x infrastructure during deployment
- **Best for:** Critical applications where instant rollback is required

### 4. Canary Deployment

```
Time 0:  Traffic: 100% → [v1] [v1] [v1] [v1]

Time 1:  Traffic:  95% → [v1] [v1] [v1]
                    5% → [v2]              ← Canary (small % of traffic)

Time 2:  Monitor canary metrics...
          Error rate OK? Latency OK? → Proceed
          Problems? → Kill canary, 100% back to v1

Time 3:  Traffic:  50% → [v1] [v1]
                   50% → [v2] [v2]

Time 4:  Traffic: 100% → [v2] [v2] [v2] [v2]  ← Complete!
```

- **How:** Route small % of traffic to new version, gradually increase
- **Downtime:** Zero
- **Rollback:** Route 100% back to old version
- **Monitoring:** Must compare metrics between canary and baseline
- **Best for:** Large-scale services where you want to validate with real traffic

### 5. A/B Testing Deployment

Like canary but routes based on **user attributes**, not random traffic:

```
Route based on:
  - User ID (users 1-1000 → v2, rest → v1)
  - Geography (US → v2, EU → v1)
  - Header (X-Feature: new → v2)
  - Cookie (ab-test=b → v2)
```

### Comparison Table

| Strategy | Downtime | Rollback Speed | Cost | Complexity | Risk |
|---|---|---|---|---|---|
| Recreate | Yes | Slow (redeploy) | Low | Low | High |
| Rolling | No | Medium | Low | Medium | Medium |
| Blue-Green | No | Instant (switch) | 2x infra | Medium | Low |
| Canary | No | Instant (route) | Low | High | Lowest |

**Why interviewer asks this:** Deployment strategy choice is a critical architectural decision.

**Follow-up:** *You're deploying a breaking database migration. Which strategy works?*

None of the zero-downtime strategies work with breaking changes. You must use the **expand-contract pattern**:
1. **Expand:** Add new column/table (backward compatible with v1)
2. **Migrate:** Deploy v2 that writes to both old and new, reads from new
3. **Backfill:** Copy data from old to new format
4. **Contract:** Deploy v3 that only uses new format, drop old column

---

## Q5. How do you implement rollbacks?

**Answer:**

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/api

# Rollback to previous version
kubectl rollout undo deployment/api

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=3

# Check rollout status
kubectl rollout status deployment/api
```

### Docker-based Rollback (without Kubernetes)

```bash
# Images are immutable - previous version still exists in registry
# Rollback = deploy the previous image tag

# Option 1: Redeploy previous SHA
docker pull registry.example.com/api:abc123    # Previous version
docker stop api && docker rm api
docker run -d --name api -p 3000:3000 registry.example.com/api:abc123

# Option 2: Docker Compose with version pinning
# Change image tag in docker-compose.yml and redeploy
docker compose up -d
```

### Automated Rollback in CI/CD

```yaml
# GitHub Actions - automatic rollback on failed smoke test
deploy-production:
  steps:
    - name: Save current version
      id: current
      run: |
        echo "revision=$(kubectl rollout history deployment/api -n prod --no-headers | tail -1 | awk '{print $1}')" >> $GITHUB_OUTPUT

    - name: Deploy new version
      run: |
        kubectl set image deployment/api api=$REGISTRY:${{ github.sha }} -n prod
        kubectl rollout status deployment/api -n prod --timeout=300s

    - name: Smoke test
      id: smoke
      run: |
        sleep 15
        curl -f https://example.com/health
        curl -f https://example.com/api/v1/status

    - name: Rollback on failure
      if: failure() && steps.smoke.outcome == 'failure'
      run: |
        echo "Smoke test failed! Rolling back..."
        kubectl rollout undo deployment/api -n prod
        kubectl rollout status deployment/api -n prod --timeout=300s

        # Alert team
        curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
          -d '{"text":"ROLLBACK: Production deploy failed and was reverted automatically"}'
```

### Database Rollback Strategy

```bash
# Database migrations should be reversible
# Every migration has an UP and DOWN

# Prisma
npx prisma migrate deploy    # Apply migrations
# Rollback: manually - Prisma doesn't auto-rollback

# Flyway
flyway migrate               # Apply
flyway undo                   # Rollback (requires undo scripts)

# Best practice: ALWAYS write reversible migrations
# And ALWAYS back up the database before migrations
pg_dump -h db.example.com -U admin mydb > pre-deploy-backup.sql
```

**Why interviewer asks this:** Rollbacks are your safety net. Slow or broken rollbacks mean extended outages.

**Follow-up:** *What's the difference between a rollback and a rollforward?*

- **Rollback:** Revert to the previous version. Fast but loses new features.
- **Rollforward:** Fix the bug and deploy a new version forward. Preserves new features but requires fast CI/CD.

Elite teams prefer rollforward because it's faster than debugging old code. But you still need rollback capability as a safety net for critical failures.

---

## Q6. How do you manage multiple environments in CI/CD?

**Answer:**

### Environment Hierarchy

```
Feature Branch → PR Preview → Development → Staging → Production

Feature Branch:
  - Auto-deployed per PR (preview environments)
  - Destroyed when PR is merged/closed

Development:
  - Latest from 'develop' branch
  - Unstable, shared by team
  - May use shared databases

Staging:
  - Mirror of production
  - Same config, same infrastructure
  - Uses anonymized production data
  - Final validation before production

Production:
  - Customer-facing
  - Protected by approval gates
  - Monitored and alerted
```

### Environment-specific Configuration

```yaml
# GitHub Actions - using environments
jobs:
  deploy:
    strategy:
      matrix:
        environment: [staging, production]
    environment:
      name: ${{ matrix.environment }}
    steps:
      - name: Deploy
        run: |
          kubectl apply -f k8s/${{ matrix.environment }}/ --namespace ${{ matrix.environment }}
```

### Configuration Management Pattern

```
config/
├── base/                    # Shared configuration
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── staging/                 # Staging overrides
│   ├── kustomization.yaml
│   ├── replica-count.yaml   # replicas: 2
│   └── configmap-patch.yaml # staging URLs
└── production/              # Production overrides
    ├── kustomization.yaml
    ├── replica-count.yaml   # replicas: 5
    └── configmap-patch.yaml # production URLs
```

```yaml
# config/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../base
patchesStrategicMerge:
  - replica-count.yaml
  - configmap-patch.yaml
namespace: staging
```

### Environment Variables Per Environment

```bash
# .env.staging
DATABASE_URL=postgresql://staging-db.internal:5432/mydb
REDIS_URL=redis://staging-redis.internal:6379
LOG_LEVEL=debug
API_URL=https://staging-api.example.com

# .env.production
DATABASE_URL=postgresql://prod-db.internal:5432/mydb
REDIS_URL=redis://prod-redis.internal:6379
LOG_LEVEL=warn
API_URL=https://api.example.com
```

**Why interviewer asks this:** Multi-environment management is daily work for DevOps engineers.

**Follow-up:** *How do you ensure staging is truly representative of production?*

1. **Same infrastructure code** - Terraform modules parameterized by environment, not separate configs
2. **Same Docker images** - same image, different config (env vars)
3. **Same Kubernetes manifests** - Kustomize overlays for environment-specific values only
4. **Production data copy** - anonymized production data loaded into staging weekly
5. **Same network topology** - staging has its own VPC but mirrors production's architecture

---

## Q7. How do you handle secrets in CI/CD pipelines?

**Answer:**

### The Problem

```
BAD - Secrets hardcoded (visible in Git history FOREVER):
  DATABASE_URL=postgresql://admin:password123@db.example.com:5432/prod

BAD - Secrets in CI config (visible to anyone with repo access):
  env:
    API_KEY: sk-secret-key-123

BAD - Secrets in Docker image:
  ENV SECRET_KEY=my-secret
  COPY .env /app/.env
```

### Solution 1: CI Platform Secrets

```yaml
# GitHub Actions - stored in Settings → Secrets → Actions
steps:
  - name: Deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_KEY: ${{ secrets.API_KEY }}
    run: ./deploy.sh

# Secrets are:
# - Encrypted at rest
# - Masked in logs (replaced with ***)
# - Only available to workflows in the repo
# - Environment-scoped (staging secrets vs production secrets)
```

### Solution 2: External Secret Manager

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id prod/api/database-url

# HashiCorp Vault
vault kv get secret/prod/api
# Returns: { "database_url": "postgresql://...", "api_key": "sk-..." }
```

```yaml
# CI pipeline fetches secrets at deploy time
- name: Fetch secrets from Vault
  run: |
    export VAULT_TOKEN=${{ secrets.VAULT_TOKEN }}
    export DATABASE_URL=$(vault kv get -field=database_url secret/prod/api)
    export API_KEY=$(vault kv get -field=api_key secret/prod/api)
    envsubst < k8s/deployment.yaml | kubectl apply -f -
```

### Solution 3: Kubernetes Secrets

```yaml
# Create secret in K8s (don't commit this file!)
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
data:
  database-url: cG9zdGdyZXNxbDovLy4uLg==  # base64 encoded
  api-key: c2stc2VjcmV0LWtleQ==

# Reference in deployment
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: api-secrets
        key: database-url
```

### Secret Rotation Strategy

```
1. Generate new secret (don't revoke old yet)
2. Update secret in Vault/Secrets Manager
3. Deploy application (reads new secret)
4. Verify application works with new secret
5. Revoke old secret
6. Audit logs to confirm no old-secret usage
```

### Secret Detection in CI

```yaml
# Pre-commit hook to catch secrets before they reach Git
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Why interviewer asks this:** Secret leaks are one of the most common and damaging security incidents.

**Follow-up:** *A developer committed an AWS access key to a public repo. Walk through the incident response.*

Covered in detail in [File 01 - Q10: DevSecOps](./01-devops-fundamentals.md#q10-what-is-devsecops). Key steps: **Revoke immediately**, check CloudTrail for unauthorized usage, remove from Git history with BFG, add prevention (pre-commit hooks, CI scanning).

---

## Q8. What is artifact management and why does it matter?

**Answer:**

An **artifact** is any build output: Docker images, JAR files, npm packages, compiled binaries, test reports.

### Why Artifact Management Matters

```
Without artifact management:
  Build #100: "which version is in production?" → "I think we deployed from develop... maybe"
  Bug reported: "can we reproduce with the exact binary?" → "We'd need to rebuild... hope it's the same"

With artifact management:
  Build #100: image myapp:abc123 (git SHA) → pushed to registry with metadata
  Bug reported: docker pull myapp:abc123 → exact same binary, reproduce instantly
```

### Docker Registry as Artifact Store

```bash
# Tag with git SHA (immutable identifier)
docker build -t myapp:$(git rev-parse --short HEAD) .
docker push registry.example.com/myapp:$(git rev-parse --short HEAD)

# Also tag with semantic version for releases
docker tag myapp:abc123 myapp:1.2.0
docker push registry.example.com/myapp:1.2.0
```

### Artifact Lifecycle

```
Build → Store → Deploy → Archive → Delete

Retention policies:
  - Production images: keep forever (or 1 year)
  - Staging images: keep 30 days
  - Feature branch images: keep 7 days
  - PR preview images: delete on PR close
```

```yaml
# GitHub Actions - upload test artifacts
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: |
      test-results/
      coverage/
    retention-days: 30
```

### Build Reproducibility

```bash
# Record exactly what went into a build
docker build \
  --label "git.sha=$GIT_SHA" \
  --label "git.branch=$GIT_BRANCH" \
  --label "build.number=$BUILD_NUMBER" \
  --label "build.timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t myapp:$GIT_SHA .

# Later, inspect to see build provenance
docker inspect myapp:abc123 --format '{{json .Config.Labels}}'
# {"git.sha":"abc123","git.branch":"main","build.number":"456","build.timestamp":"2024-01-15T10:30:00Z"}
```

**Why interviewer asks this:** Artifact management is critical for auditability, rollbacks, and debugging.

**Follow-up:** *What is an SBOM (Software Bill of Materials) and why is it becoming required?*

An SBOM is a complete list of components in your software (dependencies, their versions, licenses). It's increasingly required by regulations (US Executive Order on Cybersecurity). Generate with tools like `syft` or `trivy`:

```bash
syft myapp:1.0 -o spdx-json > sbom.json
# Lists every package, library, and OS component in the image
```

---

## Q9. How do you optimize pipeline speed?

**Answer:**

### 1. Parallel job execution

```yaml
# Run independent jobs simultaneously
jobs:
  lint:        # ─┐
    ...        #  │ All run in parallel
  unit-test:   #  │
    ...        #  │
  security:    # ─┘
    ...

  build:       # Runs after all above pass
    needs: [lint, unit-test, security]
```

### 2. Aggressive caching

```yaml
# Cache node_modules
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'     # Automatic npm cache

# Cache Docker layers
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max

# Cache test databases
# Use a pre-seeded database image instead of migrating every time
services:
  postgres:
    image: myapp-test-db:latest   # Pre-migrated, pre-seeded
```

### 3. Test splitting

```yaml
# Split tests across multiple runners
test:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - run: npx jest --shard=${{ matrix.shard }}/4
```

### 4. Skip unnecessary work

```yaml
# Only run relevant jobs based on changed files
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      backend:
        - 'api/**'
      frontend:
        - 'web/**'
      docs:
        - 'docs/**'

- name: Backend tests
  if: steps.changes.outputs.backend == 'true'
  run: npm test --prefix api

# Skip CI entirely for doc-only changes
- name: Skip CI
  if: steps.changes.outputs.docs == 'true' && steps.changes.outputs.backend == 'false' && steps.changes.outputs.frontend == 'false'
  run: echo "Only docs changed, skipping CI"
```

### 5. Use faster runners

```yaml
# Self-hosted runners with more resources
runs-on: self-hosted

# Or use larger GitHub-hosted runners
runs-on: ubuntu-latest-16-cores
```

### Impact Table

| Optimization | Typical Savings |
|---|---|
| Parallel jobs | 40-60% |
| Dependency caching | 30-50% |
| Docker layer caching | 50-80% |
| Test splitting (4 shards) | 60-75% |
| Path-based filtering | 100% (skipped) |
| Larger runners | 20-40% |

```
Before: Sequential pipeline, no caching = 25 minutes
After:  Parallel + cached + split = 6 minutes
```

**Why interviewer asks this:** Slow pipelines kill developer productivity and morale.

**Follow-up:** *Your pipeline has flaky tests that fail ~5% of the time. How do you handle this?*

1. **Don't retry** - retrying masks the problem
2. **Quarantine** - move flaky tests to a separate non-blocking job
3. **Track** - log every flaky test failure and create tickets
4. **Fix root causes** - usually: race conditions, time-dependent logic, shared state between tests, external service dependencies (mock them)
5. **Set a budget** - "No more than 1% of test runs should be flaky" - alert when exceeded

---

## Q10. Debugging scenario: Your pipeline passes locally but fails in CI.

**Answer:**

### Common Causes and Investigation

```
Cause 1: Different Node/Python/Go version
──────────────────────────────────────────
Local:  node v20.10.0
CI:     node v20.11.0 (different minor version)

Debug:
  $ node --version  # Check local
  # Check CI logs for version

Fix:
  # Pin exact version in CI
  - uses: actions/setup-node@v4
    with:
      node-version: '20.10.0'  # Not just '20'

  # Or use .nvmrc / .node-version file
  echo "20.10.0" > .node-version


Cause 2: Missing environment variables
───────────────────────────────────────
Local:  .env file loaded automatically
CI:     No .env file - variables must be set explicitly

Debug:
  # CI logs show: "Error: DATABASE_URL is not defined"

Fix:
  # Set in CI config
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}


Cause 3: Different OS (Mac vs Linux)
─────────────────────────────────────
Local:  macOS (case-insensitive filesystem)
CI:     Ubuntu (case-sensitive filesystem)

Debug:
  # CI error: "Cannot find module './Components/Header'"
  # File is actually './components/Header'
  # Works on Mac (case-insensitive), fails on Linux

Fix:
  # Rename file to match the import exactly


Cause 4: File permission differences
─────────────────────────────────────
Local:  chmod +x script.sh (execute permission set)
CI:     Permission not preserved in Git

Debug:
  $ git ls-files -s script.sh
  # 100644 = not executable, 100755 = executable

Fix:
  $ git update-index --chmod=+x script.sh
  $ git commit -m "Make script executable"


Cause 5: Timing / race conditions
──────────────────────────────────
Local:  Fast machine, tests pass quickly
CI:     Slower machine, timing-dependent tests fail

Debug:
  # Test passes locally but times out in CI
  # "Error: Timeout of 5000ms exceeded"

Fix:
  # Don't use setTimeout in tests
  # Use proper async/await patterns
  # Increase timeouts for CI: jest --testTimeout=30000


Cause 6: Network access differences
────────────────────────────────────
Local:  Can reach external APIs
CI:     Firewall blocks external access, or API rate-limits CI IPs

Debug:
  # CI error: "ECONNREFUSED" or "429 Too Many Requests"

Fix:
  # Mock external services in tests
  # Use recorded HTTP responses (nock, WireMock)
  # Set up API tokens specifically for CI
```

### The Debugging Workflow

```
1. Read the full error message carefully (not just "test failed")
2. Compare CI environment to local:
   - OS, runtime version, environment variables
3. Try to reproduce locally:
   - docker run -it ubuntu:22.04  → replicate CI environment
   - Run with same environment variables
4. Check CI-specific factors:
   - Clean checkout (no leftover files)
   - No global packages pre-installed
   - Different filesystem (case-sensitive)
5. Add debugging output:
   - Print environment variables (sanitized)
   - Print OS info: uname -a, node --version
   - Print directory contents: ls -la
```

**Why interviewer asks this:** "Works on my machine" is the most common DevOps problem. Debugging across environments is a core skill.

**Follow-up:** *How do you prevent "works locally, fails in CI" problems?*

1. **Dev containers** - develop inside the same Docker image used in CI
2. **Pre-commit hooks** - run linting and basic tests before push
3. **Consistent tooling** - `.nvmrc`, `.python-version`, `rust-toolchain.toml`
4. **CI-first mindset** - if it doesn't pass CI, it doesn't work (regardless of local results)

---

*Next: [06 - Cloud, Monitoring & Infrastructure →](./06-cloud-monitoring.md)*
