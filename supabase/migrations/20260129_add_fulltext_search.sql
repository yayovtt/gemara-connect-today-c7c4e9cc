-- Migration: Add Full-Text Search support for psakei_din
-- This creates a GIN index for fast text search in Hebrew

-- Add a tsvector column for full-text search
ALTER TABLE psakei_din 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create a function to update the search vector
CREATE OR REPLACE FUNCTION update_psakei_din_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.court, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.full_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS psakei_din_search_vector_trigger ON psakei_din;
CREATE TRIGGER psakei_din_search_vector_trigger
BEFORE INSERT OR UPDATE ON psakei_din
FOR EACH ROW
EXECUTE FUNCTION update_psakei_din_search_vector();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_psakei_din_search_vector 
ON psakei_din USING GIN(search_vector);

-- Update existing rows
UPDATE psakei_din SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(court, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(summary, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(full_text, '')), 'D');

-- Create a function for ranked search
CREATE OR REPLACE FUNCTION search_psakei_din(
  search_query TEXT,
  result_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  court TEXT,
  year INTEGER,
  summary TEXT,
  full_text TEXT,
  case_number TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL,
  headline TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.court,
    p.year,
    p.summary,
    p.full_text,
    p.case_number,
    p.tags,
    p.created_at,
    p.updated_at,
    ts_rank(p.search_vector, plainto_tsquery('simple', search_query)) AS rank,
    ts_headline('simple', COALESCE(p.summary, p.full_text, ''), plainto_tsquery('simple', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=3'
    ) AS headline
  FROM psakei_din p
  WHERE p.search_vector @@ plainto_tsquery('simple', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create a function for prefix/fuzzy search
CREATE OR REPLACE FUNCTION search_psakei_din_prefix(
  search_prefix TEXT,
  result_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  court TEXT,
  year INTEGER,
  summary TEXT,
  case_number TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.court,
    p.year,
    p.summary,
    p.case_number,
    CASE 
      WHEN p.title ILIKE search_prefix || '%' THEN 10.0
      WHEN p.title ILIKE '%' || search_prefix || '%' THEN 5.0
      WHEN p.summary ILIKE '%' || search_prefix || '%' THEN 2.0
      ELSE 1.0
    END AS rank
  FROM psakei_din p
  WHERE 
    p.title ILIKE '%' || search_prefix || '%' OR
    p.summary ILIKE '%' || search_prefix || '%' OR
    p.court ILIKE '%' || search_prefix || '%' OR
    p.case_number ILIKE '%' || search_prefix || '%'
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_psakei_din(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_psakei_din(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_psakei_din_prefix(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_psakei_din_prefix(TEXT, INTEGER) TO anon;
