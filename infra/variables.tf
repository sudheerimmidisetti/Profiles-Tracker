# ─── AWS ─────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region (Mumbai)"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment (production | staging)"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Short application name used in resource naming"
  type        = string
  default     = "cptrack"
}

# ─── Network ─────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (ALB + EC2)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDRs for private subnets (RDS + Redis)"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

# ─── EC2 / ASG ───────────────────────────────────────────────
variable "ec2_instance_type" {
  description = "EC2 instance type for the API servers"
  type        = string
  default     = "t3.small"
}

variable "asg_min" {
  description = "Auto Scaling Group minimum instances"
  type        = number
  default     = 1
}

variable "asg_desired" {
  description = "Auto Scaling Group desired instances"
  type        = number
  default     = 2
}

variable "asg_max" {
  description = "Auto Scaling Group maximum instances"
  type        = number
  default     = 6
}

variable "ec2_key_name" {
  description = "EC2 key pair name for SSH access (must exist in AWS)"
  type        = string
}

# ─── RDS ─────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "coding_tracker"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "cptrack"
}

variable "db_password" {
  description = "PostgreSQL master password (also stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS (high availability)"
  type        = bool
  default     = true
}

# ─── ElastiCache ─────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "Redis AUTH token (password)"
  type        = string
  sensitive   = true
}

# ─── Application Secrets ─────────────────────────────────────
variable "jwt_secret" {
  description = "JWT signing secret (min 64 chars)"
  type        = string
  sensitive   = true
}

variable "admin_secret" {
  description = "Admin dashboard shared secret"
  type        = string
  sensitive   = true
}

variable "smtp_user" {
  description = "AWS SES SMTP username"
  type        = string
  sensitive   = true
}

variable "smtp_password" {
  description = "AWS SES SMTP password"
  type        = string
  sensitive   = true
}

variable "college_email_domains" {
  description = "Comma-separated college email domains allowed to register"
  type        = string
  default     = "@acet.ac.in,@aec.edu.in,@adityauniversity.in"
}

# ─── Cloudflare ──────────────────────────────────────────────
variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS:Edit + Zone:Read permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for dealance.app (from Cloudflare dashboard)"
  type        = string
}

variable "domain" {
  description = "Root domain"
  type        = string
  default     = "dealance.app"
}

variable "api_subdomain" {
  description = "Subdomain for the backend API"
  type        = string
  default     = "api"
}

# ─── GitHub ──────────────────────────────────────────────────
variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  default     = "PrasannaReddy0583/profiles_tracker"
}
