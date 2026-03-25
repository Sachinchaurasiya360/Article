# Cloud, Monitoring & Infrastructure — Interview Preparation

> Section 6 of 7 — AWS core services, load balancing, auto-scaling, Prometheus, Grafana, and the ELK stack.

---

## Table of Contents

1. [AWS Core Services Overview](#q1-explain-the-essential-aws-services-for-a-devops-engineer)
2. [VPC & Networking on AWS](#q2-design-a-production-vpc-architecture)
3. [IAM & Security](#q3-explain-aws-iam-and-the-principle-of-least-privilege)
4. [Load Balancing](#q4-explain-load-balancing-types-and-algorithms)
5. [Auto-Scaling](#q5-how-does-auto-scaling-work-and-how-do-you-configure-it)
6. [Monitoring with Prometheus & Grafana](#q6-explain-the-prometheus--grafana-monitoring-stack)
7. [Logging with ELK Stack](#q7-explain-the-elk-stack-for-centralized-logging)
8. [Alerting Strategy](#q8-how-do-you-design-an-effective-alerting-strategy)
9. [Cost Optimization](#q9-how-do-you-optimize-cloud-costs)
10. [Debugging: Production Incident](#q10-debugging-scenario-your-application-is-returning-503-errors-intermittently)

---

## Q1. Explain the essential AWS services for a DevOps engineer.

**Answer:**

### Compute

| Service | What It Is | When to Use |
|---|---|---|
| **EC2** | Virtual machines | Full control over OS and config |
| **ECS** | Managed Docker containers | Docker workloads without K8s complexity |
| **EKS** | Managed Kubernetes | K8s workloads (team already knows K8s) |
| **Lambda** | Serverless functions | Event-driven, short-running tasks |
| **Fargate** | Serverless containers | Containers without managing servers |

### Storage

| Service | What It Is | When to Use |
|---|---|---|
| **S3** | Object storage | Static assets, backups, logs, data lakes |
| **EBS** | Block storage (attached to EC2) | Database storage, file systems |
| **EFS** | Network file system | Shared storage across multiple EC2/containers |
| **ECR** | Docker image registry | Private Docker registry on AWS |

### Networking

| Service | What It Is | When to Use |
|---|---|---|
| **VPC** | Virtual network | Isolate resources (always) |
| **ALB** | Application load balancer | HTTP/HTTPS traffic routing |
| **NLB** | Network load balancer | TCP/UDP, ultra-low latency |
| **Route 53** | DNS service | Domain management, health checks |
| **CloudFront** | CDN | Cache content at edge locations |

### Database

| Service | What It Is | When to Use |
|---|---|---|
| **RDS** | Managed relational DB | PostgreSQL, MySQL, SQL Server |
| **DynamoDB** | Managed NoSQL | Key-value, high scale, low latency |
| **ElastiCache** | Managed Redis/Memcached | Caching, sessions, pub/sub |

### DevOps-Specific

| Service | What It Is | When to Use |
|---|---|---|
| **IAM** | Identity & access management | Always (auth, permissions) |
| **CloudWatch** | Monitoring & logging | Metrics, logs, alarms |
| **Secrets Manager** | Secret storage | API keys, database passwords |
| **SSM Parameter Store** | Config storage | Non-secret configuration |
| **CloudFormation** | IaC (AWS-native) | AWS-only infrastructure |
| **CodePipeline** | CI/CD | AWS-native CI/CD |

### Service Selection Flowchart

```
Need to run code?
├── Short-running (< 15 min)?
│   └── Lambda (serverless)
├── Containers?
│   ├── Need K8s? → EKS
│   ├── Simple? → ECS + Fargate (serverless containers)
│   └── Full control? → ECS + EC2
└── Full VM needed?
    └── EC2

Need storage?
├── Files/objects? → S3
├── Database disk? → EBS
└── Shared filesystem? → EFS

Need a database?
├── Relational? → RDS (PostgreSQL/MySQL)
├── Key-value? → DynamoDB
└── Cache? → ElastiCache (Redis)
```

**Why interviewer asks this:** DevOps engineers must know which service to choose for each requirement.

**Follow-up:** *When would you choose ECS Fargate over EKS?*

**Fargate** when: smaller team, simpler workloads, don't need K8s ecosystem (Helm, Istio, operators), want less ops overhead.
**EKS** when: team knows K8s, need advanced features (CRDs, service mesh, complex scheduling), multi-cloud strategy (K8s is portable), large microservice architecture.

---

## Q2. Design a production VPC architecture.

**Answer:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VPC: 10.0.0.0/16                             │
│                                                                      │
│  ┌─────────── Availability Zone A ──────────┐  ┌──── AZ B ────────┐│
│  │                                           │  │                   ││
│  │  ┌─────────────────────────────────┐     │  │  ┌──────────────┐││
│  │  │ Public Subnet: 10.0.1.0/24     │     │  │  │ Public Subnet│││
│  │  │ ┌─────────┐  ┌──────────────┐  │     │  │  │ 10.0.2.0/24  │││
│  │  │ │   ALB   │  │  NAT Gateway │  │     │  │  │ ┌─────────┐  │││
│  │  │ └─────────┘  └──────────────┘  │     │  │  │ │   ALB   │  │││
│  │  └─────────────────────────────────┘     │  │  │ └─────────┘  │││
│  │                                           │  │  └──────────────┘││
│  │  ┌─────────────────────────────────┐     │  │  ┌──────────────┐││
│  │  │ Private Subnet: 10.0.3.0/24    │     │  │  │ Private Sub  │││
│  │  │ ┌──────┐ ┌──────┐ ┌──────┐    │     │  │  │ 10.0.4.0/24  │││
│  │  │ │ ECS  │ │ ECS  │ │ ECS  │    │     │  │  │ ┌──────┐     │││
│  │  │ │ Task │ │ Task │ │ Task │    │     │  │  │ │ ECS  │     │││
│  │  │ └──────┘ └──────┘ └──────┘    │     │  │  │ │ Task │     │││
│  │  └─────────────────────────────────┘     │  │  │ └──────┘     │││
│  │                                           │  │  └──────────────┘││
│  │  ┌─────────────────────────────────┐     │  │  ┌──────────────┐││
│  │  │ Data Subnet: 10.0.5.0/24       │     │  │  │ Data Subnet  │││
│  │  │ ┌──────────────┐ ┌───────────┐ │     │  │  │ 10.0.6.0/24  │││
│  │  │ │  RDS Primary │ │ ElastiCache│ │     │  │  │ ┌──────────┐│││
│  │  │ └──────────────┘ └───────────┘ │     │  │  │ │RDS Standby││││
│  │  └─────────────────────────────────┘     │  │  │ └──────────┘│││
│  │                                           │  │  └──────────────┘││
│  └───────────────────────────────────────────┘  └───────────────────┘│
│                                                                      │
│  Internet Gateway ←→ Public Subnets                                  │
│  NAT Gateway      ←→ Private Subnets → Internet (outbound only)     │
│  Data Subnets     ←→ No internet access (isolated)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Terraform Implementation

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "production-vpc" }
}

# Public subnets (ALB, NAT Gateway, bastion)
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true
  tags = { Name = "public-${count.index + 1}" }
}

# Private subnets (application containers)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 3}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "private-${count.index + 1}" }
}

# Data subnets (databases — no internet)
resource "aws_subnet" "data" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 5}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "data-${count.index + 1}" }
}

# Internet Gateway (public subnet internet access)
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

# NAT Gateway (private subnet outbound internet)
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}
```

### Security Groups (Firewall Rules)

```hcl
# ALB — allow HTTP/HTTPS from internet
resource "aws_security_group" "alb" {
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Application — allow traffic only from ALB
resource "aws_security_group" "app" {
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # Only from ALB
  }
}

# Database — allow traffic only from application
resource "aws_security_group" "db" {
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]  # Only from app
  }
  # NO internet access at all
}
```

**Why interviewer asks this:** VPC design is the foundation of cloud security and availability.

**Follow-up:** *Why do you need subnets across multiple Availability Zones?*

Each AZ is a physically separate data center. If AZ-A goes down (power outage, network issue), AZ-B continues serving traffic. Your ALB automatically routes to healthy instances in available AZs. Without multi-AZ, a single AZ failure takes down your entire application.

---

## Q3. Explain AWS IAM and the principle of least privilege.

**Answer:**

### IAM Components

```
IAM User      → Human identity (developer, admin)
IAM Role      → Machine/service identity (EC2, Lambda, ECS)
IAM Policy    → JSON document defining permissions
IAM Group     → Collection of users sharing policies
```

### Policy Structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Sid": "DenyDeleteBucket",
      "Effect": "Deny",
      "Action": "s3:DeleteBucket",
      "Resource": "*"
    }
  ]
}
```

