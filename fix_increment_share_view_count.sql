-- Fix for increment_share_view_count function
-- Adding explicit search_path parameter to prevent security issues

CREATE OR REPLACE FUNCTION public.increment_share_view_count(share_id_to_update uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shared_collections
  SET view_count = view_count + 1
  WHERE share_id = share_id_to_update;
END;
$$;

-- Set proper permissions
ALTER FUNCTION public.increment_share_view_count(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.increment_share_view_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_share_view_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_view_count(uuid) TO service_role;
