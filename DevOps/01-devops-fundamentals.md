# DevOps Fundamentals - Interview Preparation

> Section 1 of 7 - From zero to understanding the DevOps philosophy, lifecycle, and core practices.

---

## Table of Contents

1. [What is DevOps](#q1-what-is-devops-and-why-does-it-exist)
2. [DevOps Lifecycle](#q2-explain-the-devops-lifecycle-in-detail)
3. [CI vs CD vs CD](#q3-what-is-the-difference-between-ci-cd-continuous-delivery-and-cd-continuous-deployment)
4. [Infrastructure as Code](#q4-what-is-infrastructure-as-code-iac)
5. [Version Control & Git Workflows](#q5-explain-git-branching-strategies-used-in-devops)
6. [Agile & DevOps Culture](#q6-how-does-devops-relate-to-agile)
7. [Shift-Left Testing](#q7-what-is-shift-left-testing)
8. [DevOps Metrics](#q8-what-are-the-four-key-devops-metrics-dora-metrics)
9. [Configuration Management](#q9-what-is-configuration-management-and-how-does-it-differ-from-iac)
10. [DevSecOps](#q10-what-is-devsecops)

---

## Q1. What is DevOps and why does it exist?

**Answer:**

DevOps is a **cultural and technical practice** that unifies software development (Dev) and IT operations (Ops) to shorten the development lifecycle while delivering features, fixes, and updates **frequently, reliably, and at scale**.

### The Problem Before DevOps

```
Traditional Model (Siloed):

Developer writes code → "Throws it over the wall" → Ops team deploys
                     ↑                                    ↓
               "Works on my machine"              "Production is broken"
               (weeks/months cycle)               (blame game begins)
```

Teams had conflicting incentives:
- **Developers** wanted to ship fast (change is good)
- **Operations** wanted stability (change is risk)

### What DevOps Actually Is

DevOps is NOT a tool, a job title, or a team. It's a **set of practices** built on three pillars:

| Pillar | Meaning | Example |
|---|---|---|
| **Culture** | Shared ownership between dev and ops | Developers carry pagers for their own services |
| **Automation** | Automate everything repeatable | CI/CD pipelines, IaC, automated testing |
| **Measurement** | Measure everything, improve continuously | Deployment frequency, mean time to recovery |

### The CALMS Framework

```
C - Culture       (collaboration over silos)
A - Automation    (eliminate manual toil)
L - Lean          (small batches, fast feedback)
M - Measurement   (data-driven decisions)
S - Sharing       (knowledge sharing, blameless postmortems)
```

**Why interviewer asks this:** To check whether you understand DevOps as a philosophy, not just "using Docker and Jenkins." Candidates who list tools without mentioning culture and feedback loops are giving a surface-level answer.

**Follow-up:** *Can a company "do DevOps" without changing its organizational structure?*

No - tooling alone doesn't make DevOps. If developers and operations still sit in separate silos with separate goals, tickets passed between teams, and no shared responsibility for production, you have the same old model with newer tools. The core of DevOps is breaking down organizational barriers. Conway's Law applies: your architecture will mirror your team structure.

---

## Q2. Explain the DevOps lifecycle in detail.

**Answer:**

The DevOps lifecycle is an **infinite loop** of 8 phases, not a linear waterfall:

```
        ┌─── Plan ◄──────────────────── Monitor ───┐
        │                                            │
        ▼                                            │
      Code → Build → Test → Release → Deploy → Operate
        │                                            ▲
        └────────────────────────────────────────────┘
                     Continuous Feedback
```

### Phase Breakdown

| Phase | What Happens | Tools |
|---|---|---|
| **Plan** | Define features, track work, sprint planning | Jira, Linear, GitHub Issues |
| **Code** | Write code, peer review, branching | Git, GitHub, GitLab |
| **Build** | Compile, create artifacts, Docker images | Maven, npm, Docker build |
| **Test** | Unit tests, integration, security scans | Jest, Selenium, SonarQube |
| **Release** | Version tagging, changelog, approval | Semantic versioning, GitHub Releases |
| **Deploy** | Push to staging/production | Kubernetes, ArgoCD, Ansible |
| **Operate** | Infrastructure management, scaling | Terraform, AWS, Kubernetes |
| **Monitor** | Logs, metrics, alerts, incident response | Prometheus, Grafana, PagerDuty |

### The Feedback Loop

The critical insight: **monitoring feeds back into planning**. If monitoring detects high error rates after a deployment, that triggers a hotfix in the planning phase. This loop is continuous - there is no "done" state.

```
Example flow:
1. Monitor detects: API latency increased 3x after deploy
2. Alert fires → on-call engineer investigates
3. Root cause: new database query missing an index
4. Plan: hotfix ticket created
5. Code: developer adds index migration
6. Build + Test: CI pipeline runs in 3 minutes
7. Deploy: hotfix reaches production in 15 minutes
8. Monitor: latency returns to normal
```

**Why interviewer asks this:** Tests whether you understand the end-to-end picture, not just one part (like "I know Docker" or "I write pipelines").

**Follow-up:** *Which phase is the most commonly neglected in organizations, and why?*

**Monitoring and feedback.** Many teams invest heavily in CI/CD but have minimal observability. They can deploy fast but can't detect or diagnose failures quickly. Without monitoring, you're flying blind - you can deploy 100 times a day, but if you don't know what's breaking, speed is dangerous.

---

## Q3. What is the difference between CI, CD (Continuous Delivery), and CD (Continuous Deployment)?

**Answer:**

These three terms are often confused. They represent **three increasing levels of automation maturity**:

### Continuous Integration (CI)

```
Developer pushes code
        │
        ▼
  ┌─────────────┐
  │  CI Server   │
  │  - Build     │
  │  - Lint      │
  │  - Unit test │
  │  - SAST scan │
  └──────┬──────┘
         │
         ▼
  Pass/Fail feedback
  (within minutes)
```

**Definition:** Every code change is automatically built, tested, and validated. Developers merge to the main branch **multiple times per day**.

**Key rules:**
- Main branch is always in a deployable state
- Broken builds are fixed immediately (top priority)
- Tests run on every push

### Continuous Delivery (CD - Delivery)

```
CI passes
    │
    ▼
┌───────────────┐
│ Deploy to      │
│ Staging        │──→  Manual Approval ──→  Deploy to Production
│ (automatic)    │     (human gate)
└───────────────┘
```

**Definition:** Code is always **ready** to deploy to production. Every build that passes CI is a **release candidate**. But the final production deployment requires a **manual trigger** (button click, approval gate).

**Use case:** Regulated industries (fintech, healthcare) where a human must approve production releases.

### Continuous Deployment (CD - Deployment)

```
CI passes
    │
    ▼
┌───────────────┐
│ Deploy to      │
│ Staging        │──→  Automated tests ──→  Deploy to Production
│ (automatic)    │     pass (no human)      (automatic)
└───────────────┘
```

**Definition:** Every code change that passes all automated checks is **automatically deployed to production** with zero human intervention.

**Use case:** High-velocity teams (Netflix, Amazon) deploying thousands of times per day.

### Comparison Table

| Aspect | CI | Continuous Delivery | Continuous Deployment |
|---|---|---|---|
| Build automated? | Yes | Yes | Yes |
| Tests automated? | Yes | Yes | Yes |
| Deploy to staging? | No | Yes (automatic) | Yes (automatic) |
| Deploy to production? | No | Manual trigger | Automatic |
| Risk level | Low | Medium | Higher (requires excellent tests) |
| Rollback strategy | N/A | Manual | Automated |

### Real-world example

```yaml
# GitHub Actions - Continuous Delivery
name: CD Pipeline

on:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: docker build -t myapp:${{ github.sha }} .
      - run: docker push registry.example.com/myapp:${{ github.sha }}

  deploy-staging:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/myapp myapp=registry.example.com/myapp:${{ github.sha }} --namespace staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # ← This creates a manual approval gate
    steps:
      - run: kubectl set image deployment/myapp myapp=registry.example.com/myapp:${{ github.sha }} --namespace production
```

**Why interviewer asks this:** This is one of the most frequently confused topics. Precise answers show real understanding.

**Follow-up:** *What must be true before a team can safely adopt Continuous Deployment?*

1. **Comprehensive automated test suite** - unit, integration, e2e, performance
2. **Feature flags** - deploy code without activating features
3. **Automated rollback** - if health checks fail post-deploy, revert automatically
4. **Observability** - you must detect problems within seconds, not hours
5. **Small, frequent deployments** - so each deployment's blast radius is tiny

---

## Q4. What is Infrastructure as Code (IaC)?

**Answer:**

IaC is the practice of managing infrastructure (servers, networks, databases, load balancers) through **machine-readable definition files** rather than manual configuration.

### Before IaC vs. After IaC

```
BEFORE (manual):
  1. SSH into server
  2. Run apt-get install nginx
  3. Manually edit /etc/nginx/nginx.conf
  4. Hope you remember what you did
  5. 3 months later: "Why is this server configured differently from the others?"

AFTER (IaC):
  1. Write infrastructure definition in code
  2. Commit to Git
  3. CI/CD applies changes automatically
  4. Every server is identical
  5. Full audit trail in Git history
```

### Two Approaches

**Declarative (what, not how):**
```hcl
# Terraform - Declarative
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"

  tags = {
    Name        = "web-server"
    Environment = "production"
  }
}

resource "aws_security_group" "web" {
  name = "web-sg"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

You describe the **desired state**. Terraform figures out how to get there.

**Imperative (step-by-step instructions):**
```yaml
# Ansible - Imperative (procedural)
- name: Configure web server
  hosts: webservers
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present

    - name: Copy config
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: restart nginx

    - name: Start nginx
      service:
        name: nginx
        state: started
        enabled: yes
```

You describe the **steps to execute**.

### IaC Tool Landscape

| Tool | Type | Cloud | Purpose |
|---|---|---|---|
| **Terraform** | Declarative | Multi-cloud | Provision infrastructure |
| **CloudFormation** | Declarative | AWS only | Provision AWS resources |
| **Pulumi** | Declarative | Multi-cloud | IaC with real programming languages |
| **Ansible** | Imperative | Any | Configuration management |
| **Chef/Puppet** | Declarative | Any | Configuration management |

### Key Benefits

1. **Reproducibility** - `terraform apply` gives identical infra every time
2. **Version control** - Git history = infrastructure audit trail
3. **Peer review** - infra changes go through PRs, just like code
4. **Disaster recovery** - rebuild entire infrastructure from code in minutes
5. **Drift detection** - `terraform plan` shows what changed outside of code

### Terraform Workflow

```bash
# 1. Write your .tf files

# 2. Initialize (download providers)
terraform init

# 3. Preview changes (dry run)
terraform plan
# Output: "Will create 3 resources, modify 1, destroy 0"

# 4. Apply changes
terraform apply
# Prompts for confirmation, then creates/modifies infrastructure

# 5. Check current state
terraform show

# 6. Destroy everything (teardown)
terraform destroy
```

**Why interviewer asks this:** IaC is foundational to DevOps. If you're manually SSHing into servers to configure them, you're not doing DevOps.

**Follow-up:** *What is "state" in Terraform, and what happens if the state file is corrupted or lost?*

Terraform maintains a `terraform.tfstate` file that maps your code to real-world resources. If lost:
- Terraform loses track of what exists → it tries to recreate everything → conflicts and failures
- Fix: use **remote state backends** (S3 + DynamoDB locking, Terraform Cloud) - never store state locally in production
- Recovery: `terraform import` can re-link existing resources to your code, but it's manual per resource

---

## Q5. Explain Git branching strategies used in DevOps.

**Answer:**

The branching strategy determines how teams collaborate and how code flows to production.

### Strategy 1: Git Flow

```
main (production)
  │
  ├── develop (integration branch)
  │     │
  │     ├── feature/login ──────┐
  │     │                       │ merge
  │     ├── feature/search ─────┤
  │     │                       ▼
  │     ◄───────────────────────┘
  │     │
  │     ├── release/v1.2 ──→ main (tag v1.2)
  │     │
  │     └── hotfix/critical-bug ──→ main + develop
```

| Pros | Cons |
|---|---|
| Clear separation of concerns | Complex, many long-lived branches |
| Good for versioned releases | Merge conflicts accumulate |
| Supports hotfixes | Slow release cycle |

**Best for:** Software with explicit versions (desktop apps, SDKs, libraries).

### Strategy 2: GitHub Flow

```
main (always deployable)
  │
  ├── feature/new-login
  │     │
  │     ├── commit
  │     ├── commit
  │     └── PR → code review → merge to main → auto-deploy
  │
  └── feature/fix-cart
        └── PR → code review → merge to main → auto-deploy
```

| Pros | Cons |
|---|---|
| Simple, one main branch | No release staging |
| Fast iteration | Relies on feature flags for unfinished work |
| Encourages small PRs | No support for multiple versions |

**Best for:** SaaS, web apps with continuous deployment.

### Strategy 3: Trunk-Based Development

```
main (trunk)
  │
  ├── short-lived branch (hours, not days)
  │     └── merge within 24 hours
  │
  ├── short-lived branch
  │     └── merge within 24 hours
  │
  └── Feature flags control what's visible to users
```

| Pros | Cons |
|---|---|
| Fastest integration | Requires feature flags |
| Minimal merge conflicts | Needs excellent CI |
| Used by Google, Meta | Discipline required (tiny commits) |

**Best for:** High-velocity teams practicing Continuous Deployment.

### Key Git Commands for DevOps

```bash
# Create and switch to feature branch
git checkout -b feature/user-auth

# Rebase onto main (cleaner history than merge)
git fetch origin
git rebase origin/main

# Interactive rebase to squash commits before PR
git rebase -i HEAD~3

# Cherry-pick a specific commit (e.g., hotfix)
git cherry-pick abc123

# Tag a release
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
```

**Why interviewer asks this:** Branching strategy directly impacts deployment frequency and team velocity.

**Follow-up:** *Your team currently uses Git Flow and deploys once a month. Leadership wants daily deployments. What do you change?*

Migrate to **trunk-based development**:
1. Implement **feature flags** (LaunchDarkly, Unleash) so incomplete features can be merged without being visible
2. Set up **CI that runs in under 10 minutes** (parallelize tests, cache dependencies)
3. Enforce **small PRs** (< 200 lines) with automated PR size checks
4. Add **automated deployment** on merge to main
5. Train the team on writing code in small, safe increments

---

## Q6. How does DevOps relate to Agile?

**Answer:**

Agile and DevOps solve **different parts** of the same problem:

```
Agile                          DevOps
─────                          ──────
"How do we build the           "How do we deliver the
 right software quickly?"       software reliably and fast?"

Planning → Development         Building → Testing → Deploying → Monitoring

Focuses on:                    Focuses on:
- Requirements                 - Automation
- Sprint planning              - Infrastructure
- User stories                 - CI/CD
- Iteration                    - Monitoring
                               - Reliability
```

### The Connection

```
Without DevOps, Agile teams build fast but deploy slow:
  Sprint 1 done ──→ "Ops will deploy... eventually" (weeks)
  Sprint 2 done ──→ "Still waiting on infra"

With DevOps, Agile teams build fast AND deploy fast:
  Sprint 1 done ──→ Deployed in minutes via CI/CD
  Sprint 2 done ──→ Already in production
```

### Key Differences

| Dimension | Agile | DevOps |
|---|---|---|
| Focus | Development process | Delivery pipeline |
| Feedback from | Stakeholders/users | Production systems |
| Cycle | Sprint (1-2 weeks) | Continuous (every commit) |
| Tools | Jira, Confluence | Jenkins, Docker, K8s |
| Team | Dev + Product | Dev + Ops + Security |
| End goal | Working software | Reliable, deployed software |

**Why interviewer asks this:** Shows whether you understand where DevOps fits in the bigger picture.

**Follow-up:** *Can you do DevOps without Agile?*

Technically yes - you can automate infrastructure and deployments regardless of your project management methodology. But you lose the tight feedback loop. Waterfall + DevOps means you have a great pipeline that only gets used every 6 months. The combination of Agile (fast iteration) + DevOps (fast delivery) is what creates real velocity.

---

## Q7. What is Shift-Left Testing?

**Answer:**

"Shift-left" means moving testing **earlier** in the development lifecycle - to the left on a timeline.

```
Traditional (testing at the end):

Code → Code → Code → Code → ████ TEST ████ → Fix → Fix → Deploy
                              ↑
                         Bugs found late
                         (expensive to fix)

Shift-Left (testing throughout):

Code+Test → Code+Test → Code+Test → Code+Test → Deploy
  ↑            ↑            ↑           ↑
  Bugs found early (cheap to fix)
```

### What gets shifted left

| Practice | Traditional Position | Shifted-Left Position |
|---|---|---|
| Unit testing | After development | During development (TDD) |
| Security scanning | Before release | In CI on every commit |
| Code review | Before merge | During development (pair programming) |
| Performance testing | Before release | In CI (automated benchmarks) |
| Infrastructure validation | In staging | In development (IaC linting) |

### Implementation in CI

```yaml
# Every commit gets all these checks - not just before release
name: Shift-Left CI

on: [push, pull_request]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Lint (catches issues before tests even run)
      - run: npm run lint

      # Type check
      - run: npm run type-check

      # Unit tests
      - run: npm test -- --coverage

      # Security scan (SAST)
      - uses: github/codeql-action/analyze@v3

      # Dependency vulnerability check
      - run: npm audit --audit-level=high

      # Docker image scan
      - run: docker build -t myapp .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp
          severity: CRITICAL,HIGH

      # Infrastructure validation
      - run: terraform validate
      - run: terraform plan
```

### Cost of Bugs by Stage

```
Stage Found          Relative Cost to Fix
─────────────       ────────────────────
Development         1x
CI/Build            5x
Testing/QA          10x
Staging             50x
Production          100x
```

**Why interviewer asks this:** Shows understanding of quality engineering practices, not just "run tests somewhere."

**Follow-up:** *How does shift-left apply to security specifically?*

It's called **DevSecOps** - integrating security tools into the CI pipeline:
- **SAST** (Static Analysis) - scan code for vulnerabilities on every push (Semgrep, SonarQube)
- **SCA** (Software Composition Analysis) - check dependencies for CVEs (`npm audit`, Snyk)
- **Container scanning** - scan Docker images for vulnerabilities (Trivy, Grype)
- **Secret detection** - prevent committed secrets (GitLeaks, TruffleHog)
- **DAST** (Dynamic Analysis) - scan running application in staging (OWASP ZAP)

---

## Q8. What are the four key DevOps metrics (DORA metrics)?

**Answer:**

DORA (DevOps Research and Assessment) identified **four metrics** that predict software delivery performance:

### 1. Deployment Frequency

**What it measures:** How often you deploy to production.

| Performance | Frequency |
|---|---|
| Elite | Multiple times per day |
| High | Once per week to once per month |
| Medium | Once per month to once every 6 months |
| Low | Less than once every 6 months |

### 2. Lead Time for Changes

**What it measures:** Time from code commit to running in production.

| Performance | Lead Time |
|---|---|
| Elite | Less than 1 hour |
| High | 1 day to 1 week |
| Medium | 1 week to 1 month |
| Low | 1 month to 6 months |

### 3. Change Failure Rate

**What it measures:** Percentage of deployments that cause a failure in production.

| Performance | Failure Rate |
|---|---|
| Elite | 0-15% |
| High | 16-30% |
| Medium | 16-30% |
| Low | 46-60% |

### 4. Mean Time to Recovery (MTTR)

**What it measures:** How quickly you restore service after a failure.

| Performance | MTTR |
|---|---|
| Elite | Less than 1 hour |
| High | Less than 1 day |
| Medium | Less than 1 week |
| Low | More than 6 months |

### The Key Insight

**Speed and stability are NOT trade-offs.** Elite performers deploy MORE frequently AND have LOWER failure rates. The common belief that "moving fast breaks things" is wrong - moving fast with good practices (CI/CD, automated testing, monitoring) actually improves stability.

```
                    High Stability
                         ▲
                         │
          Elite ─────────┤
          performers     │
                         │
        ─────────────────┼─────────────────►
        Low Speed        │           High Speed
                         │
                         │    Low performers
                         │    (slow AND unstable)
                    Low Stability
```

### How to Track These Metrics

```bash
# Deployment Frequency - count deployments per week
git log --format="%H %ai" --merges --after="2024-01-01" | wc -l

# Lead Time - time between first commit and deploy
# Track in CI/CD: record commit timestamp and deploy timestamp

# Change Failure Rate - deployments requiring rollback / total deployments
# Track in incident management tool

# MTTR - time from alert to resolution
# Track in PagerDuty, Opsgenie, etc.
```

**Why interviewer asks this:** DORA metrics are the industry standard for measuring DevOps maturity.

**Follow-up:** *Your team has a deployment frequency of once per month and an MTTR of 3 days. What specific improvements would you prioritize?*

1. **Reduce deployment size** - smaller changes → easier to debug failures → lower MTTR
2. **Automate rollbacks** - one-click or automatic rollback drops MTTR to minutes
3. **Add monitoring/alerting** - 3-day MTTR suggests issues aren't detected quickly
4. **Improve CI speed** - fast pipelines encourage more frequent deployments
5. **Implement feature flags** - decouple deployment from release, enabling daily deploys

---

## Q9. What is Configuration Management, and how does it differ from IaC?

**Answer:**

Both manage infrastructure through code, but at **different levels**:

```
Infrastructure as Code (IaC)         Configuration Management
─────────────────────────           ────────────────────────
"Create the servers"                "Configure what's ON the servers"

Provisions:                         Configures:
- VMs / instances                   - Package installation
- Networks / VPCs                   - File contents
- Load balancers                    - Service configuration
- Databases                         - User accounts
- DNS records                       - Cron jobs

Tools:                              Tools:
- Terraform                         - Ansible
- CloudFormation                    - Chef
- Pulumi                            - Puppet
                                    - SaltStack

Lifecycle:                          Lifecycle:
- Create/destroy infrastructure     - Continuously enforce desired state
- Usually one-time per resource     - Runs repeatedly (drift correction)
```

### Example: Building a Web Server

**Step 1 - IaC (Terraform) creates the server:**
```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"
  key_name      = "deploy-key"

  vpc_security_group_ids = [aws_security_group.web.id]
}
```

**Step 2 - Configuration Management (Ansible) configures it:**
```yaml
- hosts: webservers
  become: yes
  tasks:
    - name: Install nginx
      apt: name=nginx state=present

    - name: Deploy application config
      template:
        src: app.conf.j2
        dest: /etc/nginx/sites-available/app.conf

    - name: Enable site
      file:
        src: /etc/nginx/sites-available/app.conf
        dest: /etc/nginx/sites-enabled/app.conf
        state: link
      notify: restart nginx

  handlers:
    - name: restart nginx
      service: name=nginx state=restarted
```

### Mutable vs. Immutable Infrastructure

| Approach | Description | Tool Pattern |
|---|---|---|
| **Mutable** | Update servers in place | Ansible SSHes in, runs commands |
| **Immutable** | Replace servers entirely | Terraform destroys old, creates new from image |

**Modern trend:** Immutable infrastructure with Docker containers. Instead of configuring servers, you build an image with everything baked in and replace the whole container.

**Why interviewer asks this:** Tests understanding of the infrastructure management spectrum.

**Follow-up:** *With Docker and Kubernetes, is configuration management (Ansible, Chef) still relevant?*

Less so for application servers (containers replace that), but still valuable for:
- Managing the Kubernetes cluster nodes themselves
- Configuring networking equipment
- Managing legacy systems that can't be containerized
- Initial setup of bare-metal servers
- Managing developer workstations at scale

---

## Q10. What is DevSecOps?

**Answer:**

DevSecOps integrates security into **every phase** of the DevOps lifecycle instead of treating it as a final gate.

```
Traditional Security:
Code → Build → Test → ████ SECURITY REVIEW ████ → Deploy
                       ↑
                  Bottleneck! (weeks of waiting)
                  "Security found 47 issues"

DevSecOps:
Code+Sec → Build+Sec → Test+Sec → Deploy+Sec → Monitor+Sec
  ↑          ↑           ↑          ↑            ↑
  Pre-commit  SAST       DAST     Runtime       SIEM
  hooks      scanning    testing   protection   monitoring
```

### Security at Each Phase

| Phase | Security Practice | Tool Examples |
|---|---|---|
| **Code** | Pre-commit secret detection, linting | GitLeaks, Husky hooks |
| **Build** | Dependency scanning, SAST | Snyk, SonarQube, Semgrep |
| **Test** | DAST, penetration testing | OWASP ZAP, Burp Suite |
| **Deploy** | Container image scanning, signing | Trivy, Cosign, Notary |
| **Runtime** | WAF, intrusion detection, RBAC | AWS WAF, Falco, OPA |
| **Monitor** | Log analysis, threat detection | ELK + SIEM, Splunk |

### CI Pipeline with Security Gates

```yaml
name: DevSecOps Pipeline

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      # Secret detection
      - uses: gitleaks/gitleaks-action@v2

      # SAST - find code vulnerabilities
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten

      # Dependency audit
      - run: npm audit --audit-level=high

      # Build and scan container image
      - run: docker build -t myapp:${{ github.sha }} .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          exit-code: 1  # Fail pipeline on critical vulnerabilities
          severity: CRITICAL

      # Infrastructure security
      - name: Scan Terraform
        uses: aquasecurity/tfsec-action@v1.0.0
```

### The Shared Responsibility Model

```
Before DevSecOps:
  Security team: "You can't deploy, we found vulnerabilities"
  Dev team: "But we need to ship!"
  Ops team: "Not my problem"

After DevSecOps:
  Everyone: "Security is part of our definition of done"
  - Developers write secure code (training + tooling)
  - CI catches vulnerabilities automatically
  - Security team defines policies, not gates
  - Ops ensures runtime security
```

**Why interviewer asks this:** Security is non-negotiable in modern systems. Understanding DevSecOps shows maturity.

**Follow-up:** *A developer accidentally commits an AWS secret key to a public repo. What's your incident response?*

**Immediate (within minutes):**
1. **Revoke the key** in AWS IAM - this is priority #1
2. Rotate the key - generate a new one
3. Check CloudTrail for any unauthorized usage of the compromised key

**Short-term (within hours):**
4. Remove the secret from Git history: `git filter-branch` or `BFG Repo-Cleaner`
5. Force-push the cleaned history
6. Audit all services that used the key

**Long-term (prevention):**
7. Add **pre-commit hooks** for secret detection (GitLeaks)
8. Add **CI secret scanning** as a pipeline gate
9. Move secrets to a **secrets manager** (AWS Secrets Manager, HashiCorp Vault)
10. Conduct a **blameless postmortem** and share learnings

---

## Quick Reference: DevOps Fundamentals Cheat Sheet

| Concept | One-Line Summary |
|---|---|
| DevOps | Culture + Automation + Measurement to deliver software reliably |
| CI | Automatically build and test every code change |
| Continuous Delivery | Code is always ready to deploy (manual trigger) |
| Continuous Deployment | Every passing build auto-deploys to production |
| IaC | Manage infrastructure through version-controlled code |
| Configuration Management | Automate server configuration and enforce desired state |
| Git Flow | Complex branching for versioned releases |
| GitHub Flow | Simple branching for continuous deployment |
| Trunk-Based | Ultra-short branches, feature flags, fastest integration |
| DORA Metrics | Deployment frequency, lead time, failure rate, MTTR |
| Shift-Left | Test earlier in the lifecycle = cheaper bug fixes |
| DevSecOps | Security integrated into every DevOps phase |
| CALMS | Culture, Automation, Lean, Measurement, Sharing |

---

*Next: [02 - Linux & Networking for DevOps →](./02-linux-networking.md)*
