/**
 * GitHub Data Manager
 *
 * This module handles fetching, storing, and accessing Pokemon TCG data
 * from the GitHub repository: https://github.com/PokemonTCG/pokemon-tcg-data
 */

import { PokemonCard, CardSet } from '@/lib/types';
import { getWithExpiry, setWithExpiry, CACHE_TIMES, CACHE_KEYS, createCacheKey } from '@/lib/cacheUtils';

// Local data paths
const LOCAL_DATA_BASE_URL = '/data';
const SETS_URL = `${LOCAL_DATA_BASE_URL}/sets/sets.json`;
const CARDS_BASE_URL = `${LOCAL_DATA_BASE_URL}/cards`;

// Flag to track if we're using local data or GitHub
export let usingLocalData = false;

// GitHub repository raw content URLs (fallback)
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const GITHUB_SETS_URL = `${GITHUB_RAW_BASE_URL}/sets/en.json`;
const GITHUB_CARDS_BASE_URL = `${GITHUB_RAW_BASE_URL}/cards/en`;

// Local storage keys
const LOCAL_STORAGE_KEYS = {
  SETS_DATA: 'pokemon_tcg_sets_data',
  CARDS_DATA_PREFIX: 'pokemon_tcg_cards_',
  LAST_UPDATE: 'pokemon_tcg_last_update',
};

// Check for updates every 24 hours
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Fetches the sets data from local data or GitHub
 */
export async function fetchSetsData(): Promise<any[]> {
  try {
    // Try to fetch from local data first
    console.log('Fetching sets data from local data...');
    try {
      const response = await fetch(SETS_URL);

      if (response.ok) {
        const data = await response.json();
        console.log(`Loaded ${data.length} sets from local data`);
        usingLocalData = true;
        return data;
      }
    } catch (localError) {
      console.warn('Error fetching sets data from local data:', localError);
      // Continue to GitHub fallback
    }

    usingLocalData = false;

    // Fallback to GitHub
    console.log('Fetching sets data from GitHub...');
    const response = await fetch(GITHUB_SETS_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch sets data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Loaded ${data.length} sets from GitHub`);
    return data;
  } catch (error) {
    console.error('Error fetching sets data:', error);
    throw error;
  }
}

/**
 * Fetches cards data for a specific set from local data or GitHub
 */
export async function fetchCardsForSet(setId: string): Promise<any[]> {
  try {
    // Try to fetch from local data first
    console.log(`Fetching cards data for set ${setId} from local data...`);
    try {
      const response = await fetch(`${CARDS_BASE_URL}/${setId}.json`);

      if (response.ok) {
        const data = await response.json();
        console.log(`Loaded ${data.length} cards for set ${setId} from local data`);
        usingLocalData = true;
        return data;
      }
    } catch (localError) {
      console.warn(`Error fetching cards for set ${setId} from local data:`, localError);
      // Continue to GitHub fallback
    }

    usingLocalData = false;

    // Fallback to GitHub
    console.log(`Fetching cards data for set ${setId} from GitHub...`);
    const response = await fetch(`${GITHUB_CARDS_BASE_URL}/${setId}.json`);

    if (!response.ok) {
      throw new Error(`Failed to fetch cards for set ${setId}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Loaded ${data.length} cards for set ${setId} from GitHub`);
    return data;
  } catch (error) {
    console.error(`Error fetching cards for set ${setId}:`, error);
    throw error;
  }
}

/**
 * Stores sets data in local storage
 */
export function storeSetsData(data: any[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SETS_DATA, JSON.stringify(data));
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
    console.log('Sets data stored in local storage');
  } catch (error) {
    console.error('Error storing sets data:', error);
  }
}

/**
 * Stores cards data for a specific set in local storage
 */
export function storeCardsForSet(setId: string, data: any[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEYS.CARDS_DATA_PREFIX}${setId}`, JSON.stringify(data));
    console.log(`Cards data for set ${setId} stored in local storage`);
  } catch (error) {
    console.error(`Error storing cards data for set ${setId}:`, error);
  }
}

/**
 * Gets sets data from local storage
 */
export function getSetsDataFromStorage(): any[] | null {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SETS_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting sets data from storage:', error);
    return null;
  }
}

/**
 * Gets cards data for a specific set from local storage
 */
export function getCardsForSetFromStorage(setId: string): any[] | null {
  try {
    const data = localStorage.getItem(`${LOCAL_STORAGE_KEYS.CARDS_DATA_PREFIX}${setId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting cards data for set ${setId} from storage:`, error);
    return null;
  }
}

/**
 * Checks if data needs to be updated
 */
