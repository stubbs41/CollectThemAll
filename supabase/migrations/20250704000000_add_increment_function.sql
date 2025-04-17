-- Create a simple increment function for counters
CREATE OR REPLACE FUNCTION public.increment(value integer)
RETURNS integer AS $$
BEGIN
  RETURN value + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
