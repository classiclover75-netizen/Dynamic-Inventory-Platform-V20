import { isRetired } from './sourceArchiveUtils';

export function getVisibleSaleSources(column: any, totalSourcesRaw: any[], saleEntries: any[], inlineEditSource?: string | null) {
    return totalSourcesRaw.filter((ts: any) => {
        // Temporarily include if it's currently being edited in this cell
        if (inlineEditSource && inlineEditSource === ts.source) {
            return true;
        }

        if (!column.archived) {
            // Active (non-archived) sale column
            if (isRetired(ts)) {
                const saleEntry = saleEntries.find((s: any) => s.source === ts.source);
                return saleEntry && (parseFloat(saleEntry.qty) || 0) > 0;
            }
            return true;
        }

        // Archived sale column: show ONLY sources whose sale entry qty > 0 in that column
        const saleEntry = saleEntries.find((s: any) => s.source === ts.source);
        return saleEntry && (parseFloat(saleEntry.qty) || 0) > 0;
    });
}