### Least Privilege Examples

```
BAD — Over-permissive (common mistake):
{
  "Effect": "Allow",
  "Action": "s3:*",          ← ALL S3 operations
  "Resource": "*"            ← ALL S3 buckets
}

GOOD — Minimal permissions:
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",          ← Only read
    "s3:PutObject"           ← Only write
  ],
  "Resource": "arn:aws:s3:::my-specific-bucket/*"  ← Only this bucket
}
```

### Role-based access for services

```hcl
# Terraform — ECS task role (least privilege)
resource "aws_iam_role" "ecs_task" {
  name = "api-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "api_permissions" {
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:us-east-1:123456:secret:prod/api/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "arn:aws:s3:::uploads-bucket/*"
      }
    ]
  })
}
```

**Why interviewer asks this:** IAM misconfigurations are the #1 cause of cloud security breaches.

**Follow-up:** *What's the difference between an IAM User and an IAM Role?*

- **User**: Has long-lived credentials (access key + secret key). For humans or external services. Credentials can be leaked.
- **Role**: Has temporary credentials (auto-rotated by AWS). For AWS services (EC2, Lambda, ECS). Credentials are assumed and expire. Always prefer roles for services.

---

## Q4. Explain load balancing types and algorithms.

**Answer:**

### AWS Load Balancer Types

