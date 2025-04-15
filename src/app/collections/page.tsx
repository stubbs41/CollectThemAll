'use client';

import React from 'react';
import MyCollection from '@/components/MyCollection';

const CollectionsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">My Pokémon Card Collection</h1>
      
      {/* Display the Supabase-powered collection component */}
      <MyCollection />
    </div>
  );
};

export default CollectionsPage;
