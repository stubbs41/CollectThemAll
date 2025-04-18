/**
 * Robust price cache that ensures prices persist across page refreshes
 * This is a client-side only utility that uses localStorage
 */

import { storeCardPrice, getCardPrice } from './pricePersistence';

// In-memory cache for faster access during a single session
let inMemoryPriceCache: Record<string, number> = {};

// Debounce cache to prevent multiple rapid updates
const pendingUpdates = new Map<string, { price: number, timeout: NodeJS.Timeout }>();

// Debounce time in milliseconds
const DEBOUNCE_TIME = 500;

/**
 * Simple function to initialize the cache - no localStorage needed
 */
export function initializeCache(): Promise<void> {
  return Promise.resolve();
}

// Track which cards have already been stored to prevent duplicate logs
// Use a global variable to ensure it persists across module reloads during development
declare global {
  interface Window {
    __storedPriceCards: Set<string>;
    __priceLogDisabled: boolean;
  }
}

// Initialize the global set if it doesn't exist
if (typeof window !== 'undefined') {
  window.__storedPriceCards = window.__storedPriceCards || new Set<string>();
  // Disable price logging completely to avoid console spam
  window.__priceLogDisabled = true;
}

/**
 * Store a card's price in the cache with debouncing
 * @param cardId The card ID
 * @param price The price to store
 */
export function storePrice(cardId: string, price: number | null | undefined): void {
  if (!cardId || price === null || price === undefined || price <= 0) return;

  // Check if we already have a pending update for this card
  const pending = pendingUpdates.get(cardId);
  if (pending) {
    // If the price is the same, do nothing
    if (pending.price === price) return;

    // Clear the existing timeout
    clearTimeout(pending.timeout);
  }

  // Create a new timeout for this update
  const timeout = setTimeout(() => {
    // Store in memory only for the current session
    inMemoryPriceCache[cardId] = price;

    // Also store in the original price cache for maximum compatibility
    storeCardPrice(cardId, price);

    // Remove from pending updates
    pendingUpdates.delete(cardId);

    // Only log once per card per session to prevent console spam
    // But only if logging is not disabled
    if (typeof window !== 'undefined' && !window.__priceLogDisabled && !window.__storedPriceCards.has(cardId)) {
      console.log(`[RobustPriceCache] Stored price ${price} for card ${cardId}`);
      window.__storedPriceCards.add(cardId);
    }
  }, DEBOUNCE_TIME);

  // Store the pending update
  pendingUpdates.set(cardId, { price, timeout });
}

/**
 * Get a card's price from the cache
 * @param cardId The card ID
 * @returns The cached price or undefined if not found
 */
export function getPrice(cardId: string): number | undefined {
  if (!cardId) return undefined;

  return inMemoryPriceCache[cardId];
}

/**
 * Apply cached prices to collection items
 * @param items Collection items to update
 * @returns Updated collection items with cached prices
 */
export function applyPricesToItems<T extends { card_id: string; market_price?: number | null }>(items: T[]): T[] {
  if (!items || items.length === 0) return items;

  return items.map(item => {
    // If the item has a valid price, store it in our cache
    if (item.market_price !== undefined && item.market_price !== null && item.market_price > 0) {
      storePrice(item.card_id, item.market_price);
      return item;
    }

    // If the item doesn't have a valid price, try to get it from our cache
    const cachedPrice = getPrice(item.card_id);
    if (cachedPrice !== undefined) {
      return {
        ...item,
        market_price: cachedPrice
      };
    }

    return item;
  });
}

/**
 * Get the best available price for a card
 * @param cardId The card ID
 * @param currentPrice The current price from the API
 * @returns The best available price (always prefers current price)
 */
export function getBestPrice(cardId: string, currentPrice?: number | null): number {
  // If current price is valid, store it and return it
  if (currentPrice !== undefined && currentPrice !== null && currentPrice > 0) {
    storePrice(cardId, currentPrice);
    return currentPrice;
  }

  // Try to get the price from our cache
  const cachedPrice = getPrice(cardId);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }

  // Default to 0 if no price is available
  return 0;
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  inMemoryPriceCache = {};
}
