/**
 * CachedImage Component
 * 
 * This component handles loading images with local caching.
 * It uses the imageCache utility to store and retrieve images.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { loadImageWithCache } from '@/lib/imageCache';

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export default function CachedImage({
  src,
  alt,
  className,
  width,
  height,
  onLoad,
  onError
}: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    const loadImage = async () => {
      try {
        // Only try to cache if it's a valid URL
        if (src && src.startsWith('http')) {
          const cachedUrl = await loadImageWithCache(src);
          
          if (isMounted) {
            setCachedSrc(cachedUrl);
            setIsLoading(false);
          }
        } else {
          // If not a valid URL, just use the src directly
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error loading cached image:', error);
        
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
          onError?.();
        }
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [src, onError]);

  const handleImageLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  return (
    <>
      {isLoading && (
        <div className={`${className} flex items-center justify-center bg-gray-100`}>
          <div className="animate-pulse bg-gray-200 w-full h-full"></div>
        </div>
      )}
      
      <img
        src={cachedSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : ''}`}
        width={width}
        height={height}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {hasError && (
        <div className={`${className} flex items-center justify-center bg-gray-100`}>
          <span className="text-red-500">Failed to load image</span>
        </div>
      )}
    </>
  );
}
