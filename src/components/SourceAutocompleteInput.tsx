import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "./ui";
import { parseMultiSource } from "../lib/appUtils";
import { RowData } from "../types";

export interface SourceSuggestion {
  source: string;
  color: string;
}

export function useSourceSuggestions(allRows: RowData[], currentBlocks: Record<string, any>[]) {
  return useMemo(() => {
    const sourcesMap = new Map<string, SourceSuggestion>();
    
    // 1. Scan existing rows
    (allRows || []).forEach((row) => {
      const parsed = parseMultiSource(row.total_qty);
      parsed.forEach((s: any) => {
        if (s.source && s.source.trim()) {
          const lower = s.source.trim().toLowerCase();
          if (!sourcesMap.has(lower)) {
            sourcesMap.set(lower, {
              source: s.source.trim(),
              color: s.color || "bg-gray-100 text-gray-800 border-gray-200"
            });
          }
        }
      });
    });

    // 2. Scan currently edited blocks
    (currentBlocks || []).forEach((block) => {
      if (block.total_qty) {
        const parsed = parseMultiSource(block.total_qty);
        parsed.forEach((s: any) => {
          if (s.source && s.source.trim()) {
            const lower = s.source.trim().toLowerCase();
            if (!sourcesMap.has(lower)) {
              sourcesMap.set(lower, {
                source: s.source.trim(),
                color: s.color || "bg-gray-100 text-gray-800 border-gray-200"
              });
            }
          }
        });
      }
    });

    return Array.from(sourcesMap.values());
  }, [allRows, currentBlocks]);
}

interface SourceAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: SourceSuggestion[];
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  isExistingSource?: boolean;
  dropdownPosition?: "bottom" | "top";
}

export const SourceAutocompleteInput: React.FC<SourceAutocompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  wrapperClassName = "",
  isExistingSource = false,
  dropdownPosition = "bottom",
}) => {
  const isFixed = isExistingSource;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0, bottom: 0 });

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

  useEffect(() => {
    if (showSuggestions && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        bottom: rect.bottom
      });
    }
  }, [showSuggestions, value]);

  // Close on scroll to avoid detached fixed dropdown
  useEffect(() => {
    if (!showSuggestions || !isFixed) return;
    const handleScroll = () => setShowSuggestions(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [showSuggestions, isFixed]);

  const filtered = (suggestions || []).filter(s => s.source.toLowerCase().includes((value || "").toLowerCase()));

  return (
    <div className={`${wrapperClassName || (isExistingSource ? "" : "flex-1 min-w-[80px]")} relative`} ref={wrapperRef}>
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

      {showSuggestions && filtered.length > 0 && !isFixed && dropdownPosition === "bottom" && (
        <div className="absolute left-0 w-[1px] pointer-events-none" style={{ top: "100%", height: "260px" }} aria-hidden="true" />
      )}
      {showSuggestions && filtered.length > 0 && (
        <div 
          className={`${isFixed ? "fixed z-[99999]" : "absolute z-[5]"} min-w-[140px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg p-1.5 flex flex-col gap-1.5`}
          style={isFixed ? {
            left: dropdownRect.left,
            ...(dropdownPosition === "top" 
              ? { bottom: window.innerHeight - dropdownRect.top + 4 } 
              : { top: dropdownRect.bottom + 4 }),
            minWidth: Math.max(dropdownRect.width, 140)
          } : {
            left: 0,
            ...(dropdownPosition === "top" 
              ? { bottom: "calc(100% + 4px)" } 
              : { top: "calc(100% + 4px)" }),
            minWidth: Math.max(dropdownRect.width, 140)
          }}
        >
          {filtered.map((s, idx) => (
            <div
              key={idx}
              className={`px-2 py-0.5 rounded text-[14px] font-bold border flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 ${s.color || "bg-gray-100 text-gray-800 border-gray-200"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.source);
                setShowSuggestions(false);
              }}
            >
              {s.source}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

