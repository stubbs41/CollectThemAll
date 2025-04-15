import { NextRequest, NextResponse } from 'next/server';
import { fetchCardDetails } from '@/lib/pokemonApi'; // Import the server-side function

// Define the GET handler for this route with correct parameter types
export async function GET(
  request: NextRequest,
  context: { params: { cardId: string } }
) {
  const cardId = context.params.cardId; // Get the card ID from the URL path

  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  try {
    // Call the existing server-side function which has access to process.env
    const cardDetails = await fetchCardDetails(cardId);

    if (!cardDetails) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Return the fetched details as JSON
    return NextResponse.json(cardDetails);

  } catch (error) {
    console.error(`API Route Error fetching ${cardId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch card details' }, { status: 500 });
  }
} 