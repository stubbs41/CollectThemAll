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
            className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center space-x-1 font-medium shadow-md"
          >
            <span>Account</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Auth dropdown - Positioned relative to container */}
          <div
            ref={authRef}
            className={`absolute right-0 top-full mt-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden w-[calc(100vw-2rem)] sm:w-80 md:w-96 transition-all duration-200 ease-in-out transform origin-top-right ${isAuthOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
          >
            {isAuthOpen && <AuthForm />}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;