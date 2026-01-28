-- Add source_id column to track original psakim.org ID
ALTER TABLE public.psakei_din 
ADD COLUMN IF NOT EXISTS source_id integer UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_psakei_din_source_id ON public.psakei_din(source_id);