```
Application Load Balancer (ALB) — Layer 7
─────────────────────────────────────────
  Operates at: HTTP/HTTPS level
  Routes by: URL path, host header, query string, HTTP method
  Features: WebSocket, HTTP/2, gRPC, WAF integration
  Use for: Web apps, microservices, REST APIs

Network Load Balancer (NLB) — Layer 4
───────────────────────────────────────
  Operates at: TCP/UDP level
  Routes by: IP + port
  Features: Ultra-low latency (<100μs), static IP, TLS termination
  Use for: Gaming, IoT, real-time, non-HTTP protocols

Classic Load Balancer (CLB) — Legacy
─────────────────────────────────────
  Don't use for new projects. Use ALB or NLB.
```

### ALB Routing Examples

```
Internet → ALB
              ├── /api/*     → API Service (target group A)
              ├── /web/*     → Web Service (target group B)
              ├── /ws/*      → WebSocket Service (target group C)
              └── default    → Default Service (target group D)

Host-based routing:
  api.example.com  → API target group
  www.example.com  → Web target group
  admin.example.com → Admin target group
```

### Load Balancing Algorithms

| Algorithm | How it Works | Best For |
|---|---|---|
| **Round Robin** | Requests distributed evenly in order | Equal-capacity servers |
| **Least Connections** | Send to server with fewest active connections | Varying request duration |
| **Weighted Round Robin** | More traffic to servers with higher weight | Mixed-capacity servers |
| **IP Hash** | Same client IP → same server (sticky) | Session affinity needed |
| **Least Response Time** | Send to server responding fastest | Performance-sensitive |

### Health Checks

```hcl
# Terraform ALB health check
resource "aws_lb_target_group" "api" {
  name     = "api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2       # 2 consecutive successes = healthy
    unhealthy_threshold = 3       # 3 consecutive failures = unhealthy
    interval            = 15      # Check every 15 seconds
    timeout             = 5       # Wait 5 seconds for response
    matcher             = "200"   # Expected HTTP status code
  }

  deregistration_delay = 30       # Wait 30s for in-flight requests before removing
}
```

