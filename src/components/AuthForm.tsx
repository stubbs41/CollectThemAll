'use client'; // This component interacts with browser APIs (Supabase client)

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabaseClient'; // Adjust path if needed
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AuthForm() {
  const supabase = createClient(); // Get Supabase client instance
  const pathname = usePathname(); // Get current path for redirect
  const { session, signOut, refreshSession, getRedirectPath } = useAuth();

  // Check if there's a stored redirect path, otherwise use the current path
  const storedRedirectPath = getRedirectPath();
  const redirectPath = storedRedirectPath || pathname;

  // Prepare the redirect URL with the current or stored path
  // Use the current origin to ensure it works on all environments
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
  const redirectUrl = `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectPath)}`;

  if (!session) {
    // Show login/signup form if user is not logged in
    return (
      <div className="w-full p-6 mx-auto">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">Account Access</h3>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#4F46E5',
                  brandAccent: '#4338CA',
                  inputBackground: '#1F2937',
                  inputBorder: '#374151',
                  inputText: '#F9FAFB',
                  inputLabelText: '#D1D5DB',
                }
              }
            },
            style: {
              button: {
                borderRadius: '0.375rem',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '500',
              },
              input: {
                borderRadius: '0.375rem',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
              },
              anchor: {
                color: '#93C5FD',
                fontSize: '0.875rem',
              },
              message: {
                padding: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '0.75rem',
              },
              container: {
                width: '100%',
              }
            }
          }}
          providers={['google']} // Only include Google for social login
          theme="dark"
          redirectTo={redirectUrl} // Pass the redirectPath for redirect after auth
          onlyThirdPartyProviders={false}
        />
      </div>
    );
  } else {
    // Show user info and logout button if logged in
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
        <div className="bg-gray-800 p-3 rounded-md mb-4">
          <p className="text-sm text-gray-300 mb-1">Logged in as:</p>
          <p className="text-white font-medium truncate">{session.user.email}</p>
        </div>
        <div className="mt-4 space-y-3">
          <button
            onClick={refreshSession}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-colors"
          >
            Refresh Session
          </button>
          <p className="text-xs text-gray-400 mb-3">
            Use this if your collections aren't showing properly
          </p>
          <button
            onClick={signOut}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }
}
