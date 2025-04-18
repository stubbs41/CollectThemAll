'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, Suspense } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Helper component to use search params with Suspense
const SearchParamsProvider = ({ children }: { children: (searchParams: URLSearchParams) => React.ReactNode }) => {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
};

// Define the context type
type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setRedirectPath: (path: string) => void;
  getRedirectPath: () => string | null;
};

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for storing redirect path in localStorage
const REDIRECT_PATH_KEY = 'auth_redirect_path';

// Provider component that wraps the app and makes auth available to any child component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // Track if this is after an auth redirect
  const isAuthRedirect = React.useRef(false);

  // Check if the current URL has auth_timestamp, indicating we just redirected from auth
  const handleSearchParams = (searchParams: URLSearchParams) => {
    const authTimestamp = searchParams.get('auth_timestamp');
    if (authTimestamp) {
      isAuthRedirect.current = true;
      console.log('Auth redirect detected via auth_timestamp parameter');

      // Force a session refresh immediately
      refreshSession();

      // Remove the timestamp parameter from URL to clean it up
      // We'll use setTimeout to ensure this happens after other code has run
      setTimeout(() => {
        // Check if window is defined (client-side only)
        if (typeof window !== 'undefined') {
          // Always clean up the URL
          const url = new URL(window.location.href);
          url.searchParams.delete('auth_timestamp');
          window.history.replaceState({}, '', url.toString());

          // Clear the stored redirect path since we've completed the redirect
          localStorage.removeItem(REDIRECT_PATH_KEY);

          // Force a refresh of collections
          console.log('Dispatching manual collection refresh event');
          window.dispatchEvent(new CustomEvent('force-collection-refresh'));
        }
      }, 500);
    }
  };

  // Function to set the redirect path
  const setRedirectPath = (path: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(REDIRECT_PATH_KEY, path);
    }
  };

  // Function to get the redirect path
  const getRedirectPath = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(REDIRECT_PATH_KEY);
    }
    return null;
  };

  // Function to manually refresh the session
  const refreshSession = async () => {
    try {
      console.log('Manually refreshing session...');
      // Show a brief notification to the user
      if (typeof window !== 'undefined') {
        const notification = document.createElement('div');
        notification.textContent = 'Refreshing session...';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 15px';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);

        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user || null);
      console.log('Session refreshed:', data.session ? 'Found' : 'Not found');

      // Dispatch an event to notify other components that auth has been refreshed
      if (typeof window !== 'undefined') {
        console.log('Dispatching auth-state-change event after manual refresh');
        window.dispatchEvent(new CustomEvent('auth-state-change', {
          detail: {
            event: 'SIGNED_IN',
            session: data.session,
            user: data.session?.user || null
          }
        }));
      }

      return data;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  };

  // Initial session check and auth listener
  useEffect(() => {
    setIsLoading(true);

    // Add a flag to track if we've completed the initial auth check
    let initialAuthCheckComplete = false;

    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth state...');

        // If we just redirected from auth, we need to make sure we get the latest session
        if (isAuthRedirect.current) {
          console.log('Auth redirect detected, refreshing session immediately');
          // Add a small delay to ensure cookies are fully set
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user || null);
        console.log('Initial session:', data.session ? 'Found' : 'Not found');

        // If we were expecting a session after redirect but didn't get one, refresh again
        if (isAuthRedirect.current && !data.session) {
          console.log('No session found after auth redirect, trying again...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          const refreshData = await refreshSession();
          if (!refreshData?.session) {
            console.log('Still no session after second attempt');
          }
        }

        // Mark initial auth check as complete
        initialAuthCheckComplete = true;

        // Dispatch an event to notify other components that auth is ready
        // This is crucial for components that need to know when auth is initialized
        if (typeof window !== 'undefined') {
          console.log('Dispatching auth-ready event with session:', data.session ? 'Session exists' : 'No session');
          window.dispatchEvent(new CustomEvent('auth-ready', {
            detail: {
              session: data.session,
              user: data.session?.user || null
            }
          }));
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setIsLoading(false);
        isAuthRedirect.current = false;
      }
    };

    initializeAuth();

    // Set up the auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session ? 'Session exists' : 'No session');
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);

        // Dispatch an event to notify other components that auth state has changed
        if (typeof window !== 'undefined') {
          console.log('Dispatching auth-state-change event:', event, session ? 'Session exists' : 'No session');
          window.dispatchEvent(new CustomEvent('auth-state-change', {
            detail: {
              event,
              session,
              user: session?.user || null
            }
          }));
        }
      }
    );

    // Clean up the listener on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, pathname]); // Re-initialize when pathname changes

  // Sign out function
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    session,
    user,
    isLoading,
    signOut,
    refreshSession,
    setRedirectPath,
    getRedirectPath,
  };

  return (
    <AuthContext.Provider value={value}>
      <Suspense fallback={<div>Loading...</div>}>
        <SearchParamsProvider>
          {(searchParams) => {
            handleSearchParams(searchParams);
            return children;
          }}
        </SearchParamsProvider>
      </Suspense>
    </AuthContext.Provider>
  );
};

// Hook for easy access to the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};