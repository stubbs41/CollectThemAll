require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  try {
    console.log('Connecting to Supabase...');
    
    // Call our verification function
    const { data, error } = await supabase.rpc('verify_collections_schema');
    
    if (error) {
      console.error('Error executing RPC function:', error);
      return;
    }
    
    console.log('Collections table schema:');
    console.table(data);
    
    // Specifically check for collection_type and quantity columns
    const collectionTypeColumn = data.find(col => col.column_name === 'collection_type');
    const quantityColumn = data.find(col => col.column_name === 'quantity');
    
    console.log('\nVerification Results:');
    console.log('---------------------');
    console.log('collection_type column exists:', collectionTypeColumn ? '✅ YES' : '❌ NO');
    if (collectionTypeColumn) {
      console.log('  - Data type:', collectionTypeColumn.data_type);
      console.log('  - Default value:', collectionTypeColumn.column_default);
    }
    
    console.log('quantity column exists:', quantityColumn ? '✅ YES' : '❌ NO');
    if (quantityColumn) {
      console.log('  - Data type:', quantityColumn.data_type);
      console.log('  - Default value:', quantityColumn.column_default);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the verification
verifySchema(); 