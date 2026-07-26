import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Button, Input } from './ui';
import { Column, PageConfig } from '../types';
import { Search } from 'lucide-react';

export interface ManageTrackerColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  pageConfigs: Record<string, PageConfig>;
  activeConfig: PageConfig;
  onSave: (selectedColKeys: string[]) => void;
}

export const ManageTrackerColumnsModal = React.memo(({
  isOpen,
  onClose,
  onBack,
  pageConfigs,
  activeConfig,
  onSave
}: ManageTrackerColumnsModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColKeys, setSelectedColKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const currentKeys = new Set(activeConfig.columns.map(c => c.key));
      setSelectedColKeys(currentKeys);
    }
  }, [isOpen, activeConfig.columns]);

  const sourceConfig = useMemo(() => {
    if (!activeConfig.linkedSourcePage) return null;
    let config = pageConfigs[activeConfig.linkedSourcePage];
    if (config) return config;
    
    const targetName = activeConfig.linkedSourcePage.trim().toLowerCase();
    for (const [pageName, pConfig] of Object.entries(pageConfigs)) {
      if (pageName.trim().toLowerCase() === targetName) {
        return pConfig;
      }
    }
    return null;
  }, [activeConfig.linkedSourcePage, pageConfigs]);

  const sourceColumns = useMemo(() => {
    return sourceConfig ? sourceConfig.columns.filter(c => c.key !== 'sr') : [];
  }, [sourceConfig]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return sourceColumns;
    const lowerQuery = searchQuery.toLowerCase();
    return sourceColumns.filter(c => c.name.toLowerCase().includes(lowerQuery));
  }, [sourceColumns, searchQuery]);

  const toggleColumn = (key: string) => {
    const next = new Set(selectedColKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedColKeys(next);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧩 Manage Tracker Columns">
      <div className="p-4 flex flex-col gap-4 max-h-[80vh]">
        {!sourceConfig ? (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
            <span className="font-bold text-lg block mb-1">Source Page Not Found</span>
            The linked main page ("<span className="font-bold">{activeConfig.linkedSourcePage}</span>") could not be found. It may have been renamed or deleted. <br/><br/>
            Please restore or rename the source page back to match, or recreate this Live Tracker from the new page.
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-600 mb-2">
              Select which columns from the main page (<span className="font-bold text-gray-800">{activeConfig.linkedSourcePage}</span>) should be shown in this tracker.
            </div>
            
            <div className="relative">
              <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
              <Input 
                className="pl-8" 
                placeholder="Search columns..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50 min-h-[300px]">
              {filteredColumns.map(col => (
                <label key={col.key} className="flex items-center gap-3 p-2 bg-white rounded border border-gray-100 hover:bg-purple-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer accent-purple-600"
                    checked={selectedColKeys.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-sm font-medium text-gray-800">{col.name}</span>
                </label>
              ))}
              {filteredColumns.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4 italic">No columns match your search.</div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-2 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={onBack}>Back to Settings</Button>
          {sourceConfig && (
            <Button variant="purple" onClick={() => onSave(Array.from(selectedColKeys))}>
              Save Columns
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
});
