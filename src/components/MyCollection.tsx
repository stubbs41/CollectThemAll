'use client';

// Add timer property to Window interface
declare global {
  interface Window {
    quantityUpdateTimer: ReturnType<typeof setTimeout>;
  }
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CollectionImportExport from '@/components/collection/CollectionImportExport';
import CollectionGroupSelector from '@/components/collection/CollectionGroupSelector';
import CollectionGroupModal from '@/components/collection/CollectionGroupModal';
import BatchCardMover from '@/components/collection/BatchCardMover';
import CardQuantityControls from '@/components/card/CardQuantityControls';
import AdvancedFilterPanel, { FilterCriteria, SortOption as AdvancedSortOption } from '@/components/collection/AdvancedFilterPanel';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { preloadImages } from '@/lib/utils';
import { FunnelIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CollectionType } from '@/services/CollectionService';
import { shouldUpdatePrices, updatePriceTimestamp, getLastUpdateTimeFormatted, getTimeUntilNextUpdate } from '@/lib/priceUtils';
import { PokemonCard } from '@/lib/types';
import SimpleCardDetailModal from '@/components/SimpleCardDetailModal';
import { fetchCardDetails } from '@/lib/pokemonApi';

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
    refreshCollections,
    addCardToCollection,
    removeCardFromCollection
  } = useCollections();

  // State for card detail modal
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Function to prefetch card data for visible cards
  const prefetchVisibleCards = useCallback((cards: CollectionItem[]) => {
    if (cards.length === 0) return;

    // Prefetch the first 8 cards (most likely to be clicked)
    const cardsToFetch = cards.slice(0, 8);

    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      cardsToFetch.forEach(item => {
        if (item && item.card_id) {
          // Fetch card details without forcing price refresh
          fetchCardDetails(item.card_id, false).catch(err => {
            // Silently fail for prefetching
            console.debug(`Failed to prefetch card ${item.card_id}:`, err);
          });
        }
      });
    }, 500); // Delay prefetching to prioritize visible content
  }, []);

  const pathname = usePathname();
  const [activeType, setActiveType] = useState<CollectionType>('have');
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<{name: string, description?: string} | null>(null);
  const [isBatchMoverOpen, setIsBatchMoverOpen] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [priceUpdateMessage, setPriceUpdateMessage] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('Never updated');
  const [timeUntilNextUpdate, setTimeUntilNextUpdate] = useState<string>('Update needed');

  // State for tracking when collections were last refreshed
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // State for locally updated collection data
  const [localCollectionUpdates, setLocalCollectionUpdates] = useState<Map<string, number>>(new Map());

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

    if (!collection) return [];

    // Return the collection items
    return Array.from(collection.cards.values());
  }, [collections, activeGroup, activeType]);

  // Collection statistics with local updates applied
  const collectionStats = useMemo(() => {
    // Apply local updates to the collection for accurate stats
    const updatedCollection = currentCollection.map(item => {
      let updatedItem = { ...item };

      // Check if we have a quantity update for this card
      if (localCollectionUpdates.has(item.card_id)) {
        const updatedQuantity = localCollectionUpdates.get(item.card_id);
        // If quantity is 0, we'll filter it out later
        if (updatedQuantity === 0) {
          return updatedItem;
        }
        // Otherwise update the quantity
        updatedItem.quantity = updatedQuantity!;
      }

      // Check if we have a price update for this card
      const priceKey = `price_${item.card_id}`;
      if (localCollectionUpdates.has(priceKey)) {
        const updatedPrice = localCollectionUpdates.get(priceKey);
        updatedItem.market_price = updatedPrice as number;
      }

      return updatedItem;
    }).filter(item => {
      // Filter out cards with quantity 0 (marked for removal)
      return !localCollectionUpdates.has(item.card_id) || localCollectionUpdates.get(item.card_id)! > 0;
    });

    const uniqueCards = updatedCollection.length;
    const totalCards = updatedCollection.reduce((sum, item) => sum + item.quantity, 0);

    // Find recently added cards (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentlyAdded = updatedCollection.filter(
      item => new Date(item.added_at) >= oneWeekAgo
    ).length;

    // Calculate highest quantity card
    let highestQuantity = 0;
    let highestQuantityCard: CollectionItem | null = null;

    updatedCollection.forEach(item => {
      if (item.quantity > highestQuantity) {
        highestQuantity = item.quantity;
        highestQuantityCard = item;
      }
    });

    // Calculate total value
    const totalValue = updatedCollection.reduce(
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
  }, [currentCollection, localCollectionUpdates]);

  // Get collection counts with local updates applied
  const collectionCounts = useMemo(() => {
    // Get base counts from collections
    const haveCollection = collections.find(
      col => col.groupName === activeGroup && col.type === 'have'
    );
    const wantCollection = collections.find(
      col => col.groupName === activeGroup && col.type === 'want'
    );

    // Start with the base counts
    let haveCount = haveCollection ? haveCollection.cards.size : 0;
    let wantCount = wantCollection ? wantCollection.cards.size : 0;

    // Adjust counts based on local updates (cards with quantity 0 should be removed from count)
    if (localCollectionUpdates.size > 0) {
      // Count cards that have been removed (quantity set to 0)
      const removedHaveCards = Array.from(localCollectionUpdates.entries())
        .filter(([cardId, qty]) => {
          // Check if this card is in the 'have' collection and has been set to 0
          return qty === 0 && haveCollection?.cards.has(cardId);
        }).length;

      const removedWantCards = Array.from(localCollectionUpdates.entries())
        .filter(([cardId, qty]) => {
          // Check if this card is in the 'want' collection and has been set to 0
          return qty === 0 && wantCollection?.cards.has(cardId);
        }).length;

      // Adjust counts
      haveCount -= removedHaveCards;
      wantCount -= removedWantCards;
    }

    return {
      have: haveCount,
      want: wantCount
    };
  }, [collections, activeGroup, localCollectionUpdates]);

  // Apply sorting and filtering to the collection
  const filteredAndSortedCollection = useMemo(() => {
    // First apply local updates to the collection
    let result = currentCollection.map(item => {
      let updatedItem = { ...item };

      // Check if we have a quantity update for this card
      if (localCollectionUpdates.has(item.card_id)) {
        const updatedQuantity = localCollectionUpdates.get(item.card_id);
        // If quantity is 0, we'll filter it out later
        if (updatedQuantity === 0) {
          return updatedItem;
        }
        // Otherwise update the quantity
        updatedItem.quantity = updatedQuantity!;
      }

      // Check if we have a price update for this card
      const priceKey = `price_${item.card_id}`;
      if (localCollectionUpdates.has(priceKey)) {
        const updatedPrice = localCollectionUpdates.get(priceKey);
        updatedItem.market_price = updatedPrice as number;
      }

      return updatedItem;
    });

    // Filter out cards with quantity 0 (marked for removal)
    result = result.filter(item => {
      return !localCollectionUpdates.has(item.card_id) || localCollectionUpdates.get(item.card_id)! > 0;
    });

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
  }, [currentCollection, activeFilter, sortBy, filteredByAdvanced, advancedFilterCriteria, advancedSortBy, localCollectionUpdates]);

  // Function to handle quantity changes
  const handleQuantityChange = useCallback(async (cardId: string, newQuantity: number) => {
    // Update the local collection updates map immediately for UI updates
    const newUpdates = new Map(localCollectionUpdates);
    if (newQuantity === 0) {
      // Mark for removal
      newUpdates.set(cardId, 0);
    } else {
      // Update quantity
      newUpdates.set(cardId, newQuantity);
    }
    setLocalCollectionUpdates(newUpdates);

    // Update the database in the background without refreshing the page
    try {
      const response = await fetch('/api/collections/update-quantity', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId,
          collectionType: activeType,
          groupName: activeGroup,
          quantity: newQuantity
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating quantity:', errorData.error);
      }

      // No need to refresh the entire collection
      // The UI is already updated with localCollectionUpdates
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }, [localCollectionUpdates, activeType, activeGroup]);

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

  // Track if we've already triggered an auto-update for the current collection
  const [hasAutoUpdated, setHasAutoUpdated] = useState<boolean>(false);

  // Handle updating market prices
  const handleUpdateMarketPrices = useCallback(async (isAutoUpdate = false) => {
    if (isUpdatingPrices) return;

    setIsUpdatingPrices(true);

    // Only show message for manual updates, not auto-updates
    if (!isAutoUpdate) {
      setPriceUpdateMessage('Updating market prices...');
    }

    try {
      const response = await fetch(`/api/collections/update-prices?groupName=${encodeURIComponent(activeGroup)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Only show success message for manual updates
      if (!isAutoUpdate) {
        setPriceUpdateMessage(`Successfully updated ${data.updated} of ${data.total} cards`);

        // Clear message after 3 seconds for manual updates
        setTimeout(() => {
          setPriceUpdateMessage(null);
        }, 3000);
      }

      // Update the price timestamp
      updatePriceTimestamp();
      updatePriceInfoStates();

      // Instead of refreshing the entire collection, update the prices in the current collection
      // This avoids a full page refresh
      setHasAutoUpdated(true); // Set this to prevent loop

      // Update the prices in the current collection without refreshing
      // We'll fetch just the updated prices and apply them to our local state
      try {
        const pricesResponse = await fetch(`/api/collections?groupName=${encodeURIComponent(activeGroup)}`);
        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json();
          if (pricesData.collection) {
            // Create a map of card ID to market price
            const priceMap = new Map();
            pricesData.collection.forEach((item: any) => {
              priceMap.set(item.card_id, item.market_price || 0);
            });

            // Update the local collection with new prices
            const newUpdates = new Map(localCollectionUpdates);
            currentCollection.forEach(item => {
              if (priceMap.has(item.card_id)) {
                const updatedPrice = priceMap.get(item.card_id);
                if (updatedPrice !== item.market_price) {
                  // Store the updated price in our local updates
                  // We'll use a special key format to distinguish price updates from quantity updates
                  newUpdates.set(`price_${item.card_id}`, updatedPrice);
                }
              }
            });
            setLocalCollectionUpdates(newUpdates);
          }
        }
      } catch (priceErr) {
        console.error('Error updating local prices:', priceErr);
      }
    } catch (err) {
      console.error('Error updating market prices:', err);

      // Only show error message for manual updates
      if (!isAutoUpdate) {
        setPriceUpdateMessage(`Error: ${err instanceof Error ? err.message : 'Failed to update prices'}`);

        // Clear error message after 3 seconds
        setTimeout(() => {
          setPriceUpdateMessage(null);
        }, 3000);
      }
    } finally {
      setIsUpdatingPrices(false);
    }
  }, [activeGroup, updatePriceInfoStates, updatePriceTimestamp, setHasAutoUpdated, localCollectionUpdates, currentCollection]);

  // Effect to check if prices need to be updated when component mounts
  useEffect(() => {
    // Update the price info states
    updatePriceInfoStates();

    // Set up an interval to update the time until next update and check for price updates
    const intervalId = setInterval(() => {
      updatePriceInfoStates();

      // Check if prices need to be updated based on cache duration
      if (shouldUpdatePrices() && !isUpdatingPrices) {
        // Silently update prices in the background
        handleUpdateMarketPrices(true);
      }
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [updatePriceInfoStates, handleUpdateMarketPrices, isUpdatingPrices]);

  // Separate effect to handle auto price updates
  useEffect(() => {
    // Reset the auto-update flag when collection, group or type changes
    setHasAutoUpdated(false);
  }, [activeGroup, activeType]);

  // Effect to trigger price updates when needed
  useEffect(() => {
    // Only auto-update if we haven't already updated for this collection view
    // and we have cards to update
    if (session && !isUpdatingPrices && currentCollection.length > 0 && !hasAutoUpdated) {
      // Auto-update prices when viewing collections
      handleUpdateMarketPrices(true);
      setHasAutoUpdated(true);
    }
  }, [session, isUpdatingPrices, currentCollection, hasAutoUpdated, handleUpdateMarketPrices]);

  // Effect to prefetch card data when filtered collection changes
  useEffect(() => {
    if (filteredAndSortedCollection.length > 0) {
      prefetchVisibleCards(filteredAndSortedCollection);
    }
  }, [filteredAndSortedCollection, prefetchVisibleCards]);

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
                <div className="text-xs text-gray-600 flex items-center">
                  <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                  <span className="font-medium">Prices: </span>
                  <span className="ml-1">{isUpdatingPrices ? 'Updating...' : `Last updated: ${lastUpdateTime}`}</span>
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
              <div
                className="block w-full cursor-pointer"
                onClick={() => setSelectedCardId(item.card_id)}
              >
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
              </div>

              {/* Card Details */}
              <h3 className="text-sm font-medium text-gray-800 mb-1 line-clamp-1" title={item.card_name || item.card_id}>
                {item.card_name || item.card_id}
              </h3>

              <div className="flex justify-between w-full text-xs text-gray-600 mt-1">
                <span className="font-medium">${(item.market_price || 0).toFixed(2)}</span>
              </div>

              {/* Quantity Controls using the new component */}
              <div className="mt-2 w-full">
                <CardQuantityControls
                  cardId={item.card_id}
                  cardName={item.card_name}
                  cardImageSmall={item.card_image_small}
                  initialQuantity={item.quantity}
                  collectionType={activeType}
                  groupName={activeGroup}
                  onQuantityChange={(newQuantity) => handleQuantityChange(item.card_id, newQuantity)}
                />
              </div>
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

      {/* Card Detail Modal */}
      <SimpleCardDetailModal
        cardId={selectedCardId}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
  );
}
