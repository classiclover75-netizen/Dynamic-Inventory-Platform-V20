import { useToast } from "./ToastProvider";

export const PageTabsBar = ({ pages, activePage, setState }: any) => {
  const { toast } = useToast();
  return (
      <div className="flex gap-1.5 flex-wrap items-center bg-white border border-[#d8d8d8] rounded-md p-2 min-h-[44px]">
        {pages.length === 0 ? (
          <span className="text-xs text-[#90a4ae] font-bold">
            No pages yet. Click Add Page to create one.
          </span>
        ) : (
          pages.map((page) => (
            <button
              key={page}
              className={`border border-[#cfd8dc] rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${page === activePage ? "bg-[#2b579a] text-white border-[#2b579a]" : "bg-[#eceff1] text-[#37474f] hover:bg-gray-200"}`}
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
  );
};
