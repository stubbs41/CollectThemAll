'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CardBinder from '@/components/CardBinder';
import { PokemonCard } from '@/lib/types';
import { CollectionType } from '@/services/CollectionService';
import { useAuth } from '@/context/AuthContext';
import { useCollections } from '@/context/CollectionContext';
import CommentsSection from '@/components/collection/CommentsSection';
import AnalyticsDashboard from '@/components/collection/AnalyticsDashboard';
import { enableRealtimeForComments } from '@/lib/realtimeClient';
import CollectionSelector from '@/components/card/CollectionSelector';

interface SharedCollectionItem {
  card_id: string;
  card_name: string | null;
  card_image_small: string | null;
  quantity: number;
}

interface SharedCollectionData {
  items: SharedCollectionItem[];
  // Potentially add expires_in here if needed from the original POST data
  // expires_in?: string;
}

interface SharedCollection {
  share_id: string;
  collection_name: string;
  group_name: string;
  collection_type: CollectionType;
  created_at: string;
  expires_at: string | null;
  data: SharedCollectionData; // Use the refined interface
  status: string; // Added from my-shares route, ensure it's included if needed
  view_count: number; // Added from my-shares route, ensure it's included if needed
  expires_in: string; // Added from my-shares route
  shareUrl: string; // Added from my-shares route
  is_collaborative?: boolean; // Whether the share allows collaborative editing
  password_protected?: boolean; // Whether the share is password protected
  sharing_level?: 'read' | 'write'; // Permission level for the share
  allow_comments?: boolean; // Whether comments are allowed
  user_id?: string; // ID of the user who created the share
}

