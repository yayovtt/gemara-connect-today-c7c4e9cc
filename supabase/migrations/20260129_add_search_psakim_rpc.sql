-- RPC Function for advanced search in psakei_din
-- Runs regex/pattern search on the server to avoid memory issues in browser

-- Drop if exists for clean update
DROP FUNCTION IF EXISTS search_psakei_din_advanced(text, text, integer);

CREATE OR REPLACE FUNCTION search_psakei_din_advanced(
  search_pattern text DEFAULT NULL,
  search_text text DEFAULT NULL,
  result_limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  title text,
  court text,
  year integer,
  case_number text,
  summary text,
  matched_text text,
  match_count integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If regex pattern provided, use PostgreSQL regex matching
  IF search_pattern IS NOT NULL AND search_pattern != '' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.title,
      p.court,
      p.year,
      p.case_number,
      p.summary,
      -- Extract first match as sample
      (regexp_matches(COALESCE(p.full_text, p.summary, ''), search_pattern, 'i'))[1] as matched_text,
      -- Count all matches
      COALESCE(array_length(regexp_matches(COALESCE(p.full_text, p.summary, ''), search_pattern, 'gi'), 1), 0) as match_count
    FROM psakei_din p
    WHERE 
      COALESCE(p.full_text, p.summary, '') ~* search_pattern
      OR p.title ~* search_pattern
    ORDER BY match_count DESC, p.created_at DESC
    LIMIT result_limit;
  
  -- If simple text search
  ELSIF search_text IS NOT NULL AND search_text != '' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.title,
      p.court,
      p.year,
      p.case_number,
      p.summary,
      NULL::text as matched_text,
      1 as match_count
    FROM psakei_din p
    WHERE 
      p.title ILIKE '%' || search_text || '%'
      OR p.summary ILIKE '%' || search_text || '%'
      OR COALESCE(p.full_text, '') ILIKE '%' || search_text || '%'
    ORDER BY p.created_at DESC
    LIMIT result_limit;
  
  -- No search criteria - return recent
  ELSE
    RETURN QUERY
    SELECT 
      p.id,
      p.title,
      p.court,
      p.year,
      p.case_number,
      p.summary,
      NULL::text as matched_text,
      0 as match_count
    FROM psakei_din p
    ORDER BY p.created_at DESC
    LIMIT result_limit;
  END IF;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION search_psakei_din_advanced(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_psakei_din_advanced(text, text, integer) TO anon;

-- Add comment
COMMENT ON FUNCTION search_psakei_din_advanced IS 'Advanced search for psakei_din with regex pattern support. Runs on server to avoid browser memory issues.';
