import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

// This is a server component that doesn't use any client-side hooks
const CollectionsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">My Pokémon Card Collection</h1>

      {/* Display a visually appealing card with a message and login button */}
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1">
          <div className="bg-white p-6">
            <div className="flex flex-col items-center">
              {/* Add a decorative Pokéball icon or card image */}
              <div className="w-24 h-24 mb-4 relative">
                <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-12 bg-red-500 rounded-t-full"></div>
                  <div className="w-24 h-12 bg-white rounded-b-full"></div>
                  <div className="absolute w-8 h-8 bg-white rounded-full border-4 border-gray-800"></div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Sign In to View Your Collection</h2>

              <p className="text-gray-600 mb-6 text-center">
                You need to be signed in to view and manage your collection.
              </p>

              <Link
                href="/login"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out text-center"
              >
                Go to Login Page
              </Link>

              <p className="mt-4 text-sm text-gray-500">
                Don't have an account? Sign up when you log in.
              </p>
            </div>
          </div>
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

export default CollectionsPage;
