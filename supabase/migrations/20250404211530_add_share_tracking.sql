-- Migration SQL to add view_count and status to shared_collections

-- Add view_count column
ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shared_collections.view_count IS 'Number of times the shared link has been viewed';

-- Add status column 
ALTER TABLE public.shared_collections
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'; -- e.g., 'active', 'expired', 'revoked'

COMMENT ON COLUMN public.shared_collections.status IS 'Current status of the share link';

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS shared_collections_status_idx ON public.shared_collections(status);

-- Optional: Update existing rows to have the default status
UPDATE public.shared_collections
SET status = 'active'
WHERE status IS NULL;

-- Function to increment view count (more robust than doing it in the API route)
CREATE OR REPLACE FUNCTION increment_share_view_count(share_id_to_update TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.shared_collections
  SET view_count = view_count + 1
  WHERE share_id = share_id_to_update;
END;
$$;

-- NOTE: This is temporary content for migration purposes.
