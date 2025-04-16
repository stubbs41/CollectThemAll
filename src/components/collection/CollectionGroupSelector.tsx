'use client';

import React, { useState } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

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
            <label htmlFor="collection-group" className="text-sm font-medium text-gray-700">
              Collection Group:
            </label>
            <span className="text-base font-semibold text-blue-700">{activeGroup}</span>
          </div>

          <div className="flex gap-2">
            <select
              id="collection-group"
              value={activeGroup}
              onChange={handleGroupChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {groups.map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onCreateGroup}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Create new collection group"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
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
