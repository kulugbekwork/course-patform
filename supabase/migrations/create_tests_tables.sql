-- Create tests table
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  time_minutes INTEGER DEFAULT 30,
  file_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add file_content column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'file_content'
  ) THEN
    ALTER TABLE tests ADD COLUMN file_content TEXT;
  END IF;
END $$;

-- Create test_questions table
CREATE TABLE IF NOT EXISTS test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test_question_variants table
CREATE TABLE IF NOT EXISTS test_question_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
  variant_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_question_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tests
DROP POLICY IF EXISTS "Teachers can view their own tests" ON tests;
CREATE POLICY "Teachers can view their own tests"
  ON tests FOR SELECT
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can create tests" ON tests;
CREATE POLICY "Teachers can create tests"
  ON tests FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can update their own tests" ON tests;
CREATE POLICY "Teachers can update their own tests"
  ON tests FOR UPDATE
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can delete their own tests" ON tests;
CREATE POLICY "Teachers can delete their own tests"
  ON tests FOR DELETE
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Students can view all tests" ON tests;
CREATE POLICY "Students can view all tests"
  ON tests FOR SELECT
  USING (true);

-- RLS Policies for test_questions
DROP POLICY IF EXISTS "Users can view test_questions for accessible tests" ON test_questions;
CREATE POLICY "Users can view test_questions for accessible tests"
  ON test_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_questions.test_id
      AND (
        t.teacher_id = auth.uid()
        OR true -- Students can view all test questions
      )
    )
  );

DROP POLICY IF EXISTS "Teachers can manage test_questions for their tests" ON test_questions;
CREATE POLICY "Teachers can manage test_questions for their tests"
  ON test_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_questions.test_id
      AND t.teacher_id = auth.uid()
    )
  );

-- RLS Policies for test_question_variants
DROP POLICY IF EXISTS "Users can view test_question_variants for accessible questions" ON test_question_variants;
CREATE POLICY "Users can view test_question_variants for accessible questions"
  ON test_question_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE tq.id = test_question_variants.question_id
      AND (
        t.teacher_id = auth.uid()
        OR true -- Students can view all variants
      )
    )
  );

DROP POLICY IF EXISTS "Teachers can manage test_question_variants for their tests" ON test_question_variants;
CREATE POLICY "Teachers can manage test_question_variants for their tests"
  ON test_question_variants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE tq.id = test_question_variants.question_id
      AND t.teacher_id = auth.uid()
    )
  );
