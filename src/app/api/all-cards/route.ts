import { NextResponse } from 'next/server';
import { fetchAllPokemonCards } from '@/lib/pokemonApi'; // Assuming the function is still exported

// Decide on caching strategy:
// - 'no-store': Fetch fresh every time (bad for this use case)
// - 'force-cache': Aggressively cache (good, but need revalidation strategy)
// - Time-based revalidation: Cache for a period (e.g., 1 hour)
// export const revalidate = 3600; // Revalidate data every hour

export async function GET() {
  console.log("/api/all-cards: Fetching data...");
  try {
    // Fetch the data using the existing function (ensure it doesn't have React.cache)
    const cards = await fetchAllPokemonCards();

    if (!cards || cards.length === 0) {
      console.error("/api/all-cards: No cards fetched from pokemonApi.");
      return NextResponse.json({ error: 'Failed to fetch card data' }, { status: 500 });
    }

    console.log(`/api/all-cards: Returning ${cards.length} cards.`);

    // Return the data with appropriate caching headers
    return NextResponse.json(cards, {
      status: 200,
      headers: {
        // Cache on CDN/browser for 1 hour, allow stale-while-revalidate for smooth updates
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error("/api/all-cards: Error fetching cards:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 