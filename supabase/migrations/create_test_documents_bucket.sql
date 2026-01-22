-- Create test-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-documents',
  'test-documents',
  true, -- Public bucket so students can view documents
  52428800, -- 50MB file size limit
  ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for test-documents bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Teachers can upload test documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view test documents" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update their own test documents" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their own test documents" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Teachers can upload test documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'test-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view test documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'test-documents');

-- Allow teachers to update their own files
CREATE POLICY "Teachers can update their own test documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'test-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow teachers to delete their own files
CREATE POLICY "Teachers can delete their own test documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'test-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
