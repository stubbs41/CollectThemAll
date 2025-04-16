import { NextRequest, NextResponse } from 'next/server';
import { PokemonCard } from '@/lib/types'; // Make sure PokemonCard includes types/supertype
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

// Example: Revalidate cached data for this route every hour
// export const revalidate = 3600;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '32', 10);

  // Extract Filter Parameters
  const setFilter = searchParams.get('set') || undefined;
  const rarityFilter = searchParams.get('rarity') || undefined;
  const typeFilter = searchParams.get('type') || undefined;
  const supertypeFilter = searchParams.get('supertype') || undefined;
  const nameFilter = searchParams.get('name') || undefined;

  // Check for high page workaround flag
  const highPageWorkaround = searchParams.get('highPageWorkaround') === 'true';

  // Validation
  if (isNaN(page) || page < 1) return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
  if (isNaN(limit) || limit < 1 || limit > 250) return NextResponse.json({ error: 'Invalid limit value (1-250)' }, { status: 400 });

  console.log(`/api/cards-paged: Fetching page=${page}, limit=${limit}. Filters:`, {
    set: setFilter,
    rarity: rarityFilter,
    type: typeFilter,
    supertype: supertypeFilter,
    name: nameFilter,
    highPageWorkaround
  });

  try {
    // Build query parameters for the SDK
    const queryParams: any = {
      page,
      pageSize: limit,
      orderBy: 'nationalPokedexNumbers'
    };

    // Build query string for 'q' param
    const filterParts: string[] = [];

    // Add name search if present
    if (nameFilter) {
      // Use exact match for high page workaround to get more precise results
      // This helps with finding cards like Audino that might be beyond page 10
      if (highPageWorkaround) {
        filterParts.push(`(name:"${nameFilter}")`); // Exact match
      } else {
        filterParts.push(`(name:"*${nameFilter}*")`); // Wildcards for normal search
      }
    }

    // Add other filters
    if (supertypeFilter) {
      filterParts.push(`(supertype:"${supertypeFilter}")`);
    } else if (!nameFilter) {
      // Default to Pokemon only if NOT doing a name search (to allow searching non-Pokemon cards)
      filterParts.push(`(supertype:"Pokemon")`);
    }

    if (setFilter) {
      filterParts.push(`(set.name:"${setFilter}")`);
    }

    if (rarityFilter) {
      filterParts.push(`(rarity:"${rarityFilter}")`);
    }

    if (typeFilter) {
      filterParts.push(`(types:"${typeFilter}")`);
    }

    // Join with AND
    const queryString = filterParts.join(' AND ');
    if (queryString) {
      queryParams.q = queryString;
    }

    // For high page workaround, we'll fetch all results and then paginate manually
    // This is necessary because the Pokemon TCG API has a limit of 250 cards per request
    // and only allows access to the first 10 pages (2500 cards)
    if (highPageWorkaround && page > 10) {
      console.log("/api/cards-paged: Using high page workaround for page", page);
      // Set page to 1 and increase pageSize to get all results
      // We'll manually paginate later
      queryParams.page = 1;
      queryParams.pageSize = 250; // Maximum allowed by the API
    }

    console.log("/api/cards-paged: Using query params:", queryParams);

    // Use the SDK to fetch cards
    const apiCards = await findCardsByQueries(queryParams);

    // Calculate total pages based on the total count
    let totalCount = apiCards.totalCount || apiCards.length * 10; // Estimate if not provided
    let totalPages = Math.ceil(totalCount / limit);

    // Handle high page workaround pagination
    let processedCards = apiCards;

    if (highPageWorkaround && page > 10) {
      // We fetched all results, now we need to manually paginate
      console.log(`/api/cards-paged: High page workaround - Got ${apiCards.length} total cards, paginating to page ${page}`);

      // Make sure we have a reasonable total count
      totalCount = Math.max(totalCount, apiCards.length);
      totalPages = Math.ceil(totalCount / limit);

      // Calculate the start and end indices for the requested page
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      // Check if the requested page is beyond the available data
      if (startIndex >= apiCards.length) {
        console.log(`/api/cards-paged: Requested page ${page} is beyond available data (${apiCards.length} cards)`);
        return NextResponse.json(
          {
            cards: [],
            totalCount: totalCount,
            totalPages: totalPages,
            isEmptyPage: true,
            message: `No cards found for page ${page}. This page is beyond the available data.`
          },
          { status: 200 }
        );
      }

      // Slice the results to get the requested page
      processedCards = apiCards.slice(startIndex, endIndex);
      console.log(`/api/cards-paged: High page workaround - Returning ${processedCards.length} cards for page ${page}`);
    }

    // Check if we got an empty page
    const isEmptyPage = processedCards.length === 0;

    console.log(`/api/cards-paged: Fetched ${processedCards.length} cards (total: ~${totalCount}, pages: ~${totalPages}) for page ${page}`);

    // If no cards were found for this page, return an appropriate response
    if (isEmptyPage) {
      return NextResponse.json(
        {
          cards: [],
          totalCount: totalCount,
          totalPages: totalPages,
          isEmptyPage: true,
          message: `No cards found for page ${page}. This page may be beyond the available data or no cards match the filters.`
        },
        { status: 200 }
      );
    }

    // Map API cards to our PokemonCard type
    const cards = processedCards.map(mapApiCardToPokemonCard);

    // --- ADD LOGGING ---
    console.log(`/api/cards-paged: Processed ${cards.length} cards. First few:`, JSON.stringify(cards.slice(0, 3), null, 2));
    // --- END LOGGING ---

    // Return the filtered data from the API
    return NextResponse.json(
      {
        cards: cards,
        totalCount: totalCount,
        totalPages: totalPages,
        isEmptyPage: cards.length === 0
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );

  } catch (error) {
    console.error(`/api/cards-paged: Error fetching/filtering page ${page}:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      isEmptyPage: true
    }, { status: 500 });
  }
}