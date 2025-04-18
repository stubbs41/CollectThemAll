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
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Login to MyBinder</h1>

      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1">
            <div className="bg-white p-8">
              {/* Pokéball logo at the top */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-8 bg-red-500 rounded-t-full"></div>
                    <div className="w-16 h-8 bg-white rounded-b-full"></div>
                    <div className="absolute w-6 h-6 bg-white rounded-full border-2 border-gray-800"></div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>

              {/* Auth form with custom styling */}
              <div className="auth-form-container">
                <AuthForm />
              </div>

              {/* Additional information */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to collections link */}
        <div className="mt-6 text-center">
          <Link href="/collections" className="text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out">
            &larr; Back to Collections
          </Link>
        </div>
      </div>

      {/* Add some decorative card images */}
      <div className="mt-12 flex justify-center space-x-4 overflow-hidden">
        <div className="w-24 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-md transform -rotate-6"></div>
        <div className="w-24 h-32 bg-gradient-to-br from-red-400 to-red-600 rounded-lg shadow-md transform rotate-3 z-10"></div>
        <div className="w-24 h-32 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-md transform rotate-12"></div>
      </div>
    </div>
  );
};

export default LoginPage;
