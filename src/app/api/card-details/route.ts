import { NextRequest, NextResponse } from 'next/server';
import { findCardByID, PokemonTCG } from 'pokemon-tcg-sdk-typescript/dist/sdk';
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
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  console.log(`/api/card-details: Fetching details for card ID: ${cardId}`);

  try {
    // Use the SDK to fetch card details
    const apiCard = await findCardByID(cardId);

    if (!apiCard) {
      console.warn(`/api/card-details: Card with ID ${cardId} not found.`);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Map API card to our PokemonCard type
    const card = mapApiCardToPokemonCard(apiCard);

    // Return the response
    return NextResponse.json({ 
      card 
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error) {
    // Handle 404 errors gracefully
    if (error instanceof Error && error.message.includes('404')) {
      console.warn(`/api/card-details: Card ${cardId} not found.`);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    console.error(`/api/card-details: Error fetching details for card ${cardId}:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
