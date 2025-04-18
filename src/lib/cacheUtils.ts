/**
 * Cache utilities for improving performance
 */

// Cache expiration times (in milliseconds)
export const CACHE_TIMES = {
  SHORT: 10 * 60 * 1000, // 10 minutes (updated from 5 minutes per user preference)
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 24 * 60 * 60 * 1000, // 24 hours
};

// Cache keys
export const CACHE_KEYS = {
  COLLECTION: 'collection',
  CARD_DETAILS: 'card_details',
  SEARCH_RESULTS: 'search_results',
  MARKET_PRICES: 'market_prices',
  CARD_PRICING: 'card_pricing',
  COLLECTION_GROUPS: 'collection_groups',
};

/**
 * Get an item from localStorage with expiration check
 */
export function getWithExpiry<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  try {
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();

    // Check if the item is expired
    if (item.expiry && now > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return item.value as T;
  } catch (error) {
    console.error('Error parsing cached item:', error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Set an item in localStorage with expiration
 */
export function setWithExpiry<T>(key: string, value: T, ttl: number): void {
  if (typeof window === 'undefined') return;

  const now = new Date().getTime();
  const item = {
    value,
    expiry: now + ttl,
  };

  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error setting cached item:', error);
    // If localStorage is full, clear some space
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearOldestCacheItems();
      try {
        localStorage.setItem(key, JSON.stringify(item));
      } catch (retryError) {
        console.error('Failed to set item after clearing cache:', retryError);
      }
    }
  }
}

/**
 * Clear all cached items
 */
export function clearCache(): void {
  if (typeof window === 'undefined') return;

  Object.values(CACHE_KEYS).forEach(key => {
    // Clear all items with this prefix
    Object.keys(localStorage)
      .filter(k => k.startsWith(key))
      .forEach(k => localStorage.removeItem(k));
  });
}

/**
 * Clear the oldest cache items to make space
 */
function clearOldestCacheItems(): void {
  if (typeof window === 'undefined') return;

  const cacheItems: { key: string; expiry: number }[] = [];

  // Collect all cache items with their expiry
  Object.keys(localStorage).forEach(key => {
    try {
      const itemStr = localStorage.getItem(key);
      if (itemStr) {
        const item = JSON.parse(itemStr);
        if (item.expiry) {
          cacheItems.push({ key, expiry: item.expiry });
        }
      }
    } catch (error) {
      // If we can't parse it, it's not our cache item
    }
  });

  // Sort by expiry (oldest first)
  cacheItems.sort((a, b) => a.expiry - b.expiry);

  // Remove the oldest 20% of items
  const itemsToRemove = Math.max(1, Math.floor(cacheItems.length * 0.2));
  cacheItems.slice(0, itemsToRemove).forEach(item => {
    localStorage.removeItem(item.key);
  });
}

/**
 * Create a cache key with parameters
 */
export function createCacheKey(baseKey: string, params: Record<string, any>): string {
  const paramString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .sort()
    .join('&');

  return `${baseKey}${paramString ? `:${paramString}` : ''}`;
}

/**
 * Memoize a function with a TTL
 */
export function memoizeWithTTL<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ttl: number,
  keyPrefix: string
): T {
  const cache = new Map<string, { value: any; expiry: number }>();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = `${keyPrefix}:${JSON.stringify(args)}`;
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && now < cached.expiry) {
      return cached.value;
    }

    const result = await fn(...args);
    cache.set(key, { value: result, expiry: now + ttl });

    // Clean up expired items occasionally
    if (Math.random() < 0.1) {
      for (const [k, v] of cache.entries()) {
        if (now >= v.expiry) {
          cache.delete(k);
        }
      }
    }

    return result;
  }) as T;
}
