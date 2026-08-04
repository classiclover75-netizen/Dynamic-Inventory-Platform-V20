const fs = require('fs');

let modal = fs.readFileSync('src/components/ActiveSourcesOverviewModal.tsx', 'utf8');

modal = modal.replace(/"Retired Source"/g, '"Active Source"');
modal = modal.replace(/__retired_source/g, '__active_source');
modal = modal.replace(/'Retired Sources'/g, "'Active Sources'");
modal = modal.replace(/"Retired Qty"/g, '"Active Qty"');
modal = modal.replace(/_Retired_Sources_/g, '_Active_Sources_');
modal = modal.replace(/📦 Retired Source/g, '📦 Active Source');

fs.writeFileSync('src/components/ActiveSourcesOverviewModal.tsx', modal);
