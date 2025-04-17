import { NextRequest, NextResponse } from 'next/server';
import { PokemonTCG } from 'pokemon-tcg-sdk-typescript';

// Get API key from environment variables
const apiKey = process.env.POKEMON_TCG_API_KEY || '';

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
    // Configure API key
    PokemonTCG.configure({ apiKey });

    // Fetch card from Pokemon TCG API
    const card = await PokemonTCG.findCardByID(cardId);

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
    return NextResponse.json({ error: 'Failed to fetch card pricing' }, { status: 500 });
  }
}
