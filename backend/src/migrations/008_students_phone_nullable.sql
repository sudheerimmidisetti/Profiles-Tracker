-- 008_students_phone_nullable.sql
-- Maya college API does not return phone numbers, so phone must be nullable
ALTER TABLE students ALTER COLUMN phone DROP NOT NULL;