export function needsUpdate(): boolean {
  try {
    const lastUpdate = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_UPDATE);
    if (!lastUpdate) return true;

    const lastUpdateTime = parseInt(lastUpdate, 10);
    const currentTime = Date.now();

    return currentTime - lastUpdateTime > UPDATE_INTERVAL;
  } catch (error) {
    console.error('Error checking if data needs update:', error);
    return true;
  }
}

/**
 * Initializes the data by fetching from GitHub if needed
 */
export async function initializeData(): Promise<void> {
  try {
    // Check if we need to update the data
    if (needsUpdate() || !getSetsDataFromStorage()) {
      const setsData = await fetchSetsData();
      storeSetsData(setsData);
    }
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

/**
 * Gets all sets from local storage or fetches them if needed
 */
export async function getAllSets(): Promise<any[]> {
  try {
    // Try to get from local storage first
    let setsData = getSetsDataFromStorage();

    // If not in storage, fetch from GitHub
    if (!setsData) {
      setsData = await fetchSetsData();
      storeSetsData(setsData);
    }

    return setsData;
  } catch (error) {
    console.error('Error getting all sets:', error);
    throw error;
  }
}

/**
 * Gets a specific set by ID
 */
export async function getSetById(setId: string): Promise<any | null> {
  try {
    const allSets = await getAllSets();
    return allSets.find(set => set.id === setId) || null;
  } catch (error) {
    console.error(`Error getting set ${setId}:`, error);
    return null;
  }
}

/**
 * Gets all cards for a specific set
 */
export async function getCardsForSet(setId: string): Promise<any[]> {
  try {
    // Try to get from local storage first
    let cardsData = getCardsForSetFromStorage(setId);

    // If not in storage, fetch from GitHub
    if (!cardsData) {
      cardsData = await fetchCardsForSet(setId);
      storeCardsForSet(setId, cardsData);
    }

    return cardsData;
  } catch (error) {
    console.error(`Error getting cards for set ${setId}:`, error);
    throw error;
  }
}

/**
 * Gets a specific card by ID
 */
export async function getCardById(cardId: string): Promise<any | null> {
  try {
    // Extract the set ID from the card ID (format: setId-number)
    const setId = cardId.split('-')[0];

    // Get all cards for the set
    const cardsData = await getCardsForSet(setId);

    // Find the specific card
    return cardsData.find(card => card.id === cardId) || null;
  } catch (error) {
    console.error(`Error getting card ${cardId}:`, error);
    return null;
  }
}

/**
 * Searches for cards by name
 */
export async function searchCardsByName(name: string): Promise<any[]> {
  try {
    // Get all sets
    const allSets = await getAllSets();

    // Initialize results array
    let results: any[] = [];

    // Search through each set
    for (const set of allSets) {
      try {
        const cardsInSet = await getCardsForSet(set.id);

        // Filter cards by name
        const matchingCards = cardsInSet.filter(card =>
          card.name.toLowerCase().includes(name.toLowerCase())
        );

        results = [...results, ...matchingCards];
      } catch (error) {
        console.warn(`Error searching in set ${set.id}:`, error);
        // Continue with other sets
      }
    }

    return results;
  } catch (error) {
    console.error(`Error searching cards by name ${name}:`, error);
    throw error;
  }
}

/**
 * Returns whether we're using local data or GitHub
 */
export function isUsingLocalData(): boolean {
  return usingLocalData;
}

/**
 * Maps a GitHub card to our PokemonCard type
 */
export function mapGithubCardToPokemonCard(githubCard: any, setData?: any): PokemonCard {
  if (!githubCard) throw new Error('Cannot map null or undefined card');

  // If set data wasn't provided, create a minimal set object
  const set = setData || {
    id: githubCard.id.split('-')[0],
    name: 'Unknown Set',
    series: '',
    images: {
      logo: '',
      symbol: ''
    }
  };

  return {
    id: githubCard.id,
    name: githubCard.name || 'Unknown Card',
    images: {
      small: githubCard.images?.small || '',
      large: githubCard.images?.large || ''
    },
    set: {
      id: set.id,
      name: set.name,
      series: set.series,
      images: {
        logo: set.images?.logo,
        symbol: set.images?.symbol
      }
    },
    number: githubCard.number || '',
    rarity: githubCard.rarity,
    types: githubCard.types,
    supertype: githubCard.supertype,
    // Note: tcgplayer pricing data is not available in GitHub data
    // This will be filled in from the API when needed
    tcgplayer: undefined,
  };
}

/**
 * Maps a GitHub set to our CardSet type
 */
export function mapGithubSetToCardSet(githubSet: any): CardSet {
  return {
    id: githubSet.id,
    name: githubSet.name,
    series: githubSet.series,
    printedTotal: githubSet.printedTotal,
    total: githubSet.total,
    releaseDate: githubSet.releaseDate,
    images: {
      symbol: githubSet.images?.symbol,
      logo: githubSet.images?.logo
    }
  };
}
