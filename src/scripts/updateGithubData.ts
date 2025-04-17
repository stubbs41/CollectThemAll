/**
 * GitHub Data Update Script
 * 
 * This script downloads the latest Pokemon TCG data from the GitHub repository
 * and stores it in the local data directory.
 * 
 * Usage:
 * npm run update-github-data
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

// Download sets data
async function downloadSets() {
  try {
    console.log('Downloading sets data...');
    const sets = await fetchJson(SETS_URL);
    saveJson(path.join(SETS_DIR, 'sets.json'), sets);
    return sets;
  } catch (error) {
    console.error('Error downloading sets data:', error);
    throw error;
  }
}

// Download cards data for a specific set
async function downloadCardsForSet(setId: string) {
  try {
    console.log(`Downloading cards for set ${setId}...`);
    const cards = await fetchJson(`${CARDS_BASE_URL}/${setId}.json`);
    saveJson(path.join(CARDS_DIR, `${setId}.json`), cards);
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
    console.log('Starting GitHub data update...');
    
    // Create directories
    createDirectories();
    
    // Download sets data
    const sets = await downloadSets();
    
    // Download cards data for each set
    console.log(`Downloading cards data for ${sets.length} sets...`);
    
    // Use Promise.all to download all sets in parallel
    await Promise.all(
      sets.map(async (set: any) => {
        await downloadCardsForSet(set.id);
      })
    );
    
    console.log('GitHub data update complete!');
  } catch (error) {
    console.error('Error updating GitHub data:', error);
    process.exit(1);
  }
}

// Run the script
main();
