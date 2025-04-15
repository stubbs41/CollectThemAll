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
      <div className="w-full max-w-md p-4 mx-auto">
         {/* Add some styling to make it look better */}
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }} // Use Supabase's default theme
          providers={['google']} // Only include Google for social login
          theme="dark" // Or "light"
          redirectTo={redirectUrl} // Pass the redirectPath for redirect after auth
          onlyThirdPartyProviders={false}
        />
      </div>
    );
  } else {
    // Show user info and logout button if logged in
    return (
      <div className="p-4 text-center">
        <p>Logged in as: {session.user.email}</p>
        <div className="mt-4 space-y-3">
          <button
            onClick={signOut}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow"
          >
            Logout
          </button>
          <button
            onClick={refreshSession}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow"
          >
            Refresh Session
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Use this button if your collections aren't showing or you're having authentication issues.
          </p>
        </div>
      </div>
    );
  }
}
