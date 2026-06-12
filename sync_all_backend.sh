#!/usr/bin/env bash
# =============================================================================
# sync_all_backend.sh
# =============================================================================
# ONE-COMMAND: Pull latest code, apply all pending DB migrations, restart the
# API server, and trigger a full profile sync (oldest→present) for every
# verified student across all four platforms.
#
# Usage (on the EC2 server):
#   chmod +x sync_all_backend.sh
#   ./sync_all_backend.sh
#
# Run without sync (deploy only):
#   SKIP_SYNC=true ./sync_all_backend.sh
#
# Run migrations only (no deploy, no sync):
#   MIGRATE_ONLY=true ./sync_all_backend.sh
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
header()  { echo -e "\n${BOLD}══════════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}  $*${NC}"; \
            echo -e "${BOLD}══════════════════════════════════════════════${NC}"; }

# ── Config (all from environment — no hardcoding) ────────────────────────────
APP_DIR="${APP_DIR:-/home/ubuntu/cptrack}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend}"
PM2_APP="${PM2_APP:-cptrack-api}"
GIT_BRANCH="${GIT_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
SKIP_SYNC="${SKIP_SYNC:-false}"
MIGRATE_ONLY="${MIGRATE_ONLY:-false}"

# ── Preflight checks ─────────────────────────────────────────────────────────
header "Pre-flight checks"

if [[ ! -d "$APP_DIR" ]]; then
  error "APP_DIR not found: $APP_DIR"
  error "Set APP_DIR env var to the project root and retry."
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  error "No .env found at $BACKEND_DIR/.env"
  error "Copy .env.production.example → .env and fill in secrets."
  exit 1
fi

# Load .env into current shell (for DATABASE_URL, etc.)
set -a
# shellcheck disable=SC1090
source "$BACKEND_DIR/.env"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  error "DATABASE_URL is not set in .env"
  exit 1
fi

# Check required tools
for cmd in node npm git pm2 psql; do
  if ! command -v "$cmd" &>/dev/null; then
    error "Required tool '$cmd' not found in PATH"
    exit 1
  fi
done

success "Pre-flight checks passed"
info "APP_DIR    = $APP_DIR"
info "BACKEND    = $BACKEND_DIR"
info "PM2 app    = $PM2_APP"
info "Git branch = $GIT_BRANCH"

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
if [[ "$MIGRATE_ONLY" != "true" ]]; then
  header "Step 1 · Pull latest code"
  cd "$APP_DIR"
  git fetch origin
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$GIT_BRANCH")
  if [[ "$LOCAL" == "$REMOTE" ]]; then
    info "Already up-to-date ($(git log -1 --format='%h %s'))"
  else
    info "Pulling changes…"
    git pull origin "$GIT_BRANCH"
    success "Pulled: $(git log -1 --format='%h %s')"
  fi
else
  info "MIGRATE_ONLY=true — skipping git pull"
fi

# ── Step 2: Install backend dependencies ─────────────────────────────────────
if [[ "$MIGRATE_ONLY" != "true" ]]; then
  header "Step 2 · Install backend dependencies"
  cd "$BACKEND_DIR"
  npm install --omit=dev --silent
  success "npm install complete"
fi

# ── Step 3: Apply pending database migrations ─────────────────────────────────
header "Step 3 · Database migrations"
cd "$BACKEND_DIR"
info "Running migration runner (idempotent — safe to re-run)…"
node src/migrations/runMigration.js
success "Migrations complete"

if [[ "$MIGRATE_ONLY" == "true" ]]; then
  success "MIGRATE_ONLY mode — stopping here."
  exit 0
fi

# ── Step 4: Restart API server ────────────────────────────────────────────────
header "Step 4 · Restart API server"
cd "$BACKEND_DIR"

if pm2 list | grep -q "$PM2_APP"; then
  pm2 restart "$PM2_APP" --update-env
  success "PM2 restarted $PM2_APP"
else
  warn "PM2 process '$PM2_APP' not found — starting fresh"
  pm2 start src/server.js --name "$PM2_APP" \
    --log "$LOG_DIR/api.log" \
    --time
  success "PM2 started $PM2_APP"
fi

# Wait for API to be ready
info "Waiting for API to be ready…"
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT:-3000}/health" | grep -q "200"; then
    success "API is up (attempt $i)"
    break
  fi
  if [[ $i -eq 15 ]]; then
    warn "API health check didn't return 200 after 15s — check PM2 logs"
    pm2 logs "$PM2_APP" --lines 20 --nostream
  fi
  sleep 1
done

# ── Step 5: Full profile sync ─────────────────────────────────────────────────
if [[ "$SKIP_SYNC" == "true" ]]; then
  info "SKIP_SYNC=true — skipping profile sync"
  header "Done"
  success "Deploy complete. Sync was skipped."
  exit 0
fi

