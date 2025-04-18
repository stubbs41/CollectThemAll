"use client";

import { useEffect } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Store original fetch function
    const originalFetch = window.fetch;
    
    // Override fetch to catch 404 errors
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const response = await originalFetch(input, init);
        
        // Check if the request is for a card JSON file and resulted in a 404
        if (!response.ok && response.status === 404) {
          const url = typeof input === 'string' ? input : input.toString();
          
          if (url.includes('/data/cards/') && url.endsWith('.json')) {
            // Extract the set ID from the URL
            const setId = url.split('/').pop()?.replace('.json', '');
            console.error(`404 Error: Card data file not found for set ${setId}`);
            
            // Log to console for debugging
            console.info(`To fix this error, run: npm run download-missing-card-data`);
          }
        }
        
        return response;
      } catch (error) {
        // Re-throw the error to not interfere with normal error handling
        throw error;
      }
    };
    
    // Clean up on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  return <>{children}</>;
}
