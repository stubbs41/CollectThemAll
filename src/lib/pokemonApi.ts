import { PokemonCard, CardPrices, CardSet } from './types';
import * as GithubData from './githubDataManager';
import { loadImageWithCache } from './imageCache';

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

// --- fetchCardsPaged - Updated to use local GitHub data first, then server-side API route ---
export async function fetchCardsPaged(
  page: number,
  limit: number,
  // Filters can now potentially include a 'name' for searching
  filters: CardFilters & { name?: string } = {}
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number, isEmptyPage: boolean }> {
  console.log(`Fetching page ${page} with limit ${limit}. Filters:`, filters);

  try {
    // Try to get from local GitHub data first
    try {
      // Initialize GitHub data if needed
      await GithubData.initializeData();

      // If we're searching by name, use the GitHub search function
      if (filters.name) {
        console.log(`Searching for cards with name: ${filters.name} in GitHub data`);
        const searchResults = await GithubData.searchCardsByName(filters.name);

        // Apply additional filters
        let filteredResults = searchResults;
        if (filters.set) {
          filteredResults = filteredResults.filter(card => card.set.id === filters.set);
        }
        if (filters.supertype) {
          filteredResults = filteredResults.filter(card => card.supertype === filters.supertype);
        }
        if (filters.rarity) {
          filteredResults = filteredResults.filter(card => card.rarity === filters.rarity);
        }
        if (filters.type) {
          filteredResults = filteredResults.filter(card =>
            card.types && card.types.includes(filters.type!)
          );
        }

        // Calculate pagination
        const totalCount = filteredResults.length;
        const totalPages = Math.ceil(totalCount / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const pagedResults = filteredResults.slice(startIndex, endIndex);

        // Map to PokemonCard type
        const mappedCards = await Promise.all(pagedResults.map(async (card) => {
          const setData = await GithubData.getSetById(card.set.id);
          const pokemonCard = GithubData.mapGithubCardToPokemonCard(card, setData);

          // Fetch pricing data if needed
          if (!pokemonCard.tcgplayer) {
            try {
              const pricingResponse = await fetch(`${apiBaseUrl}/card-pricing?cardId=${encodeURIComponent(card.id)}`);

              if (pricingResponse.ok) {
                const pricingData = await pricingResponse.json();

                if (pricingData.tcgplayer) {
                  pokemonCard.tcgplayer = pricingData.tcgplayer;
                }
              }
            } catch (pricingError) {
              console.warn(`Could not fetch pricing data for ${card.id}:`, pricingError);
              // Continue without pricing data
            }
          }

          return pokemonCard;
        }));

        console.log(`Found ${mappedCards.length} cards in GitHub data for page ${page}`);

        return {
          cards: mappedCards,
          totalCount,
          totalPages,
          isEmptyPage: mappedCards.length === 0
        };
      }

      // If we're filtering by set, use the GitHub set function
      if (filters.set) {
        console.log(`Fetching cards for set: ${filters.set} from GitHub data`);
        const cardsInSet = await GithubData.getCardsForSet(filters.set);

        // Apply additional filters
        let filteredResults = cardsInSet;
        if (filters.supertype) {
          filteredResults = filteredResults.filter(card => card.supertype === filters.supertype);
        }
        if (filters.rarity) {
          filteredResults = filteredResults.filter(card => card.rarity === filters.rarity);
        }
        if (filters.type) {
          filteredResults = filteredResults.filter(card =>
            card.types && card.types.includes(filters.type!)
          );
        }

        // Calculate pagination
        const totalCount = filteredResults.length;
        const totalPages = Math.ceil(totalCount / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const pagedResults = filteredResults.slice(startIndex, endIndex);

        // Map to PokemonCard type
        const setData = await GithubData.getSetById(filters.set);
        const mappedCards = await Promise.all(pagedResults.map(async (card) => {
          const pokemonCard = GithubData.mapGithubCardToPokemonCard(card, setData);

          // Fetch pricing data if needed
          if (!pokemonCard.tcgplayer) {
            try {
              const pricingResponse = await fetch(`${apiBaseUrl}/card-pricing?cardId=${encodeURIComponent(card.id)}`);

              if (pricingResponse.ok) {
                const pricingData = await pricingResponse.json();

                if (pricingData.tcgplayer) {
                  pokemonCard.tcgplayer = pricingData.tcgplayer;
                }
              }
            } catch (pricingError) {
              console.warn(`Could not fetch pricing data for ${card.id}:`, pricingError);
              // Continue without pricing data
            }
          }

          return pokemonCard;
        }));

        console.log(`Found ${mappedCards.length} cards in GitHub data for set ${filters.set} page ${page}`);

        return {
          cards: mappedCards,
          totalCount,
          totalPages,
          isEmptyPage: mappedCards.length === 0
        };
      }
    } catch (githubError) {
      console.warn(`Error fetching cards from GitHub data:`, githubError);
      // Continue to API fallback
    }

    // Fallback to API if not found in GitHub data or if we're not searching by name or set
    console.log(`Falling back to API for page ${page}`);

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
    const response = await fetch(`${apiBaseUrl}/cards-paged?${params}`, {
      // Add cache: 'no-store' to prevent caching of search results
      // This ensures we always get fresh results, especially for high page numbers
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cards page ${page}: ${response.status}`);
    }

    const data = await response.json();

    // If we got an empty result but the page number is high, try again with a different approach
    if (data.isEmptyPage && page > 10) {
      console.log(`Empty page ${page} received. Attempting alternative fetch method...`);

      // Try a different approach for high page numbers
      // This is a workaround for the Pokemon TCG API's pagination limitations
      const altParams = new URLSearchParams(params);
      altParams.set('highPageWorkaround', 'true');

      const altResponse = await fetch(`${apiBaseUrl}/cards-paged?${altParams}`, {
        cache: 'no-store'
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.cards && altData.cards.length > 0) {
          console.log(`Alternative fetch successful for page ${page}. Got ${altData.cards.length} cards.`);
          return {
            cards: altData.cards || [],
            totalCount: altData.totalCount || 0,
            totalPages: altData.totalPages || 1,
            isEmptyPage: false
          };
        }
      }
    }

    return {
      cards: data.cards || [],
      totalCount: data.totalCount || 0,
      totalPages: data.totalPages || 1,
      isEmptyPage: data.isEmptyPage || data.cards?.length === 0
    };

  } catch (error) {
    console.error(`Error fetching page ${page}:`, error);
    return {
      cards: [],
      totalCount: 0,
      totalPages: 1,
      isEmptyPage: true
    };
  }
}

// --- fetchCardsBySet - Updated to use local GitHub data first, then server-side API route ---
export async function fetchCardsBySet(setId: string): Promise<PokemonCard[]> {
  console.log(`Fetching cards for set: ${setId}`);

  try {
    // Try to get from local GitHub data first
    try {
      // Initialize GitHub data if needed
      await GithubData.initializeData();

      // Get cards from GitHub data
      const githubCards = await GithubData.getCardsForSet(setId);

      if (githubCards && githubCards.length > 0) {
        console.log(`Found ${githubCards.length} cards for set ${setId} in GitHub data`);

        // Get set data to include in the cards
        const setData = await GithubData.getSetById(setId);

        // Map to our PokemonCard type
        const pokemonCards = await Promise.all(githubCards.map(async (card) => {
          const pokemonCard = GithubData.mapGithubCardToPokemonCard(card, setData);

          // If we need pricing data, fetch it from the API
          if (!pokemonCard.tcgplayer) {
            try {
              // Fetch just the pricing data
              const pricingResponse = await fetch(`${apiBaseUrl}/card-pricing?cardId=${encodeURIComponent(card.id)}`);

              if (pricingResponse.ok) {
                const pricingData = await pricingResponse.json();

                if (pricingData.tcgplayer) {
                  pokemonCard.tcgplayer = pricingData.tcgplayer;
                }
              }
            } catch (pricingError) {
              console.warn(`Could not fetch pricing data for ${card.id}:`, pricingError);
              // Continue without pricing data
            }
          }

          return pokemonCard;
        }));

        return pokemonCards;
      }
    } catch (githubError) {
      console.warn(`Error fetching cards for set ${setId} from GitHub data:`, githubError);
      // Continue to API fallback
    }

    // Fallback to API if not found in GitHub data
    console.log(`Falling back to API for set: ${setId}`);

    // Make request to server-side API route
    const response = await fetch(`${apiBaseUrl}/cards-by-set?setId=${encodeURIComponent(setId)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch cards for set ${setId}: ${response.status}`);
    }

    const data = await response.json();
    return data.cards || [];

  } catch (error) {
    console.error(`Error fetching cards for set ${setId}:`, error);
    return [];
  }
}

// Cache for card details to avoid redundant fetches
const cardDetailsCache = new Map<string, {card: PokemonCard, timestamp: number}>();
const CARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to fetch pricing data in the background without blocking the UI
async function fetchPricingDataInBackground(cardId: string, card: PokemonCard): Promise<void> {
  try {
    // Use setTimeout to push this to the next event loop cycle
    setTimeout(async () => {
      try {
        const pricingResponse = await fetch(`${apiBaseUrl}/card-pricing?cardId=${encodeURIComponent(cardId)}`);

        if (pricingResponse.ok) {
          const pricingData = await pricingResponse.json();

          if (pricingData.tcgplayer) {
            // Update the card's pricing data
            card.tcgplayer = pricingData.tcgplayer;

            // Also update the cached version
            const cachedData = cardDetailsCache.get(cardId);
            if (cachedData) {
              cachedData.card.tcgplayer = pricingData.tcgplayer;
            }
          }
        }
      } catch (error) {
        // Silently fail for background updates
        console.debug(`Background pricing update failed for ${cardId}:`, error);
      }
    }, 100);
  } catch (error) {
    // Catch any synchronous errors
    console.debug(`Error setting up background pricing fetch for ${cardId}:`, error);
  }
}

// --- fetchCardDetails - Updated to use local data first, then server-side API route ---
export async function fetchCardDetails(cardId: string, forceRefreshPricing: boolean = false): Promise<PokemonCard | null> {
  // Check cache first (unless force refresh is requested)
  const now = Date.now();
  const cachedData = cardDetailsCache.get(cardId);

  if (cachedData && !forceRefreshPricing && (now - cachedData.timestamp < CARD_CACHE_TTL)) {
    // Use cached card data but still fetch pricing in the background if needed
    const card = {...cachedData.card}; // Create a copy to avoid modifying the cached version

    // Fetch pricing in the background if we're not forcing a refresh
    if (!forceRefreshPricing) {
      fetchPricingDataInBackground(cardId, card);
    }

    return card;
  }

  console.log(`Fetching details for card ID: ${cardId}${forceRefreshPricing ? ' with forced price refresh' : ''}`);

  try {
    // Try to get from local GitHub data first
    try {
      // Initialize GitHub data if needed
      await GithubData.initializeData();

      // Get card from GitHub data
      const githubCard = await GithubData.getCardById(cardId);

      if (githubCard) {
        console.log(`Found card ${cardId} in local GitHub data`);

        // Get set data to include in the card
        const setId = cardId.split('-')[0];
        const setData = await GithubData.getSetById(setId);

        // Map to our PokemonCard type
        const pokemonCard = GithubData.mapGithubCardToPokemonCard(githubCard, setData);

        // Always fetch pricing data to ensure it's up to date
        try {
          // Fetch the pricing data with refresh parameter if needed
          const refreshParam = forceRefreshPricing ? '&refresh=true' : '';
          const pricingResponse = await fetch(`${apiBaseUrl}/card-pricing?cardId=${encodeURIComponent(cardId)}${refreshParam}`);

          if (pricingResponse.ok) {
            const pricingData = await pricingResponse.json();

            if (pricingData.tcgplayer) {
              pokemonCard.tcgplayer = pricingData.tcgplayer;
            }
          }
        } catch (pricingError) {
          console.warn(`Could not fetch pricing data for ${cardId}:`, pricingError);
          // Continue with existing pricing data or without pricing data
        }

        // Cache the card data
        cardDetailsCache.set(cardId, {card: pokemonCard, timestamp: Date.now()});

        return pokemonCard;
      }
    } catch (githubError) {
      console.warn(`Error fetching card ${cardId} from GitHub data:`, githubError);
      // Continue to API fallback
    }

    // Fallback to API if not found in GitHub data
    console.log(`Falling back to API for card ID: ${cardId}`);

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
    console.error(`Error fetching details for card ${cardId}:`, error);
    return null;
  }
}
