/**
 * Enhanced client-side search utilities for Pokemon TCG data
 * 
 * This module provides efficient search functions that use pre-built indexes
 * to quickly find Pokemon cards matching various criteria.
 */

import { PokemonCard } from './types';

// Types for the search indexes
interface NameIndex {
  [prefix: string]: string[]; // Maps name prefixes to card IDs
}

interface SetIndex {
  [setId: string]: string[]; // Maps set IDs to card IDs
}

interface TypeIndex {
  [type: string]: string[]; // Maps types to card IDs
}

interface RarityIndex {
  [rarity: string]: string[]; // Maps rarities to card IDs
}

interface SupertypeIndex {
  [supertype: string]: string[]; // Maps supertypes to card IDs
}

interface CardLookup {
  [cardId: string]: {
    id: string;
    name: string;
    number: string;
    rarity: string;
    types: string[];
    supertype: string;
    subtypes: string[];
    set: {
      id: string;
      name: string;
      series: string;
    };
    searchText: string;
    exactMatches: {
      name: string;
      number: string;
      id: string;
    };
  };
}

interface IndexMetadata {
  createdAt: string;
  totalCards: number;
  totalSets: number;
  indexes: {
    [indexName: string]: {
      entries: number;
      file: string;
    };
  };
}

// Cache for loaded indexes
const indexCache: {
  nameIndex?: NameIndex;
  setIndex?: SetIndex;
  typeIndex?: TypeIndex;
  rarityIndex?: RarityIndex;
  supertypeIndex?: SupertypeIndex;
  cardLookup?: CardLookup;
  metadata?: IndexMetadata;
  loading: {
    [indexName: string]: Promise<any> | null;
  };
} = {
  loading: {}
};

/**
 * Load an index file asynchronously
 */
