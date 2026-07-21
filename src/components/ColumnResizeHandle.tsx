import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export const ColumnResizeHandle = ({
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
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0, opacity: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (showManualInput && popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      const padding = 8;
      
      let left = mousePos.x - rect.width / 2;
      let top = mousePos.y - rect.height * 1.1;

      if (left < padding) {
        left = padding;
      } else if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding;
      }

      if (top < padding) {
        top = mousePos.y + 16;
        if (top + rect.height > window.innerHeight - padding) {
          top = window.innerHeight - rect.height - padding;
        }
      } else if (top + rect.height > window.innerHeight - padding) {
        top = window.innerHeight - rect.height - padding;
      }

      setPopupPos({ left, top, opacity: 1 });
    } else {
      setPopupPos({ left: 0, top: 0, opacity: 0 });
    }
  }, [showManualInput, mousePos]);

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
              ref={popupRef}
              className="fixed z-[10001] bg-white border border-gray-300 p-3 rounded shadow-2xl flex flex-col gap-2.5 min-w-[160px]"
              style={{
                left: `${popupPos.left}px`,
                top: `${popupPos.top}px`,
                opacity: popupPos.opacity,
                visibility: popupPos.opacity === 0 ? "hidden" : "visible",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider border-b pb-1">
                Column Resizing
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full px-2 py-1 border rounded text-sm focus:outline-blue-500"
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
                  className="w-full bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowManualInput(false)}
                  className="w-full bg-red-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-red-700 transition-colors"
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
