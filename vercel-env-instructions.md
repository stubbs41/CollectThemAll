# Vercel Environment Variables Update Instructions

To ensure API keys are securely stored and not exposed in client-side code, you need to update the environment variables in your Vercel project.

## Steps to Update Environment Variables in Vercel

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your PokeBinder project
3. Click on the "Settings" tab
4. In the left sidebar, click on "Environment Variables"

### For Pokemon TCG API Key (Server-side only)

1. Look for any environment variable with `NEXT_PUBLIC_POKEMON_TCG_API_KEY`
2. If it exists, click on the three dots next to it and select "Delete"
3. Click on "Add New" to add a new environment variable
4. Enter the following:
   - Name: `POKEMON_TCG_API_KEY` (without the NEXT_PUBLIC_ prefix)
   - Value: `10c78414-5bde-4019-b551-79f7798a8807`
   - Environment: Select all environments (Production, Preview, Development)
5. Click "Save"

### For Supabase Environment Variables

1. For any Supabase environment variables that should be accessible client-side (like the URL and anon key), keep the `NEXT_PUBLIC_` prefix
2. For any sensitive Supabase keys (like service role key or JWT secret), make sure they do NOT have the `NEXT_PUBLIC_` prefix

### Redeploy Your Application

1. Go back to the "Deployments" tab
2. Find your latest deployment and click on the three dots next to it
3. Select "Redeploy" to deploy with the new environment variables

## Security Best Practices

- Never use the `NEXT_PUBLIC_` prefix for any API keys or secrets that should be kept private
- Only use the `NEXT_PUBLIC_` prefix for values that need to be accessible in the browser
- Always use server-side API routes to make requests that require API keys
- Verify that your client-side code doesn't contain any sensitive information

After completing these steps, your application will securely access the Pokemon TCG API key in the server-side code only, preventing it from being exposed to users.
