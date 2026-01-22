-- Fix RLS policies for playlists and related tables
-- This migration ensures all policies are properly set up without conflicts

-- Drop ALL existing policies on playlists table to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'playlists') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON playlists', r.policyname);
    END LOOP;
END $$;

-- Recreate policies for playlists with proper logic
-- Teachers can view their own playlists (MUST be first to avoid conflicts)
CREATE POLICY "Teachers can view their own playlists"
  ON playlists FOR SELECT
  USING (teacher_id = auth.uid());

-- Teachers can create playlists
CREATE POLICY "Teachers can create playlists"
  ON playlists FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can update their own playlists
CREATE POLICY "Teachers can update their own playlists"
  ON playlists FOR UPDATE
  USING (teacher_id = auth.uid());

-- Teachers can delete their own playlists
CREATE POLICY "Teachers can delete their own playlists"
  ON playlists FOR DELETE
  USING (teacher_id = auth.uid());

-- Students can view all playlists (simplified - allow all authenticated users)
-- Note: Teachers will match the "Teachers can view their own playlists" policy first
CREATE POLICY "Students can view all playlists"
  ON playlists FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Drop ALL existing policies on playlist_tests table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'playlist_tests') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON playlist_tests', r.policyname);
    END LOOP;
END $$;

-- Recreate policies for playlist_tests
-- Teachers can view playlist_tests for their playlists (check teacher_id directly to avoid circular deps)
CREATE POLICY "Teachers can view playlist_tests for their playlists"
  ON playlist_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tests.playlist_id
      AND p.teacher_id = auth.uid()
    )
  );

-- Students can view all playlist_tests (simplified - allow all authenticated users)
CREATE POLICY "Students can view all playlist_tests"
  ON playlist_tests FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Teachers can manage playlist_tests for their playlists
CREATE POLICY "Teachers can manage playlist_tests for their playlists"
  ON playlist_tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tests.playlist_id
      AND p.teacher_id = auth.uid()
    )
  );

-- Drop and recreate course_playlists policies to ensure consistency
DROP POLICY IF EXISTS "Teachers can manage course_playlists for their courses" ON course_playlists;
DROP POLICY IF EXISTS "Students can view course_playlists for their courses" ON course_playlists;
DROP POLICY IF EXISTS "Students can view all course_playlists" ON course_playlists;

-- Teachers can manage course_playlists for their courses
CREATE POLICY "Teachers can manage course_playlists for their courses"
  ON course_playlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_playlists.course_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Students can view all course_playlists
CREATE POLICY "Students can view all course_playlists"
  ON course_playlists FOR SELECT
  USING (true);
