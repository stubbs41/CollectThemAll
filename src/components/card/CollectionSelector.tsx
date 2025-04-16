'use client';

import React, { useState, useEffect } from 'react';
import { useCollections } from '@/context/CollectionContext';

interface CollectionSelectorProps {
  onSelect: (groupName: string) => void;
  selectedGroup?: string;
  label?: string;
  className?: string;
}

const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  onSelect,
  selectedGroup = 'Default',
  label = 'Select Collection',
  className = ''
}) => {
  const { groups } = useCollections();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGroups, setFilteredGroups] = useState<string[]>(groups);
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter groups when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(group => 
        group.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredGroups(filtered);
    }
  }, [searchTerm, groups]);

  const handleSelect = (group: string) => {
    onSelect(group);
    setShowDropdown(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex justify-between items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm text-left focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className="truncate">{selectedGroup}</span>
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
            <div className="p-2 border-b">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search collections..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <ul className="py-1">
              {filteredGroups.map(group => (
                <li 
                  key={group}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${selectedGroup === group ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                  onClick={() => handleSelect(group)}
                >
                  {group}
                </li>
              ))}
              
              {filteredGroups.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">
                  No collections found
                </li>
              )}
              
              <li className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 text-green-600 font-medium border-t">
                + Create New Collection
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionSelector;
