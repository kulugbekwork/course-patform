-- Create lesson-videos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-videos',
  'lesson-videos',
  true, -- Public bucket so students can view videos
  524288000, -- 500MB file size limit (videos are larger than documents)
  ARRAY[
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for lesson-videos bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Teachers can upload lesson videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view lesson videos" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update their own lesson videos" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their own lesson videos" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Teachers can upload lesson videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-videos' AND
  (storage.foldername(name))[1] = 'videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view lesson videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-videos');

-- Allow teachers to update their own files
CREATE POLICY "Teachers can update their own lesson videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-videos' AND
  (storage.foldername(name))[1] = 'videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow teachers to delete their own files
CREATE POLICY "Teachers can delete their own lesson videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-videos' AND
  (storage.foldername(name))[1] = 'videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
