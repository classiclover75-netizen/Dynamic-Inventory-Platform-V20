const fs = require('fs');
let code = fs.readFileSync('src/components/SourceAutocompleteInput.tsx', 'utf8');

code = code.replace("  const isFixed = isExistingSource;\n\n  return (", "  return (");
code = code.replace("  const [showSuggestions, setShowSuggestions] = useState(false);", "  const isFixed = isExistingSource;\n  const [showSuggestions, setShowSuggestions] = useState(false);");

fs.writeFileSync('src/components/SourceAutocompleteInput.tsx', code);
