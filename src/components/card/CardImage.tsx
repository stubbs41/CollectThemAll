import React from 'react';
import { getProxiedImageUrl } from '@/lib/utils';
import CachedImage from '@/components/CachedImage';

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
  // Use a default image if none is provided
  const imageSource = imageUrl
    ? getProxiedImageUrl(imageUrl)
    : '/placeholder-card.png';

  return (
    <div className="card-image-container relative">
      <CachedImage
        src={imageSource}
        alt={altText}
        width={width}
        height={height}
        className="object-contain w-full h-auto rounded shadow-md"
      />
    </div>
  );
};

export default CardImage;