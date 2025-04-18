"use client";

import { useEffect } from 'react';

// Simplified version that doesn't override fetch
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Add a simple console message instead of overriding fetch
    console.log('ClientWrapper mounted');

    return () => {
      console.log('ClientWrapper unmounted');
    };
  }, []);

  return <>{children}</>;
}
