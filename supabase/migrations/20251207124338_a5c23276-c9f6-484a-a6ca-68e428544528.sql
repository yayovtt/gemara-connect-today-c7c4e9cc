-- Create storage bucket for psak din uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the uploads bucket
CREATE POLICY "Anyone can read uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Allow anyone to upload (public uploads for psak din)
CREATE POLICY "Anyone can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads');

-- Allow anyone to delete their uploads
CREATE POLICY "Anyone can delete uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads');