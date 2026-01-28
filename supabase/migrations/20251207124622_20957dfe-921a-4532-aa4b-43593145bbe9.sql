-- Create the correct storage bucket for psak din files
INSERT INTO storage.buckets (id, name, public)
VALUES ('psakei-din-files', 'psakei-din-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket
CREATE POLICY "Anyone can read psakei din files"
ON storage.objects FOR SELECT
USING (bucket_id = 'psakei-din-files');

-- Allow anyone to upload files
CREATE POLICY "Anyone can upload psakei din files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'psakei-din-files');

-- Allow anyone to delete files
CREATE POLICY "Anyone can delete psakei din files"
ON storage.objects FOR DELETE
USING (bucket_id = 'psakei-din-files');