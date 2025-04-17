# PokeBinder GitHub Data Integration

This document explains how the PokeBinder application uses data from the [Pokemon TCG Data GitHub repository](https://github.com/PokemonTCG/pokemon-tcg-data) to reduce API calls and improve performance.

## Overview

The PokeBinder application now uses the following data sources in order of priority:

1. **Local GitHub Data**: JSON files downloaded from the Pokemon TCG Data GitHub repository
2. **Live GitHub Data**: Direct access to the GitHub repository if local files are not available
3. **Pokemon TCG API**: Fallback for when data is not available from GitHub sources

## Benefits

- **Reduced API Calls**: Minimizes the number of API calls to the Pokemon TCG API
- **Faster Performance**: Local data access is much faster than API calls
- **Offline Capability**: Basic card data is available even without an internet connection
- **Complete Data**: All card data is available, including sets that might be missing from the API
- **Up-to-date Pricing**: Still fetches live pricing data from the API when needed

## How It Works

### Data Sources

1. **Local Data Files**:
   - Located in `/public/data/`
   - Sets data: `/public/data/sets/sets.json`
   - Cards data: `/public/data/cards/{setId}.json`

2. **GitHub Repository**:
   - URL: https://github.com/PokemonTCG/pokemon-tcg-data
   - Raw content: https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/

3. **Pokemon TCG API**:
   - URL: https://api.pokemontcg.io/v2/
   - Used for pricing data and as a fallback

### Data Flow

1. When the application needs card data, it first checks the local data files
2. If local data is not available, it tries to fetch from the GitHub repository
3. If GitHub data is not available, it falls back to the Pokemon TCG API
4. For pricing data, it always uses the Pokemon TCG API to ensure up-to-date prices

### Image Caching

The application now caches card images locally using IndexedDB:

1. When an image is requested, it first checks the local cache
2. If the image is not in the cache, it downloads and stores it
3. Subsequent requests for the same image use the cached version
4. The cache has a size limit and automatically removes old images when full

## Updating the Data

To update the local data files from the GitHub repository:

```bash
npm run update-github-data
```

This script:
1. Downloads the latest sets data from GitHub
2. Downloads the cards data for each set
3. Saves the data to the local data directory

## Implementation Details

### Key Files

- `src/lib/githubDataManager.ts`: Manages access to GitHub data
- `src/lib/imageCache.ts`: Handles image caching
- `src/components/CachedImage.tsx`: React component for displaying cached images
- `src/scripts/updateGithubData.ts`: Script to update local data files

### API Changes

- `src/lib/pokemonApi.ts`: Updated to use GitHub data first, then fall back to the API
- `src/app/api/card-pricing/route.ts`: New API endpoint for fetching just pricing data

## Future Improvements

- Implement automatic data updates on a schedule
- Add a UI for manually triggering data updates
- Improve error handling and fallback mechanisms
- Add more comprehensive set filtering based on the GitHub data
