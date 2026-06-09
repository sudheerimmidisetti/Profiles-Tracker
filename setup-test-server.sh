#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CPTrack — Single EC2 Test Server Setup
# Run this as ubuntu user on a fresh Ubuntu 22.04 EC2
# Usage: bash setup-test-server.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── CONFIGURE THESE BEFORE RUNNING ────────────────────────────────────────────
DB_PASSWORD="changeme_strong_password_here"   # PostgreSQL password
JWT_SECRET=""                                  # Fill: openssl rand -hex 64
ADMIN_SECRET=""                                # Fill: openssl rand -hex 16
SMTP_USER=""                                   # SES SMTP username (AKIAxxxxx)
SMTP_PASS=""                                   # SES SMTP password
DOMAIN="dealance.app"                          # Your domain
GITHUB_REPO="PrasannaReddy0583/profiles_tracker"
COLLEGE_DOMAINS="@acet.ac.in,@aec.edu.in,@adityauniversity.in"
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}▶ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}✗  $*${NC}"; exit 1; }

# Check required vars
[ -z "$JWT_SECRET" ]   && error "JWT_SECRET is empty. Run: openssl rand -hex 64"
[ -z "$ADMIN_SECRET" ] && error "ADMIN_SECRET is empty. Run: openssl rand -hex 16"
[ -z "$SMTP_USER" ]    && error "SMTP_USER is empty. Get from SES → SMTP settings"
[ -z "$SMTP_PASS" ]    && error "SMTP_PASS is empty. Get from SES → SMTP settings"

info "=== CPTrack Test Server Setup ==="

# ── System packages ────────────────────────────────────────────────────────────
info "Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

# ── Node.js 20 LTS ────────────────────────────────────────────────────────────
info "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node $(node -v) | npm $(npm -v)"

# ── PM2 ───────────────────────────────────────────────────────────────────────
info "Installing PM2..."
sudo npm install -g pm2

# ── PostgreSQL 15 ─────────────────────────────────────────────────────────────
info "Installing PostgreSQL 15..."
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create DB user and database
info "Creating PostgreSQL database..."
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cptrack') THEN
    CREATE USER cptrack WITH PASSWORD '$DB_PASSWORD';
  END IF;
END \$\$;

SELECT 'CREATE DATABASE coding_tracker OWNER cptrack'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'coding_tracker')\gexec

GRANT ALL PRIVILEGES ON DATABASE coding_tracker TO cptrack;
SQL

info "PostgreSQL ready ✅"

# ── Redis ─────────────────────────────────────────────────────────────────────
info "Installing Redis..."
sudo apt-get install -y redis-server

# Configure Redis — bind to localhost only, no password for local testing
sudo sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

sudo systemctl start redis-server
sudo systemctl enable redis-server
redis-cli ping | grep -q PONG && info "Redis ready ✅" || warn "Redis may not be running"

# ── Clone app ─────────────────────────────────────────────────────────────────
info "Cloning repository..."
cd /home/ubuntu
if [ -d "cptrack" ]; then
  cd cptrack && git pull && cd ..
  info "Repo updated"
else
  git clone https://github.com/$GITHUB_REPO.git cptrack
  info "Repo cloned"
fi

cd /home/ubuntu/cptrack/backend
npm install --production

# ── Write .env ────────────────────────────────────────────────────────────────
info "Writing .env..."
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

cat > /home/ubuntu/cptrack/backend/.env << ENV
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://cptrack:${DB_PASSWORD}@localhost:5432/coding_tracker
REDIS_URL=redis://localhost:6379

JWT_SECRET=${JWT_SECRET}
ADMIN_SECRET=${ADMIN_SECRET}

SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
FROM_EMAIL=noreply@${DOMAIN}

COLLEGE_EMAIL_DOMAINS=${COLLEGE_DOMAINS}
CORS_ORIGIN=https://tracker.${DOMAIN},https://admin.${DOMAIN},http://localhost:5173,http://localhost:5174

API_BASE_URL=https://api.${DOMAIN}
ENV

chmod 600 /home/ubuntu/cptrack/backend/.env
info ".env written ✅"

# ── Run DB migration ──────────────────────────────────────────────────────────
info "Running database migration..."
cd /home/ubuntu/cptrack/backend
node src/migrations/runMigration.js \
  && info "Migration done ✅" \
  || warn "Migration had an issue — check manually"

# ── Start app with PM2 ────────────────────────────────────────────────────────
info "Starting app with PM2..."
pm2 delete cptrack-api 2>/dev/null || true
NODE_ENV=production pm2 start src/server.js \
  --name "cptrack-api" \
  --instances 1 \
  --max-memory-restart 400M

pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
pm2 save

# ── Nginx reverse proxy ───────────────────────────────────────────────────────
info "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/cptrack << 'NGINX'
server {
    listen 80;
    server_name api.dealance.app;

    # Trust Cloudflare real IP headers
    real_ip_header    CF-Connecting-IP;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/cptrack /etc/nginx/sites-enabled/cptrack
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
info "Nginx configured ✅"

# ── Firewall ──────────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
info "UFW enabled ✅"

# ── Final status ──────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ CPTrack Test Server Ready!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  PM2 status:   $(pm2 info cptrack-api | grep 'status' | head -1)"
echo "  Health check: curl http://localhost:3000/health"
echo "  Public IP:    $PUBLIC_IP"
echo ""
echo "  Next steps:"
echo "  1. Add Cloudflare CNAME: api → $PUBLIC_IP (Proxied ON)"
echo "  2. Test: curl https://api.dealance.app/health"
echo ""
echo "  Useful commands:"
echo "    pm2 logs cptrack-api      ← live logs"
echo "    pm2 restart cptrack-api   ← restart"
echo "    sudo -u postgres psql coding_tracker  ← DB shell"
echo "══════════════════════════════════════════════════════"
