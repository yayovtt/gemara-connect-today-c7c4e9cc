-- Create storage bucket for gemara downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('gemara-downloads', 'gemara-downloads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket
CREATE POLICY "Anyone can read gemara downloads"
ON storage.objects FOR SELECT
USING (bucket_id = 'gemara-downloads');

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload gemara downloads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gemara-downloads' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete gemara downloads"
ON storage.objects FOR DELETE
USING (bucket_id = 'gemara-downloads' AND auth.role() = 'authenticated');