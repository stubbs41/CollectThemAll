import { NextRequest, NextResponse } from 'next/server';
// Remove direct SDK import
// import { findCardsByQueries, Card } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { PokemonCard } from '@/lib/types';
// Import the refactored function from pokemonApi
import { fetchCardsPaged } from '@/lib/pokemonApi';

// Add export configuration for static exports
export const dynamic = 'force-dynamic';

// Helper function is no longer needed here as mapping is done in pokemonApi
// function extractPrices(apiCard: Card) { ... }

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '32', 10);
  
  // -- Extract Filter Parameters --
  const set = searchParams.get('set') || undefined;
  const rarity = searchParams.get('rarity') || undefined;
  const type = searchParams.get('type') || undefined;
  // For search, we probably don't want a default supertype unless specified
  const supertype = searchParams.get('supertype') || undefined; 
  const filters = { set, rarity, type, supertype };

  // Basic validation
  if (!query.trim()) {
    return NextResponse.json({ error: 'Search query is required for this route' }, { status: 400 });
  }
  if (isNaN(page) || page < 1) {
    return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
  }
  if (isNaN(limit) || limit < 1 || limit > 250) {
    return NextResponse.json({ error: 'Invalid limit value (1-250)' }, { status: 400 });
  }

  console.log(`API Search Route: Proxying search for "${query}", page=${page}, limit=${limit}, filters:`, filters);

  try {
    // Directly use the refactored fetchCardsPaged which calls the proxy
    // We need to modify fetchCardsPaged slightly to handle the name query alongside filters
    // OR adjust the proxy function to handle name searches
    // For now, let's assume fetchCardsPaged can handle a combined query
    
    // Combine the search query with filters (This logic might need refinement 
    // depending on how pokemonApi/proxy handles combined q)
    const combinedFilters = { 
        ...filters, 
        // We need a way to pass the search term. Let's add a name property?
        // Or adjust fetchCardsPaged to accept a general query string?
        // --- TEMPORARY WORKAROUND: Add name to filters object --- 
        // This assumes fetchCardsPaged will build the query correctly
        name: query 
        // --- END TEMPORARY WORKAROUND --- 
    };

    // Call the function that uses the proxy
    const { cards, totalCount } = await fetchCardsPaged(page, limit, combinedFilters as any);

    console.log(`API Search Route: Received ${cards.length} cards from proxy.`);

    // Return the data (mapping already done by fetchCardsPaged)
    return NextResponse.json({
      cards,
      totalCount, // Use totalCount returned from the proxy (needs implementation there)
      query
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error(`API Search Route: Error proxying search for "${query}" with filters:`, filters, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Proxy search failed: ${message}` }, { status: 500 });
  }
}
