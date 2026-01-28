-- Safely add gemara_pages to realtime publication (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'gemara_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gemara_pages;
  END IF;
END $$;