### What a good health check endpoint looks like

```javascript
// /health endpoint — checks all critical dependencies
app.get('/health', async (req, res) => {
  const checks = {};

  try {
    await db.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'fail';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'fail';
  }

  const healthy = Object.values(checks).every(v => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    uptime: process.uptime(),
  });
});
```

**Why interviewer asks this:** Load balancing is fundamental to high availability and scalability.

**Follow-up:** *Your ALB health checks are passing but users report errors. What could be wrong?*

The health check endpoint might be too simple (just returns 200) and doesn't check actual dependencies. The app might be running but the database connection pool is exhausted, or an external API it depends on is down. Fix: make health checks **deep** — verify database, cache, and critical services.

---

## Q5. How does auto-scaling work and how do you configure it?

**Answer:**

### Types of Scaling

```
Vertical Scaling (Scale Up):
  Small instance → Larger instance
  t3.medium → t3.xlarge
  Downtime required, has upper limits

Horizontal Scaling (Scale Out):
  1 instance → 5 instances
  Traffic distributed across all
  No downtime, theoretically unlimited
```

### AWS Auto Scaling Group (ASG)

```hcl
resource "aws_autoscaling_group" "api" {
  name                = "api-asg"
  min_size            = 2        # Always running (even if no traffic)
  max_size            = 20       # Cost ceiling
  desired_capacity    = 3        # Starting count

  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.api.arn]

  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  # Replace unhealthy instances automatically
  health_check_type         = "ELB"
  health_check_grace_period = 120

  # Instance refresh for zero-downtime updates
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 75
    }
  }

  tag {
    key                 = "Environment"
    value               = "production"
    propagate_at_launch = true
  }
}
```

### Scaling Policies

```hcl
# Target Tracking — Simplest (recommended)
resource "aws_autoscaling_policy" "cpu" {
  name                   = "cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0    # Keep CPU at ~60%
    # ASG adds instances when CPU > 60%, removes when < 60%
  }
}

# Step Scaling — More control
resource "aws_autoscaling_policy" "step" {
  name                   = "request-count-step"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "ChangeInCapacity"

  step_adjustment {
    metric_interval_lower_bound = 0
    metric_interval_upper_bound = 500
    scaling_adjustment          = 1    # Add 1 instance
  }
  step_adjustment {
    metric_interval_lower_bound = 500
    scaling_adjustment          = 3    # Add 3 instances (spike!)
  }
}

# Scheduled Scaling — Predictable patterns
resource "aws_autoscaling_schedule" "morning" {
  scheduled_action_name  = "scale-up-morning"
  autoscaling_group_name = aws_autoscaling_group.api.name
  min_size               = 5
  max_size               = 20
  desired_capacity       = 8
  recurrence             = "0 8 * * MON-FRI"  # 8 AM weekdays
}

resource "aws_autoscaling_schedule" "night" {
  scheduled_action_name  = "scale-down-night"
  autoscaling_group_name = aws_autoscaling_group.api.name
  min_size               = 2
  max_size               = 20
  desired_capacity       = 2
  recurrence             = "0 22 * * *"  # 10 PM daily
}
```

### Kubernetes Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300    # Wait 5 min before scaling down
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60              # Remove max 1 pod per minute
```

**Why interviewer asks this:** Auto-scaling is how you handle traffic without over-provisioning.

**Follow-up:** *Your auto-scaler keeps oscillating — scaling up and immediately down. How do you fix it?*

This is called **flapping**. Fixes:
1. **Increase cooldown period** — wait longer between scaling actions
2. **Use stabilization windows** — don't scale down until metric is stable for X minutes
3. **Choose better metrics** — CPU can spike momentarily; request count per second is more stable
4. **Increase scale-down delay** — scale up fast, scale down slow

---

## Q6. Explain the Prometheus + Grafana monitoring stack.

**Answer:**

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Grafana                                │
│   Dashboards, visualization, alerts                       │
│   (queries Prometheus via PromQL)                         │
└────────────────────────┬─────────────────────────────────┘
                         │ PromQL queries
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    Prometheus                              │
│   Time-series database                                    │
│   Pull-based metric collection                           │
│   Alert rules evaluation                                 │
│                                                           │
│   ┌──────────┐                                           │
│   │Alertmanager│ → Slack, PagerDuty, email               │
│   └──────────┘                                           │
└────────────┬──────────┬──────────┬───────────────────────┘
             │          │          │
        Scrapes    Scrapes    Scrapes
        /metrics   /metrics   /metrics
             │          │          │
      ┌──────▼──┐ ┌────▼───┐ ┌───▼────────┐
      │ Node    │ │  API   │ │ PostgreSQL  │
      │Exporter │ │ Server │ │  Exporter   │
      │(system) │ │(custom)│ │ (database)  │
      └─────────┘ └────────┘ └────────────┘
```

