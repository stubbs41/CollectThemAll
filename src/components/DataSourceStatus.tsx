'use client';

import React, { useState, useEffect } from 'react';
import { isUsingLocalData } from '@/lib/githubDataManager';

/**
 * Component that displays the current data source status
 */
export default function DataSourceStatus() {
  const [usingLocal, setUsingLocal] = useState<boolean | null>(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Check the data source status after a short delay
    // to allow the data to be loaded
    const timer = setTimeout(() => {
      setUsingLocal(isUsingLocalData());
      setShowStatus(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!showStatus) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 text-sm">
      <div className="flex items-center space-x-2">
        <div 
          className={`w-3 h-3 rounded-full ${
            usingLocal === null 
              ? 'bg-gray-400' 
              : usingLocal 
                ? 'bg-green-500' 
                : 'bg-yellow-500'
          }`} 
        />
        <span>
          {usingLocal === null 
            ? 'Checking data source...' 
            : usingLocal 
              ? 'Using local data' 
              : 'Using GitHub data'
          }
        </span>
      </div>
    </div>
  );
}
