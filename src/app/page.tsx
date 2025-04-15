'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function HomePage() {
  // Landing page animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-center mb-8">
            <motion.div
              animate={{ 
                rotate: [0, 10, 0, -10, 0],
                y: [0, -5, 0, -5, 0]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 5, 
                ease: "easeInOut" 
              }}
            >
              <Image 
                src="/pokeball-icon.svg" 
                alt="PokéCollector" 
                width={100} 
                height={100} 
                className="h-24 w-24 md:h-32 md:w-32" 
              />
            </motion.div>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-blue-600 mb-4">
            PokéCollector
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
            Track, organize, and showcase your card collection with style!
          </p>

          <motion.div 
            className="mt-10 flex flex-col md:flex-row gap-4 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/explore">
              <motion.button
                className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-blue-800 font-bold rounded-full text-lg shadow-lg transform transition hover:scale-105 w-full md:w-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Explore Cards
              </motion.button>
            </Link>
            <Link href="/collections">
              <motion.button
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full text-lg shadow-lg transform transition hover:scale-105 w-full md:w-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                My Collection
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
        
        {/* Features Section */}
        <motion.section 
          className="mb-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">App Features</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              className="bg-white p-6 rounded-lg shadow-md"
              variants={itemVariants}
            >
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Browse & Search</h3>
              <p className="text-gray-700 text-center font-medium">
                Easily find and browse through thousands of cards with our powerful search tools.
              </p>
            </motion.div>
            
            <motion.div 
              className="bg-white p-6 rounded-lg shadow-md"
              variants={itemVariants}
            >
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Track Collection</h3>
              <p className="text-gray-700 text-center font-medium">
                Keep track of every card in your collection with an intuitive interface.
              </p>
            </motion.div>
            
            <motion.div 
              className="bg-white p-6 rounded-lg shadow-md"
              variants={itemVariants}
            >
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Collection Stats</h3>
              <p className="text-gray-700 text-center font-medium">
                View detailed statistics about your collection and track your progress.
              </p>
            </motion.div>
          </div>
        </motion.section>
        
        {/* How It Works Section */}
        <motion.section 
          className="mb-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-4">
            <motion.div 
              className="text-center"
              variants={itemVariants}
            >
              <div className="h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4 mx-auto">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Browse Cards</h3>
              <p className="text-gray-700 text-sm font-medium">
                Explore our extensive database of cards
              </p>
            </motion.div>
            
            <motion.div 
              className="text-center"
              variants={itemVariants}
            >
              <div className="h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4 mx-auto">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Add to Collection</h3>
              <p className="text-gray-700 text-sm font-medium">
                Save cards you own to your personal collection
              </p>
            </motion.div>
            
            <motion.div 
              className="text-center"
              variants={itemVariants}
            >
              <div className="h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4 mx-auto">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Organize</h3>
              <p className="text-gray-700 text-sm font-medium">
                Sort and filter your collection
              </p>
            </motion.div>
            
            <motion.div 
              className="text-center"
              variants={itemVariants}
            >
              <div className="h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4 mx-auto">
                <span className="text-xl font-bold">4</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Share</h3>
              <p className="text-gray-700 text-sm font-medium">
                Export and share your collection with friends
              </p>
            </motion.div>
          </div>
        </motion.section>
        
        {/* Call to Action */}
        <motion.div 
          className="text-center bg-white p-10 rounded-2xl shadow-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h3 className="text-2xl font-bold mb-4">Ready to start collecting?</h3>
          <p className="text-gray-600 mb-8">Join thousands of collectors tracking their cards online!</p>
          
          <Link href="/explore">
            <motion.button
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full text-lg shadow-lg transform transition hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Collecting Now
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
