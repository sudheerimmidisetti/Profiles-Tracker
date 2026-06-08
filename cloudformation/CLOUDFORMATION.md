# CPTrack — AWS CloudFormation Deployment Guide

Complete infrastructure-as-code for CPTrack using AWS CloudFormation.
Covers Active-Active ALB, Auto Scaling Group, RDS PostgreSQL, ElastiCache Redis,
Secrets Manager, IAM, and Cloudflare DNS integration.

---

## Architecture Overview

```
                        INTERNET
                           │
              ┌────────────▼────────────┐
              │       CLOUDFLARE        │
              │  DDoS + CDN + WAF + SSL │
              │      dealance.app       │
              └────────────┬────────────┘
                           │ HTTPS (proxied)
              ┌────────────▼────────────────────────────┐
              │           AWS ap-south-1                 │
              │  ┌──────────────────────────────────┐   │
              │  │   Application Load Balancer (ALB) │   │
              │  │     accepts Cloudflare IPs only   │   │
              │  │  cptrack-alb.xxx.elb.amazonaws.com│   │
              │  └──────────────┬───────────────────┘   │
              │                 │ :3000                  │
              │  PUBLIC SUBNETS (ap-south-1a + 1b)       │
              │  ┌──────────────┼───────────────────┐   │
              │  │    EC2 (ASG) │   EC2 (ASG)        │   │
              │  │  t3.small    │   t3.small         │   │
              │  │  AZ-a        │   AZ-b             │   │
              │  └──────────────┴───────────────────┘   │
              │                 │                        │
              │  PRIVATE SUBNETS (no internet access)    │
              │  ┌──────────────────────────────────┐   │
              │  │  RDS PostgreSQL 15 (Multi-AZ)    │   │
              │  │  Primary (1a) │ Standby (1b)     │   │
              │  └──────────────────────────────────┘   │
              │  ┌──────────────────────────────────┐   │
              │  │  ElastiCache Redis 7              │   │
              │  │  Primary (1a) │ Replica (1b)     │   │
              │  └──────────────────────────────────┘   │
              └─────────────────────────────────────────┘

Frontends (FREE):
  tracker.dealance.app  →  Cloudflare Pages
  admin.dealance.app    →  Cloudflare Pages
```

---

## Stack Structure (5 Nested Stacks)

| # | File | What it creates | Deploy time |
|---|---|---|---|
| Master | `master.yaml` | Orchestrates all below | — |
| 1 | `stacks/01-network.yaml` | VPC, subnets, IGW, NAT GWs, routes | ~3 min |
| 2 | `stacks/02-security.yaml` | 4 Security Groups | ~1 min |
| 3 | `stacks/03-database.yaml` | RDS + Redis + Secrets Manager | ~15 min |
| 4 | `stacks/04-iam.yaml` | IAM Role + Instance Profile | ~1 min |
| 5 | `stacks/05-compute.yaml` | ALB + Launch Template + ASG | ~5 min |

**Total: ~25 min first deploy** (mostly waiting for RDS Multi-AZ to provision).

---

## Prerequisites

### 1. AWS CLI configured

```bash
# Install
pip install awscli

# Configure (uses IAM user credentials)
aws configure
# AWS Access Key ID: (from IAM → Users → Security credentials)
# AWS Secret Access Key: (from same page)
# Default region: ap-south-1
# Default output format: json

# Verify
aws sts get-caller-identity
```

### 2. Required IAM permissions for deploying

Your IAM user/role needs these managed policies:

```
AmazonVPCFullAccess
AmazonRDSFullAccess
AmazonElastiCacheFullAccess
AWSSecretsManagerReadWrite
AmazonEC2FullAccess
ElasticLoadBalancingFullAccess
AutoScalingFullAccess
IAMFullAccess
CloudFormationFullAccess
AmazonS3FullAccess
CloudWatchFullAccess
```

Or use `AdministratorAccess` for simplicity during initial setup.

### 3. EC2 Key Pair (for SSH)

```bash
# Create a key pair in ap-south-1
aws ec2 create-key-pair \
  --key-name cptrack-key \
  --region ap-south-1 \
  --query KeyMaterial \
  --output text > cptrack-key.pem

chmod 400 cptrack-key.pem

# Or import an existing public key:
aws ec2 import-key-pair \
  --key-name cptrack-key \
  --public-key-material fileb://~/.ssh/id_rsa.pub \
  --region ap-south-1
```

