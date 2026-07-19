const fs = require('fs');
let code = fs.readFileSync('src/components/SourceAutocompleteInput.tsx', 'utf8');

const targetDropdown = `      {showSuggestions && filtered.length > 0 && (
        <div 
          className={\`\${isFixed ? "fixed z-[99999]" : "absolute z-[5]"} min-w-[140px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg p-1.5 flex flex-col gap-1.5\`}
          style={isFixed ? {
            left: dropdownRect.left,
            ...(dropdownPosition === "top" 
              ? { bottom: window.innerHeight - dropdownRect.top + 4 } 
              : { top: dropdownRect.bottom + 4 }),
            minWidth: Math.max(dropdownRect.width, 140)
          } : {
            left: 0,
            ...(dropdownPosition === "top" 
              ? { bottom: "calc(100% + 4px)" } 
              : { top: "calc(100% + 4px)" }),
            minWidth: Math.max(dropdownRect.width, 140),
            marginBottom: dropdownPosition === "bottom" ? "80px" : undefined
          }}
        >`;

const newDropdown = `      {showSuggestions && filtered.length > 0 && !isFixed && dropdownPosition === "bottom" && (
        <div className="h-20 w-full pointer-events-none" aria-hidden="true" />
      )}
      {showSuggestions && filtered.length > 0 && (
        <div 
          className={\`\${isFixed ? "fixed z-[99999]" : "absolute z-[5]"} min-w-[140px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg p-1.5 flex flex-col gap-1.5\`}
          style={isFixed ? {
            left: dropdownRect.left,
            ...(dropdownPosition === "top" 
              ? { bottom: window.innerHeight - dropdownRect.top + 4 } 
              : { top: dropdownRect.bottom + 4 }),
            minWidth: Math.max(dropdownRect.width, 140)
          } : {
            left: 0,
            ...(dropdownPosition === "top" 
              ? { bottom: "calc(100% + 4px)" } 
              : { top: "calc(100% + 4px)" }),
            minWidth: Math.max(dropdownRect.width, 140)
          }}
        >`;

code = code.replace(targetDropdown, newDropdown);
fs.writeFileSync('src/components/SourceAutocompleteInput.tsx', code);
