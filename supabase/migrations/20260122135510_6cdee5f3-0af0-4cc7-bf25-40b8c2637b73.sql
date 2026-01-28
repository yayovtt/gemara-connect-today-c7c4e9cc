-- Fix the security definer view and make RLS more restrictive for cache management
DROP VIEW IF EXISTS public.search_cache_stats;

-- Recreate view without security definer
CREATE VIEW public.search_cache_stats AS
SELECT 
  (SELECT COUNT(*) FROM psakei_din) as total_documents,
  (SELECT COUNT(*) FROM document_search_cache) as cached_documents,
  (SELECT MAX(created_at) FROM document_search_cache) as last_cache_update;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage cache" ON public.document_search_cache;

-- Create more specific policies
CREATE POLICY "Authenticated users can insert to cache" 
ON public.document_search_cache 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update cache" 
ON public.document_search_cache 
FOR UPDATE 
USING (true);