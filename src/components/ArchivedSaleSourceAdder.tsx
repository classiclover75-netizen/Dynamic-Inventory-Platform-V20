import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { isLocked } from '../lib/sourceLockUtils';

interface ArchivedSaleSourceAdderProps {
  hiddenSources: any[];
  onSelect: (source: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function ArchivedSaleSourceAdder({ hiddenSources, onSelect, onOpenChange }: ArchivedSaleSourceAdderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
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
          className="absolute left-0 mt-1 w-48 bg-white border shadow-lg rounded z-[99999] py-1 max-h-48 overflow-y-auto"
          style={{ top: '100%' }}
        >
          <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase border-b">Add Record For:</div>
          {hiddenSources.map((ts, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onSelect(ts.source);
              }}
              className="w-full flex items-center text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-gray-700 truncate"
            >
              <span className={`inline-block shrink-0 w-2 h-2 rounded-full mr-2 ${ts.color?.replace('bg-', 'bg-').replace('text-', 'text-') || 'bg-gray-400'}`}></span>
              {isLocked(ts) && <span className="mr-1 text-[10px]">🔒</span>}
              <span className="truncate">{ts.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
