-- Migration 007: Admin authentication tables
-- Admin users who can log in via email+OTP

CREATE TABLE IF NOT EXISTS admin_users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  added_by   VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active  BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS admin_otps (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  otp_hash   VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_otps_email ON admin_otps(email);

-- Seed first admin
INSERT INTO admin_users (email, added_by)
VALUES ('prasannareddy385@gmail.com', 'system')
ON CONFLICT (email) DO NOTHING;
