import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types'; // Adjust path if needed

export const dynamic = 'force-dynamic'; // Ensure this runs dynamically

export async function GET(request: NextRequest) {
  console.log('Auth callback route triggered');
  const requestUrl = new URL(request.url);
  
  // Handle cases where the code is in the path instead of a search parameter
  // This fixes the issue with "localhost:3000/code=32e3fdc4-e9db-4c56-a5dc-d4d2d86a2101"
  let code = requestUrl.searchParams.get('code');
  
  // Check if code might be in the path (malformed URL)
  if (!code && requestUrl.pathname.includes('code=')) {
    const codeMatch = requestUrl.pathname.match(/code=([^&]+)/);
    if (codeMatch && codeMatch[1]) {
      code = codeMatch[1];
      console.log('Fixed malformed URL, extracted code from path');
    }
  }
  
  console.log('Auth code present:', !!code);
  
  // Get the redirect URL from the query string, defaulting to the homepage
  let redirectTo = requestUrl.searchParams.get('redirectTo') || '/';
  
  console.log('Redirect URL (before decoding):', redirectTo);
  
  // Decode the URL if it was encoded
  try {
    redirectTo = decodeURIComponent(redirectTo);
    console.log('Redirect URL (after decoding):', redirectTo);
  } catch (error) {
    console.error('Error decoding redirectTo:', error);
    redirectTo = '/';
  }

  if (code) {
    try {
      const cookieStore = await cookies();
      const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
      
      console.log('Exchanging code for session...');
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Error exchanging code for session:', error);
      } else {
        console.log('Session established successfully, user ID:', data.session?.user.id);
        
        // Force update cookies to ensure they're properly set
        await supabase.auth.getSession();
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
    }
  }

  // URL to redirect to after sign in process completes
  // Use the saved redirectTo path or fall back to homepage
  // Ensure the redirect URL uses the same origin as the current request
  const origin = requestUrl.origin;
  
  // Create the redirect URL with the correct origin
  const redirectUrl = new URL(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`, origin);
  
  // Add a timestamp parameter to force a page reload and avoid caching issues
  redirectUrl.searchParams.set('auth_timestamp', Date.now().toString());
  
  console.log('Redirecting to:', redirectUrl.toString());
  
  return NextResponse.redirect(redirectUrl);
}
