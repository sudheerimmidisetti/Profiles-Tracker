-- 012_cron_settings.sql
-- Adds system_settings table for storing admin-configurable key/value pairs.
-- First use: sync cron schedule (allows live rescheduling from admin UI).

CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(150)
);

-- Seed default cron schedule (same as env var default)
INSERT INTO system_settings (key, value)
  VALUES ('sync_cron', '0 20 * * *')   -- 8:00 PM UTC = 1:30 AM IST next day
  ON CONFLICT (key) DO NOTHING;
