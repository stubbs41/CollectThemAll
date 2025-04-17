import { NextRequest, NextResponse } from 'next/server';
import { PokemonTCG, findCardByID } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { getCardById } from '@/lib/pokemonTcgApi'; // Import our direct API client as fallback

// Get API key from environment variables
const apiKey = process.env.POKEMON_TCG_API_KEY || '';

// Make sure PokemonTCG is defined before trying to configure it
if (apiKey && typeof PokemonTCG !== 'undefined' && PokemonTCG.configure) {
  try {
    PokemonTCG.configure({ apiKey });
    console.log('Pokemon TCG SDK configured with API key in card-pricing route');
  } catch (error) {
    console.error('Error configuring Pokemon TCG SDK in card-pricing route:', error);
  }
} else {
  console.warn('Pokemon TCG API Key not found or SDK not available in card-pricing route. API rate limits may apply.');
}

/**
 * API route for fetching just the pricing data for a specific card
 * This is used when we have the card data from GitHub but need the latest pricing
 */
export async function GET(request: NextRequest) {
  // Get card ID from query parameters
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');

  // Validate card ID
  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  try {
    // Try to fetch card from Pokemon TCG API using the SDK
    let card;
    try {
      card = await findCardByID(cardId);
    } catch (sdkError) {
      console.warn(`SDK error fetching card ${cardId}, falling back to direct API client:`, sdkError);
      // Fallback to our direct API client
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
      } : undefined
    };

    // Return the pricing data
    return NextResponse.json(pricingData, {
      status: 200,
      headers: {
        // Cache for 1 hour, but allow stale data for up to 24 hours
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching card pricing:', error);

    // Provide more detailed error message
    const errorMessage = error instanceof Error
      ? `Failed to fetch card pricing: ${error.message}`
      : 'Failed to fetch card pricing';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
