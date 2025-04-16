require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function checkSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Supabase URL:', supabaseUrl);
  
  try {
    // Check if Supabase is accessible
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      }
    });
    
    console.log('Supabase is accessible. Status:', response.status);
    
    // Check for available functions
    try {
      const functionsResponse = await axios.get(`${supabaseUrl}/functions/v1`, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        }
      });
      
      console.log('Functions endpoint response:', functionsResponse.status, functionsResponse.data);
    } catch (functionsError) {
      console.log('Functions endpoint error:', functionsError.response ? functionsError.response.status : functionsError.message);
      if (functionsError.response && functionsError.response.data) {
        console.log('Functions error data:', functionsError.response.data);
      }
    }
    
  } catch (error) {
    console.error('Error accessing Supabase:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.error('Error data:', error.response.data);
    }
  }
}

checkSupabase();
