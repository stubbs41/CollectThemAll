import { NextRequest, NextResponse } from 'next/server';
import { getCardById, mapApiCardToPokemonCard } from '@/lib/pokemonTcgApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  console.log(`/api/card-details: Fetching details for card ID: ${cardId}`);

  try {
    // Use our direct API client to fetch card details
    const apiCard = await getCardById(cardId);

    if (!apiCard) {
      console.warn(`/api/card-details: Card with ID ${cardId} not found.`);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Map API card to our PokemonCard type with error handling
    let card;
    try {
      card = mapApiCardToPokemonCard(apiCard);
    } catch (mappingError) {
      console.error(`Error mapping card ${cardId}:`, mappingError);

      // Create a minimal card with available data
      card = {
        id: apiCard.id || cardId,
        name: apiCard.name || 'Unknown Card',
        images: {
          small: apiCard.images?.small || '',
          large: apiCard.images?.large || ''
        },
        set: {
          id: apiCard.set?.id || '',
          name: apiCard.set?.name || 'Unknown Set',
          series: apiCard.set?.series || '',
          images: apiCard.set?.images || {}
        },
        number: apiCard.number || '',
      };
    }

    // Return the response
    return NextResponse.json({
      card
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    console.error(`/api/card-details: Error fetching details for card ${cardId}:`, error);

    // Return a minimal card object instead of an error
    return NextResponse.json({
      card: {
        id: cardId,
        name: 'Card data unavailable',
        images: {
          small: '',
          large: ''
        },
        set: {
          id: '',
          name: 'Unknown Set',
          series: '',
          images: {}
        },
        number: '',
      }
    });
  }
}
