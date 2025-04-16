require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function testApi() {
  // Test the actual API endpoint used by the frontend
  try {
    const params = {
      page: '1',
      limit: '32',
    };

    // This is the actual endpoint used by the frontend
    const apiUrl = 'https://poke-binder-flax.vercel.app/api/cards-paged';
    console.log(`Fetching from: ${apiUrl} with params:`, params);

    const response = await axios.get(apiUrl, { params });

    const data = response.data;
    console.log('Response structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');

    // Check if data is an array or has a data property
    if (data.cards && Array.isArray(data.cards)) {
      console.log('Response has a cards property which is an array with', data.cards.length, 'items');
      console.log('Other properties:', Object.keys(data).filter(key => key !== 'cards'));
    } else {
      console.log('Unexpected response format:', typeof data);
    }
  } catch (error) {
    console.error('Error:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
      console.error('Error data:', error.response.data);
    }
  }
}

testApi();
