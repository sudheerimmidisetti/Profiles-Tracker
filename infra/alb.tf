# ── ACM Certificate for api.dealance.app ─────────────────────────────────────
# ALB needs an SSL cert to terminate HTTPS from Cloudflare (Full Strict mode)
resource "aws_acm_certificate" "api" {
  domain_name       = "${var.api_subdomain}.${var.domain}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true   # Required for cert rotation without downtime
  }

  tags = { Name = "${var.app_name}-acm-cert" }
}

# ── Validate cert via Cloudflare DNS record ───────────────────────────────────
resource "cloudflare_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.value
  ttl     = 60
  proxied = false   # Validation records must NOT be proxied
}

# Wait until ACM validates the cert (checks the DNS record every 5s)
resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in cloudflare_record.acm_validation : record.hostname]
}

# ── Application Load Balancer ─────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false          # Internet-facing (Cloudflare → ALB)
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id   # Both public subnets = multi-AZ

  enable_deletion_protection       = true   # Prevent accidental `terraform destroy`
  enable_cross_zone_load_balancing = true   # Traffic balanced across all AZs
  enable_http2                     = true

  # Access logs to S3 (optional — uncomment if needed)
  # access_logs {
  #   bucket  = aws_s3_bucket.alb_logs.id
  #   prefix  = "alb"
  #   enabled = true
  # }

  tags = { Name = "${var.app_name}-alb" }
}

# ── Target Group ──────────────────────────────────────────────────────────────
resource "aws_lb_target_group" "api" {
  name        = "${var.app_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    port                = "3000"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  # Drain connections before deregistering (rolling deploys)
  deregistration_delay = 30

  stickiness {
    type    = "lb_cookie"
    enabled = false   # Not needed — JWT is stateless
  }

  tags = { Name = "${var.app_name}-tg" }
}

# ── ALB Listeners ─────────────────────────────────────────────────────────────

# HTTP → HTTPS redirect (Cloudflare always sends HTTPS, but belt-and-suspenders)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener — terminates SSL with ACM cert, forwards to Target Group
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"   # TLS 1.2 + 1.3 only
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
