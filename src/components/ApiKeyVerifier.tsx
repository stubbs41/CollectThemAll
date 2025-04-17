'use client';

import { useEffect, useState } from 'react';

/**
 * Component that verifies API keys at application startup
 * This is a client component that runs once when the application loads
 */
export default function ApiKeyVerifier() {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Run verification once on component mount
    const runVerification = async () => {
      try {
        // Call the server-side API to verify the API key
        const response = await fetch('/api/verify-api-key');
        const data = await response.json();

        setVerified(data.success);

        if (!data.success) {
          setError(data.error || 'Unknown API key verification error');

          // Log a warning to the console
          console.warn('Pokemon TCG API key issue detected:', data.error);
          console.warn('This may affect pricing data and API rate limits.');

          // If the API key is not configured, show a more specific message
          if (!data.configured) {
            console.warn('The Pokemon TCG API key is not configured in the server environment variables.');
            console.warn('Please add POKEMON_TCG_API_KEY to your Vercel environment variables.');
          }
        } else {
          console.log('Pokemon TCG API key verified successfully');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error verifying API keys';
        setError(errorMessage);
        console.error('Error verifying API keys:', err);
      }
    };

    runVerification();
  }, []);

  // This component doesn't render anything visible
  return null;
}
