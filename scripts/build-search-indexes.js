/**
 * Pokemon TCG Search Index Builder
 * 
 * This script builds optimized search indexes from the downloaded Pokemon TCG data.
 * It creates multiple indexes to make client-side searching fast and efficient:
 * 
 * 1. Name-based index for quick text searches
 * 2. Set-based index for filtering by set
 * 3. Type-based index for filtering by type
 * 4. Rarity-based index for filtering by rarity
 * 5. Combined search index for advanced queries
 * 
 * The indexes are stored in the public/data/indexes directory.
 */

import fs from 'fs';
import path from 'path';

// Directory paths
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const CARDS_DIR = path.join(DATA_DIR, 'cards');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const INDEXES_DIR = path.join(DATA_DIR, 'indexes');

// Ensure directories exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Load all sets
function loadSets() {
  const setsPath = path.join(SETS_DIR, 'sets.json');
  if (!fs.existsSync(setsPath)) {
    throw new Error(`Sets data not found at ${setsPath}. Run download-pokemon-data.js first.`);
  }
  
  const setsData = JSON.parse(fs.readFileSync(setsPath, 'utf8'));
  return setsData;
}

// Load cards for a specific set
function loadCardsForSet(setId) {
  const cardsPath = path.join(CARDS_DIR, `${setId}.json`);
  if (!fs.existsSync(cardsPath)) {
    console.warn(`Cards data not found for set ${setId}`);
    return [];
  }
  
  try {
    const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
    return cardsData;
  } catch (error) {
    console.error(`Error loading cards for set ${setId}:`, error.message);
    return [];
  }
}

// Load all cards from all sets
async function loadAllCards(sets) {
  let allCards = [];
  
  for (const set of sets) {
    const cards = loadCardsForSet(set.id);
    allCards = allCards.concat(cards);
  }
  
  return allCards;
}

// Create a search-friendly representation of a card
function createSearchCard(card, set) {
  // Extract only the fields we need for searching
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity || 'Unknown',
    types: card.types || [],
    supertype: card.supertype || 'Unknown',
    subtypes: card.subtypes || [],
    set: {
      id: set.id,
      name: set.name,
      series: set.series
    },
    // Create a searchable text field combining multiple properties
    searchText: [
      card.name,
      card.id,
      card.number,
      card.rarity,
      ...(card.types || []),
      card.supertype,
      ...(card.subtypes || []),
      set.name,
      set.series
    ].filter(Boolean).join(' ').toLowerCase(),
    // Include additional text for exact matching
    exactMatches: {
      name: card.name.toLowerCase(),
      number: card.number,
      id: card.id.toLowerCase()
    }
  };
}

// Build a name-based index for quick text searches
function buildNameIndex(cards) {
  console.log('Building name-based search index...');
  
  // Create a map of name prefixes to card IDs
  const prefixMap = {};
  
  cards.forEach(card => {
    if (!card.name) return;
    
    const name = card.name.toLowerCase();
    
    // Add full name
    if (!prefixMap[name]) {
      prefixMap[name] = [];
    }
    prefixMap[name].push(card.id);
    
    // Add name prefixes (for autocomplete)
    // For each prefix length from 2 to the full name length
    for (let i = 2; i < name.length; i++) {
      const prefix = name.substring(0, i);
      if (!prefixMap[prefix]) {
        prefixMap[prefix] = [];
      }
      // Limit to 100 cards per prefix to keep the index size reasonable
      if (prefixMap[prefix].length < 100) {
        prefixMap[prefix].push(card.id);
      }
    }
    
    // Add individual words from the name
    const words = name.split(/\s+/);
    words.forEach(word => {
      if (word.length < 2) return;
      
      if (!prefixMap[word]) {
        prefixMap[word] = [];
      }
      prefixMap[word].push(card.id);
      
      // Add word prefixes
      for (let i = 2; i < word.length; i++) {
        const prefix = word.substring(0, i);
        if (!prefixMap[prefix]) {
          prefixMap[prefix] = [];
        }
        // Limit to 100 cards per prefix
        if (prefixMap[prefix].length < 100) {
          prefixMap[prefix].push(card.id);
        }
      }
    });
  });
  
  console.log(`Created name index with ${Object.keys(prefixMap).length} prefixes`);
  return prefixMap;
}

// Build a set-based index for filtering by set
function buildSetIndex(cards) {
  console.log('Building set-based index...');
  
  const setMap = {};
  
  cards.forEach(card => {
    if (!card.set || !card.set.id) return;
    
    const setId = card.set.id;
    if (!setMap[setId]) {
      setMap[setId] = [];
    }
    setMap[setId].push(card.id);
  });
  
  console.log(`Created set index with ${Object.keys(setMap).length} sets`);
  return setMap;
}

// Build a type-based index for filtering by type
function buildTypeIndex(cards) {
  console.log('Building type-based index...');
  
  const typeMap = {};
  
  cards.forEach(card => {
    if (!card.types || !Array.isArray(card.types)) return;
    
    card.types.forEach(type => {
      if (!type) return;
      
      const typeKey = type.toLowerCase();
      if (!typeMap[typeKey]) {
        typeMap[typeKey] = [];
      }
      typeMap[typeKey].push(card.id);
    });
  });
  
  console.log(`Created type index with ${Object.keys(typeMap).length} types`);
  return typeMap;
}