async function loadIndex<T>(indexName: string): Promise<T> {
  // If we're already loading this index, return the existing promise
  if (indexCache.loading[indexName]) {
    return indexCache.loading[indexName] as Promise<T>;
  }
  
  // If the index is already loaded, return it
  if (indexCache[indexName as keyof typeof indexCache]) {
    return indexCache[indexName as keyof typeof indexCache] as unknown as T;
  }
  
  // Start loading the index
  const loadPromise = fetch(`/data/indexes/${indexName}.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load index ${indexName}: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      // Store the loaded index in the cache
      indexCache[indexName as keyof typeof indexCache] = data as any;
      indexCache.loading[indexName] = null;
      return data as T;
    })
    .catch(error => {
      console.error(`Error loading index ${indexName}:`, error);
      indexCache.loading[indexName] = null;
      // Instead of propagating the error, return an empty object or default structure
      return {} as T;
    });
  
  // Store the loading promise in the cache
  indexCache.loading[indexName] = loadPromise;
  
  return loadPromise;
}

/**
 * Initialize all search indexes (can be called during app startup)
 */
export async function initializeSearchIndexes(): Promise<void> {
  try {
    // Load the metadata first to check if indexes exist
    const metadata = await loadIndex<IndexMetadata>('index-metadata');
    indexCache.metadata = metadata;
    
    // If metadata exists and has properties, log info about it
    if (metadata && metadata.totalCards) {
      console.log(`Loaded search index metadata. ${metadata.totalCards} cards across ${metadata.totalSets} sets.`);
    } else {
      console.log('Search index metadata not found or empty. Using API-based search as fallback.');
      // Initialize empty indexes to prevent further loading attempts
      indexCache.nameIndex = {};
      indexCache.setIndex = {};
      indexCache.typeIndex = {};
      indexCache.rarityIndex = {};
      indexCache.supertypeIndex = {};
      indexCache.cardLookup = {};
      return; // Exit early without trying to load other indexes
    }
    
    // Load all indexes in parallel
    await Promise.all([
      loadIndex<NameIndex>('name-index').then(index => indexCache.nameIndex = index),
      loadIndex<SetIndex>('set-index').then(index => indexCache.setIndex = index),
      loadIndex<TypeIndex>('type-index').then(index => indexCache.typeIndex = index),
      loadIndex<RarityIndex>('rarity-index').then(index => indexCache.rarityIndex = index),
      loadIndex<SupertypeIndex>('supertype-index').then(index => indexCache.supertypeIndex = index),
      loadIndex<CardLookup>('card-lookup').then(index => indexCache.cardLookup = index)
    ]);
    
    console.log('All search indexes loaded successfully.');
  } catch (error) {
    console.error('Failed to initialize search indexes:', error);
    // Set up empty indexes as fallback
    indexCache.nameIndex = {};
    indexCache.setIndex = {};
    indexCache.typeIndex = {};
    indexCache.rarityIndex = {};
    indexCache.supertypeIndex = {};
    indexCache.cardLookup = {};
    // Don't propagate the error as we're using empty indexes as fallback
  }
}

/**
 * Search for cards by name prefix
 */
export async function searchCardsByName(
  query: string,
  page: number = 1,
  limit: number = 32
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number }> {
  if (!query || query.length < 2) {
    return { cards: [], totalCount: 0, totalPages: 0 };
  }
  
  try {
    // Load the required indexes
    const [nameIndex, cardLookup] = await Promise.all([
      indexCache.nameIndex || loadIndex<NameIndex>('name-index'),
      indexCache.cardLookup || loadIndex<CardLookup>('card-lookup')
    ]);
    
    // Normalize the query
    const normalizedQuery = query.trim().toLowerCase();
    
    // Find matching card IDs
    let matchingCardIds: string[] = [];
    
    // Try exact match first
    if (nameIndex[normalizedQuery]) {
      matchingCardIds = nameIndex[normalizedQuery];
    } else {
      // Try prefix match
      for (const prefix in nameIndex) {
        if (prefix.startsWith(normalizedQuery) || normalizedQuery.startsWith(prefix)) {
          matchingCardIds = [...matchingCardIds, ...nameIndex[prefix]];
        }
      }
      
      // Remove duplicates
      matchingCardIds = [...new Set(matchingCardIds)];
    }
    
    // Calculate pagination
    const totalCount = matchingCardIds.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalCount);
    
    // Get the cards for the current page
    const pagedCardIds = matchingCardIds.slice(startIndex, endIndex);
    
    // Map card IDs to full card objects
    const cards: PokemonCard[] = [];
    
    for (const cardId of pagedCardIds) {
      const cardData = cardLookup[cardId];
      if (cardData) {
        // Convert to PokemonCard type (simplified version)
        // In a real implementation, you'd need to fetch the full card data
        cards.push({
          id: cardData.id,
          name: cardData.name,
          number: cardData.number,
          rarity: cardData.rarity,
          types: cardData.types,
          supertype: cardData.supertype,
          set: {
            id: cardData.set.id,
            name: cardData.set.name,
            series: cardData.set.series,
            images: { symbol: '', logo: '' }
          },
          // These fields would typically come from the full card data
          images: { small: '', large: '' },
        } as PokemonCard);
      }
    }
    
    return { cards, totalCount, totalPages };
  } catch (error) {
    console.error('Error searching cards by name:', error);
    throw error;
  }
}

/**
 * Search for cards with advanced filtering
 */
export async function searchCards(
  options: {
    name?: string;
    setId?: string;
    types?: string[];
    rarity?: string;
    supertype?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number }> {
  const { 
    name, 
    setId, 
    types, 
    rarity, 
    supertype,
    page = 1, 
    limit = 32 
  } = options;
  
  try {
    // Load the card lookup index and any other required indexes
    const loadPromises: Promise<any>[] = [
      indexCache.cardLookup || loadIndex<CardLookup>('card-lookup')
    ];
    
    if (name) {
      loadPromises.push(indexCache.nameIndex || loadIndex<NameIndex>('name-index'));
    }
    
    if (setId) {
      loadPromises.push(indexCache.setIndex || loadIndex<SetIndex>('set-index'));
    }
    
    if (types && types.length > 0) {
      loadPromises.push(indexCache.typeIndex || loadIndex<TypeIndex>('type-index'));
    }
    
    if (rarity) {
      loadPromises.push(indexCache.rarityIndex || loadIndex<RarityIndex>('rarity-index'));
    }
    
    if (supertype) {
      loadPromises.push(indexCache.supertypeIndex || loadIndex<SupertypeIndex>('supertype-index'));
    }
    
    await Promise.all(loadPromises);
    
    // Get card IDs for each filter
    let cardIdSets: Set<string>[] = [];
    
    // Name filter
    if (name && name.length >= 2) {
      const normalizedName = name.trim().toLowerCase();
      let nameMatchIds: string[] = [];
      
      if (indexCache.nameIndex![normalizedName]) {
        nameMatchIds = indexCache.nameIndex![normalizedName];
      } else {
        // Find closest matches
        for (const prefix in indexCache.nameIndex!) {
          if (prefix.startsWith(normalizedName) || normalizedName.startsWith(prefix)) {
            nameMatchIds = [...nameMatchIds, ...indexCache.nameIndex![prefix]];
          }
        }
      }
      
      cardIdSets.push(new Set(nameMatchIds));
    }
    
    // Set filter
    if (setId) {
      const setMatchIds = indexCache.setIndex![setId.toLowerCase()] || [];
      cardIdSets.push(new Set(setMatchIds));
    }
    
    // Type filter
    if (types && types.length > 0) {
      const typeMatchIds: string[] = [];
      
      for (const type of types) {
        const typeKey = type.toLowerCase();
        if (indexCache.typeIndex![typeKey]) {
          typeMatchIds.push(...indexCache.typeIndex![typeKey]);
        }
      }
      
      cardIdSets.push(new Set(typeMatchIds));
    }
    
    // Rarity filter
    if (rarity) {
      const rarityMatchIds = indexCache.rarityIndex![rarity.toLowerCase()] || [];
      cardIdSets.push(new Set(rarityMatchIds));
    }
    
    // Supertype filter
    if (supertype) {
      const supertypeMatchIds = indexCache.supertypeIndex![supertype.toLowerCase()] || [];
      cardIdSets.push(new Set(supertypeMatchIds));
    }
    
    // If no filters were applied, return empty results
    if (cardIdSets.length === 0) {
      return { cards: [], totalCount: 0, totalPages: 0 };
    }
    
    // Intersect all filter results to get the final set of matching card IDs
    let matchingCardIds: string[] = [];
    
    if (cardIdSets.length === 1) {
      // Only one filter was applied
      matchingCardIds = Array.from(cardIdSets[0]);
    } else {
      // Multiple filters were applied, find the intersection
      let intersection = cardIdSets[0];
      
      for (let i = 1; i < cardIdSets.length; i++) {
        const currentSet = cardIdSets[i];
        intersection = new Set(
          Array.from(intersection).filter(id => currentSet.has(id))
        );
      }
      
      matchingCardIds = Array.from(intersection);
    }
    
    // Calculate pagination
    const totalCount = matchingCardIds.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalCount);
    
    // Get the cards for the current page
    const pagedCardIds = matchingCardIds.slice(startIndex, endIndex);
    
    // Map card IDs to full card objects
    const cards: PokemonCard[] = [];
    
    for (const cardId of pagedCardIds) {
      const cardData = indexCache.cardLookup![cardId];
      if (cardData) {
        // Convert to PokemonCard type (simplified version)
        cards.push({
          id: cardData.id,
          name: cardData.name,
          number: cardData.number,
          rarity: cardData.rarity,
          types: cardData.types,
          supertype: cardData.supertype,
          set: {
            id: cardData.set.id,
            name: cardData.set.name,
            series: cardData.set.series,
            images: { symbol: '', logo: '' }
          },
          // These fields would typically come from the full card data
          images: { small: '', large: '' },
        } as PokemonCard);
      }
    }
    
    return { cards, totalCount, totalPages };
  } catch (error) {
    console.error('Error searching cards with filters:', error);
    throw error;
  }
}

/**
 * Get a card by ID
 */
export async function getCardById(cardId: string): Promise<PokemonCard | null> {
  if (!cardId) {
    return null;
  }
  
  try {
    // Load the card lookup index
    const cardLookup = indexCache.cardLookup || await loadIndex<CardLookup>('card-lookup');
    
    // Look up the card
    const cardData = cardLookup[cardId];
    if (!cardData) {
      return null;
    }
    
    // Convert to PokemonCard type (simplified version)
    // In a real implementation, you'd need to fetch the full card data
    return {
      id: cardData.id,
      name: cardData.name,
      number: cardData.number,
      rarity: cardData.rarity,
      types: cardData.types,
      supertype: cardData.supertype,
      set: {
        id: cardData.set.id,
        name: cardData.set.name,
        series: cardData.set.series,
        images: { symbol: '', logo: '' }
      },
      // These fields would typically come from the full card data
      images: { small: '', large: '' },
    } as PokemonCard;
  } catch (error) {
    console.error(`Error getting card with ID ${cardId}:`, error);
    throw error;
  }
}

/**
 * Get all cards for a set
 */
export async function getCardsBySetId(
  setId: string,
  page: number = 1,
  limit: number = 32
): Promise<{ cards: PokemonCard[], totalCount: number, totalPages: number }> {
  if (!setId) {
    return { cards: [], totalCount: 0, totalPages: 0 };
  }
  
  try {
    // Load the required indexes
    const [setIndex, cardLookup] = await Promise.all([
      indexCache.setIndex || loadIndex<SetIndex>('set-index'),
      indexCache.cardLookup || loadIndex<CardLookup>('card-lookup')
    ]);
    
    // Get the card IDs for the set
    const cardIds = setIndex[setId.toLowerCase()] || [];
    
    // Calculate pagination
    const totalCount = cardIds.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalCount);
    
    // Get the cards for the current page
    const pagedCardIds = cardIds.slice(startIndex, endIndex);
    
    // Map card IDs to full card objects
    const cards: PokemonCard[] = [];
    
    for (const cardId of pagedCardIds) {
      const cardData = cardLookup[cardId];
      if (cardData) {
        // Convert to PokemonCard type (simplified version)
        cards.push({
          id: cardData.id,
          name: cardData.name,
          number: cardData.number,
          rarity: cardData.rarity,
          types: cardData.types,
          supertype: cardData.supertype,
          set: {
            id: cardData.set.id,
            name: cardData.set.name,
            series: cardData.set.series,
            images: { symbol: '', logo: '' }
          },
          // These fields would typically come from the full card data
          images: { small: '', large: '' },
        } as PokemonCard);
      }
    }
    
    return { cards, totalCount, totalPages };
  } catch (error) {
    console.error(`Error getting cards for set ${setId}:`, error);
    throw error;
  }
}