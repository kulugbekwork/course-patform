-- Add file_url column to tests table for storing file paths in Supabase Storage
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE tests ADD COLUMN file_url TEXT;
  END IF;
END $$;
