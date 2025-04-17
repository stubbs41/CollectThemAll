import { NextRequest, NextResponse } from 'next/server';
import { PokemonTCG, findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { getCardById } from '@/lib/pokemonTcgApi'; // Import our direct API client as fallback
import { getWithExpiry, setWithExpiry, CACHE_TIMES, CACHE_KEYS, createCacheKey } from '@/lib/cacheUtils';

// Get API key from environment variables
const apiKey = process.env.POKEMON_TCG_API_KEY || '';

// Flag to track if API key is available
let isApiKeyConfigured = false;

// Make sure PokemonTCG is defined before trying to configure it
if (apiKey && typeof PokemonTCG !== 'undefined' && PokemonTCG.configure) {
  try {
    PokemonTCG.configure({ apiKey });
    isApiKeyConfigured = true;
    console.log('Pokemon TCG SDK configured with API key in card-pricing route');
  } catch (error) {
    console.error('Error configuring Pokemon TCG SDK in card-pricing route:', error);
  }
} else {
  // Log a more detailed warning message to help with debugging
  if (!apiKey) {
    console.warn('Pokemon TCG API Key not found in environment variables. API rate limits may apply.');
  } else if (typeof PokemonTCG === 'undefined') {
    console.warn('Pokemon TCG SDK is undefined in card-pricing route. Check imports.');
  } else if (!PokemonTCG.configure) {
    console.warn('Pokemon TCG SDK configure method not available in card-pricing route. Check SDK version.');
  }
}

/**
 * API route for fetching just the pricing data for a specific card
 * This is used when we have the card data from GitHub but need the latest pricing
 */
export async function GET(request: NextRequest) {
  // Get card ID from query parameters
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Validate card ID
  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  try {
    // Check cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cacheKey = createCacheKey(CACHE_KEYS.CARD_PRICING, { id: cardId });
      const cachedPricing = getWithExpiry<any>(cacheKey);

      if (cachedPricing) {
        console.log(`Using cached pricing data for card ${cardId}`);
        return NextResponse.json(cachedPricing, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'X-Data-Source': 'cache'
          },
        });
      }
    }

    // Log API key status to help with debugging
    console.log(`Fetching pricing for card ${cardId}. API key configured: ${isApiKeyConfigured}`);

    // Try to fetch card from Pokemon TCG API using the SDK
    let card;
    let dataSource = 'sdk';

    try {
      if (isApiKeyConfigured) {
        card = await findCardByID(cardId);
      } else {
        throw new Error('API key not configured, skipping SDK call');
      }
    } catch (sdkError) {
      console.warn(`SDK error fetching card ${cardId}, falling back to direct API client:`, sdkError);
      // Fallback to our direct API client
      dataSource = 'direct-api';
      card = await getCardById(cardId);
    }

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Extract just the pricing data
    const pricingData = {
      tcgplayer: card.tcgplayer ? {
        url: card.tcgplayer.url,
        updatedAt: card.tcgplayer.updatedAt,
        prices: card.tcgplayer.prices
      } : undefined,
      cardmarket: card.cardmarket ? {
        url: card.cardmarket.url,
        updatedAt: card.cardmarket.updatedAt,
        prices: card.cardmarket.prices
      } : undefined,
      // Add timestamp for cache tracking
      fetchedAt: new Date().toISOString()
    };

    // Cache the pricing data
    const cacheKey = createCacheKey(CACHE_KEYS.CARD_PRICING, { id: cardId });
    setWithExpiry(cacheKey, pricingData, CACHE_TIMES.MEDIUM); // Cache for 24 hours

    // Return the pricing data
    return NextResponse.json(pricingData, {
      status: 200,
      headers: {
        // Cache for 1 hour, but allow stale data for up to 24 hours
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Data-Source': dataSource
      },
    });
  } catch (error) {
    console.error('Error fetching card pricing:', error);

    // Provide more detailed error message
    const errorMessage = error instanceof Error
      ? `Failed to fetch card pricing: ${error.message}`
      : 'Failed to fetch card pricing';

    return NextResponse.json({
      error: errorMessage,
      cardId,
      apiKeyConfigured: isApiKeyConfigured
    }, { status: 500 });
  }
}
