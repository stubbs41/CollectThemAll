'use client';

import React from 'react';
// Temporarily comment out MyCollection to fix build error
// import MyCollection from '@/components/MyCollection';

const CollectionsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">My Pokémon Card Collection</h1>

      {/* Temporarily display a message instead of the collection component */}
      <div className="text-center p-8 bg-gray-100 rounded-lg shadow">
        <p className="text-lg mb-4">Collection functionality is temporarily unavailable.</p>
        <p>Please check back later or try refreshing the page.</p>
      </div>
    </div>
  );
};

export default CollectionsPage;
