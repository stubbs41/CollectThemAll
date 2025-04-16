'use client';

import React, { useState } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { PlusIcon, PencilIcon, TrashIcon, FolderIcon } from '@heroicons/react/24/outline';

interface CollectionGroupSelectorProps {
  onCreateGroup?: () => void;
}

const CollectionGroupSelector: React.FC<CollectionGroupSelectorProps> = ({ onCreateGroup }) => {
  const {
    groups,
    collectionGroups,
    activeGroup,
    setActiveGroup,
    deleteCollectionGroup
  } = useCollections();

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveGroup(e.target.value);
  };

  const handleDeleteGroup = async (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (groupName === 'Default') {
      setDeleteError('Cannot delete the Default collection group');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the "${groupName}" collection group? This will delete all cards in this group and cannot be undone.`)) {
      setIsDeleting(groupName);
      setDeleteError(null);

      try {
        const result = await deleteCollectionGroup(groupName);
        if (!result.success) {
          setDeleteError(result.error || 'Failed to delete collection group');
        }
      } catch (error) {
        console.error('Error deleting collection group:', error);
        setDeleteError('An unexpected error occurred');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Find the active group info
  const activeGroupInfo = collectionGroups.find(g => g.name === activeGroup);

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-2">
            <FolderIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-700">Collection Group</h3>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-grow">
              <select
                id="collection-group"
                value={activeGroup}
                onChange={handleGroupChange}
                className="block w-full pl-3 pr-10 py-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm appearance-none"
                aria-label="Select collection group"
              >
              {groups.map(group => {
                // Skip duplicate 'Default' entries
                if (group === 'Default' && groups.indexOf(group) !== groups.lastIndexOf(group)) {
                  return null;
                }
                return (
                  <option key={group} value={group}>
                    {group}
                  </option>
                );
              })}
            </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <button
              type="button"
              onClick={onCreateGroup}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Create new collection group"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              New
            </button>
          </div>

          <div className="flex mt-2 gap-2">
            {activeGroup !== 'Default' && (
              <>
                <button
                  type="button"
                  onClick={(e) => handleDeleteGroup(activeGroup, e)}
                  className="inline-flex items-center px-3 py-1 text-xs border border-red-200 rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  title="Delete this collection group"
                  disabled={isDeleting === activeGroup}
                >
                  <TrashIcon className="h-3 w-3 mr-1" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => onCreateGroup && onCreateGroup()}
                  className="inline-flex items-center px-3 py-1 text-xs border border-blue-200 rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  title="Edit this collection group"
                >
                  <PencilIcon className="h-3 w-3 mr-1" />
                  Edit
                </button>
              </>
            )}
          </div>

          {activeGroupInfo?.description && (
            <div className="mt-2 text-sm text-gray-500 italic">
              {activeGroupInfo.description}
            </div>
          )}
        </div>

        {activeGroupInfo && (
          <div className="flex-shrink-0 bg-gray-100 p-3 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Collection Value</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">I Have</p>
                <p className="text-sm font-bold text-blue-700">${activeGroupInfo.have_value.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">I Want</p>
                <p className="text-sm font-bold text-purple-700">${activeGroupInfo.want_value.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-bold text-green-700">${activeGroupInfo.total_value.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <div className="mt-2 text-sm text-red-600">
          {deleteError}
        </div>
      )}
    </div>
  );
};

export default CollectionGroupSelector;
