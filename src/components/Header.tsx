'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link'; // Use Next.js Link for navigation
import Image from 'next/image'; // For the React logo
import { useState } from 'react';
import AuthForm from './AuthForm';

const Header: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const authRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleAuth = () => {
    setIsAuthOpen(!isAuthOpen);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAuthOpen && 
          authRef.current && 
          buttonRef.current && 
          !authRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setIsAuthOpen(false);
      }
    };
    
    // Close dropdown when pressing Escape
    const handleEscape = (event: KeyboardEvent) => {
      if (isAuthOpen && event.key === 'Escape') {
        setIsAuthOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAuthOpen]);

  return (
    <header className="bg-gray-800 text-white py-4 mb-2 shadow-lg">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-xl font-bold text-white flex items-center">
            <Image
              src="/pokeball-icon.svg"
              alt="Pokéball Logo"
              width={24}
              height={24}
              priority
              className="mr-2"
            />
            <span>MyBinder</span>
          </Link>
          
          <nav className="hidden md:block ml-8">
            <ul className="flex space-x-6">
              <li>
                <Link href="/explore" className="hover:text-gray-300">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/collections" className="hover:text-gray-300">
                  My Collection
                </Link>
              </li>
              <li>
                <Link href="/my-shares" className="hover:text-gray-300">
                  My Shares
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        
        {/* Account dropdown container - Added relative positioning */}
        <div className="relative">
          <button
            onClick={toggleAuth}
            ref={buttonRef}
            className="px-4 py-2 rounded-full bg-blue-700 hover:bg-blue-800 transition-colors"
          >
            Account
          </button>
          
          {/* Auth dropdown - Positioned relative to container */}
          {isAuthOpen && (
            <div 
              ref={authRef}
              className="absolute right-0 top-full mt-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden w-72 md:w-auto"
            >
              <AuthForm />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 