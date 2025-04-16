'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CollectionImportExport from '@/components/collection/CollectionImportExport';
import CollectionGroupSelector from '@/components/collection/CollectionGroupSelector';
import CollectionGroupModal from '@/components/collection/CollectionGroupModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { preloadImages } from '@/lib/utils';
import { CollectionType } from '@/services/CollectionService';

// Define a type for the collection items we expect from the API
interface CollectionItem {
  id: string; // The UUID from the collections table
  card_id: string;
  card_name?: string | null;
  card_image_small?: string | null;
  collection_type: string; // 'have' or 'want'
  group_name: string;
  quantity: number;       // Number of cards in the collection
  added_at: string;
  market_price?: number;
}

// Sort options
type SortOption = 'name' | 'newest' | 'oldest' | 'quantity' | 'price';

export default function MyCollection() {
  const { session, isLoading: authLoading, setRedirectPath } = useAuth();
  const { 
    collections, 
    groups, 
    collectionGroups,
    activeGroup, 
    setActiveGroup,
    isLoading: collectionsLoading,
    refreshCollections
  } = useCollections();
  
  const pathname = usePathname();
  const [activeType, setActiveType] = useState<CollectionType>('have');
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<{name: string, description?: string} | null>(null);
  
  // State for sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(searchQuery.trim());
  };
  
  // Handle clearing the search
  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveFilter('');
  };
  
  // Get the current collection based on activeGroup and activeType
  const currentCollection = useMemo(() => {
    const collection = collections.find(
      col => col.groupName === activeGroup && col.type === activeType
    );
    return collection ? Array.from(collection.cards.values()) : [];
  }, [collections, activeGroup, activeType]);
  
  // Collection statistics
  const collectionStats = useMemo(() => {
    const uniqueCards = currentCollection.length;
    const totalCards = currentCollection.reduce((sum, item) => sum + item.quantity, 0);
    
    // Find recently added cards (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentlyAdded = currentCollection.filter(
      item => new Date(item.added_at) >= oneWeekAgo
    ).length;
    
    // Calculate highest quantity card
    let highestQuantity = 0;
    let highestQuantityCard: CollectionItem | null = null;
    
    currentCollection.forEach(item => {
      if (item.quantity > highestQuantity) {
        highestQuantity = item.quantity;
        highestQuantityCard = item;
      }
    });
    
    // Calculate total value
    const totalValue = currentCollection.reduce(
      (sum, item) => sum + (item.market_price || 0) * item.quantity, 
      0
    );
    
    return {
      uniqueCards,
      totalCards,
      recentlyAdded,
      highestQuantityCard,
      highestQuantity,
      totalValue
    };
  }, [currentCollection]);
  
  // Get collection counts
  const collectionCounts = useMemo(() => {
    const haveCollection = collections.find(
      col => col.groupName === activeGroup && col.type === 'have'
    );
    const wantCollection = collections.find(
      col => col.groupName === activeGroup && col.type === 'want'
    );
    
    return {
      have: haveCollection ? haveCollection.cards.size : 0,
      want: wantCollection ? wantCollection.cards.size : 0
    };
  }, [collections, activeGroup]);
  
  // Apply sorting and filtering to the collection
  const filteredAndSortedCollection = useMemo(() => {
    // First apply search filter
    let result = currentCollection;
    
    if (activeFilter.trim()) {
      const query = activeFilter.toLowerCase().trim();
      result = result.filter(item =>
        (item.card_name?.toLowerCase() || '').includes(query) ||
        item.card_id.toLowerCase().includes(query)
      );
    }
    
    // Then apply sorting
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.card_name || a.card_id).localeCompare(b.card_name || b.card_id);
        case 'newest':
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        case 'oldest':
          return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
        case 'quantity':
          return b.quantity - a.quantity;
        case 'price':
          return ((b.market_price || 0) * b.quantity) - ((a.market_price || 0) * a.quantity);
        default:
          return 0;
      }
    });
  }, [currentCollection, activeFilter, sortBy]);
  
  // Function to remove a card
  const handleRemoveCard = async (cardId: string, quantity: number) => {
    // If quantity > 1, ask if they want to remove all or just one
    let decrementOnly = false;
    if (quantity > 1) {
      decrementOnly = !confirm(`This card has ${quantity} copies. Do you want to remove ALL copies? Click OK to remove all, or Cancel to remove just one copy.`);
    } else if (!confirm(`Are you sure you want to remove this card?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/collections?cardId=${encodeURIComponent(cardId)}&type=${activeType}&decrementOnly=${decrementOnly}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      // Refresh collections after successful deletion
      refreshCollections();
    } catch (err: unknown) {
      console.error("Failed to remove card:", err);
      // Type check for Error object
      const message = err instanceof Error ? err.message : 'Unknown error removing card';
      alert(`Error removing card: ${message}`); // Show error to user
    }
  };
  
  // Handle opening the create group modal
  const handleOpenCreateGroupModal = () => {
    setGroupToEdit(null);
    setIsCreateGroupModalOpen(true);
  };
  
  // Handle opening the edit group modal
  const handleOpenEditGroupModal = (groupName: string) => {
    const group = collectionGroups.find(g => g.name === groupName);
    if (group) {
      setGroupToEdit({
        name: group.name,
        description: group.description
      });
      setIsCreateGroupModalOpen(true);
    }
  };
  
  // Render logic
  if (authLoading) {
    return <div className="text-center py-10">Loading authentication...</div>;
  }
  
  if (!session) {
    // Store the current path for redirect after login
    setRedirectPath(pathname);
    
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">Access Your Collection</h2>
        <p className="text-center text-gray-600 mb-6">Please sign in or sign up to view and manage your Pokémon card collection.</p>
        <AuthForm />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Collection Group Selector */}
      <CollectionGroupSelector onCreateGroup={handleOpenCreateGroupModal} />
      
      {/* Header Section (Stats, Import/Export) */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-2 md:mb-0">Collection Overview</h2>
          {/* Import/Export Component */}
          <CollectionImportExport
            collection={currentCollection}
            collectionType={activeType}
            groupName={activeGroup}
            availableGroups={groups}
            onImportComplete={refreshCollections}
          />
        </div>
        {/* Collection Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Unique Cards</p>
            <p className="text-lg font-bold text-gray-800">{collectionStats.uniqueCards}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Total Cards</p>
            <p className="text-lg font-bold text-gray-800">{collectionStats.totalCards}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-lg font-bold text-gray-800">${collectionStats.totalValue.toFixed(2)}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Highest Quantity</p>
            <p className="text-lg font-bold text-gray-800 truncate" title={collectionStats.highestQuantityCard?.card_name || 'N/A'}>
              {collectionStats.highestQuantity > 0
                ? `${collectionStats.highestQuantity}x ${collectionStats.highestQuantityCard?.card_name || 'Card'}`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Collection Tabs and Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveType('have')}
            className={`px-4 py-2 text-sm font-medium ${activeType === 'have' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            I Have ({collectionCounts.have})
          </button>
          <button
            onClick={() => setActiveType('want')}
            className={`px-4 py-2 text-sm font-medium ${activeType === 'want' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            I Want ({collectionCounts.want})
          </button>
        </div>
        
        {/* Search and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex-grow flex gap-2">
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
            >
              Search
            </button>
            {activeFilter && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition"
              >
                Clear
              </button>
            )}
          </form>
          
          {/* Sort Dropdown */}
          <div className="flex-shrink-0">
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="quantity">Quantity (High-Low)</option>
              <option value="price">Price (High-Low)</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Collection Grid */}
      {collectionsLoading ? (
        <div className="text-center py-10">Loading collection...</div>
      ) : filteredAndSortedCollection.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {activeFilter ? 'No cards match your search.' : `Your ${activeType === 'have' ? 'collection' : 'wishlist'} is empty.`}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAndSortedCollection.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-3 flex flex-col items-center text-center relative group"
            >
              {/* Card Image */}
              <Link href={`/cards/${item.card_id}`} className="block w-full">
                <div className="relative w-full aspect-[2.5/3.5] mb-2">
                  {item.card_image_small ? (
                    <Image
                      src={item.card_image_small}
                      alt={item.card_name || 'Pokémon Card'}
                      fill
                      sizes="(max-width: 768px) 40vw, 20vw"
                      className="object-contain rounded"
                      priority={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded">
                      <span className="text-gray-500 text-sm">No Image</span>
                    </div>
                  )}
                </div>
              </Link>
              
              {/* Card Details */}
              <h3 className="text-sm font-medium text-gray-800 mb-1 line-clamp-1" title={item.card_name || item.card_id}>
                {item.card_name || item.card_id}
              </h3>
              
              <div className="flex justify-between w-full text-xs text-gray-600 mt-1">
                <span>Quantity: {item.quantity}</span>
                <span>${(item.market_price || 0).toFixed(2)}</span>
              </div>
              
              {/* Remove Button */}
              <button
                onClick={() => handleRemoveCard(item.card_id, item.quantity)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from collection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Collection Group Modal */}
      <CollectionGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        groupToEdit={groupToEdit}
      />
    </div>
  );
}