header "Step 5 · Full profile sync (oldest → present)"
info "Syncing all verified students across LeetCode / Codeforces / CodeChef / HackerRank…"
info "This can take 10–45 minutes depending on student count and rate limits."
info "Progress is streamed below. Ctrl-C to cancel (partial sync is safe)."
echo ""

mkdir -p "$LOG_DIR"
SYNC_LOG="$LOG_DIR/sync_$(date +%Y%m%d_%H%M%S).log"

cd "$BACKEND_DIR"
node -e "
require('dotenv').config();
const { syncAllStudents } = require('./src/jobs/syncProfiles.job.js');
syncAllStudents()
  .then(() => { console.log('\\n✅  Full sync complete'); process.exit(0); })
  .catch(e  => { console.error('\\n❌  Sync failed:', e.message); process.exit(1); });
" 2>&1 | tee "$SYNC_LOG"

SYNC_EXIT=${PIPESTATUS[0]}

echo ""
if [[ $SYNC_EXIT -eq 0 ]]; then
  success "Sync complete. Log saved to: $SYNC_LOG"
else
  error "Sync exited with code $SYNC_EXIT. Check log: $SYNC_LOG"
  exit $SYNC_EXIT
fi

# ── Step 6: Post-sync DB backfill (derived data) ──────────────────────────────
header "Step 6 · Post-sync data backfill"
info "Backfilling derived fields from existing data…"

# Parse DB connection parts from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
DB_URL="${DATABASE_URL}"
DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|; s|postgresql://.*|\1|' | grep -E '^[0-9]+$' || echo "5432")
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
PGPASSWORD_EXTRACTED=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

run_sql() {
  PGPASSWORD="$PGPASSWORD_EXTRACTED" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -q \
    -c "$1"
}

# 6a. Backfill Codeforces problems_solved from student_submissions
info "  → CF: backfilling problems_solved per contest from submissions…"
run_sql "
UPDATE codeforces_contest_history ch
SET problems_solved = sub.cnt
FROM (
  SELECT
    student_email,
    split_part(problem_id, '-', 1)::integer AS contest_id,
    COUNT(DISTINCT problem_id) AS cnt
  FROM student_submissions
  WHERE platform = 'codeforces'
    AND status = 'AC'
    AND problem_id ~ '^[0-9]+-[A-Z]'
  GROUP BY student_email, split_part(problem_id, '-', 1)
) sub
WHERE ch.student_email = sub.student_email
  AND ch.contest_id    = sub.contest_id
  AND sub.cnt > 0;
" && success "  CF problems_solved backfill done" || warn "  CF problems_solved backfill skipped/failed"

# 6b. Backfill CodeChef problems_solved_count from student_submissions (contest_id column)
info "  → CC: backfilling problems_solved_count per contest from submissions…"
run_sql "
UPDATE codechef_contest_history ch
SET problems_solved_count = sub.cnt
FROM (
  SELECT
    student_email,
    contest_id,
    COUNT(DISTINCT problem_id) AS cnt
  FROM student_submissions
  WHERE platform = 'codechef'
    AND status = 'AC'
    AND contest_id IS NOT NULL
    AND contest_id != ''
  GROUP BY student_email, contest_id
) sub
WHERE ch.student_email = sub.student_email
  AND ch.contest_code  = sub.contest_id
  AND sub.cnt > 0;
" && success "  CC problems_solved_count backfill done" || warn "  CC problems_solved_count backfill skipped/failed"

# 6c. Backfill CodeChef division where NULL using contest name + rating
info "  → CC: backfilling NULL division values…"
run_sql "
UPDATE codechef_contest_history
SET division =
  CASE
    WHEN contest_name ~* 'div(?:ision)?\s*1' THEN 'Div 1'
    WHEN contest_name ~* 'div(?:ision)?\s*2' THEN 'Div 2'
    WHEN contest_name ~* 'div(?:ision)?\s*3' THEN 'Div 3'
    WHEN contest_name ~* 'div(?:ision)?\s*4' THEN 'Div 4'
    WHEN rating_after_contest >= 2000 THEN 'Div 1'
    WHEN rating_after_contest >= 1600 THEN 'Div 2'
    WHEN rating_after_contest >= 1400 THEN 'Div 3'
    ELSE 'Div 4'
  END
WHERE division IS NULL OR division = '';
" && success "  CC division backfill done" || warn "  CC division backfill skipped/failed"

# ── Summary ───────────────────────────────────────────────────────────────────
header "All done 🎉"
echo ""
echo -e "  ${GREEN}✅  Code deployed${NC}   ($(cd "$APP_DIR" && git log -1 --format='%h %s'))"
echo -e "  ${GREEN}✅  Migrations run${NC}  (idempotent — all SQL files applied)"
echo -e "  ${GREEN}✅  API restarted${NC}   (pm2: $PM2_APP)"
echo -e "  ${GREEN}✅  Sync complete${NC}   (log: $SYNC_LOG)"
echo -e "  ${GREEN}✅  Backfill done${NC}   (derived stats refreshed)"
echo ""
pm2 status "$PM2_APP"