// Build a rarity-based index for filtering by rarity
function buildRarityIndex(cards) {
  console.log('Building rarity-based index...');
  
  const rarityMap = {};
  
  cards.forEach(card => {
    if (!card.rarity) return;
    
    const rarityKey = card.rarity.toLowerCase();
    if (!rarityMap[rarityKey]) {
      rarityMap[rarityKey] = [];
    }
    rarityMap[rarityKey].push(card.id);
  });
  
  console.log(`Created rarity index with ${Object.keys(rarityMap).length} rarities`);
  return rarityMap;
}

// Build a supertype-based index for filtering by supertype
function buildSupertypeIndex(cards) {
  console.log('Building supertype-based index...');
  
  const supertypeMap = {};
  
  cards.forEach(card => {
    if (!card.supertype) return;
    
    const supertypeKey = card.supertype.toLowerCase();
    if (!supertypeMap[supertypeKey]) {
      supertypeMap[supertypeKey] = [];
    }
    supertypeMap[supertypeKey].push(card.id);
  });
  
  console.log(`Created supertype index with ${Object.keys(supertypeMap).length} supertypes`);
  return supertypeMap;
}

// Main function
async function main() {
  console.log('Starting Pokemon TCG search index builder...');
  
  ensureDirectoryExists(INDEXES_DIR);
  
  try {
    // Load all sets
    const sets = loadSets();
    console.log(`Loaded ${sets.length} sets`);
    
    // Create a map of set IDs to set objects for quick lookup
    const setMap = sets.reduce((map, set) => {
      map[set.id] = set;
      return map;
    }, {});
    
    // Load all cards
    console.log('Loading all cards...');
    const rawCards = await loadAllCards(sets);
    console.log(`Loaded ${rawCards.length} cards total`);
    
    // De-duplicate cards by ID
    const seenIds = new Set();
    const dedupedRawCards = [];
    const duplicateIds = new Set();
    for (const card of rawCards) {
      if (seenIds.has(card.id)) {
        duplicateIds.add(card.id);
        continue; // Skip duplicate
      }
      seenIds.add(card.id);
      dedupedRawCards.push(card);
    }
    if (duplicateIds.size > 0) {
      console.warn(`WARNING: Found ${duplicateIds.size} duplicate card IDs. These will be skipped.`);
      console.warn('Duplicate IDs:', Array.from(duplicateIds).join(', '));
    }
    console.log(`After de-duplication: ${dedupedRawCards.length} unique cards remain.`);
    
    // Create search-friendly card representations
    console.log('Creating search-friendly card representations...');
    const searchCards = dedupedRawCards.map(card => {
      const set = setMap[card.set?.id] || { id: card.set?.id || 'unknown', name: 'Unknown Set', series: 'Unknown Series' };
      return createSearchCard(card, set);
    });
    
    // Build the search card lookup
    console.log('Building card lookup table...');
    const cardLookup = {};
    searchCards.forEach(card => {
      cardLookup[card.id] = card;
    });
    
    // Write the card lookup to disk
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'card-lookup.json'),
      JSON.stringify(cardLookup)
    );
    console.log(`Created card lookup with ${Object.keys(cardLookup).length} cards`);
    
    // Build the specialized indexes
    const nameIndex = buildNameIndex(searchCards);
    const setIndex = buildSetIndex(searchCards);
    const typeIndex = buildTypeIndex(searchCards);
    const rarityIndex = buildRarityIndex(searchCards);
    const supertypeIndex = buildSupertypeIndex(searchCards);
    
    // Write the indexes to disk
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'name-index.json'),
      JSON.stringify(nameIndex)
    );
    
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'set-index.json'),
      JSON.stringify(setIndex)
    );
    
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'type-index.json'),
      JSON.stringify(typeIndex)
    );
    
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'rarity-index.json'),
      JSON.stringify(rarityIndex)
    );
    
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'supertype-index.json'),
      JSON.stringify(supertypeIndex)
    );
    
    // Create metadata about the indexes
    const indexMetadata = {
      createdAt: new Date().toISOString(),
      totalCards: searchCards.length,
      totalSets: sets.length,
      indexes: {
        name: {
          entries: Object.keys(nameIndex).length,
          file: 'name-index.json'
        },
        set: {
          entries: Object.keys(setIndex).length,
          file: 'set-index.json'
        },
        type: {
          entries: Object.keys(typeIndex).length,
          file: 'type-index.json'
        },
        rarity: {
          entries: Object.keys(rarityIndex).length,
          file: 'rarity-index.json'
        },
        supertype: {
          entries: Object.keys(supertypeIndex).length,
          file: 'supertype-index.json'
        },
        cardLookup: {
          entries: Object.keys(cardLookup).length,
          file: 'card-lookup.json'
        }
      }
    };
    
    fs.writeFileSync(
      path.join(INDEXES_DIR, 'index-metadata.json'),
      JSON.stringify(indexMetadata, null, 2)
    );
    
    console.log('Search index building complete!');
    console.log(`Created ${Object.keys(indexMetadata.indexes).length} indexes with metadata`);
    
  } catch (error) {
    console.error('Error building search indexes:', error);
    process.exit(1);
  }
}

// Run the main function
main();