'use client';

import React from 'react';
import AuthForm from '@/components/AuthForm';
// Temporarily comment out MyCollection to fix build error
// import MyCollection from '@/components/MyCollection';

const CollectionsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">My Pokémon Card Collection</h1>

      {/* Display the login form */}
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-6 text-center">Sign In to View Your Collection</h2>
        <AuthForm />
      </div>
    </div>
  );
};

export default CollectionsPage;
