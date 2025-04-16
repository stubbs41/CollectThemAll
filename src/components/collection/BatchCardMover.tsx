'use client';

import React, { useState, useEffect } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { CollectionItem } from '@/services/CollectionService';
import CollectionSelector from '../card/CollectionSelector';
import { PlusIcon, ArrowRightIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

interface BatchCardMoverProps {
  onClose: () => void;
  onComplete: () => void;
}

const BatchCardMover: React.FC<BatchCardMoverProps> = ({ onClose, onComplete }) => {
  const {
    collections,
    activeGroup,
    addCardToCollection,
    refreshCollections
  } = useCollections();

  const [sourceGroup, setSourceGroup] = useState<string>(activeGroup);
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [sourceType, setSourceType] = useState<'have' | 'want'>('have');
  const [targetType, setTargetType] = useState<'have' | 'want'>('have');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<'move' | 'copy'>('copy'); // Default to copy

  // Get the source collection based on selected group and type
  const sourceCollection = collections.find(
    c => c.groupName === sourceGroup && c.type === sourceType
  );

  // Reset selected cards when source changes
  useEffect(() => {
    setSelectedCards([]);
  }, [sourceGroup, sourceType]);

  // Initialize target group if empty
  useEffect(() => {
    if (!targetGroup && collections.length > 0) {
      // Set a different group than source if possible
      const otherGroups = collections
        .map(c => c.groupName)
        .filter(g => g !== sourceGroup);

      if (otherGroups.length > 0) {
        setTargetGroup(otherGroups[0]);
      } else {
        setTargetGroup(sourceGroup);
      }
    }
  }, [collections, sourceGroup, targetGroup]);

  const handleCardSelect = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleSelectAll = () => {
    if (!sourceCollection) return;

    if (selectedCards.length === sourceCollection.cards.size) {
      // Deselect all
      setSelectedCards([]);
    } else {
      // Select all
      setSelectedCards(Array.from(sourceCollection.cards.keys()));
    }
  };

  const handleMoveCards = async () => {
    if (selectedCards.length === 0) {
      setError(`Please select at least one card to ${operationType}`);
      return;
    }

    if (!targetGroup) {
      setError('Please select a target collection');
      return;
    }

    setIsMoving(true);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each selected card
      for (const cardId of selectedCards) {
        const cardItem = sourceCollection?.cards.get(cardId);
        if (!cardItem) continue;

        try {
          // Add to target collection
          const result = await addCardToCollection(
            cardId,
            cardItem.card,
            targetType,
            targetGroup
          );

          if (result.status === 'added' || result.status === 'updated') {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Error ${operationType === 'move' ? 'moving' : 'copying'} card:`, err);
          errorCount++;
        }
      }

      // Refresh collections to update UI
      await refreshCollections();

      // Show success/error message
      if (successCount > 0) {
        setSuccess(`Successfully ${operationType === 'move' ? 'moved' : 'copied'} ${successCount} card(s) to ${targetGroup}`);
        if (errorCount > 0) {
          setError(`Failed to ${operationType === 'move' ? 'move' : 'copy'} ${errorCount} card(s)`);
        }
      } else {
        setError(`Failed to ${operationType === 'move' ? 'move' : 'copy'} any cards`);
      }

      // Call onComplete callback
      if (successCount > 0) {
        onComplete();
      }
    } catch (err) {
      console.error(`Error in batch ${operationType} operation:`, err);
      setError('An unexpected error occurred');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{operationType === 'move' ? 'Move' : 'Copy'} Cards Between Collections</h2>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Operation:</span>
            <div className="flex rounded-md overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setOperationType('copy')}
                className={`px-3 py-1 text-sm ${operationType === 'copy' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setOperationType('move')}
                className={`px-3 py-1 text-sm ${operationType === 'move' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Move
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Source Collection */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2">Source Collection</h3>

            <div className="mb-3">
              <CollectionSelector
                onSelect={setSourceGroup}
                selectedGroup={sourceGroup}
                label="From Group"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collection Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSourceType('have')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
                    sourceType === 'have'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  I Have
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('want')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
                    sourceType === 'want'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  I Want
                </button>
              </div>
            </div>
          </div>

          {/* Target Collection */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2">Target Collection</h3>

            <div className="mb-3">
              <CollectionSelector
                onSelect={setTargetGroup}
                selectedGroup={targetGroup}
                label="To Group"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collection Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('have')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
                    targetType === 'have'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  I Have
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('want')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded ${
                    targetType === 'want'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  I Want
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card Selection */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Select Cards to Move</h3>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedCards.length === (sourceCollection?.cards.size || 0)
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>

          {sourceCollection && sourceCollection.cards.size > 0 ? (
            <div className="border border-gray-200 rounded-lg p-2 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Array.from(sourceCollection.cards.entries()).map(([cardId, item]) => (
                  <div
                    key={cardId}
                    onClick={() => handleCardSelect(cardId)}
                    className={`border rounded p-2 cursor-pointer text-sm ${
                      selectedCards.includes(cardId)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedCards.includes(cardId)}
                        onChange={() => handleCardSelect(cardId)}
                        className="h-4 w-4 text-blue-600"
                        aria-label={`Select ${item.card.name}`}
                        title={`Select ${item.card.name}`}
                      />
                      <span className="truncate">{item.card.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Qty: {item.quantity} • {item.card.set?.name || 'Unknown Set'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 text-center text-gray-500">
              No cards found in this collection
            </div>
          )}

          <div className="mt-2 text-sm text-gray-600">
            {selectedCards.length} of {sourceCollection?.cards.size || 0} cards selected
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleMoveCards}
            disabled={isMoving || selectedCards.length === 0}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isMoving ? (
              `${operationType === 'move' ? 'Moving' : 'Copying'}...`
            ) : (
              <>
                {operationType === 'move' ? (
                  <ArrowRightIcon className="h-4 w-4" />
                ) : (
                  <DocumentDuplicateIcon className="h-4 w-4" />
                )}
                {operationType === 'move' ? 'Move' : 'Copy'} {selectedCards.length} Card{selectedCards.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-600 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchCardMover;
