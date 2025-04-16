-- Create collection_groups table
CREATE TABLE IF NOT EXISTS public.collection_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Add a unique constraint to prevent duplicate group names per user
  UNIQUE(user_id, name)
);

-- Comment on the table and columns
COMMENT ON TABLE public.collection_groups IS 'Stores metadata about collection groups';
COMMENT ON COLUMN public.collection_groups.user_id IS 'Reference to auth.users.id - owner of the collection group';
COMMENT ON COLUMN public.collection_groups.name IS 'Name of the collection group';
COMMENT ON COLUMN public.collection_groups.description IS 'Optional description of the collection group';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS collection_groups_user_id_idx ON public.collection_groups(user_id);

-- Insert Default group for existing users
INSERT INTO public.collection_groups (user_id, name, description)
SELECT DISTINCT user_id, 'Default', 'Default collection group'
FROM public.collections
WHERE NOT EXISTS (
  SELECT 1 FROM public.collection_groups 
  WHERE collection_groups.user_id = collections.user_id 
  AND collection_groups.name = 'Default'
);

-- Update the unique constraint on collections table to include group_name
ALTER TABLE public.collections 
DROP CONSTRAINT IF EXISTS collections_user_id_card_id_collection_type_key;

ALTER TABLE public.collections 
ADD CONSTRAINT collections_user_id_card_id_collection_type_group_name_key 
UNIQUE (user_id, card_id, collection_type, group_name);

-- Update shared_collections table to add sharing_level
ALTER TABLE public.shared_collections 
ADD COLUMN IF NOT EXISTS sharing_level TEXT NOT NULL DEFAULT 'group';

COMMENT ON COLUMN public.shared_collections.sharing_level IS 'Level of sharing: group, have, want';

-- Add total_value column to collection_groups
ALTER TABLE public.collection_groups
ADD COLUMN IF NOT EXISTS have_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS want_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_value NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.collection_groups.have_value IS 'Total market value of cards in the have collection';
COMMENT ON COLUMN public.collection_groups.want_value IS 'Total market value of cards in the want collection';
COMMENT ON COLUMN public.collection_groups.total_value IS 'Combined market value of all cards in the group';

-- Add market_price column to collections
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS market_price NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.collections.market_price IS 'Market price of the card';
