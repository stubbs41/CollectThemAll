import React from 'react';
import Link from 'next/link';

// This is a server component that doesn't use any client-side hooks
const CollectionsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">My Pokémon Card Collection</h1>

      {/* Display a simple message with a link to the login page */}
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-6 text-center">Sign In to View Your Collection</h2>
        <p className="text-center mb-6">You need to be signed in to view and manage your collection.</p>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            Go to Login Page
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CollectionsPage;
