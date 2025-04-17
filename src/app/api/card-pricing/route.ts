import { NextRequest, NextResponse } from 'next/server';
import { findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { getCardById } from '@/lib/pokemonTcgApi'; // Import our direct API client as fallback
import { getWithExpiry, setWithExpiry, CACHE_TIMES, CACHE_KEYS, createCacheKey } from '@/lib/cacheUtils';

// Get API key from environment variables
const apiKey = process.env.POKEMON_TCG_API_KEY || '';

// Flag to track if API key is available
const isApiKeyConfigured = !!apiKey;

// Log API key status (server-side only)
if (isApiKeyConfigured) {
  console.log('[Server] Pokemon TCG API key is configured in card-pricing route');
} else {
  console.warn('[Server] Pokemon TCG API key is not configured in environment variables. API rate limits may apply.');
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
    console.log(`[Server] Fetching pricing for card ${cardId}. API key configured: ${isApiKeyConfigured}`);

    // Try to fetch card directly from the Pokemon TCG API
    let card;
    let dataSource = 'direct-api';

    try {
      if (isApiKeyConfigured) {
        // Make a direct API request with the API key
        const headers = {
          'X-Api-Key': apiKey
        };

        const response = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
          headers,
          cache: 'no-store' // Ensure we're not getting a cached response
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        card = data.data;
      } else {
        throw new Error('API key not configured, falling back to SDK');
      }
    } catch (directApiError) {
      console.warn(`[Server] Direct API error fetching card ${cardId}, falling back to SDK:`, directApiError);
      // Fallback to the SDK
      dataSource = 'sdk';
      try {
        card = await findCardByID(cardId);
      } catch (sdkError) {
        console.warn(`[Server] SDK error fetching card ${cardId}, falling back to direct API client without key:`, sdkError);
        // Final fallback to our direct API client without key
        dataSource = 'fallback';
        card = await getCardById(cardId);
      }
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
    console.error('[Server] Error fetching card pricing:', error);

    // Provide more detailed error message
    const errorMessage = error instanceof Error
      ? `Failed to fetch card pricing: ${error.message}`
      : 'Failed to fetch card pricing';

    return NextResponse.json({
      error: errorMessage,
      cardId,
      apiKeyConfigured: isApiKeyConfigured,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyFirstChar: apiKey ? apiKey.charAt(0) : '',
      apiKeyLastChar: apiKey ? apiKey.charAt(apiKey.length - 1) : '',
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 500 });
  }
}