### How Prometheus Works

**Pull model:** Prometheus **scrapes** metrics endpoints at regular intervals. Your application exposes a `/metrics` endpoint in a specific format.

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/users",status="200"} 1234
http_requests_total{method="POST",path="/api/users",status="201"} 56
http_requests_total{method="GET",path="/api/users",status="500"} 3

# HELP http_request_duration_seconds Request duration histogram
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 800
http_request_duration_seconds_bucket{le="0.5"} 1100
http_request_duration_seconds_bucket{le="1.0"} 1190
http_request_duration_seconds_bucket{le="+Inf"} 1200
http_request_duration_seconds_sum 234.5
http_request_duration_seconds_count 1200
```

### Metric Types

| Type | Description | Example |
|---|---|---|
| **Counter** | Only goes up (resets on restart) | Total requests, total errors |
| **Gauge** | Goes up and down | Current CPU %, active connections |
| **Histogram** | Samples in buckets | Request duration percentiles |
| **Summary** | Pre-calculated quantiles | Similar to histogram but client-side |

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: /metrics

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Kubernetes service discovery
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### Essential PromQL Queries

```promql
# Request rate (requests per second over 5 minutes)
rate(http_requests_total[5m])

# Error rate percentage
rate(http_requests_total{status=~"5.."}[5m])
/ rate(http_requests_total[5m]) * 100

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage per container
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory usage percentage
container_memory_working_set_bytes / container_spec_memory_limit_bytes * 100

# Top 5 highest-latency endpoints
topk(5, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))
```

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: api-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency above 1 second"

      - alert: InstanceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Instance {{ $labels.instance }} is down"
```

**Why interviewer asks this:** Monitoring is a core DevOps responsibility. Prometheus + Grafana is the industry standard.

**Follow-up:** *What's the difference between Prometheus (pull-based) and Datadog/CloudWatch (push-based)?*

- **Pull** (Prometheus): Server scrapes targets. Easy to detect "target is down" (scrape fails). No agent configuration on targets. But doesn't work well with short-lived jobs (use Pushgateway as workaround).
- **Push** (Datadog): Targets send metrics to collector. Better for ephemeral containers and serverless. But "target is down" is harder to detect (absence of data).

---

## Q7. Explain the ELK stack for centralized logging.

**Answer:**

### Components

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│   Apps     │────►│  Logstash  │────►│Elasticsearch│◄────│   Kibana   │
│  (log      │     │  (collect, │     │  (store,    │     │  (search,  │
│   sources) │     │   parse,   │     │   index)    │     │ visualize) │
└────────────┘     │   filter)  │     └────────────┘     └────────────┘
                   └────────────┘

Modern variant (EFK):
  Fluentd/Fluent Bit replaces Logstash (lighter, K8s-native)
```

### Structured Logging (Application Side)

```javascript
// BAD — Unstructured log (hard to parse)
console.log('User 123 logged in from 192.168.1.100');

// GOOD — Structured JSON (easy to parse and search)
logger.info({
  event: 'user_login',
  userId: 123,
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  timestamp: new Date().toISOString(),
  requestId: req.headers['x-request-id'],
});
// Output:
// {"event":"user_login","userId":123,"ip":"192.168.1.100",...}
```

### Log Levels

```
FATAL  → System is unusable (database crash, disk full)
ERROR  → Operation failed, needs attention (unhandled exception)
WARN   → Something unexpected but handled (retry succeeded, deprecated API)
INFO   → Normal operations (user logged in, order placed)
DEBUG  → Detailed for development (SQL queries, request payloads)
TRACE  → Extremely detailed (function entry/exit, variable values)

