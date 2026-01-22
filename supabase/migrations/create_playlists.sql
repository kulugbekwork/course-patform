-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL DEFAULT 'sequential' CHECK (access_mode IN ('any', 'sequential')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlist_tests junction table
CREATE TABLE IF NOT EXISTS playlist_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, test_id)
);

-- Create playlist_student_progress table to track which test is active for each student
CREATE TABLE IF NOT EXISTS playlist_student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  completed_test_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, student_id)
);

-- Create course_playlists junction table to link playlists to lessons
CREATE TABLE IF NOT EXISTS course_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, playlist_id)
);

-- Enable RLS
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_playlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlists
CREATE POLICY "Teachers can view their own playlists"
  ON playlists FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create playlists"
  ON playlists FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own playlists"
  ON playlists FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own playlists"
  ON playlists FOR DELETE
  USING (teacher_id = auth.uid());

-- Students can view playlists assigned to them via courses
CREATE POLICY "Students can view playlists in their courses"
  ON playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_playlists cp
      JOIN course_access ca ON cp.course_id = ca.course_id
      WHERE cp.playlist_id = playlists.id
      AND ca.student_id = auth.uid()
    )
  );

-- Students can view all test playlists (not linked to courses)
DROP POLICY IF EXISTS "Students can view test playlists" ON playlists;
CREATE POLICY "Students can view test playlists"
  ON playlists FOR SELECT
  USING (
    NOT EXISTS (
      SELECT 1 FROM course_playlists cp
      WHERE cp.playlist_id = playlists.id
    )
  );

-- Students can view test playlists linked to their courses
DROP POLICY IF EXISTS "Students can view test playlists in courses" ON playlists;
CREATE POLICY "Students can view test playlists in courses"
  ON playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_playlists cp
      JOIN course_access ca ON cp.course_id = ca.course_id
      WHERE cp.playlist_id = playlists.id
      AND ca.student_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM playlist_tests pt
        WHERE pt.playlist_id = playlists.id
      )
    )
  );

-- RLS Policies for playlist_tests
CREATE POLICY "Users can view playlist_tests for accessible playlists"
  ON playlist_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tests.playlist_id
      AND (
        p.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM course_playlists cp
          JOIN course_access ca ON cp.course_id = ca.course_id
          WHERE cp.playlist_id = p.id
          AND ca.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Teachers can manage playlist_tests for their playlists"
  ON playlist_tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tests.playlist_id
      AND p.teacher_id = auth.uid()
    )
  );

-- RLS Policies for playlist_student_progress
CREATE POLICY "Students can view their own progress"
  ON playlist_student_progress FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can update their own progress"
  ON playlist_student_progress FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own progress"
  ON playlist_student_progress FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view progress for their playlists"
  ON playlist_student_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_student_progress.playlist_id
      AND p.teacher_id = auth.uid()
    )
  );

-- RLS Policies for course_playlists
CREATE POLICY "Teachers can manage course_playlists for their courses"
  ON course_playlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_playlists.course_id
      AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view course_playlists for their courses"
  ON course_playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_access ca
      WHERE ca.course_id = course_playlists.course_id
      AND ca.student_id = auth.uid()
    )
  );
