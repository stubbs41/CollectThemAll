# Supabase Multi-User Setup Guide

This guide will help you finish setting up your Pokémon Card Collector app with Supabase for multi-user functionality.

## Step 1: Finish the Supabase Database Setup

1. Log in to your [Supabase Dashboard](https://supabase.com)
2. Open your project
3. Go to the SQL Editor (look for the database/table icon in the left sidebar)
4. Click "New Query"
5. Copy the contents of the `supabase/setup.sql` file from this project
6. Click "Run" to execute the SQL and create your database tables and security policies

## Collection System Overview

The app now supports two types of collections for each user:

- **Have Collection**: Cards the user owns (previously called "Default Collection")
- **Want Collection**: Cards the user wants to acquire

Each card in a collection also tracks **quantity** (number of copies owned). The quantity is shown on the card when it's greater than 1.

### Collection Features:
- **"I have" / "I want" buttons**: Add cards to respective collections
- **Collection toggle**: Switch between viewing your "Have" and "Want" collections
- **Quantity management**: When removing cards with multiple copies, you can choose to remove all copies or just decrement the count by one
- **Automatic quantity increment**: Adding the same card to a collection multiple times increases its quantity

## Step 2: Configure Authentication Providers (Optional)

If you want to enable social login options like Google or GitHub:

1. In the Supabase Dashboard, go to Authentication > Providers
2. Toggle on the providers you want to use (e.g., Google, GitHub)
3. Follow the specific setup instructions for each provider:
   - For Google: Create an OAuth app in Google Cloud Console
   - For GitHub: Create an OAuth app in GitHub Developer Settings

## Step 3: Update Your Environment Variables

Make sure your `.env.local` file has the following Supabase variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace the placeholder values with your actual Supabase project URL and anon key.

## Step 4: Run the Application

Start your development server:

```bash
npm run dev
# or
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## How the Authentication Flow Works

1. Users click the "Account" button in the header
2. A login/signup form appears (powered by Supabase Auth UI)
3. After authenticating, Supabase creates a session
4. The `MyCollection.tsx` component automatically fetches the user's personal collection
5. The app uses Row Level Security (RLS) to ensure users can only access their own data

## Understanding the Code Structure

- **src/lib/supabaseClient.ts**: Client for Supabase interactions
- **src/components/AuthForm.tsx**: Authentication UI component
- **src/components/MyCollection.tsx**: Component to display user's collection with quantity support
- **src/app/api/collections/route.ts**: API endpoint for collection management (includes quantity handling)
- **src/app/auth/callback/route.ts**: Handles OAuth redirects
- **src/lib/database.types.ts**: TypeScript types for the database

## Testing Your Setup

1. Create a new user account via the Auth UI
2. Browse Pokémon cards and add some to your collections:
   - Use "I have" for cards you own
   - Use "I want" for cards you wish to acquire
3. Add the same card multiple times to test the quantity feature
4. Toggle between "Have" and "Want" collections
5. Test removing cards with multiple copies
6. Log out and log back in to verify persistence
7. Try creating another account and confirm collections are separated

## Common Issues and Solutions

- **"No collections found"**: Make sure you've created the database tables using the SQL script
- **Authentication issues**: Check that your environment variables are set correctly
- **Auth provider errors**: Make sure you've configured the provider correctly in the Supabase dashboard

## Next Steps

- Add card categorization within collections
- Implement card trading between users
- Add public/private collection sharing options

Enjoy your upgraded multi-user Pokémon Card Collector app! 