import { PokemonCard, CardPrices } from './types';

// Helper function to map API response
export function mapApiCardToPokemonCard(apiCard: any): PokemonCard {
  // Safely extract prices
  const extractPrices = (card: any): CardPrices | undefined => {
    return card.tcgplayer?.prices as CardPrices | undefined;
  };

  return {
    id: apiCard.id,
    name: apiCard.name,
    images: {
      small: apiCard.images?.small || '',
      large: apiCard.images?.large || ''
    },
    set: {
      id: apiCard.set?.id || '',
      name: apiCard.set?.name || '',
      series: apiCard.set?.series || '',
      images: {
        logo: apiCard.set?.images?.logo,
        symbol: apiCard.set?.images?.symbol
      }
    },
    number: apiCard.number || '',
    rarity: apiCard.rarity,
    types: apiCard.types,
    supertype: apiCard.supertype,
    tcgplayer: apiCard.tcgplayer ? {
      url: apiCard.tcgplayer.url,
      updatedAt: apiCard.tcgplayer.updatedAt,
      prices: extractPrices(apiCard),
    } : undefined,
  };
}
