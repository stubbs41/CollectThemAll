/**
 * Download Pokemon TCG data from GitHub
 * This script downloads all sets and cards data from the Pokemon TCG GitHub repository
 * and saves them to the public/data directory for local access.
 *
 * It uses a caching strategy to avoid downloading data that hasn't changed,
 * which is important for frequent builds.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const crypto = require('crypto');

// GitHub repository information
const GITHUB_REPO = 'PokemonTCG/pokemon-tcg-data';
const GITHUB_BRANCH = 'master';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// Maximum number of sets to download (to keep build time reasonable)
// Set to a smaller number for faster builds, or -1 for all sets
const MAX_SETS = 20; // Only download the 20 most recent sets

// Local directories
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CARDS_DIR = path.join(DATA_DIR, 'cards');
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_MANIFEST_PATH = path.join(CACHE_DIR, 'pokemon-data-manifest.json');

// Cache settings
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true';

// Cache manifest to track what we've downloaded
let cacheManifest = {
  lastUpdated: 0,
  sets: {},
  etags: {}
};

// Create directories if they don't exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Load the cache manifest if it exists
function loadCacheManifest() {
  ensureDirectoryExists(CACHE_DIR);

  if (fs.existsSync(CACHE_MANIFEST_PATH)) {
    try {
      const data = fs.readFileSync(CACHE_MANIFEST_PATH, 'utf8');
      cacheManifest = JSON.parse(data);
      console.log(`Loaded cache manifest. Last updated: ${new Date(cacheManifest.lastUpdated).toISOString()}`);

      // Check if cache is expired
      const now = Date.now();
      const cacheAge = now - cacheManifest.lastUpdated;

      if (cacheAge > CACHE_TTL) {
        console.log(`Cache is expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old). Will refresh data.`);
      } else {
        console.log(`Cache is still valid (${Math.round(cacheAge / (60 * 1000))} minutes old).`);
      }

      return cacheAge <= CACHE_TTL && !FORCE_REFRESH;
    } catch (error) {
      console.warn('Error loading cache manifest:', error.message);
      return false;
    }
  }

  console.log('No cache manifest found. Will download fresh data.');
  return false;
}

// Save the cache manifest
function saveCacheManifest() {
  cacheManifest.lastUpdated = Date.now();

  try {
    fs.writeFileSync(
      CACHE_MANIFEST_PATH,
      JSON.stringify(cacheManifest, null, 2)
    );
    console.log('Saved cache manifest');
  } catch (error) {
    console.warn('Error saving cache manifest:', error.message);
  }
}

// Check if a file needs to be downloaded
function needsDownload(url, outputPath) {
  // If the file doesn't exist, we need to download it
  if (!fs.existsSync(outputPath)) {
    return true;
  }

  // If we have an ETag for this URL and it matches, we can skip the download
  if (cacheManifest.etags[url]) {
    // We'll verify the ETag during the actual download
    return false;
  }

  return true;
}

// Download a file from a URL with ETag support
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Check if we need to download this file
    if (!needsDownload(url, outputPath) && !FORCE_REFRESH) {
      console.log(`Using cached version of ${outputPath}`);
      resolve(false); // Indicate that we used the cache
      return;
    }

    console.log(`Downloading ${url} to ${outputPath}...`);

    // Prepare the request options
    const options = {
      headers: {}
    };

    // If we have an ETag for this URL, add the If-None-Match header
    if (cacheManifest.etags[url]) {
      options.headers['If-None-Match'] = cacheManifest.etags[url];
    }

    const request = https.get(url, options, (response) => {
      // If we get a 304 Not Modified, we can use the cached file
      if (response.statusCode === 304) {
        console.log(`File not modified: ${url}`);
        resolve(false); // Indicate that we used the cache
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      // Store the ETag if we got one
      const etag = response.headers.etag;
      if (etag) {
        cacheManifest.etags[url] = etag;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${url} to ${outputPath}`);
        resolve(true); // Indicate that we downloaded a new file
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there was an error
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });
  });
}

// Download sets data
async function downloadSets() {
  ensureDirectoryExists(SETS_DIR);

  const setsUrl = `${GITHUB_RAW_URL}/sets/en.json`;
  const setsOutputPath = path.join(SETS_DIR, 'sets.json');

  // Try to download the sets data
  const downloaded = await downloadFile(setsUrl, setsOutputPath);

  // Read the sets file to get the list of sets
  const setsData = JSON.parse(fs.readFileSync(setsOutputPath, 'utf8'));

  if (downloaded) {
    console.log(`Downloaded ${setsData.length} sets`);
    // Update the cache manifest with the new sets
    setsData.forEach(set => {
      cacheManifest.sets[set.id] = {
        id: set.id,
        name: set.name,
        releaseDate: set.releaseDate,
        cachedAt: Date.now()
      };
    });
  } else {
    console.log(`Using cached data for ${setsData.length} sets`);
  }

  return setsData;
}

// Download cards data for a set
async function downloadCardsForSet(setId) {
  // The correct URL structure is /cards/en/{setId}.json
  const cardsUrl = `${GITHUB_RAW_URL}/cards/en/${setId}.json`;
  const cardsOutputPath = path.join(CARDS_DIR, `${setId}.json`);

  try {
    // Try to download the cards data
    const downloaded = await downloadFile(cardsUrl, cardsOutputPath);

    // Read the cards file to get the count
    const cardsData = JSON.parse(fs.readFileSync(cardsOutputPath, 'utf8'));

    if (downloaded) {
      console.log(`Downloaded ${cardsData.length} cards for set ${setId}`);
      // Update the cache manifest with the new cards
      if (cacheManifest.sets[setId]) {
        cacheManifest.sets[setId].cardCount = cardsData.length;
        cacheManifest.sets[setId].lastUpdated = Date.now();
      }
    } else {
      console.log(`Using cached data for ${cardsData.length} cards in set ${setId}`);
    }

    return cardsData.length;
  } catch (error) {
    console.error(`Error downloading cards for set ${setId}:`, error.message);
    return 0;
  }
}

// Main function
async function main() {
  console.log('Starting Pokemon TCG data download...');

  ensureDirectoryExists(DATA_DIR);
  ensureDirectoryExists(CARDS_DIR);

  // Check if we can use the cache
  const useCache = loadCacheManifest();

  try {
    // Download sets data
    const allSets = await downloadSets();

    // Sort sets by release date (newest first)
    allSets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

    // Limit the number of sets to download if MAX_SETS is set
    const sets = MAX_SETS > 0 ? allSets.slice(0, MAX_SETS) : allSets;

    console.log(`Will process ${sets.length} sets out of ${allSets.length} total sets`);

    // Download cards data for each set
    let totalCards = 0;
    let totalSets = 0;

    // Process sets in batches to avoid overwhelming the GitHub API
    const BATCH_SIZE = 5;
    for (let i = 0; i < sets.length; i += BATCH_SIZE) {
      const batch = sets.slice(i, i + BATCH_SIZE);

      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sets.length/BATCH_SIZE)}:`);
      batch.forEach(set => {
        const cached = cacheManifest.sets[set.id];
        if (cached && useCache) {
          console.log(`- ${set.name} (${set.id}) [Cached]`);
        } else {
          console.log(`- ${set.name} (${set.id}) [Will download]`);
        }
      });

      // Download cards for each set in the batch in parallel
      const results = await Promise.all(
        batch.map(set => downloadCardsForSet(set.id))
      );

      // Count the total number of cards downloaded
      const batchCards = results.reduce((sum, count) => sum + count, 0);
      totalCards += batchCards;
      totalSets += batch.length;

      console.log(`Completed ${totalSets}/${sets.length} sets, ${totalCards} cards so far`);

      // Save the cache manifest after each batch
      saveCacheManifest();

      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < sets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Process complete! Processed ${totalCards} cards across ${totalSets} sets.`);

    // Create a metadata file with download information
    const metadata = {
      downloadedAt: new Date().toISOString(),
      totalSets,
      totalCards,
      totalAvailableSets: allSets.length,
      limitedDownload: MAX_SETS > 0,
      cacheUsed: useCache,
      cacheAge: useCache ? Math.round((Date.now() - cacheManifest.lastUpdated) / (60 * 1000)) : 0,
      sets: sets.map(set => ({
        id: set.id,
        name: set.name,
        releaseDate: set.releaseDate,
        cached: !!(cacheManifest.sets[set.id] && useCache)
      })),
      // Include information about the most recent set that wasn't downloaded
      // This helps identify when new sets are available
      nextSet: MAX_SETS > 0 && allSets.length > MAX_SETS ? {
        id: allSets[MAX_SETS].id,
        name: allSets[MAX_SETS].name,
        releaseDate: allSets[MAX_SETS].releaseDate
      } : null
    };

    fs.writeFileSync(
      path.join(DATA_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('Created metadata file');

    // Final save of the cache manifest
    saveCacheManifest();

  } catch (error) {
    console.error('Error processing Pokemon TCG data:', error);
    process.exit(1);
  }
}

// Run the main function
main();
