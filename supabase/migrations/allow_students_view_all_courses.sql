-- Allow students to view all courses (just like tests)
DROP POLICY IF EXISTS "Students can view all courses" ON courses;
CREATE POLICY "Students can view all courses"
  ON courses FOR SELECT
  USING (true);

-- Allow students to view all course_playlists (not just their own)
DROP POLICY IF EXISTS "Students can view all course_playlists" ON course_playlists;
CREATE POLICY "Students can view all course_playlists"
  ON course_playlists FOR SELECT
  USING (true);

-- Allow students to view all lesson playlists (not just their own)
DROP POLICY IF EXISTS "Students can view all lesson playlists" ON playlists;
CREATE POLICY "Students can view all lesson playlists"
  ON playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_playlists cp
      WHERE cp.playlist_id = playlists.id
    )
  );

-- Allow students to view all test playlists (update existing policy)
DROP POLICY IF EXISTS "Students can view test playlists in courses" ON playlists;
CREATE POLICY "Students can view test playlists in courses"
  ON playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_playlists cp
      WHERE cp.playlist_id = playlists.id
      AND EXISTS (
        SELECT 1 FROM playlist_tests pt
        WHERE pt.playlist_id = playlists.id
      )
    )
  );

-- Allow students to view playlist_tests for all playlists
DROP POLICY IF EXISTS "Users can view playlist_tests for accessible playlists" ON playlist_tests;
CREATE POLICY "Users can view playlist_tests for accessible playlists"
  ON playlist_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tests.playlist_id
      AND (
        p.teacher_id = auth.uid()
        OR true -- Students can view all playlist_tests
      )
    )
  );
