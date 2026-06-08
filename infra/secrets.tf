# ── Secrets Manager — Single source of truth for all app secrets ──────────────
# EC2 instances fetch these at startup via IAM role. No .env files on servers.

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.app_name}/production"
  description             = "CPTrack production secrets — fetched by EC2 at startup"
  recovery_window_in_days = 7    # 7-day grace period before permanent deletion

  tags = { Name = "${var.app_name}-production-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    # Database — uses RDS endpoint (only resolvable inside the VPC)
    DATABASE_URL = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/${var.db_name}"

    # Redis — uses ElastiCache primary endpoint with TLS
    REDIS_URL = "rediss://default:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6380"

    # Auth
    JWT_SECRET   = var.jwt_secret
    ADMIN_SECRET = var.admin_secret

    # Email via SES
    SMTP_HOST     = "email-smtp.${var.aws_region}.amazonaws.com"
    SMTP_PORT     = "587"
    SMTP_SECURE   = "false"
    SMTP_USER     = var.smtp_user
    SMTP_PASS     = var.smtp_password
    FROM_EMAIL    = "noreply@${var.domain}"

    # App config
    COLLEGE_EMAIL_DOMAINS = var.college_email_domains
    CORS_ORIGIN           = "https://tracker.${var.domain},https://admin.${var.domain}"
    NODE_ENV              = "production"
    PORT                  = "3000"
  })

  # Recreate the secret version if any value changes
  lifecycle {
    ignore_changes = []
  }
}
