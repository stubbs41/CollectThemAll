import { CardPrices } from './types';

// Helper function to format price
export const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined) return 'N/A';
    return `$${price.toFixed(2)}`;
};

// Helper to get the most relevant market price
export const getMarketPrice = (prices: CardPrices | undefined): number | null => {
    if (!prices) return null;
    // Prioritize: normal market > holofoil market > reverse holofoil market
    return prices.normal?.market ?? prices.holofoil?.market ?? prices.reverseHolofoil?.market ?? null;
};

// Helper to get the best available price with fallback
export const getBestAvailablePrice = (prices: CardPrices | undefined): number | null => {
    if (!prices) return null;

    // First try to get the market price
    const marketPrice = getMarketPrice(prices);
    if (marketPrice !== null) return marketPrice;

    // If market price is unavailable, fall back to mid price
    return prices.normal?.mid ??
           prices.holofoil?.mid ??
           prices.reverseHolofoil?.mid ??
           null;
};

// Cache for proxied image URLs to avoid recalculating
const imageUrlCache = new Map<string, string>();

// Helper to generate the proxied image URL
export const getProxiedImageUrl = (originalUrl: string | undefined | null): string => {
    if (!originalUrl) {
        // Return a placeholder or a default image path if the original URL is missing
        return '/placeholder-card.png';
    }

    // Check if URL is already in cache
    if (imageUrlCache.has(originalUrl)) {
        return imageUrlCache.get(originalUrl)!;
    }

    // Only proxy external URLs from the specific domain
    if (originalUrl.startsWith('https://images.pokemontcg.io')) {
        // Encode the original URL to safely pass it as a path parameter
        const encodedUrl = encodeURIComponent(originalUrl);
        const proxiedUrl = `/api/image-proxy/${encodedUrl}`;
        imageUrlCache.set(originalUrl, proxiedUrl);
        return proxiedUrl;
    }

    // If it's a filename (no slashes), assume it's a local card image in /data/cards/
    if (!originalUrl.includes('/') && originalUrl.match(/\.(png|jpg|jpeg|webp|svg)$/i)) {
        const localUrl = `/data/cards/${originalUrl}`;
        imageUrlCache.set(originalUrl, localUrl);
        return localUrl;
    }

    // If it's a relative path (doesn't start with / or http), treat as /data/cards/
    if (!originalUrl.startsWith('/') && !originalUrl.startsWith('http')) {
        const localUrl = `/data/cards/${originalUrl}`;
        imageUrlCache.set(originalUrl, localUrl);
        return localUrl;
    }

    // If it's already a local path, return as is
    if (originalUrl.startsWith('/')) {
        return originalUrl;
    }

    // Fallback to placeholder
    return '/placeholder-card.png';
};

// Preload multiple images in the background
export const preloadImages = (urls: (string | undefined | null)[]): void => {
    // Filter out undefined/null values and deduplicate
    const uniqueUrls = [...new Set(urls.filter(Boolean) as string[])];

    // Process in batches to avoid overwhelming the browser
    const batchSize = 5;
    let currentBatch = 0;

    const loadNextBatch = () => {
        const batch = uniqueUrls.slice(currentBatch, currentBatch + batchSize);
        if (batch.length === 0) return;

        batch.forEach(url => {
            const img = new Image();
            img.src = getProxiedImageUrl(url);
        });

        currentBatch += batchSize;
        if (currentBatch < uniqueUrls.length) {
            setTimeout(loadNextBatch, 100); // Delay between batches
        }
    };

    loadNextBatch();
};