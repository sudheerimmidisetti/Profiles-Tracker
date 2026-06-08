#!/bin/bash
# ── User Data Script ──────────────────────────────────────────────────────────
# Runs on EVERY new EC2 instance launched by the Auto Scaling Group.
# Template variables (filled by Terraform templatefile()):
#   ${app_name}    = cptrack
#   ${aws_region}  = ap-south-1
#   ${secret_name} = cptrack/production
#   ${github_repo} = PrasannaReddy0583/profiles_tracker
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
exec > >(tee /var/log/user-data.log | logger -t user-data) 2>&1

echo "=== CPTrack EC2 Bootstrap starting: $(date) ==="

# ── System update ─────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y curl git jq awscli

# ── Node.js 20 LTS ────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "Node $(node -v), npm $(npm -v)"

# ── PM2 ───────────────────────────────────────────────────────────────────────
npm install -g pm2
echo "PM2 $(pm2 --version)"

# ── Clone app from GitHub ─────────────────────────────────────────────────────
cd /home/ubuntu
git clone https://github.com/${github_repo}.git cptrack
cd cptrack/backend
npm install --production
echo "✅ App cloned and dependencies installed"

# ── Fetch secrets from AWS Secrets Manager ────────────────────────────────────
echo "Fetching secrets from Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --region ${aws_region} \
  --secret-id "${secret_name}" \
  --query SecretString \
  --output text)

# Write .env from Secrets Manager JSON
echo "$SECRET_JSON" | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /home/ubuntu/cptrack/backend/.env
chmod 600 /home/ubuntu/cptrack/backend/.env
echo "✅ Secrets written to .env"

# ── Run DB migration (only runs if tables don't exist — idempotent) ───────────
# IMPORTANT: Only the FIRST instance should run migration.
# We use a Redis lock for the sync job, but migration is safe to run
# multiple times because it uses CREATE TABLE IF NOT EXISTS.
echo "Running DB migration..."
cd /home/ubuntu/cptrack/backend
node src/migrations/runMigration.js || echo "⚠️ Migration already applied or failed — continuing"

# ── Start Node.js via PM2 ─────────────────────────────────────────────────────
cd /home/ubuntu/cptrack/backend
NODE_ENV=production pm2 start src/server.js \
  --name "${app_name}-api" \
  --instances 1 \
  --max-memory-restart 512M \
  --exp-backoff-restart-delay=100

# Configure PM2 to restart on system reboot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash
pm2 save

echo "✅ CPTrack API started via PM2"

# ── CloudWatch Agent ──────────────────────────────────────────────────────────
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# CloudWatch config: ship PM2 logs
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWCONFIG'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ubuntu/.pm2/logs/${app_name}-api-out.log",
            "log_group_name": "/${app_name}/api/stdout",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Kolkata"
          },
          {
            "file_path": "/home/ubuntu/.pm2/logs/${app_name}-api-error.log",
            "log_group_name": "/${app_name}/api/stderr",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Kolkata"
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "/${app_name}/ec2/user-data",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Kolkata"
          }
        ]
      }
    }
  }
}
CWCONFIG

systemctl start amazon-cloudwatch-agent
systemctl enable amazon-cloudwatch-agent

echo "=== Bootstrap complete: $(date) ==="
echo "API should be up at http://localhost:3000/health"
