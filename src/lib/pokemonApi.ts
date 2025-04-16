import { PokemonCard, CardPrices } from './types';

// --- Add Filter Type Definition (Keep this if used elsewhere) ---
export interface CardFilters {
  set?: string;
  rarity?: string;
  type?: string;
  supertype?: string;
}

// Base URL for our server-side API routes
const apiBaseUrl = '/api';

// Helper function to map API response (assuming Edge Func returns SDK structure)
// We need a similar type definition for the expected response from the edge function
type ApiCard = any; // Replace 'any' with a proper type if possible, matching SDK's Card

function mapApiCardToPokemonCard(apiCard: ApiCard): PokemonCard {
  // Safely extract prices (might need adjustment based on edge func response)
  const extractPrices = (card: ApiCard): CardPrices | undefined => {
    return card.tcgplayer?.prices as CardPrices | undefined;
  };

  return {
      id: apiCard.id,
      name: apiCard.name,
      images: {
          small: apiCard.images?.small || '',
          large: apiCard.images?.large || ''
      },
      set: {
          id: apiCard.set?.id || '',
          name: apiCard.set?.name || '',
          series: apiCard.set?.series || '',
          images: { // Map set images if available in edge func response
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

// --- fetchAllPokemonCards - Updated to use server-side API route ---
// This function might need complete rethinking or removal if we fetch paged
// Or call the API multiple times if needed.
export async function fetchAllPokemonCards(): Promise<PokemonCard[]> {
  console.warn("fetchAllPokemonCards is likely inefficient. Consider using paged fetching.");

  try {
    // Make request to server-side API route
    const response = await fetch(`${apiBaseUrl}/all-cards`);

    if (!response.ok) {
      throw new Error(`Failed to fetch all cards: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.cards?.length || 0} cards via server API.`);
    return data.cards || [];

  } catch (error) {
    console.error('Error fetching cards via server API in fetchAllPokemonCards:', error);
    return [];
  }
}

// --- fetchCardsPaged - Updated to use server-side API route ---
export async function fetchCardsPaged(
  page: number,
  limit: number,
  // Filters can now potentially include a 'name' for searching
  filters: CardFilters & { name?: string } = {}
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number, isEmptyPage: boolean }> {
  console.log(`Fetching page ${page} with limit ${limit} via server API. Filters:`, filters);

  try {
    // Build query parameters for the API request
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    // Add filters to query parameters
    if (filters.name) params.append('name', filters.name);
    if (filters.supertype) params.append('supertype', filters.supertype);
    if (filters.set) params.append('set', filters.set);
    if (filters.rarity) params.append('rarity', filters.rarity);
    if (filters.type) params.append('type', filters.type);

    // Make request to server-side API route
    const response = await fetch(`${apiBaseUrl}/cards-paged?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch cards page ${page}: ${response.status}`);
    }

    const data = await response.json();

    return {
      cards: data.cards || [],
      totalCount: data.totalCount || 0,
      totalPages: data.totalPages || 1,
      isEmptyPage: data.isEmptyPage || data.cards?.length === 0
    };

  } catch (error) {
    console.error(`Error fetching page ${page} via server API:`, error);
    return {
      cards: [],
      totalCount: 0,
      totalPages: 1,
      isEmptyPage: true
    };
  }
}

// --- fetchCardsBySet - Updated to use server-side API route ---
export async function fetchCardsBySet(setId: string): Promise<PokemonCard[]> {
  console.log(`Fetching cards for set: ${setId} via server API`);

  try {
    // Make request to server-side API route
    const response = await fetch(`${apiBaseUrl}/cards-by-set?setId=${encodeURIComponent(setId)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch cards for set ${setId}: ${response.status}`);
    }

    const data = await response.json();
    return data.cards || [];

  } catch (error) {
    console.error('Error fetching cards by set via server API:', error);
    return [];
  }
}

// --- fetchCardDetails - Updated to use server-side API route ---
export async function fetchCardDetails(cardId: string): Promise<PokemonCard | null> {
  console.log(`Fetching details for card ID: ${cardId} via server API`);

  try {
    // Make request to server-side API route
    const response = await fetch(`${apiBaseUrl}/card-details?cardId=${encodeURIComponent(cardId)}`);

    if (response.status === 404) {
      console.warn(`Card with ID ${cardId} not found.`);
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch card details for ${cardId}: ${response.status}`);
    }

    const data = await response.json();
    // The API now returns { card: PokemonCard } instead of just PokemonCard
    if (data.card) {
      return data.card;
    } else if (data.id) {
      // For backward compatibility, if the API returns the card directly
      return data;
    }
    return null;

  } catch (error) {
    console.error(`Error fetching details for card ${cardId} via server API:`, error);
    return null;
  }
}
