import { NextRequest, NextResponse } from 'next/server';
// Remove direct SDK import
// import { findCardsByQueries, Card } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { PokemonCard } from '@/lib/types';
// Import the refactored functions from pokemonApi and pokemonTcgApi
import { fetchCardsPaged } from '@/lib/pokemonApi';
import { searchCards as directSearchCards, mapApiCardToPokemonCard } from '@/lib/pokemonTcgApi';

// Add export configuration for static exports
export const dynamic = 'force-dynamic';

// Helper function is no longer needed here as mapping is done in pokemonApi
// function extractPrices(apiCard: Card) { ... }

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '32', 10);

  // Check if this is a direct search request (for specific Pokémon names)
  const directSearch = searchParams.get('directSearch') === 'true';

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

  // Hard limit on page numbers - based on known data availability
  // We know from testing that pages beyond 420 don't have data
  const MAX_KNOWN_VALID_PAGE = 420;
  const originalPage = page;
  if (page > MAX_KNOWN_VALID_PAGE) {
    console.log(`/api/cards-search: Requested page ${page} exceeds known valid range. Redirecting to page ${MAX_KNOWN_VALID_PAGE}`);
    page = MAX_KNOWN_VALID_PAGE;
  }

  // Remove the 10-page limit for searches
  // The Pokemon TCG API has a limit of 250 cards per request, but we can make multiple requests
  // to get more cards if needed

  console.log(`API Search Route: Proxying search for "${query}", page=${page}, limit=${limit}, filters:`, filters);

  try {
    // Check if this is a specific Pokémon name search (like "Audino")
    // For specific Pokémon names, we'll use a direct search approach
    // Use the directSearch parameter from the client or detect it automatically
    const isSpecificPokemonSearch = directSearch || (query.trim().length > 2 && !query.includes(' ') && !query.includes('*'));

    let cards: PokemonCard[] = [];
    let totalCount = 0;

    if (isSpecificPokemonSearch) {
      console.log(`API Search Route: Using direct search for specific Pokémon "${query}"`);

      // Build a direct search query for the Pokémon name
      // This will search for exact matches first
      const exactQuery = `name:"${query}"`;  // Exact match

      // Perform the direct search
      const exactResults = await directSearchCards(exactQuery, 1, 250);

      if (exactResults.cards.length > 0) {
        // We found exact matches
        cards = exactResults.cards.map(mapApiCardToPokemonCard);
        totalCount = exactResults.totalCount;
      } else {
        // Try a partial match if exact match fails
        console.log(`API Search Route: No exact matches for "${query}", trying partial match`);
        const partialQuery = `name:*${query}*`;  // Partial match
        const partialResults = await directSearchCards(partialQuery, 1, 250);
        cards = partialResults.cards.map(mapApiCardToPokemonCard);
        totalCount = partialResults.totalCount;
      }

      // Apply pagination manually
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      // Check if the requested page is beyond available data
      if (startIndex >= cards.length) {
        // If we're beyond available data, adjust totalPages to match what we actually have
        const actualTotalPages = Math.ceil(cards.length / limit);

        console.log(`API Search Route: Requested page ${page} is beyond available data (${cards.length} cards). Last valid page is ${actualTotalPages}.`);

        return NextResponse.json({
          cards: [],
          totalCount: cards.length,
          totalPages: actualTotalPages,
          query,
          directSearch: isSpecificPokemonSearch,
          isEmptyPage: true,
          message: `No cards found for "${query}" on page ${page}. The last valid page is ${actualTotalPages}.`
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }

      cards = cards.slice(startIndex, endIndex);
      const totalPages = Math.ceil(totalCount / limit);

      console.log(`API Search Route: Direct search found ${totalCount} total cards, returning ${cards.length} for page ${page} of ${totalPages}`);
    } else {
      // For more complex searches, use the existing approach
      console.log(`API Search Route: Using standard search for "${query}"`);

      // Combine the search query with filters
      const combinedFilters = {
          ...filters,
          name: query
      };

      // Call the function that uses the proxy
      const results = await fetchCardsPaged(page, limit, combinedFilters as any);
      cards = results.cards;
      totalCount = results.totalCount;
    }

    console.log(`API Search Route: Received ${cards.length} cards from search.`);

    // Return the data (mapping already done by fetchCardsPaged)
    // For direct searches, we don't want to cache the response
    // This ensures we always get fresh results for specific Pokémon searches
    const cacheControl = isSpecificPokemonSearch
      ? 'no-store, max-age=0'
      : 'public, s-maxage=3600, stale-while-revalidate=86400';

    // Calculate total pages for both search methods
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      cards,
      totalCount,
      totalPages,
      query,
      directSearch: isSpecificPokemonSearch, // Include this flag in the response
      isEmptyPage: cards.length === 0,
      // Include redirection info if the page was adjusted
      redirected: originalPage > MAX_KNOWN_VALID_PAGE,
      requestedPage: originalPage > MAX_KNOWN_VALID_PAGE ? originalPage : undefined,
      message: originalPage > MAX_KNOWN_VALID_PAGE ?
        `Page ${originalPage} exceeds the maximum available data. Showing page ${MAX_KNOWN_VALID_PAGE} instead.` : undefined
    }, {
      status: 200,
      headers: {
        'Cache-Control': cacheControl,
      },
    });

  } catch (error) {
    console.error(`API Search Route: Error proxying search for "${query}" with filters:`, filters, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Proxy search failed: ${message}` }, { status: 500 });
  }
}
