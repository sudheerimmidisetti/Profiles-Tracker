# ── Useful outputs after terraform apply ─────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name — point Cloudflare CNAME here (done automatically by cloudflare.tf)"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (private — only reachable from EC2)"
  value       = aws_db_instance.postgres.address
  sensitive   = false
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (private — only reachable from EC2)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = false
}

output "secret_arn" {
  description = "Secrets Manager ARN — EC2 instances fetch this at startup"
  value       = aws_secretsmanager_secret.app.arn
}

output "asg_name" {
  description = "Auto Scaling Group name — use this to trigger instance refresh"
  value       = aws_autoscaling_group.api.name
}

output "api_url" {
  description = "Public API URL (via Cloudflare)"
  value       = "https://${var.api_subdomain}.${var.domain}"
}

output "deploy_command" {
  description = "Command to trigger a zero-downtime rolling deploy after pushing new code"
  value       = <<-EOT
    aws autoscaling start-instance-refresh \
      --region ${var.aws_region} \
      --auto-scaling-group-name ${aws_autoscaling_group.api.name} \
      --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}'
  EOT
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB + EC2)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (RDS + Redis)"
  value       = aws_subnet.private[*].id
}
