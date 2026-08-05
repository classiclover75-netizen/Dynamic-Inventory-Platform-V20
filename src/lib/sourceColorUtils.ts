import React from 'react';

export function collectUsedSourceColors(rows: any[], columns: any[]): string[] {
    const usedColors = new Set<string>();
    
    if (!rows || !columns) return [];

    const relevantCols = columns.filter((c: any) => c.type === ('multi_source' as any) || c.type === 'sale_tracker' || c.key === 'total_qty');

    rows.forEach(row => {
        relevantCols.forEach((col: any) => {
            const val = row[col.key];
            if (val && typeof val === 'string' && val.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            if (item.color) {
                                usedColors.add(item.color);
                            }
                        });
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });
    });

    return Array.from(usedColors);
}

// HSL golden-angle distribution to generate unlimited unique colors
export function generateUniqueSourceColor(usedColors: string[]): string {
    const usedHexColors = usedColors.filter(c => c.startsWith('#'));
    
    // We want to avoid exact matches with used hex colors.
    // A simple robust approach: just use the golden ratio to generate a sequence,
    // and take the Nth element where N is the number of used hex colors.
    
    const goldenRatioConjugate = 0.618033988749895;
    let hue = (usedHexColors.length * goldenRatioConjugate) % 1;
    
    // Convert hue to hex
    const h = hue;
    const s = 0.65; // keep saturation pleasant (65%)
    const l = 0.50; // keep lightness pleasant (50%)

    let r, g, b;

    if (s === 0 as any) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function getSourceChipStyle(color: string): { className: string; style?: React.CSSProperties } {
    if (!color) {
        return { className: 'bg-gray-100 text-gray-800 border-gray-200' };
    }

    if (color.startsWith('#')) {
        // Hex color - return inline styles
        // We tint the background and keep text dark
        return {
            className: 'border',
            style: {
                backgroundColor: `${color}20`, // 20% opacity for background tint
                color: '#1f2937', // text-gray-800
                borderColor: `${color}40`, // 40% opacity for border
            }
        };
    }

    // Legacy Tailwind string
    return { className: color };
}

export function updateSourceColorInRows(rows: any[], columns: any[], sourceName: string, hex: string): { rowId: string; colKey: string; newValue: string }[] {
    const changes: { rowId: string; colKey: string; newValue: string }[] = [];
    if (!rows || !columns || !sourceName) return changes;
    
    const relevantCols = columns.filter((c: any) => c.type === ('multi_source' as any) || c.type === 'sale_tracker' || c.key === 'total_qty');
    
    rows.forEach(row => {
        relevantCols.forEach((col: any) => {
            const val = row[col.key];
            if (val && typeof val === 'string' && val.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) {
                        let changed = false;
                        const newParsed = parsed.map(item => {
                            if (item.source && item.source.toLowerCase() === sourceName.toLowerCase()) {
                                if (item.color !== hex) {
                                    changed = true;
                                    return { ...item, color: hex };
                                }
                            }
                            return item;
                        });
                        
                        if (changed) {
                            changes.push({
                                rowId: row.id,
                                colKey: col.key,
                                newValue: JSON.stringify(newParsed)
                            });
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });
    });
    
    return changes;
}
