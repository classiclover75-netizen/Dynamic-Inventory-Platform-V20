const fs = require('fs');

// activeOverviewUtils.ts
let utilsCode = fs.readFileSync('src/lib/retiredOverviewUtils.ts', 'utf8');

utilsCode = utilsCode.replace(/RetiredItemInfo/g, 'ActiveItemInfo');
utilsCode = utilsCode.replace(/RetiredSourceOverview/g, 'ActiveSourceOverview');
utilsCode = utilsCode.replace(/buildRetiredOverview/g, 'buildActiveOverview');
utilsCode = utilsCode.replace(/retiredQty/g, 'activeQty');
utilsCode = utilsCode.replace(/totalRetiredQty/g, 'totalActiveQty');
utilsCode = utilsCode.replace(/lastRetiredAt/g, 'lastActiveAt'); // I can just ignore or keep it
utilsCode = utilsCode.replace(/isRetired/g, 'isActive');
utilsCode = utilsCode.replace(/const retiredSources = multiSource.filter\(isActive\);/g, 'const activeSources = multiSource.filter(s => !isActive(s));'); 
// wait, the regex above will replace isRetired with isActive. So `multiSource.filter(isActive)` 
// actually I should fix that more cleanly.
