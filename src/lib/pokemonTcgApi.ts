/**
 * Direct API client for Pokemon TCG API
 * This is a replacement for the pokemon-tcg-sdk-typescript package
 * which has been causing issues in the application.
 */

import { PokemonCard, CardPrices } from '@/lib/types';

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
    const response = await fetch(`${API_BASE_URL}/cards/${cardId}`, {
      headers: getHeaders(),
    });
    
    const data = await handleResponse(response);
    return data?.data || null;
  } catch (error) {
    console.error(`Error fetching card ${cardId}:`, error);
    return null;
  }
}

// Search for cards with a query
export async function searchCards(query: string, page = 1, pageSize = 20, orderBy?: string) {
  try {
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
    
    return {
      cards: data.data || [],
      totalCount: data.totalCount || 0,
    };
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
