import { NextRequest, NextResponse } from 'next/server';
import { fetchCardsPaged } from '@/lib/pokemonApi';
import { PokemonCard } from '@/lib/types'; // Make sure PokemonCard includes types/supertype

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
  const activeFilters = {
      set: setFilter,
      rarity: rarityFilter,
      type: typeFilter,
      supertype: supertypeFilter
  };
  const hasActiveFilters = Object.values(activeFilters).some(v => v);

  // Validation
  if (isNaN(page) || page < 1) return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
  if (isNaN(limit) || limit < 1 || limit > 250) return NextResponse.json({ error: 'Invalid limit value (1-250)' }, { status: 400 });

  console.log(`/api/cards-paged: Fetching page=${page}, limit=${limit}. Raw Filters:`, activeFilters);

  try {
    // Fetch base data with the active filters (not empty object)
    const { cards: baseCards, totalCount: baseTotalCount, totalPages, isEmptyPage } = 
      await fetchCardsPaged(page, limit, activeFilters); // Pass activeFilters instead of empty object

    // If no cards were found for this page, return an appropriate response
    if (isEmptyPage) {
      return NextResponse.json(
        { 
          cards: [], 
          totalCount: baseTotalCount, 
          totalPages: totalPages,
          isEmptyPage: true,
          message: `No cards found for page ${page}. This page may be beyond the available data or no cards match the filters.`
        }, 
        { status: 200 }
      );
    }

    // --- ADD LOGGING --- 
    console.log(`Fetched ${baseCards.length} base cards. First few:`, JSON.stringify(baseCards.slice(0, 3), null, 2));
    // --- END LOGGING ---

    // We no longer need to apply filters server-side since we're passing them to the API
    const filteredCards = baseCards;
    
    // Return the filtered data from the API
    return NextResponse.json(
      { 
        cards: filteredCards, 
        totalCount: baseTotalCount, 
        totalPages: totalPages,
        isEmptyPage: filteredCards.length === 0
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
      isEmptyPage: true 
    }, { status: 500 });
  }
} 