-- Create a function to check the collections table schema
CREATE OR REPLACE FUNCTION public.verify_collections_schema()
RETURNS TABLE (
    column_name text,
    data_type text,
    column_default text,
    is_nullable text
) LANGUAGE sql SECURITY DEFINER AS $$
    SELECT 
        column_name::text, 
        data_type::text, 
        column_default::text, 
        is_nullable::text
    FROM 
        information_schema.columns 
    WHERE 
        table_name = 'collections' 
    ORDER BY 
        ordinal_position;
$$; 