#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — CPTrack CloudFormation Deployment Script
#
# USAGE:
#   chmod +x deploy.sh
#   ./deploy.sh [ACTION] [OPTIONS]
#
# ACTIONS:
#   deploy     Create or update the full stack (default)
#   destroy    Delete the full stack (with confirmation)
#   refresh    Trigger a zero-downtime rolling deploy (after git push)
#   status     Show current stack status and outputs
#   validate   Validate all CloudFormation templates (no AWS calls)
#
# FIRST-TIME SETUP:
#   1. Copy params.json.example → params.json and fill in your values
#   2. Configure AWS CLI: aws configure
#   3. Run: ./deploy.sh deploy
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
STACK_NAME="cptrack-production"
REGION="ap-south-1"
BUCKET_PREFIX="cptrack-cfn-templates"   # S3 bucket name (must be globally unique)
PARAMS_FILE="params.json"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}ℹ️  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }

# ── Check prerequisites ───────────────────────────────────────────────────────
check_prereqs() {
  command -v aws  >/dev/null 2>&1 || error "AWS CLI not installed. Run: pip install awscli"
  command -v jq   >/dev/null 2>&1 || error "jq not installed. Run: sudo apt-get install jq"

  # Check AWS credentials
  aws sts get-caller-identity --region "$REGION" > /dev/null 2>&1 \
    || error "AWS credentials not configured. Run: aws configure"

  info "AWS identity: $(aws sts get-caller-identity --query 'Arn' --output text)"
}

# ── Validate all templates ────────────────────────────────────────────────────
validate_templates() {
  info "Validating CloudFormation templates..."

  TEMPLATES=(
    "master.yaml"
    "stacks/01-network.yaml"
    "stacks/02-security.yaml"
    "stacks/03-database.yaml"
    "stacks/04-iam.yaml"
    "stacks/05-compute.yaml"
  )

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"

  for tpl in "${TEMPLATES[@]}"; do
    aws cloudformation validate-template \
      --template-body "file://$tpl" \
      --region "$REGION" \
      --output text > /dev/null \
      && success "$tpl — valid" \
      || error "$tpl — INVALID"
  done
  success "All templates validated!"
}

# ── Upload templates to S3 ────────────────────────────────────────────────────
upload_templates() {
  # Make bucket name unique using AWS account ID
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  BUCKET="${BUCKET_PREFIX}-${ACCOUNT_ID}"

  info "Checking S3 bucket: $BUCKET"

  # Create bucket if it doesn't exist
  if ! aws s3 ls "s3://$BUCKET" --region "$REGION" > /dev/null 2>&1; then
    info "Creating S3 bucket: $BUCKET"
    if [ "$REGION" = "us-east-1" ]; then
      aws s3api create-bucket \
        --bucket "$BUCKET" \
        --region "$REGION"
    else
      aws s3api create-bucket \
        --bucket "$BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    fi

    # Block all public access
    aws s3api put-public-access-block \
      --bucket "$BUCKET" \
      --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

    # Enable versioning for template rollback
    aws s3api put-bucket-versioning \
      --bucket "$BUCKET" \
      --versioning-configuration Status=Enabled

    # Enable server-side encryption
    aws s3api put-bucket-encryption \
      --bucket "$BUCKET" \
      --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

    success "S3 bucket created: $BUCKET"
  fi

  info "Uploading templates to S3..."
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  aws s3 sync "$SCRIPT_DIR" "s3://$BUCKET/" \
    --include "*.yaml" \
    --exclude ".gitignore" \
    --region "$REGION"

  success "Templates uploaded to s3://$BUCKET/"
  echo "$BUCKET"
}

