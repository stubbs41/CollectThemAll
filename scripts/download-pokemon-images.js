/**
 * Download Pokemon TCG card images
 * This script downloads card images for the most recent sets to provide initial caching
 *
 * It uses a caching strategy to avoid downloading images that are already cached,
 * which is important for frequent builds.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const crypto = require('crypto');

// Local directories
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CARDS_DIR = path.join(DATA_DIR, 'cards');
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'cards');
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_MANIFEST_PATH = path.join(CACHE_DIR, 'pokemon-images-manifest.json');

// Number of recent sets to download images for
const RECENT_SETS_COUNT = 5;

// Maximum number of cards per set to download (to keep build time reasonable)
// Set to -1 for all cards
const MAX_CARDS_PER_SET = 20; // Only download the first 20 cards of each set

// Cache settings
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true';

// Cache manifest to track what we've downloaded
let cacheManifest = {
  lastUpdated: 0,
  images: {}
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
      console.log(`Loaded image cache manifest. Last updated: ${new Date(cacheManifest.lastUpdated).toISOString()}`);

      // Check if cache is expired
      const now = Date.now();
      const cacheAge = now - cacheManifest.lastUpdated;

      if (cacheAge > CACHE_TTL) {
        console.log(`Image cache is expired (${Math.round(cacheAge / (60 * 60 * 1000))} hours old). Will refresh images.`);
      } else {
        console.log(`Image cache is still valid (${Math.round(cacheAge / (60 * 1000))} minutes old).`);
      }

      return cacheAge <= CACHE_TTL && !FORCE_REFRESH;
    } catch (error) {
      console.warn('Error loading image cache manifest:', error.message);
      return false;
    }
  }

  console.log('No image cache manifest found. Will download fresh images.');
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
    console.log('Saved image cache manifest');
  } catch (error) {
    console.warn('Error saving image cache manifest:', error.message);
  }
}

// Check if an image is already cached
function isImageCached(url, outputPath) {
  // If the file doesn't exist, it's not cached
  if (!fs.existsSync(outputPath)) {
    return false;
  }

  // If we have a record of this image in the cache manifest, it's cached
  const imageHash = crypto.createHash('md5').update(url).digest('hex');
  if (cacheManifest.images[imageHash]) {
    return true;
  }

  return false;
}

// Download an image from a URL with caching
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Check if the image is already cached
    if (isImageCached(url, outputPath) && !FORCE_REFRESH) {
      console.log(`Using cached image: ${outputPath}`);
      resolve(false); // Indicate that we used the cache
      return;
    }

    console.log(`Downloading image ${url} to ${outputPath}...`);

    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Downloaded image ${url} to ${outputPath}`);

        // Add the image to the cache manifest
        const imageHash = crypto.createHash('md5').update(url).digest('hex');
        cacheManifest.images[imageHash] = {
          url,
          path: outputPath,
          downloadedAt: Date.now()
        };

        resolve(true); // Indicate that we downloaded a new image
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
}

// Main function
async function main() {
  console.log('Starting Pokemon TCG image download...');

  ensureDirectoryExists(IMAGES_DIR);

  // Check if we can use the cache
  const useCache = loadCacheManifest();

  try {
    // Read the sets data
    const setsPath = path.join(SETS_DIR, 'sets.json');
    if (!fs.existsSync(setsPath)) {
      console.error('Sets data not found. Please run download-pokemon-data.js first.');
      process.exit(1);
    }

    const sets = JSON.parse(fs.readFileSync(setsPath, 'utf8'));

    // Sort sets by release date (newest first)
    sets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

    // Get the most recent sets
    const recentSets = sets.slice(0, RECENT_SETS_COUNT);

    console.log(`Processing images for the ${RECENT_SETS_COUNT} most recent sets:`);
    recentSets.forEach(set => console.log(`- ${set.name} (${set.id})`));

    let totalImages = 0;
    let totalDownloaded = 0;
    let totalCached = 0;

    // Process each recent set
    for (const set of recentSets) {
      const setId = set.id;
      const cardsPath = path.join(CARDS_DIR, `${setId}.json`);

      if (!fs.existsSync(cardsPath)) {
        console.warn(`Cards data for set ${setId} not found. Skipping.`);
        continue;
      }

      const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

      // Limit the number of cards if MAX_CARDS_PER_SET is set
      const cardsToProcess = MAX_CARDS_PER_SET > 0 ? cards.slice(0, MAX_CARDS_PER_SET) : cards;

      console.log(`Processing ${cardsToProcess.length} cards for set ${setId} (${set.name})...`);
      if (MAX_CARDS_PER_SET > 0 && cards.length > MAX_CARDS_PER_SET) {
        console.log(`Note: Limited to ${MAX_CARDS_PER_SET} cards out of ${cards.length} total cards`);
      }

      // Create a directory for the set
      const setImagesDir = path.join(IMAGES_DIR, setId);
      ensureDirectoryExists(setImagesDir);

      // Process cards in batches to avoid overwhelming the server
      const BATCH_SIZE = 10;
      for (let i = 0; i < cardsToProcess.length; i += BATCH_SIZE) {
        const batch = cardsToProcess.slice(i, i + BATCH_SIZE);

        // Download images for each card in the batch in parallel
        const promises = batch.map(card => {
          if (card.images && card.images.small) {
            totalImages++;

            // Extract the filename from the URL
            const urlParts = card.images.small.split('/');
            const filename = urlParts[urlParts.length - 1];
            const outputPath = path.join(setImagesDir, filename);

            return downloadImage(card.images.small, outputPath)
              .then((downloaded) => {
                if (downloaded) {
                  totalDownloaded++;
                } else {
                  totalCached++;
                }
                return true;
              })
              .catch(error => {
                console.error(`Error downloading image for card ${card.id}:`, error.message);
                return false;
              });
          }
          return Promise.resolve(false);
        });

        await Promise.all(promises);

        console.log(`Processed ${totalDownloaded + totalCached}/${totalImages} images so far (${totalDownloaded} downloaded, ${totalCached} from cache)...`);

        // Save the cache manifest after each batch
        saveCacheManifest();

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < cardsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.log(`Image processing complete! Processed ${totalDownloaded + totalCached}/${totalImages} images (${totalDownloaded} downloaded, ${totalCached} from cache).`);

    // Create a metadata file with download information
    const metadata = {
      downloadedAt: new Date().toISOString(),
      totalSets: recentSets.length,
      totalImages: totalDownloaded + totalCached,
      newlyDownloaded: totalDownloaded,
      fromCache: totalCached,
      cacheUsed: useCache,
      cacheAge: useCache ? Math.round((Date.now() - cacheManifest.lastUpdated) / (60 * 1000)) : 0,
      sets: recentSets.map(set => ({
        id: set.id,
        name: set.name,
        releaseDate: set.releaseDate
      }))
    };

    fs.writeFileSync(
      path.join(IMAGES_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('Created images metadata file');

    // Final save of the cache manifest
    saveCacheManifest();

  } catch (error) {
    console.error('Error processing Pokemon TCG images:', error);
    process.exit(1);
  }
}

// Run the main function
main();
