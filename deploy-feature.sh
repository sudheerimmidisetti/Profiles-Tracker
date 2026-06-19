#!/bin/bash
# deploy-feature.sh — deploys Cron UI + Contests tab
# Run this on your EC2 server:
#   bash deploy-feature.sh

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }

REPO_DIR="/home/ubuntu/app"     # adjust to your actual path
STATIC_DIR="/var/www"            # adjust to your nginx document root

info "1. Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

info "2. Running DB migration (system_settings table)..."
# Use your actual DATABASE_URL or psql connection
DB_URL=$(grep DATABASE_URL /home/ubuntu/app/backend/.env | cut -d= -f2-)
psql "$DB_URL" -f backend/src/migrations/012_cron_settings.sql || \
  warn "Migration may already exist (ON CONFLICT clause handles this)"

info "3. Restarting backend via PM2..."
cd backend
npm ci --omit=dev
pm2 restart all || pm2 start ecosystem.config.js
pm2 save

info "4. Building admin frontend..."
cd ../frontend/admin
npm ci
npm run build

info "5. Building student frontend..."
cd ../student
npm ci
npm run build

info "6. Copying dist to nginx static dirs (adjust paths if needed)..."
# Uncomment and adjust these lines to match your nginx setup:
# sudo cp -r /home/ubuntu/app/frontend/admin/dist/*   /var/www/admin/
# sudo cp -r /home/ubuntu/app/frontend/student/dist/* /var/www/student/
# sudo nginx -s reload

info "✅ Done! Check PM2 status:"
pm2 status
