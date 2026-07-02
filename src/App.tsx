import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Settings,
  Plus,
  X,
  Trash2,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Lock,
  Undo2,
  Redo2,
  History,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Button, Input } from "./components/ui";
import { ToastProvider, useToast } from "./components/ToastProvider";
import { CopyPopupNotification } from "./components/CopyPopupNotification";
import { CreatePageModal } from "./components/CreatePageModal";
import { AddRowModal } from "./components/AddRowModal";
import { BulkApplySourceModal } from "./components/BulkApplySourceModal";
import { ActivePageSettingsModal } from "./components/ActivePageSettingsModal";
import { RenamePageModal } from "./components/RenamePageModal";
import { CreateColumnModal } from "./components/CreateColumnModal";
import { EditColumnModal } from "./components/EditColumnModal";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { ReorderPagesModal } from "./components/ReorderPagesModal";
import { ReorderSearchBarsModal } from "./components/ReorderSearchBarsModal";
import { ExcelImportModal } from "./components/ExcelImportModal";
import { ExcelExportModal } from "./components/ExcelExportModal";
import { ExportChoiceModal } from "./components/ExportChoiceModal";
import { DuplicateFinderModal } from "./components/DuplicateFinderModal";
import { GlobalCombinationCopyBoxes } from "./components/GlobalCombinationCopyBoxes";
import { GlobalCopyBoxesSettingsModal } from "./components/GlobalCopyBoxesSettingsModal";
import { CreateTrackerSelectionModal } from "./components/CreateTrackerSelectionModal";
import {
  AppState,
  Column,
  PageConfig,
  RowData,
} from "./types";

const initialConfig: PageConfig = {
  rowReorderEnabled: false,
  hoverPreviewEnabled: false,
  columns: [
    {
      key: "sr",
      name: "Row No.",
      type: "system_serial",
      locked: true,
      movable: false,
    },
  ],
};

const decodeHtmlEntities = (text: string) => {
  if (!text) return text;
  return String(text)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
};

const renderHighlightedText = (text: string, highlight: string) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span
            key={i}
            className="bg-yellow-200 text-black px-1 rounded font-bold"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
};

const parseMultiSourceCache = new Map<any, any[]>();

const parseMultiSource = (val: any) => {
  if (!val) return [];
  if (parseMultiSourceCache.has(val)) {
    const cached = parseMultiSourceCache.get(val);
    return cached ? cached.map((item: any) => ({ ...item })) : [];
  }

  let result: any[];
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    const arr = Array.isArray(parsed) ? parsed : [];
    result = arr.sort((a: any, b: any) => String(a.source || "").localeCompare(String(b.source || "")));
  } catch (e) {
    // Fallback for legacy flat numbers
    result = [
      {
        source: "Default",
        qty: parseFloat(String(val)) || 0,
        color: "bg-gray-100 text-gray-800 border-gray-200",
      },
    ];
  }
  
  try {
    if (typeof val === 'string' || typeof val === 'number') {
      if (parseMultiSourceCache.size > 5000) {
        parseMultiSourceCache.clear();
      }
      parseMultiSourceCache.set(val, result.map((item: any) => ({ ...item })));
    }
  } catch (e) {
    // Safety fallback
  }
  
  return result.map((item: any) => ({ ...item }));
};


