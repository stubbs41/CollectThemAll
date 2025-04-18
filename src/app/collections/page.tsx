import React from 'react';
import CollectionsClient from './client';

// This is a server component that renders the client component
const CollectionsPage: React.FC = () => {
  return <CollectionsClient />;
};

export default CollectionsPage;
