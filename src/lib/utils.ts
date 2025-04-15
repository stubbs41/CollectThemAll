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

// Helper to generate the proxied image URL
export const getProxiedImageUrl = (originalUrl: string | undefined | null): string => {
    if (!originalUrl) {
        // Return a placeholder or a default image path if the original URL is missing
        return '/placeholder.png'; // Make sure you have a placeholder image at public/placeholder.png
    }

    // Only proxy external URLs from the specific domain
    if (originalUrl.startsWith('https://images.pokemontcg.io')) {
        // Encode the original URL to safely pass it as a path parameter
        const encodedUrl = encodeURIComponent(originalUrl);
        return `/api/image-proxy/${encodedUrl}`;
    }

    // If it's already a local path or from another domain, return it as is
    return originalUrl;
}; 