### 4. AWS SES SMTP Credentials (for sending OTP emails)

```
1. AWS Console → SES → SMTP Settings → Create SMTP credentials
2. Note down the SMTP username and password
3. Verify your sender domain:
   SES → Verified identities → Create identity → Domain → dealance.app
4. Add the DKIM records in Cloudflare DNS (SES shows you the exact records)
5. Request production access (SES sandbox allows only verified recipients):
   SES → Account dashboard → Request production access → Fill form
   (Usually approved in 24 hours for legitimate use cases)
```

> **While in SES Sandbox**: You can only send to verified email addresses.
> To test, verify a personal email: SES → Verified identities → Create identity → Email address.

---

## Deployment Steps

### Step 1 — Clone and Navigate

```bash
git clone https://github.com/PrasannaReddy0583/profiles_tracker.git
cd profiles_tracker/cloudformation
```

### Step 2 — Fill in Parameters

```bash
cp params.json.example params.json
nano params.json   # or use your editor of choice
```

**What to fill in** (`CHANGE_ME_*` values):

| Parameter | Where to get it |
|---|---|
| `KeyPairName` | AWS Console → EC2 → Key Pairs → name of your key pair |
| `DBPassword` | Generate: `openssl rand -base64 24` |
| `RedisAuthToken` | Generate: `openssl rand -hex 20` |
| `JwtSecret` | Generate: `openssl rand -hex 64` |
| `AdminSecret` | Generate: `openssl rand -hex 16` |
| `SmtpUser` | AWS SES → SMTP Settings → SMTP credentials |
| `SmtpPassword` | Same page as SMTP username |

**Generate all secrets in one command:**
```bash
echo "DBPassword: $(openssl rand -base64 24)"
echo "RedisAuthToken: $(openssl rand -hex 20)"
echo "JwtSecret: $(openssl rand -hex 64)"
echo "AdminSecret: $(openssl rand -hex 16)"
```

### Step 3 — Validate Templates

```bash
chmod +x deploy.sh
./deploy.sh validate
```

All 6 templates should show ✅ valid.

### Step 4 — Deploy

```bash
./deploy.sh deploy
```

The script will:
1. ✅ Validate AWS credentials
2. ✅ Validate all 6 templates
3. ✅ Create an S3 bucket (`cptrack-cfn-templates-{account_id}`)
4. ✅ Upload all templates to S3
5. ✅ Create the CloudFormation master stack
6. ⏳ Wait ~25 min for all nested stacks to provision
7. ✅ Print all outputs (ALB DNS, endpoints, etc.)

### Step 5 — Configure Cloudflare DNS

After deployment completes, the script prints:

```
⚠️  CLOUDFLARE STEP: Add this CNAME record in Cloudflare:
  Name:    api
  Type:    CNAME
  Value:   cptrack-alb-1234567890.ap-south-1.elb.amazonaws.com
  Proxy:   ✅ ON (orange cloud)
```

**In Cloudflare:**
```
Dashboard → dealance.app → DNS → Add record:
  Type:    CNAME
  Name:    api
  Target:  (paste ALB DNS from above)
  Proxy:   ✅ Proxied (orange cloud ON)
  TTL:     Auto
```

**SSL/TLS Mode** (Cloudflare → SSL/TLS → Overview):
```
Set to: "Full"
(Not "Full Strict" — the ALB uses HTTP internally from Cloudflare)
```

