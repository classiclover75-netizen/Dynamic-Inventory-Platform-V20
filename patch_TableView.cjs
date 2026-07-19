const fs = require('fs');
let code = fs.readFileSync('src/components/TableView.tsx', 'utf8');

code = code.replace(
  'import { sanitizeHtml } from "../lib/sanitizeHtml";',
  'import { sanitizeHtml } from "../lib/sanitizeHtml";\nimport { formatSourceNumber } from "../lib/multiSourceHelpers";'
);

code = code.replace(
  '<span className="opacity-70">\n                                                    {s.source}:\n                                                  </span>{" "}',
  '<span className="opacity-70">\n                                                    <span className="font-mono text-[11px] mr-1 opacity-50">{formatSourceNumber(idx)}</span>{s.source}:\n                                                  </span>{" "}'
);

code = code.replace(
  '<span className={s.remaining <= (config.minStockAlert ?? 0) ? "text-white font-extrabold opacity-100" : "opacity-70"}>\n                                                    {s.source}:\n                                                  </span>{" "}',
  '<span className={s.remaining <= (config.minStockAlert ?? 0) ? "text-white font-extrabold opacity-100" : "opacity-70"}>\n                                                    <span className="font-mono text-[11px] mr-1 opacity-50">{formatSourceNumber(idx)}</span>{s.source}:\n                                                  </span>{" "}'
);

code = code.replace(
  '<span className="opacity-70 shrink-0">{ts.source}:</span>',
  '<span className="opacity-70 shrink-0"><span className="font-mono text-[11px] mr-1 opacity-50">{formatSourceNumber(idx)}</span>{ts.source}:</span>'
);

code = code.replace(
  '<span className="opacity-70 shrink-0 capitalize">{b.source}:</span>',
  '<span className="opacity-70 shrink-0 capitalize"><span className="font-mono text-[11px] mr-1 opacity-50">{formatSourceNumber(idx)}</span>{b.source}:</span>'
);

fs.writeFileSync('src/components/TableView.tsx', code);
