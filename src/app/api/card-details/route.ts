import { NextRequest, NextResponse } from 'next/server';
import { mapApiCardToPokemonCard } from '@/lib/apiUtils';

// Import the SDK with proper error handling
let findCardByID: any;
let PokemonTCG: any;

try {
  const sdk = require('pokemon-tcg-sdk-typescript/dist/sdk');
  findCardByID = sdk.findCardByID;
  PokemonTCG = sdk.PokemonTCG;
} catch (error) {
  console.error('Error importing Pokemon TCG SDK:', error);
}

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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  console.log(`/api/card-details: Fetching details for card ID: ${cardId}`);

  // Check if SDK is properly initialized
  if (!findCardByID) {
    console.error('Pokemon TCG SDK not properly initialized');
    return NextResponse.json({
      error: 'Service temporarily unavailable',
      message: 'The card service is currently unavailable. Please try again later.'
    }, { status: 503 });
  }

  try {
    // Use the SDK to fetch card details with additional error handling
    let apiCard;
    try {
      apiCard = await findCardByID(cardId);
    } catch (sdkError) {
      console.error(`SDK error fetching card ${cardId}:`, sdkError);

      // Create a minimal fallback card with the ID
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
    // Handle 404 errors gracefully
    if (error instanceof Error && error.message.includes('404')) {
      console.warn(`/api/card-details: Card ${cardId} not found.`);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

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
