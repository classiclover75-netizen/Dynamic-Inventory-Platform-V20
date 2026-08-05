import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { isLocked } from '../lib/sourceLockUtils';
import { getSourceChipStyle } from '../lib/sourceColorUtils';

interface ArchivedSaleSourceAdderProps {
  hiddenSources: any[];
  onSelect: (source: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function ArchivedSaleSourceAdder({ hiddenSources, onSelect, onOpenChange }: ArchivedSaleSourceAdderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
    if (!isOpen) {
      setSearchQuery("");
    } else {
      setSearchQuery("");
      // Need a small timeout to ensure it focuses after render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (hiddenSources.length === 0) return null;

  const filteredSources = hiddenSources.filter((ts) =>
    ts.source.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="relative mt-1 w-full" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center justify-center py-1 opacity-40 hover:opacity-100 hover:bg-gray-100 rounded border border-dashed border-gray-300 transition-all text-gray-500"
      >
        <Plus size={14} />
      </button>
      {isOpen && (
        <div 
          className="absolute left-0 mt-1 w-48 bg-white border shadow-lg rounded z-[99999] flex flex-col"
          style={{ top: '100%', maxHeight: '12rem' }}
        >
          <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase border-b shrink-0">Add Record For:</div>
          <div className="border-b shrink-0 px-1 py-1">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="text-sm px-2 py-1 w-full outline-none bg-transparent"
            />
          </div>
          <div className="overflow-y-auto overflow-x-hidden flex-1 py-1">
            {filteredSources.length === 0 ? (
              <div className="text-xs text-gray-400 italic px-3 py-2">No sources found</div>
            ) : (
              filteredSources.map((ts, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onSelect(ts.source);
                  }}
                  className="w-full flex items-center text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-gray-700 truncate"
                >
                  <span 
                    className={`inline-block shrink-0 w-2 h-2 rounded-full mr-2 ${ts.color?.startsWith('#') ? '' : ts.color?.replace('bg-', 'bg-').replace('text-', 'text-') || 'bg-gray-400'}`}
                    style={ts.color?.startsWith('#') ? { backgroundColor: ts.color } : undefined}
                  ></span>
                  {isLocked(ts) && <span className="mr-1 text-[10px]">🔒</span>}
                  <span className="truncate">{ts.source}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
