'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, AdjustmentsHorizontalIcon, FunnelIcon, ArrowsUpDownIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { CollectionItem } from '@/services/CollectionService';

export type FilterCriteria = {
  name?: string;
  set?: string;
  rarity?: string;
  type?: string;
  subtype?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  maxQuantity?: number;
};

export type SortOption = 'name' | 'set' | 'rarity' | 'price_asc' | 'price_desc' | 'quantity_asc' | 'quantity_desc' | 'newest' | 'oldest';

export type SavedFilter = {
  id: string;
  name: string;
  criteria: FilterCriteria;
  sortBy: SortOption;
};

interface AdvancedFilterPanelProps {
  items: Map<string, CollectionItem>;
  onFilterChange: (filteredItems: Map<string, CollectionItem>) => void;
  onSortChange: (sortOption: SortOption) => void;
  initialSortBy?: SortOption;
  initialFilter?: FilterCriteria;
  onClose?: () => void;
}

const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  items,
  onFilterChange,
  onSortChange,
  initialSortBy = 'newest',
  initialFilter = {},
  onClose
}) => {
  // State for filter criteria
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>(initialFilter);
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [newFilterName, setNewFilterName] = useState('');
  const [showSaveFilterForm, setShowSaveFilterForm] = useState(false);
  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [availableRarities, setAvailableRarities] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableSubtypes, setAvailableSubtypes] = useState<string[]>([]);
  
  // Extract available options from items
  useEffect(() => {
    const sets = new Set<string>();
    const rarities = new Set<string>();
    const types = new Set<string>();
    const subtypes = new Set<string>();
    
    Array.from(items.values()).forEach(item => {
      const card = item.card;
      if (card) {
        if (card.set?.name) sets.add(card.set.name);
        if (card.rarity) rarities.add(card.rarity);
        if (card.types && card.types.length > 0) {
          card.types.forEach(type => types.add(type));
        }
        if (card.subtypes && card.subtypes.length > 0) {
          card.subtypes.forEach(subtype => subtypes.add(subtype));
        }
      }
    });
    
    setAvailableSets(Array.from(sets).sort());
    setAvailableRarities(Array.from(rarities).sort());
    setAvailableTypes(Array.from(types).sort());
    setAvailableSubtypes(Array.from(subtypes).sort());
  }, [items]);
  
  // Load saved filters from localStorage
  useEffect(() => {
    const savedFiltersJson = localStorage.getItem('savedFilters');
    if (savedFiltersJson) {
      try {
        const parsed = JSON.parse(savedFiltersJson);
        setSavedFilters(parsed);
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);
  
  // Apply filters whenever criteria changes
  useEffect(() => {
    applyFilters();
  }, [filterCriteria, sortBy]);
  
  // Apply filters and sorting
  const applyFilters = () => {
    let filteredItems = new Map(items);
    
    // Apply name filter
    if (filterCriteria.name) {
      const nameFilter = filterCriteria.name.toLowerCase();
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => 
          item.card_name.toLowerCase().includes(nameFilter)
        )
      );
    }
    
    // Apply set filter
    if (filterCriteria.set) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => 
          item.card?.set?.name === filterCriteria.set
        )
      );
    }
    
    // Apply rarity filter
    if (filterCriteria.rarity) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => 
          item.card?.rarity === filterCriteria.rarity
        )
      );
    }
    
    // Apply type filter
    if (filterCriteria.type) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => 
          item.card?.types?.includes(filterCriteria.type!)
        )
      );
    }
    
    // Apply subtype filter
    if (filterCriteria.subtype) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => 
          item.card?.subtypes?.includes(filterCriteria.subtype!)
        )
      );
    }
    
    // Apply price range filter
    if (filterCriteria.minPrice !== undefined || filterCriteria.maxPrice !== undefined) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => {
          const price = item.market_price || 0;
          const minOk = filterCriteria.minPrice === undefined || price >= filterCriteria.minPrice;
          const maxOk = filterCriteria.maxPrice === undefined || price <= filterCriteria.maxPrice;
          return minOk && maxOk;
        })
      );
    }
    
    // Apply quantity range filter
    if (filterCriteria.minQuantity !== undefined || filterCriteria.maxQuantity !== undefined) {
      filteredItems = new Map(
        Array.from(filteredItems).filter(([_, item]) => {
          const quantity = item.quantity || 0;
          const minOk = filterCriteria.minQuantity === undefined || quantity >= filterCriteria.minQuantity;
          const maxOk = filterCriteria.maxQuantity === undefined || quantity <= filterCriteria.maxQuantity;
          return minOk && maxOk;
        })
      );
    }
    
    // Apply sorting
    let sortedItems = new Map(filteredItems);
    
    switch (sortBy) {
      case 'name':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => 
            a[1].card_name.localeCompare(b[1].card_name)
          )
        );
        break;
      case 'set':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => {
            const setA = a[1].card?.set?.name || '';
            const setB = b[1].card?.set?.name || '';
            return setA.localeCompare(setB);
          })
        );
        break;
      case 'rarity':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => {
            const rarityA = a[1].card?.rarity || '';
            const rarityB = b[1].card?.rarity || '';
            return rarityA.localeCompare(rarityB);
          })
        );
        break;
      case 'price_asc':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => 
            (a[1].market_price || 0) - (b[1].market_price || 0)
          )
        );
        break;
      case 'price_desc':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => 
            (b[1].market_price || 0) - (a[1].market_price || 0)
          )
        );
        break;
      case 'quantity_asc':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => 
            (a[1].quantity || 0) - (b[1].quantity || 0)
          )
        );
        break;
      case 'quantity_desc':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => 
            (b[1].quantity || 0) - (a[1].quantity || 0)
          )
        );
        break;
      case 'newest':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => {
            const dateA = new Date(a[1].added_at).getTime();
            const dateB = new Date(b[1].added_at).getTime();
            return dateB - dateA;
          })
        );
        break;
      case 'oldest':
        sortedItems = new Map(
          Array.from(sortedItems).sort((a, b) => {
            const dateA = new Date(a[1].added_at).getTime();
            const dateB = new Date(b[1].added_at).getTime();
            return dateA - dateB;
          })
        );
        break;
    }
    
    // Call the callback with filtered and sorted items
    onFilterChange(sortedItems);
    onSortChange(sortBy);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilterCriteria({});
    setSortBy('newest');
  };
  
  // Save current filter
  const saveFilter = () => {
    if (!newFilterName.trim()) return;
    
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: newFilterName,
      criteria: { ...filterCriteria },
      sortBy
    };
    
    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    
    // Save to localStorage
    localStorage.setItem('savedFilters', JSON.stringify(updatedFilters));
    
    // Reset form
    setNewFilterName('');
    setShowSaveFilterForm(false);
  };
  
  // Load a saved filter
  const loadFilter = (filter: SavedFilter) => {
    setFilterCriteria(filter.criteria);
    setSortBy(filter.sortBy);
  };
  
  // Delete a saved filter
  const deleteFilter = (id: string) => {
    const updatedFilters = savedFilters.filter(filter => filter.id !== id);
    setSavedFilters(updatedFilters);
    
    // Save to localStorage
    localStorage.setItem('savedFilters', JSON.stringify(updatedFilters));
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'number') {
      setFilterCriteria({
        ...filterCriteria,
        [name]: value ? parseFloat(value) : undefined
      });
    } else {
      setFilterCriteria({
        ...filterCriteria,
        [name]: value || undefined
      });
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
          Advanced Filters
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {/* Filter Form */}
      <div className="space-y-4">
        {/* Text Search */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Card Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={filterCriteria.name || ''}
            onChange={handleInputChange}
            placeholder="Search by name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        
        {/* Set Filter */}
        <div>
          <label htmlFor="set" className="block text-sm font-medium text-gray-700 mb-1">
            Set
          </label>
          <select
            id="set"
            name="set"
            value={filterCriteria.set || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Sets</option>
            {availableSets.map(set => (
              <option key={set} value={set}>{set}</option>
            ))}
          </select>
        </div>
        
        {/* Rarity Filter */}
        <div>
          <label htmlFor="rarity" className="block text-sm font-medium text-gray-700 mb-1">
            Rarity
          </label>
          <select
            id="rarity"
            name="rarity"
            value={filterCriteria.rarity || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Rarities</option>
            {availableRarities.map(rarity => (
              <option key={rarity} value={rarity}>{rarity}</option>
            ))}
          </select>
        </div>
        
        {/* Type Filter */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type"
              name="type"
              value={filterCriteria.type || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Types</option>
              {availableTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="subtype" className="block text-sm font-medium text-gray-700 mb-1">
              Subtype
            </label>
            <select
              id="subtype"
              name="subtype"
              value={filterCriteria.subtype || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Subtypes</option>
              {availableSubtypes.map(subtype => (
                <option key={subtype} value={subtype}>{subtype}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range ($)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                id="minPrice"
                name="minPrice"
                value={filterCriteria.minPrice || ''}
                onChange={handleInputChange}
                placeholder="Min"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <input
                type="number"
                id="maxPrice"
                name="maxPrice"
                value={filterCriteria.maxPrice || ''}
                onChange={handleInputChange}
                placeholder="Max"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        {/* Quantity Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                id="minQuantity"
                name="minQuantity"
                value={filterCriteria.minQuantity || ''}
                onChange={handleInputChange}
                placeholder="Min"
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <input
                type="number"
                id="maxQuantity"
                name="maxQuantity"
                value={filterCriteria.maxQuantity || ''}
                onChange={handleInputChange}
                placeholder="Max"
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        {/* Sort Options */}
        <div>
          <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <ArrowsUpDownIcon className="w-4 h-4 mr-1" />
            Sort By
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
            <option value="set">Set</option>
            <option value="rarity">Rarity</option>
            <option value="price_asc">Price (Low to High)</option>
            <option value="price_desc">Price (High to Low)</option>
            <option value="quantity_asc">Quantity (Low to High)</option>
            <option value="quantity_desc">Quantity (High to Low)</option>
          </select>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 text-sm"
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={() => setShowSaveFilterForm(!showSaveFilterForm)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center justify-center"
          >
            <BookmarkIcon className="w-4 h-4 mr-1" />
            {showSaveFilterForm ? 'Cancel Save' : 'Save Filter'}
          </button>
        </div>
        
        {/* Save Filter Form */}
        {showSaveFilterForm && (
          <div className="mt-2 p-3 border border-blue-200 rounded-md bg-blue-50">
            <label htmlFor="filterName" className="block text-sm font-medium text-gray-700 mb-1">
              Filter Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="filterName"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="My Filter"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <button
                type="button"
                onClick={saveFilter}
                disabled={!newFilterName.trim()}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Save
              </button>
            </div>
          </div>
        )}
        
        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Saved Filters</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {savedFilters.map(filter => (
                <div 
                  key={filter.id}
                  className="flex items-center justify-between p-2 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <button
                    type="button"
                    onClick={() => loadFilter(filter)}
                    className="text-sm text-left flex-grow"
                  >
                    {filter.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFilter(filter.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedFilterPanel;
