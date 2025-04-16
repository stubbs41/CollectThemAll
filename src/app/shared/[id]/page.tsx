'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CardBinder from '@/components/CardBinder';
import { PokemonCard } from '@/lib/types';
import { CollectionType } from '@/services/CollectionService';
import { useAuth } from '@/context/AuthContext';
import CommentsSection from '@/components/collection/CommentsSection';
import AnalyticsDashboard from '@/components/collection/AnalyticsDashboard';
import { enableRealtimeForComments } from '@/lib/realtimeClient';

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

  const [collection, setCollection] = useState<SharedCollection | null>(null);
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showComments, setShowComments] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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

    try {
      const response = await fetch('/api/collections/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          collection_type: collection.collection_type,
          group_name: collection.collection_name,
          items: collection.data.items
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import collection');
      }

      const data = await response.json();
      alert(`Successfully imported ${data.importedCount} cards to your collection!`);

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
              importedCount: data.importedCount,
              collectionType: collection.collection_type
            }
          }),
        });
      } catch (analyticsError) {
        console.error('Error tracking import:', analyticsError);
        // Don't fail the main request if analytics fails
      }

    } catch (err) {
      console.error('Error importing collection:', err);
      alert(`Failed to import collection: ${(err as Error).message}`);
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

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleImportCollection}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow"
            >
              Import to My Collection
            </button>

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