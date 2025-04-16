import { NextResponse } from 'next/server';
import { findCardsByQueries, PokemonTCG } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { mapApiCardToPokemonCard } from '@/lib/apiUtils';

// Configure the SDK with the API key (server-side only)
const apiKey = process.env.POKEMON_TCG_API_KEY;

// Make sure PokemonTCG is defined before trying to configure it
if (apiKey && typeof PokemonTCG !== 'undefined' && PokemonTCG.configure) {
  try {
    PokemonTCG.configure({ apiKey });
    console.log('Pokemon TCG SDK configured with API key');
  } catch (error) {
    console.error('Error configuring Pokemon TCG SDK:', error);
  }
} else {
  console.warn('Pokemon TCG API Key not found or SDK not available. API rate limits may apply.');
}

// Decide on caching strategy:
// - 'no-store': Fetch fresh every time (bad for this use case)
// - 'force-cache': Aggressively cache (good, but need revalidation strategy)
// - Time-based revalidation: Cache for a period (e.g., 1 hour)
// export const revalidate = 3600; // Revalidate data every hour

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log("/api/all-cards: Fetching data...");
  try {
    // For now, let's fetch a large first page as a placeholder
    const limit = 250; // Max page size
    const queryParams = {
      q: 'supertype:Pokemon',
      page: 1,
      pageSize: limit,
      orderBy: 'nationalPokedexNumbers'
    };

    // Use the SDK to fetch cards
    const apiCards = await findCardsByQueries(queryParams);

    if (!apiCards || apiCards.length === 0) {
      console.error("/api/all-cards: No cards fetched from Pokemon TCG API.");
      return NextResponse.json({ error: 'Failed to fetch card data' }, { status: 500 });
    }

    // Map API cards to our PokemonCard type
    const cards = apiCards.map(mapApiCardToPokemonCard);

    console.log(`/api/all-cards: Returning ${cards.length} cards.`);

    // Return the data with appropriate caching headers
    return NextResponse.json({
      cards,
      count: cards.length,
      message: 'This endpoint returns a limited batch of cards. For complete data, use the paged API.'
    }, {
      status: 200,
      headers: {
        // Cache on CDN/browser for 1 hour, allow stale-while-revalidate for smooth updates
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error("/api/all-cards: Error fetching cards:", error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}