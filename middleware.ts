import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * - API routes (/api/*)
     * - Static files and images
     * - Favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  console.log('Middleware running for path:', url.pathname);

  // Check if this is a Google OAuth redirect with code in the wrong place
  // This is a special case handling for the issue where Google redirects to root with code
  if (url.pathname === '/' && url.searchParams.has('code')) {
    console.log('Detected OAuth redirect to root with code, redirecting to proper callback URL');

    // Get the code
    const code = url.searchParams.get('code');

    // Always use the production URL for auth callbacks in production
    const productionUrl = 'https://poke-binder-flax.vercel.app';
    const baseUrl = process.env.NODE_ENV === 'development'
      ? url.origin // Use current origin for local development
      : productionUrl; // Use production URL in all other environments

    // Create a new URL for the proper callback endpoint
    const callbackUrl = new URL('/auth/callback', baseUrl);
    callbackUrl.searchParams.set('code', code!);

    // Add any other params that might be needed
    url.searchParams.forEach((value, key) => {
      if (key !== 'code') {
        callbackUrl.searchParams.set(key, value);
      }
    });

    console.log('Redirecting from root to callback:', callbackUrl.toString());
    // Redirect to the proper auth callback URL
    return NextResponse.redirect(callbackUrl);
  }

  // Redirect /my-collection to /collections
  if (url.pathname === '/my-collection' || url.pathname.startsWith('/my-collection/')) {
    const collectionsUrl = new URL('/collections', url.origin);

    // Preserve any query parameters
    url.searchParams.forEach((value, key) => {
      collectionsUrl.searchParams.set(key, value);
    });

    console.log('Redirecting from /my-collection to /collections');
    return NextResponse.redirect(collectionsUrl);
  }

  return NextResponse.next();
}