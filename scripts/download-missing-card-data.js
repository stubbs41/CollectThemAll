/**
 * Download Missing Card Data Script
 * 
 * This script checks for missing card data files in the local data directory
 * and downloads them from the GitHub repository.
 * 
 * Usage:
 * npm run download-missing-card-data
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// GitHub repository raw content URLs
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const SETS_URL = `${GITHUB_RAW_BASE_URL}/sets/en.json`;
const CARDS_BASE_URL = `${GITHUB_RAW_BASE_URL}/cards/en`;

// Local data directory
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CARDS_DIR = path.join(DATA_DIR, 'cards');

// List of known problematic set IDs that cause 404 errors
const PROBLEMATIC_SETS = [
  'ecard3',
  'base3',
  'swsh10',
  'ex7',
  'base6'
];

// Create directories if they don't exist
function createDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SETS_DIR)) {
    fs.mkdirSync(SETS_DIR, { recursive: true });
  }
  if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
  }
}

// Fetch JSON data from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Error parsing JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching ${url}: ${error.message}`));
    });
  });
}

// Save JSON data to file
function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
    return false;
  }
}

// Check if a file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Download sets data
async function downloadSets() {
  try {
    console.log('Downloading sets data...');
    const sets = await fetchJson(SETS_URL);
    
    // Create sets directory if it doesn't exist
    if (!fs.existsSync(SETS_DIR)) {
      fs.mkdirSync(SETS_DIR, { recursive: true });
    }
    
    // Save sets data
    const setsFilePath = path.join(SETS_DIR, 'sets.json');
    if (!fileExists(setsFilePath)) {
      saveJson(setsFilePath, sets);
      console.log('Sets data downloaded and saved.');
    } else {
      console.log('Sets data file already exists.');
    }
    
    return sets;
  } catch (error) {
    console.error('Error downloading sets data:', error);
    
    // If sets.json exists, try to read it
    const setsFilePath = path.join(SETS_DIR, 'sets.json');
    if (fileExists(setsFilePath)) {
      try {
        const setsData = JSON.parse(fs.readFileSync(setsFilePath, 'utf8'));
        console.log('Using existing sets data file.');
        return setsData;
      } catch (readError) {
        console.error('Error reading existing sets data:', readError);
      }
    }
    
    // Return empty array if all else fails
    return [];
  }
}

// Download cards data for a specific set if it doesn't exist locally
async function downloadCardsForSetIfMissing(setId) {
  const cardFilePath = path.join(CARDS_DIR, `${setId}.json`);
  
  // Check if the file already exists
  if (fileExists(cardFilePath)) {
    console.log(`Cards data for set ${setId} already exists.`);
    return;
  }
  
  try {
    console.log(`Downloading cards for set ${setId}...`);
    const cards = await fetchJson(`${CARDS_BASE_URL}/${setId}.json`);
    saveJson(cardFilePath, cards);
    console.log(`Downloaded ${cards.length} cards for set ${setId}.`);
    return cards;
  } catch (error) {
    console.error(`Error downloading cards for set ${setId}:`, error);
    
    // Create an empty array file to prevent future 404 errors
    saveJson(cardFilePath, []);
    console.log(`Created empty file for set ${setId} to prevent 404 errors.`);
    
    return [];
  }
}

// Main function
async function main() {
  try {
    console.log('Starting missing card data download...');
    
    // Create directories
    createDirectories();
    
    // First, handle the known problematic sets
    console.log(`Checking for known problematic sets: ${PROBLEMATIC_SETS.join(', ')}...`);
    
    for (const setId of PROBLEMATIC_SETS) {
      await downloadCardsForSetIfMissing(setId);
    }
    
    // Download or load sets data
    const sets = await downloadSets();
    
    // Download missing cards data for each set
    console.log(`Checking for missing card data files for ${sets.length} sets...`);
    
    // Process sets in batches to avoid overwhelming the server
    const batchSize = 5;
    const totalSets = sets.length;
    
    for (let i = 0; i < totalSets; i += batchSize) {
      const batch = sets.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalSets/batchSize)}...`);
      
      // Process each set in the batch
      const promises = batch.map(set => downloadCardsForSetIfMissing(set.id));
      await Promise.all(promises);
      
      console.log(`Completed ${Math.min(i + batchSize, totalSets)}/${totalSets} sets.`);
    }
    
    console.log('Missing card data download complete!');
  } catch (error) {
    console.error('Error downloading missing card data:', error);
    process.exit(1);
  }
}

// Run the script
main();
