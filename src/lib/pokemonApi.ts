import { PokemonCard, CardPrices } from './types';
// Remove SDK imports as we'll use fetch
// import { findCardsByQueries, Card, findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';

// --- Add Filter Type Definition (Keep this if used elsewhere) ---
interface CardFilters {
  set?: string;
  rarity?: string;
  type?: string;
  supertype?: string;
}

// Get Supabase function URL and Anon Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const edgeFunctionUrl = `${supabaseUrl}/functions/v1/pokemon-proxy`;

// API key check - No longer needed here as Edge Function handles it
// const apiKey = process.env.POKEMON_TCG_API_KEY;
// if (!apiKey) {
//   console.warn('Pokemon TCG API Key not found...');
// }

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

// --- fetchAllPokemonCards - Refactor to use Edge Function ---
// This function might need complete rethinking or removal if we fetch paged
// Or call the edge function multiple times if needed.
export async function fetchAllPokemonCards(): Promise<PokemonCard[]> {
  console.warn("fetchAllPokemonCards is likely inefficient with the proxy. Consider using paged fetching.");
  // For now, let's fetch a large first page via the proxy as a placeholder
  const limit = 250; // Max page size
  const params = new URLSearchParams({
    q: `supertype:Pokemon`,
    page: '1',
    pageSize: limit.toString(),
    orderBy: 'nationalPokedexNumbers'
  });

  try {
    console.log(`Fetching initial batch via proxy: ${edgeFunctionUrl}/cards?${params}`);
    const response = await fetch(`${edgeFunctionUrl}/cards?${params}`, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      }
    });
    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.statusText}`);
    }

    // Parse the response from the Edge Function
    const responseData = await response.json();

    // Check if the response has a data property (new format) or is an array directly (old format)
    const apiCards: ApiCard[] = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []); // Handle both formats

    console.log(`Fetched ${apiCards.length} cards via proxy.`);
    return apiCards.map(mapApiCardToPokemonCard);

  } catch (error) {
    console.error('Error fetching cards via proxy in fetchAllPokemonCards:', error);
    return [];
  }
}

// --- fetchCardsPaged - Updated to handle new metadata format ---
export async function fetchCardsPaged(
  page: number,
  limit: number,
  // Filters can now potentially include a 'name' for searching
  filters: CardFilters & { name?: string } = {}
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number, isEmptyPage: boolean }> {
  console.log(`Fetching page ${page} with limit ${limit} via proxy. Filters:`, filters);

  // Construct query parameters, including filters
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: limit.toString(),
    orderBy: 'nationalPokedexNumbers' // Consider changing orderBy for search? Maybe API default is better?
  });

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
      // Although the proxy currently defaults to supertype:Pokemon on its side if q is empty...
      // Let's be explicit for clarity, but this might need sync with proxy logic
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

  // Join with AND. If empty, the proxy function should handle a default query.
  const queryString = filterParts.join(' AND ');
  if (queryString) {
    params.set('q', queryString);
  }

  console.log("Proxy Lib: Sending Params:", params.toString());

  try {
    const response = await fetch(`${edgeFunctionUrl}/cards?${params}`, {
       headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      }
    });
    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.statusText}`);
    }

    // Parse the response from the Edge Function
    const responseData = await response.json();

    // Check if the response has a data property (new format) or is an array directly (old format)
    const apiCards: ApiCard[] = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []); // Handle both formats

    // Get metadata from response or calculate defaults
    const totalCount: number = responseData.totalCount || apiCards.length || 0;
    const totalPages: number = responseData.totalPages || Math.ceil(totalCount / limit) || 1;

    // Check if we got an empty page (when page is higher than available data)
    const isEmptyPage = apiCards.length === 0;

    console.log(`Fetched ${apiCards.length} cards (total: ${totalCount}, pages: ${totalPages}) via proxy for page ${page}`);
    const cards = apiCards.map(mapApiCardToPokemonCard);

    return {
      cards,
      totalCount,
      totalPages,
      isEmptyPage
    };

  } catch (error) {
    console.error(`Error fetching page ${page} via proxy:`, error);
    return {
      cards: [],
      totalCount: 0,
      totalPages: 1,
      isEmptyPage: true
    };
  }
}

// --- fetchCardsBySet - Refactor to use Edge Function ---
export async function fetchCardsBySet(setId: string): Promise<PokemonCard[]> {
  console.log(`Fetching cards for set: ${setId} via proxy`);

  const params = new URLSearchParams({
      q: `set.id:${setId}`,
      pageSize: '250', // Fetch up to 250 cards
      orderBy: 'number',
  });

  try {
    const response = await fetch(`${edgeFunctionUrl}/cards?${params}`, {
       headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      }
    });
     if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.statusText}`);
    }

    // Parse the response from the Edge Function
    const responseData = await response.json();

    // Check if the response has a data property (new format) or is an array directly (old format)
    const apiCards: ApiCard[] = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []); // Handle both formats

    console.log(`Fetched ${apiCards.length} cards for set ${setId} via proxy`);
    return apiCards.map(mapApiCardToPokemonCard);

  } catch (error) {
    console.error('Error fetching cards by set via proxy:', error);
    return [];
  }
}

// --- fetchCardDetails - Refactor to use Edge Function ---
export async function fetchCardDetails(cardId: string): Promise<PokemonCard | null> {
  console.log(`Fetching details for card ID: ${cardId} via proxy`);

  try {
    const response = await fetch(`${edgeFunctionUrl}/cards/${cardId}`, {
       headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      }
    });
     if (!response.ok) {
        if(response.status === 404) {
            console.warn(`Card ${cardId} not found via proxy.`);
            return null;
        }
      throw new Error(`Proxy fetch failed: ${response.statusText}`);
    }
    const apiCard: ApiCard = await response.json();

    if (!apiCard) {
      console.warn(`Card with ID ${cardId} not found by proxy.`);
      return null;
    }

    return mapApiCardToPokemonCard(apiCard);

  } catch (error) {
    console.error(`Error fetching details for card ${cardId} via proxy:`, error);
    return null;
  }
}
