-- Add collection_type column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='collections' AND column_name='collection_type') THEN
        ALTER TABLE collections ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'have';
        COMMENT ON COLUMN collections.collection_type IS 'Type of collection: have or want';
    END IF;
END $$;

-- Add quantity column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='collections' AND column_name='quantity') THEN
        ALTER TABLE collections ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
        COMMENT ON COLUMN collections.quantity IS 'Number of copies of this card in the collection';
    END IF;
END $$;

-- Drop existing unique constraint if exists (so we can recreate it with collection_type)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'collections_user_id_card_id_key' 
        AND conrelid = 'collections'::regclass
    ) THEN
        ALTER TABLE collections DROP CONSTRAINT collections_user_id_card_id_key;
    END IF;
END $$;

-- Add the new unique constraint including collection_type
ALTER TABLE collections 
ADD CONSTRAINT collections_user_id_card_id_collection_type_key 
UNIQUE (user_id, card_id, collection_type);

-- Create indexes for faster queries if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'collections_collection_type_idx') THEN
        CREATE INDEX collections_collection_type_idx ON collections(collection_type);
    END IF;
END $$;
