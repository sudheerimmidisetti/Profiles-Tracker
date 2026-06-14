-- 012_handle_update_requests.sql
-- Table for students requesting handle updates after initial verification.
-- Admin must approve before handles are changed + synced.

CREATE TABLE IF NOT EXISTS handle_update_requests (
  id              SERIAL PRIMARY KEY,
  student_email   TEXT        NOT NULL REFERENCES students(email) ON DELETE CASCADE,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT,         -- admin email who reviewed
  reject_reason   TEXT,

  -- Proposed new handles (any may be NULL = keep current / leave empty)
  lc_handle       TEXT,
  cf_handle       TEXT,
  cc_handle       TEXT,
  hr_handle       TEXT,

  -- Snapshot of current handles at request time (for diff display in admin)
  lc_handle_old   TEXT,
  cf_handle_old   TEXT,
  cc_handle_old   TEXT,
  hr_handle_old   TEXT
);

-- Only one PENDING request per student at a time
CREATE UNIQUE INDEX IF NOT EXISTS handle_update_requests_pending_unique
  ON handle_update_requests (student_email)
  WHERE status = 'pending';

-- Index for admin listing
CREATE INDEX IF NOT EXISTS handle_update_requests_status_idx
  ON handle_update_requests (status, requested_at DESC);
