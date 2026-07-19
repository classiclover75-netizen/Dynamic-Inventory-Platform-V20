import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "./ui";
import { parseMultiSource } from "../lib/appUtils";
import { RowData } from "../types";

export function useSourceSuggestions(allRows: RowData[], currentBlocks: Record<string, any>[]) {
  return useMemo(() => {
    const sources = new Set<string>();
    
    // 1. Scan existing rows
    (allRows || []).forEach((row) => {
      const parsed = parseMultiSource(row.total_qty);
      parsed.forEach((s: any) => {
        if (s.source && s.source.trim()) {
          sources.add(s.source.trim());
        }
      });
    });

    // 2. Scan currently edited blocks
    (currentBlocks || []).forEach((block) => {
      if (block.total_qty) {
        const parsed = parseMultiSource(block.total_qty);
        parsed.forEach((s: any) => {
          if (s.source && s.source.trim()) {
            sources.add(s.source.trim());
          }
        });
      }
    });

    return Array.from(sources);
  }, [allRows, currentBlocks]);
}

interface SourceAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  isExistingSource?: boolean;
}

export const SourceAutocompleteInput: React.FC<SourceAutocompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  isExistingSource = false,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filtered = (suggestions || []).filter(s => s.toLowerCase().includes((value || "").toLowerCase()));

  return (
    <div className={`relative ${isExistingSource ? "" : "flex-1 min-w-[80px]"}`} ref={wrapperRef}>
      {isExistingSource ? (
        <input
          type="text"
          className={className}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
      ) : (
        <Input
          placeholder={placeholder}
          className={className}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
      )}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-[9999] left-0 mt-1 min-w-[120px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg">
          {filtered.map((s, idx) => (
            <div
              key={idx}
              className="px-3 py-2 cursor-pointer hover:bg-purple-100 text-sm text-gray-800"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setShowSuggestions(false);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
