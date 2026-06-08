# ── Cloudflare IP Ranges ──────────────────────────────────────────────────────
# Only Cloudflare can reach the ALB. Direct requests to the ALB IP are blocked.
# Updated Jan 2025: https://www.cloudflare.com/ips/
locals {
  cloudflare_ipv4_cidrs = [
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "108.162.192.0/18",
    "131.0.72.0/22",
    "141.101.64.0/18",
    "162.158.0.0/15",
    "172.64.0.0/13",
    "173.245.48.0/20",
    "188.114.96.0/20",
    "190.93.240.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
  ]
}

# ── ALB Security Group ────────────────────────────────────────────────────────
# Only Cloudflare IPs can reach the ALB (ports 80 + 443)
resource "aws_security_group" "alb" {
  name        = "${var.app_name}-sg-alb"
  description = "ALB: allow inbound from Cloudflare IPs only"
  vpc_id      = aws_vpc.main.id

  # HTTPS from Cloudflare IPv4
  dynamic "ingress" {
    for_each = local.cloudflare_ipv4_cidrs
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Cloudflare HTTPS"
    }
  }

  # HTTP from Cloudflare IPv4 (redirect to HTTPS)
  dynamic "ingress" {
    for_each = local.cloudflare_ipv4_cidrs
    content {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Cloudflare HTTP redirect"
    }
  }

  # ALB can reach EC2 on port 3000
  egress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "Forward to Node.js"
  }

  tags = { Name = "${var.app_name}-sg-alb" }
}

# ── EC2 Security Group ────────────────────────────────────────────────────────
# Only ALB can send traffic to EC2 port 3000. SSH restricted to a specific IP.
resource "aws_security_group" "ec2" {
  name        = "${var.app_name}-sg-ec2"
  description = "EC2: allow ALB on :3000, SSH from admin IP"
  vpc_id      = aws_vpc.main.id

  # App traffic from ALB only
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Node.js from ALB"
  }

  # SSH — change 0.0.0.0/0 to your office/home IP for production
  # Or remove entirely and use AWS Systems Manager Session Manager (no SSH needed)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]   # ⚠️ Restrict to YOUR_IP/32 in production
    description = "SSH - restrict to office IP"
  }

  # Full outbound (EC2 needs internet for scraping LeetCode/CF/CC/HR via NAT)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound (scraping + npm + git)"
  }

  tags = { Name = "${var.app_name}-sg-ec2" }
}

# ── RDS Security Group ────────────────────────────────────────────────────────
# Only EC2 instances can reach PostgreSQL. No internet access.
resource "aws_security_group" "rds" {
  name        = "${var.app_name}-sg-rds"
  description = "RDS: allow PostgreSQL only from EC2 security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "PostgreSQL from EC2 only"
  }

  # No egress rule — databases don't initiate connections

  tags = { Name = "${var.app_name}-sg-rds" }
}

# ── ElastiCache Security Group ────────────────────────────────────────────────
# Only EC2 instances can reach Redis. TLS enforced on the Redis side.
resource "aws_security_group" "redis" {
  name        = "${var.app_name}-sg-redis"
  description = "Redis: allow TLS traffic only from EC2 security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6380   # TLS Redis port
    to_port         = 6380
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "Redis TLS from EC2 only"
  }

  tags = { Name = "${var.app_name}-sg-redis" }
}
