import { NextResponse } from 'next/server';
import { findCardsByQueries, Card } from 'pokemon-tcg-sdk-typescript/dist/sdk';
import { PokemonCard, CardPrices } from '@/lib/types';

// Reusable helper
function extractPrices(apiCard: Card): CardPrices | undefined {
    if (!apiCard.tcgplayer?.prices) return undefined;
    return apiCard.tcgplayer.prices as CardPrices;
}

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
    const responseCards: Card[] = await findCardsByQueries({
      q: `name:"${pokemonName}"`,
      pageSize: 100,
      orderBy: '-set.releaseDate',
    });

    if (!responseCards || responseCards.length === 0) {
        console.log(`No prints found for ${pokemonName}.`);
      return NextResponse.json({ prints: [] });
    }

    // Map the results
    const prints: PokemonCard[] = responseCards.map((card) => ({
      id: card.id,
      name: card.name,
      images: {
        small: card.images?.small || '',
        large: card.images?.large || ''
      },
      set: {
        id: card.set?.id || '',
        name: card.set?.name || '',
        series: card.set?.series || '',
        images: {
          logo: card.set?.images?.logo,
          symbol: card.set?.images?.symbol
        }
      },
      number: card.number || '',
      rarity: card.rarity,
      tcgplayer: card.tcgplayer ? {
        url: card.tcgplayer.url,
        updatedAt: card.tcgplayer.updatedAt,
        prices: extractPrices(card),
      } : undefined,
    }));

    return NextResponse.json({ prints });

  } catch (error) {
    console.error(`Error fetching prints for ${pokemonName}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 