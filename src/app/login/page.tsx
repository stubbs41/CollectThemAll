'use client';

import React from 'react';
import AuthForm from '@/components/AuthForm';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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
      
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-6 text-center">Sign In</h2>
        <AuthForm />
      </div>
    </div>
  );
};

export default LoginPage;
