const fs = require('fs');
let code = fs.readFileSync('src/components/SourceAutocompleteInput.tsx', 'utf8');

const targetReturn = `  return (
    <div className={\`\${wrapperClassName || (isExistingSource ? "" : "flex-1 min-w-[80px]")}\`} ref={wrapperRef}>
      {isExistingSource ? (`;

const newReturn = `  const isFixed = isExistingSource;

  return (
    <div className={\`\${wrapperClassName || (isExistingSource ? "" : "flex-1 min-w-[80px]")} relative\`} ref={wrapperRef}>
      {isExistingSource ? (`;

code = code.replace(targetReturn, newReturn);

const targetScroll = `  // Close on scroll to avoid detached fixed dropdown
  useEffect(() => {
    if (!showSuggestions) return;
    const handleScroll = () => setShowSuggestions(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [showSuggestions]);`;

const newScroll = `  // Close on scroll to avoid detached fixed dropdown
  useEffect(() => {
    if (!showSuggestions || !isFixed) return;
    const handleScroll = () => setShowSuggestions(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [showSuggestions, isFixed]);`;

code = code.replace(targetScroll, newScroll);

const targetDropdown = `      {showSuggestions && filtered.length > 0 && (
        <div 
          className="fixed z-[99999] min-w-[140px] max-h-48 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg p-1.5 flex flex-col gap-1.5"
          style={{
            left: dropdownRect.left,
            ...(dropdownPosition === "top" 
              ? { bottom: window.innerHeight - dropdownRect.top + 4 } 
              : { top: dropdownRect.bottom + 4 }),
            minWidth: Math.max(dropdownRect.width, 140)
          }}
        >`;

const newDropdown = `      {showSuggestions && filtered.length > 0 && (
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

code = code.replace(targetDropdown, newDropdown);

fs.writeFileSync('src/components/SourceAutocompleteInput.tsx', code);
