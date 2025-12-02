-- Create storage bucket for report evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for reports bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload report evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports');

-- Allow public read access to report evidence
CREATE POLICY "Public can view report evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reports');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own report evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
