'use client';

import { useState, useCallback, useEffect } from 'react';
import { CollectionType } from '@/services/CollectionService';

interface CardQuantityControlsProps {
  cardId: string;
  cardName?: string | null;
  cardImageSmall?: string | null;
  initialQuantity: number;
  collectionType: CollectionType;
  groupName: string;
  onQuantityChange?: (newQuantity: number) => void;
}

export default function CardQuantityControls({
  cardId,
  initialQuantity,
  collectionType,
  groupName,
  onQuantityChange
}: CardQuantityControlsProps) {
  // Local state for optimistic UI updates
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  // Update local state when props change
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  // Function to update quantity with API call
  const updateQuantity = useCallback(async (newQuantity: number) => {
    // Don't update if the quantity is the same
    if (newQuantity === quantity) return;

    // Don't allow negative quantities
    if (newQuantity < 0) newQuantity = 0;

    // Throttle updates to prevent rapid API calls
    const now = Date.now();
    if (now - lastUpdateTime < 300) {
      return;
    }

    setLastUpdateTime(now);
    setIsUpdating(true);
    setError(null);

    // Optimistic update
    setQuantity(newQuantity);

    try {
      const response = await fetch('/api/collections/update-quantity', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId,
          collectionType,
          groupName,
          quantity: newQuantity
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Update with the actual quantity from the server
      setQuantity(data.quantity);

      // Notify parent component if callback provided
      if (onQuantityChange) {
        onQuantityChange(data.quantity);
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
      setError(err instanceof Error ? err.message : 'Failed to update quantity');

      // Revert to initial quantity on error
      setQuantity(initialQuantity);
    } finally {
      setIsUpdating(false);
    }
  }, [cardId, collectionType, groupName, quantity, initialQuantity, lastUpdateTime, onQuantityChange]);

  // Handlers for increment, decrement, and remove
  const handleIncrement = useCallback(() => {
    updateQuantity(quantity + 1);
  }, [quantity, updateQuantity]);

  const handleDecrement = useCallback(() => {
    if (quantity > 0) {
      updateQuantity(quantity - 1);
    }
  }, [quantity, updateQuantity]);

  const handleRemove = useCallback(() => {
    if (quantity > 1) {
      if (!confirm(`Are you sure you want to remove all ${quantity} copies of this card?`)) {
        return;
      }
    } else if (quantity === 1) {
      if (!confirm('Are you sure you want to remove this card?')) {
        return;
      }
    }

    updateQuantity(0);
  }, [quantity, updateQuantity]);

  return (
    <div className="flex flex-col items-center">
      {/* Quantity Controls */}
      <div className="flex items-center justify-center w-full">
        <button
          type="button"
          onClick={handleDecrement}
          className="px-2 py-0.5 text-white bg-red-600 hover:bg-red-700 rounded-l text-sm font-bold leading-none disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="Decrease quantity"
          disabled={quantity <= 0 || isUpdating}
        >
          -
        </button>
        <span
          className={`px-3 py-0.5 text-sm font-semibold leading-none min-w-[30px] text-center border-t border-b border-gray-300 ${
            isUpdating ? 'bg-blue-100 text-blue-800' : 'bg-white text-gray-700'
          }`}
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          className="px-2 py-0.5 text-white bg-blue-600 hover:bg-blue-700 rounded-r text-sm font-bold leading-none disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="Increase quantity"
          disabled={isUpdating}
        >
          +
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-600 mt-1 text-center">
          Error: {error}
        </div>
      )}

      {/* Remove Button */}
      <button
        type="button"
        onClick={handleRemove}
        className="mt-2 text-xs text-red-600 hover:text-red-800 disabled:text-red-300 disabled:cursor-not-allowed"
        title="Remove all copies from collection"
        disabled={isUpdating || quantity === 0}
      >
        Remove All
      </button>
    </div>
  );
}
