import React, { useState, useMemo } from 'react';
import { buildRetiredOverview, RetiredSourceOverview, RetiredItemInfo } from '../lib/retiredOverviewUtils';

export function RetiredSourcesOverviewModal({
  isOpen,
  onClose,
  rows,
  columns
}: {
  isOpen: boolean;
  onClose: () => void;
  rows: any[];
  columns: any[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<RetiredSourceOverview | null>(null);

  const overviewData = useMemo(() => {
    if (!isOpen) return [];
    return buildRetiredOverview(rows, columns);
  }, [isOpen, rows, columns]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return overviewData;
    return overviewData.filter(s => s.sourceName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [overviewData, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-[600px] shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {selectedSource ? (
              <>
                <button onClick={() => setSelectedSource(null)} className="mr-2 text-gray-500 hover:text-gray-800 bg-transparent border-0 cursor-pointer">
                  ← Back
                </button>
                <span className="text-purple-700">📦 {selectedSource.sourceName}</span>
              </>
            ) : (
              "🗄️ Retired Sources Overview"
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-gray-50">
          {selectedSource ? (
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 font-bold uppercase">Total Retired Qty</div>
                  <div className="text-2xl font-black text-purple-700">{selectedSource.totalRetiredQty}</div>
                </div>
                <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 font-bold uppercase">Affected Items</div>
                  <div className="text-2xl font-black text-blue-700">{selectedSource.itemCount}</div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedSource.items.map((item, i) => (
                  <ItemRow key={i} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="🔍 Search retired sources..."
                  className="w-full border-2 border-[#d7dde1] p-2 rounded-md outline-none focus:border-purple-500 text-sm font-semibold transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredData.length === 0 ? (
                  <div className="text-center p-8 text-gray-500 bg-white rounded border border-gray-200">
                    {searchQuery ? "No matching sources found." : "No retired sources found in this tracker."}
                  </div>
                ) : (
                  filteredData.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedSource(s)}
                      className="bg-white p-3 rounded border border-gray-200 shadow-sm hover:shadow hover:border-purple-300 cursor-pointer transition-all flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-gray-800 text-base">{s.sourceName}</div>
                        <div className="text-xs text-gray-500 mt-1">Appears in {s.itemCount} items</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 font-bold uppercase mb-1">Retired Qty</div>
                        <div className="font-black text-purple-700 text-lg">{s.totalRetiredQty}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 border-0 cursor-pointer text-gray-800 rounded font-bold text-sm transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: RetiredItemInfo; key?: any }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="font-bold text-gray-800 flex-1 truncate pr-4">{item.itemLabel}</div>
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[60px]">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Sales</div>
            <div className="font-bold text-blue-600">{item.totalSales}</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-[10px] text-gray-400 font-bold uppercase">Retired</div>
            <div className="font-bold text-purple-700">{item.retiredQty}</div>
          </div>
        </div>
      </div>
      
      {item.perSaleColumn.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-gray-500 bg-transparent border-0 cursor-pointer hover:text-gray-800 flex items-center gap-1 p-0"
          >
            {expanded ? "▼ Hide" : "▶ Show"} sale columns breakdown
          </button>
          
          {expanded && (
            <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
              {item.perSaleColumn.map((sc, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-600">{sc.colName}</span>
                  <span className="font-bold text-gray-800">{sc.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
