const fs = require('fs');
let code = fs.readFileSync('src/lib/appUtils.tsx', 'utf8');
code = code.replace(
  'const arr = Array.isArray(parsed) ? parsed : [];\n    result = arr.sort((a: any, b: any) => String(a.source || "").localeCompare(String(b.source || "")));',
  'const arr = Array.isArray(parsed) ? parsed : [];\n    result = arr;'
);
fs.writeFileSync('src/lib/appUtils.tsx', code);
