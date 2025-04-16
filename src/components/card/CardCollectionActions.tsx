import React, { useState, useEffect } from 'react';
import { PokemonCard } from '@/lib/types';
import { useCollections } from '@/context/CollectionContext';
import { useAuth } from '@/context/AuthContext';
import { CollectionType } from '@/services/CollectionService';

interface CardCollectionActionsProps {
  card: PokemonCard | null;
  onClose?: () => void;
}

const CardCollectionActions: React.FC<CardCollectionActionsProps> = ({
  card,
  onClose
}) => {
  const { session } = useAuth();
  const {
    addCardToCollection,
    removeCardFromCollection,
    isCardInCollection,
    getCardQuantity,
    isLoading,
    refreshCollections
  } = useCollections();

  const [isAddingToCollection, setIsAddingToCollection] = useState(false);
  const [isRemovingFromCollection, setIsRemovingFromCollection] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Local state to track button state changes during this session
  const [haveAdded, setHaveAdded] = useState(false);
  const [haveRemoved, setHaveRemoved] = useState(false);
  const [wantAdded, setWantAdded] = useState(false);
  const [wantRemoved, setWantRemoved] = useState(false);

  // Track the card ID to reset state when it changes
  const [currentCardId, setCurrentCardId] = useState<string | null>(null);

  // Reset local state when card ID changes
  useEffect(() => {
    if (card?.id !== currentCardId) {
      console.log(`Card ID changed from ${currentCardId} to ${card?.id}`);

      // Reset the local added states
      setHaveAdded(false);
      setHaveRemoved(false);
      setWantAdded(false);
      setWantRemoved(false);
      setAddSuccess(false);
      setRemoveSuccess(false);
      setActionError(null);

      // Update current card ID
      setCurrentCardId(card?.id || null);

      // Force a refresh of collections to ensure we have the latest data
      refreshCollections();
    }
  }, [card?.id, currentCardId, refreshCollections]);

  const handleAddToCollection = async (collectionType: CollectionType) => {
    if (!card || isAddingToCollection || isRemovingFromCollection || isLoading) return;

    setIsAddingToCollection(true);
    setActionError(null);
    setAddSuccess(false);
    setRemoveSuccess(false); // Clear other messages

    try {
      // Call the updated context function
      const result = await addCardToCollection(card.id, card, collectionType);

      // Handle different statuses
      if (result.status === 'added' || result.status === 'updated') {
        setAddSuccess(true);
        setActionError(null); // Clear any previous error

        if (collectionType === 'have') {
          setHaveAdded(true);
          setHaveRemoved(false);
        } else {
          setWantAdded(true);
          setWantRemoved(false);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setAddSuccess(false), 3000);
      } else if (result.status === 'error') {
        // Handle specific errors returned by the context/service
        setActionError(result.message || 'Failed to add card. Please try again.');
      }

    } catch (error) {
      // This catch block might be redundant if the context catches all errors,
      // but keep it for safety.
      console.error(`Error adding card to ${collectionType} collection (component level):`, error);
      setActionError('An unexpected error occurred. Please try again.');
    } finally {
      setIsAddingToCollection(false);
    }
  };

  const handleRemoveFromCollection = async (collectionType: CollectionType) => {
    if (!card || isAddingToCollection || isRemovingFromCollection || isLoading) return;

    // Check if the card is in this collection and has a quantity > 0
    const quantity = getCardQuantity(card.id, collectionType);
    // Allow removal even if local state thinks quantity is 0, rely on backend/service check
    // if (quantity <= 0) return;

    setIsRemovingFromCollection(true);
    setActionError(null);
    setRemoveSuccess(false);
    setAddSuccess(false); // Clear other messages

    try {
      const result = await removeCardFromCollection(card.id, collectionType);

      if (result.status === 'decremented' || result.status === 'removed') {
        setRemoveSuccess(true);
        setActionError(null); // Clear previous errors
        const message = result.status === 'decremented'
          ? `Quantity decreased to ${result.newQuantity}`
          : 'Card removed from collection!';

        if (collectionType === 'have') {
          setHaveRemoved(true);
          if (result.status === 'removed') setHaveAdded(false);
        } else {
          setWantRemoved(true);
          if (result.status === 'removed') setWantAdded(false);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setRemoveSuccess(false), 3000);

      } else if (result.status === 'not_found'){
         setActionError('Card not found in this collection.');
      } else if (result.status === 'error') {
        setActionError(result.message || 'Failed to remove card. Please try again.');
      }
    } catch (error) {
      console.error(`Error removing card from ${collectionType} collection (component level):`, error);
      setActionError('An unexpected error occurred. Please try again.');
    } finally {
      setIsRemovingFromCollection(false);
    }
  };

  // Get current collection status for the displayed card
  const isInHaveCollection = card && (isCardInCollection(card.id, 'have') || haveAdded) && !haveRemoved;
  const isInWantCollection = card && (isCardInCollection(card.id, 'want') || wantAdded) && !wantRemoved;

  // Get quantities
  const haveQuantity = card ? getCardQuantity(card.id, 'have') : 0;
  const wantQuantity = card ? getCardQuantity(card.id, 'want') : 0;

  if (!session) {
    return (
      <div className="border-t border-b border-gray-200 py-4">
        <p className="text-amber-600 text-sm mb-2">Sign in to add cards to your collection</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md text-white font-medium bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Close to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="card-collection-actions">
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-md border-2 ${
          isInHaveCollection
            ? 'border-red-500 bg-white text-black'
            : 'border-green-600 bg-white text-green-700'
        }`}>
          <div className="flex items-center justify-center p-4">
            <span className="font-bold text-center">{isInHaveCollection ? 'Collected' : 'I have'}</span>
          </div>
          <div className="flex items-center justify-center border-t border-gray-200 p-2">
            <button
              onClick={() => handleAddToCollection('have')}
              disabled={isAddingToCollection || isRemovingFromCollection || isLoading}
              className="px-3 py-1 bg-green-500 text-white font-bold rounded-l-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              +
            </button>
            <div className="px-3 py-1 bg-gray-100 min-w-[40px] text-center font-medium">
              {haveQuantity}
            </div>
            <button
              onClick={() => handleRemoveFromCollection('have')}
              disabled={isAddingToCollection || isRemovingFromCollection || isLoading || haveQuantity === 0}
              className="px-3 py-1 bg-red-500 text-white font-bold rounded-r-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              -
            </button>
          </div>
        </div>

        <div className={`rounded-md border-2 ${
          isInWantCollection
            ? 'border-red-500 bg-white text-black'
            : 'border-purple-600 bg-white text-purple-700'
        }`}>
          <div className="flex items-center justify-center p-4">
            <span className="font-bold text-center">{isInWantCollection ? 'In-Pursuit' : 'I want'}</span>
          </div>
          <div className="flex items-center justify-center border-t border-gray-200 p-2">
            <button
              onClick={() => handleAddToCollection('want')}
              disabled={isAddingToCollection || isRemovingFromCollection || isLoading}
              className="px-3 py-1 bg-green-500 text-white font-bold rounded-l-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              +
            </button>
            <div className="px-3 py-1 bg-gray-100 min-w-[40px] text-center font-medium">
              {wantQuantity}
            </div>
            <button
              onClick={() => handleRemoveFromCollection('want')}
              disabled={isAddingToCollection || isRemovingFromCollection || isLoading || wantQuantity === 0}
              className="px-3 py-1 bg-red-500 text-white font-bold rounded-r-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              -
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        {addSuccess && (
          <p className="text-sm text-green-600 font-medium">
            Card added to collection!
          </p>
        )}

        {removeSuccess && (
          <p className="text-sm text-amber-600 font-medium">
            Card quantity decreased!
          </p>
        )}

        {actionError && (
          <p className="text-sm text-red-500">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
};

export default CardCollectionActions;