Production: INFO and above
Debugging: DEBUG and above (temporarily)
```

### Fluent Bit Configuration (Kubernetes)

```yaml
# DaemonSet — runs on every node, collects all container logs
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
spec:
  template:
    spec:
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:latest
          volumeMounts:
            - name: varlog
              mountPath: /var/log
            - name: config
              mountPath: /fluent-bit/etc/
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: config
          configMap:
            name: fluent-bit-config
```

```ini
# fluent-bit.conf
[INPUT]
    Name              tail
    Path              /var/log/containers/*.log
    Parser            docker
    Tag               kube.*
    Refresh_Interval  5

[FILTER]
    Name              kubernetes
    Match             kube.*
    Kube_URL          https://kubernetes.default.svc:443
    Kube_Tag_Prefix   kube.var.log.containers.
    Merge_Log         On
    K8S-Logging.Parser On

[OUTPUT]
    Name              es
    Match             *
    Host              elasticsearch.logging
    Port              9200
    Index             logs-%Y.%m.%d
    Type              _doc
```

### Log Retention and Cost Management

```
Strategy:
  Hot  (0-7 days):   SSD storage, full text search
  Warm (7-30 days):  HDD storage, slower search
  Cold (30-90 days): Compressed, archived
  Delete (90+ days): Auto-delete old indices

# Elasticsearch ILM (Index Lifecycle Management)
PUT _ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot":    { "actions": { "rollover": { "max_size": "50GB", "max_age": "7d" }}},
      "warm":   { "min_age": "7d",  "actions": { "shrink": { "number_of_shards": 1 }}},
      "cold":   { "min_age": "30d", "actions": { "freeze": {} }},
      "delete": { "min_age": "90d", "actions": { "delete": {} }}
    }
  }
}
```

**Why interviewer asks this:** Centralized logging is essential for debugging distributed systems.

**Follow-up:** *How do you correlate logs across multiple microservices?*

Use a **correlation ID** (also called trace ID or request ID). Generate a unique ID at the edge (API gateway/load balancer), pass it through all services via headers (`X-Request-ID`), and include it in every log line. When debugging, search for that single ID to see the complete request flow across all services.

---

## Q8. How do you design an effective alerting strategy?

**Answer:**

### The Alert Pyramid

```
                    ▲
                   /P\         Pages (wake someone up)
                  /age\        → Service is DOWN
                 /─────\       → Data loss imminent
                / Alert \      → SLA breach
               /─────────\
              /  Tickets   \   Tickets (fix during business hours)
             / (important)  \  → Error rate elevated
            /────────────────\ → Disk 80% full
           /   Notifications  \  → Certificate expires in 14 days
          /  (informational)   \
         /──────────────────────\  Notifications (FYI)
        /     Dashboards         \ → Deploy completed
       /  (passive monitoring)    \→ Scaling event occurred
      /────────────────────────────\
```

### Good Alert Rules

```yaml
# Symptom-based alerts (what users experience)
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 5m
  labels:
    severity: page       # Wake someone up
  annotations:
    summary: "1% of requests are failing"
    runbook: "https://runbooks.example.com/high-error-rate"

# Cause-based alerts (leading indicators)
- alert: DiskSpaceLow
  expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.2
  for: 15m
  labels:
    severity: ticket     # Fix during business hours
  annotations:
    summary: "Disk space below 20% on {{ $labels.instance }}"
```

### Alert Anti-Patterns

```
BAD:
❌ CPU > 80% → Page
   (CPU can spike during deployments — not a user-facing symptom)

❌ Alert on every single error
   (Some errors are expected — rate matters, not count)

❌ No runbook linked
   ("Something is broken" at 3 AM with no guidance = useless)

❌ 100 alerts firing simultaneously
   (Alert fatigue — people ignore ALL alerts)

GOOD:
✓ Error rate > 1% for 5 minutes → Page
✓ P95 latency > 2s for 5 minutes → Page
✓ Database connections > 90% for 10 minutes → Ticket
✓ Every alert has a runbook link
✓ Alerts are actionable (you can DO something about it)
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
route:
  receiver: 'slack-notifications'
  group_by: ['alertname', 'cluster']
  group_wait: 30s          # Wait to batch alerts
  group_interval: 5m
  repeat_interval: 4h      # Don't repeat same alert for 4 hours

  routes:
    - match:
        severity: page
      receiver: 'pagerduty'
      continue: true        # Also send to slack

    - match:
        severity: ticket
      receiver: 'slack-alerts'

receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<key>'

  - name: 'slack-alerts'
    slack_configs:
      - api_url: '<webhook>'
        channel: '#alerts'
        title: '{{ .CommonAnnotations.summary }}'

  - name: 'slack-notifications'
    slack_configs:
      - api_url: '<webhook>'
        channel: '#notifications'
```

**Why interviewer asks this:** Bad alerting is worse than no alerting (alert fatigue leads to ignoring real problems).

**Follow-up:** *What's the difference between symptom-based and cause-based alerting?*

- **Symptom-based** (preferred for paging): Alerts on what users experience — errors, latency, downtime. "Our users are seeing errors" is always actionable.
- **Cause-based** (better for tickets): Alerts on underlying causes — disk full, high CPU, certificate expiring. These are leading indicators that might cause symptoms later. Good for prevention.

---

## Q9. How do you optimize cloud costs?

**Answer:**

### 1. Right-sizing

```bash
# Check instance utilization
# If average CPU is < 20% and memory < 40%, it's oversized

# AWS Compute Optimizer gives recommendations:
aws compute-optimizer get-ec2-instance-recommendations

# Common finding:
# Running: m5.2xlarge (8 vCPU, 32GB) → $280/month
# Actual usage: 15% CPU, 25% memory
# Recommendation: m5.large (2 vCPU, 8GB) → $70/month
# Savings: $210/month per instance
```

### 2. Reserved Instances / Savings Plans

```
On-Demand:    $0.096/hr  (pay as you go)
1yr Reserved: $0.060/hr  (37% savings, upfront commitment)
3yr Reserved: $0.040/hr  (58% savings)
Spot:         $0.029/hr  (70% savings, can be interrupted)

Strategy:
  Baseline capacity → Reserved Instances (always running)
  Variable capacity → On-Demand (auto-scaling)
  Fault-tolerant jobs → Spot Instances (batch processing, CI runners)
```

### 3. Auto-scaling properly

```
Peak hours (9 AM - 6 PM):   10 instances
Off-peak (6 PM - 9 AM):      3 instances
Weekends:                     2 instances

Savings: Running 10 instances 24/7 = $7,200/month
         With scheduling = ~$3,600/month (50% savings)
```

### 4. Storage optimization

```bash
# S3 lifecycle policies
aws s3api put-bucket-lifecycle-configuration --bucket my-bucket --lifecycle-configuration '{
  "Rules": [{
    "ID": "archive-old-logs",
    "Status": "Enabled",
    "Transitions": [
      {"Days": 30, "StorageClass": "STANDARD_IA"},
      {"Days": 90, "StorageClass": "GLACIER"},
      {"Days": 365, "StorageClass": "DEEP_ARCHIVE"}
    ],
    "Expiration": {"Days": 730}
  }]
}'

# Cost comparison per GB/month:
# S3 Standard:     $0.023
# S3 IA:           $0.0125
# S3 Glacier:      $0.004
# S3 Deep Archive: $0.00099
```

### 5. Container optimization

```
Running 20 t3.medium instances (2 vCPU, 4GB each):
  Total: 40 vCPU, 80GB RAM
  Cost: $600/month
  Utilization: 30% CPU, 40% RAM

Optimized with Fargate (pay for what you use):
  20 tasks × 0.5 vCPU × 1GB
  Cost: ~$200/month
  Utilization: effectively 100%
```

### Cost Monitoring

```bash
# AWS Cost Explorer CLI
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE

# Set billing alerts
aws cloudwatch put-metric-alarm \
  --alarm-name "MonthlyBudgetExceeded" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold
```

**Why interviewer asks this:** Cloud costs can spiral out of control. Cost optimization is a key DevOps responsibility.

**Follow-up:** *Your AWS bill doubled last month. How do you investigate?*

1. **Cost Explorer** — break down by service, identify which service increased
2. **Tag-based analysis** — if resources are tagged by team/project, identify the owner
3. **Check for orphaned resources** — unused EBS volumes, idle load balancers, stopped-but-not-terminated instances
4. **Check auto-scaling** — did a scaling event cause it (and did it scale back down)?
5. **Check data transfer** — cross-region or internet data transfer is expensive
6. **Check NAT Gateway** — often a hidden cost center for private subnets

---

## Q10. Debugging scenario: Your application is returning 503 errors intermittently.

**Answer:**

### Systematic Investigation

```
503 = Service Unavailable
The load balancer is returning this because backend targets are unhealthy.

Step 1: Check load balancer target health
─────────────────────────────────────────
$ aws elbv2 describe-target-health --target-group-arn <arn>
# If targets show "unhealthy" → app is failing health checks
# If targets show "draining" → instance is being removed (auto-scaling?)


Step 2: Check application health
─────────────────────────────────
$ curl -v http://backend-instance:3000/health
# If this fails → app is down or overloaded
# If this succeeds → maybe intermittent (timing issue)


Step 3: Check resource usage
───────────────────────────
$ docker stats (or kubectl top pods)
# CPU at 100% → app is CPU-bound, can't serve requests fast enough
# Memory near limit → possible OOM kills
# Check: dmesg | grep -i oom


Step 4: Check connection limits
──────────────────────────────
$ ss -s    # Summary of all connections
# TIME_WAIT: 15000  ← Too many connections in TIME_WAIT!
# Possible cause: connection pool exhaustion

$ cat /proc/sys/net/core/somaxconn
# If low (128), increase to 1024+


Step 5: Check logs
──────────────────
$ kubectl logs api-pod --tail 500 | grep -i "error\|timeout\|refused"
# "ECONNREFUSED" → database or downstream service is down
# "Timeout" → downstream service is slow
# "ENOMEM" → out of memory


Step 6: Check downstream services
──────────────────────────────────
$ curl -v http://database:5432     # Is DB reachable?
$ redis-cli -h redis ping          # Is Redis reachable?
# If downstream is slow → that's causing your app to be slow
# → which causes health check timeouts → 503


Step 7: Check for recent changes
────────────────────────────────
$ kubectl rollout history deployment/api
# Was there a recent deployment?
# Did config change?
# Did a dependency update?
```

### Common 503 Causes and Fixes

| Cause | Evidence | Fix |
|---|---|---|
| App crashing | Pod restarts, OOM killed | Fix crash, increase resources |
| Health check too strict | Health endpoint slow under load | Increase timeout, simplify health check |
| Connection pool exhausted | "Too many connections" in logs | Increase pool size, add connection timeout |
| Downstream service down | "ECONNREFUSED" in logs | Fix downstream, add circuit breaker |
| Auto-scaler too slow | Spikes in traffic, insufficient capacity | Pre-scale, lower scaling threshold |
| Deployment rolling update | 503 during deploy | Ensure readiness probes, increase surge |

### Prevention

```yaml
# Kubernetes readiness probe (only routes traffic when app is ready)
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3

# Circuit breaker pattern (stop calling failing downstream)
# Implemented in app code or via service mesh (Istio)
```

**Why interviewer asks this:** 503 debugging is one of the most common production incidents. Systematic debugging separates senior from junior engineers.

**Follow-up:** *How would you prevent this from happening again?*

1. **Better health checks** that verify downstream dependencies
2. **Circuit breakers** for downstream service calls
3. **Auto-scaling** with aggressive scale-up thresholds
4. **Load testing** before deployment (simulate production traffic)
5. **Alerting** on health check failure rate (catch before users notice)

---

*Next: [07 — System Design & Real-world Scenarios →](./07-system-design.md)*
