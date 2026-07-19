const fs = require('fs');
let code = fs.readFileSync('src/components/SourceAutocompleteInput.tsx', 'utf8');

code = code.replace(
  'import { RowData } from "../types";',
  'import { RowData } from "../types";\nimport { formatSourceNumber } from "../lib/multiSourceHelpers";'
);

code = code.replace(
  '{s.source}\n            </div>',
  '<span className="font-mono text-[11px] mr-1 opacity-50">{formatSourceNumber(idx)}</span>{s.source}\n            </div>'
);

fs.writeFileSync('src/components/SourceAutocompleteInput.tsx', code);
