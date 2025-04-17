/**
 * Download Pokemon TCG card images
 * This script downloads card images for the most recent sets to provide initial caching
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

// Local directories
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const SETS_DIR = path.join(DATA_DIR, 'sets');
const CARDS_DIR = path.join(DATA_DIR, 'cards');
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'cards');

// Number of recent sets to download images for
const RECENT_SETS_COUNT = 5;

// Maximum number of cards per set to download (to keep build time reasonable)
// Set to -1 for all cards
const MAX_CARDS_PER_SET = 20; // Only download the first 20 cards of each set

// Create directories if they don't exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Download an image from a URL
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Skip if the file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`Image already exists: ${outputPath}`);
      resolve();
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
        resolve();
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

    console.log(`Downloading images for the ${RECENT_SETS_COUNT} most recent sets:`);
    recentSets.forEach(set => console.log(`- ${set.name} (${set.id})`));

    let totalImages = 0;
    let totalDownloaded = 0;

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
              .then(() => {
                totalDownloaded++;
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

        console.log(`Downloaded ${totalDownloaded}/${totalImages} images so far...`);

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < cards.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.log(`Image download complete! Downloaded ${totalDownloaded}/${totalImages} images.`);

    // Create a metadata file with download information
    const metadata = {
      downloadedAt: new Date().toISOString(),
      totalSets: recentSets.length,
      totalImages: totalDownloaded,
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

  } catch (error) {
    console.error('Error downloading Pokemon TCG images:', error);
    process.exit(1);
  }
}

// Run the main function
main();
