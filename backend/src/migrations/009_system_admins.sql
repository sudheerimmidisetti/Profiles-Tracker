-- Migration 009: System admin protection
-- Adds is_system_admin flag so these accounts can never be removed
-- and can remove any other admin regardless of who added them.

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed the two system admins (won't break if they already exist)
INSERT INTO admin_users (email, added_by, is_system_admin)
VALUES
  ('prasannareddy385@gmail.com', 'system', TRUE),
  ('sudheerimmidisetti@gmail.com', 'system', TRUE)
ON CONFLICT (email) DO UPDATE SET
  is_system_admin = TRUE,
  is_active       = TRUE;
