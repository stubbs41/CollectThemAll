/**
 * Direct API client for Pokemon TCG API
 * This is a replacement for the pokemon-tcg-sdk-typescript package
 * which has been causing issues in the application.
 */

import { PokemonCard, CardPrices } from '@/lib/types';
import { getWithExpiry, setWithExpiry, CACHE_TIMES, CACHE_KEYS, createCacheKey } from '@/lib/cacheUtils';

// Base URL for the Pokemon TCG API
const API_BASE_URL = 'https://api.pokemontcg.io/v2';

// API key from environment variables
const API_KEY = process.env.POKEMON_TCG_API_KEY;

// Helper function to create headers with API key
function getHeaders() {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['X-Api-Key'] = API_KEY;
  } else {
    console.warn('Pokemon TCG API Key not found. API rate limits may apply.');
  }

  return headers;
}

// Helper function to handle API errors
async function handleResponse(response: Response) {
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Get a card by ID
export async function getCardById(cardId: string) {
  try {
    // Check cache first
    const cacheKey = createCacheKey(CACHE_KEYS.CARD_DETAILS, { id: cardId });
    const cachedCard = getWithExpiry<any>(cacheKey);

    if (cachedCard) {
      return cachedCard;
    }

    // Fetch from API if not in cache
    const response = await fetch(`${API_BASE_URL}/cards/${cardId}`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(response);
    const card = data?.data || null;

    // Cache the result
    if (card) {
      setWithExpiry(cacheKey, card, CACHE_TIMES.MEDIUM);
    }

    return card;
  } catch (error) {
    console.error(`Error fetching card ${cardId}:`, error);
    return null;
  }
}

// Search for cards with a query
export async function searchCards(query: string, page = 1, pageSize = 20, orderBy?: string) {
  try {
    // Check cache first (only for first page and standard page sizes)
    const shouldCache = page === 1 && (pageSize === 20 || pageSize === 50 || pageSize === 100);
    const cacheKey = createCacheKey(CACHE_KEYS.SEARCH_RESULTS, { query, page, pageSize, orderBy });

    if (shouldCache) {
      const cachedResults = getWithExpiry<{ cards: any[]; totalCount: number }>(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }
    }

    // Fetch from API if not in cache
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (orderBy) {
      params.append('orderBy', orderBy);
    }

    const response = await fetch(`${API_BASE_URL}/cards?${params}`, {
      headers: getHeaders(),
    });

    const data = await handleResponse(response);

    if (!data) return { cards: [], totalCount: 0 };

    const results = {
      cards: data.data || [],
      totalCount: data.totalCount || 0,
    };

    // Cache the results
    if (shouldCache) {
      setWithExpiry(cacheKey, results, CACHE_TIMES.SHORT);
    }

    return results;
  } catch (error) {
    console.error(`Error searching cards with query "${query}":`, error);
    return { cards: [], totalCount: 0 };
  }
}

// Get cards from a specific set
export async function getCardsBySet(setId: string, page = 1, pageSize = 100) {
  try {
    const query = `set.id:${setId}`;
    const { cards } = await searchCards(query, page, pageSize);
    return cards;
  } catch (error) {
    console.error(`Error fetching cards for set ${setId}:`, error);
    return [];
  }
}

// Get cards by name (for prints)
export async function getCardsByName(name: string, page = 1, pageSize = 100) {
  try {
    const query = `name:"${name}"`;
    const { cards } = await searchCards(query, page, pageSize, '-set.releaseDate');
    return cards;
  } catch (error) {
    console.error(`Error fetching cards with name ${name}:`, error);
    return [];
  }
}

// Extract prices from a card
export function extractPrices(card: any): CardPrices | undefined {
  if (!card?.tcgplayer?.prices) return undefined;
  return card.tcgplayer.prices;
}

// Map an API card to our PokemonCard type
export function mapApiCardToPokemonCard(apiCard: any): PokemonCard {
  if (!apiCard) throw new Error('Cannot map null or undefined card');

  return {
    id: apiCard.id,
    name: apiCard.name || 'Unknown Card',
    images: {
      small: apiCard.images?.small || '',
      large: apiCard.images?.large || ''
    },
    set: {
      id: apiCard.set?.id || '',
      name: apiCard.set?.name || 'Unknown Set',
      series: apiCard.set?.series || '',
      images: {
        logo: apiCard.set?.images?.logo,
        symbol: apiCard.set?.images?.symbol
      }
    },
    number: apiCard.number || '',
    rarity: apiCard.rarity,
    types: apiCard.types,
    supertype: apiCard.supertype,
    tcgplayer: apiCard.tcgplayer ? {
      url: apiCard.tcgplayer.url,
      updatedAt: apiCard.tcgplayer.updatedAt,
      prices: extractPrices(apiCard),
    } : undefined,
  };
}

// Find cards by IDs
export async function findCardsByIds(cardIds: string[]) {
  try {
    if (!cardIds || cardIds.length === 0) {
      return [];
    }

    // Check cache first
    const cacheKey = createCacheKey(CACHE_KEYS.CARD_DETAILS, { ids: cardIds.join(',') });
    const cachedCards = getWithExpiry<any[]>(cacheKey);

    if (cachedCards) {
      return cachedCards;
    }

    // Build the query string for multiple IDs
    const idQuery = cardIds.map(id => `id:${id}`).join(' OR ');

    // Set a higher page size to ensure we get all cards (max 250 per API call)
    const pageSize = Math.min(250, cardIds.length);
    let apiCards: any[] = [];

    // If we have more than 250 cards, we need to make multiple API calls
    if (cardIds.length > 250) {
      // Split the card IDs into chunks of 250
      const chunks = [];
      for (let i = 0; i < cardIds.length; i += 250) {
        chunks.push(cardIds.slice(i, i + 250));
      }

      // Make API calls for each chunk
      for (const chunk of chunks) {
        const chunkQuery = chunk.map(id => `id:${id}`).join(' OR ');
        const { cards } = await searchCards(chunkQuery, 1, chunk.length);
        apiCards = [...apiCards, ...cards];
      }
    } else {
      // Single API call for smaller collections
      const { cards } = await searchCards(idQuery, 1, pageSize);
      apiCards = cards;
    }

    // Cache the results
    if (apiCards.length > 0) {
      setWithExpiry(cacheKey, apiCards, CACHE_TIMES.MEDIUM);
    }

    return apiCards;
  } catch (error) {
    console.error('Error fetching cards by IDs:', error);
    return [];
  }
}
