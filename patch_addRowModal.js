const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');

const target = `                    const colNumber =
                      columns.findIndex((c) => c.key === col.key) + 1;

                    return (
                      <div key={col.key} className={\`flex flex-col relative \${isReadOnly ? "opacity-60" : ""} \${(col.key === "total_qty" || col.type === "sale_tracker") ? "sm:col-span-2" : ""}\`}>`;

const replacement = `                    const colNumber =
                      columns.findIndex((c) => c.key === col.key) + 1;
                      
                    const isLiveTrackerHighlight = isLiveTracker && col.key === "total_qty";

                    return (
                      <div key={col.key} className={\`flex flex-col relative \${isReadOnly ? "opacity-60" : ""} \${(col.key === "total_qty" || col.type === "sale_tracker") ? "sm:col-span-2" : ""} \${isLiveTrackerHighlight ? "ring-2 ring-blue-500 ring-offset-2 bg-blue-50 p-2 rounded-md shadow-md z-10" : ""}\`}>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/AddRowModal.tsx', code);
    console.log("Successfully patched.");
} else {
    console.log("Target not found!");
}
