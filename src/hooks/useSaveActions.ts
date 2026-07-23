import { PageConfig, RowData } from "../types";
import { savePageConfig, patchRow, appendPageRows, bulkPatchRows } from "../lib/api";

export function useSaveActions(deps: {
  state: any;
  setState: any;
  toast: any;
  toggleModal: any;
  editingRowId: any;
  setEditingRowId: any;
  setConfirmationModal: any;
  setPrimarySearchTags: any;
  primParentRef: any;
  returnToImagePreview: any;
  setReturnToImagePreview: any;
  returnToSettings: any;
  setReturnToSettings: any;
  refetchAndHydrateState?: any;
}) {
  const { state, setState, toast, toggleModal, editingRowId, setEditingRowId, setConfirmationModal, setPrimarySearchTags, primParentRef, returnToImagePreview, setReturnToImagePreview, returnToSettings, setReturnToSettings, refetchAndHydrateState } = deps;
  const handleSaveActivePageSettings = async (
    config: PageConfig,
    closeModal: boolean = true,
  ) => {
    try {
      await savePageConfig(state.activePage, config);

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
        response = await patchRow(targetPage, editingRowId, newRows[0], force);
      } else {
        response = await appendPageRows(targetPage, newRows, force);
      }

      if (!response.ok) {
        if (response.status === 400) {
          let data: any = {}; try { data = await response.json(); } catch(e) {}
          if (data.requiresConfirmation) {
            setConfirmationModal({
              isOpen: true,
              title: "Unsupported Image Format",
              message: data.error,
              onConfirm: () => handleSaveRows(newRows, pageName, true),
            });
            return;
          }
        } else if (response.status === 404) {
          toast("This data was changed elsewhere. Refreshing to the latest version… please redo your change.");
          if (refetchAndHydrateState) {
            await refetchAndHydrateState();
          }
          toggleModal("addRow", false);
          setEditingRowId(null);
          return;
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

      await Promise.all(linkedTrackers.map(async (trackerName) => {
        const trackerConfig = state.pageConfigs[trackerName];
        if (!trackerConfig) return;
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
          await bulkPatchRows(trackerName, { updates: updatesObj });
        }

        if (appendRows.length > 0) {
          await appendPageRows(trackerName, appendRows);
        }

        if (updatedTracker) {
          setState((prev) => ({
            ...prev,
            pageRows: { ...prev.pageRows, [trackerName]: trackerRows },
          }));
        }
      }));

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

  return { handleSaveActivePageSettings, handleSaveRows };
}
