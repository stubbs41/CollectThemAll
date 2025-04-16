import { NextRequest, NextResponse } from 'next/server';
import { findCardsByQueries, PokemonTCG } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { mapApiCardToPokemonCard } from '@/lib/apiUtils';

// Configure the SDK with the API key (server-side only)
const apiKey = process.env.POKEMON_TCG_API_KEY;
if (apiKey) {
  PokemonTCG.configure({ apiKey });
} else {
  console.warn('Pokemon TCG API Key not found. API rate limits may apply.');
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const setId = searchParams.get('setId');

  if (!setId) {
    return NextResponse.json({ error: 'Set ID is required' }, { status: 400 });
  }

  console.log(`/api/cards-by-set: Fetching cards for set: ${setId}`);

  try {
    // Build query parameters for the SDK
    const queryParams = {
      q: `set.id:${setId}`,
      pageSize: 250, // Fetch up to 250 cards
      orderBy: 'number',
    };

    // Use the SDK to fetch cards by set
    const apiCards = await findCardsByQueries(queryParams);

    console.log(`/api/cards-by-set: Fetched ${apiCards.length} cards for set ${setId}`);
    
    // Map API cards to our PokemonCard type
    const cards = apiCards.map(mapApiCardToPokemonCard);

    // Return the response
    return NextResponse.json({ 
      cards,
      count: cards.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error(`/api/cards-by-set: Error fetching cards for set ${setId}:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
