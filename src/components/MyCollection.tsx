'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
// Remove unused supabase import if not needed
// import { createClient } from '@/lib/supabaseClient';
import Image from 'next/image';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CollectionImportExport from '@/components/collection/CollectionImportExport';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { preloadImages } from '@/lib/utils';
// -- REMOVE UNUSED CollectionType from removed share section
// import { CollectionType } from '@/services/CollectionService'; // Ensure CollectionType is imported if used here

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
}

// Sort options
type SortOption = 'name' | 'newest' | 'oldest' | 'quantity';

// -- REMOVE UNUSED Share related types/interfaces --
// Define expiration options (can be shared or redefined)
// const expirationOptions = [
//   { value: '1h', label: '1 Hour' },
//   { value: '1d', label: '1 Day' },
//   { value: '7d', label: '7 Days' },
//   { value: '30d', label: '30 Days' },
//   { value: 'never', label: 'Never' },
//   { value: 'unknown', label: 'Default' } // Add fallback for unknown
// ];
// type ExpirationValue = '1h' | '1d' | '7d' | '30d' | 'never' | 'unknown';
//
// // New interface for fetched share data
// interface MyShare {
//   share_id: string;
//   collection_name: string;
//   collection_type: CollectionType;
//   created_at: string;
//   expires_at: string | null;
//   expires_in: ExpirationValue;
//   shareUrl: string;
//   status: string; // Added status
//   view_count: number; // Added view count
// }

