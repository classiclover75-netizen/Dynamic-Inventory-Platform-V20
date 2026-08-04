import { useState, useCallback, useMemo } from 'react';

export function useOverviewColumnPin(
  initialPinnedCols: string[] = [],
  onSavePinnedCols?: (cols: string[]) => void,
  getColWidth?: (id: string) => number,
  colWidths?: Record<string, number>
) {
  const [pinnedCols, setPinnedCols] = useState<string[]>(initialPinnedCols);

  const togglePin = useCallback((colId: string) => {
    setPinnedCols(prev => {
      let next;
      if (prev.includes(colId)) {
        next = prev.filter(id => id !== colId);
      } else {
        next = [...prev, colId];
      }
      if (onSavePinnedCols) onSavePinnedCols(next);
      return next;
    });
  }, [onSavePinnedCols]);

  const pinnedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = 0;
    for (const colId of pinnedCols) {
      offsets[colId] = currentOffset;
      currentOffset += (getColWidth ? getColWidth(colId) : 150);
    }
    return offsets;
  }, [pinnedCols, getColWidth, colWidths]);

  return {
    pinnedCols,
    togglePin,
    pinnedOffsets
  };
}
