# ── RDS Subnet Group (private subnets only) ───────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name        = "${var.app_name}-db-subnet-group"
  description = "Private subnets for RDS — no internet exposure"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${var.app_name}-db-subnet-group" }
}

# ── RDS PostgreSQL Instance ───────────────────────────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier = "${var.app_name}-db"

  # Engine
  engine               = "postgres"
  engine_version       = "15.6"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  max_allocated_storage = 100        # Auto-scaling storage up to 100 GB
  storage_type         = "gp3"
  storage_encrypted    = true        # AES-256 at rest (KMS default key)

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Network — PRIVATE, no public access
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false   # CRITICAL: No public IP

  # High Availability
  multi_az = var.db_multi_az   # Standby replica in second AZ

  # Backups
  backup_retention_period   = 7          # 7-day PITR window
  backup_window             = "20:30-21:00"   # UTC = 2 AM IST
  maintenance_window        = "sun:21:00-sun:22:00"   # UTC = 2:30 AM IST Sunday
  delete_automated_backups  = false
  copy_tags_to_snapshot     = true

  # Protection
  deletion_protection = true    # Prevents accidental `terraform destroy` from deleting DB
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.app_name}-db-final-snapshot"

  # Performance
  performance_insights_enabled          = true
  performance_insights_retention_period = 7   # 7 days free

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Parameters
  parameter_group_name = aws_db_parameter_group.postgres.name

  tags = { Name = "${var.app_name}-postgres" }
}

# ── RDS Parameter Group ───────────────────────────────────────────────────────
resource "aws_db_parameter_group" "postgres" {
  name        = "${var.app_name}-pg15"
  family      = "postgres15"
  description = "CPTrack PostgreSQL 15 parameter group"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"   # Log queries slower than 1 second
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = { Name = "${var.app_name}-pg15" }
}

# ── IAM Role for Enhanced Monitoring ─────────────────────────────────────────
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.app_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
