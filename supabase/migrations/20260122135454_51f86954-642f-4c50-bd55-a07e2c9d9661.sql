-- Create a table to cache processed document texts for advanced search
CREATE TABLE public.document_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psak_din_id UUID NOT NULL UNIQUE REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  stripped_text TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_document_search_cache_psak_din_id ON public.document_search_cache(psak_din_id);

-- Enable RLS
ALTER TABLE public.document_search_cache ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read cache (it's derived data, not sensitive)
CREATE POLICY "Anyone can read document cache" 
ON public.document_search_cache 
FOR SELECT 
USING (true);

-- Allow insert/update from edge function (service role)
CREATE POLICY "Service role can manage cache" 
ON public.document_search_cache 
FOR ALL 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_document_search_cache_updated_at
BEFORE UPDATE ON public.document_search_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view to track cache status
CREATE OR REPLACE VIEW public.search_cache_stats AS
SELECT 
  (SELECT COUNT(*) FROM psakei_din) as total_documents,
  (SELECT COUNT(*) FROM document_search_cache) as cached_documents,
  (SELECT MAX(created_at) FROM document_search_cache) as last_cache_update;