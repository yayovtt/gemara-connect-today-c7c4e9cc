-- Create migration_logs table for tracking executed migrations
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sql_content TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false,
  error TEXT,
  executed_by UUID
);

-- Enable RLS
ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view migration logs
CREATE POLICY "Admins can view migration logs" 
ON public.migration_logs 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert migration logs (via function)
CREATE POLICY "Admins can insert migration logs" 
ON public.migration_logs 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create execute_safe_migration function using existing has_role function
CREATE OR REPLACE FUNCTION public.execute_safe_migration(p_name TEXT, p_sql TEXT) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  -- Check admin using existing has_role function
  IF NOT public.has_role(uid, 'admin') THEN 
    RAISE EXCEPTION 'Not authorized - admin role required'; 
  END IF;
  
  -- Remove BEGIN/COMMIT statements and execute
  EXECUTE regexp_replace(regexp_replace(p_sql, 'BEGIN;', '', 'gi'), 'COMMIT;', '', 'gi');
  
  -- Log successful execution
  INSERT INTO migration_logs(name, sql_content, success, executed_by) 
  VALUES(p_name, p_sql, true, uid);
  
  RETURN '{"success":true}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  -- Log failed execution
  INSERT INTO migration_logs(name, sql_content, success, error, executed_by) 
  VALUES(p_name, p_sql, false, SQLERRM, uid);
  
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO authenticated;