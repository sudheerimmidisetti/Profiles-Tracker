-- 007_students_passout_year.sql
-- Add passout_year to students table (populated from Maya college API)
ALTER TABLE students ADD COLUMN IF NOT EXISTS passout_year INTEGER;
