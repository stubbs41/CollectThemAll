# Verify Deployment

After redeploying your application, check the following endpoints to verify that the API is working correctly:

## API Endpoints to Test

1. Cards Paged API:
   - URL: https://poke-binder-ryans-projects-ee570422.vercel.app/api/cards-paged?page=1&limit=10
   - Expected: JSON response with a list of cards

2. Card Details API:
   - URL: https://poke-binder-ryans-projects-ee570422.vercel.app/api/card-details?cardId=sv5-123
   - Expected: JSON response with details of a specific card

3. Cards by Set API:
   - URL: https://poke-binder-ryans-projects-ee570422.vercel.app/api/cards-by-set?setId=sv5
   - Expected: JSON response with a list of cards from a specific set

## Main Application

Also check the main application to ensure it loads correctly:
- URL: https://poke-binder-ryans-projects-ee570422.vercel.app

## What to Look For

- All API endpoints should return JSON data, not a loading message
- The main application should load and display cards
- No errors in the browser console related to API keys or missing environment variables

If any issues persist after redeployment, we may need to check the Vercel logs for more information.
