-- Create storage bucket for report evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the reports bucket
-- Allow anyone to read files (public access)
CREATE POLICY IF NOT EXISTS "Public Access Reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports');

-- Allow authenticated users to upload report evidence
CREATE POLICY IF NOT EXISTS "Users can upload report evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reports' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to update their own report evidence
CREATE POLICY IF NOT EXISTS "Users can update their own report evidence"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'reports' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own report evidence
CREATE POLICY IF NOT EXISTS "Users can delete their own report evidence"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reports' 
  AND auth.uid() IS NOT NULL
);

