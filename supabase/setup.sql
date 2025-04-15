-- Collections Table
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  card_name TEXT,
  card_image_small TEXT,
  collection_type TEXT NOT NULL DEFAULT 'have',  -- 'have' or 'want'
  quantity INTEGER NOT NULL DEFAULT 1,           -- number of copies of the card
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Add a unique constraint to prevent duplicate cards per user and collection type
  UNIQUE(user_id, card_id, collection_type)
);

-- Comment on the table and columns to make them more understandable
COMMENT ON TABLE public.collections IS 'Stores user card collections';
COMMENT ON COLUMN public.collections.user_id IS 'Reference to auth.users.id - owner of the collection';
COMMENT ON COLUMN public.collections.card_id IS 'Pokemon card ID from the TCG API';
COMMENT ON COLUMN public.collections.card_name IS 'Pokemon card name for easy reference';
COMMENT ON COLUMN public.collections.card_image_small IS 'URL to the card image (small version)';
COMMENT ON COLUMN public.collections.collection_type IS 'Type of collection: have or want';
COMMENT ON COLUMN public.collections.quantity IS 'Number of copies of this card in the collection';

-- Enable Row Level Security
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Create policies to control access
-- Allow users to see only their own collections
CREATE POLICY "Users can view their own collections" 
  ON public.collections 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Allow users to insert their own collections
CREATE POLICY "Users can add to their own collections" 
  ON public.collections 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own collections
CREATE POLICY "Users can update their own collections" 
  ON public.collections 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Allow users to delete from their own collections
CREATE POLICY "Users can delete from their own collections" 
  ON public.collections 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS collections_user_id_idx ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS collections_collection_type_idx ON public.collections(collection_type); 