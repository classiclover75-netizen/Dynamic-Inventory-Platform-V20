import { isRetired } from './sourceArchiveUtils';

export function getVisibleSaleSources(column: any, totalSourcesRaw: any[], saleEntries: any[]) {
    return totalSourcesRaw.filter((ts: any) => {
        // Keep existing retired-source rule intact: retired sources stay hidden unless their sale qty > 0 in that column.
        if (isRetired(ts)) {
            const saleEntry = saleEntries.find((s: any) => s.source === ts.source);
            return saleEntry && (parseFloat(saleEntry.qty) || 0) > 0;
        }

        // If column is the active (non-archived) sale column: return all totalSources (current behavior).
        if (!column.archived) {
            return true;
        }

        // If column.sourcesSnapshot exists (archived): return sources whose name is in snapshot OR that have an entry in saleEntries.
        if (column.sourcesSnapshot) {
            const inSnapshot = column.sourcesSnapshot.includes(ts.source);
            const saleEntry = saleEntries.find((s: any) => s.source === ts.source);
            return inSnapshot || !!saleEntry;
        }

        // Legacy archived column (no snapshot): return only sources that have an entry in saleEntries.
        const saleEntry = saleEntries.find((s: any) => s.source === ts.source);
        return !!saleEntry;
    });
}
