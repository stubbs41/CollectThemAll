/**
 * Download Pokemon TCG data from GitHub
 * This script downloads all sets and cards data from the Pokemon TCG GitHub repository
 * and saves them to the public/data directory for local access.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

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

/**
 * Ensures that the specified directory exists, creating it recursively if necessary.
 *
 * @param {string} dir - The path of the directory to check or create.
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

/**
 * Downloads a file from the specified URL and saves it to the given local path.
 *
 * @param {string} url - The URL of the file to download.
 * @param {string} outputPath - The local file path where the downloaded file will be saved.
 * @returns {Promise<void>} Resolves when the file has been successfully downloaded and saved.
 *
 * @throws {Error} If the HTTP response status is not 200 or if a network or file system error occurs during download.
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${outputPath}...`);

    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${url} to ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
}

/**
 * Downloads the Pokémon TCG sets metadata from the GitHub repository and saves it locally.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of set metadata objects.
 */
async function downloadSets() {
  ensureDirectoryExists(SETS_DIR);

  const setsUrl = `${GITHUB_RAW_URL}/sets/en.json`;
  const setsOutputPath = path.join(SETS_DIR, 'sets.json');

  await downloadFile(setsUrl, setsOutputPath);

  // Read the sets file to get the list of sets
  const setsData = JSON.parse(fs.readFileSync(setsOutputPath, 'utf8'));
  console.log(`Downloaded ${setsData.length} sets`);

  return setsData;
}

/**
 * Downloads and saves the card data JSON file for a specific set.
 *
 * @param {string} setId - The identifier of the set to download cards for.
 * @returns {Promise<number>} The number of cards downloaded for the set, or 0 if the download fails.
 */
async function downloadCardsForSet(setId) {
  // The correct URL structure is /cards/en/{setId}.json
  const cardsUrl = `${GITHUB_RAW_URL}/cards/en/${setId}.json`;
  const cardsOutputPath = path.join(CARDS_DIR, `${setId}.json`);

  try {
    await downloadFile(cardsUrl, cardsOutputPath);

    // Read the cards file to get the count
    const cardsData = JSON.parse(fs.readFileSync(cardsOutputPath, 'utf8'));
    console.log(`Downloaded ${cardsData.length} cards for set ${setId}`);

    return cardsData.length;
  } catch (error) {
    console.error(`Error downloading cards for set ${setId}:`, error.message);
    return 0;
  }
}

/**
 * Orchestrates the download of Pokémon TCG set and card data from the official GitHub repository, saving it locally and generating a metadata summary.
 *
 * Downloads all available sets metadata, sorts them by release date, and downloads card data for each set in configurable batches to avoid API rate limits. Limits the number of sets downloaded if configured. After completion, writes a metadata file summarizing the download.
 *
 * @remark Exits the process with code 1 if any error occurs during the download or file writing process.
 */
async function main() {
  console.log('Starting Pokemon TCG data download...');

  ensureDirectoryExists(DATA_DIR);
  ensureDirectoryExists(CARDS_DIR);

  try {
    // Download sets data
    const allSets = await downloadSets();

    // Sort sets by release date (newest first)
    allSets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

    // Limit the number of sets to download if MAX_SETS is set
    const sets = MAX_SETS > 0 ? allSets.slice(0, MAX_SETS) : allSets;

    console.log(`Will download ${sets.length} sets out of ${allSets.length} total sets`);

    // Download cards data for each set
    let totalCards = 0;
    let totalSets = 0;

    // Process sets in batches to avoid overwhelming the GitHub API
    const BATCH_SIZE = 5;
    for (let i = 0; i < sets.length; i += BATCH_SIZE) {
      const batch = sets.slice(i, i + BATCH_SIZE);

      console.log(`Downloading batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sets.length/BATCH_SIZE)}:`);
      batch.forEach(set => console.log(`- ${set.name} (${set.id})`))

      // Download cards for each set in the batch in parallel
      const results = await Promise.all(
        batch.map(set => downloadCardsForSet(set.id))
      );

      // Count the total number of cards downloaded
      const batchCards = results.reduce((sum, count) => sum + count, 0);
      totalCards += batchCards;
      totalSets += batch.length;

      console.log(`Completed ${totalSets}/${sets.length} sets, ${totalCards} cards so far`);

      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < sets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Download complete! Downloaded ${totalCards} cards across ${totalSets} sets.`);

    // Create a metadata file with download information
    const metadata = {
      downloadedAt: new Date().toISOString(),
      totalSets,
      totalCards,
      totalAvailableSets: allSets.length,
      limitedDownload: MAX_SETS > 0,
      sets: sets.map(set => ({
        id: set.id,
        name: set.name,
        releaseDate: set.releaseDate
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

  } catch (error) {
    console.error('Error downloading Pokemon TCG data:', error);
    process.exit(1);
  }
}

// Run the main function
main();
