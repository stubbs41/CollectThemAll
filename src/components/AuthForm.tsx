'use client'; // This component interacts with browser APIs (Supabase client)

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabaseClient'; // Adjust path if needed
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function AuthForm() {
  const supabase = createClient(); // Get Supabase client instance
  const pathname = usePathname(); // Get current path for redirect
  const { session, signOut, refreshSession, getRedirectPath } = useAuth();
  const [emailEntered, setEmailEntered] = useState(false);
  const [email, setEmail] = useState('');

  // Check if there's a stored redirect path, otherwise use the current path
  const storedRedirectPath = getRedirectPath();
  const redirectPath = storedRedirectPath || pathname;

  // Prepare the redirect URL with the current or stored path
  // Always use the production URL in production environments
  const productionUrl = 'https://poke-binder-flax.vercel.app';
  const siteUrl = typeof window !== 'undefined'
    ? (process.env.NODE_ENV === 'development'
        ? window.location.origin
        : productionUrl)
    : productionUrl;

  console.log('Using site URL for auth redirect:', siteUrl);
  const redirectUrl = `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectPath)}`;

  // Handle email input and show password field
  const handleEmailInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (e.target.value.includes('@')) {
      setEmailEntered(true);
    }
  };

  if (!session) {
    // Show login/signup form if user is not logged in
    return (
      <div className="w-full mx-auto">
        {/* Google Sign In Button - Using GoogleSignIn component */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: redirectUrl,
                queryParams: {
                  access_type: 'offline',
                  prompt: 'consent',
                }
              }
            })}
            className="w-full flex items-center justify-center py-2 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Email/Password Login - Compact Version */}
        <div className="space-y-2">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={handleEmailInput}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {emailEntered && (
            <div>
              <input
                type="password"
                placeholder="Your password"
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}

          {emailEntered && (
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Hidden Auth component for actual authentication */}
        <div className="hidden">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              style: {
                container: { display: 'none' }
              }
            }}
            providers={['google']}
            redirectTo={redirectUrl}
          />
        </div>
      </div>
    );
  } else {
    // Show user info and logout button if logged in
    return (
      <div className="p-4 text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Account</h3>
        <div className="bg-gray-100 p-3 rounded-md mb-3">
          <p className="text-sm text-gray-600 mb-1">Logged in as:</p>
          <p className="text-gray-800 font-medium truncate">{session.user.email}</p>
        </div>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={refreshSession}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-colors text-sm"
          >
            Refresh Session
          </button>
          <p className="text-xs text-gray-500 mb-2">
            Use this if your collections aren't showing properly
          </p>
          <button
            type="button"
            onClick={signOut}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow transition-colors text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }
}
