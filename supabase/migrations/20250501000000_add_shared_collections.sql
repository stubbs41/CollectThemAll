-- Create shared_collections table
CREATE TABLE IF NOT EXISTS public.shared_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
  share_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  collection_type TEXT NOT NULL,
  group_name TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Add an index on share_id for faster lookups
  CONSTRAINT shared_collections_share_id_key UNIQUE (share_id)
);

-- Comment on the table and columns
COMMENT ON TABLE public.shared_collections IS 'Stores shared collection data';
COMMENT ON COLUMN public.shared_collections.share_id IS 'Unique identifier for the shared collection';
COMMENT ON COLUMN public.shared_collections.user_id IS 'ID of user who shared the collection (if authenticated)';
COMMENT ON COLUMN public.shared_collections.collection_type IS 'Type of collection: have or want';
COMMENT ON COLUMN public.shared_collections.group_name IS 'Original group name of the collection';
COMMENT ON COLUMN public.shared_collections.collection_name IS 'Display name for the collection';
COMMENT ON COLUMN public.shared_collections.data IS 'Full collection data in JSON format';
COMMENT ON COLUMN public.shared_collections.expires_at IS 'When this shared collection expires';

-- Create index for expiry cleanup
CREATE INDEX IF NOT EXISTS shared_collections_expires_at_idx ON public.shared_collections(expires_at);

-- Add column to collections table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='collections' AND column_name='group_name') THEN
        ALTER TABLE collections ADD COLUMN group_name TEXT NOT NULL DEFAULT 'Default';
        COMMENT ON COLUMN collections.group_name IS 'Collection group name';
    END IF;
END $$; 