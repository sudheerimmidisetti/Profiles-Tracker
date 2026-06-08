# ── ElastiCache Subnet Group (private subnets only) ───────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.app_name}-redis-subnet-group"
  description = "Private subnets for Redis — no internet exposure"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${var.app_name}-redis-subnet-group" }
}

# ── ElastiCache Redis Replication Group (cluster with replica) ─────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.app_name}-redis"
  description          = "CPTrack Redis — JWT session store + sync distributed lock"

  # Engine
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6380   # TLS port

  # Topology: single shard, 1 primary + 1 replica across AZs
  num_cache_clusters = 2
  automatic_failover_enabled = true    # promote replica if primary fails
  multi_az_enabled           = true    # primary and replica in different AZs

  # Network
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Security
  at_rest_encryption_enabled  = true      # AES-256 at rest
  transit_encryption_enabled  = true      # TLS in transit (forces port 6380)
  auth_token                  = var.redis_auth_token

  # Maintenance
  maintenance_window       = "sun:22:00-sun:23:00"   # UTC = 3:30 AM IST Sunday
  snapshot_retention_limit = 3
  snapshot_window          = "20:00-21:00"            # UTC = 1:30 AM IST

  # Apply changes during maintenance window, not immediately
  apply_immediately = false

  tags = { Name = "${var.app_name}-redis" }
}
