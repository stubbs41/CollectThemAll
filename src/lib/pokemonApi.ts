import { PokemonCard, CardPrices } from './types';
// Import the Pokemon TCG SDK
import { findCardsByQueries, Card, findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';

// --- Add Filter Type Definition (Keep this if used elsewhere) ---
interface CardFilters {
  set?: string;
  rarity?: string;
  type?: string;
  supertype?: string;
}

// Get Pokemon TCG API Key from environment variables
const apiKey = process.env.POKEMON_TCG_API_KEY;
if (apiKey) {
  // Configure the SDK with the API key
  import('pokemon-tcg-sdk-typescript').then(PokemonTCG => {
    PokemonTCG.configure({ apiKey });
    console.log('Pokemon TCG SDK configured with API key');
  });
} else {
  console.warn('Pokemon TCG API Key not found. API rate limits may apply.');
}

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

// --- fetchAllPokemonCards - Updated to use SDK directly ---
// This function might need complete rethinking or removal if we fetch paged
// Or call the SDK multiple times if needed.
export async function fetchAllPokemonCards(): Promise<PokemonCard[]> {
  console.warn("fetchAllPokemonCards is likely inefficient. Consider using paged fetching.");
  // For now, let's fetch a large first page as a placeholder
  const limit = 250; // Max page size
  const queryParams = {
    q: 'supertype:Pokemon',
    page: 1,
    pageSize: limit,
    orderBy: 'nationalPokedexNumbers'
  };

  try {
    console.log(`Fetching initial batch via SDK with params:`, queryParams);
    const apiCards = await findCardsByQueries(queryParams);

    console.log(`Fetched ${apiCards.length} cards via SDK.`);
    return apiCards.map(mapApiCardToPokemonCard);

  } catch (error) {
    console.error('Error fetching cards via SDK in fetchAllPokemonCards:', error);
    return [];
  }
}

// --- fetchCardsPaged - Updated to use SDK directly ---
export async function fetchCardsPaged(
  page: number,
  limit: number,
  // Filters can now potentially include a 'name' for searching
  filters: CardFilters & { name?: string } = {}
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number, isEmptyPage: boolean }> {
  console.log(`Fetching page ${page} with limit ${limit} via SDK. Filters:`, filters);

  // Build query parameters for the SDK
  const queryParams: any = {
    page,
    pageSize: limit,
    orderBy: 'nationalPokedexNumbers'
  };

  // Build query string for 'q' param
  const filterParts: string[] = [];

  // Add name search if present
  if (filters.name) {
      filterParts.push(`(name:"*${filters.name}*")`); // Use wildcards
  }

  // Add other filters
  if (filters.supertype) {
      filterParts.push(`(supertype:"${filters.supertype}")`);
  } else if (!filters.name) {
      // Default to Pokemon only if NOT doing a name search (to allow searching non-Pokemon cards)
      filterParts.push(`(supertype:"Pokemon")`);
  }
  if (filters.set) {
    filterParts.push(`(set.name:"${filters.set}")`);
  }
  if (filters.rarity) {
    filterParts.push(`(rarity:"${filters.rarity}")`);
  }
  if (filters.type) {
    filterParts.push(`(types:"${filters.type}")`);
  }

  // Join with AND
  const queryString = filterParts.join(' AND ');
  if (queryString) {
    queryParams.q = queryString;
  }

  console.log("SDK: Using query params:", queryParams);

  try {
    // Use the SDK to fetch cards
    const apiCards = await findCardsByQueries(queryParams);

    // Calculate total pages based on the total count
    // The SDK doesn't provide totalCount directly, so we estimate it
    // This is an approximation - the actual count might be different
    const totalCount = apiCards.totalCount || apiCards.length * 10; // Estimate if not provided
    const totalPages = Math.ceil(totalCount / limit);

    // Check if we got an empty page
    const isEmptyPage = apiCards.length === 0;

    console.log(`Fetched ${apiCards.length} cards (total: ~${totalCount}, pages: ~${totalPages}) via SDK for page ${page}`);
    const cards = apiCards.map(mapApiCardToPokemonCard);

    return {
      cards,
      totalCount,
      totalPages,
      isEmptyPage
    };

  } catch (error) {
    console.error(`Error fetching page ${page} via SDK:`, error);
    return {
      cards: [],
      totalCount: 0,
      totalPages: 1,
      isEmptyPage: true
    };
  }
}

// --- fetchCardsBySet - Updated to use SDK directly ---
export async function fetchCardsBySet(setId: string): Promise<PokemonCard[]> {
  console.log(`Fetching cards for set: ${setId} via SDK`);

  const queryParams = {
      q: `set.id:${setId}`,
      pageSize: 250, // Fetch up to 250 cards
      orderBy: 'number',
  };

  try {
    // Use the SDK to fetch cards by set
    const apiCards = await findCardsByQueries(queryParams);

    console.log(`Fetched ${apiCards.length} cards for set ${setId} via SDK`);
    return apiCards.map(mapApiCardToPokemonCard);

  } catch (error) {
    console.error('Error fetching cards by set via SDK:', error);
    return [];
  }
}

// --- fetchCardDetails - Updated to use SDK directly ---
export async function fetchCardDetails(cardId: string): Promise<PokemonCard | null> {
  console.log(`Fetching details for card ID: ${cardId} via SDK`);

  try {
    // Use the SDK to fetch card details
    const apiCard = await findCardByID(cardId);

    if (!apiCard) {
      console.warn(`Card with ID ${cardId} not found by SDK.`);
      return null;
    }

    return mapApiCardToPokemonCard(apiCard);

  } catch (error) {
    // Handle 404 errors gracefully
    if (error instanceof Error && error.message.includes('404')) {
      console.warn(`Card ${cardId} not found via SDK.`);
      return null;
    }

    console.error(`Error fetching details for card ${cardId} via SDK:`, error);
    return null;
  }
}
