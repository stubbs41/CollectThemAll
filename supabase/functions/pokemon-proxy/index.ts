import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { PokemonTCG } from 'https://esm.sh/pokemon-tcg-sdk-typescript@1.3.2';

// Basic in-memory cache (replace with a more robust solution later)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Pagination configuration
const THEORETICAL_MAX_PAGES = 500; // Based on ~16,000 cards at 32 per page
const MAX_PAGE_SIZE = 250;  // Maximum page size allowed

// Ensure API key is available (Deno reads from env differently)
const apiKey = Deno.env.get("POKEMON_TCG_API_KEY");
if (apiKey) {
  PokemonTCG.configure({ apiKey });
  console.log("Pokemon TCG SDK configured with API key.");
} else {
  console.warn("POKEMON_TCG_API_KEY not found in environment variables.");
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const params = url.searchParams;

  console.log(`Edge Function Received: ${req.method} ${path}`);

  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle preflight CORS requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // --- Basic Routing --- 
  if (path === '/cards' && req.method === 'GET') {
    const query = params.get('q') || '';
    let page = parseInt(params.get('page') || '1');
    let pageSize = parseInt(params.get('pageSize') || '250');
    
    // Enforce maximum page size for performance
    if (pageSize > MAX_PAGE_SIZE) {
      console.warn(`Requested pageSize ${pageSize} exceeds maximum allowed (${MAX_PAGE_SIZE}). Limiting to max.`);
      pageSize = MAX_PAGE_SIZE;
    }
    
    // Log a warning for potentially problematic high page numbers, but don't restrict
    if (page > THEORETICAL_MAX_PAGES) {
      console.warn(`Requested page ${page} is very high. The Pokemon TCG API may return empty results.`);
    }

    const cacheKey = `cards:${query}:${page}:${pageSize}`;
    const cachedItem = cache.get(cacheKey);

    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_DURATION_MS)) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(JSON.stringify(cachedItem.data), {
        headers: { 
          "Content-Type": "application/json", 
          "X-Cache-Status": "HIT",
          ...corsHeaders
        },
      });
    }

    console.log(`Cache miss for ${cacheKey}. Fetching from API...`);
    try {
      const response = await PokemonTCG.findCardsByQueries({ q: query, page, pageSize });
      
      // Calculate total count (approximate)
      const totalCount = response.totalCount || response.length * 10;
      
      // Create response object with data and metadata
      const responseObj = {
        data: response,
        totalCount: totalCount,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        // Include theoretical max pages in metadata (for UI information)
        theoreticalMaxPages: THEORETICAL_MAX_PAGES
      };
      
      cache.set(cacheKey, { data: responseObj, timestamp: Date.now() });
      console.log(`Fetched and cached ${response.length} cards with totalCount ${totalCount}.`);
      
      return new Response(JSON.stringify(responseObj), {
        headers: { 
          "Content-Type": "application/json", 
          "X-Cache-Status": "MISS",
          ...corsHeaders
        },
      });
    } catch (error) {
      console.error("Error fetching cards from Pokemon TCG API:", error);
      return new Response(JSON.stringify({ 
        error: error.message,
        success: false
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        },
      });
    }
  } else if (path.startsWith('/cards/') && req.method === 'GET') {
    const cardId = path.split('/')[2]; // Extract card ID from path like /cards/xy7-54
    
    if (!cardId) {
        return new Response(JSON.stringify({ error: 'Card ID missing' }), { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
    }

    const cacheKey = `card:${cardId}`;
    const cachedItem = cache.get(cacheKey);

    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_DURATION_MS)) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(JSON.stringify(cachedItem.data), {
        headers: { 
          "Content-Type": "application/json", 
          "X-Cache-Status": "HIT",
          ...corsHeaders
        },
      });
    }

    console.log(`Cache miss for ${cacheKey}. Fetching from API...`);
    try {
      const response = await PokemonTCG.findCardByID(cardId);
      cache.set(cacheKey, { data: response, timestamp: Date.now() });
      console.log(`Fetched and cached details for card ${cardId}.`);
      return new Response(JSON.stringify(response), {
        headers: { 
          "Content-Type": "application/json", 
          "X-Cache-Status": "MISS",
          ...corsHeaders
        },
      });
    } catch (error) {
      console.error(`Error fetching card ${cardId} from Pokemon TCG API:`, error);
      return new Response(JSON.stringify({ 
        error: error.message,
        success: false
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        },
      });
    }
  }

  // --- Fallback for unhandled routes --- 
  return new Response(JSON.stringify({ message: "Endpoint not found" }), {
    status: 404,
    headers: { 
      "Content-Type": "application/json",
      ...corsHeaders
    },
  });
});

console.log(`Pokemon Proxy Edge Function started.`);
