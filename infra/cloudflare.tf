# ── Cloudflare DNS: api.dealance.app → ALB ───────────────────────────────────
# CNAME points to the ALB DNS name (never an EC2 IP — those change with ASG)
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_subdomain   # "api" → creates api.dealance.app
  type    = "CNAME"
  content = aws_lb.main.dns_name   # e.g. cptrack-alb-1234.ap-south-1.elb.amazonaws.com
  proxied = true                    # ✅ Orange cloud ON = Cloudflare proxies the traffic
  ttl     = 1                       # TTL = 1 means "automatic" when proxied

  comment = "CPTrack API — points to AWS ALB. Managed by Terraform."

  depends_on = [aws_lb.main]
}

# ── Cloudflare SSL/TLS Mode ───────────────────────────────────────────────────
# Full (Strict) = Cloudflare validates the ALB's ACM certificate.
# This requires a valid cert on the ALB — which we set up in alb.tf.
resource "cloudflare_zone_settings_override" "dealance" {
  zone_id = var.cloudflare_zone_id

  settings {
    # SSL mode: Full Strict = validates the cert on origin (ALB has ACM cert)
    ssl = "strict"

    # Always use HTTPS
    always_use_https = "on"

    # Minimum TLS 1.2
    min_tls_version = "1.2"

    # Enable TLS 1.3
    tls_1_3 = "zrt"   # "zrt" = enabled with 0-RTT

    # HTTP/2 and HTTP/3 (QUIC) for performance
    http2 = "on"
    http3 = "on"

    # Security headers (additional to what Nginx adds)
    security_header {
      enabled            = true
      include_subdomains = true
      max_age            = 31536000
      nosniff            = true
      preload            = true
    }

    # Browser Cache TTL for API responses (short — API returns fresh data)
    browser_cache_ttl = 0   # No browser caching for API

    # Bot fight mode
    brotli = "on"

    # Security level (medium = balanced)
    security_level = "medium"

    # Challenge TTL
    challenge_ttl = 1800

    # IP geolocation header (useful for analytics)
    ip_geolocation = "on"

    # Rocket loader — OFF for API (only useful for HTML pages)
    rocket_loader = "off"
  }
}

# ── Cloudflare Firewall Rules (WAF) ──────────────────────────────────────────
# Block requests that don't look like legitimate API traffic

resource "cloudflare_ruleset" "api_firewall" {
  zone_id     = var.cloudflare_zone_id
  name        = "CPTrack API Firewall"
  description = "Rate limiting and bot protection for api.dealance.app"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "block"
    description = "Block requests missing User-Agent (bot indicator)"
    expression  = <<-EOT
      (http.host eq "api.dealance.app" and 
       http.user_agent eq "" and
       not cf.client.bot)
    EOT
    enabled = true
  }
}

# ── Cloudflare Rate Limiting ──────────────────────────────────────────────────
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "CPTrack Rate Limiting"
  description = "Rate limit API endpoints"
  kind        = "zone"
  phase       = "http_ratelimit"

  # Auth endpoints: 20 req/min per IP (prevent brute force)
  rules {
    action      = "block"
    description = "Rate limit auth endpoints"
    expression  = <<-EOT
      (http.host eq "api.dealance.app" and 
       http.request.uri.path matches "^/api/auth/")
    EOT
    action_parameters {
      response {
        status_code  = 429
        content_type = "application/json"
        content      = "{\"success\":false,\"message\":\"Too many requests. Please slow down.\"}"
      }
    }
    ratelimit {
      characteristics = ["cf.colo.id", "ip.src"]
      period          = 60
      requests_per_period = 20
      mitigation_timeout  = 60
    }
    enabled = true
  }

  # General API: 200 req/min per IP
  rules {
    action      = "block"
    description = "General API rate limit"
    expression  = "(http.host eq \"api.dealance.app\")"
    action_parameters {
      response {
        status_code  = 429
        content_type = "application/json"
        content      = "{\"success\":false,\"message\":\"Too many requests.\"}"
      }
    }
    ratelimit {
      characteristics = ["cf.colo.id", "ip.src"]
      period          = 60
      requests_per_period = 200
      mitigation_timeout  = 60
    }
    enabled = true
  }
}
