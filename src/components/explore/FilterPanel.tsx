// Placeholder component for filtering options
import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

type FilterState = {
    set?: string;
    rarity?: string;
    type?: string;
    supertype?: string; // Added supertype
    // Add more filters as needed
  };

// --- Define Filter Options Type ---
interface FilterOptions {
  sets: string[];
  rarities: string[];
  types: string[];
  supertypes: string[];
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: FilterState;
  updateFilters: (newFilters: Partial<FilterState>) => void;
  // -- Accept options and loading state --
  availableOptions: FilterOptions;
  isLoadingOptions: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  currentFilters,
  updateFilters,
  availableOptions,
  isLoadingOptions,
}) => {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              {/* Slide-over Panel */}
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300 sm:duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-sm">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl">
                    {/* Header */}
                    <div className="px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-lg font-semibold leading-6 text-gray-900">
                          Filters
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            onClick={onClose}
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            {/* X Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="relative mt-6 flex-1 px-4 sm:px-6">
                      {isLoadingOptions ? (
                          <p className="text-gray-500">Loading filter options...</p>
                      ) : (
                          <div className="space-y-6">
                              {/* Set Filter */}
                              <div>
                                  <label htmlFor="set-filter" className="block text-sm font-medium leading-6 text-gray-900">Set</label>
                                  <select 
                                    id="set-filter"
                                    value={currentFilters.set || ''}
                                    onChange={(e) => updateFilters({ set: e.target.value || undefined })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                  >
                                    <option value="">All Sets</option>
                                    {availableOptions.sets.map(set => (
                                      <option key={set} value={set}>{set}</option>
                                    ))}
                                  </select>
                              </div>
                              
                              {/* Rarity Filter */}
                              <div>
                                  <label htmlFor="rarity-filter" className="block text-sm font-medium leading-6 text-gray-900">Rarity</label>
                                  <select 
                                    id="rarity-filter"
                                    value={currentFilters.rarity || ''}
                                    onChange={(e) => updateFilters({ rarity: e.target.value || undefined })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                  >
                                    <option value="">All Rarities</option>
                                    {availableOptions.rarities.map(rarity => (
                                      <option key={rarity} value={rarity}>{rarity}</option>
                                    ))}
                                  </select>
                              </div>
                              
                              {/* Type Filter (Energy Type) */}
                              <div>
                                  <label htmlFor="type-filter" className="block text-sm font-medium leading-6 text-gray-900">Energy Type</label>
                                  <select 
                                    id="type-filter"
                                    value={currentFilters.type || ''}
                                    onChange={(e) => updateFilters({ type: e.target.value || undefined })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                  >
                                    <option value="">All Types</option>
                                    {availableOptions.types.map(type => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                              </div>
                              
                              {/* Supertype Filter (Card Type) */}
                              <div>
                                  <label htmlFor="supertype-filter" className="block text-sm font-medium leading-6 text-gray-900">Card Type</label>
                                  <select 
                                    id="supertype-filter"
                                    value={currentFilters.supertype || ''}
                                    onChange={(e) => updateFilters({ supertype: e.target.value || undefined })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                  >
                                    <option value="">All Card Types</option>
                                    {availableOptions.supertypes.map(supertype => (
                                      <option key={supertype} value={supertype}>{supertype}</option>
                                    ))}
                                  </select>
                              </div>
                        
                          </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default FilterPanel; 