const ColumnResizeHandle = ({
  header,
  onManualSave,
}: {
  header: any;
  onManualSave?: (id: string, width: number) => void;
}) => {
  const isResizing = header?.column?.getIsResizing();
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showManualInput, setShowManualInput] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  if (!header) return null;

  const handleManualSave = () => {
    let val = parseInt(inputValue);
    if (!isNaN(val)) {
      if (val < 20) val = 20;
      if (onManualSave) {
        onManualSave(header.column.id, val);
      }
      // Immediate UI update by poking table sizing state if possible
      if (header?.getContext?.()?.table?.setColumnSizing) {
        header.getContext().table.setColumnSizing((old: any) => ({
          ...old,
          [header.column.id]: val,
        }));
      }
    }
    setShowManualInput(false);
  };

  return (
    <>
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
          setIsDragging(true);
          setMousePos({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
          setIsDragging(true);
          if (e.touches[0]) {
            setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!e.ctrlKey && !e.metaKey) return;
          setInputValue(Math.round(header.getSize()).toString());
          setMousePos({ x: e.clientX, y: e.clientY });
          setShowManualInput(true);
        }}
        title="Drag to resize, Ctrl+Double-Click for exact width"
        className={`absolute right-0 top-0 z-40 cursor-col-resize hover:bg-[#ADFF2F] touch-none select-none transition-colors w-[4px] h-full ${
          isResizing ? "bg-[#ADFF2F]" : ""
        }`}
      />
      {isDragging &&
        createPortal(
          <div
            className="fixed z-[10000] pointer-events-none bg-black/90 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-xl whitespace-nowrap"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y - 40}px`,
              transform: "translateX(-50%)",
            }}
          >
            {Math.round(header.getSize())}px
          </div>,
          document.body,
        )}
      {showManualInput &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => setShowManualInput(false)}
            />
            <div
              className="fixed z-[10001] bg-white border border-gray-300 p-3 rounded shadow-2xl flex flex-col gap-2.5 min-w-[200px]"
              style={{
                left: `${mousePos.x}px`,
                top: `${mousePos.y}px`,
                transform: "translate(-50%, -110%)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider border-b pb-1">
                Column Resizing
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-20 px-2 py-1 border rounded text-sm focus:outline-blue-500"
                  value={inputValue}
                  onBlur={handleManualSave}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setInputValue(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSave();
                    if (e.key === "Escape") setShowManualInput(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={handleManualSave}
                  className="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowManualInput(false)}
                  className="bg-red-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-red-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
};

function AppContent() {
  const [state, setState] = useState<AppState>({
    pages: [],
    activePage: "",
    pageConfigs: {},
    pageRows: {},
    globalRowNoWidth: 100,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    message: string;
    percent: number | null;
  }>({ message: "Verifying and packaging backup, please wait...", percent: null });
  const [clearDBModal, setClearDBModal] = useState({
    isOpen: false,
    step: 1,
    yesLeft: true,
  });
  const [maxSearchHistory, setMaxSearchHistory] = useState(10);
  const [showHistoryLimitModal, setShowHistoryLimitModal] = useState(false);
  const [tempHistoryLimit, setTempHistoryLimit] = useState(10);
  const [trackerSelectionModalSource, setTrackerSelectionModalSource] =
    useState<string | null>(null);

  const [localSettings, setLocalSettings] = useState({ ghostHighlight: false });

  useEffect(() => {
    const saved = localStorage.getItem("inventory_local_settings");
    if (saved) {
      setLocalSettings(JSON.parse(saved));
    }
  }, []);

  const handleUpdateLocalSetting = (key: "ghostHighlight", value: boolean) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    localStorage.setItem(
      "inventory_local_settings",
      JSON.stringify(newSettings),
    );
    toast(`${key} updated for this device`);
  };

  const handleClearEntireDB = async () => {
    const emptyState = {
      pages: [],
      pageConfigs: {},
      pageRows: {},
      globalRowNoWidth: state.globalRowNoWidth,
    };
    try {
      await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emptyState),
      });
      toast("Database cleared completely!");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      toast("Failed to clear database");
    }
  };

  const getImageUrl = (val: any, isThumb = false) => {
    if (!val) return "";
    const imgData = typeof val === "object" && val !== null ? val.data : val;
    if (!imgData) return "";

    if (
      typeof imgData === "string" &&
      (imgData.startsWith("data:image") || /^https?:\/\//i.test(imgData))
    ) {
      if (isThumb && imgData.includes('/uploads/')) {
        const filename = imgData.split('/uploads/').pop()?.split('?')[0];
        if (filename) return `/uploads/thumb/${filename}`;
      }
      return imgData;
    }

    if (typeof imgData === "string" && imgData.startsWith("/uploads/")) {
      if (isThumb) {
        const filename = imgData.split('/uploads/').pop()?.split('?')[0];
        if (filename) return `/uploads/thumb/${filename}`;
      }
      return imgData;
    }

    return isThumb ? `/uploads/thumb/${imgData}` : `/uploads/${imgData}`;
  };

  const hoveredCellRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    fetch("/api/state")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlPage = urlParams.get("page");
          const isValidPage =
            urlPage && data.pages && data.pages.includes(urlPage);

          setState((prev) => ({
            ...prev,
            pages: data.pages || [],
            globalRowNoWidth: data.globalRowNoWidth || prev.globalRowNoWidth,
            activePage: isValidPage
              ? urlPage
              : data.pages && data.pages.length > 0 && !prev.activePage
                ? data.pages[0]
                : prev.activePage,
          }));
          if (data.maxSearchHistory) setMaxSearchHistory(data.maxSearchHistory);
        }
      })
      .catch((err) => console.error("Failed to fetch initial state:", err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (state.activePage) {
      window.history.replaceState(
        null,
        "",
        "?page=" + encodeURIComponent(state.activePage),
      );
    }
  }, [state.activePage]);

  useEffect(() => {
    if (!state.activePage) return;

    const fetchPageData = async (pageName: string) => {
      try {
        const res = await fetch(`/api/pages/${encodeURIComponent(pageName)}`);
        const data = await res.json();
        if (data && !data.error) {
          setState((prev) => ({
            ...prev,
            pageConfigs: {
              ...prev.pageConfigs,
              [data.name]: data.config,
            },
            pageRows: {
              ...prev.pageRows,
              [data.name]: data.rows,
            },
          }));
          return data.config;
        }
      } catch (err) {
        console.error("Failed to fetch page data:", err);
      }
      return null;
    };

    const loadData = async () => {
      let activeConfig = state.pageConfigs[state.activePage];

      if (!activeConfig) {
        setIsLoading(true);
        activeConfig = await fetchPageData(state.activePage);
      }

      if (
        activeConfig &&
        activeConfig.secondarySearchPage &&
        !state.pageConfigs[activeConfig.secondarySearchPage]
      ) {
        setIsLoading(true);
        await fetchPageData(activeConfig.secondarySearchPage);
      }

      setIsLoading(false);
    };

    const activeConfig = state.pageConfigs[state.activePage];
    if (
      !activeConfig ||
      (activeConfig.secondarySearchPage &&
        !state.pageConfigs[activeConfig.secondarySearchPage])
    ) {
      loadData();
    }
  }, [state.activePage, state.pageConfigs]);

  const applyHover = (td: HTMLTableCellElement) => {
    const tr = td.parentElement as HTMLTableRowElement;
    if (!tr) return;
    const table = tr.closest("table");
    if (!table) return;

    const cellIndex = td.cellIndex;

    td.dataset.hoveredExact = "true";

    const cellsInRow = tr.children;
    for (let i = 0; i < cellsInRow.length; i++) {
      const cell = cellsInRow[i] as HTMLTableCellElement;
      cell.dataset.hoveredRow = "true";
    }

    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      const cellInCol = rows[i].children[cellIndex] as HTMLTableCellElement;
      if (cellInCol) {
        cellInCol.dataset.hoveredCol = "true";
      }
    }
  };

  const cleanupHover = (td: HTMLTableCellElement) => {
    const root = td.closest("table") || document;

    const exacts = root.querySelectorAll("[data-hovered-exact]");
    for (let i = 0; i < exacts.length; i++) {
      delete (exacts[i] as HTMLElement).dataset.hoveredExact;
    }

    const rows = root.querySelectorAll("[data-hovered-row]");
    for (let i = 0; i < rows.length; i++) {
      delete (rows[i] as HTMLElement).dataset.hoveredRow;
    }

    const cols = root.querySelectorAll("[data-hovered-col]");
    for (let i = 0; i < cols.length; i++) {
      delete (cols[i] as HTMLElement).dataset.hoveredCol;
    }
  };

  const handleTableMouseOver = (e: React.MouseEvent<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest(
      "td, th",
    ) as HTMLTableCellElement;
    if (!td) return;

    if (hoveredCellRef.current === td) return;

    if (hoveredCellRef.current) {
      cleanupHover(hoveredCellRef.current);
    }

    hoveredCellRef.current = td;
    applyHover(td);
  };

  const handleTableMouseOut = (e: React.MouseEvent<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest(
      "td, th",
    ) as HTMLTableCellElement;
    if (!td) return;

    const relatedTarget = e.relatedTarget as HTMLElement;
    if (td.contains(relatedTarget)) return;

    if (hoveredCellRef.current === td) {
      cleanupHover(td);
      hoveredCellRef.current = null;
    }
  };
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<HTMLElement | null>(null);

  const [pageSearchQueries, setPageSearchQueries] = useState<
    Record<string, string>
  >({});
  const [primarySearchTags, setPrimarySearchTags] = useState<string[]>([]);
  const [secondarySearchTags, setSecondarySearchTags] = useState<string[]>([]);
  const currentSearch = pageSearchQueries[state.activePage] || "";
  const [secondarySearchQuery, setSecondarySearchQuery] = useState("");
  const [activeSearchView, setActiveSearchView] = useState<
    "primary" | "secondary"
  >("primary");
  const [showTopSettings, setShowTopSettings] = useState(false);
  const [isDupModalOpen, setIsDupModalOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  type HistoryEntry = { value: string; timestamp: number };
  const [primarySearchInput, setPrimarySearchInput] = useState("");
  const [secondarySearchInput, setSecondarySearchInput] = useState("");

  const [primHist, setPrimHist] = useState<{
    entries: HistoryEntry[];
    pointer: number;
  }>({ entries: [{ value: "", timestamp: Date.now() }], pointer: 0 });
  const [showPrimHist, setShowPrimHist] = useState(false);
  const primHistRef = useRef<HTMLDivElement>(null);
  const isPrimUndoRef = useRef(false);

  const [secHist, setSecHist] = useState<{
    entries: HistoryEntry[];
    pointer: number;
  }>({ entries: [{ value: "", timestamp: Date.now() }], pointer: 0 });
  const [showSecHist, setShowSecHist] = useState(false);
  const secHistRef = useRef<HTMLDivElement>(null);
  const isSecUndoRef = useRef(false);
  const pendingSavesRef = useRef(0);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSavesRef.current > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const activeSecPage =
    state.pageConfigs[state.activePage]?.secondarySearchPage;

  useEffect(() => {
    const pVal = pageSearchQueries[state.activePage] || "";
    const sVal = activeSecPage ? pageSearchQueries[activeSecPage] || "" : "";
    setPrimarySearchInput(pVal);
    setSecondarySearchInput(sVal);
    setActiveSearchView("primary");
    setPrimHist({
      entries: [{ value: pVal, timestamp: Date.now() }],
      pointer: 0,
    });
    setSecHist({
      entries: [{ value: sVal, timestamp: Date.now() }],
      pointer: 0,
    });
  }, [state.activePage, activeSecPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageSearchQueries((prev) =>
        prev[state.activePage] === primarySearchInput
          ? prev
          : { ...prev, [state.activePage]: primarySearchInput },
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [primarySearchInput, state.activePage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSecondarySearchQuery(secondarySearchInput);
      if (activeSecPage)
        setPageSearchQueries((prev) =>
          prev[activeSecPage] === secondarySearchInput
            ? prev
            : { ...prev, [activeSecPage]: secondarySearchInput },
        );
    }, 250);
    return () => clearTimeout(timer);
  }, [secondarySearchInput, activeSecPage]);

  useEffect(() => {
    if (isPrimUndoRef.current) {
      isPrimUndoRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPrimHist((prev) => {
        if (prev.entries[prev.pointer]?.value === primarySearchInput)
          return prev;
        const newEntries = [
          ...prev.entries.slice(0, prev.pointer + 1),
          { value: primarySearchInput, timestamp: Date.now() },
        ];
        while (newEntries.length > maxSearchHistory) newEntries.shift();
        return { entries: newEntries, pointer: newEntries.length - 1 };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [primarySearchInput, maxSearchHistory]);

  useEffect(() => {
    if (isSecUndoRef.current) {
      isSecUndoRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSecHist((prev) => {
        if (prev.entries[prev.pointer]?.value === secondarySearchInput)
          return prev;
        const newEntries = [
          ...prev.entries.slice(0, prev.pointer + 1),
          { value: secondarySearchInput, timestamp: Date.now() },
        ];
        while (newEntries.length > maxSearchHistory) newEntries.shift();
        return { entries: newEntries, pointer: newEntries.length - 1 };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [secondarySearchInput, maxSearchHistory]);

  const formatHistDate = (ts: number) => {
    const d = new Date(ts);
    const time = d
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      .replace(/\s/g, "-");
    const date = `${d.getDate()}-${d.toLocaleString("en-US", { month: "long" })}-${d.getFullYear()}`;
    return `${time}, ${date}`;
  };

  const handlePrimUndo = () =>
    setPrimHist((prev) => {
      if (prev.pointer > 0) {
        isPrimUndoRef.current = true;
        setPrimarySearchInput(prev.entries[prev.pointer - 1].value);
        return { ...prev, pointer: prev.pointer - 1 };
      }
      return prev;
    });
  const handlePrimRedo = () =>
    setPrimHist((prev) => {
      if (prev.pointer < prev.entries.length - 1) {
        isPrimUndoRef.current = true;
        setPrimarySearchInput(prev.entries[prev.pointer + 1].value);
        return { ...prev, pointer: prev.pointer + 1 };
      }
      return prev;
    });
  const handleSecUndo = () =>
    setSecHist((prev) => {
      if (prev.pointer > 0) {
        isSecUndoRef.current = true;
        setSecondarySearchInput(prev.entries[prev.pointer - 1].value);
        return { ...prev, pointer: prev.pointer - 1 };
      }
      return prev;
    });
  const handleSecRedo = () =>
    setSecHist((prev) => {
      if (prev.pointer < prev.entries.length - 1) {
        isSecUndoRef.current = true;
        setSecondarySearchInput(prev.entries[prev.pointer + 1].value);
        return { ...prev, pointer: prev.pointer + 1 };
      }
      return prev;
    });

  const handleAddPrimaryTag = () => {
    if (primarySearchInput.trim()) {
      setPrimarySearchTags((prev) => [...prev, primarySearchInput.trim()]);
      setPrimarySearchInput("");
    }
  };

  const handleRemovePrimaryTag = (index: number) => {
    setPrimarySearchTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSecondaryTag = () => {
    if (secondarySearchInput.trim()) {
      setSecondarySearchTags((prev) => [...prev, secondarySearchInput.trim()]);
      setSecondarySearchInput("");
    }
  };

  const handleRemoveSecondaryTag = (index: number) => {
    setSecondarySearchTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrimKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPrimaryTag();
    }
    if (e.key === "Backspace" && primarySearchInput === "")
      setPrimarySearchTags((prev) => prev.slice(0, -1));
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.shiftKey ? handlePrimRedo() : handlePrimUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      handlePrimRedo();
    }
  };

  const handleSecKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSecondaryTag();
    }
    if (e.key === "Backspace" && secondarySearchInput === "")
      setSecondarySearchTags((prev) => prev.slice(0, -1));
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.shiftKey ? handleSecRedo() : handleSecUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      handleSecRedo();
    }
  };

  const handleClosePopup = React.useCallback(() => {
    setActivePopupId(null);
  }, []);

  const handleExportData = () => {
    window.open("/api/export-zip");
    toast("Export started. Check your downloads.");
  };

  const handleVerifiedExport = async () => {
    setIsExporting(true);
    setExportProgress({ message: "Verifying and packaging backup, please wait...", percent: null });
    try {
      const response = await fetch('/api/export-zip-verified');
      if (!response.ok) {
        const errorData = await response.json();
        toast(errorData.error || "Verified export failed.");
        return;
      }
      
      const contentLength = response.headers.get('Content-Length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let receivedBytes = 0;
      
      let blob: Blob;
      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            setExportProgress({
              message: "Downloading verified backup...",
              percent: Math.round((receivedBytes / totalBytes) * 100)
            });
          }
        }
        blob = new Blob(chunks, { type: response.headers.get('Content-Type') || 'application/zip' });
      } else {
        blob = await response.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Full_Backup_verified.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast("Verified backup downloaded.");
    } catch (error) {
      console.error(error);
      toast("Verified export failed.");
    } finally {
      setIsExporting(false);
      setExportProgress({ message: "Verifying and packaging backup, please wait...", percent: null });
    }
  };

  const refetchAndHydrateState = async () => {
    try {
      setImportProgress({ message: "Re-syncing UI state...", percent: 99 });
      const stateRes = await fetch("/api/state");
      const stateData = await stateRes.json();
      if (!stateData || stateData.error) throw new Error("Failed to fetch state");

      const newPages = stateData.pages || [];
      const newConfigs: Record<string, any> = {};
      const newRows: Record<string, any[]> = {};

      for (const pageName of newPages) {
        const pageRes = await fetch(`/api/pages/${encodeURIComponent(pageName)}`);
        const pageData = await pageRes.json();
        if (pageData && !pageData.error) {
          newConfigs[pageName] = pageData.config;
          newRows[pageName] = pageData.rows;
        }
      }

      let nextActivePage = state.activePage;
      if (!newPages.includes(nextActivePage)) {
        nextActivePage = newPages.length > 0 ? newPages[0] : "";
      }

      if (!Array.isArray(newPages) || newPages.length === 0 || !nextActivePage) {
        console.error("Hydration: imported pages list is empty");
        toast("Import finished but no pages found. Please verify the backup.");
        setImportProgress({ message: "Import finished but no pages found.", percent: null });
        setIsImporting(false);
        return;
      }

      setState((prev) => ({
        ...prev,
        pages: newPages,
        activePage: nextActivePage,
        pageConfigs: newConfigs,
        pageRows: newRows,
        globalRowNoWidth: stateData.globalRowNoWidth || prev.globalRowNoWidth,
      }));

      if (stateData.maxSearchHistory) {
        setMaxSearchHistory(stateData.maxSearchHistory);
      }

      if (nextActivePage) {
        window.history.replaceState(null, "", "?page=" + encodeURIComponent(nextActivePage));
      }

      setImportProgress({ message: "Data imported successfully!", percent: 100 });
      toast("Data imported successfully");
      setIsImporting(false);
    } catch (err) {
      console.error("Hydration failed:", err);
      toast("Data imported but UI refresh failed. Please refresh the page manually.");
      setIsImporting(false);
      setImportProgress({ message: "Processing...", percent: null });
    }
  };

  const handleImportPageData = async (file: File) => {
    const activePage = state.activePage;
    if (!activePage) return;

    setIsImporting(true);
    const isZip = file.name.toLowerCase().endsWith(".zip");
    setImportProgress({
      message: `Processing ${isZip ? "ZIP" : "JSON"} file...`,
      percent: null,
    });

    try {
      if (isZip) {
        const formData = new FormData();
        formData.append("backup", file);

        const response = await fetch("/api/import-zip", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          await refetchAndHydrateState();
        } else {
          const errData = await response.json().catch(() => ({}));
          toast(errData.error || "Failed to sync with server");
          setIsImporting(false);
          setImportProgress({ message: "Processing...", percent: null });
        }
      } else {
        // Handle JSON
        const text = await file.text();
        const parsed = JSON.parse(text);

        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        if (response.ok) {
          await refetchAndHydrateState();
        } else {
          const errData = await response.json().catch(() => ({}));
          toast(errData.error || "Failed to sync with server");
          setIsImporting(false);
          setImportProgress({ message: "Processing...", percent: null });
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast("An error occurred during import");
      setIsImporting(false);
      setImportProgress({ message: "Processing...", percent: null });
    }
  };

  const [importProgress, setImportProgress] = useState<{
    message: string;
    percent: number | null;
  }>({ message: "Processing...", percent: null });
  const [trackerFilter, setTrackerFilter] = useState<
    "all" | "low" | "zero" | "high"
  >("all");
  const [activeFilterSaleCol, setActiveFilterSaleCol] = useState<string | null>(
    null,
  );
  const [trackerSort, setTrackerSort] = useState<"none" | "high" | "low">(
    "none",
  );
  const [showArchived, setShowArchived] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{
    id: string;
    colKey: string;
    val: string;
    history?: string[];
    historyPointer?: number;
  } | null>(null);
  const [isSalePromptOpen, setIsSalePromptOpen] = useState(false);
  const [isSumModalOpen, setIsSumModalOpen] = useState(false);
  const [sumStartCol, setSumStartCol] = useState<string>("");
  const [sumEndCol, setSumEndCol] = useState<string>("");
  const [sumStartSearchQuery, setSumStartSearchQuery] = useState("");
  const [sumEndSearchQuery, setSumEndSearchQuery] = useState("");
  const [activeCustomSum, setActiveCustomSum] = useState<{
    startName: string;
    endName: string;
    keys: string[];
    selectedSources: string[];
  } | null>(null);
  const [sumSelectedSources, setSumSelectedSources] = useState<string[]>([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isArchiveDeleteModalOpen, setIsArchiveDeleteModalOpen] =
    useState(false);
  const [archiveDeleteSearchQuery, setArchiveDeleteSearchQuery] = useState("");
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [customSaleName, setCustomSaleName] = useState("");
  const [selectedArchiveCols, setSelectedArchiveCols] = useState<Set<string>>(
    new Set(),
  );
  const [archiveBulkDeleteConfirm, setArchiveBulkDeleteConfirm] = useState<{
    type: "normal" | "smart";
    step: number;
  } | null>(null);

  const handleImportData = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const isZip = file.name.toLowerCase().endsWith(".zip");
    setImportProgress({
      message: `Processing ${isZip ? "ZIP" : "JSON"} file...`,
      percent: null,
    });

    try {
      if (isZip) {
        const formData = new FormData();
        formData.append("backup", file);

        const response = await fetch("/api/import-zip", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          await refetchAndHydrateState();
        } else {
          const errData = await response.json().catch(() => ({}));
          toast(errData.error || "Failed to sync with server");
          setIsImporting(false);
        }
      } else {
        // Handle JSON
        const text = await file.text();
        const parsed = JSON.parse(text);

        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        if (response.ok) {
          await refetchAndHydrateState();
        } else {
          const errData = await response.json().catch(() => ({}));
          toast(errData.error || "Failed to sync with server");
          setIsImporting(false);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast("Error during server sync");
      setIsImporting(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setShowTopSettings(false);
      }
      if (
        primHistRef.current &&
        !primHistRef.current.contains(event.target as Node)
      )
        setShowPrimHist(false);
      if (
        secHistRef.current &&
        !secHistRef.current.contains(event.target as Node)
      )
        setShowSecHist(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalUndoPrevent = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")
      ) {
        const target = e.target as HTMLElement;
        // Block native undo completely if the user is NOT actively focused on an input.
        // This stops background inputs from reverting when clicking on empty space.
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalUndoPrevent, true);
    return () =>
      window.removeEventListener("keydown", handleGlobalUndoPrevent, true);
  }, []);

  // Modals state
  const [modals, setModals] = useState({
    createPage: false,
    addRow: false,
    activePageSettings: false,
    renamePage: false,
    createColumn: false,
    imagePreview: false,
    editColumn: false,
    reorderPages: false,
    reorderSearchBars: false,
    excelImport: false,
    excelExport: false,
    exportChoice: false,
    globalCopyBoxesSettings: false,
    bulkApplySource: false,
  });

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [bulkApplyContext, setBulkApplyContext] = useState<{pageName: string, colKey: string, sourceName: string, sourceColor: string} | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [previewContext, setPreviewContext] = useState<{
    rowId: string;
    imageKey: string;
    pageName: string;
  } | null>(null);
  const [returnToSettings, setReturnToSettings] = useState(false);
  const [returnToImagePreview, setReturnToImagePreview] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<{
    url: string;
    x: number;
    y: number;
  } | null>(null);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [excelImportData, setExcelImportData] = useState<{
    rows: any[];
    headers: string[];
  }>({ rows: [], headers: [] });
  const [box1Value, setBox1Value] = useState("");
  const [box2Value, setBox2Value] = useState("");

  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [state.activePage]);

  const handleToggleMagicPasteColumn = (colKey: string) => {
    setState((prev) => {
      const pageConfig = prev.pageConfigs[prev.activePage];
      if (!pageConfig) return prev;

      const updatedColumns = pageConfig.columns.map((col) =>
        col.key === colKey
          ? { ...col, magicPasteDisabled: !col.magicPasteDisabled }
          : col,
      );

      return {
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [prev.activePage]: {
            ...pageConfig,
            columns: updatedColumns,
          },
        },
      };
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceIdx = result.source.index;
    const destIdx = result.destination.index;
    if (sourceIdx === destIdx) return;

    const draggedRowId = result.draggableId;
    const targetPage = state.activePage;
    const rows = [...(state.pageRows[targetPage] || [])];
    const isMultiDrag =
      selectedRowIds.has(draggedRowId) && selectedRowIds.size > 1;
    let newRows: RowData[] = [];

    if (isMultiDrag) {
      const selectedRows = rows.filter((r) => selectedRowIds.has(r.id));
      const remainingRows = rows.filter((r) => !selectedRowIds.has(r.id));

      let insertIdx = destIdx;
      if (sourceIdx < destIdx) {
        insertIdx = destIdx - selectedRows.length + 1;
      }

      remainingRows.splice(insertIdx, 0, ...selectedRows);
      newRows = remainingRows;
    } else {
      const draggedIdx = rows.findIndex((r) => r.id === draggedRowId);
      if (draggedIdx === -1) return;

      const [draggedRow] = rows.splice(draggedIdx, 1);
      rows.splice(destIdx, 0, draggedRow);
      newRows = rows;
    }

    try {
      await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newRows.map(r => r.id) }),
      });

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: newRows,
        },
      }));
    } catch (err) {
      console.error(err);
      toast("Failed to save reordered rows to database");
    }
  };

  const toggleModal = React.useCallback(
    (modal: keyof typeof modals, value: boolean) => {
      setModals((prev) => ({ ...prev, [modal]: value }));
    },
    [],
  );

  const closeAllModals = React.useCallback(() => {
    setModals({
      createPage: false,
      addRow: false,
      activePageSettings: false,
      renamePage: false,
      createColumn: false,
      editColumn: false,
      imagePreview: false,
      reorderPages: false,
      reorderSearchBars: false,
      excelImport: false,
      excelExport: false,
      exportChoice: false,
      globalCopyBoxesSettings: false,
      bulkApplySource: false,
    });
    setEditingRowId(null);
    setEditingPageName(null);
    setEditingColumn(null);
    setPreviewContext(null);
    setReturnToSettings(false);
    setReturnToImagePreview(false);
  }, []);

  const activeConfig = state.pageConfigs[state.activePage] || initialConfig;
  const activeRows = state.pageRows[state.activePage] || [];

  const handleSyncTracker = async (trackerName: string) => {
    try {
      const trackerConfig = state.pageConfigs[trackerName];
      if (!trackerConfig || !trackerConfig.linkedSourcePage) return;

      const sourcePage = trackerConfig.linkedSourcePage;
      const isSourcePagePresent = state.pages.includes(sourcePage) && !!state.pageConfigs[sourcePage];
      
      if (!isSourcePagePresent) {
        toast("Sync blocked: source page is missing. Syncing now would erase this tracker's data. Re-import or recreate the source page first.");
        return;
      }

      const sourceRows = state.pageRows[sourcePage] || [];
      const trackerRows = state.pageRows[trackerName] || [];

      if (sourceRows.length === 0 && trackerRows.length > 0) {
        if (!window.confirm(`Warning: The source page "${sourcePage}" currently has 0 rows. Syncing will erase all rows in this tracker. Are you sure you want to proceed?`)) {
          return;
        }
      }

      const trackerRowsMap = new Map();
      for (const tr of trackerRows) {
        if (tr.id) trackerRowsMap.set(String(tr.id), tr);
      }

      const repairedTrackerRows = sourceRows.map((sr: any) => {
        const existingTr = trackerRowsMap.get(String(sr.id));
        if (existingTr) {
          const trackerKeysToKeep = [
            "total_qty",
            "remaining_qty",
            ...trackerConfig.columns
              .filter((c: any) => c.type === "sale_tracker")
              .map((c: any) => c.key),
          ];
          const preservedData: any = {};
          for (const k of trackerKeysToKeep) {
            if (k in existingTr) preservedData[k] = existingTr[k];
          }
          return { ...sr, ...preservedData };
        } else {
          return { ...sr, total_qty: "0" };
        }
      });

      const response = await fetch(
        `/api/pageRows/${encodeURIComponent(trackerName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: repairedTrackerRows }),
        },
      );
      if (!response.ok) throw new Error("Failed to sync to server");

      setState((prev) => ({
        ...prev,
        pageRows: { ...prev.pageRows, [trackerName]: repairedTrackerRows },
      }));

      toast("Tracker synced successfully!");
    } catch (err) {
      console.error("Sync error:", err);
      toast("Failed to sync tracker.");
    }
  };

  const handleCreateTracker = async (
    sourcePage: string,
    selectedColKeys?: string[],
  ) => {
    const sourceConfig = state.pageConfigs[sourcePage];
    const sourceRows = state.pageRows[sourcePage] || [];
    if (!sourceConfig) return toast("Source page not found!");

    // SMART AUTO-NUMBERING LOGIC
    const baseTrackerName = `${sourcePage} - Live Tracker`;
    let trackerCounter = 1;
    let trackerName = `${baseTrackerName} (${trackerCounter})`;

    // Keep increasing the number in brackets if the name already exists
    while (state.pages.includes(trackerName)) {
      trackerCounter++;
      trackerName = `${baseTrackerName} (${trackerCounter})`;
    }

    const filteredColumns = selectedColKeys
      ? sourceConfig.columns.filter(
          (c) => selectedColKeys.includes(c.key) || c.key === "sr",
        )
      : sourceConfig.columns;

    // EXACT COPY of ALL columns, appending only Total and Remaining
    const newColumns = [
      ...filteredColumns,
      {
        key: "total_qty",
        name: "Total Qty",
        type: "number" as const,
        width: 150,
      },
      {
        key: "remaining_qty",
        name: "Remaining Qty",
        type: "number" as const,
        locked: true,
        width: 150,
      },
    ];

    const newConfig: PageConfig = {
      ...sourceConfig,
      isTrackerPage: true,
      linkedSourcePage: sourcePage,
      columns: newColumns,
      minStockAlert: 5,
    };

    // EXACT COPY of ALL row data, setting total_qty to '0'
    const newRows = sourceRows.map((row) => {
      const newRow = { ...row };
      if (selectedColKeys) {
        Object.keys(newRow).forEach((k) => {
          if (
            k !== "id" &&
            k !== "sr" &&
            !selectedColKeys.includes(k) &&
            k !== "total_qty" &&
            k !== "remaining_qty"
          ) {
            delete newRow[k];
          }
        });
      }
      newRow.total_qty = "0";
      return newRow;
    });

    try {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trackerName, config: newConfig }),
      });
      await fetch(`/api/pageRows/${encodeURIComponent(trackerName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: newRows }),
      });

      setState((prev) => ({
        ...prev,
        pages: [...prev.pages, trackerName],
        activePage: trackerName,
        pageConfigs: { ...prev.pageConfigs, [trackerName]: newConfig },
        pageRows: { ...prev.pageRows, [trackerName]: newRows },
      }));
      toast(`Tracker "${trackerName}" created with ALL columns!`);
    } catch (err) {
      console.error(err);
      toast("Failed to create tracker page");
    }
  };

  const handleToggleColumnArchive = async (
    colKey: string,
    currentStatus: boolean,
  ) => {
    if (!activeConfig) return;
    const updatedColumns = activeConfig.columns.map((c) =>
      c.key === colKey ? { ...c, archived: !currentStatus } : c,
    );
    const updatedConfig = { ...activeConfig, columns: updatedColumns };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });
      setState((prev) => ({
        ...prev,
        pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig },
      }));
    } catch (err) {
      console.error(err);
      toast("Failed to update archive status");
    }
  };

  const handleBulkArchiveToggle = async (hideAll: boolean) => {
    if (!activeConfig) return;
    const updatedColumns = activeConfig.columns.map((c) =>
      c.type === "sale_tracker" ? { ...c, archived: hideAll } : c,
    );
    const updatedConfig = { ...activeConfig, columns: updatedColumns };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });
      setState((prev) => ({
        ...prev,
        pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig },
      }));
      toast(hideAll ? "All sale columns hidden!" : "All sale columns visible!");
    } catch (err) {
      console.error(err);
      toast("Failed to update columns");
    }
  };

  const handleAddSaleColumn = async () => {
    if (!customSaleName.trim()) return;
    const newColKey = "sale_" + Date.now();
    const newCol = {
      key: newColKey,
      name: customSaleName,
      type: "sale_tracker" as const,
      archived: false,
      width: 150,
    };

    // Find where to insert the new column (before existing sale columns)
    const currentColumns = activeConfig.columns.map((c) =>
      c.type === "sale_tracker" ? { ...c, archived: true } : c,
    );
    const firstSaleIndex = activeConfig.columns.findIndex(
      (c) => c.type === "sale_tracker",
    );

    if (firstSaleIndex !== -1) {
      currentColumns.splice(firstSaleIndex, 0, newCol); // Push old columns to the right
    } else {
      currentColumns.push(newCol); // If no sale columns exist yet
    }

    const updatedConfig = { ...activeConfig, columns: currentColumns };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });
      setState((prev) => ({
        ...prev,
        pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig },
      }));
      setIsSalePromptOpen(false);
      setCustomSaleName("");
      toast(`Sale column "${customSaleName}" added successfully!`);
    } catch (err) {
      console.error(err);
      toast("Failed to add sale column");
    }
  };

  const handleSaveInlineEdit = async (
    pageName: string,
    rowId: string,
    colKey: string,
    val: string,
  ) => {
    // 1. Close the popover immediately to prevent multiple clicks and UI lag
    setInlineEdit(null);

    // 2. Optimistically update the local state
    const updatedRows = [...(state.pageRows[pageName] || [])];
    const idx = updatedRows.findIndex((r) => r.id === rowId);
    if (idx >= 0) {
      updatedRows[idx] = { ...updatedRows[idx], [colKey]: val };
      setState((prev) => ({
        ...prev,
        pageRows: { ...prev.pageRows, [pageName]: updatedRows },
      }));

      // 3. Save to database in the background
      pendingSavesRef.current += 1;
      try {
        await fetch(
          `/api/pageRows/${encodeURIComponent(pageName)}/${encodeURIComponent(rowId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates: { [colKey]: val } }),
          },
        );
      } catch (e) {
        toast("Failed to save inline edit");
      } finally {
        pendingSavesRef.current -= 1;
      }

      // 4. Propagate to linked trackers
      const linkedTrackers = Object.entries(state.pageConfigs)
        .filter(([_, c]: [string, any]) => c.linkedSourcePage === pageName)
        .map(([n]) => n);

      const trackerPromises = linkedTrackers.map(async (tracker) => {
        const trackerConfig = state.pageConfigs[tracker];
        const isTrackerOwnedField =
          colKey === "total_qty" ||
          colKey === "remaining_qty" ||
          trackerConfig?.columns?.some(
            (c: Column) => c.key === colKey && c.type === "sale_tracker",
          );

        if (isTrackerOwnedField) return;

        const trackerRows = state.pageRows[tracker] || [];
        const tIdx = trackerRows.findIndex((r) => r.id === rowId);
        if (tIdx >= 0) {
          const updatedTrackerRows = [...trackerRows];
          updatedTrackerRows[tIdx] = {
            ...updatedTrackerRows[tIdx],
            [colKey]: val,
          };

          setState((prev) => ({
            ...prev,
            pageRows: { ...prev.pageRows, [tracker]: updatedTrackerRows },
          }));

          pendingSavesRef.current += 1;
          try {
            await fetch(
              `/api/pageRows/${encodeURIComponent(tracker)}/${encodeURIComponent(rowId)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates: { [colKey]: val } }),
              },
            );
          } catch (e) {
            toast(`Failed to save inline edit to tracker ${tracker}`);
          } finally {
            pendingSavesRef.current -= 1;
          }
        }
      });
      await Promise.all(trackerPromises);
    }
  };

  const handleCreatePage = async (name: string, columns: Column[]) => {
    const columnsWithDefaults = columns.map((c) => ({
      ...c,
      width: c.width || 150,
    }));

    const newConfig = {
      rowReorderEnabled: false,
      hoverPreviewEnabled: false,
      columns: [
        {
          key: "sr",
          name: "Row No.",
          type: "system_serial",
          locked: true,
          movable: false,
          width: state.globalRowNoWidth || 100,
        },
        ...columnsWithDefaults,
      ],
    };

    try {
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config: newConfig }),
      });

      setState((prev) => ({
        ...prev,
        pages: [...prev.pages, name],
        activePage: name,
        pageConfigs: {
          ...prev.pageConfigs,
          [name]: newConfig,
        },
        pageRows: {
          ...prev.pageRows,
          [name]: [],
        },
      }));
      toggleModal("createPage", false);
      toast(
        `Page "${name}" created. Added: Row No. + ${columns.length} custom column(s).`,
      );
    } catch (err) {
      console.error(err);
      toast("Failed to create page in database");
    }
  };

  const handleRenamePage = async (newName: string) => {
    const oldName = state.activePage;
    try {
      await fetch(`/api/pages/${encodeURIComponent(oldName)}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });

      setState((prev) => {
        const newPages = prev.pages.map((p) => (p === oldName ? newName : p));
        const newConfigs = { ...prev.pageConfigs };
        const newRows = { ...prev.pageRows };

        newConfigs[newName] = newConfigs[oldName];
        delete newConfigs[oldName];

        newRows[newName] = newRows[oldName];
        delete newRows[oldName];

        return {
          ...prev,
          pages: newPages,
          activePage: newName,
          pageConfigs: newConfigs,
          pageRows: newRows,
        };
      });
      closeAllModals();
      setReturnToSettings(false);
      toast(`Page renamed to: ${newName}`);
    } catch (err) {
      console.error(err);
      toast("Failed to rename page in database");
    }
  };

  const handleDeleteColumnOptions = async (
    column: Column,
    deleteType: "normal" | "smart",
  ) => {
    if (!state.activePage) return;

    // Create new array minus the deleted column
    const updatedColumns = activeConfig.columns.filter(
      (c) => c.key !== column.key,
    );

    // Save updated config
    const newConfig = { ...activeConfig, columns: updatedColumns };
    await handleSaveActivePageSettings(newConfig, false);

    const updatedRows = activeRows.map((row) => {
      const newRow = { ...row };

      if (deleteType === "smart" && column.type === "sale_tracker") {
        const saleValue = parseFloat(String(row[column.key] || 0)) || 0;
        const totalQty = parseFloat(String(row.total_qty || 0)) || 0;
        newRow.total_qty = String(totalQty - saleValue);
      }

      delete newRow[column.key];
      return newRow;
    });

    await handleSaveRows(updatedRows, state.activePage, true);
    toast(`Column "${column.name}" deleted successfully (${deleteType} mode).`);
  };

  const handleBulkDeleteSaleColumns = async (
    colKeys: string[],
    deleteType: "normal" | "smart",
  ) => {
    if (!state.activePage || colKeys.length === 0) return;

    const colKeysSet = new Set(colKeys);
    const updatedColumns = activeConfig.columns.filter(
      (c) => !colKeysSet.has(c.key),
    );

    const newConfig = { ...activeConfig, columns: updatedColumns };
    await handleSaveActivePageSettings(newConfig, false);

    const updatedRows = activeRows.map((row) => {
      const newRow = { ...row };
      if (deleteType === "smart") {
        let totalDeduction = 0;
        for (const key of colKeys) {
          totalDeduction += parseFloat(String(row[key] || 0)) || 0;
        }
        const totalQty = parseFloat(String(row.total_qty || 0)) || 0;
        newRow.total_qty = String(totalQty - totalDeduction);
      }
      for (const key of colKeys) {
        delete newRow[key];
      }
      return newRow;
    });

    await handleSaveRows(updatedRows, state.activePage, true);
    toast(
      `${colKeys.length} column(s) deleted successfully (${deleteType} mode).`,
    );
    setSelectedArchiveCols(new Set());
    if (activeFilterSaleCol && colKeysSet.has(activeFilterSaleCol)) {
      setActiveFilterSaleCol(null);
    }
  };

  const handleDeletePage = async () => {
    const pageToDelete = state.activePage;
    try {
      await fetch(`/api/pages/${encodeURIComponent(pageToDelete)}`, {
        method: "DELETE",
      });

      setState((prev) => {
        const linkedTrackers = Object.entries(prev.pageConfigs)
          .filter(([name, config]: [string, any]) => config.linkedSourcePage === pageToDelete)
          .map(([name]) => name);

        const newPages = prev.pages.filter((p) => p !== pageToDelete && !linkedTrackers.includes(p));

        // Safety Verification Check: Deep clone to guarantee immutability
        // ensures other pages like 'Main Page' have zero risk of shared reference mutation
        const newConfigs = JSON.parse(JSON.stringify(prev.pageConfigs));
        const newRows = JSON.parse(JSON.stringify(prev.pageRows));

        // Strictly target and remove ONLY the selected page's data and its linked trackers
        delete newConfigs[pageToDelete];
        delete newRows[pageToDelete];
        
        linkedTrackers.forEach(trackerName => {
          delete newConfigs[trackerName];
          delete newRows[trackerName];
        });

        return {
          ...prev,
          pages: newPages,
          activePage: newPages.length > 0 ? newPages[0] : "",
          pageConfigs: newConfigs,
          pageRows: newRows,
        };
      });
      closeAllModals();
      toast(`Page "${pageToDelete}" deleted`);
    } catch (err) {
      console.error(err);
      toast("Failed to delete page from database");
    }
  };

  const handleClearPageData = async (pageName: string) => {
    try {
      await fetch(`/api/pageRows/${encodeURIComponent(pageName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [] }),
      });

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [pageName]: [],
        },
      }));
      toast("All data cleared successfully");
    } catch (err) {
      console.error(err);
      toast("Failed to clear page data");
    }
  };

  const handleSaveActivePageSettings = async (
    config: PageConfig,
    closeModal: boolean = true,
  ) => {
    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      setState((prev) => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: config,
        },
      }));
      if (closeModal) {
        toggleModal("activePageSettings", false);
        toast(`Page settings updated for ${state.activePage}`);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to save page settings to database");
    }
  };

  const handleSaveColumnWidth = useCallback(async (colId: string, newWidth: number, targetPageOverride?: string) => {
    const pageToUpdate = targetPageOverride || state.activePage;
    if (!pageToUpdate) return;

    setState(prev => {
      const pageConfig = prev.pageConfigs[pageToUpdate];
      if (!pageConfig) return prev;

      const colIndex = pageConfig.columns.findIndex(c => c.key === colId);
      if (colIndex === -1) return prev;

      const updatedColumns = [...pageConfig.columns];
      updatedColumns[colIndex] = { ...updatedColumns[colIndex], width: newWidth };

      return {
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [pageToUpdate]: {
            ...pageConfig,
            columns: updatedColumns
          }
        }
      };
    });

    try {
      const currentConfig = state.pageConfigs[pageToUpdate];
      if (!currentConfig) return;
      
      const colIndex = currentConfig.columns.findIndex(c => c.key === colId);
      if(colIndex === -1) return;
      
      const updatedColumns = [...currentConfig.columns];
      updatedColumns[colIndex] = { ...updatedColumns[colIndex], width: newWidth };

      await fetch('/api/pages/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pageToUpdate,
          config: { ...currentConfig, columns: updatedColumns }
        })
      });
    } catch (err) {
      console.error("Error saving column width:", err);
    }
  }, [state.activePage, state.pageConfigs, setState]);

  const handleCreateColumns = async (newColumns: Column[]) => {
    // Set default width of 150 for all new columns
    const columnsWithDefaults = newColumns.map((c) => ({
      ...c,
      width: c.width || 150,
    }));

    const updatedConfig = {
      ...state.pageConfigs[state.activePage],
      columns: [
        ...state.pageConfigs[state.activePage].columns,
        ...columnsWithDefaults,
      ],
    };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });

      setState((prev) => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: updatedConfig,
        },
      }));

      closeAllModals();
      setReturnToSettings(false);
      toast(`${newColumns.length} column(s) added to ${state.activePage}`);
    } catch (err) {
      console.error(err);
      toast("Failed to add columns to database");
    }
  };

  const handleEditColumnClick = (col: Column) => {
    setEditingColumn(col);
    setReturnToSettings(true);
    toggleModal("activePageSettings", false);
    toggleModal("editColumn", true);
  };

  const handleSaveEditedColumn = async (updatedCol: Column) => {
    const currentCols = state.pageConfigs[state.activePage].columns;
    const newCols = currentCols.map((c) =>
      c.key === updatedCol.key ? updatedCol : c,
    );
    const updatedConfig = {
      ...state.pageConfigs[state.activePage],
      columns: newCols,
    };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: updatedConfig }),
      });

      setState((prev) => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: updatedConfig,
        },
      }));

      closeAllModals();
      setEditingColumn(null);
      setReturnToSettings(false);
      toast(`Column "${updatedCol.name}" updated successfully`);
    } catch (err) {
      console.error(err);
      toast("Failed to update column in database");
    }
  };

  const handleUpdateColumnPreview = (updatedCol: Column) => {
    setState((prev) => {
      const currentCols = prev.pageConfigs[state.activePage].columns;
      const newCols = currentCols.map((c) =>
        c.key === updatedCol.key ? updatedCol : c,
      );
      return {
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: {
            ...prev.pageConfigs[state.activePage],
            columns: newCols,
          },
        },
      };
    });
  };

  const handleSaveRows = async (
    newRows: RowData[],
    pageName?: string,
    force = false,
  ) => {
    const targetPage = pageName || state.activePage;
    let currentRows = [...(state.pageRows[targetPage] || [])];

    if (editingRowId) {
      const idx = currentRows.findIndex((r) => r.id === editingRowId);
      if (idx >= 0) currentRows[idx] = newRows[0];
      else currentRows.push(newRows[0]);
    } else {
      currentRows.push(...newRows);
    }

    try {
      let response;
      if (editingRowId && newRows.length === 1) {
        response = await fetch(
          `/api/pageRows/${encodeURIComponent(targetPage)}/${encodeURIComponent(editingRowId)}${force ? "?force=true" : ""}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates: newRows[0] }),
          },
        );
      } else {
        response = await fetch(
          `/api/pageRows/${encodeURIComponent(targetPage)}/append${force ? "?force=true" : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: newRows }),
          },
        );
      }

      if (!response.ok) {
        if (response.status === 400) {
          const data = await response.json();
          if (data.requiresConfirmation) {
            setConfirmationModal({
              isOpen: true,
              title: "Unsupported Image Format",
              message: data.error,
              onConfirm: () => handleSaveRows(newRows, pageName, true),
            });
            return;
          }
        }
        throw new Error("Database failed to save");
      }

      // Success! Update state
      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows,
        },
      }));

      if (!editingRowId && !force) {
        setPrimarySearchInput("");
        setPrimarySearchTags([]);

        setTimeout(() => {
          if (primParentRef.current) {
            primParentRef.current.scrollTop = primParentRef.current.scrollHeight;
          }
        }, 100);
      }

      const wasEditing = editingRowId;
      toggleModal("addRow", false);
      setEditingRowId(null);

      // Auto-sync trackers
      const linkedTrackers = Object.entries(state.pageConfigs)
        .filter(
          ([_, c]) => (c as PageConfig).linkedSourcePage === targetPage,
        )
        .map(([name]) => name);

      for (const trackerName of linkedTrackers) {
        const trackerConfig = state.pageConfigs[trackerName];
        if (!trackerConfig) continue;
        const trackerRows = [...(state.pageRows[trackerName] || [])];
        let updatedTracker = false;
        
        const updatesObj: Record<string, any> = {};
        const appendRows: any[] = [];

        for (const newRow of newRows) {
          const tIdx = trackerRows.findIndex((r) => r.id === newRow.id);
          if (tIdx >= 0 && wasEditing) {
            const existingTrackerRow = trackerRows[tIdx];
            const trackerKeysToKeep = [
              "total_qty",
              "remaining_qty",
              ...trackerConfig.columns
                .filter((c) => c.type === "sale_tracker")
                .map((c) => c.key),
            ];
            const preservedData: any = {};
            for (const k of trackerKeysToKeep)
              if (k in existingTrackerRow)
                preservedData[k] = existingTrackerRow[k];
            trackerRows[tIdx] = { ...newRow, ...preservedData };

            updatesObj[newRow.id] = trackerRows[tIdx];
            updatedTracker = true;
          } else if (!wasEditing) {
            const newTrackerRow = {
              ...newRow,
              total_qty: "0",
            };
            trackerRows.push(newTrackerRow);
            
            appendRows.push(newTrackerRow);
            updatedTracker = true;
          }
        }
        
        if (Object.keys(updatesObj).length > 0) {
          await fetch(
            `/api/pageRows/${encodeURIComponent(trackerName)}/bulk`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates: updatesObj }),
            },
          );
        }

        if (appendRows.length > 0) {
          await fetch(
            `/api/pageRows/${encodeURIComponent(trackerName)}/append`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: appendRows }),
            },
          );
        }

        if (updatedTracker) {
          setState((prev) => ({
            ...prev,
            pageRows: { ...prev.pageRows, [trackerName]: trackerRows },
          }));
        }
      }

      // Jab database se OK aa jaye, tabhi success message show karein
      if (returnToImagePreview) {
        toggleModal("imagePreview", true);
        setReturnToImagePreview(false);
      } else if (returnToSettings) {
        toggleModal("activePageSettings", true);
        setReturnToSettings(false);
      }

      toast(
        wasEditing
          ? "Row updated successfully"
          : `${newRows.length} row(s) added successfully!`,
      );
    } catch (err) {
      console.error("Save Error:", err);
      // Agar database save karne mein fail ho jaye to user ko lal/error alert dein
      toast("❌ Error saving to database! Please try again.");
    }
  };

  const handleApplySourceToAll = async (pageName: string, colKey: string, sourceName: string, sourceColor: string) => {
    setBulkApplyContext({ pageName, colKey, sourceName, sourceColor });
    toggleModal("addRow", false);
    toggleModal("bulkApplySource", true);
  };

  const handleConfirmBulkApply = async (
    selectedRowIds: Set<string>,
    sourcesToApply: { source: string; color: string }[],
  ) => {
    if (!bulkApplyContext) return;
    const { pageName, colKey } = bulkApplyContext;

    try {
      const rows = state.pageRows[pageName] || [];
      let hasChanges = false;
      const updatesMap: any = {};
      const updatedRows = rows.map((r) => {
        if (!selectedRowIds.has(String(r.id))) return r;

        let rowModified = false;
        const arr = parseMultiSource(r[colKey]);

        sourcesToApply.forEach((sToApply) => {
          if (!arr.find((x: any) => x.source === sToApply.source)) {
            arr.push({ source: sToApply.source, qty: 0, color: sToApply.color });
            rowModified = true;
            hasChanges = true;
          }
        });

        if (rowModified) {
          const newVal = JSON.stringify(arr);
          updatesMap[r.id] = { [colKey]: newVal };
          return { ...r, [colKey]: newVal };
        }
        return r;
      });

      if (!hasChanges) {
        toast(`Selected sources are already present in all selected rows.`);
        toggleModal("bulkApplySource", false);
        return;
      }

      const res = await fetch(`/api/pageRows/${encodeURIComponent(pageName)}/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updatesMap }),
      });

      if (!res.ok) throw new Error("Failed to update bulk sources");

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [pageName]: updatedRows,
        },
      }));
      toast(
        `Successfully applied ${sourcesToApply.length} source(s) to ${selectedRowIds.size} rows`,
      );
      toggleModal("bulkApplySource", false);
    } catch (err: any) {
      console.error(err);
      toast("Error applying source to selected rows: " + err.message);
    }
  };

  const handleDeleteRow = async (rowId: string, pageName?: string) => {
    const targetPage = pageName || state.activePage;

    // Safety Verification Check: Force string conversion to prevent strict equality mismatch
    const safeRowId = String(rowId);
    try {
      await fetch(
        `/api/pageRows/${encodeURIComponent(targetPage)}/${encodeURIComponent(safeRowId)}`,
        {
          method: "DELETE",
        },
      );

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          // Safety Check: Double check filtering directly on prev state to avoid stale closures
          [targetPage]: (prev.pageRows[targetPage] || []).filter(
            (r) => String(r.id) !== safeRowId,
          ),
        },
      }));

      // Auto-sync trackers (delete row)
      const linkedTrackers = Object.entries(state.pageConfigs)
        .filter(
          ([_, c]) => (c as PageConfig).linkedSourcePage === targetPage,
        )
        .map(([name]) => name);

      for (const trackerName of linkedTrackers) {
        const trackerRows = state.pageRows[trackerName] || [];
        const newTrackerRows = trackerRows.filter(
          (r) => String(r.id) !== safeRowId,
        );
        if (newTrackerRows.length < trackerRows.length) {
          await fetch(
            `/api/pageRows/${encodeURIComponent(trackerName)}/${encodeURIComponent(safeRowId)}`,
            {
              method: "DELETE",
            },
          );
          setState((prev) => ({
            ...prev,
            pageRows: { ...prev.pageRows, [trackerName]: newTrackerRows },
          }));
        }
      }

      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(safeRowId);
        next.delete(rowId); // Clean both potential type keys safely
        return next;
      });

      if (String(previewContext?.rowId) === safeRowId) {
        setPreviewContext(null);
      }
      if (String(editingRowId) === safeRowId) {
        setEditingRowId(null);
      }
      setHoveredImage(null);
      toast("Row deleted");
    } catch (err) {
      console.error(err);
      toast("Failed to delete row from database");
    }
  };

  const handleReplaceImage = async (newImage: any, pageName?: string) => {
    if (!previewContext) return;
    const targetPage = pageName || previewContext.pageName;
    const currentRows = [...(state.pageRows[targetPage] || [])];
    const idx = currentRows.findIndex((r) => r.id === previewContext.rowId);
    if (idx >= 0) {
      currentRows[idx] = {
        ...currentRows[idx],
        [previewContext.imageKey]: newImage.data || newImage,
      };
    }

    try {
      await fetch(
        `/api/pageRows/${encodeURIComponent(targetPage)}/${encodeURIComponent(previewContext.rowId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: { [previewContext.imageKey]: newImage.data || newImage },
          }),
        },
      );

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows,
        },
      }));
      toast("Image replaced successfully");
    } catch (err) {
      console.error(err);
      toast("Failed to replace image in database");
    }
  };

  const handleDeleteImage = async (
    rowId: string,
    imageKey: string,
    pageName?: string,
  ) => {
    const targetPage =
      pageName || previewContext?.pageName || state.activePage;
    const currentRows = [...(state.pageRows[targetPage] || [])];
    const idx = currentRows.findIndex((r) => r.id === rowId);
    if (idx >= 0) {
      currentRows[idx] = { ...currentRows[idx], [imageKey]: "" };
    }

    try {
      await fetch(
        `/api/pageRows/${encodeURIComponent(targetPage)}/${encodeURIComponent(rowId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: { [imageKey]: "" } }),
        },
      );

      setState((prev) => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows,
        },
      }));
      setPreviewContext(null);
      setHoveredImage(null);
      toast("Image deleted");
    } catch (err) {
      console.error(err);
      toast("Failed to delete image from database");
    }
  };

  const sortRows = (rows: RowData[], columns: Column[]) => {
    const sortableColumns = columns
      .filter((c) => c.sortEnabled && c.key !== "sr")
      .sort((a, b) => (a.sortPriority || 0) - (b.sortPriority || 0));

    if (sortableColumns.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const col of sortableColumns) {
        const key = col.key;
        let valA = a[key];
        let valB = b[key];

        if (valA === null || valA === undefined) valA = "";
        if (valB === null || valB === undefined) valB = "";

        let comparison = 0;
        if (col.type === "number") {
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          if (!isNaN(numA) && !isNaN(numB)) comparison = numA - numB;
          else if (isNaN(numA) && !isNaN(numB)) comparison = 1;
          else if (!isNaN(numA) && isNaN(numB)) comparison = -1;
          else comparison = 0;
        } else if (col.type === "date") {
          const dateA = new Date(valA).getTime();
          const dateB = new Date(valB).getTime();
          if (!isNaN(dateA) && !isNaN(dateB)) comparison = dateA - dateB;
          else if (isNaN(dateA) && !isNaN(dateB)) comparison = 1;
          else if (!isNaN(dateA) && isNaN(dateB)) comparison = -1;
          else comparison = 0;
        } else {
          // Added .trim() to fix hidden spacing issues in sorting
          comparison = String(valA)
            .trim()
            .toLowerCase()
            .localeCompare(String(valB).trim().toLowerCase());
        }

        if (comparison !== 0) {
          return col.sortDirection === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  };

  const activeColumnsWithSum = useMemo(() => {
    // Enforce explicit 150px width for total and remaining columns so they never shrink
    let cols = [...activeConfig.columns].map((c) => {
      if (c.key === "total_qty" || c.key === "remaining_qty") {
        return { ...c, width: c.width || 150 };
      }
      return c;
    });

    if (activeCustomSum) {
      const remIdx = cols.findIndex((c) => c.key === "remaining_qty");
      if (remIdx !== -1) {
        cols.splice(remIdx + 1, 0, {
          key: "custom_temp_sum",
          name: `Sum (${activeCustomSum.startName} to ${activeCustomSum.endName})`,
          type: "number",
          locked: true,
          sortEnabled: true,
          archived: false,
          width: 150,
        } as any);
      }
    }
    return cols;
  }, [activeConfig.columns, activeCustomSum]);

  const uniqueSourcesInRange = useMemo(() => {
    if (!isSumModalOpen || !activeConfig.isTrackerPage) return [];
    const startIdx = activeConfig.columns.findIndex(
      (c) => c.key === sumStartCol,
    );
    const endIdx = activeConfig.columns.findIndex((c) => c.key === sumEndCol);
    if (startIdx === -1 || endIdx === -1) return [];

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const keys = activeConfig.columns
      .slice(minIdx, maxIdx + 1)
      .map((c) => c.key);

    const allSources = new Set<string>();
    activeRows.forEach((row) => {
      // 1. Scan global sources from total_qty
      const totalSources = parseMultiSource(row.total_qty);
      totalSources.forEach((s: any) => {
        if (s.source) allSources.add(s.source);
      });

      // 2. Scan specific range columns
      keys.forEach((k) => {
        const parsed = parseMultiSource(row[k]);
        parsed.forEach((s: any) => {
          if (s.source) allSources.add(s.source);
        });
      });
    });
    return Array.from(allSources).sort((a, b) => a.localeCompare(b));
  }, [isSumModalOpen, sumStartCol, sumEndCol, activeConfig.columns, activeRows]);

  const activeRowsWithSum = useMemo(() => {
    if (!activeCustomSum || !activeConfig.isTrackerPage) return activeRows;
    const selected = activeCustomSum.selectedSources || [];
    return activeRows.map((r) => {
      let totalQty = 0;
      const breakdownMap: Record<string, number> = {};

      activeCustomSum.keys.forEach((k) => {
        const sources = parseMultiSource(r[k]);
        sources.forEach((s: any) => {
          if (selected.length === 0 || selected.includes(s.source)) {
            totalQty += parseFloat(String(s.qty)) || 0;
            breakdownMap[s.source] = (breakdownMap[s.source] || 0) + (parseFloat(String(s.qty)) || 0);
          }
        });
      });

      const breakdown = Object.entries(breakdownMap).map(([source, qty]) => {
        let color = "bg-gray-100 text-gray-800 border-gray-200";
        // Attempt to find original color
        activeCustomSum.keys.some(k => {
          const srcObj = parseMultiSource(r[k]).find((so: any) => so.source === source);
          if (srcObj && srcObj.color) {
            color = srcObj.color;
            return true;
          }
          return false;
        });
        return { source, qty, color };
      }).sort((a, b) => a.source.localeCompare(b.source));

      return {
        ...r,
        custom_temp_sum: String(totalQty),
        custom_temp_sum_breakdown: JSON.stringify(breakdown),
      };
    });
  }, [activeRows, activeCustomSum, activeConfig.isTrackerPage]);

  const compileSearchQueries = useCallback((activeQueries: string[]) => {
    return activeQueries.map((query) => {
      const lowerQuery = query.toLowerCase();
      let searchString = lowerQuery;
      let prefix: string | null = null;
      let matchedColTargetString: string | null = null;
      const colonIndex = lowerQuery.indexOf(":");

      if (colonIndex > 0) {
        prefix = lowerQuery.substring(0, colonIndex).trim();
        matchedColTargetString = lowerQuery.substring(colonIndex + 1).trim();
      }

      const compileTokens = (str: string) => {
        const rawTokens = str.split(/\s+/).filter(Boolean);
        return rawTokens.map((t) => {
          let regex: RegExp;
          try {
            const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            let bStart = "";
            let bEnd = "";
            if (/^[0-9]/.test(t)) {
              bStart = "";
              bEnd = "";
            } else if (/^[a-zA-Z]/.test(t)) {
              if (t.length <= 2) {
                bStart = "(?<![a-zA-Z])";
                bEnd = "(?![a-zA-Z]{2,})";
              }
            }
            regex = new RegExp(bStart + escaped + bEnd, "i");
          } catch (e) {
            regex = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
          }
          return regex;
        });
      };

      return {
        prefix,
        defaultTokens: compileTokens(lowerQuery),
        suffixTokens: matchedColTargetString !== null ? compileTokens(matchedColTargetString) : [],
      };
    });
  }, []);

  const buildSearchIndex = useCallback((rows: any[], columns: any[]) => {
    const indexMap = new Map();
    rows.forEach(row => {
      const colData = columns
        .map((col) => {
          if (col.key === "sr" || col.type === "image" || col.type === "file")
            return null;
          const val = row[col.key];
          const strVal = Array.isArray(val)
            ? val.join(" ")
            : val !== null && val !== undefined
              ? String(val)
              : "";
          const cleanVal = decodeHtmlEntities(strVal)
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/&nbsp;/gi, " ")
            .toLowerCase();
          return { name: col.name.toLowerCase(), val: cleanVal };
        })
        .filter(Boolean) as { name: string; val: string }[];

      const globalBlob = colData.map((c) => c.val).join(" ");
      indexMap.set(row.id, { colData, globalBlob });
    });
    return indexMap;
  }, []);

  const primarySearchIndex = useMemo(() => {
    return buildSearchIndex(activeRowsWithSum, activeColumnsWithSum);
  }, [activeRowsWithSum, activeColumnsWithSum, buildSearchIndex]);

  const secondarySearchIndex = useMemo(() => {
    if (!activeConfig.secondarySearchPage) return new Map();
    const secRows = state.pageRows[activeConfig.secondarySearchPage] || [];
    const secConfig = state.pageConfigs[activeConfig.secondarySearchPage];
    if (!secConfig) return new Map();
    return buildSearchIndex(secRows, secConfig.columns);
  }, [state.pageRows, state.pageConfigs, activeConfig.secondarySearchPage, buildSearchIndex]);

  const filteredRows = useMemo(() => {
    let rows = activeRowsWithSum;
    const activeQueries = [...primarySearchTags, currentSearch.trim()].filter(
      Boolean,
    );
    if (activeQueries.length > 0) {
      const compiledQueries = compileSearchQueries(activeQueries);
      
      rows = rows.filter((row) => {
        const indexData = primarySearchIndex.get(row.id);
        const colData = indexData ? indexData.colData : [];
        const globalBlob = indexData ? indexData.globalBlob : "";

        return compiledQueries.some((cQuery) => {
          let targetBlob = globalBlob;
          let tokensToUse = cQuery.defaultTokens;

          if (cQuery.prefix !== null) {
            const matchedCol = colData.find(
              (c) => c.name.includes(cQuery.prefix!) || cQuery.prefix!.includes(c.name),
            );
            if (matchedCol) {
              targetBlob = matchedCol.val;
              tokensToUse = cQuery.suffixTokens;
            }
          }

          if (tokensToUse.length === 0) return true;
          return tokensToUse.every((regex) => regex.test(targetBlob));
        });
      });
    }
    if (activeConfig.isTrackerPage) {
      const saleCols = activeConfig.columns.filter(
        (c) => c.type === "sale_tracker",
      );
      const latestSaleCol =
        activeFilterSaleCol &&
        saleCols.some((c) => c.key === activeFilterSaleCol)
          ? activeFilterSaleCol
          : saleCols.length > 0
            ? saleCols[0].key
            : null;
      const getNum = (v: any) => {
        return parseMultiSource(v).reduce(
          (sum: number, s: any) => sum + (parseFloat(s.qty) || 0),
          0,
        );
      };

      if (trackerFilter !== "all") {
        rows = rows.filter((row) => {
          const total = getNum(row.total_qty);
          const totalSales = saleCols.reduce(
            (sum, c) => sum + getNum(row[c.key]),
            0,
          );
          const remaining = total - totalSales;
          const minStock = activeConfig.minStockAlert || 5;
          const latestSaleVal = latestSaleCol ? getNum(row[latestSaleCol]) : 0;

          if (trackerFilter === "low") {
            return remaining <= minStock;
          } else if (trackerFilter === "zero") {
            return latestSaleVal === 0 || !row[latestSaleCol!];
          } else if (trackerFilter === "high") {
            return latestSaleVal > 0;
          }
          return true;
        });
        if (trackerFilter === "high" && latestSaleCol) {
          const isOriginalArray = rows === activeRowsWithSum;
          if (isOriginalArray) {
            rows = [...rows];
          }
          rows.sort(
            (a, b) => getNum(b[latestSaleCol]) - getNum(a[latestSaleCol]),
          );
        }
      }

      if (trackerFilter === "all" && trackerSort !== "none" && latestSaleCol) {
        const isOriginalArray = rows === activeRowsWithSum;
        if (isOriginalArray) {
          rows = [...rows];
        }
        if (trackerSort === "high") {
          rows.sort(
            (a, b) => getNum(b[latestSaleCol]) - getNum(a[latestSaleCol]),
          );
        } else if (trackerSort === "low") {
          rows.sort(
            (a, b) => getNum(a[latestSaleCol]) - getNum(b[latestSaleCol]),
          );
        }
      }
    }

    return sortRows(rows, activeConfig.columns);
  }, [
    activeRowsWithSum,
    currentSearch,
    primarySearchTags,
    activeColumnsWithSum,
    activeConfig.isTrackerPage,
    activeConfig.minStockAlert,
    trackerFilter,
    trackerSort,
  ]);

  const secondaryFilteredRows = useMemo(() => {
    if (!activeConfig.secondarySearchPage) return [];
    const secRows = state.pageRows[activeConfig.secondarySearchPage] || [];
    const secConfig = state.pageConfigs[activeConfig.secondarySearchPage];
    if (!secConfig) return [];

    let rows = secRows;
    const activeQueries = [
      ...secondarySearchTags,
      secondarySearchQuery.trim(),
    ].filter(Boolean);
    if (activeQueries.length > 0) {
      const compiledQueries = compileSearchQueries(activeQueries);
      
      rows = rows.filter((row) => {
        const indexData = secondarySearchIndex.get(row.id);
        const colData = indexData ? indexData.colData : [];
        const globalBlob = indexData ? indexData.globalBlob : "";

        return compiledQueries.some((cQuery) => {
          let targetBlob = globalBlob;
          let tokensToUse = cQuery.defaultTokens;

          if (cQuery.prefix !== null) {
            const matchedCol = colData.find(
              (c) => c.name.includes(cQuery.prefix!) || cQuery.prefix!.includes(c.name),
            );
            if (matchedCol) {
              targetBlob = matchedCol.val;
              tokensToUse = cQuery.suffixTokens;
            }
          }

          if (tokensToUse.length === 0) return true;
          return tokensToUse.every((regex) => regex.test(targetBlob));
        });
      });
    }
    if (secConfig.isTrackerPage) {
      const saleCols = secConfig.columns.filter(
        (c) => c.type === "sale_tracker",
      );
      const latestSaleCol =
        activeFilterSaleCol &&
        saleCols.some((c) => c.key === activeFilterSaleCol)
          ? activeFilterSaleCol
          : saleCols.length > 0
            ? saleCols[0].key
            : null;
      const getNum = (v: any) => {
        const n = parseFloat(String(v || 0));
        return isNaN(n) ? 0 : n;
      };

      if (trackerFilter !== "all") {
        rows = rows.filter((row) => {
          const total = parseFloat(String(row.total_qty || 0));
          const totalSales = saleCols.reduce(
            (sum, c) => sum + parseFloat(String(row[c.key] || 0)),
            0,
          );
          const remaining = total - totalSales;
          const minStock = secConfig.minStockAlert || 5;
          const latestSaleVal = latestSaleCol
            ? parseFloat(String(row[latestSaleCol] || 0))
            : 0;

          if (trackerFilter === "low") {
            return remaining <= minStock;
          } else if (trackerFilter === "zero") {
            return latestSaleVal === 0 || !row[latestSaleCol!];
          } else if (trackerFilter === "high") {
            return latestSaleVal > 0;
          }
          return true;
        });
        if (trackerFilter === "high" && latestSaleCol) {
          const isOriginalArray = rows === secRows;
          if (isOriginalArray) {
            rows = [...rows];
          }
          rows.sort(
            (a, b) => getNum(b[latestSaleCol]) - getNum(a[latestSaleCol]),
          );
        }
      }

      if (trackerFilter === "all" && trackerSort !== "none" && latestSaleCol) {
        const isOriginalArray = rows === secRows;
        if (isOriginalArray) {
          rows = [...rows];
        }
        if (trackerSort === "high") {
          rows.sort(
            (a, b) => getNum(b[latestSaleCol]) - getNum(a[latestSaleCol]),
          );
        } else if (trackerSort === "low") {
          rows.sort(
            (a, b) => getNum(a[latestSaleCol]) - getNum(b[latestSaleCol]),
          );
        }
      }
    }

    return sortRows(rows, secConfig.columns);
  }, [
    state.pageRows,
    state.pageConfigs,
    activeConfig.secondarySearchPage,
    secondarySearchQuery,
    secondarySearchTags,
    trackerFilter,
    trackerSort,
  ]);

  const highlightText = (
    text: any,
    tokens: string[],
    isGhost: boolean = false,
  ) => {
    const strText = decodeHtmlEntities(String(text || ""));
    const cleanText = strText
      ? strText
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/&nbsp;/gi, " ")
      : "";
    if (!tokens || tokens.length === 0 || !cleanText) return cleanText;

    const escapedStrings = tokens.map((t) => {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let bStart = "";
      let bEnd = "";
      if (/^[0-9]/.test(t)) {
        bStart = ""; // Removed strict numeric boundary for SKU compatibility
        bEnd = "";
      } else if (/^[a-zA-Z]/.test(t)) {
        if (t.length <= 2) {
          bStart = "(?<![a-zA-Z])";
          bEnd = "(?![a-zA-Z]{2,})"; // Restored strict end boundary
        } else {
          bStart = "";
        }
      }
      return bStart + escaped + bEnd;
    });
    const regex = new RegExp("(" + escapedStrings.join("|") + ")", "gi");
    const parts = cleanText.split(regex);
    const highlightClass = isGhost
      ? "bg-green-100 text-green-900 border border-green-500 font-bold rounded-sm px-[1px]"
      : "bg-yellow-300 text-black font-bold rounded-sm px-[1px]";
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className={highlightClass}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const highlightHtmlText = (
    htmlString: string,
    tokens: string[],
    isGhost: boolean = false,
  ) => {
    const decodedHtml = decodeHtmlEntities(htmlString);
    const cleanHtml = decodedHtml
      ? decodedHtml.replace(/<!--[\s\S]*?-->/g, "").replace(/&nbsp;/gi, " ")
      : "";
    if (!tokens || tokens.length === 0 || !cleanHtml) return cleanHtml;
    const escapedStrings = tokens.map((t) => {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let bStart = "";
      let bEnd = "";
      if (/^[0-9]/.test(t)) {
        bStart = ""; // Removed strict numeric boundary for SKU compatibility
        bEnd = "";
      } else if (/^[a-zA-Z]/.test(t)) {
        if (t.length <= 2) {
          bStart = "(?<![a-zA-Z])";
          bEnd = "(?![a-zA-Z]{2,})"; // Restored strict end boundary
        } else {
          bStart = "";
        }
      }
      return bStart + escaped + bEnd;
    });
    const regex = new RegExp(
      "(" + escapedStrings.join("|") + ")(?![^<]*>)",
      "gi",
    );
    const highlightClass = isGhost
      ? "bg-green-100 text-green-900 border border-green-500 font-bold rounded-sm px-[1px]"
      : "bg-yellow-300 text-black font-bold rounded-sm px-[1px]";
    return cleanHtml.replace(
      regex,
      (match) => `<span class="${highlightClass}">${match}</span>`,
    );
  };

  const primaryQueries = [...primarySearchTags, currentSearch.trim()].filter(
    Boolean,
  );
  const secondaryQueries = [
    ...secondarySearchTags,
    secondarySearchQuery.trim(),
  ].filter(Boolean);

  const isSecondaryActive =
    activeSearchView === "secondary" &&
    !!(
      activeConfig.secondarySearchPage &&
      state.pageConfigs[activeConfig.secondarySearchPage]
    );

  const displayConfig = isSecondaryActive
    ? state.pageConfigs[activeConfig.secondarySearchPage!]
    : { ...activeConfig, columns: activeColumnsWithSum };
  const displayRows = isSecondaryActive ? secondaryFilteredRows : filteredRows;
  const displayQueries = isSecondaryActive ? secondaryQueries : primaryQueries;

  const primVisibleColumns = useMemo(() => {
    const pConfig = state.pageConfigs[state.activePage];
    if (!pConfig || !pConfig.columns) return [];
    return pConfig.columns
      .filter((col) => showArchived || !col.archived)
      .map((col) => ({
        id: col.key,
        accessorKey: col.key,
        header: () => col.name,
        size:
          col.width ||
          (col.key === "sr"
            ? state.globalRowNoWidth || 100
            : col.type === "image"
              ? 137
              : 150),
      }));
  }, [
    state.activePage,
    state.pageConfigs,
    showArchived,
    state.globalRowNoWidth,
  ]);

  const secVisibleColumns = useMemo(() => {
    const secPage = activeConfig.secondarySearchPage;
    if (!secPage || !state.pageConfigs[secPage]) return [];
    const secConfig = state.pageConfigs[secPage];
    return secConfig.columns
      .filter((col) => showArchived || !col.archived)
      .map((col) => ({
        id: col.key,
        accessorKey: col.key,
        header: () => col.name,
        size:
          col.width ||
          (col.key === "sr"
            ? state.globalRowNoWidth || 100
            : col.type === "image"
              ? 137
              : 150),
      }));
  }, [
    activeConfig.secondarySearchPage,
    state.pageConfigs,
    showArchived,
    state.globalRowNoWidth,
  ]);

  const primTable = useReactTable({
    data: filteredRows || [],
    columns: primVisibleColumns,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
  });

  const secTable = useReactTable({
    data: secondaryFilteredRows || [],
    columns: secVisibleColumns,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    primTable.resetColumnSizing();
  }, [state.activePage, primTable]);

  useEffect(() => {
    secTable.resetColumnSizing();
  }, [activeConfig.secondarySearchPage, secTable]);

  const primSizingInfo = primTable.getState().columnSizingInfo;
  const primSizing = primTable.getState().columnSizing;

  const secSizingInfo = secTable.getState().columnSizingInfo;
  const secSizing = secTable.getState().columnSizing;

  const prevPrimResizing = useRef<string | boolean | undefined>(false);
  const prevPrimPage = useRef<string>(state.activePage);
  useEffect(() => {
    const wasResizing = prevPrimResizing.current;
    const isResizing = primSizingInfo?.isResizingColumn;
    prevPrimResizing.current = isResizing;

    if (isResizing) {
      prevPrimPage.current = state.activePage;
    }

    if (wasResizing && !isResizing && typeof wasResizing === "string") {
      const finalWidth = primSizing[wasResizing];
      if (finalWidth) {
        handleSaveColumnWidth(wasResizing, finalWidth as number, prevPrimPage.current);
      }
    }
  }, [primSizingInfo?.isResizingColumn, primSizing, state.activePage, handleSaveColumnWidth]);

  const prevSecResizing = useRef<string | boolean | undefined>(false);
  const prevSecPage = useRef<string | null>(activeConfig.secondarySearchPage || null);
  useEffect(() => {
    const wasResizing = prevSecResizing.current;
    const isResizing = secSizingInfo?.isResizingColumn;
    prevSecResizing.current = isResizing;

    const secPage = activeConfig.secondarySearchPage;
    if (isResizing) {
      prevSecPage.current = secPage || null;
    }

    if (wasResizing && !isResizing && typeof wasResizing === "string") {
      const finalWidth = secSizing[wasResizing];
      if (finalWidth && prevSecPage.current) {
        handleSaveColumnWidth(wasResizing, finalWidth as number, prevSecPage.current);
      }
    }
  }, [
    secSizingInfo?.isResizingColumn,
    secSizing,
    activeConfig.secondarySearchPage,
    handleSaveColumnWidth
  ]);

  const primParentRef = useRef<HTMLDivElement>(null);
  const secParentRef = useRef<HTMLDivElement>(null);

  const primVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => primParentRef.current,
    estimateSize: () => state.pageConfigs[state.activePage]?.rowHeight || 100,
    overscan: 5,
  });

  const secVirtualizer = useVirtualizer({
    count: secondaryFilteredRows.length,
    getScrollElement: () => secParentRef.current,
    estimateSize: () => {
      const secPage = activeConfig.secondarySearchPage;
      return state.pageConfigs[secPage || ""]?.rowHeight || 100;
    },
    overscan: 5,
  });
  const savedPrimScroll = useRef(0);
  const savedSecScroll = useRef(0);
  const wasPrimSearchActive = useRef(false);
  const wasSecSearchActive = useRef(false);

  const prevPrimQueries = useRef<string[]>([]);
  const prevSecQueries = useRef<string[]>([]);
  const [ghostPrimQueries, setGhostPrimQueries] = useState<string[]>([]);
  const [ghostSecQueries, setGhostSecQueries] = useState<string[]>([]);
  const latestPrimFilteredIds = useRef<Set<string>>(new Set());
  const latestSecFilteredIds = useRef<Set<string>>(new Set());
  const [ghostPrimIds, setGhostPrimIds] = useState<Set<string>>(new Set());
  const [ghostSecIds, setGhostSecIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Primary
    if (primaryQueries.length > 0 && !wasPrimSearchActive.current) {
      prevPrimQueries.current = primaryQueries;
      setGhostPrimQueries([]);
      setGhostPrimIds(new Set());
      wasPrimSearchActive.current = true;
    } else if (primaryQueries.length === 0 && wasPrimSearchActive.current) {
      wasPrimSearchActive.current = false;
      if (localSettings.ghostHighlight) {
        setGhostPrimQueries(prevPrimQueries.current);
        setGhostPrimIds(latestPrimFilteredIds.current);
        setTimeout(() => {
          if (primParentRef.current)
            primParentRef.current.scrollTop = savedPrimScroll.current;
        }, 100);
      }
    }

    // Secondary
    if (secondaryQueries.length > 0 && !wasSecSearchActive.current) {
      prevSecQueries.current = secondaryQueries;
      setGhostSecQueries([]);
      setGhostSecIds(new Set());
      wasSecSearchActive.current = true;
    } else if (secondaryQueries.length === 0 && wasSecSearchActive.current) {
      wasSecSearchActive.current = false;
      if (localSettings.ghostHighlight) {
        setGhostSecQueries(prevSecQueries.current);
        setGhostSecIds(latestSecFilteredIds.current);
        setTimeout(() => {
          if (secParentRef.current)
            secParentRef.current.scrollTop = savedSecScroll.current;
        }, 100);
      }
    }
  }, [primaryQueries.length, secondaryQueries.length]);

  useEffect(() => {
    if (primaryQueries.length > 0)
      latestPrimFilteredIds.current = new Set(
        filteredRows.map((r) => String(r.id)),
      );
  }, [filteredRows, primaryQueries.length]);

  useEffect(() => {
    if (secondaryQueries.length > 0)
      latestSecFilteredIds.current = new Set(
        secondaryFilteredRows.map((r) => String(r.id)),
      );
  }, [secondaryFilteredRows, secondaryQueries.length]);

  useEffect(() => {
    const handleGlobalTableNav = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      const activeVirtualizer = isSecondaryActive
        ? secVirtualizer
        : primVirtualizer;
      const activeParentRef = isSecondaryActive ? secParentRef : primParentRef;
      const activeRowsCount = isSecondaryActive
        ? secondaryFilteredRows.length
        : filteredRows.length;

      if (e.key === "Home") {
        e.preventDefault();
        activeVirtualizer.scrollToIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        activeVirtualizer.scrollToIndex(activeRowsCount - 1);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        if (activeParentRef.current)
          activeParentRef.current.scrollTop -=
            activeParentRef.current.clientHeight;
      } else if (e.key === "PageDown") {
        e.preventDefault();
        if (activeParentRef.current)
          activeParentRef.current.scrollTop +=
            activeParentRef.current.clientHeight;
      }
    };

    window.addEventListener("keydown", handleGlobalTableNav);
    return () => window.removeEventListener("keydown", handleGlobalTableNav);
  }, [
    isSecondaryActive,
    primVirtualizer,
    secVirtualizer,
    filteredRows.length,
    secondaryFilteredRows.length,
  ]);

  const renderTable = (
    config: PageConfig,
    rows: RowData[],
    queries: string[],
    isSecondary: boolean,
    originalRows: RowData[],
    isGhost: boolean,
    ghostIds: Set<string>,
  ) => {
    const currentTable = isSecondary ? secTable : primTable;
    const currentVirtualizer = isSecondary ? secVirtualizer : primVirtualizer;
    const currentParentRef = isSecondary ? secParentRef : primParentRef;

    const flatHeadersMap = new Map();
    try {
      currentTable.getFlatHeaders().forEach(h => {
        flatHeadersMap.set(h.id, h);
      });
    } catch (e) {
      // Safety verification check: ignore if failing to precompute
    }

    const activePage = isSecondary
      ? state.pageConfigs[state.activePage]?.secondarySearchPage
      : state.activePage;

    const isTableSorted = config.columns.some(
      (col) => col.sortEnabled && col.sortPriority && col.sortPriority > 0,
    );
    const visibleColumns = config.columns.filter(
      (col) => showArchived || !col.archived,
    );
    if (!config || !config.columns) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 m-4">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-gray-700">
            Page Configuration Missing
          </h3>
        </div>
      );
    }

    const virtualItems = currentVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom =
      virtualItems.length > 0
        ? currentVirtualizer.getTotalSize() -
          virtualItems[virtualItems.length - 1].end
        : 0;
    const colSpan =
      visibleColumns.length +
      (!isSecondary && config.rowReorderEnabled ? 1 : 0) + 1;

    const colTokensMap: Record<string, string[]> = {};
    visibleColumns.forEach((col) => {
      let tokens: string[] = [];
      queries.forEach((query) => {
        const qLower = query.toLowerCase();
        const colonIndex = qLower.indexOf(":");
        if (colonIndex > 0) {
          const prefix = qLower.substring(0, colonIndex).trim();
          const suffix = qLower.substring(colonIndex + 1).trim();
          if (
            col.name.toLowerCase().includes(prefix) ||
            prefix.includes(col.name.toLowerCase())
          ) {
            tokens.push(...suffix.split(/\s+/).filter(Boolean));
          }
        } else {
          tokens.push(...qLower.split(/\s+/).filter(Boolean));
        }
      });
      colTokensMap[col.key] = tokens;
    });

    return (
      <div
        className="flex-1 min-h-0 overflow-x-auto overflow-y-auto border-none rounded-none m-0 p-0 relative outline-none"
        ref={currentParentRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
          )
            return;
          if (e.key === "Home") {
            e.preventDefault();
            currentVirtualizer.scrollToIndex(0);
          } else if (e.key === "End") {
            e.preventDefault();
            currentVirtualizer.scrollToIndex(rows.length - 1);
          } else if (e.key === "PageUp") {
            e.preventDefault();
            if (currentParentRef.current)
              currentParentRef.current.scrollTop -=
                currentParentRef.current.clientHeight;
          } else if (e.key === "PageDown") {
            e.preventDefault();
            if (currentParentRef.current)
              currentParentRef.current.scrollTop +=
                currentParentRef.current.clientHeight;
          }
        }}
        onScroll={(e) => {
          const isActualSearchEmpty = queries.length === 0 || isGhost;
          if (isSecondary) {
            if (isActualSearchEmpty)
              savedSecScroll.current = e.currentTarget.scrollTop;
          } else {
            if (isActualSearchEmpty)
              savedPrimScroll.current = e.currentTarget.scrollTop;
          }
        }}
      >
        <DragDropContext onDragEnd={isSecondary ? () => {} : handleDragEnd}>
          <table
            className="border-separate border-spacing-0 table-fixed w-max max-w-none text-[14px] font-normal"
            style={{
              width: `${currentTable.getTotalSize() + (!isSecondary && config.rowReorderEnabled ? 60 : 0) + 50}px`,
            }}
            onMouseOver={handleTableMouseOver}
            onMouseOut={handleTableMouseOut}
          >
            <thead>
              <tr>
                {!isSecondary && config.rowReorderEnabled && (
                  <th
                    className={`sticky top-0 z-20 text-center p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] bg-[#f3f3f3] data-[hovered-col=true]:bg-[#fce7f3]`}
                    style={{
                      width: "60px",
                      minWidth: "60px",
                      maxWidth: "60px",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={
                        rows.length > 0 && selectedRowIds.size === rows.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(new Set(rows.map((r) => r.id)));
                        } else {
                          setSelectedRowIds(new Set());
                        }
                      }}
                    />
                  </th>
                )}
                {visibleColumns.map((col, i) => {
                  const header = flatHeadersMap.get(col.key) || currentTable
                    .getFlatHeaders()
                    .find((h) => h.id === col.key);
                  const isResizing = header?.column?.getIsResizing();
                  const activeWidth = header
                    ? header.getSize()
                    : col.width ||
                      (col.key === "sr"
                        ? state.globalRowNoWidth || 100
                        : col.type === "image"
                          ? 137
                          : 150);

                  const defaultWidthClass =
                    col.key === "sr"
                      ? "text-center"
                      : col.type === "image"
                        ? "text-center"
                        : "text-left";

                  return (
                    <th
                      key={col.key}
                      className={`sticky top-0 z-20 text-[14px] font-bold text-[#2f3d49] p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${defaultWidthClass} bg-[#f3f3f3] data-[hovered-col=true]:bg-[#fce7f3] ${isResizing ? "overflow-visible" : ""}`}
                      style={{
                        width: `${activeWidth}px`,
                        minWidth: `${activeWidth}px`,
                        maxWidth: `${activeWidth}px`,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {i + 1}. {col.name}{" "}
                        {col.sortPriority ? (
                          <span className="text-[10px] font-bold text-gray-500">
                            (P{col.sortPriority})
                          </span>
                        ) : (
                          ""
                        )}{" "}
                        {col.locked && "🔒"}
                        {col.sortEnabled && col.key !== "sr" && (
                          <div className="flex items-center gap-0.5">
                            {col.sortDirection === "desc" ? (
                              <ArrowDown
                                size={12}
                                className={
                                  col.sortLocked ? "text-gray-400" : ""
                                }
                              />
                            ) : (
                              <ArrowUp
                                size={12}
                                className={
                                  col.sortLocked ? "text-gray-400" : ""
                                }
                              />
                            )}
                            {col.sortLocked && (
                              <Lock size={12} className="text-gray-500" />
                            )}
                          </div>
                        )}
                      </div>

                      <ColumnResizeHandle 
                        header={header} 
                        onManualSave={(id, w) => {
                          let targetPage = state.activePage;
                          if (isSecondary && activeConfig?.secondarySearchPage) {
                            targetPage = activeConfig.secondarySearchPage;
                          }
                          handleSaveColumnWidth(id, w, targetPage);
                        }} 
                      />
                    </th>
                  );
                })}
                <th
                  className="border-none bg-transparent pointer-events-none"
                  style={{ width: "50px", minWidth: "50px", maxWidth: "50px" }}
                ></th>
              </tr>
            </thead>
            <Droppable
              droppableId={`droppable-tbody-${isSecondary ? "secondary" : "primary"}`}
            >
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colSpan}
                        className="text-center text-[#90a4ae] font-normal p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0]"
                      >
                        {queries.length > 0
                          ? "No rows match your search."
                          : "No row data yet."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paddingTop > 0 && (
                        <tr>
                          <td
                            colSpan={colSpan}
                            style={{ height: `${paddingTop}px` }}
                          />
                        </tr>
                      )}
                      {virtualItems.map((virtualItem) => {
                        const rowIndex = virtualItem.index;
                        const row = rows[rowIndex];
                        const isActiveRow = !(
                          isGhost && !ghostIds.has(String(row.id))
                        );

                        const isRowEditing = inlineEdit?.id?.startsWith(
                          String(row.id) + "-",
                        );

                        const draggableProps: any = {
                          draggableId: `${isSecondary ? "sec-" : ""}${row.id}`,
                          index: rowIndex,
                          isDragDisabled:
                            isSecondary ||
                            !config.rowReorderEnabled ||
                            queries.length > 0,
                        };

                        return (
                          <Draggable key={row.id} {...draggableProps}>
                            {(provided: any, snapshot: any) => (
                              <tr
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`${!isSecondary && selectedRowIds.has(row.id) ? "bg-[#e8f0fe]" : ""} ${snapshot.isDragging ? "bg-[#e8f0fe] shadow-xl table" : ""} ${isRowEditing ? "relative z-[60]" : ""}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  ...(snapshot.isDragging && {
                                    display: "table",
                                    tableLayout: "fixed",
                                  }),
                                  ...(isRowEditing
                                    ? { position: "relative", zIndex: 60 }
                                    : {}),
                                  height: `${config.rowHeight || 100}px`,
                                }}
                              >
                                {!isSecondary && config.rowReorderEnabled && (
                                  <td
                                    className={`text-center p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] data-[hovered-col=true]:bg-[#f0f7ff] data-[hovered-row=true]:bg-[#e8f0fe] data-[hovered-exact=true]:!bg-[#d2e3fc] data-[hovered-exact=true]:outline data-[hovered-exact=true]:outline-[3px] data-[hovered-exact=true]:outline-[#2b579a] data-[hovered-exact=true]:relative data-[hovered-exact=true]:z-10 data-[hovered-exact=true]:shadow-inner`}
                                    style={{
                                      width: "60px",
                                      minWidth: "60px",
                                      maxWidth: "60px",
                                    }}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700"
                                      >
                                        <GripVertical size={16} />
                                      </div>
                                      <input
                                        type="checkbox"
                                        className="cursor-pointer"
                                        checked={selectedRowIds.has(row.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(
                                            selectedRowIds,
                                          );
                                          if (e.target.checked)
                                            newSet.add(row.id);
                                          else newSet.delete(row.id);
                                          setSelectedRowIds(newSet);
                                        }}
                                      />
                                    </div>
                                  </td>
                                )}
                                {visibleColumns.map((col, colIndex) => {
                                  const header = flatHeadersMap.get(col.key) || currentTable
                                    .getFlatHeaders()
                                    .find((h) => h.id === col.key);
                                  const activeWidth = header
                                    ? header.getSize()
                                    : col.width ||
                                      (col.key === "sr"
                                        ? state.globalRowNoWidth || 100
                                        : col.type === "image"
                                          ? 137
                                          : 150);

                                  const widthStyle = {
                                    width: `${activeWidth}px`,
                                    minWidth: `${activeWidth}px`,
                                    maxWidth: `${activeWidth}px`,
                                  };

                                  const hoverClass =
                                    "data-[hovered-col=true]:bg-[#f0f7ff] data-[hovered-row=true]:bg-[#e8f0fe] data-[hovered-exact=true]:!bg-[#d2e3fc] data-[hovered-exact=true]:outline data-[hovered-exact=true]:outline-[3px] data-[hovered-exact=true]:outline-[#2b579a] data-[hovered-exact=true]:relative data-[hovered-exact=true]:z-10 data-[hovered-exact=true]:shadow-inner";
                                  const colTokens = isActiveRow
                                    ? colTokensMap[col.key] || []
                                    : [];

                                  const isResizing = header?.column?.getIsResizing();
                                  const commonProps = {
                                    style: {
                                      ...widthStyle,
                                      position: "relative" as const,
                                      overflow: isResizing
                                        ? ("visible" as const)
                                        : ("hidden" as const),
                                    },
                                  };

                                  if (col.key === "sr") {
                                    return (
                                      <td
                                        key={col.key}
                                        {...commonProps}
                                        className={`font-normal p-1 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] bg-[#f3f3f3] data-[hovered-row=true]:bg-[#fce7f3] overflow-hidden`}
                                      >
                                        <div className="flex items-center justify-center gap-0 px-0.5 whitespace-nowrap">
                                          <span className="text-[14px]">
                                            {isTableSorted
                                              ? rowIndex + 1
                                              : originalRows.findIndex(
                                                  (r) => r.id === row.id,
                                                ) + 1}
                                            .
                                          </span>
                                          <div className="flex items-center shrink-0">
                                            <button
                                              className="border-0 bg-transparent cursor-pointer text-[14px] hover:scale-110 transition-transform p-0"
                                              title="Edit Row"
                                              onClick={() => {
                                                setEditingRowId(row.id);
                                                setEditingPageName(
                                                  isSecondary
                                                    ? activeConfig.secondarySearchPage!
                                                    : state.activePage,
                                                );
                                                toggleModal("addRow", true);
                                              }}
                                            >
                                              ✏️
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }

                                  const rawVal = row[col.key];

                                  if (col.type === "image") {
                                    const imgData =
                                      typeof rawVal === "object" &&
                                      rawVal !== null
                                        ? rawVal.data
                                        : rawVal;
                                    const isImg =
                                      typeof imgData === "string" &&
                                      (imgData.startsWith("data:image") ||
                                        /^https?:\/\//i.test(imgData) ||
                                        imgData.includes("."));
                                    return (
                                      <td
                                        key={col.key}
                                        {...commonProps}
                                        className={`text-center p-0 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} bg-white overflow-hidden`}
                                        style={{
                                          ...commonProps.style,
                                          height: `${config.rowHeight || 100}px`,
                                        }}
                                        onMouseMove={(e) => {
                                          if (
                                            isImg &&
                                            config.hoverPreviewEnabled
                                          ) {
                                            setHoveredImage({
                                              url: getImageUrl(imgData),
                                              x: e.clientX,
                                              y: e.clientY,
                                            });
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          setHoveredImage(null);
                                        }}
                                      >
                                        {isImg ? (
                                          <img
                                            src={getImageUrl(imgData, true)}
                                            alt="img"
                                            loading="lazy"
                                            className="w-full h-full object-contain cursor-pointer block"
                                            onClick={() => {
                                              setPreviewContext({
                                                rowId: row.id,
                                                imageKey: col.key,
                                                pageName: isSecondary
                                                  ? activeConfig.secondarySearchPage!
                                                  : state.activePage,
                                              });
                                              toggleModal("imagePreview", true);
                                            }}
                                          />
                                        ) : (
                                          <span className="w-full h-full inline-flex items-center justify-center text-[#9e9e9e] text-2xl bg-[#fafafa]">
                                            📷
                                          </span>
                                        )}
                                      </td>
                                    );
                                  }

                                  if (col.type === "text_with_copy_button") {
                                    const items = Array.isArray(rawVal)
                                      ? rawVal
                                          .map((v) => String(v || "").trim())
                                          .filter(Boolean)
                                      : String(rawVal || "").trim()
                                        ? [String(rawVal).trim()]
                                        : [];
                                    const isCellActive =
                                      activePopupId?.startsWith(
                                        `${row.id}-${col.key}`,
                                      );
                                    const cellClass = isCellActive
                                      ? "bg-[#fff3cd] shadow-[inset_0_0_0_2px_#fac800] relative z-10 transition-all"
                                      : hoverClass;

                                    return (
                                      <td
                                        key={col.key}
                                        {...commonProps}
                                        className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${cellClass} overflow-hidden`}
                                      >
                                        {items.length > 0 && (
                                          <div className="flex flex-col gap-1">
                                            {items.map((item, i) => {
                                              const hideButton =
                                                item.startsWith("!");
                                              let displayText = hideButton
                                                ? item.slice(1)
                                                : item;
                                              displayText = decodeHtmlEntities(
                                                displayText,
                                              )
                                                .replace(/<!--[\s\S]*?-->/g, "")
                                                .replace(/&nbsp;/gi, " ");
                                              const itemId = `${row.id}-${col.key}-${i}`;
                                              const hasHtml =
                                                /<[a-z][\s\S]*>/i.test(
                                                  displayText,
                                                );
                                              return (
                                                <div
                                                  key={i}
                                                  className={`flex items-center justify-between gap-1.5 border border-[#d7e3f6] bg-[#f9fcff] rounded px-1.5 py-0.5 min-h-[25px] ${hideButton ? "bg-gray-50 border-gray-100 opacity-80" : ""}`}
                                                >
                                                  {hasHtml ? (
                                                    <span
                                                      className="whitespace-pre-wrap"
                                                      dangerouslySetInnerHTML={{
                                                        __html:
                                                          highlightHtmlText(
                                                            displayText,
                                                            colTokens,
                                                            isGhost,
                                                          ),
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="whitespace-pre-wrap">
                                                      {highlightText(
                                                        displayText,
                                                        colTokens,
                                                        isGhost,
                                                      )}
                                                    </span>
                                                  )}
                                                  {!hideButton && (
                                                    <>
                                                      <button
                                                        className="border-0 rounded bg-[#2b579a] text-white px-1.5 py-0.5 text-[11px] font-bold cursor-pointer shrink-0"
                                                        onClick={(e) => {
                                                          const target =
                                                            e.currentTarget;
                                                          const plainText =
                                                            hasHtml
                                                              ? displayText.replace(
                                                                  /<[^>]*>?/gm,
                                                                  "",
                                                                )
                                                              : displayText;
                                                          navigator.clipboard
                                                            .writeText(
                                                              plainText,
                                                            )
                                                            .then(() => {
                                                              setActivePopupId(
                                                                itemId,
                                                              );
                                                              setActiveAnchor(
                                                                target,
                                                              );
                                                              const activeCopyCfg =
                                                                state
                                                                  .pageConfigs[
                                                                  state
                                                                    .activePage
                                                                ]
                                                                  ?.copyBoxConfig;
                                                              if (
                                                                activeCopyCfg
                                                              ) {
                                                                const currentPage =
                                                                  isSecondary
                                                                    ? activeConfig.secondarySearchPage!
                                                                    : state.activePage;
                                                                if (
                                                                  activeCopyCfg
                                                                    .box1
                                                                    .sourcePage ===
                                                                    currentPage &&
                                                                  activeCopyCfg
                                                                    .box1
                                                                    .sourceColumn ===
                                                                    col.key
                                                                )
                                                                  setBox1Value(
                                                                    plainText,
                                                                  );
                                                                if (
                                                                  activeCopyCfg
                                                                    .box2
                                                                    .sourcePage ===
                                                                    currentPage &&
                                                                  activeCopyCfg
                                                                    .box2
                                                                    .sourceColumn ===
                                                                    col.key
                                                                )
                                                                  setBox2Value(
                                                                    plainText,
                                                                  );
                                                              }
                                                            });
                                                        }}
                                                      >
                                                        Copy
                                                      </button>
                                                      <CopyPopupNotification
                                                        text={
                                                          hasHtml
                                                            ? displayText.replace(
                                                                /<[^>]*>?/gm,
                                                                "",
                                                              )
                                                            : displayText
                                                        }
                                                        columnName={col.name}
                                                        columnNumber={
                                                          colIndex + 1
                                                        }
                                                        isActive={
                                                          activePopupId ===
                                                          itemId
                                                        }
                                                        anchorElement={
                                                          activeAnchor
                                                        }
                                                        onClose={
                                                          handleClosePopup
                                                        }
                                                      />
                                                    </>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  }

                                  if (config.isTrackerPage) {
                                    if (col.key === "custom_temp_sum") {
                                      const breakdown = parseMultiSource(row.custom_temp_sum_breakdown);
                                      return (
                                        <td
                                          key={col.key}
                                          {...commonProps}
                                          className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] overflow-hidden whitespace-pre-wrap bg-purple-50 text-purple-900 font-bold text-center`}
                                        >
                                          <div className="flex flex-col gap-1 justify-center w-full min-h-[20px]">
                                            {breakdown.map((b: any, idx: number) => (
                                              <div key={idx} className={`w-full px-1.5 py-0.5 rounded text-[14px] font-bold border flex items-center justify-between gap-1 shadow-sm ${b.color}`}>
                                                <span className="opacity-70 shrink-0 capitalize">{b.source}:</span>
                                                <span className="flex-1 text-right">{b.qty}</span>
                                              </div>
                                            ))}
                                            <div className="mt-1 pt-1 border-t border-purple-200 text-purple-900 font-extrabold text-[15px] flex items-center justify-between w-full">
                                              <span className="opacity-50 text-[11px] uppercase tracking-wider">Total</span>
                                              <span>{rawVal}</span>
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    }

                                    if (col.key === "remaining_qty") {
                                      const totalSources = parseMultiSource(
                                        row.total_qty,
                                      );
                                      const saleCols = config.columns.filter(
                                        (c) => c.type === "sale_tracker",
                                      );

                                      const remainingSources = totalSources.map(
                                        (ts: any) => {
                                          let totalSaleForSource = 0;
                                          saleCols.forEach((sc) => {
                                            const sales = parseMultiSource(
                                              row[sc.key],
                                            );
                                            const saleEntry = sales.find(
                                              (s: any) =>
                                                s.source === ts.source,
                                            );
                                            if (saleEntry)
                                              totalSaleForSource +=
                                                parseFloat(saleEntry.qty) || 0;
                                          });
                                          return {
                                            ...ts,
                                            remaining:
                                              (parseFloat(ts.qty) || 0) -
                                              totalSaleForSource,
                                          };
                                        },
                                      );

                                      return (
                                        <td
                                          key={col.key}
                                          {...commonProps}
                                          className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass}`}
                                        >
                                          <div className="flex flex-col gap-1 justify-center">
                                            {remainingSources.map(
                                              (s: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className={`px-2 py-0.5 rounded text-[14px] font-bold border flex items-center gap-1 ${s.remaining <= (config.minStockAlert ?? 0) ? "bg-[#FF0000] text-white border-[#cc0000] shadow-md" : s.color}`}
                                                >
                                                  <span className={s.remaining <= (config.minStockAlert ?? 0) ? "text-white font-extrabold opacity-100" : "opacity-70"}>
                                                    {s.source}:
                                                  </span>{" "}
                                                  <span>{s.remaining}</span>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }

                                    if (col.key === "total_qty") {
                                      const totalSources =
                                        parseMultiSource(rawVal);
                                      return (
                                        <td
                                          key={col.key}
                                          {...commonProps}
                                          className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass}`}
                                        >
                                          <div className="flex flex-col gap-1 justify-center">
                                            {totalSources.map(
                                              (s: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className={`px-2 py-0.5 rounded text-[14px] font-bold border flex items-center gap-1 ${s.color}`}
                                                >
                                                  <span className="opacity-70">
                                                    {s.source}:
                                                  </span>{" "}
                                                  <span>{s.qty}</span>
                                                </div>
                                              ),
                                            )}

                                          </div>
                                        </td>
                                      );
                                    }

                                    if (col.type === "sale_tracker") {
                                      const totalSources = parseMultiSource(
                                        row.total_qty,
                                      );
                                      const currentVal =
                                        parseMultiSource(rawVal);
                                      
                                      const isCellEditing = inlineEdit?.id?.startsWith(`${row.id}-${col.key}-`);
                                      const draftVal = isCellEditing ? parseMultiSource(inlineEdit!.val) : currentVal;

                                      return (
                                        <td
                                          key={col.key}
                                          {...commonProps}
                                          style={{ ...commonProps.style, overflow: isCellEditing ? "visible" : commonProps.style.overflow, zIndex: isCellEditing ? 99999 : undefined }}
                                          className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} text-xs ${isCellEditing ? "relative !z-[60]" : ""}`}
                                        >
                                          <div className="flex flex-col gap-1 justify-center w-full min-h-[20px]">
                                            {totalSources.map(
                                              (ts: any, idx: number) => {
                                                const isThisRowEditing = inlineEdit?.id === `${row.id}-${col.key}-${ts.source}`;
                                                const currentSaleEntry = (isThisRowEditing ? draftVal : currentVal).find(
                                                  (s: any) => s.source === ts.source
                                                );
                                                const saleQty = currentSaleEntry ? currentSaleEntry.qty : 0;
                                                const originalSaleEntry = currentVal.find((s: any) => s.source === ts.source);
                                                const originalQty = originalSaleEntry ? originalSaleEntry.qty : 0;

                                                return (
                                                  <div key={idx} className="w-full">
                                                    <div className={`group w-full px-1.5 py-0.5 rounded text-[14px] font-bold border flex items-center justify-between gap-1 ${ts.color}`}>
                                                      <div className="flex items-center justify-between w-full">
                                                        <span className="opacity-70 shrink-0">{ts.source}:</span>
                                                        <span className="flex-1 text-right">{saleQty}</span>
                                                      </div>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setInlineEdit({
                                                            id: `${row.id}-${col.key}-${ts.source}`,
                                                            colKey: col.key,
                                                            val: rawVal ? String(rawVal) : JSON.stringify([]),
                                                            history: [],
                                                            historyPointer: 0,
                                                          });
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-white/60 hover:bg-white text-gray-700 rounded p-1 shadow-sm border border-black/10 w-6 h-6 flex items-center justify-center text-[10px] cursor-pointer ml-1"
                                                        title="Edit sale"
                                                      >
                                                        ✏️
                                                      </button>
                                                    </div>

                                                    {isThisRowEditing && (
                                                      <div 
                                                        className="absolute z-[999999] top-0 right-0 bg-white p-3 rounded-lg shadow-[0_5px_20px_rgba(0,0,0,0.5)] border-[3px] flex flex-col gap-4 min-w-[240px]"
                                                        style={{ borderColor: ts.color?.includes('blue') ? '#3b82f6' : ts.color?.includes('green') ? '#22c55e' : ts.color?.includes('yellow') ? '#eab308' : ts.color?.includes('red') ? '#ef4444' : ts.color?.includes('purple') ? '#a855f7' : '#94a3b8' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <div className="font-bold text-gray-700 text-[14px]">Edit Sale for {ts.source}</div>
                                                        <div className="text-[11px] text-gray-500 mb-2 -mt-0.5">Previous Value: <span className="font-bold text-gray-800">{originalQty}</span></div>
                                                        <div className="flex items-center justify-between gap-2 border-b pb-3">
                                                          <span className={`px-2 py-1 rounded text-[15px] font-bold border ${ts.color}`}>{ts.source}</span>
                                                          <input
                                                            type="number"
                                                            value={saleQty === 0 ? "0" : saleQty || ""}
                                                            placeholder="0"
                                                            onChange={(e) => {
                                                              const copy = [...draftVal];
                                                              const existingIdx = copy.findIndex((s: any) => s.source === ts.source);
                                                              const newVal = e.target.value;
                                                              if (existingIdx >= 0) {
                                                                copy[existingIdx].qty = newVal;
                                                              } else {
                                                                copy.push({ source: ts.source, qty: newVal, color: ts.color });
                                                              }
                                                              setInlineEdit((prev) => ({ ...prev!, val: JSON.stringify(copy) }));
                                                            }}
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                            onFocus={(e) => {
                                                              setTimeout(() => e.target.select(), 0);
                                                            }}
                                                            onKeyDown={(e) => {
                                                              if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                handleSaveInlineEdit(activePage!, row.id, col.key, inlineEdit!.val);
                                                              } else if (e.key === "Escape") {
                                                                e.preventDefault();
                                                                setInlineEdit(null);
                                                              }
                                                            }}
                                                            autoFocus
                                                            className="w-24 bg-gray-50 border border-gray-300 px-2 py-1 text-right font-bold text-[16px] rounded text-blue-800 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-gray-400/70"
                                                          />
                                                        </div>
                                                        <div className="flex items-center justify-end gap-3 pt-1">
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setInlineEdit(null);
                                                            }}
                                                            className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded px-4 py-1.5 text-sm font-bold shadow-md transition-colors"
                                                          >
                                                            Cancel
                                                          </button>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleSaveInlineEdit(activePage!, row.id, col.key, inlineEdit!.val);
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded px-5 py-1.5 text-sm font-bold shadow-md transition-colors"
                                                          >
                                                            Save
                                                          </button>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              }
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }
                                  }

                                  if (Array.isArray(rawVal)) {
                                    return (
                                      <td
                                        key={col.key}
                                        {...commonProps}
                                        className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} overflow-hidden`}
                                      >
                                        {rawVal.map((v, i) => {
                                          const strVal = String(v || "");
                                          const hasHtml =
                                            /<[a-z][\s\S]*>/i.test(strVal);
                                          return (
                                            <React.Fragment key={i}>
                                              {hasHtml ? (
                                                <span
                                                  className="whitespace-pre-wrap"
                                                  dangerouslySetInnerHTML={{
                                                    __html: highlightHtmlText(
                                                      strVal,
                                                      colTokens,
                                                      isGhost,
                                                    ),
                                                  }}
                                                />
                                              ) : (
                                                <span className="whitespace-pre-wrap">
                                                  {highlightText(
                                                    strVal,
                                                    colTokens,
                                                    isGhost,
                                                  )}
                                                </span>
                                              )}
                                              <br />
                                            </React.Fragment>
                                          );
                                        })}
                                      </td>
                                    );
                                  }

                                  const strRawVal = String(rawVal || "");
                                  const hasHtmlRaw = /<[a-z][\s\S]*>/i.test(
                                    strRawVal,
                                  );

                                  return (
                                    <td
                                      key={col.key}
                                      {...commonProps}
                                      className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} overflow-hidden whitespace-pre-wrap`}
                                    >
                                      {hasHtmlRaw ? (
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: highlightHtmlText(
                                              strRawVal,
                                              colTokens,
                                              isGhost,
                                            ),
                                          }}
                                        />
                                      ) : (
                                        highlightText(
                                          rawVal,
                                          colTokens,
                                          isGhost,
                                        )
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="border-none bg-transparent pointer-events-none" style={{ width: "50px", minWidth: "50px", maxWidth: "50px" }}></td>
                              </tr>
                            )}
                          </Draggable>
                        );
                      })}
                      {paddingBottom > 0 && (
                        <tr>
                          <td
                            colSpan={colSpan}
                            style={{ height: `${paddingBottom}px` }}
                          />
                        </tr>
                      )}
                    </>
                  )}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>
    );
  };

  const currentLowStockIds = useMemo(() => {
    let trackerConfig = activeConfig.isTrackerPage ? activeConfig : null;
    let trackerRows = activeRows;

    if (!trackerConfig) {
      // If on source page, find its linked tracker
      const linkedEntry = Object.entries(state.pageConfigs).find(
        ([, cfg]) => (cfg as PageConfig).linkedSourcePage === state.activePage,
      );
      if (linkedEntry) {
        trackerConfig = linkedEntry[1] as PageConfig;
        trackerRows = state.pageRows[linkedEntry[0]] || [];
      }
    }

    if (trackerConfig) {
      const minStock = trackerConfig.minStockAlert || 5;
      const saleCols = trackerConfig.columns.filter(
        (c) => c.type === "sale_tracker",
      );
      const ids = new Set<string>();
      trackerRows.forEach((row) => {
        const getNum = (v: any) =>
          parseMultiSource(v).reduce(
            (sum: number, s: any) => sum + (parseFloat(s.qty) || 0),
            0,
          );
        const total = getNum(row.total_qty);
        const totalSales = saleCols.reduce(
          (sum, c) => sum + getNum(row[c.key]),
          0,
        );
        const remaining = total - totalSales;
        if (remaining <= minStock) {
          ids.add(String(row.id));
        }
      });
      return ids;
    }
    return null; // Return null if no tracker logic applies to current page
  }, [
    activeConfig,
    activeRows,
    state.activePage,
    state.pageConfigs,
    state.pageRows,
  ]);

  const tableContent = (
    <div className="w-full flex-1 min-h-0 flex flex-col text-[#333] text-left m-0 p-0">
      {isSecondaryActive && (
        <div className="bg-[#e8edf2] px-3 py-1.5 text-sm font-bold text-[#2b579a] border-y border-[#d8d8d8]">
          Viewing Secondary Data: {activeConfig.secondarySearchPage}
        </div>
      )}
      {displayConfig.isTrackerPage && (
        <div className="bg-[#e8edf2] px-3 py-2 flex flex-wrap gap-2 border-b border-[#d8d8d8] items-center">
          <button
            onClick={() => setIsSalePromptOpen(true)}
            className="bg-[#217346] text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-[#1e6b41]"
          >
            ➕ Add Sale Column
          </button>
          {activeCustomSum ? (
            <button
              onClick={() => setActiveCustomSum(null)}
              className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-purple-700 flex items-center gap-1"
            >
              ❌ Clear Sum
            </button>
          ) : (
            <button
              onClick={() => {
                const saleCols = activeConfig.columns.filter(
                  (c) => c.type === "sale_tracker",
                );
                if (saleCols.length > 0) {
                  setSumStartCol(saleCols[0].key);
                  setSumEndCol(saleCols[saleCols.length - 1].key);
                }
                setSumStartSearchQuery("");
                setSumEndSearchQuery("");
                setSumSelectedSources([]);
                setIsSumModalOpen(true);
              }}
              className="bg-purple-100 text-purple-800 border border-purple-300 px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-purple-200 flex items-center gap-1"
            >
              📊 Range Sum
            </button>
          )}
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-amber-700 flex items-center gap-1"
          >
            🗄️ Archive Column
          </button>
          {!activeConfig.isTrackerPage && (
            <label className="flex items-center gap-1 text-xs font-bold text-gray-700 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded"
              />{" "}
              Show History
            </label>
          )}
          <div className="flex-1"></div>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                🔍 Filter:
              </span>
              <select
                value={trackerFilter}
                onChange={(e) => setTrackerFilter(e.target.value as any)}
                className="text-xs font-bold text-[#2b579a] border-none outline-none cursor-pointer bg-transparent"
              >
                <option value="all">🟢 All Data (Reset)</option>
                <option value="high">⭐ High Sale</option>
                <option value="zero">0️⃣ Zero Sale</option>
                <option value="low">🚨 Low Stock</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                ↕️ Sort:
              </span>
              <select
                value={trackerSort}
                onChange={(e) => setTrackerSort(e.target.value as any)}
                className="text-xs font-bold text-[#2b579a] border-none outline-none cursor-pointer bg-transparent"
              >
                <option value="none">🟢 Default (Reset)</option>
                <option value="high">⬆️ High Sale First</option>
                <option value="low">⬇️ Low Sale First</option>
              </select>
            </div>
          </div>
        </div>
      )}
      {(() => {
        const isGhostActive =
          displayQueries.length === 0 &&
          (isSecondaryActive
            ? ghostSecQueries.length > 0
            : ghostPrimQueries.length > 0);
        const finalQueries =
          displayQueries.length > 0
            ? displayQueries
            : isSecondaryActive
              ? ghostSecQueries
              : ghostPrimQueries;
        const originalRows = isSecondaryActive
          ? state.pageRows[activeConfig.secondarySearchPage!] || []
          : activeRows;
        const ghostIds = isSecondaryActive ? ghostSecIds : ghostPrimIds;
        return renderTable(
          displayConfig,
          displayRows,
          finalQueries,
          isSecondaryActive,
          originalRows,
          isGhostActive,
          ghostIds,
        );
      })()}
    </div>
  );

  const isAnyModalOpen =
    Object.values(modals).some((v) => v) ||
    isDupModalOpen ||
    showHistoryLimitModal ||
    clearDBModal.isOpen ||
    isImporting ||
    isExporting;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden w-full gap-2 pl-2 pr-2 pt-[7px] pb-[6px] ml-0 bg-[#f4f7f6] text-[#333] font-sans box-border">
      <div className="flex justify-between items-center bg-white border border-[#d8d8d8] rounded-md p-2 px-2.5">
        <div className="text-[19px] font-bold text-[#2c3e50]">
          📦 Dynamic Inventory Platform{" "}
          <span className="text-[#217346] text-sm">(Pro Classic Visual)</span>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center relative">
          <Button
            variant="dark"
            onClick={() => toggleModal("createPage", true)}
          >
            <Plus size={14} /> Add Page
          </Button>
          <div className="relative inline-block" ref={settingsRef}>
            <Button
              variant="dark"
              onClick={() => setShowTopSettings(!showTopSettings)}
            >
              <Settings size={14} /> Settings
            </Button>
            {showTopSettings && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[260px] bg-white border border-[#d7dde1] rounded-md shadow-xl p-2 z-50">
                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 pb-1.5 uppercase tracking-wide">
                  Settings
                </div>
                <div className="text-xs text-[#607d8b] px-1 pb-2 font-bold">
                  Active Page:{" "}
                  <span className="text-gray-800">
                    {state.activePage || "No page selected"}
                  </span>
                </div>
                <button
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] disabled:opacity-55 disabled:cursor-not-allowed"
                  disabled={!state.activePage}
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal("activePageSettings", true);
                  }}
                >
                  ⚙️ Active Page Settings{" "}
                  {state.activePage ? `(${state.activePage})` : ""}
                </button>

                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">
                  Global Settings
                </div>
                <button
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    setTempHistoryLimit(maxSearchHistory);
                    setShowHistoryLimitModal(true);
                  }}
                >
                  🕒 Search History Limit
                </button>

                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">
                  Pages Reorder
                </div>
                <button
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal("reorderPages", true);
                  }}
                >
                  🔄 Pages Reorder
                </button>

                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">
                  DATA BACKUP:
                </div>
                <button
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal("exportChoice", true);
                  }}
                >
                  💾 Export Backup
                </button>
                <button
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2]"
                  onClick={() => {
                    setShowTopSettings(false);
                    setTimeout(() => {
                      fileInputRef.current?.click();
                    }, 50);
                  }}
                >
                  📂 Import Backup (JSON/ZIP)
                </button>

                <div className="text-[11px] font-bold text-blue-600 border-b border-blue-100 mb-2 mt-3 pb-1.5 uppercase tracking-wide">
                  Device Specific (This PC Only)
                </div>
                <div className="flex items-center justify-between p-2 bg-[#f4f6f8] rounded mb-1">
                  <span className="text-xs font-bold text-[#263238]">
                    Highlight Scroll Position
                  </span>
                  <button
                    className={`px-3 py-1 rounded text-[10px] font-bold border-0 cursor-pointer ${localSettings.ghostHighlight ? "bg-green-600 text-white" : "bg-gray-400 text-white"}`}
                    onClick={() =>
                      handleUpdateLocalSetting(
                        "ghostHighlight",
                        !localSettings.ghostHighlight,
                      )
                    }
                  >
                    {localSettings.ghostHighlight ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="text-[11px] font-bold text-red-600 border-b border-red-100 mb-2 mt-3 pb-1.5 uppercase tracking-wide">
                  DANGER ZONE
                </div>
                <button
                  className="w-full text-left border-0 rounded bg-blue-50 text-blue-700 text-xs font-bold p-2 cursor-pointer hover:bg-blue-100 mb-2"
                  onClick={async () => {
                    setShowTopSettings(false);
                    try {
                      toast("Migration started. Please wait...");
                      const response = await fetch(
                        "/api/admin/migrate-images",
                        { method: "POST" },
                      );
                      const data = await response.json();
                      if (data.success) {
                        toast(`Migrated ${data.count} images successfully!`);

                        if (data.brokenImages && data.brokenImages.length > 0) {
                          const message =
                            `Found ${data.brokenImages.length} broken images. Please check these rows:\n\n` +
                            data.brokenImages
                              .map(
                                (b: any) =>
                                  `[${b.page}] -> Row ID [${b.rowId}] -> Column [${b.column}]`,
                              )
                              .join("\n");

                          setTimeout(() => {
                            setConfirmationModal({
                              isOpen: true,
                              title: "Missing Files Detected",
                              message: message,
                              confirmLabel: "Understood",
                              onConfirm: () => {
                                if (data.count > 0) window.location.reload();
                              },
                            });
                          }, 500);
                        } else if (data.count > 0) {
                          setTimeout(() => window.location.reload(), 2000);
                        }
                      } else {
                        toast("Migration failed");
                      }
                    } catch (err) {
                      console.error(err);
                      toast("Migration failed");
                    }
                  }}
                >
                  🚀 Migrate All Images
                </button>
                <button
                  className="w-full text-left border-0 rounded bg-red-50 text-red-700 text-xs font-bold p-2 cursor-pointer hover:bg-red-100 mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    setClearDBModal({
                      isOpen: true,
                      step: 1,
                      yesLeft: Math.random() > 0.5,
                    });
                  }}
                >
                  🗑️ Clear DB (Zero State)
                </button>
              </div>
            )}
            <input
              type="file"
              accept=".json,.zip"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImportData}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center bg-white border border-[#d8d8d8] rounded-md p-2 min-h-[44px]">
        {state.pages.length === 0 ? (
          <span className="text-xs text-[#90a4ae] font-bold">
            No pages yet. Click Add Page to create one.
          </span>
        ) : (
          state.pages.map((page) => (
            <button
              key={page}
              className={`border border-[#cfd8dc] rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${page === state.activePage ? "bg-[#2b579a] text-white border-[#2b579a]" : "bg-[#eceff1] text-[#37474f] hover:bg-gray-200"}`}
              onClick={() => {
                setState((prev) => ({ ...prev, activePage: page }));
                toast(`Active page: ${page}`);
              }}
            >
              {page}
            </button>
          ))
        )}
      </div>

      {activeConfig.copyBoxConfig && activeConfig.showCopyBoxes !== false && (
        <GlobalCombinationCopyBoxes
          settings={activeConfig.copyBoxConfig}
          box1Value={box1Value}
          box2Value={box2Value}
        />
      )}

      <div className="bg-white border border-[#d8d8d8] rounded-md p-2 flex flex-col md:flex-row gap-2">
        {(activeConfig.searchBarOrder || ["primary", "secondary"]).map(
          (type) => {
            if (type === "primary") {
              return (
                <div key="primary" className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 flex items-center gap-1 border-2 border-[#217346] rounded px-1 min-w-0 bg-white">
                    <div className="flex flex-wrap gap-1 max-w-[60%] overflow-hidden">
                      {primarySearchTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 bg-green-100 text-[#217346] text-[11px] font-bold px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemovePrimaryTag(idx)}
                            className="hover:text-red-500 transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative flex-1 min-w-[100px]">
                      <Input
                        ref={primaryInputRef}
                        key={`prim-${isAnyModalOpen}`}
                        onBeforeInput={(e: any) => {
                          if (
                            e.nativeEvent &&
                            e.nativeEvent.inputType &&
                            e.nativeEvent.inputType.startsWith("history")
                          )
                            e.preventDefault();
                        }}
                        className="border-0 focus:ring-0 text-sm w-full pr-14 h-8 min-w-0 overflow-x-auto whitespace-nowrap"
                        value={primarySearchInput}
                        readOnly={isAnyModalOpen}
                        onChange={(e) => {
                          setPrimarySearchInput(e.target.value);
                          if (
                            e.target.value &&
                            activeConfig.independentSearchBars === false
                          )
                            setSecondarySearchInput("");
                        }}
                        onFocus={() => {
                          setActiveSearchView("primary");
                        }}
                        onKeyDown={handlePrimKeyDown}
                      />
                      {!primarySearchInput && primarySearchTags.length === 0 && (
                        <div 
                          className="absolute inset-y-0 left-1 right-12 flex items-center overflow-x-auto whitespace-nowrap text-gray-400 text-sm cursor-text select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                          onClick={() => primaryInputRef.current?.focus()}
                        >
                          🔍 Search Data {state.activePage ? <>For "<strong>{state.activePage}</strong>"</> : ""}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleAddPrimaryTag}
                      className="p-1 text-[#217346] hover:bg-green-100 rounded transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div
                    className="flex items-center gap-1.5 relative"
                    ref={primHistRef}
                  >
                    <button
                      title="Undo (Ctrl+Z)"
                      onClick={handlePrimUndo}
                      disabled={primHist.pointer === 0}
                      className="p-1.5 text-[#217346] hover:bg-green-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Undo2 size={18} />
                    </button>
                    <button
                      title="Redo (Ctrl+Y)"
                      onClick={handlePrimRedo}
                      disabled={
                        primHist.pointer === primHist.entries.length - 1
                      }
                      className="p-1.5 text-[#217346] hover:bg-green-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Redo2 size={18} />
                    </button>
                    <div className="relative">
                      <button
                        title="Search History"
                        onClick={() => setShowPrimHist(!showPrimHist)}
                        className="p-1.5 text-[#217346] hover:bg-green-100 rounded transition-colors border-0 bg-transparent cursor-pointer"
                      >
                        <History size={18} />
                      </button>
                      {showPrimHist && (
                        <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-gray-200 shadow-2xl rounded-lg z-50 py-1.5 max-h-[300px] overflow-y-auto">
                          <div className="px-3 py-1.5 border-b border-gray-100 text-[13px] font-bold text-gray-400 uppercase tracking-wider">
                            Search History (Max {maxSearchHistory})
                          </div>
                          {primHist.entries
                            .map((entry, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setPrimHist((prev) => {
                                    isPrimUndoRef.current = true;
                                    setPrimarySearchInput(entry.value);
                                    return { ...prev, pointer: idx };
                                  });
                                  setShowPrimHist(false);
                                }}
                                className={`px-3 py-2 text-[12px] cursor-pointer flex justify-between items-center transition-all ${idx === primHist.pointer ? "bg-[#e8f0fe] font-bold text-[#217346] border-l-[3px] border-[#217346]" : "text-gray-700 hover:bg-gray-50"}`}
                              >
                                <span className="truncate max-w-[140px]">
                                  {entry.value || (
                                    <span className="italic text-gray-400">
                                      Empty State
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] opacity-70 shrink-0 font-medium ml-2">
                                  {formatHistDate(entry.timestamp)}
                                </span>
                              </div>
                            ))
                            .reverse()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else if (
              type === "secondary" &&
              activeConfig.secondarySearchPage
            ) {
              return (
                <div key="secondary" className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 flex items-center gap-1 border-2 border-[#2b579a] rounded px-1 min-w-0 bg-white">
                    <div className="flex flex-wrap gap-1 max-w-[60%] overflow-hidden">
                      {secondarySearchTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 bg-blue-100 text-[#2b579a] text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveSecondaryTag(idx)}
                            className="hover:text-red-500 transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative flex-1 min-w-[100px]">
                      <Input
                        ref={secondaryInputRef}
                        key={`sec-${isAnyModalOpen}`}
                        onBeforeInput={(e: any) => {
                          if (
                            e.nativeEvent &&
                            e.nativeEvent.inputType &&
                            e.nativeEvent.inputType.startsWith("history")
                          )
                            e.preventDefault();
                        }}
                        className="border-0 focus:ring-0 text-sm w-full pr-14 h-8 min-w-0 overflow-x-auto whitespace-nowrap"
                        value={secondarySearchInput}
                        readOnly={isAnyModalOpen}
                        onChange={(e) => {
                          setSecondarySearchInput(e.target.value);
                          if (
                            e.target.value &&
                            activeConfig.independentSearchBars === false
                          )
                            setPrimarySearchInput("");
                        }}
                        onFocus={() => {
                          setActiveSearchView("secondary");
                        }}
                        onKeyDown={handleSecKeyDown}
                      />
                      {!secondarySearchInput && secondarySearchTags.length === 0 && (
                        <div 
                          className="absolute inset-y-0 left-1 right-12 flex items-center overflow-x-auto whitespace-nowrap text-gray-400 text-sm cursor-text select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                          onClick={() => secondaryInputRef.current?.focus()}
                        >
                          🔍 Search Data For "<strong>{activeConfig.secondarySearchPage}</strong>" (Secondary Search)
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleAddSecondaryTag}
                      className="p-1 text-[#2b579a] hover:bg-blue-100 rounded transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div
                    className="flex items-center gap-1.5 relative"
                    ref={secHistRef}
                  >
                    <button
                      title="Undo (Ctrl+Z)"
                      onClick={handleSecUndo}
                      disabled={secHist.pointer === 0}
                      className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Undo2 size={18} />
                    </button>
                    <button
                      title="Redo (Ctrl+Y)"
                      onClick={handleSecRedo}
                      disabled={secHist.pointer === secHist.entries.length - 1}
                      className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <Redo2 size={18} />
                    </button>
                    <div className="relative">
                      <button
                        title="Search History"
                        onClick={() => setShowSecHist(!showSecHist)}
                        className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded transition-colors border-0 bg-transparent cursor-pointer"
                      >
                        <History size={18} />
                      </button>
                      {showSecHist && (
                        <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-gray-200 shadow-2xl rounded-lg z-50 py-1.5 max-h-[300px] overflow-y-auto">
                          <div className="px-3 py-1.5 border-b border-gray-100 text-[13px] font-bold text-gray-400 uppercase tracking-wider">
                            Search History (Max {maxSearchHistory})
                          </div>
                          {secHist.entries
                            .map((entry, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setSecHist((prev) => {
                                    isSecUndoRef.current = true;
                                    setSecondarySearchInput(entry.value);
                                    return { ...prev, pointer: idx };
                                  });
                                  setShowSecHist(false);
                                }}
                                className={`px-3 py-2 text-[12px] cursor-pointer flex justify-between items-center transition-all ${idx === secHist.pointer ? "bg-[#e8f0fe] font-bold text-[#2b579a] border-l-[3px] border-[#2b579a]" : "text-gray-700 hover:bg-gray-50"}`}
                              >
                                <span className="truncate max-w-[140px]">
                                  {entry.value || (
                                    <span className="italic text-gray-400">
                                      Empty State
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] opacity-70 shrink-0 font-medium ml-2">
                                  {formatHistDate(entry.timestamp)}
                                </span>
                              </div>
                            ))
                            .reverse()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          },
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden border border-gray-400 rounded-md bg-white flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-[#2b579a] text-base font-bold text-center p-5 flex-col">
            <RefreshCw className="animate-spin mb-2" size={32} />
            Loading Page Data...
          </div>
        ) : !state.activePage ? (
          <div className="flex-1 flex items-center justify-center text-[#90a4ae] text-base font-bold text-center p-5 flex-col">
            Blank Workspace Area
            <br />
            <span className="text-xs font-semibold text-[#b0bec5]">
              (search bar intentionally kept as requested)
            </span>
          </div>
        ) : (
          tableContent
        )}
      </div>

      <CreatePageModal
        isOpen={modals.createPage}
        onClose={closeAllModals}
        onCreate={handleCreatePage}
        existingPages={state.pages}
      />

      <BulkApplySourceModal
        isOpen={modals.bulkApplySource}
        onClose={closeAllModals}
        rows={state.pageRows[bulkApplyContext?.pageName || state.activePage] || []}
        columns={state.pageConfigs[bulkApplyContext?.pageName || state.activePage]?.columns || []}
        context={bulkApplyContext}
        onConfirm={handleConfirmBulkApply}
        decodeHtmlEntities={decodeHtmlEntities}
        parseMultiSource={parseMultiSource}
        getImageUrl={getImageUrl}
      />

      <AddRowModal
        isOpen={modals.addRow}
        onClose={closeAllModals}
        onApplySourceToAll={handleApplySourceToAll}
        onBack={
          returnToImagePreview
            ? () => {
                closeAllModals();
                toggleModal("imagePreview", true);
              }
            : returnToSettings
              ? () => {
                  closeAllModals();
                  toggleModal("activePageSettings", true);
                }
              : undefined
        }
        backText={
          returnToImagePreview
            ? "Back to Image Preview"
            : "Back to Active Page Settings"
        }
        onSave={(rows) =>
          handleSaveRows(
            rows,
            previewContext?.pageName || editingPageName || undefined,
          )
        }
        onDelete={(id) => {
          handleDeleteRow(
            id,
            previewContext?.pageName || editingPageName || undefined,
          );
          closeAllModals();
        }}
        columns={
          previewContext
            ? state.pageConfigs[previewContext.pageName].columns
            : editingPageName
              ? state.pageConfigs[editingPageName].columns
              : activeConfig.columns
        }
        editingRow={
          editingRowId
            ? (
                state.pageRows[
                  previewContext?.pageName ||
                    editingPageName ||
                    state.activePage
                ] || []
              ).find((r) => r.id === editingRowId) || null
            : null
        }
        editingRowIndex={
          editingRowId
            ? (
                state.pageRows[
                  previewContext?.pageName ||
                    editingPageName ||
                    state.activePage
                ] || []
              ).findIndex((r) => r.id === editingRowId)
            : -1
        }
        activePage={
          previewContext?.pageName || editingPageName || state.activePage
        }
        allRows={state.pageRows[previewContext?.pageName || editingPageName || state.activePage] || []}
        onToggleMagicPasteColumn={handleToggleMagicPasteColumn}
        setConfirmationModal={setConfirmationModal}
        getImageUrl={getImageUrl}
      />

      <ActivePageSettingsModal
        isOpen={modals.activePageSettings}
        onClose={closeAllModals}
        activePage={state.activePage}
        pageConfig={state.activePage ? activeConfig : null}
        pageRows={state.pageRows}
        pageConfigs={state.pageConfigs}
        onSave={handleSaveActivePageSettings}
        onDeleteColumn={handleDeleteColumnOptions}
        onSyncTracker={handleSyncTracker}
        onRenamePage={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("renamePage", true);
        }}
        onCreateColumn={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("createColumn", true);
        }}
        onAddRow={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("addRow", true);
        }}
        onEditColumn={handleEditColumnClick}
        onDeletePage={handleDeletePage}
        onReorderSearchBars={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("reorderSearchBars", true);
        }}
        onImportExcel={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("excelImport", true);
        }}
        onExportExcel={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("excelExport", true);
        }}
        onImportPageJson={(file) => {
          handleImportPageData(file);
        }}
        onFindDuplicates={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          setIsDupModalOpen(true);
        }}
        onClearPageData={() => handleClearPageData(state.activePage)}
        existingPages={state.pages}
        setConfirmationModal={setConfirmationModal}
        onCreateTracker={(sourcePage) => {
          setTrackerSelectionModalSource(sourcePage);
          closeAllModals();
        }}
        onConfigureCopyBoxes={() => {
          setReturnToSettings(true);
          toggleModal("activePageSettings", false);
          toggleModal("globalCopyBoxesSettings", true);
        }}
      />

      <CreateTrackerSelectionModal
        isOpen={!!trackerSelectionModalSource}
        onClose={() => setTrackerSelectionModalSource(null)}
        sourcePage={trackerSelectionModalSource || ""}
        sourceColumns={
          trackerSelectionModalSource
            ? state.pageConfigs[trackerSelectionModalSource]?.columns || []
            : []
        }
        sourceRows={
          trackerSelectionModalSource
            ? state.pageRows[trackerSelectionModalSource] || []
            : []
        }
        onConfirm={(selectedColKeys) => {
          if (trackerSelectionModalSource) {
            handleCreateTracker(trackerSelectionModalSource, selectedColKeys);
          }
          setTrackerSelectionModalSource(null);
        }}
      />

      <RenamePageModal
        isOpen={modals.renamePage}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
        }}
        activePage={state.activePage}
        onRename={handleRenamePage}
        existingPages={state.pages}
      />

      <CreateColumnModal
        isOpen={modals.createColumn}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
        }}
        onSave={handleCreateColumns}
        existingColumns={activeConfig.columns}
      />

      <EditColumnModal
        isOpen={modals.editColumn}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
        }}
        onSave={handleSaveEditedColumn}
        onUpdate={handleUpdateColumnPreview}
        column={editingColumn}
        existingColumns={activeConfig.columns}
      />

      {/* ConfirmationModal is now global */}

      <ConfirmationModal
        isOpen={!!confirmationModal?.isOpen}
        onClose={() => setConfirmationModal(null)}
        onConfirm={() => {
          if (confirmationModal?.onConfirm) {
            confirmationModal.onConfirm();
          }
          setConfirmationModal(null);
        }}
        title={confirmationModal?.title}
        message={confirmationModal?.message}
        confirmLabel={confirmationModal?.confirmLabel}
      />

      <ImagePreviewModal
        isOpen={modals.imagePreview}
        onClose={closeAllModals}
        row={
          previewContext
            ? (state.pageRows[previewContext.pageName] || []).find(
                (r) => r.id === previewContext.rowId,
              ) || null
            : null
        }
        imageColKey={previewContext?.imageKey || ""}
        columns={
          previewContext
            ? state.pageConfigs[previewContext.pageName].columns
            : activeConfig.columns
        }
        rowIndex={
          previewContext
            ? (state.pageRows[previewContext.pageName] || []).findIndex(
                (r) => r.id === previewContext.rowId,
              )
            : -1
        }
        onEditRow={() => {
          setReturnToImagePreview(true);
          toggleModal("imagePreview", false);
          setEditingRowId(previewContext?.rowId || null);
          setEditingPageName(previewContext?.pageName || null);
          toggleModal("addRow", true);
        }}
        onReplaceImage={(newImage) =>
          handleReplaceImage(newImage, previewContext?.pageName)
        }
        onDeleteImage={(rowId, imageKey) =>
          handleDeleteImage(rowId, imageKey, previewContext?.pageName)
        }
        activePopupId={activePopupId}
        setActivePopupId={setActivePopupId}
        activeAnchor={activeAnchor}
        setActiveAnchor={setActiveAnchor}
        pageName={previewContext?.pageName || state.activePage}
        onCopy={(item, colKey, pageName) => {
          const activeCopyCfg =
            state.pageConfigs[state.activePage]?.copyBoxConfig;
          if (activeCopyCfg) {
            if (
              activeCopyCfg.box1.sourcePage === pageName &&
              activeCopyCfg.box1.sourceColumn === colKey
            ) {
              setBox1Value(item);
            }
            if (
              activeCopyCfg.box2.sourcePage === pageName &&
              activeCopyCfg.box2.sourceColumn === colKey
            ) {
              setBox2Value(item);
            }
          }
        }}
        getImageUrl={getImageUrl}
      />

      <ReorderPagesModal
        isOpen={modals.reorderPages}
        onClose={closeAllModals}
        pages={state.pages}
        onReorder={async (newPages) => {
          setState((prev) => ({ ...prev, pages: newPages }));
          try {
            await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                globalCopyBoxes: state.globalCopyBoxes,
                globalRowNoWidth: state.globalRowNoWidth,
                maxSearchHistory,
                pageOrder: newPages,
              }),
            });
          } catch (err) {
            console.error("Failed to save page order:", err);
            toast("Failed to save page order to database");
          }
        }}
      />

      <ReorderSearchBarsModal
        isOpen={modals.reorderSearchBars}
        onClose={() => {
          closeAllModals();
          setReturnToSettings(false);
        }}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
          setReturnToSettings(false);
        }}
        order={activeConfig.searchBarOrder || ["primary", "secondary"]}
        activePageName={state.activePage}
        secondaryPageName={activeConfig.secondarySearchPage || ""}
        onReorder={(newOrder) => {
          setState((prev) => ({
            ...prev,
            pageConfigs: {
              ...prev.pageConfigs,
              [state.activePage]: {
                ...prev.pageConfigs[state.activePage],
                searchBarOrder: newOrder,
              },
            },
          }));
        }}
      />

      <ExcelImportModal
        isOpen={modals.excelImport}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
        }}
        existingColumns={activeConfig.columns}
        existingRows={activeRows}
        importRows={excelImportData.rows}
        setImportRows={(rows) =>
          setExcelImportData((prev) => ({ ...prev, rows }))
        }
        headers={excelImportData.headers}
        setHeaders={(headers) =>
          setExcelImportData((prev) => ({ ...prev, headers }))
        }
        onImport={async (newRows, newColumns) => {
          const currentCols = state.pageConfigs[state.activePage].columns;
          const updatedCols = [...currentCols, ...newColumns];
          const updatedConfig = {
            ...state.pageConfigs[state.activePage],
            columns: updatedCols,
          };
          const updatedRows = [
            ...(state.pageRows[state.activePage] || []),
            ...newRows,
          ];

          try {
            await Promise.all([
              fetch(
                `/api/pageConfigs/${encodeURIComponent(state.activePage)}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ config: updatedConfig }),
                },
              ),
              fetch(
                `/api/pageRows/${encodeURIComponent(state.activePage)}/append`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rows: newRows }),
                },
              ),
            ]);

            setState((prev) => ({
              ...prev,
              pageConfigs: {
                ...prev.pageConfigs,
                [state.activePage]: updatedConfig,
              },
              pageRows: {
                ...prev.pageRows,
                [state.activePage]: updatedRows,
              },
            }));
            toast("Excel data imported successfully");
          } catch (err) {
            console.error(err);
            toast("Failed to import Excel data to database");
          }
        }}
        getImageUrl={getImageUrl}
      />

      {/* --- CUSTOM SUM MODAL --- */}
      {isSumModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[600px] max-w-[95vw] shadow-2xl">
            <h3 className="text-lg font-bold mb-1 text-purple-800">
              📊 Calculate Range Sum
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Search and select the range. The total will appear next to
              Remaining Qty.
            </p>

            <div className="flex flex-row gap-4 mb-6">
              {/* Start Column Group */}
              <div className="flex-1 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                <label className="text-xs font-bold text-purple-700 block mb-2 uppercase tracking-wider">
                  Step 1: Start Column
                </label>
                <input
                  type="text"
                  placeholder="🔍 Search start date..."
                  className="w-full border border-gray-300 p-2 rounded text-sm mb-2 outline-none focus:border-purple-500 bg-white"
                  value={sumStartSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSumStartSearchQuery(val);
                    if (val.trim() !== "") {
                      const matched = activeConfig.columns.find(
                        (c) =>
                          c.type === "sale_tracker" &&
                          val
                            .toLowerCase()
                            .split(" ")
                            .filter(Boolean)
                            .every((term) =>
                              c.name.toLowerCase().includes(term),
                            ),
                      );
                      if (matched) setSumStartCol(matched.key);
                    }
                  }}
                />
                <div className="w-full border border-gray-300 rounded overflow-y-auto bg-white max-h-[130px] shadow-inner">
                  {activeConfig.columns
                    .filter(
                      (c) =>
                        c.type === "sale_tracker" &&
                        (sumStartSearchQuery
                          .toLowerCase()
                          .split(" ")
                          .filter(Boolean)
                          .every((term) =>
                            c.name.toLowerCase().includes(term),
                          ) ||
                          c.key === sumStartCol),
                    )
                    .map((c) => (
                      <div
                        key={c.key}
                        onClick={() => setSumStartCol(c.key)}
                        className={`p-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors flex items-center ${sumStartCol === c.key ? "bg-purple-100 text-purple-900 font-bold border-l-4 border-purple-600" : "hover:bg-purple-50 text-gray-700 border-l-4 border-transparent"}`}
                      >
                        {renderHighlightedText(c.name, sumStartSearchQuery)}
                      </div>
                    ))}
                  {activeConfig.columns.filter(
                    (c) =>
                      c.type === "sale_tracker" &&
                      (sumStartSearchQuery
                        .toLowerCase()
                        .split(" ")
                        .filter(Boolean)
                        .every((term) => c.name.toLowerCase().includes(term)) ||
                        c.key === sumStartCol),
                  ).length === 0 && (
                    <div className="p-3 text-sm text-gray-400 text-center italic font-semibold">
                      No dates found
                    </div>
                  )}
                </div>
              </div>

              {/* End Column Group */}
              <div className="flex-1 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                <label className="text-xs font-bold text-purple-700 block mb-2 uppercase tracking-wider">
                  Step 2: End Column
                </label>
                <input
                  type="text"
                  placeholder="🔍 Search end date..."
                  className="w-full border border-gray-300 p-2 rounded text-sm mb-2 outline-none focus:border-purple-500 bg-white"
                  value={sumEndSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSumEndSearchQuery(val);
                    if (val.trim() !== "") {
                      const matched = [...activeConfig.columns].reverse().find(
                        (c) =>
                          c.type === "sale_tracker" &&
                          val
                            .toLowerCase()
                            .split(" ")
                            .filter(Boolean)
                            .every((term) =>
                              c.name.toLowerCase().includes(term),
                            ),
                      );
                      if (matched) setSumEndCol(matched.key);
                    }
                  }}
                />
                <div className="w-full border border-gray-300 rounded overflow-y-auto bg-white max-h-[130px] shadow-inner">
                  {activeConfig.columns
                    .filter(
                      (c) =>
                        c.type === "sale_tracker" &&
                        (sumEndSearchQuery
                          .toLowerCase()
                          .split(" ")
                          .filter(Boolean)
                          .every((term) =>
                            c.name.toLowerCase().includes(term),
                          ) ||
                          c.key === sumEndCol),
                    )
                    .map((c) => (
                      <div
                        key={c.key}
                        onClick={() => setSumEndCol(c.key)}
                        className={`p-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors flex items-center ${sumEndCol === c.key ? "bg-purple-100 text-purple-900 font-bold border-l-4 border-purple-600" : "hover:bg-purple-50 text-gray-700 border-l-4 border-transparent"}`}
                      >
                        {renderHighlightedText(c.name, sumEndSearchQuery)}
                      </div>
                    ))}
                  {activeConfig.columns.filter(
                    (c) =>
                      c.type === "sale_tracker" &&
                      (sumEndSearchQuery
                        .toLowerCase()
                        .split(" ")
                        .filter(Boolean)
                        .every((term) => c.name.toLowerCase().includes(term)) ||
                        c.key === sumEndCol),
                  ).length === 0 && (
                    <div className="p-3 text-sm text-gray-400 text-center italic font-semibold">
                      No dates found
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Filter by Source */}
            <div className="mb-6 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                  Step 3: Filter by Source (Optional)
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSumSelectedSources(uniqueSourcesInRange)}
                    className="text-[10px] font-extrabold text-purple-600 hover:text-purple-800 uppercase tracking-tight"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSumSelectedSources([])}
                    className="text-[10px] font-extrabold text-red-600 hover:text-red-800 uppercase tracking-tight"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-white rounded-md border border-purple-100 min-h-[50px]">
                {uniqueSourcesInRange.length > 0 ? (
                  uniqueSourcesInRange.map((source) => {
                    const isSelected = sumSelectedSources.includes(source);
                    return (
                      <button
                        key={source}
                        onClick={() => {
                          setSumSelectedSources((prev) =>
                            prev.includes(source)
                              ? prev.filter((s) => s !== source)
                              : [...prev, source],
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-purple-600 text-white border-purple-700 shadow-md transform scale-105"
                            : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-white" : "bg-purple-300"}`} />
                        {source}
                      </button>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400 italic font-medium">
                    Select a range above to populate source filters
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 italic">
                * If no sources are selected, the entire range total will be calculated.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsSumModalOpen(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const saleCols = activeConfig.columns.filter(
                    (c) => c.type === "sale_tracker",
                  );
                  const idx1 = saleCols.findIndex((c) => c.key === sumStartCol);
                  const idx2 = saleCols.findIndex((c) => c.key === sumEndCol);

                  if (idx1 === -1 || idx2 === -1) {
                    toast("Invalid columns selected");
                    return;
                  }

                  const startIdx = Math.min(idx1, idx2);
                  const endIdx = Math.max(idx1, idx2);

                  const keysToSum = saleCols
                    .slice(startIdx, endIdx + 1)
                    .map((c) => c.key);

                  setActiveCustomSum({
                    startName: saleCols[startIdx].name,
                    endName: saleCols[endIdx].name,
                    keys: keysToSum,
                    selectedSources: sumSelectedSources,
                  });

                  setIsSumModalOpen(false);
                  toast(
                    `Calculated sum for ${keysToSum.length} columns.`,
                  );
                }}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-sm shadow-md transition-colors"
              >
                Calculate Sum
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportChoiceModal
        isOpen={modals.exportChoice}
        onClose={closeAllModals}
        onVerifiedExport={handleVerifiedExport}
        onUnverifiedExport={handleExportData}
      />

      <ExcelExportModal
        isOpen={modals.excelExport}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal("activePageSettings", true);
        }}
        pageName={state.activePage}
        columns={activeCustomSum ? activeColumnsWithSum : activeConfig.columns}
        rows={activeCustomSum ? activeRowsWithSum : activeRows}
        lowStockIds={currentLowStockIds}
      />

      <GlobalCopyBoxesSettingsModal
        isOpen={modals.globalCopyBoxesSettings}
        onClose={closeAllModals}
        state={state}
        onSave={async (settings) => {
          try {
            const updatedConfig = {
              ...state.pageConfigs[state.activePage],
              copyBoxConfig: settings,
            };
            await fetch(
              `/api/pageConfigs/${encodeURIComponent(state.activePage)}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: updatedConfig }),
              },
            );
            setState((prev) => ({
              ...prev,
              pageConfigs: {
                ...prev.pageConfigs,
                [state.activePage]: updatedConfig,
              },
            }));
            toast("Page Copy Boxes Settings saved");
          } catch (err) {
            console.error(err);
            toast("Failed to save settings to database");
          }
        }}
      />

      <DuplicateFinderModal
        isOpen={isDupModalOpen}
        onClose={() => {
          setIsDupModalOpen(false);
          setReturnToSettings(false);
        }}
        onBack={() => {
          setIsDupModalOpen(false);
          toggleModal("activePageSettings", true);
        }}
        rows={activeRows}
        columns={activeConfig.columns}
        onDeleteRow={(rowId) => {
          setConfirmationModal({
            isOpen: true,
            title: "Confirm Row Deletion",
            message:
              "Are you sure you want to delete this row? This action cannot be undone.",
            onConfirm: () => {
              handleDeleteRow(rowId);
            },
          });
        }}
      />

      {hoveredImage &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none bg-white p-1 rounded-lg shadow-2xl border border-gray-200"
            style={{
              left: hoveredImage.x + 20,
              top: Math.min(hoveredImage.y - 100, window.innerHeight - 320),
              width: "350px",
              height: "350px",
            }}
          >
            <img
              src={getImageUrl(hoveredImage.url)}
              alt="Hover Preview"
              className="w-full h-full object-contain"
            />
          </div>,
          document.body,
        )}

      {isExporting && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Processing...{" "}
              {exportProgress.percent !== null && `${exportProgress.percent}%`}
            </h2>
            <p className="text-gray-500 text-center mb-4">
              {exportProgress.message}
            </p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              {exportProgress.percent !== null ? (
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${exportProgress.percent}%` }}
                ></div>
              ) : (
                <div className="bg-blue-500 h-full animate-[shimmer_2s_infinite]"></div>
              )}
            </div>
          </div>
        </div>
      )}

      {isImporting && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Processing...{" "}
              {importProgress.percent !== null && `${importProgress.percent}%`}
            </h2>
            <p className="text-gray-500 text-center mb-4">
              {importProgress.message}
            </p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              {importProgress.percent !== null ? (
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${importProgress.percent}%` }}
                ></div>
              ) : (
                <div className="bg-blue-500 h-full animate-[shimmer_2s_infinite]"></div>
              )}
            </div>
            <p className="mt-4 text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">
              Please do not close this window
            </p>
          </div>
        </div>
      )}

      {showHistoryLimitModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-5 rounded-lg shadow-2xl max-w-sm w-full m-4">
            <h3 className="text-base font-bold text-[#2b579a] mb-2">
              🕒 Search History Limit
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Set maximum undo/redo states to keep in memory.
            </p>
            <input
              type="number"
              min="1"
              max="500"
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full border border-gray-300 rounded p-2 text-sm mb-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={tempHistoryLimit}
              onChange={(e) => setTempHistoryLimit(Number(e.target.value))}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowHistoryLimitModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="green"
                onClick={async () => {
                  try {
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        globalRowNoWidth: state.globalRowNoWidth,
                        maxSearchHistory: tempHistoryLimit,
                      }),
                    });
                    setMaxSearchHistory(tempHistoryLimit);
                    setShowHistoryLimitModal(false);
                    toast("Limit updated to " + tempHistoryLimit);
                  } catch (err) {
                    toast("Failed to save settings");
                  }
                }}
              >
                Save Limit
              </Button>
            </div>
          </div>
        </div>
      )}

      {clearDBModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full border border-red-200 m-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">
              ⚠️ Danger: Clear Database
            </h3>
            <p className="text-sm text-gray-700 mb-5 font-medium min-h-[60px]">
              {clearDBModal.step === 1 &&
                "Step 1/3: Are you sure you want to completely wipe all pages, columns, and data? This cannot be undone."}
              {clearDBModal.step === 2 &&
                "Step 2/3: Are you ABSOLUTELY sure? All your uploaded images and rows will be permanently deleted from the server."}
              {clearDBModal.step === 3 &&
                "Final Step 3/3: This is your last warning. Click Yes to factory reset the entire software."}
            </p>
            <div className="flex gap-3">
              {clearDBModal.yesLeft ? (
                <>
                  <button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => {
                      if (clearDBModal.step < 3) {
                        setClearDBModal({
                          isOpen: true,
                          step: clearDBModal.step + 1,
                          yesLeft: Math.random() > 0.5,
                        });
                      } else {
                        setClearDBModal({ ...clearDBModal, isOpen: false });
                        handleClearEntireDB();
                      }
                    }}
                  >
                    Yes, Clear It
                  </button>
                  <button
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() =>
                      setClearDBModal({ isOpen: false, step: 1, yesLeft: true })
                    }
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() =>
                      setClearDBModal({ isOpen: false, step: 1, yesLeft: true })
                    }
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => {
                      if (clearDBModal.step < 3) {
                        setClearDBModal({
                          isOpen: true,
                          step: clearDBModal.step + 1,
                          yesLeft: Math.random() > 0.5,
                        });
                      } else {
                        setClearDBModal({ ...clearDBModal, isOpen: false });
                        handleClearEntireDB();
                      }
                    }}
                  >
                    Yes, Clear It
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {isSalePromptOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[350px] shadow-2xl">
            <h3 className="text-lg font-bold mb-1 text-[#2b579a]">
              Enter Sale Date
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Enter custom duration (e.g., "24-25 April")
            </p>
            <input
              autoFocus
              className="w-full border-2 border-[#d7dde1] p-2.5 rounded-md mb-5 outline-none focus:border-[#2b579a] text-sm font-semibold"
              placeholder="e.g. 24-25 April"
              value={customSaleName}
              onChange={(e) => setCustomSaleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSaleColumn()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsSalePromptOpen(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSaleColumn}
                className="px-4 py-1.5 bg-[#2b579a] hover:bg-[#1a3c6d] text-white rounded font-bold text-sm"
              >
                Create Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ARCHIVE COLUMNS MODAL --- */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[500px] shadow-2xl min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-bold text-[#2b579a]">
                Archive Columns
              </h3>
              <button
                onClick={() => {
                  setIsArchiveModalOpen(false);
                  setIsArchiveDeleteModalOpen(true);
                  setSelectedArchiveCols(new Set());
                }}
                className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded shadow-sm text-xs font-bold flex items-center gap-1 transition-colors"
              >
                🗑️ Delete Columns
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Manually hide or show your custom sale date columns.
            </p>

            <div className="mb-3 flex flex-col gap-2">
              <input
                type="text"
                autoFocus
                placeholder="🔍 Search dates or columns..."
                className="w-full border-2 border-[#d7dde1] p-2 rounded-md outline-none focus:border-[#2b579a] text-sm font-semibold transition-colors"
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleBulkArchiveToggle(false)}
                  className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-bold transition-colors border border-green-200 shadow-sm"
                >
                  👁️ Show All
                </button>
                <button
                  onClick={() => handleBulkArchiveToggle(true)}
                  className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-bold transition-colors border border-red-200 shadow-sm"
                >
                  🙈 Hide All
                </button>
              </div>
            </div>

            {/* Columns List */}
            <div className="max-h-[300px] overflow-y-auto border-2 border-gray-100 rounded-md p-2 mb-4 bg-gray-50 flex-1">
              {archiveSearchQuery === "" &&
                (() => {
                  const saleCols =
                    activeConfig?.columns.filter(
                      (c) => c.type === "sale_tracker",
                    ) || [];
                  const latestColName =
                    saleCols.length > 0 ? saleCols[0].name : "";
                  return (
                    <div
                      className={`flex justify-between items-center p-2.5 border-b border-gray-200 bg-white mb-1 rounded shadow-sm transition-colors ${activeFilterSaleCol === null ? "bg-blue-50 border border-blue-300" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700">
                          Latest Sale (Default){" "}
                          {latestColName && (
                            <span className="text-sm font-semibold text-[#FFA500] ml-1">
                              ({latestColName})
                            </span>
                          )}
                        </span>
                        {activeFilterSaleCol === null && (
                          <span className="text-[10px] font-bold text-blue-600 mt-0.5">
                            Current Target
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveFilterSaleCol(null)}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeFilterSaleCol === null ? "bg-[#2b579a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"}`}
                      >
                        {activeFilterSaleCol === null
                          ? "🎯 Target"
                          : "Set Target"}
                      </button>
                    </div>
                  );
                })()}
              {activeConfig?.columns
                .filter(
                  (c) =>
                    c.type === "sale_tracker" &&
                    c.name
                      .toLowerCase()
                      .includes(archiveSearchQuery.toLowerCase()),
                )
                .map((col) => (
                  <div
                    key={col.key}
                    className={`flex justify-between items-center p-2.5 border-b border-gray-200 last:border-b-0 mb-1 rounded shadow-sm transition-colors ${activeFilterSaleCol === col.key ? "bg-blue-50 border border-blue-300" : "bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700">
                          {renderHighlightedText(col.name, archiveSearchQuery)}
                        </span>
                        {activeFilterSaleCol === col.key && (
                          <span className="text-[10px] font-bold text-blue-600 mt-0.5">
                            Current Target
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => {
                          setActiveFilterSaleCol(col.key);
                          if (col.archived)
                            handleToggleColumnArchive(col.key, true);
                        }}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeFilterSaleCol === col.key ? "bg-[#2b579a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"}`}
                      >
                        {activeFilterSaleCol === col.key
                          ? "🎯 Target"
                          : "Set Target"}
                      </button>
                      <button
                        onClick={() =>
                          handleToggleColumnArchive(col.key, !!col.archived)
                        }
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${col.archived ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                      >
                        {col.archived ? "👁️ Show" : "🙈 Hide"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsArchiveModalOpen(false);
                  setArchiveSearchQuery("");
                }}
                className="px-5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-bold text-sm transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ARCHIVE DELETE MODAL --- */}
      {isArchiveDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[500px] shadow-2xl min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold mb-1 text-red-700">
              Delete Sale Columns
            </h3>

            {archiveBulkDeleteConfirm ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-4 animate-in zoom-in duration-200">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  {archiveBulkDeleteConfirm.type === "smart" ? (
                    <RefreshCw size={32} />
                  ) : (
                    <Trash2 size={32} />
                  )}
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">
                  {archiveBulkDeleteConfirm.type === "smart"
                    ? "Smart Delete"
                    : `Normal Delete (${archiveBulkDeleteConfirm.step}/2)`}
                </h4>
                <p className="text-sm text-gray-600 mb-8 font-medium">
                  {archiveBulkDeleteConfirm.type === "smart"
                    ? `Are you sure? This will permanently deduct sales of ${selectedArchiveCols.size} columns from Total Qty before deleting.`
                    : archiveBulkDeleteConfirm.step === 1
                      ? `Are you sure you want to normal delete ${selectedArchiveCols.size} selected columns? (Use if created by mistake)`
                      : `ABSOLUTELY sure? This deletes data and reverts remaining quantity for all ${selectedArchiveCols.size} columns.`}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setArchiveBulkDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (
                        archiveBulkDeleteConfirm.type === "normal" &&
                        archiveBulkDeleteConfirm.step === 1
                      ) {
                        setArchiveBulkDeleteConfirm({
                          type: "normal",
                          step: 2,
                        });
                      } else {
                        handleBulkDeleteSaleColumns(
                          Array.from(selectedArchiveCols),
                          archiveBulkDeleteConfirm.type,
                        );
                        setArchiveBulkDeleteConfirm(null);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg transition-colors"
                  >
                    {archiveBulkDeleteConfirm.type === "normal" &&
                    archiveBulkDeleteConfirm.step === 1
                      ? "Yes, Continue"
                      : "Confirm Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Select old sale columns you want to permanently remove.
                </p>

                <div className="mb-3 flex flex-col gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="🔍 Search columns to delete..."
                    className="w-full border-2 border-[#d7dde1] p-2 rounded-md outline-none focus:border-red-400 text-sm font-semibold transition-colors"
                    value={archiveDeleteSearchQuery}
                    onChange={(e) =>
                      setArchiveDeleteSearchQuery(e.target.value)
                    }
                  />
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => {
                        const filteredCols =
                          activeConfig?.columns.filter(
                            (c) =>
                              c.type === "sale_tracker" &&
                              c.name
                                .toLowerCase()
                                .includes(
                                  archiveDeleteSearchQuery.toLowerCase(),
                                ),
                          ) || [];
                        if (
                          selectedArchiveCols.size === filteredCols.length &&
                          filteredCols.length > 0
                        ) {
                          setSelectedArchiveCols(new Set());
                        } else {
                          setSelectedArchiveCols(
                            new Set(filteredCols.map((c) => c.key)),
                          );
                        }
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold transition-colors border border-gray-300 shadow-sm"
                    >
                      {activeConfig?.columns.filter(
                        (c) =>
                          c.type === "sale_tracker" &&
                          c.name
                            .toLowerCase()
                            .includes(archiveDeleteSearchQuery.toLowerCase()),
                      ).length === selectedArchiveCols.size &&
                      selectedArchiveCols.size > 0
                        ? "☒ Deselect All"
                        : "☑ Select All"}
                    </button>
                  </div>

                  {selectedArchiveCols.size > 0 && (
                    <div className="flex gap-2 justify-between items-center p-2 bg-red-50 border border-red-200 rounded-md mt-1 animate-in fade-in">
                      <span className="text-[11px] font-bold text-red-800">
                        {selectedArchiveCols.size} selected
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            setArchiveBulkDeleteConfirm({
                              type: "normal",
                              step: 1,
                            })
                          }
                          className="px-2 py-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 rounded text-[10px] font-bold transition-colors shadow-sm"
                        >
                          🗑️ Normal Delete
                        </button>
                        <button
                          onClick={() =>
                            setArchiveBulkDeleteConfirm({
                              type: "smart",
                              step: 1,
                            })
                          }
                          className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 rounded text-[10px] font-bold transition-colors shadow-sm"
                        >
                          🧠 Smart Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Columns List to Delete */}
                <div className="max-h-[300px] overflow-y-auto border-2 border-gray-100 rounded-md p-2 mb-4 bg-gray-50 flex-1">
                  {activeConfig?.columns
                    .filter(
                      (c) =>
                        c.type === "sale_tracker" &&
                        c.name
                          .toLowerCase()
                          .includes(archiveDeleteSearchQuery.toLowerCase()),
                    )
                    .map((col) => (
                      <div
                        key={col.key}
                        className={`flex justify-between items-center p-2.5 border-b border-gray-200 last:border-b-0 mb-1 rounded shadow-sm transition-colors bg-white hover:bg-red-50`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-red-600 cursor-pointer"
                            checked={selectedArchiveCols.has(col.key)}
                            onChange={(e) => {
                              const next = new Set(selectedArchiveCols);
                              if (e.target.checked) next.add(col.key);
                              else next.delete(col.key);
                              setSelectedArchiveCols(next);
                            }}
                          />
                          <div className="flex flex-col">
                            <span
                              className="text-sm font-semibold text-gray-700 cursor-pointer"
                              onClick={() => {
                                const next = new Set(selectedArchiveCols);
                                if (next.has(col.key)) next.delete(col.key);
                                else next.add(col.key);
                                setSelectedArchiveCols(next);
                              }}
                            >
                              {renderHighlightedText(
                                col.name,
                                archiveDeleteSearchQuery,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  {activeConfig?.columns.filter(
                    (c) => c.type === "sale_tracker",
                  ).length === 0 && (
                    <div className="text-sm text-gray-500 text-center p-4 font-semibold">
                      No custom sale columns found yet.
                    </div>
                  )}
                  {activeConfig?.columns.filter(
                    (c) =>
                      c.type === "sale_tracker" &&
                      c.name
                        .toLowerCase()
                        .includes(archiveDeleteSearchQuery.toLowerCase()),
                  ).length === 0 &&
                    archiveDeleteSearchQuery !== "" && (
                      <div className="text-sm text-red-500 text-center p-4 font-semibold">
                        No columns match your search "{archiveDeleteSearchQuery}
                        ".
                      </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setIsArchiveDeleteModalOpen(false);
                      setIsArchiveModalOpen(true);
                      setArchiveDeleteSearchQuery("");
                      setSelectedArchiveCols(new Set());
                      setArchiveBulkDeleteConfirm(null);
                    }}
                    className="px-5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-bold text-sm transition-colors shadow-sm"
                  >
                    Back to Archive
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