export default function MyCollection() {
  // Remove unused supabase variable
  // const supabase = createClient();
  const { session, isLoading: authLoading, setRedirectPath } = useAuth();
  const pathname = usePathname();
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'have' | 'want'>('have');
  const [collectionCounts, setCollectionCounts] = useState<{have: number, want: number}>({have: 0, want: 0});

  // New state for sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(''); // This is what's actually used for filtering

  // -- REMOVE Share related state --
  // // New state for collection stats
  // const [showStats, setShowStats] = useState(false);
  // const [myShares, setMyShares] = useState<MyShare[]>([]);
  // const [loadingShares, setLoadingShares] = useState(false);
  // const [shareError, setShareError] = useState<string | null>(null);
  // const [isSharesExpanded, setIsSharesExpanded] = useState(true); // State for collapsible section
  // const [revokingShareId, setRevokingShareId] = useState<string | null>(null); // State to track revocation

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(searchQuery.trim()); // Apply the filter only when form is submitted
  };

  // Handle clearing the search
  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveFilter('');
  };

  // Fetch collection counts for both 'have' and 'want' types
  const fetchCollectionCounts = useCallback(async () => {
    if (!session) return;

    try {
      // Fetch 'have' collection count
      const haveResponse = await fetch(`/api/collections?type=have&countOnly=true`);
      // Fetch 'want' collection count
      const wantResponse = await fetch(`/api/collections?type=want&countOnly=true`);

      if (haveResponse.ok && wantResponse.ok) {
        const haveData = await haveResponse.json();
        const wantData = await wantResponse.json();

        setCollectionCounts({
          have: haveData.totalCards || 0,
          want: wantData.totalCards || 0
        });
      }
    } catch (err) {
      console.error("Failed to fetch collection counts:", err);
    }
  }, [session]);

  // Fetch collection data
  const fetchCollection = useCallback(async () => {
    if (!session) return;

    setError(null);
    setLoading(true);
    try {
      // console.log('Fetching collection for user:', session.user.id, 'type:', activeType);
      const response = await fetch(`/api/collections?type=${activeType}`);
      if (!response.ok) {
        const errorData = await response.json();
        // Handle specific auth error
        if (response.status === 401) {
          // User might be logged out, session state should update via listener
          setCollection([]);
          console.log('Not authenticated to fetch collection.');
        } else {
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
      } else {
        const data = await response.json();
        // console.log(`Fetched ${data.collection?.length || 0} collection items`);
        const collectionData = data.collection || [];
        setCollection(collectionData); // Ensure it's an array

        // Preload images for better performance
        if (collectionData.length > 0) {
          // Extract image URLs from the collection
          const imageUrls = collectionData.map(item => item.card_image_small);
          // Preload the images in the background
          preloadImages(imageUrls);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to fetch collection:", err);
      // Type check for Error object
      const message = err instanceof Error ? err.message : 'Failed to load collection.';
      setError(message);
      setCollection([]); // Clear collection on error
    } finally {
      setLoading(false);
    }
  }, [session, activeType]);

  // Effect to fetch collection when session changes
  useEffect(() => {
    if (session) {
      // console.log('Session is available, fetching collection');
      fetchCollection();
      fetchCollectionCounts(); // Fetch counts for both collection types
    } else {
      // console.log('No session, clearing collection');
      setCollection([]);
      setCollectionCounts({have: 0, want: 0});
      setLoading(false);
    }
    // Only include session and fetchCollection as dependencies
    // activeType dependency is handled by the explicit calls in the switchType handler
  }, [session, fetchCollection, fetchCollectionCounts]);

  // -- SWITCH TYPE HANDLER ---
  const switchType = (type: 'have' | 'want') => {
    if (type !== activeType) {
      setActiveType(type);
      setCollection([]); // Clear current collection before fetching new one
      setLoading(true); // Set loading state
      // Fetching will be triggered by the change in activeType via fetchCollection call below
      // We call it explicitly here to ensure it runs immediately after state update
      // Note: direct call after setter might not have updated state yet,
      // but useEffect reacting to activeType change is more robust
      // Let's rely on the useEffect for fetching
    }
  };

  // Refetch when activeType changes
  useEffect(() => {
    if (session) {
      fetchCollection();
      fetchCollectionCounts(); // Also refresh counts when switching tabs
    }
  }, [activeType, session, fetchCollection, fetchCollectionCounts]);
  // -- END SWITCH TYPE HANDLER --

  // Function to remove a card
  const handleRemoveCard = async (cardId: string, quantity: number) => {
    // If quantity > 1, ask if they want to remove all or just one
    let decrementOnly = false;
    if (quantity > 1) {
      decrementOnly = !confirm(`This card has ${quantity} copies. Do you want to remove ALL copies? Click OK to remove all, or Cancel to remove just one copy.`);
    } else if (!confirm(`Are you sure you want to remove this card (${cardId})?`)) {
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
      // Refresh collection after successful deletion
      fetchCollection();
      fetchCollectionCounts(); // Update counts after removing a card
    } catch (err: unknown) {
      console.error("Failed to remove card:", err);
      // Type check for Error object
      const message = err instanceof Error ? err.message : 'Unknown error removing card';
      alert(`Error removing card: ${message}`); // Show error to user
    }
  };

  // Collection statistics
  const collectionStats = useMemo(() => {
    const uniqueCards = collection.length;
    const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0);

    // Find recently added cards (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentlyAdded = collection.filter(
      item => new Date(item.added_at) >= oneWeekAgo
    ).length;

    // Calculate highest quantity card
    let highestQuantity = 0;
    let highestQuantityCard: CollectionItem | null = null;

    collection.forEach(item => {
      if (item.quantity > highestQuantity) {
        highestQuantity = item.quantity;
        highestQuantityCard = item;
      }
    });

    // Update the active type count in our collectionCounts state
    if (activeType === 'have' && collectionCounts.have !== totalCards) {
      setCollectionCounts(prev => ({ ...prev, have: totalCards }));
    } else if (activeType === 'want' && collectionCounts.want !== totalCards) {
      setCollectionCounts(prev => ({ ...prev, want: totalCards }));
    }

    return {
      uniqueCards,
      totalCards,
      recentlyAdded,
      highestQuantityCard,
      highestQuantity
    };
  }, [collection, activeType, collectionCounts]);

  // Apply sorting and filtering to the collection
  const filteredAndSortedCollection = useMemo(() => {
    // First apply search filter
    let result = collection;

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
        default:
          return 0;
      }
    });
  }, [collection, activeFilter, sortBy]);

  // -- REMOVE Share related functions --
  // // Fetch user's created shares
  // const fetchMyShares = useCallback(async () => {
  //   if (!session) return;
  //   setLoadingShares(true);
  //   setShareError(null);
  //   try {
  //     const response = await fetch('/api/collections/my-shares');
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || 'Failed to fetch your shared links');
  //     }
  //     const data = await response.json();
  //     setMyShares(data.shares || []);
  //   } catch (err) {
  //     console.error('Failed to fetch shares:', err);
  //     setShareError(err instanceof Error ? err.message : 'Could not load your shared links.');
  //   } finally {
  //     setLoadingShares(false);
  //   }
  // }, [session]);
  //
  // // Fetch shares when session loads or activeType changes (to potentially refresh after sharing)
  // useEffect(() => {
  //   if (session) {
  //     fetchMyShares();
  //   }
  // }, [session, fetchMyShares, activeType]); // Refetch shares if collection type changes (as share is initiated from there)
  //
  // // Handle revoking a share link
  // const handleRevokeShare = useCallback(async (shareId: string) => {
  //   setRevokingShareId(shareId);
  //   try {
  //     const response = await fetch(`/api/collections/my-shares?share_id=${shareId}`, {
  //       method: 'DELETE',
  //     });
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || 'Failed to revoke share');
  //     }
  //     // Update local state to reflect the change immediately
  //     setMyShares(prevShares => prevShares.map(share =>
  //       share.share_id === shareId ? { ...share, status: 'revoked' } : share
  //     ));
  //     // Optionally, re-fetch shares to ensure sync, but local update is faster UX
  //     // fetchMyShares();
  //   } catch (err) {
  //     console.error('Failed to revoke share:', err);
  //     alert(`Error revoking share: ${err instanceof Error ? err.message : 'Unknown error'}`);
  //   } finally {
  //     setRevokingShareId(null);
  //   }
  // }, []); // Removed fetchMyShares dependency for local update approach
  //
  // // Function to handle sharing the current collection view
  // const handleShareCollection = async (expiresIn: ExpirationValue) => {
  //   if (!session) {
  //     alert('You must be logged in to share.');
  //     return;
  //   }
  //   if (collection.length === 0) {
  //     alert('Cannot share an empty collection.');
  //     return;
  //   }
  //
  //   const sharePayload = {
  //     collection_type: activeType,
  //     group_name: 'Default', // Assuming 'Default' group for now
  //     collection_name: activeType === 'have' ? 'My Collection' : 'My Wishlist',
  //     items: collection.map(item => ({ // Map only necessary data
  //       card_id: item.card_id,
  //       card_name: item.card_name,
  //       card_image_small: item.card_image_small,
  //       quantity: item.quantity
  //     })),
  //     expires_in: expiresIn
  //   };
  //
  //   try {
  //     const response = await fetch('/api/collections/share', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(sharePayload),
  //     });
  //
  //     const result = await response.json();
  //
  //     if (!response.ok) {
  //       throw new Error(result.error || 'Failed to create share link.');
  //     }
  //
  //     alert(`Share link created successfully!\nURL: ${result.shareUrl}\nExpires: ${expiresIn === 'never' ? 'Never' : new Date(result.expiresAt).toLocaleString()}`);
  //     fetchMyShares(); // Refresh the list of shares after creating a new one
  //   } catch (error) {
  //     console.error('Failed to share collection:', error);
  //     alert(`Error creating share link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   }
  // };

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
      {/* Header Section (Stats, Import/Export) */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-2 md:mb-0">Collection Overview</h2>
          {/* Import/Export Component */}
          <CollectionImportExport
            collection={collection}
            collectionType={activeType}
            groupName={'Default'} // Assuming 'Default' for now
            availableGroups={['Default']} // Assuming 'Default' for now
            onImportComplete={fetchCollection}
          />
          {/* --- REMOVE SHARE BUTTON --- */}
          {/* <button
            onClick={() => handleShareCollection('7d')} // Example: Default to 7 days
            className="mt-2 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150"
          >
            Share This Collection
          </button> */}
        </div>
        {/* Collection Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Unique Cards</p>
            <p className="text-lg font-bold text-gray-800">{collectionStats.uniqueCards}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Total Cards</p>
            <p className="text-lg font-bold text-gray-800">{collectionStats.totalCards}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded col-span-2 md:col-span-1">
            <p className="text-sm text-gray-600">Highest Quantity</p>
            <p className="text-lg font-bold text-gray-800 truncate" title={(collectionStats.highestQuantityCard as CollectionItem | null)?.card_name || 'N/A'}>
              {collectionStats.highestQuantity > 0
                ? `${collectionStats.highestQuantity}x ${(collectionStats.highestQuantityCard as CollectionItem | null)?.card_name || 'Card'}`
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
            onClick={() => switchType('have')}
            className={`px-4 py-2 text-sm font-medium ${activeType === 'have' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            I Have ({collectionCounts.have})
          </button>
          <button
            onClick={() => switchType('want')}
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
          <div>
            <label htmlFor="sort" className="sr-only">Sort by</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="newest">Sort: Newest Added</option>
              <option value="oldest">Sort: Oldest Added</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="quantity">Sort: Quantity (High-Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      {loading ? (
        <div className="text-center py-10">Loading collection...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-600">Error: {error}</div>
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
              <Link href={`/card/${item.card_id}`} className="block w-full mb-2">
                <Image
                  src={item.card_image_small || '/placeholder-card.png'} // Fallback image
                  alt={item.card_name || 'Card image'}
                  width={120}
                  height={168}
                  className="mx-auto object-contain transition-transform duration-200 group-hover:scale-105"
                  priority={filteredAndSortedCollection.indexOf(item) < 12} // Prioritize loading first few images
                  loading={filteredAndSortedCollection.indexOf(item) < 24 ? "eager" : "lazy"}
                  sizes="(max-width: 640px) 120px, 120px"
                  quality={85}
                />
              </Link>
              <p className="text-xs font-semibold text-gray-800 mb-1 h-8 overflow-hidden" title={item.card_name || item.card_id}>
                {item.card_name || item.card_id}
              </p>
              <p className="text-xs text-gray-500 mb-2">Qty: {item.quantity}</p>
              <button
                onClick={() => handleRemoveCard(item.id, item.quantity)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-red-700"
                aria-label="Remove card"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- REMOVE SHARES SECTION --- */}
      {/* My Shares Section */}
      {/* {session && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3
            className="text-lg font-semibold text-gray-700 mb-3 cursor-pointer flex justify-between items-center"
            onClick={() => setIsSharesExpanded(!isSharesExpanded)}
          >
            My Active Share Links
            <span>{isSharesExpanded ? '▲' : '▼'}</span>
          </h3>
          {isSharesExpanded && (
            loadingShares ? (
              <p className="text-gray-500">Loading your shares...</p>
            ) : shareError ? (
              <p className="text-red-500">Error: {shareError}</p>
            ) : myShares.filter(s => s.status === 'active').length === 0 ? (
              <p className="text-gray-500">You have no active share links.</p>
            ) : (
              <ul className="space-y-2">
                {myShares.filter(s => s.status === 'active').map((share) => (
                  <li key={share.share_id} className="text-sm border-b border-gray-100 pb-2 last:border-b-0 flex justify-between items-center">
                    <div>
                      <Link href={share.shareUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                        {share.collection_name} ({share.collection_type})
                      </Link>
                      <p className="text-gray-500 text-xs">
                        Created: {new Date(share.created_at).toLocaleDateString()} |
                        Expires: {share.expires_at ? new Date(share.expires_at).toLocaleDateString() : 'Never'} |
                        Views: {share.view_count}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeShare(share.share_id)}
                      disabled={revokingShareId === share.share_id}
                      className={`ml-4 px-2 py-1 text-xs rounded ${revokingShareId === share.share_id ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'} text-white transition`}
                    >
                      {revokingShareId === share.share_id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )} */}
    </div>
  );
}
