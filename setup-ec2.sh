#!/bin/bash
# ==============================================================
# CPTrack EC2 Setup Script — Cloudflare Edition
# Ubuntu 22.04 | Domain: api.dealance.app (via Cloudflare proxy)
# Monorepo structure: backend/ + frontend/
#
# Usage:
#   chmod +x setup-ec2.sh && ./setup-ec2.sh
# ==============================================================

set -e
echo "🚀 Starting CPTrack EC2 setup (Cloudflare edition)..."

# ── 1. System ─────────────────────────────────────────────────
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y git curl wget unzip build-essential openssl

# ── 2. Node.js 20 LTS ─────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "✅ Node $(node --version)"

# ── 3. PostgreSQL 15 ──────────────────────────────────────────
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# CHANGE THIS PASSWORD:
DB_PASS="CHANGE_THIS_DB_PASSWORD"

sudo -u postgres psql <<SQL
CREATE USER cptrack WITH ENCRYPTED PASSWORD '${DB_PASS}';
CREATE DATABASE coding_tracker OWNER cptrack;
GRANT ALL PRIVILEGES ON DATABASE coding_tracker TO cptrack;
\q
SQL
echo "✅ PostgreSQL ready"

# ── 4. Redis ──────────────────────────────────────────────────
sudo apt-get install -y redis-server
sudo systemctl enable redis-server && sudo systemctl start redis-server
echo "✅ Redis $(redis-cli ping)"

# ── 5. Nginx ──────────────────────────────────────────────────
sudo apt-get install -y nginx
sudo systemctl enable nginx

# ── 6. Self-signed SSL for Cloudflare → EC2 tunnel ───────────
# Cloudflare proxies your domain; EC2 needs any SSL cert on 443.
# Cloudflare "Full" mode accepts self-signed. No Certbot needed.
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/cptrack.key \
  -out    /etc/ssl/certs/cptrack.crt \
  -subj   "/CN=api.dealance.app/O=CPTrack/C=IN"
echo "✅ Self-signed cert created"

# ── 7. Nginx config ───────────────────────────────────────────
sudo tee /etc/nginx/sites-available/cptrack > /dev/null <<'NGINX'
# Redirect HTTP → HTTPS (Cloudflare also enforces this)
server {
    listen 80;
    server_name api.dealance.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.dealance.app;

    ssl_certificate     /etc/ssl/certs/cptrack.crt;
    ssl_certificate_key /etc/ssl/private/cptrack.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Pass real visitor IP from Cloudflare headers
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    real_ip_header CF-Connecting-IP;

    # Security headers
    add_header X-Frame-Options        "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy        "strict-origin-when-cross-origin";

    # Proxy to Node.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/cptrack /etc/nginx/sites-enabled/
sudo rm -f  /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
# ── 7. PM2 ────────────────────────────────────────────────────
sudo npm install -g pm2
echo "✅ PM2 $(pm2 --version)"

# ── 8. Clone app ─────────────────────────────────────────────────────────────
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/cptrack.git
cd cptrack/backend                   # ← backend is in the backend/ folder
npm install --production

echo ""
echo "✅ Dependencies installed"
echo ""

# ── 9. Run DB migration ─────────────────────────────────────────────────
PGPASSWORD="${DB_PASS}" psql \
  -U cptrack -d coding_tracker -h localhost \
  -f src/migrations/001_initial_schema.sql
echo "✅ DB schema created"

# ── 10. Copy Nginx config ─────────────────────────────────────────────────
cd /home/ubuntu/cptrack               # back to repo root for nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/cptrack
sudo ln -sf /etc/nginx/sites-available/cptrack /etc/nginx/sites-enabled/
sudo rm -f  /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configured"

echo ""
echo "========================================================"
echo "✅ Setup complete!"
echo ""
echo "NEXT STEPS:"
echo "1.  cd /home/ubuntu/cptrack/backend"
echo "2.  cp .env.example .env && nano .env"
echo "3.  Fill in JWT_SECRET, ADMIN_SECRET, SMTP creds"
echo "4.  pm2 start src/server.js --name cptrack-api"
echo "5.  pm2 startup && pm2 save"
echo "6.  Test: curl https://api.dealance.app/health"
echo ""
echo "Cloudflare settings:"
echo "  SSL/TLS → Full  (not Full Strict)"
echo "  api.dealance.app A record → $(curl -s ifconfig.me) (proxied)"
echo "========================================================"
