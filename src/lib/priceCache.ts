// Global cache for card prices to ensure they persist across component re-renders
// This is a client-side only cache

import { CardPrices } from './types';

// Type for the price cache entry
interface PriceCacheEntry {
  prices: CardPrices;
  timestamp: number;
}

// The actual cache object
const globalPriceCache = new Map<string, PriceCacheEntry>();

// Cache duration (10 minutes in milliseconds)
const CACHE_DURATION = 10 * 60 * 1000;

/**
 * Get price data from the cache
 */
export function getCachedPrice(cardId: string): CardPrices | undefined {
  const entry = globalPriceCache.get(cardId);
  
  // Return undefined if no entry or entry is expired
  if (!entry || Date.now() - entry.timestamp > CACHE_DURATION) {
    return undefined;
  }
  
  return entry.prices;
}

/**
 * Store price data in the cache
 */
export function setCachedPrice(cardId: string, prices: CardPrices): void {
  if (!prices || Object.keys(prices).length === 0) {
    return; // Don't cache empty price data
  }
  
  globalPriceCache.set(cardId, {
    prices,
    timestamp: Date.now()
  });
}

/**
 * Apply cached prices to a card if needed
 */
export function applyPriceToCard<T extends { id: string; tcgplayer?: { prices?: CardPrices } }>(
  card: T
): T {
  if (!card || !card.id) {
    return card;
  }
  
  // Check if the card already has valid price data
  if (card.tcgplayer?.prices && Object.keys(card.tcgplayer.prices).length > 0) {
    // Card has price data, update the cache
    setCachedPrice(card.id, card.tcgplayer.prices);
    return card;
  }
  
  // Card doesn't have price data, try to get it from cache
  const cachedPrices = getCachedPrice(card.id);
  if (cachedPrices) {
    // Apply cached prices to the card
    return {
      ...card,
      tcgplayer: {
        ...card.tcgplayer,
        prices: cachedPrices
      }
    };
  }
  
  // No cached prices available
  return card;
}

/**
 * Apply cached prices to an array of cards
 */
export function applyPricesToCards<T extends { id: string; tcgplayer?: { prices?: CardPrices } }>(
  cards: T[]
): T[] {
  if (!cards || cards.length === 0) {
    return cards;
  }
  
  return cards.map(card => applyPriceToCard(card));
}
