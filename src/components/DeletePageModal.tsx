import React, { useState } from "react";
import { Modal } from "./ui";
import { useToast } from "./ToastProvider";

export const DeletePageModal = ({
  isOpen,
  onClose,
  state,
  setState,
  setConfirmationModal,
}: any) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();


  if (!isOpen) return null;

  const pages = state.pages || Object.keys(state.pageConfigs);
  const filteredPages = pages.filter((p: string) =>
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (pageName: string) => {
    if (pages.length <= 1) {
      setConfirmationModal({
        isOpen: true,
        title: "Cannot Delete",
        message: "You must have at least one page in the system.",
        confirmLabel: "Understood",
        onConfirm: () => {},
      });
      return;
    }

    setConfirmationModal({
      isOpen: true,
      title: `Delete Page: ${pageName}`,
      message: `Are you sure you want to delete the page "${pageName}"? This action is permanent and will also delete any linked trackers.`,
      confirmLabel: "Yes, delete",
      onConfirm: () => {
        setTimeout(() => {
          setConfirmationModal({
            isOpen: true,
            title: `Final Warning: ${pageName}`,
            message: `This is your last chance. "${pageName}" and ALL its data will be completely erased.`,
            confirmLabel: "PERMANENTLY DELETE",
            onConfirm: async () => {
            try {
              const res = await fetch(`/api/pages/${encodeURIComponent(pageName)}`, {
                method: "DELETE",
              });
              const data = await res.json();
              if (!data.success) {
                toast(`❌ Failed to delete page: ${data.error}`);
                console.error(data.error);
                return;
              }
              toast(`✅ Page "${pageName}" deleted successfully!`);
            } catch (err: any) {
              toast(`❌ Network error while deleting page: ${err.message}`);
              console.error(err);
              return;
            }

            setState((prev: any) => {
              const newConfigs = { ...prev.pageConfigs };
              const newRows = { ...prev.pageRows };
              
              // find linked trackers
              const linkedPages = Object.keys(newConfigs).filter(
                (p) => newConfigs[p].linkedSourcePage === pageName
              );

              delete newConfigs[pageName];
              delete newRows[pageName];
              
              linkedPages.forEach((p) => {
                delete newConfigs[p];
                delete newRows[p];
              });

              // Pick a new active page if necessary
              let newActivePage = prev.activePage;
              if (newActivePage === pageName || linkedPages.includes(newActivePage)) {
                newActivePage = Object.keys(newConfigs)[0] || "";
              }

              const newPagesList = prev.pages 
                ? prev.pages.filter((p: string) => p !== pageName && !linkedPages.includes(p)) 
                : Object.keys(newConfigs);

              return {
                ...prev,
                pageConfigs: newConfigs,
                pageRows: newRows,
                pages: newPagesList,
                activePage: newActivePage
              };
            });
            onClose();
          }
        });
        }, 0);
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Page" width="400px">
      <div className="flex flex-col h-full max-h-[60vh]">
        <input
          type="text"
          placeholder="🔍 Search pages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border-2 border-[#d8d8d8] p-2 rounded text-sm mb-3 outline-none focus:border-red-400 font-semibold"
          autoFocus
        />

        <div className="overflow-y-auto flex-1 border border-[#e0e0e0] rounded bg-[#f9fafb] p-1.5">
          {filteredPages.length === 0 ? (
            <div className="text-sm text-gray-500 text-center p-4">
              No pages found.
            </div>
          ) : (
            filteredPages.map((p: string) => (
              <div
                key={p}
                className="flex justify-between items-center p-2 mb-1 border border-gray-200 bg-white rounded shadow-sm hover:bg-red-50 transition-colors group"
              >
                <span className="text-sm font-semibold text-gray-700 truncate mr-2" title={p}>
                  {p}
                </span>
                <button
                  className="px-3 py-1 bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded text-xs font-bold cursor-pointer transition-colors opacity-80 group-hover:opacity-100"
                  onClick={() => handleDelete(p)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
