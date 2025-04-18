'use client';

import React, { useState, useEffect } from 'react';
import { useCollections } from '@/context/CollectionContext';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CollectionGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupToEdit?: {
    name: string;
    description?: string;
  } | null;
}

const CollectionGroupModal: React.FC<CollectionGroupModalProps> = ({
  isOpen,
  onClose,
  groupToEdit = null
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createCollectionGroup, renameCollectionGroup } = useCollections();

  // Reset form when modal opens/closes or groupToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (groupToEdit) {
        setName(groupToEdit.name);
        setDescription(groupToEdit.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, groupToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result;

      if (groupToEdit) {
        // Update existing group
        result = await renameCollectionGroup(groupToEdit.name, name, description);
      } else {
        // Create new group
        result = await createCollectionGroup(name, description);
      }

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to save collection group');
      }
    } catch (error) {
      console.error('Error saving collection group:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {groupToEdit ? 'Edit Collection Group' : 'Create Collection Group'}
              </h3>

              <form onSubmit={handleSubmit} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="group-name" className="block text-sm font-medium text-gray-700">
                    Group Name
                  </label>
                  <input
                    type="text"
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="My Collection Group"
                    disabled={isSubmitting}
                  />

                </div>

                <div className="mb-4">
                  <label htmlFor="group-description" className="block text-sm font-medium text-gray-700">
                    Description (Optional)
                  </label>
                  <textarea
                    id="group-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Describe your collection group"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="mb-4 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionGroupModal;
