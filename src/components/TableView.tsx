import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Lock, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { CopyPopupNotification } from "./CopyPopupNotification";
import { decodeHtmlEntities, parseMultiSource } from "../lib/appUtils";
import { sanitizeHtml } from "../lib/sanitizeHtml";

export const TableView = ({
  config, rows, queries, isSecondary, showArchived, setBox1Value, setBox2Value, activeAnchor, originalRows, isGhost, ghostIds,
  state, activeConfig,
  inlineEdit, setInlineEdit,
  selectedRowIds, setSelectedRowIds,
  setHoveredImage,
  activePopupId, setActivePopupId, setActiveAnchor,
  setEditingRowId, setEditingPageName, setPreviewContext,
  primTable, secTable,
  primVirtualizer, secVirtualizer,
  primParentRef, secParentRef,
  savedPrimScroll, savedSecScroll,
  handleClosePopup, handleDragEnd, handleSaveColumnWidth, handleSaveInlineEdit,
  handleTableMouseOver, handleTableMouseOut,
  getImageUrl, toggleModal,
}: any) => {
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
                                                        __html: sanitizeHtml(
                                                          highlightHtmlText(
                                                            displayText,
                                                            colTokens,
                                                            isGhost,
                                                          )
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
                                                    __html: sanitizeHtml(
                                                      highlightHtmlText(
                                                        strVal,
                                                        colTokens,
                                                        isGhost,
                                                      )
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
                                            __html: sanitizeHtml(
                                              highlightHtmlText(
                                                strRawVal,
                                                colTokens,
                                                isGhost,
                                              )
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
