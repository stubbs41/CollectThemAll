import React, { useState } from 'react';
import Image from 'next/image';
import { getProxiedImageUrl } from '@/lib/utils';

interface CardImageProps {
  imageUrl: string | undefined;
  altText: string;
  width?: number;
  height?: number;
}

const CardImage: React.FC<CardImageProps> = ({ 
  imageUrl, 
  altText,
  width = 300,
  height = 420
}) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a default image if none is provided
  const imageSource = imageUrl 
    ? getProxiedImageUrl(imageUrl)
    : '/placeholder-card.png';

  return (
    <div className="card-image-container relative">
      {/* Loading skeleton */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{ width, height }}
        />
      )}
      
      <Image 
        src={imageSource}
        alt={altText} 
        width={width} 
        height={height} 
        className={`object-contain w-full h-auto rounded shadow-md transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        unoptimized={!imageUrl}
        priority={false} // Only prioritize small images, not the large card images
      />
    </div>
  );
};

export default React.memo(CardImage); 