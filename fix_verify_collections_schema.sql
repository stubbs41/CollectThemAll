-- Fix for verify_collections_schema function
-- Adding explicit search_path parameter to prevent security issues

CREATE OR REPLACE FUNCTION public.verify_collections_schema()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the collection_type is either 'have' or 'want'
  IF NEW.collection_type NOT IN ('have', 'want') THEN
    RAISE EXCEPTION 'collection_type must be either "have" or "want"';
  END IF;
  
  -- Ensure quantity is positive
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than 0';
  END IF;
  
  -- If all checks pass, return NEW to allow the operation
  RETURN NEW;
END;
$$;

-- Set proper permissions
ALTER FUNCTION public.verify_collections_schema() OWNER TO postgres;
