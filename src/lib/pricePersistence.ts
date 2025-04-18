/**
 * Utility for persisting card price data across component re-renders and page refreshes
 * This is a client-side only utility that uses localStorage for persistence
 */

// Global price cache that persists across component re-renders
const globalPriceCache = new Map<string, number>();

// Load prices from localStorage on initialization (client-side only)
if (typeof window !== 'undefined') {
  try {
    const storedPrices = localStorage.getItem('cardPrices');
    if (storedPrices) {
      const parsedPrices = JSON.parse(storedPrices);
      Object.entries(parsedPrices).forEach(([cardId, price]) => {
        globalPriceCache.set(cardId, price as number);
      });
      console.log(`Loaded ${globalPriceCache.size} card prices from localStorage`);
    }
  } catch (error) {
    console.error('Error loading card prices from localStorage:', error);
  }
}

/**
 * Store a card's price in the global cache and localStorage
 * @param cardId The card ID
 * @param price The price to store
 */
export function storeCardPrice(cardId: string, price: number | undefined | null): void {
  if (!cardId || price === undefined || price === null) return;

  // Only store valid prices (greater than 0)
  if (price > 0) {
    globalPriceCache.set(cardId, price);

    // Save to localStorage (client-side only)
    if (typeof window !== 'undefined') {
      try {
        // Get existing prices
        const storedPrices = localStorage.getItem('cardPrices');
        const prices = storedPrices ? JSON.parse(storedPrices) : {};

        // Update with new price
        prices[cardId] = price;

        // Save back to localStorage
        localStorage.setItem('cardPrices', JSON.stringify(prices));
      } catch (error) {
        console.error('Error saving card price to localStorage:', error);
      }
    }
  }
}

/**
 * Get a card's price from the global cache
 * @param cardId The card ID
 * @returns The cached price or undefined if not found
 */
export function getCardPrice(cardId: string): number | undefined {
  if (!cardId) return undefined;
  return globalPriceCache.get(cardId);
}

/**
 * Get a card's price, falling back to the global cache if the provided price is missing
 * @param cardId The card ID
 * @param currentPrice The current price from the card data
 * @returns The current price if valid, otherwise the cached price, or 0 if neither exists
 */
export function getCardPriceWithFallback(cardId: string, currentPrice: number | undefined | null): number {
  if (currentPrice !== undefined && currentPrice !== null && currentPrice > 0) {
    // Store valid prices in the cache for future use
    storeCardPrice(cardId, currentPrice);
    return currentPrice;
  }

  // Try to get the price from the cache
  const cachedPrice = getCardPrice(cardId);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }

  // Default to 0 if no price is available
  return 0;
}

/**
 * Apply cached prices to a collection of cards
 * @param items The collection items to update
 * @returns The updated collection items with cached prices applied
 */
export function applyPricesToCollection<T extends { card_id: string; market_price?: number | null }>(
  items: T[]
): T[] {
  if (!items || items.length === 0) return items;

  return items.map(item => {
    // Store the current price in the cache if it's valid
    if (item.market_price !== undefined && item.market_price !== null && item.market_price > 0) {
      storeCardPrice(item.card_id, item.market_price);
      return item;
    }

    // Try to get the price from the cache
    const cachedPrice = getCardPrice(item.card_id);
    if (cachedPrice !== undefined) {
      return {
        ...item,
        market_price: cachedPrice
      };
    }

    return item;
  });
}
