'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CollectionImportExport from '@/components/collection/CollectionImportExport';
import CollectionGroupSelector from '@/components/collection/CollectionGroupSelector';
import CollectionGroupModal from '@/components/collection/CollectionGroupModal';
import BatchCardMover from '@/components/collection/BatchCardMover';
import AdvancedFilterPanel, { FilterCriteria, SortOption as AdvancedSortOption } from '@/components/collection/AdvancedFilterPanel';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { preloadImages } from '@/lib/utils';
import { FunnelIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CollectionType } from '@/services/CollectionService';
import { shouldUpdatePrices, updatePriceTimestamp, getLastUpdateTimeFormatted, getTimeUntilNextUpdate } from '@/lib/priceUtils';

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
  const [isBatchMoverOpen, setIsBatchMoverOpen] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [priceUpdateMessage, setPriceUpdateMessage] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('Never updated');
  const [timeUntilNextUpdate, setTimeUntilNextUpdate] = useState<string>('Update needed');

  // State for sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [advancedFilterCriteria, setAdvancedFilterCriteria] = useState<FilterCriteria>({});
  const [advancedSortBy, setAdvancedSortBy] = useState<AdvancedSortOption>('newest');
  const [filteredByAdvanced, setFilteredByAdvanced] = useState(false);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(searchQuery.trim());
  };

  // Handle clearing the search
  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveFilter('');
    setFilteredByAdvanced(false);
    setAdvancedFilterCriteria({});
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

    // Apply basic search filter if not using advanced filters
    if (!filteredByAdvanced && activeFilter.trim()) {
      const query = activeFilter.toLowerCase().trim();
      result = result.filter(item =>
        (item.card_name?.toLowerCase() || '').includes(query) ||
        item.card_id.toLowerCase().includes(query)
      );
    }

    // Apply advanced filters if enabled
    if (filteredByAdvanced) {
      // Apply name filter
      if (advancedFilterCriteria.name) {
        const nameFilter = advancedFilterCriteria.name.toLowerCase();
        result = result.filter(item =>
          (item.card_name?.toLowerCase() || '').includes(nameFilter)
        );
      }

      // Apply set filter
      if (advancedFilterCriteria.set) {
        result = result.filter(item =>
          item.card?.set?.name === advancedFilterCriteria.set
        );
      }

      // Apply rarity filter
      if (advancedFilterCriteria.rarity) {
        result = result.filter(item =>
          item.card?.rarity === advancedFilterCriteria.rarity
        );
      }

      // Apply type filter
      if (advancedFilterCriteria.type) {
        result = result.filter(item =>
          item.card?.types?.includes(advancedFilterCriteria.type!)
        );
      }

      // Apply subtype filter
      if (advancedFilterCriteria.subtype) {
        result = result.filter(item =>
          item.card?.subtypes?.includes(advancedFilterCriteria.subtype!)
        );
      }

      // Apply price range filter
      if (advancedFilterCriteria.minPrice !== undefined || advancedFilterCriteria.maxPrice !== undefined) {
        result = result.filter(item => {
          const price = item.market_price || 0;
          const minOk = advancedFilterCriteria.minPrice === undefined || price >= advancedFilterCriteria.minPrice;
          const maxOk = advancedFilterCriteria.maxPrice === undefined || price <= advancedFilterCriteria.maxPrice;
          return minOk && maxOk;
        });
      }

      // Apply quantity range filter
      if (advancedFilterCriteria.minQuantity !== undefined || advancedFilterCriteria.maxQuantity !== undefined) {
        result = result.filter(item => {
          const quantity = item.quantity || 0;
          const minOk = advancedFilterCriteria.minQuantity === undefined || quantity >= advancedFilterCriteria.minQuantity;
          const maxOk = advancedFilterCriteria.maxQuantity === undefined || quantity <= advancedFilterCriteria.maxQuantity;
          return minOk && maxOk;
        });
      }
    }

    // Then apply sorting
    return [...result].sort((a, b) => {
      // Use advanced sort if enabled
      if (filteredByAdvanced) {
        switch (advancedSortBy) {
          case 'name':
            return (a.card_name || a.card_id).localeCompare(b.card_name || b.card_id);
          case 'set':
            const setA = a.card?.set?.name || '';
            const setB = b.card?.set?.name || '';
            return setA.localeCompare(setB);
          case 'rarity':
            const rarityA = a.card?.rarity || '';
            const rarityB = b.card?.rarity || '';
            return rarityA.localeCompare(rarityB);
          case 'price_asc':
            return (a.market_price || 0) - (b.market_price || 0);
          case 'price_desc':
            return (b.market_price || 0) - (a.market_price || 0);
          case 'quantity_asc':
            return (a.quantity || 0) - (b.quantity || 0);
          case 'quantity_desc':
            return (b.quantity || 0) - (a.quantity || 0);
          case 'newest':
            return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
          case 'oldest':
            return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
          default:
            return 0;
        }
      } else {
        // Use basic sort
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
      }
    });
  }, [currentCollection, activeFilter, sortBy, filteredByAdvanced, advancedFilterCriteria, advancedSortBy]);

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

  // Update price info states
  const updatePriceInfoStates = useCallback(() => {
    setLastUpdateTime(getLastUpdateTimeFormatted());
    setTimeUntilNextUpdate(getTimeUntilNextUpdate());
  }, []);

  // Effect to check if prices need to be updated when component mounts
  useEffect(() => {
    // Update the price info states
    updatePriceInfoStates();

    // Set up an interval to update the time until next update
    const intervalId = setInterval(() => {
      updatePriceInfoStates();
    }, 60000); // Update every minute

    // Check if prices need to be updated
    if (session && shouldUpdatePrices() && !isUpdatingPrices) {
      // Auto-update prices when needed
      handleUpdateMarketPrices(true);
    }

    return () => clearInterval(intervalId);
  }, [session, isUpdatingPrices, updatePriceInfoStates]);

  // Handle updating market prices
  const handleUpdateMarketPrices = async (isAutoUpdate = false) => {
    if (isUpdatingPrices) return;

    setIsUpdatingPrices(true);
    setPriceUpdateMessage(isAutoUpdate ? 'Auto-updating market prices...' : 'Updating market prices...');

    try {
      const response = await fetch(`/api/collections/update-prices?groupName=${encodeURIComponent(activeGroup)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPriceUpdateMessage(`Successfully updated ${data.updated} of ${data.total} cards`);

      // Update the price timestamp
      updatePriceTimestamp();
      updatePriceInfoStates();

      // Refresh collections to show updated prices
      await refreshCollections();

      // Clear message after 5 seconds
      setTimeout(() => {
        setPriceUpdateMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error updating market prices:', err);
      setPriceUpdateMessage(`Error: ${err instanceof Error ? err.message : 'Failed to update prices'}`);

      // Clear error message after 5 seconds
      setTimeout(() => {
        setPriceUpdateMessage(null);
      }, 5000);
    } finally {
      setIsUpdatingPrices(false);
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

      {/* Collection Overview and Actions */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          {/* Collection Stats */}
          <div className="w-full md:w-2/3">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">Collection Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-100 p-3 rounded text-center">
                <p className="text-sm text-gray-600">Unique Cards</p>
                <p className="text-lg font-bold text-gray-800">{collectionStats.uniqueCards}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded text-center">
                <p className="text-sm text-gray-600">Total Cards</p>
                <p className="text-lg font-bold text-gray-800">{collectionStats.totalCards}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded text-center">
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-lg font-bold text-gray-800">${collectionStats.totalValue.toFixed(2)}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded text-center">
                <p className="text-sm text-gray-600">Recently Added</p>
                <p className="text-lg font-bold text-gray-800">{collectionStats.recentlyAdded}</p>
              </div>
            </div>

            {/* Collection Actions */}
            {priceUpdateMessage && (
              <div className={`mt-4 p-2 rounded text-sm ${priceUpdateMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {priceUpdateMessage}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveType('have')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${activeType === 'have' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                I Have ({collectionCounts.have})
              </button>
              <button
                type="button"
                onClick={() => setActiveType('want')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${activeType === 'want' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                I Want ({collectionCounts.want})
              </button>
              <Link href="/explore" className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700">
                Add Cards
              </Link>
              <button
                type="button"
                onClick={() => setIsBatchMoverOpen(true)}
                className="px-3 py-1.5 text-sm font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
              >
                Move Cards
              </button>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleUpdateMarketPrices(false)}
                  disabled={isUpdatingPrices}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  title={`Last updated: ${lastUpdateTime}`}
                >
                  <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                  {isUpdatingPrices ? 'Updating...' : 'Update Prices'}
                </button>
                <div className="text-xs text-gray-500 mt-1 flex items-center">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  <span>Next update: {timeUntilNextUpdate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Import/Export Component */}
          <div className="w-full md:w-1/3">
            <CollectionImportExport
              collection={currentCollection}
              collectionType={activeType}
              groupName={activeGroup}
              availableGroups={groups}
              onImportComplete={refreshCollections}
            />
          </div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
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
          <div className="flex-shrink-0 min-w-[150px]">
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

          {/* Advanced Filter Button */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advanced
            </label>
            <button
              type="button"
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className={`px-4 py-2 text-sm rounded-md flex items-center ${showAdvancedFilter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              {showAdvancedFilter ? 'Hide Filters' : 'Advanced Filters'}
            </button>
          </div>
        </div>

        {/* Active Filter Display */}
        {activeFilter && !filteredByAdvanced && (
          <div className="mt-3 text-sm text-gray-600">
            Showing results for: <span className="font-medium">"{activeFilter}"</span>
          </div>
        )}

        {filteredByAdvanced && (
          <div className="mt-3 text-sm text-gray-600">
            Showing results with advanced filters
            <button
              type="button"
              onClick={() => {
                setFilteredByAdvanced(false);
                setAdvancedFilterCriteria({});
              }}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Advanced Filter Panel */}
        {showAdvancedFilter && (
          <div className="mt-4">
            <AdvancedFilterPanel
              items={new Map(currentCollection.map(item => [item.card_id, item]))}
              onFilterChange={(filteredItems) => {
                setFilteredByAdvanced(true);
                // Store the filter criteria for use in the filteredAndSortedCollection useMemo
                const criteria = { ...advancedFilterCriteria };
                setAdvancedFilterCriteria(criteria);
              }}
              onSortChange={(newSortOption) => {
                setAdvancedSortBy(newSortOption);
              }}
              initialSortBy={advancedSortBy}
              initialFilter={advancedFilterCriteria}
              onClose={() => setShowAdvancedFilter(false)}
            />
          </div>
        )}
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
                <span className="font-medium">${(item.market_price || 0).toFixed(2)}</span>
              </div>

              {/* Remove Button */}
              <button
                type="button"
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

      {/* Batch Card Mover */}
      {isBatchMoverOpen && (
        <BatchCardMover
          onClose={() => setIsBatchMoverOpen(false)}
          onComplete={() => {
            setIsBatchMoverOpen(false);
            refreshCollections();
          }}
        />
      )}
    </div>
  );
}
