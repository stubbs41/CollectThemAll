// TEMPORARY - Contents for src/app/api/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Correctly import the necessary SDK function
import { findCardsByQueries, Card } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { PokemonCard, CardPrices } from '@/lib/types'; // Import necessary types

// Helper function to safely extract prices (copied from pokemonApi.ts for self-containment)
function extractPrices(apiCard: Card): CardPrices | undefined {
    if (!apiCard.tcgplayer?.prices) {
        return undefined;
    }
    // Assume direct compatibility based on our types.ts definition
    return apiCard.tcgplayer.prices as CardPrices;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');

  if (!ids) {
    return NextResponse.json({ error: 'Missing card IDs parameter' }, { status: 400 });
  }

  const cardIds = ids.split(',').map(id => id.trim()).filter(id => id);

  if (cardIds.length === 0) {
    return NextResponse.json({ cards: [] });
  }

  // Construct the query string for multiple IDs: id:id1 OR id:id2 OR ...
  const idQuery = cardIds.map(id => `id:${id}`).join(' OR ');
  
  console.log(`/api/cards: Fetching details for IDs query: ${idQuery}`);

  try {
    // Use findCardsByQueries with the constructed ID query
    const apiCards: Card[] = await findCardsByQueries({ q: idQuery, pageSize: cardIds.length }); 

    // Map to PokemonCard type
    const cards: PokemonCard[] = apiCards.map((apiCard: Card) => ({
      id: apiCard.id,
      name: apiCard.name,
      images: {
          small: apiCard.images?.small || '',
          large: apiCard.images?.large || ''
      },
      set: {
          id: apiCard.set?.id || '',
          name: apiCard.set?.name || '',
          series: apiCard.set?.series || ''
      },
      number: apiCard.number || '',
      rarity: apiCard.rarity,
      tcgplayer: apiCard.tcgplayer ? {
          url: apiCard.tcgplayer.url,
          updatedAt: apiCard.tcgplayer.updatedAt,
          prices: extractPrices(apiCard),
      } : undefined,
    }));

    console.log(`/api/cards: Returning ${cards.length} cards.`);

    return NextResponse.json({ cards }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=259200',
      },
    });

  } catch (error) {
    console.error(`/api/cards: Error fetching card details for IDs query ${idQuery}:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
// End TEMPORARY
