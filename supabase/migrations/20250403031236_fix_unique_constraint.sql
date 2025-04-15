-- Drop the old constraint that doesn't include collection_type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_user_card' 
        AND conrelid = 'collections'::regclass
    ) THEN
        ALTER TABLE public.collections DROP CONSTRAINT unique_user_card;
    END IF;
END $$;

-- Double-check our correct constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'collections_user_id_card_id_collection_type_key' 
        AND conrelid = 'collections'::regclass
    ) THEN
        -- Create the proper unique constraint if it doesn't exist
        ALTER TABLE public.collections
        ADD CONSTRAINT collections_user_id_card_id_collection_type_key
        UNIQUE (user_id, card_id, collection_type);
    END IF;
END $$; 