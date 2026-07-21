const fs = require('fs');
let code = fs.readFileSync('src/components/ActivePageSettingsModal.tsx', 'utf8');

function replace(search, replacement) {
    if (code.includes(search)) {
        code = code.replace(search, replacement);
        console.log("Replaced:", search.substring(0, 50) + "...");
    } else {
        console.error("NOT FOUND:", search.substring(0, 50) + "...");
    }
}

// 1. Row Height
replace(
    `<div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Row Height</span>`,
    `{!pageConfig?.linkedSourcePage && (<div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Row Height</span>`
);
replace(
    `Adjust the global height of all rows on this page (40-300px).\n        </div>\n      </div>\n      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Row Reorder</span>`,
    `Adjust the global height of all rows on this page (40-300px).\n        </div>\n      </div>)}\n      {!pageConfig?.linkedSourcePage && (<div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Row Reorder</span>`
);
replace(
    `Enable this to unlock single-row and multi-row move features. Disable it to prevent accidental row movement.\n        </div>\n      </div>\n      {!!pageConfig?.linkedSourcePage && (`,
    `Enable this to unlock single-row and multi-row move features. Disable it to prevent accidental row movement.\n        </div>\n      </div>)}\n      {!!pageConfig?.linkedSourcePage && (`
);

// 3. Link Secondary Search Page
replace(
    `<div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Link Secondary Search Page</span>`,
    `{!pageConfig?.linkedSourcePage && (<div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Link Secondary Search Page</span>`
);
replace(
    `Select another page to display a secondary search bar and view its data below this page's data.\n        </div>\n      </div>\n      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Independent Search Bars</span>`,
    `Select another page to display a secondary search bar and view its data below this page's data.\n        </div>\n      </div>)}\n      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">\n        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">\n          <span className="text-[13px] text-[#37474f] font-bold">Independent Search Bars</span>`
);

// 4. Page Copy Boxes
replace(
    `<div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">\n        <div className="flex items-center justify-between">\n          <div>\n            <p className="text-sm font-bold text-[#2b579a]">📦 Page Copy Boxes</p>`,
    `{!pageConfig?.linkedSourcePage && (<div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">\n        <div className="flex items-center justify-between">\n          <div>\n            <p className="text-sm font-bold text-[#2b579a]">📦 Page Copy Boxes</p>`
);
replace(
    `⚙️ Configure Copy Boxes for this Page\n          </Button>\n        )}\n      </div>\n      {!pageConfig?.isTrackerPage && onCreateTracker && (`,
    `⚙️ Configure Copy Boxes for this Page\n          </Button>\n        )}\n      </div>)}\n      {!pageConfig?.isTrackerPage && onCreateTracker && (`
);

// 6 & 7: Create Column & Add Row
replace(
    `<div className="flex gap-2 mb-2">\n          <Button variant="blue" className="flex-1 justify-center" onClick={onCreateColumn}><Plus size={14} /> Create Column</Button>\n          <Button variant="green" className="flex-1 justify-center" onClick={onAddRow}>🧾 Add Row</Button>\n        </div>`,
    `{!pageConfig?.linkedSourcePage && (<div className="flex gap-2 mb-2">\n          <Button variant="blue" className="flex-1 justify-center" onClick={onCreateColumn}><Plus size={14} /> Create Column</Button>\n          <Button variant="green" className="flex-1 justify-center" onClick={onAddRow}>🧾 Add Row</Button>\n        </div>)}`
);

// 8. Import Excel
replace(
    `<div className="flex gap-2 mb-2">\n          <Button variant="green" className="flex-1 justify-center" onClick={onImportExcel}>📥 Import Excel</Button>\n          <Button variant="blue" className="flex-1 justify-center" onClick={onExportExcel}>📤 Export Excel</Button>\n        </div>`,
    `<div className="flex gap-2 mb-2">\n          {!pageConfig?.linkedSourcePage && <Button variant="green" className="flex-1 justify-center" onClick={onImportExcel}>📥 Import Excel</Button>}\n          <Button variant="blue" className="flex-1 justify-center" onClick={onExportExcel}>📤 Export Excel</Button>\n        </div>`
);

// 9. Import Page JSON/ZIP
replace(
    `<div className="flex justify-between items-center mt-2 mb-4 gap-2">\n          <Button variant="outline" className="flex-1 justify-center" onClick={() => fileInputRef.current?.click()}>📂 Import Page (JSON/ZIP)</Button>\n          {!pageConfig?.isTrackerPage && (`,
    `<div className="flex justify-between items-center mt-2 mb-4 gap-2">\n          {!pageConfig?.linkedSourcePage && <Button variant="outline" className="flex-1 justify-center" onClick={() => fileInputRef.current?.click()}>📂 Import Page (JSON/ZIP)</Button>}\n          {!pageConfig?.isTrackerPage && (`
);

// 5. Find Duplicates
replace(
    `<div className="flex gap-2 mb-2">\n          <Button variant="outline" className="flex-1 justify-center text-orange-600 border-orange-600 hover:bg-orange-50" onClick={onFindDuplicates}>\n            🔍 Find Duplicates\n          </Button>\n          <Button variant="outline" className="flex-1 justify-center text-red-600 border-red-600 hover:bg-red-50" onClick={() => {\n            setConfirmationModal({\n              isOpen: true,`,
    `<div className="flex gap-2 mb-2">\n          {!pageConfig?.linkedSourcePage && <Button variant="outline" className="flex-1 justify-center text-orange-600 border-orange-600 hover:bg-orange-50" onClick={onFindDuplicates}>\n            🔍 Find Duplicates\n          </Button>}\n          <Button variant="outline" className="flex-1 justify-center text-red-600 border-red-600 hover:bg-red-50" onClick={() => {\n            setConfirmationModal({\n              isOpen: true,`
);

fs.writeFileSync('src/components/ActivePageSettingsModal.tsx', code);
