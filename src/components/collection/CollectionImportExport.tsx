import React, { useState, useRef } from 'react';
import { CollectionType } from '@/services/CollectionService';
import { useCollections } from '@/context/CollectionContext';

interface CollectionExportData {
  collection_type: CollectionType;
  group_name: string;
  collection_name?: string; // For naming the collection when importing
  exported_at: string;
  items: {
    card_id: string;
    card_name: string | null;
    card_image_small: string | null;
    quantity: number;
  }[];
}

interface CollectionItem {
  id: string;
  card_id: string;
  card_name?: string | null;
  card_image_small?: string | null;
  collection_type: string;
  group_name: string;
  quantity: number;
  added_at: string;
}

interface CollectionImportExportProps {
  collection: CollectionItem[];
  collectionType: CollectionType;
  groupName: string;
  onImportComplete: () => void;
  availableGroups: string[];
}

// Define expiration options
const expirationOptions = [
  { value: '1h', label: '1 Hour' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'never', label: 'Never' },
];
type ExpirationValue = '1h' | '1d' | '7d' | '30d' | 'never';

const CollectionImportExport: React.FC<CollectionImportExportProps> = ({
  collection,
  collectionType,
  groupName,
  onImportComplete,
  availableGroups
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importGroup, setImportGroup] = useState(groupName);
  const [exportName, setExportName] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareExpiration, setShareExpiration] = useState<ExpirationValue>('30d'); // Add state for expiration
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get context functions
  const { shareCollection: shareCollectionContext, exportCollection: exportCollectionContext, importCollection: importCollectionContext } = useCollections();

  // Export collection to JSON file
  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Use context function to export collection
      const result = await exportCollectionContext(groupName, collectionType);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to export collection');
      }

      // Format the collection data for export
      const exportData: CollectionExportData = {
        collection_type: collectionType as CollectionType,
        group_name: groupName,
        collection_name: exportName.trim() || groupName,
        exported_at: new Date().toISOString(),
        items: result.data.map(item => ({
          card_id: item.card_id,
          card_name: item.card_name || null,
          card_image_small: item.card_image_small || null,
          quantity: item.quantity,
          market_price: item.market_price || 0
        }))
      };

      // Convert to JSON
      const jsonData = JSON.stringify(exportData, null, 2);

      // Create a blob and download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `pokemon-collection-${exportName || groupName}-${collectionType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Collection exported successfully!');
    } catch (err: any) {
      console.error('Error exporting collection:', err);
      setError(err.message || 'Failed to export collection. Please try again.');
    } finally {
      setIsExporting(false);
      // Clear success message after 3 seconds
      if (success) setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Generate a shareable link
  const handleShare = async () => {
    setIsSharing(true);
    setError(null);
    setSuccess(null);
    setShareLink(null); // Clear previous link

    try {
      // Calculate expiration days
      let expirationDays = 30; // Default
      switch (shareExpiration) {
        case '1h': expirationDays = 1/24; break;
        case '1d': expirationDays = 1; break;
        case '7d': expirationDays = 7; break;
        case '30d': expirationDays = 30; break;
        case 'never': expirationDays = 365 * 10; break; // 10 years
      }

      // Use context function to share collection
      const sharingLevel = collectionType === 'have' ? 'have' : 'want';
      const result = await shareCollectionContext(groupName, sharingLevel, expirationDays);

      if (result.success && result.shareId) {
        // Construct share URL
        const shareUrl = `${window.location.origin}/shared/${result.shareId}`;
        setShareLink(shareUrl);
        setSuccess(`Share link created! Expires: ${expirationOptions.find(opt => opt.value === shareExpiration)?.label || 'Default'}`);
      } else {
        throw new Error(result.error || 'Failed to create a shareable link');
      }
    } catch (err: any) {
      console.error('Error creating share link:', err);
      setError(err.message || 'Failed to create a shareable link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // Copy share link to clipboard
  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setSuccess('Link copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Trigger file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Read the file
      const fileContent = await readFileAsText(file);
      const importData = JSON.parse(fileContent) as CollectionExportData;

      // Validate the imported data
      if (!importData.collection_type || !Array.isArray(importData.items)) {
        throw new Error('Invalid import file format');
      }

      // Check if import is for the correct collection type
      if (importData.collection_type !== collectionType) {
        throw new Error(`This import file is for a "${importData.collection_type}" collection, but you're currently viewing your "${collectionType}" collection.`);
      }

      // Determine import group name
      const targetGroupName = importGroup === 'new'
        ? (importData.collection_name || importData.group_name || 'Imported Collection')
        : importGroup;

      // Import the collection by making API calls
      const importCount = await importCollection(importData, targetGroupName);

      setSuccess(`Successfully imported ${importCount} cards to your "${targetGroupName}" collection!`);
      onImportComplete(); // Refresh the collection

    } catch (err: any) {
      console.error('Error importing collection:', err);
      setError(err.message || 'Failed to import collection. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper function to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  // Import collection using context
  const importCollection = async (importData: CollectionExportData, targetGroupName: string): Promise<number> => {
    // Use context function to import collection
    const createNewGroup = targetGroupName !== groupName && !availableGroups.includes(targetGroupName);

    const result = await importCollectionContext(importData.items, targetGroupName, createNewGroup);

    if (!result.success) {
      throw new Error(result.error || 'Failed to import collection');
    }

    return importData.items.length;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-lg font-medium mb-3">Import/Export Collection</h3>

      <div className="mb-4">
        <label htmlFor="export-collection-name" className="block text-sm font-medium text-gray-700 mb-1">
          Collection Name (for export/share)
        </label>
        <input
          type="text"
          id="export-collection-name"
          name="export-collection-name"
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder={`${groupName} ${collectionType} collection`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-end">
        <button
          onClick={handleExport}
          disabled={isExporting || collection.length === 0}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            isExporting ? 'bg-gray-400 cursor-wait' :
            collection.length === 0 ? 'bg-gray-300 cursor-not-allowed text-gray-500' :
            'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isExporting ? 'Exporting...' : 'Export Collection'}
        </button>

        {/* Share Controls */}
        <div className="flex-1 flex gap-2 items-end">
          <button
            onClick={handleShare}
            disabled={isSharing || collection.length === 0}
            className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg ${
              isSharing ? 'bg-gray-400 cursor-wait' :
              collection.length === 0 ? 'bg-gray-300 cursor-not-allowed text-gray-500' :
              'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isSharing ? 'Creating Link...' : 'Share Collection'}
          </button>

          {/* Expiration Dropdown */}
          <div className="w-full sm:w-auto">
             <label htmlFor="share-expiration" className="block text-xs font-medium text-gray-600 mb-1">
               Expires in:
             </label>
            <select
              id="share-expiration"
              name="share-expiration"
              value={shareExpiration}
              onChange={(e) => setShareExpiration(e.target.value as ExpirationValue)}
              disabled={isSharing || collection.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {expirationOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Share Link Display */}
      {shareLink && (
        <div className="mt-3 mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="text-sm text-purple-800 truncate">{shareLink}</div>
            <button
              onClick={copyShareLink}
              className="ml-2 px-3 py-1 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700"
            >
              Copy
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Anyone with this link can view this collection
          </p>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h4 className="text-md font-medium mb-2">Import Collection</h4>

        {/* Import Group Selection */}
        <div className="mb-4">
          <label htmlFor="import-group-select" className="block text-sm font-medium text-gray-700 mb-1">
            Import into group
          </label>
          <select
            id="import-group-select"
            name="import-group-select"
            value={importGroup}
            onChange={(e) => setImportGroup(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {availableGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
            <option value="new">Create new group from import name</option>
          </select>
        </div>

        <button
          id="import-collection-button"
          onClick={handleImportClick}
          disabled={isImporting}
          className={`px-4 py-2 text-sm font-medium rounded-lg ${
            isImporting ? 'bg-gray-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isImporting ? 'Importing...' : 'Import Collection'}
        </button>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          aria-labelledby="import-collection-button"
        />
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 p-2 bg-red-50 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 text-sm text-green-600 p-2 bg-green-50 rounded">
          {success}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        <p>Export: Download your current collection as a JSON file.</p>
        <p>Share: Create a link to share your collection with others.</p>
        <p>Import: Upload a previously exported collection file.</p>
      </div>
    </div>
  );
};

export default CollectionImportExport;