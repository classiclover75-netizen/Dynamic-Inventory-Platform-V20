const fs = require('fs');
let code = fs.readFileSync('src/components/ActivePageSettingsModal.tsx', 'utf8');
console.log(code.substring(code.indexOf('⚙️ Configure Copy Boxes for this Page'), code.indexOf('⚡ Create Linked Live Tracker')));
