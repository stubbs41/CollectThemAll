import { NextResponse } from 'next/server';
import { PokemonCard } from '@/lib/types';
import { getCardsByName, mapApiCardToPokemonCard } from '@/lib/pokemonTcgApi';

export async function GET(
  request: Request,
  context: { params: { name: string } }
) {
  const params = await context.params;
  const pokemonName = decodeURIComponent(params.name);

  if (!pokemonName) {
    return NextResponse.json({ error: 'Pokemon name is required' }, { status: 400 });
  }

  console.log(`API Route: Fetching prints for name: ${pokemonName}`);

  try {
    // Use our direct API client to fetch cards by name
    const responseCards = await getCardsByName(pokemonName);

    if (!responseCards || responseCards.length === 0) {
      console.log(`No prints found for ${pokemonName}.`);
      return NextResponse.json({ prints: [] });
    }

    // Map the results with careful error handling
    const prints: PokemonCard[] = [];

    for (const card of responseCards) {
      try {
        if (!card || !card.id) continue; // Skip invalid cards

        // Use our mapping function
        const mappedCard = mapApiCardToPokemonCard(card);
        prints.push(mappedCard);
      } catch (cardError) {
        console.error(`Error processing card ${card?.id || 'unknown'}:`, cardError);
        // Continue processing other cards
      }
    }

    return NextResponse.json({ prints });

  } catch (error) {
    console.error(`Error fetching prints for ${pokemonName}:`, error);
    return NextResponse.json({ prints: [] }); // Return empty array instead of error
  }
}