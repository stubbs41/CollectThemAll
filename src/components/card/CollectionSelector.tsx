'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { FolderIcon, MagnifyingGlassIcon, PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  const { groups, createCollectionGroup } = useCollections();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGroups, setFilteredGroups] = useState<string[]>(groups);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  // Handle creating a new collection group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setCreateError('Group name is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createCollectionGroup(newGroupName.trim(), newGroupDescription.trim() || undefined);

      if (result.success) {
        // Select the newly created group
        onSelect(newGroupName.trim());

        // Reset form and close it
        setNewGroupName('');
        setNewGroupDescription('');
        setShowCreateForm(false);
        setShowDropdown(false);
      } else {
        setCreateError(result.error || 'Failed to create collection group');
      }
    } catch (error: any) {
      console.error('Error creating collection group:', error);
      setCreateError(error.message || 'An unexpected error occurred');
    } finally {
      setIsCreating(false);
    }
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
                  title="Close selector"
                  aria-label="Close selector"
                >
                  <XMarkIcon className="h-5 w-5" />
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

              {/* Create new collection section */}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                {!showCreateForm ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <PlusCircleIcon className="h-4 w-4 mr-1" />
                    Create New Collection
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-700">Create New Collection</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewGroupName('');
                          setNewGroupDescription('');
                          setCreateError(null);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Close form"
                        aria-label="Close form"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div>
                      <label htmlFor="new-group-name" className="block text-xs font-medium text-gray-700 mb-1">
                        Collection Name *
                      </label>
                      <input
                        type="text"
                        id="new-group-name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="My New Collection"
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label htmlFor="new-group-description" className="block text-xs font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        id="new-group-description"
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Describe your collection"
                        disabled={isCreating}
                      />
                    </div>

                    {createError && (
                      <div className="text-xs text-red-600">
                        {createError}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={isCreating || !newGroupName.trim()}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isCreating ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewGroupName('');
                          setNewGroupDescription('');
                          setCreateError(null);
                        }}
                        disabled={isCreating}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionSelector;
