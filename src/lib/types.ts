// Define a type for price data points
export interface PriceData {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow?: number | null; // Optional direct low price
}

// Define a type for prices across different finishes/conditions
export interface CardPrices {
  normal?: PriceData;
  holofoil?: PriceData;
  reverseHolofoil?: PriceData;
  firstEditionNormal?: PriceData;
  firstEditionHolofoil?: PriceData;
  // Add other potential finishes as needed
  [key: string]: PriceData | undefined; // Allow indexing by string for flexibility
}

export interface PokemonCard {
  id: string;
  name: string;
  images: {
    small: string;
    large: string;
  };
  set: {
    id: string;
    name: string;
    series: string;
    images?: {
      symbol?: string;
      logo?: string;
    }
  };
  number: string; // Card number within the set
  rarity?: string; // Add optional rarity field
  types?: string[];
  supertype?: string;
  tcgplayer?: { // Add optional tcgplayer object
    prices?: CardPrices; // Use the nested CardPrices type
    url?: string;
    updatedAt?: string;
  };
  // Add other relevant fields later (rarity, prices, etc.)
} 