> To use "Full Strict" mode (requires valid cert on ALB):
> See [Advanced: ACM Certificate + Full Strict](#advanced-acm--full-strict-ssl).

### Step 6 — Run Database Migration

After instances start (check ASG → instances are `InService`):

```bash
# SSH into one EC2 instance
INSTANCE_IP=$(aws ec2 describe-instances \
  --region ap-south-1 \
  --filters "Name=tag:Name,Values=cptrack-api-production" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

ssh -i cptrack-key.pem ubuntu@$INSTANCE_IP

# Migration runs automatically via User Data!
# But verify it worked:
cat /var/log/user-data.log | grep -i migration
```

The migration runs automatically in the User Data script. Check the logs to confirm.

### Step 7 — Test the API

```bash
# Health check
curl https://api.dealance.app/health

# Expected response:
# {"success":true,"message":"CPTrack API is running","timestamp":"..."}
```

---

## Check Stack Status

```bash
./deploy.sh status

# Or via AWS CLI:
aws cloudformation describe-stacks \
  --stack-name cptrack-production \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
```

### Watch live events during deployment

```bash
# Follow events in real-time
watch -n 5 'aws cloudformation describe-stack-events \
  --stack-name cptrack-production \
  --region ap-south-1 \
  --query "StackEvents[0:10].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]" \
  --output table'
```

---

## Zero-Downtime Deploys (After Code Changes)

After pushing new code to GitHub:

```bash
# Option 1: Use deploy script
./deploy.sh refresh

# Option 2: Manual command (printed by ./deploy.sh status)
aws autoscaling start-instance-refresh \
  --region ap-south-1 \
  --auto-scaling-group-name cptrack-asg-production \
  --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}'
```

**What happens:**
1. ASG launches a new EC2 instance → runs User Data (pulls latest GitHub code)
2. Waits 120s for Node.js to start and pass `/health` check
3. ALB registers new instance in Target Group
4. ASG terminates one old instance (ALB drains connections first, 30s)
5. Repeat for each remaining old instance
6. Result: 0 dropped requests

---

## Auto Scaling Behavior

| Metric | Threshold | Action | Cooldown |
|---|---|---|---|
| Average CPU | > 60% | Target tracking (auto) | 300s |
| Average CPU | > 80% for 2 min | Add 2 instances | 300s |
| Average CPU | < 30% for 10 min | Remove 1 instance | 300s |
| ALB 5xx errors | > 10/min for 3 min | CloudWatch alarm fires | — |

**View scaling activity:**
```bash
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name cptrack-asg-production \
  --region ap-south-1 \
  --max-items 10 \
  --output table
```

---

## Monitoring

### CloudWatch Logs (PM2 output)

```
AWS Console → CloudWatch → Log Groups:
  /cptrack/api/stdout     ← Node.js console.log output
  /cptrack/api/stderr     ← Node.js errors
  /cptrack/ec2/user-data  ← Bootstrap script output
```

```bash
# CLI: tail recent logs
aws logs tail /cptrack/api/stderr \
  --follow \
  --region ap-south-1
```

### CloudWatch Alarms

```
AWS Console → CloudWatch → Alarms:
  cptrack-cpu-high   ← CPU > 80% → scale out
  cptrack-cpu-low    ← CPU < 30% → scale in
  cptrack-alb-5xx    ← 5xx errors spike
```

### RDS Performance Insights

```
AWS Console → RDS → cptrack-db → Performance Insights
→ View slow queries, active sessions, wait events
```

---

## Database Security — Explained

| Layer | What it does |
|---|---|
| **Private subnet** | RDS has no public IP — AWS routing table has no internet gateway |
| **Security Group** | Port 5432 only from `cptrack-sg-ec2`. All other sources blocked |
| **Encryption at rest** | AES-256 via AWS KMS (default managed key — no cost) |
| **TLS in transit** | PostgreSQL TLS enforced by RDS parameter group |
| **No .env files** | Credentials live only in Secrets Manager, fetched via IAM role |
| **Deletion protection** | Must disable manually before delete — prevents accidents |
| **Automated backups** | 7-day PITR window, snapshot before any delete |

**To verify no public access:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier cptrack-db-production \
  --region ap-south-1 \
  --query 'DBInstances[0].PubliclyAccessible'
# Should output: false
```

---

## Connect to RDS (for manual queries)

RDS is in a private subnet — no direct internet access. Use an EC2 instance as a bastion:

```bash
# 1. SSH into any running EC2
ssh -i cptrack-key.pem ubuntu@<EC2_PUBLIC_IP>

# 2. On EC2: read DB connection string from .env
source /home/ubuntu/cptrack/backend/.env
echo $DATABASE_URL

# 3. Connect with psql
psql "$DATABASE_URL"

# 4. Useful queries
\dt                                          -- list tables
SELECT COUNT(*) FROM students;               -- count students
SELECT * FROM students WHERE is_verified=true LIMIT 10;
```

---

## Secrets Management — How It Works

```
1. params.json → CloudFormation → Secrets Manager secret
                                      ↓
2. IAM Role attached to EC2 ──── allows GetSecretValue
                                      ↓
3. User Data runs at EC2 start:
   aws secretsmanager get-secret-value → JSON → .env file
                                      ↓
4. PM2 starts Node.js with process.env populated from .env
```

**To update a secret after deploy:**
```bash
# Example: rotate JWT secret
aws secretsmanager update-secret \
  --secret-id cptrack/production \
  --secret-string "$(aws secretsmanager get-secret-value \
    --secret-id cptrack/production \
    --query SecretString --output text | \
    jq '.JWT_SECRET = "new_64_char_hex_secret"')" \
  --region ap-south-1

# Then trigger instance refresh so new instances pick up the new secret
./deploy.sh refresh
```

---

## Advanced: ACM Certificate + Full Strict SSL

For Cloudflare **Full Strict** mode (validates the cert on the ALB):

```bash
# 1. Request ACM cert via CLI
aws acm request-certificate \
  --domain-name api.dealance.app \
  --validation-method DNS \
  --region ap-south-1

# 2. Get the DNS validation record
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:... \
  --region ap-south-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 3. Add that CNAME to Cloudflare DNS (proxied: OFF for validation records)
# 4. Wait ~5 min for validation

# 5. Update 05-compute.yaml listener:
#    Change Port 443 Protocol from HTTP → HTTPS
#    Add: Certificates: [CertificateArn: !Ref YourCertArn]

# 6. Redeploy: ./deploy.sh deploy
# 7. In Cloudflare SSL/TLS: change "Full" → "Full (Strict)"
```

---

## Cost Estimate (ap-south-1, Mumbai)

| Resource | Spec | $/month |
|---|---|---|
| EC2 × 2 | t3.small | ~$30 |
| ALB | Application | ~$18 |
| RDS | db.t3.micro Multi-AZ | ~$28 |
| ElastiCache | cache.t3.micro × 2 | ~$28 |
| NAT Gateway × 2 | — | ~$65 |
| S3 (templates) | < 1 MB | ~$0 |
| Secrets Manager | 1 secret | ~$0.40 |
| CloudWatch | Basic | ~$2 |
| SES | 62k emails/month | **FREE** |
| Cloudflare Pages | Frontends | **FREE** |
| **Total** | | **~$172/mo** |

> **Cost cuts:**
> - Use 1 NAT Gateway instead of 2 → save ~$33/mo (lose AZ-HA for outbound)
> - Skip Multi-AZ RDS → save ~$14/mo (lose standby failover)
> - Use t3.micro EC2 → save ~$10/mo (less RAM for scraping)
> - 1-year Reserved Instances → ~40% off EC2

---

## Troubleshooting

### Stack stuck in `ROLLBACK_IN_PROGRESS`

```bash
# Check which resource failed and why
aws cloudformation describe-stack-events \
  --stack-name cptrack-production \
  --region ap-south-1 \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
  --output table
```

Common causes:
- **KeyPairName not found** → check the key pair name matches exactly
- **DBPassword too short** → must be ≥ 16 chars
- **RedisAuthToken too short** → must be ≥ 16 chars
- **IAM limit hit** → request limit increase in AWS console

### Instances not passing health checks

```bash
# Check user data logs on the instance
ssh -i cptrack-key.pem ubuntu@<IP>
cat /var/log/user-data.log
pm2 status
pm2 logs cptrack-api --lines 50
```

### Cannot connect to RDS

```bash
# On EC2, test connectivity
nc -zv <RDS_ENDPOINT> 5432
# If timeout: check security group sg-rds allows EC2 SG
```

### Secrets not loading

```bash
# Test IAM role has access
aws secretsmanager get-secret-value \
  --secret-id cptrack/production \
  --region ap-south-1
# If AccessDenied: check EC2 instance profile is attached and has SecretsManager policy
```

---

## Full File Structure

```
cloudformation/
├── deploy.sh                  ← Main deploy/refresh/destroy script
├── master.yaml                ← Root stack (orchestrates all nested stacks)
├── params.json.example        ← Copy → params.json, fill secrets
├── .gitignore                 ← Excludes params.json (contains secrets)
└── stacks/
    ├── 01-network.yaml        ← VPC, subnets, IGW, NAT Gateways, routes
    ├── 02-security.yaml       ← 4 Security Groups (ALB/EC2/RDS/Redis)
    ├── 03-database.yaml       ← RDS PostgreSQL + ElastiCache Redis + Secrets Manager
    ├── 04-iam.yaml            ← EC2 IAM Role + Instance Profile
    └── 05-compute.yaml        ← ALB + Launch Template + ASG + Scaling Policies
```

Terraform alternative (same infrastructure): see `../infra/` folder.
