'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { FolderIcon, MagnifyingGlassIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

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

  // Create a ref for the dropdown container
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    // Only add listeners when dropdown is shown
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Close when clicking on the overlay (outside the modal)
      if (event.target instanceof Element && event.target.classList.contains('modal-overlay')) {
        setShowDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent scrolling of the body when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showDropdown]);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
        <FolderIcon className="h-4 w-4 mr-1 text-gray-500" />
        {label}
      </label>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex justify-between items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm text-left focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-50 transition-colors"
        >
          <span className="truncate font-medium">{selectedGroup}</span>
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {showDropdown && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 modal-overlay"
            onClick={() => setShowDropdown(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()} // Prevent clicks inside the modal from closing it
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-medium text-gray-800">Select Collection</h3>
                <button
                  type="button"
                  onClick={() => setShowDropdown(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>

              {/* Search */}
              <div className="p-3 border-b border-gray-200 bg-white">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search collections..."
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Collection list */}
              <div className="overflow-y-auto max-h-[50vh]">
                <ul className="py-2 divide-y divide-gray-100">
                  {filteredGroups.map(group => (
                    <li
                      key={group}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedGroup === group ? 'bg-blue-50' : ''}`}
                      onClick={() => handleSelect(group)}
                    >
                      <div className="flex items-center">
                        <FolderIcon className={`h-5 w-5 mr-2 ${selectedGroup === group ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`text-sm ${selectedGroup === group ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                          {group}
                        </span>
                      </div>
                    </li>
                  ))}

                  {filteredGroups.length === 0 && (
                    <li className="px-4 py-3 text-sm text-gray-500 text-center">
                      No collections found
                    </li>
                  )}
                </ul>
              </div>

              {/* Create new collection button */}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                  onClick={() => {
                    // TODO: Implement create new collection functionality
                    alert('Create new collection feature coming soon!');
                  }}
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" />
                  Create New Collection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionSelector;
