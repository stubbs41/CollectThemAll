import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types'; // Adjust path if needed
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // Ensure this runs dynamically

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const logPath = path.join(process.cwd(), 'auth-callback-log.txt');

  // Log to file
  fs.appendFileSync(logPath, `${timestamp} - Auth callback route triggered\n`);
  fs.appendFileSync(logPath, `${timestamp} - Full request URL: ${request.url}\n`);

  console.log('Auth callback route triggered');
  console.log('Full request URL:', request.url);
  const requestUrl = new URL(request.url);

  // Handle cases where the code is in the path instead of a search parameter
  // This fixes the issue with "localhost:3000/code=32e3fdc4-e9db-4c56-a5dc-d4d2d86a2101"
  let code = requestUrl.searchParams.get('code');

  fs.appendFileSync(logPath, `${timestamp} - Code from search params: ${code ? 'Present (not showing full code)' : 'Not present'}\n`);
  console.log('Code from search params:', code ? 'Present (not showing full code)' : 'Not present');

  // Check if code might be in the path (malformed URL)
  if (!code && requestUrl.pathname.includes('code=')) {
    fs.appendFileSync(logPath, `${timestamp} - Code not in search params, checking path: ${requestUrl.pathname}\n`);
    console.log('Code not in search params, checking path:', requestUrl.pathname);
    const codeMatch = requestUrl.pathname.match(/code=([^&]+)/);
    if (codeMatch && codeMatch[1]) {
      code = codeMatch[1];
      fs.appendFileSync(logPath, `${timestamp} - Fixed malformed URL, extracted code from path\n`);
      console.log('Fixed malformed URL, extracted code from path');
    }
  }

  fs.appendFileSync(logPath, `${timestamp} - Auth code present: ${!!code}\n`);
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
      fs.appendFileSync(logPath, `${timestamp} - Exchanging code for session...
`);

      try {
        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Error exchanging code for session:', error);
          fs.appendFileSync(logPath, `${timestamp} - Error exchanging code for session: ${JSON.stringify(error)}
`);
        } else {
          console.log('Session established successfully, user ID:', data.session?.user.id);
          fs.appendFileSync(logPath, `${timestamp} - Session established successfully, user ID: ${data.session?.user.id}
`);

          // Force update cookies to ensure they're properly set
          const sessionResult = await supabase.auth.getSession();
          fs.appendFileSync(logPath, `${timestamp} - Session after refresh: ${sessionResult.data.session ? 'Present' : 'Not present'}
`);

          // Check if we're on the production URL
          const currentUrl = requestUrl.origin;
          const productionUrl = 'https://poke-binder-flax.vercel.app';

          fs.appendFileSync(logPath, `${timestamp} - Current URL: ${currentUrl}, Production URL: ${productionUrl}
`);

          if (currentUrl !== productionUrl &&
              !currentUrl.includes('localhost') &&
              !currentUrl.includes('127.0.0.1')) {
            fs.appendFileSync(logPath, `${timestamp} - Not on production URL, will redirect to: ${productionUrl}
`);
          }
        }
      } catch (sessionError) {
        console.error('Exception during session exchange:', sessionError);
        fs.appendFileSync(logPath, `${timestamp} - Exception during session exchange: ${sessionError}
`);
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
    }
  }

  // URL to redirect to after sign in process completes
  // Use the saved redirectTo path or fall back to homepage
  // Always use the production URL for redirects
  const productionUrl = 'https://poke-binder-flax.vercel.app';

  // Always use the production URL in production
  const origin = productionUrl;

  console.log('Using origin for redirect:', origin);

  // Create the redirect URL with the correct origin
  const redirectUrl = new URL(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`, origin);

  // Add a timestamp parameter to force a page reload and avoid caching issues
  redirectUrl.searchParams.set('auth_timestamp', Date.now().toString());

  console.log('Redirecting to:', redirectUrl.toString());

  return NextResponse.redirect(redirectUrl);
}
