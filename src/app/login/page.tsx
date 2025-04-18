'use client';

import React from 'react';
import AuthForm from '@/components/AuthForm';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { session } = useAuth();

  // If user is already logged in, redirect to collections
  React.useEffect(() => {
    if (session) {
      router.push('/collections');
    }
  }, [session, router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">Login to MyBinder</h1>

      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1">
            <div className="bg-white p-6">
              {/* Pokéball logo - smaller version */}
              <div className="flex justify-center mb-4">
                <div className="w-8 h-8 relative">
                  <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-4 bg-red-500 rounded-t-full"></div>
                    <div className="w-8 h-4 bg-white rounded-b-full"></div>
                    <div className="absolute w-3 h-3 bg-white rounded-full border border-gray-800"></div>
                  </div>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">Welcome Back</h2>

              {/* Auth form with custom styling */}
              <div className="auth-form-container">
                <AuthForm />
              </div>

              {/* Additional information - more compact */}
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-500">
                  By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to collections link */}
        <div className="mt-3 text-center">
          <Link href="/collections" className="text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out text-xs">
            ← Back to Collections
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
