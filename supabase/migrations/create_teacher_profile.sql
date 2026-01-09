-- Create or update profile for the teacher user
-- User ID: a66ecc97-6982-4cb7-b548-34a53c52ceeb
-- Email: ukamolxodjayev@gmail.com

-- First, check if profile exists
-- If not, insert it
INSERT INTO profiles (id, username, role, created_by, initial_password)
VALUES (
  'a66ecc97-6982-4cb7-b548-34a53c52ceeb',
  'ukamolxodjayev',
  'teacher',
  NULL,
  'mahliyo_teacher_admin'
)
ON CONFLICT (id) 
DO UPDATE SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  initial_password = EXCLUDED.initial_password;