export default function SharedCollectionPage() {
  const params = useParams();
  const shareId = params.id as string;
  const { session } = useAuth();
  const { groups, importCollection } = useCollections();

  const [collection, setCollection] = useState<SharedCollection | null>(null);
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showComments, setShowComments] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('Default');
  const [selectedCollectionType, setSelectedCollectionType] = useState<CollectionType>('have');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const CARDS_PER_PAGE = 32;

  // Fetch the basic share metadata first
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    async function fetchSharedCollectionMeta() {
      if (!shareId) {
         setLoading(false); // No ID, stop loading
         return;
      }
      setLoading(true); // Start loading when fetching metadata
      setError(null);
      try {
        const response = await fetch(`/api/collections/share?id=${shareId}`);
        if (!isMounted) return; // Check if component is still mounted

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load shared collection metadata');
        }

        const data = await response.json();
        if (!data.share || !data.share.data || !Array.isArray(data.share.data.items)) {
            throw new Error('Received invalid share data structure from API.');
        }

        setCollection(data.share);

        // Set the default collection name to the sender's collection name
        setSelectedGroup(data.share.collection_name || 'Default');

        // Check if current user is the owner
        if (session && session.user && data.share.user_id === session.user.id) {
          setIsOwner(true);
          // Show analytics automatically for owners
          setShowAnalytics(true);
        }

        // If collection is empty, we can stop loading now
        if (data.share.data.items.length === 0) {
             setLoading(false);
        }
        // Otherwise, loading remains true until card details are fetched

        // Track view for analytics
        try {
          await fetch('/api/collections/analytics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shareId,
              eventType: 'view'
            }),
          });
        } catch (analyticsError) {
          console.error('Error tracking view:', analyticsError);
          // Don't fail the main request if analytics fails
        }

        // Set up realtime for comments if allowed
        if (data.share.allow_comments) {
          enableRealtimeForComments(shareId);
        }

      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching shared collection metadata:', err);
        setError((err as Error).message || 'Failed to load shared collection');
        setCollection(null);
        setLoading(false); // Set loading false on error
      }
      // Removed finally block here, loading is handled by second effect or empty case
    }

    fetchSharedCollectionMeta();

    return () => { isMounted = false; }; // Cleanup function

  }, [shareId, session]); // Dependencies on shareId and session

  // Fetch card details *after* collection metadata is loaded
  useEffect(() => {
    let isMounted = true; // Flag for cleanup
    async function fetchCardDetailsForShare() {
      // Only run if collection metadata is loaded and has items
      if (!collection?.data?.items || collection.data.items.length === 0) {
        // If collection *is* loaded but empty, loading should have been set false by the first effect
        return;
      }

      const collectionItems = collection.data.items;
      // No need to set loading true here, should still be true from first effect
      setError(null);

      try {
        const cardIds = collectionItems.map(item => item.card_id);
        const batchSize = 50;
        let allCards: PokemonCard[] = [];

        for (let i = 0; i < cardIds.length; i += batchSize) {
          const batchIds = cardIds.slice(i, i + batchSize);
          const idsParam = batchIds.join(',');

          // Use the new /api/cards endpoint
          const response = await fetch(`/api/cards?ids=${idsParam}`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch card details batch');
          }

          const data = await response.json();
          if (!data.cards) {
              throw new Error('Invalid card details response from API.');
          }

          // Merge quantity information from collection with card details
          const cardsWithQuantity = data.cards.map((card: PokemonCard) => {
            const collectionItem = collectionItems.find(item => item.card_id === card.id);
            return {
              ...card,
              quantity: collectionItem?.quantity || 0
            };
          });

          allCards = [...allCards, ...cardsWithQuantity];
        }

        allCards.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (!isMounted) return;
        setCards(allCards);
        setTotalPages(Math.ceil(allCards.length / CARDS_PER_PAGE));

      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching card details:', err);
        setError('Failed to load card details');
        setCards([]);
      } finally {
        // Always set loading false after attempting to fetch details (success or error)
        if (isMounted) {
            setLoading(false);
        }
      }
    }

    fetchCardDetailsForShare();

    return () => { isMounted = false; }; // Cleanup function

  }, [collection]); // Dependency is now the collection object itself

  // Get paginated cards
  const getPaginatedCards = () => {
    const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    return cards.slice(startIndex, endIndex);
  };

  // Pagination handlers
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Handle importing this collection
  const handleImportCollection = async () => {
    if (!collection) return;

    setIsImporting(true);
    setImportSuccess(null);
    setImportError(null);

    try {
      // Use the context function to import the collection
      const result = await importCollection(
        collection.data.items.map(item => ({
          card_id: item.card_id,
          card_name: item.card_name,
          card_image_small: item.card_image_small,
          quantity: item.quantity,
          collection_type: selectedCollectionType // Use the user-selected collection type
        })),
        selectedGroup,
        false // Don't create a new group if it doesn't exist
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to import collection');
      }

      const collectionTypeName = selectedCollectionType === 'have' ? 'My Collection' : 'Wishlist';
      setImportSuccess(`Successfully imported cards to your "${selectedGroup}" ${collectionTypeName}!`);

      // Track import event for analytics
      try {
        await fetch('/api/collections/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareId,
            eventType: 'import',
            metadata: {
              targetGroup: selectedGroup,
              collectionType: selectedCollectionType,
              originalCollectionType: collection.collection_type
            }
          }),
        });
      } catch (analyticsError) {
        console.error('Error tracking import:', analyticsError);
        // Don't fail the main request if analytics fails
      }

    } catch (err) {
      console.error('Error importing collection:', err);
      setImportError((err as Error).message || 'Failed to import collection');
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-600">Loading shared collection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Shared Collection</h2>
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
          Return to Home
        </Link>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Collection Not Found</h2>
        <p className="text-red-600">The shared collection you're looking for doesn't exist or has expired.</p>
        <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
          Return to Home
        </Link>
      </div>
    );
  }

  // Format the expiration date
  const expiresAt = new Date(collection.expires_at || '');
  const expiresFormatted = expiresAt.toLocaleDateString();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white shadow-sm p-6 mb-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              &larr; Return to Home
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {collection.collection_name}
          </h1>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {collection.collection_type === 'have' ? 'Have Collection' : 'Want Collection'}
              <span className="mx-2">•</span>
              {cards.length} cards
              <span className="mx-2">•</span>
              Shared on {new Date(collection.created_at).toLocaleDateString()}
              <span className="mx-2">•</span>
              Expires on {expiresFormatted}
            </p>
          </div>

          <div className="mb-6">
            {/* Collection selector and import button */}
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Import to Collection</h3>

              {!session ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-3">Sign in to import this collection to your account</p>
                  <Link
                    href={`/?redirect=${encodeURIComponent(`/shared/${shareId}`)}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow inline-block"
                  >
                    Sign In to Import
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                      <CollectionSelector
                        onSelect={setSelectedGroup}
                        selectedGroup={selectedGroup}
                        label="Select Collection Group"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleImportCollection}
                        disabled={isImporting}
                        className={`w-full px-4 py-2 rounded-lg shadow text-white ${isImporting
                          ? 'bg-gray-400 cursor-wait'
                          : 'bg-green-600 hover:bg-green-700'}`}
                      >
                        {isImporting ? 'Importing...' : 'Import to Collection'}
                      </button>
                    </div>
                  </div>

                  {/* Collection Type Selector */}
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">Import as:</div>
                    <div className="flex space-x-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="collectionType"
                          value="have"
                          checked={selectedCollectionType === 'have'}
                          onChange={() => setSelectedCollectionType('have')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">My Collection</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="collectionType"
                          value="want"
                          checked={selectedCollectionType === 'want'}
                          onChange={() => setSelectedCollectionType('want')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Wishlist</span>
                      </label>
                    </div>
                  </div>

                  {/* Success/Error messages */}
                  {importSuccess && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                      {importSuccess}
                    </div>
                  )}

                  {importError && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      Error: {importError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Other action buttons */}
            <div className="flex flex-wrap gap-2">
              {collection.allow_comments && (
                <button
                  type="button"
                  onClick={() => setShowComments(!showComments)}
                  className={`px-4 py-2 rounded-lg shadow ${showComments ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {showComments ? 'Hide Comments' : 'Show Comments'}
                </button>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className={`px-4 py-2 rounded-lg shadow ${showAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {showAnalytics ? 'Hide Analytics' : 'View Analytics'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard (only for collection owner) */}
      {isOwner && showAnalytics && (
        <div className="max-w-4xl mx-auto mb-6 w-full">
          <AnalyticsDashboard shareId={shareId} />
        </div>
      )}

      {/* Card Display */}
      <div className="mb-6">
        {cards.length === 0 ? (
          <div className="text-center p-10 text-lg text-gray-500">
            This collection doesn't contain any cards.
          </div>
        ) : (
          <CardBinder
            cards={getPaginatedCards()}
            currentPage={currentPage}
            totalPages={totalPages}
            goToNextPage={goToNextPage}
            goToPreviousPage={goToPreviousPage}
            goToPage={goToPage}
            isLoading={false}
          />
        )}
      </div>

      {/* Comments Section */}
      {collection.allow_comments && showComments && (
        <div className="max-w-4xl mx-auto mb-6 w-full">
          <CommentsSection shareId={shareId} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}