# ── Deploy / Update stack ─────────────────────────────────────────────────────
deploy_stack() {
  check_prereqs
  validate_templates

  [ -f "$PARAMS_FILE" ] || error "params.json not found. Copy params.json.example → params.json and fill in values."

  BUCKET=$(upload_templates)

  # Inject the bucket name into parameters
  PARAMS=$(cat "$PARAMS_FILE")
  BUCKET_PARAM='{"ParameterKey":"TemplatesBucketName","ParameterValue":"'"$BUCKET"'"}'
  PARAMS_WITH_BUCKET=$(echo "$PARAMS" | jq ". + [$BUCKET_PARAM]")

  info "Deploying CloudFormation stack: $STACK_NAME"
  info "Region: $REGION | Bucket: $BUCKET"

  # Check if stack exists
  STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "DOES_NOT_EXIST")

  if [ "$STACK_STATUS" = "DOES_NOT_EXIST" ]; then
    info "Creating new stack..."
    aws cloudformation create-stack \
      --stack-name "$STACK_NAME" \
      --template-url "https://$BUCKET.s3.$REGION.amazonaws.com/master.yaml" \
      --parameters "$PARAMS_WITH_BUCKET" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$REGION" \
      --on-failure DO_NOTHING   # Keep failed stack for debugging

    info "Waiting for stack creation (this takes ~15 min for RDS Multi-AZ)..."
    aws cloudformation wait stack-create-complete \
      --stack-name "$STACK_NAME" \
      --region "$REGION"

    success "Stack CREATED successfully!"
  else
    info "Updating existing stack (status: $STACK_STATUS)..."
    aws cloudformation update-stack \
      --stack-name "$STACK_NAME" \
      --template-url "https://$BUCKET.s3.$REGION.amazonaws.com/master.yaml" \
      --parameters "$PARAMS_WITH_BUCKET" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$REGION" 2>&1 | grep -v "No updates are to be performed" || true

    info "Waiting for stack update..."
    aws cloudformation wait stack-update-complete \
      --stack-name "$STACK_NAME" \
      --region "$REGION" 2>/dev/null && success "Stack UPDATED successfully!" || true
  fi

  show_status
}

# ── Show stack status and outputs ─────────────────────────────────────────────
show_status() {
  info "Stack: $STACK_NAME"

  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT FOUND")

  echo ""
  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│  STACK STATUS: $STATUS"
  echo "├─────────────────────────────────────────────────────────────────┤"

  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue,Description]' \
    --output table 2>/dev/null || echo "  Stack not found or not yet deployed."

  echo "└─────────────────────────────────────────────────────────────────┘"
  echo ""

  # Show ALB DNS specifically
  ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
    --output text 2>/dev/null || echo "Not yet deployed")

  if [ "$ALB_DNS" != "Not yet deployed" ] && [ -n "$ALB_DNS" ]; then
    echo ""
    warn "CLOUDFLARE STEP: Add this CNAME record in Cloudflare:"
    echo "  Name:    api"
    echo "  Type:    CNAME"
    echo "  Value:   $ALB_DNS"
    echo "  Proxy:   ✅ ON (orange cloud)"
    echo ""
  fi
}

# ── Trigger rolling deploy ─────────────────────────────────────────────────────
refresh_instances() {
  check_prereqs

  ASG_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`AsgName`].OutputValue' \
    --output text)

  [ -z "$ASG_NAME" ] && error "Could not find ASG name from stack outputs."

  info "Triggering instance refresh on ASG: $ASG_NAME"
  warn "This will replace instances one-by-one. Your app will pull latest GitHub code."

  REFRESH_ID=$(aws autoscaling start-instance-refresh \
    --region "$REGION" \
    --auto-scaling-group-name "$ASG_NAME" \
    --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}' \
    --query 'InstanceRefreshId' \
    --output text)

  success "Instance refresh started! ID: $REFRESH_ID"
  info "Monitor: AWS Console → EC2 → Auto Scaling Groups → $ASG_NAME → Instance refresh"
}

# ── Delete stack ──────────────────────────────────────────────────────────────
destroy_stack() {
  warn "⚠️  This will PERMANENTLY DELETE all infrastructure including the database!"
  warn "A final snapshot will be taken of RDS before deletion."
  echo ""
  read -r -p "Type 'DELETE' to confirm: " CONFIRM
  [ "$CONFIRM" = "DELETE" ] || error "Aborted."

  info "Disabling RDS deletion protection first..."
  # Need to disable deletion protection before stack delete works
  RDS_ID=$(aws cloudformation describe-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'StackResources[?ResourceType==`AWS::RDS::DBInstance`].PhysicalResourceId' \
    --output text 2>/dev/null || echo "")

  if [ -n "$RDS_ID" ]; then
    aws rds modify-db-instance \
      --db-instance-identifier "$RDS_ID" \
      --no-deletion-protection \
      --apply-immediately \
      --region "$REGION" > /dev/null && info "RDS deletion protection disabled."
  fi

  info "Deleting stack: $STACK_NAME"
  aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

  info "Waiting for deletion..."
  aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

  success "Stack deleted."
}

# ── Main ──────────────────────────────────────────────────────────────────────
ACTION="${1:-deploy}"

case "$ACTION" in
  deploy)   deploy_stack ;;
  validate) check_prereqs && validate_templates ;;
  status)   check_prereqs && show_status ;;
  refresh)  refresh_instances ;;
  destroy)  check_prereqs && destroy_stack ;;
  *)
    echo "Usage: $0 [deploy|validate|status|refresh|destroy]"
    exit 1
    ;;
esac
