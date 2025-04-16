# Update Vercel Environment Variables

Follow these steps to update your environment variables in Vercel:

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your PokeBinder project
3. Click on the "Settings" tab
4. In the left sidebar, click on "Environment Variables"

## Update Pokemon TCG API Key

1. Look for the environment variable `NEXT_PUBLIC_POKEMON_TCG_API_KEY`
2. Click on the three dots next to it and select "Delete"
3. Click on "Add New" to add a new environment variable
4. Enter the following:
   - Name: `POKEMON_TCG_API_KEY` (without the NEXT_PUBLIC_ prefix)
   - Value: `10c78414-5bde-4019-b551-79f7798a8807`
   - Environment: Select all environments (Production, Preview, Development)
5. Click "Save"

## Redeploy Your Application

1. Go back to the "Deployments" tab
2. Find your latest deployment and click on the three dots next to it
3. Select "Redeploy" to deploy with the new environment variables

## Verify the Changes

After redeploying, check the following endpoints to verify that the API is working correctly:

- https://poke-binder-ryans-projects-ee570422.vercel.app/api/cards-paged?page=1&limit=10
- https://poke-binder-ryans-projects-ee570422.vercel.app/api/card-details?cardId=sv5-123
- https://poke-binder-ryans-projects-ee570422.vercel.app/api/cards-by-set?setId=sv5

If these endpoints return JSON data instead of a loading message, your changes have been successfully deployed.
