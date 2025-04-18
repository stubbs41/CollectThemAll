/**
 * Download Missing Card Data Script
 * 
 * This script checks for missing card data files in the local data directory
 * and downloads them from the GitHub repository.
 * 
 * Usage:
 * npm run download-missing-card-data
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// GitHub repository raw content URLs
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const SETS_URL = `${GITHUB_RAW_BASE_URL}/sets/en.json`;
const CARDS_BASE_URL = `${GITHUB_RAW_BASE_URL}/cards/en`;

// Local data directory
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CARDS_DIR = path.join(DATA_DIR, 'cards');

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
async function fetchJson(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

// Save JSON data to file
function saveJson(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${filePath}`);
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
    throw error;
  }
}

// Check if a file exists
function fileExists(filePath: string): boolean {
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
    
    throw error;
  }
}

// Download cards data for a specific set if it doesn't exist locally
async function downloadCardsForSetIfMissing(setId: string) {
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
    // Don't throw, just return empty array
    return [];
  }
}

// Main function
async function main() {
  try {
    console.log('Starting missing card data download...');
    
    // Create directories
    createDirectories();
    
    // Download or load sets data
    const sets = await downloadSets();
    
    // Download missing cards data for each set
    console.log(`Checking for missing card data files for ${sets.length} sets...`);
    
    // Use Promise.all to process all sets in parallel
    await Promise.all(
      sets.map(async (set: any) => {
        await downloadCardsForSetIfMissing(set.id);
      })
    );
    
    console.log('Missing card data download complete!');
  } catch (error) {
    console.error('Error downloading missing card data:', error);
    process.exit(1);
  }
}

// Run the script
main();
