'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  MagnifyingGlassIcon, 
  UserIcon, 
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

const MobileNavigation: React.FC = () => {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  return (
    <nav className="mobile-nav">
      <Link href="/" className={`mobile-nav-item ${isActive('/') ? 'text-blue-600' : 'text-gray-500'}`}>
        <HomeIcon className="mobile-nav-icon" />
        <span>Home</span>
      </Link>
      
      <Link href="/explore" className={`mobile-nav-item ${isActive('/explore') ? 'text-blue-600' : 'text-gray-500'}`}>
        <MagnifyingGlassIcon className="mobile-nav-icon" />
        <span>Explore</span>
      </Link>
      
      <Link href="/my-collection" className={`mobile-nav-item ${isActive('/my-collection') ? 'text-blue-600' : 'text-gray-500'}`}>
        <HeartIcon className="mobile-nav-icon" />
        <span>Collection</span>
      </Link>
      
      <Link href="/my-shares" className={`mobile-nav-item ${isActive('/my-shares') ? 'text-blue-600' : 'text-gray-500'}`}>
        <ShareIcon className="mobile-nav-icon" />
        <span>Shares</span>
      </Link>
      
      <Link href="/account" className={`mobile-nav-item ${isActive('/account') ? 'text-blue-600' : 'text-gray-500'}`}>
        <UserIcon className="mobile-nav-icon" />
        <span>Account</span>
      </Link>
    </nav>
  );
};

export default MobileNavigation;
