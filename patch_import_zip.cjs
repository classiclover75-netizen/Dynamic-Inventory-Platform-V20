const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let startIndex = code.indexOf(`app.post('/api/import-zip', upload.single('backup'), async (req, res) => {`);
if (startIndex === -1) {
    console.error("Could not find start");
    process.exit(1);
}

// We will replace the whole body of the route.
let functionBodyStart = code.indexOf('{', startIndex) + 1;
// Find the closing brace of the route
let openCount = 1;
let endIndex = -1;
for (let i = functionBodyStart; i < code.length; i++) {
    if (code[i] === '{') openCount++;
    if (code[i] === '}') {
        openCount--;
        if (openCount === 0) {
            endIndex = i;
            break;
        }
    }
}

if (endIndex === -1) {
    console.error("Could not find end");
    process.exit(1);
}

let originalBody = code.substring(functionBodyStart, endIndex);

// Now we inject our tracking object at the top
const trackingSetup = `
  const _diag = {
    start: Date.now(),
    imgStart: 0, imgEnd: 0, imgCount: 0,
    jsonStart: 0, jsonEnd: 0,
    orphanStart: 0, orphanEnd: 0,
    pages: [] as {name: string, duration: number, rows: number}[]
  };
`;

let modifiedBody = trackingSetup + originalBody;

// 1. Image extraction
modifiedBody = modifiedBody.replace(
    `sendProgress(5, 'Reading backup archive...');`,
    `try { _diag.imgStart = Date.now(); } catch(e) {}
    sendProgress(5, 'Reading backup archive...');`
);

modifiedBody = modifiedBody.replace(
    `const dataEntry = zipEntries.find((entry) => entry.entryName === 'data.json');`,
    `try { _diag.imgEnd = Date.now(); _diag.jsonStart = Date.now(); } catch(e) {}
    const dataEntry = zipEntries.find((entry) => entry.entryName === 'data.json');`
);

modifiedBody = modifiedBody.replace(
    `extractedCount++;`,
    `extractedCount++;
        try { _diag.imgCount++; } catch(e) {}`
);

// 2. data.json parse
modifiedBody = modifiedBody.replace(
    `sendProgress(70, 'Preparing pages and rows...');`,
    `try { _diag.jsonEnd = Date.now(); } catch(e) {}
    sendProgress(70, 'Preparing pages and rows...');`
);

// 3. Orphan cleanup (Mongo full)
modifiedBody = modifiedBody.replace(
    `sendProgress(96, 'Cleaning up unused images...');`,
    `try { _diag.orphanStart = Date.now(); } catch(e) {}
        sendProgress(96, 'Cleaning up unused images...');`
);
modifiedBody = modifiedBody.replace(
    `await diskSweepOrphans(allNewRows);`,
    `await diskSweepOrphans(allNewRows);
        try { _diag.orphanEnd = Date.now(); } catch(e) {}`
);

// Orphan cleanup (Local full)
modifiedBody = modifiedBody.replace(
    `await diskSweepOrphans(allNewRows);\n        const oldDbCopy =`,
    `await diskSweepOrphans(allNewRows);
        try { _diag.orphanEnd = Date.now(); } catch(e) {}
        const oldDbCopy =`
);
modifiedBody = modifiedBody.replace(
    `await cleanupOrphanImages(allOldRows, allNewRows, true);\n        await diskSweepOrphans(allNewRows);\n        const oldDbCopy =`,
    `try { _diag.orphanStart = Date.now(); } catch(e) {}
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);
        try { _diag.orphanEnd = Date.now(); } catch(e) {}
        const oldDbCopy =`
);

// MongoDB Single Page / Bundle per page
modifiedBody = modifiedBody.replace(
    `const pageName = pagesToUpdate[i];`,
    `const pageName = pagesToUpdate[i];
          let _pgStart = 0; try { _pgStart = Date.now(); } catch(e) {}`
);
modifiedBody = modifiedBody.replace(
    `await executeSafeBulkWrite(bulkOps);\n        }`,
    `await executeSafeBulkWrite(bulkOps);
          try { _diag.pages.push({ name: pageName, duration: Date.now() - _pgStart, rows: rows.length }); } catch(e) {}
        }`
);

// MongoDB Full Backup per page
modifiedBody = modifiedBody.replace(
    `importedPages.forEach((pageName: string, i: number) => {`,
    `importedPages.forEach((pageName: string, i: number) => {
          let _pgStart = 0; try { _pgStart = Date.now(); } catch(e) {}`
);
modifiedBody = modifiedBody.replace(
    `upsert: true
              }
            });
          });
        });`,
    `upsert: true
              }
            });
          });
          try { _diag.pages.push({ name: pageName, duration: Date.now() - _pgStart, rows: rows.length }); } catch(e) {}
        });`
);
modifiedBody = modifiedBody.replace(
    `const existingDocs = await PageRow.find({}, { _id: 1, 'data.id': 1, pageName: 1 }).lean();`,
    `let _dbStart = 0; try { _dbStart = Date.now(); } catch(e) {}
        const existingDocs = await PageRow.find({}, { _id: 1, 'data.id': 1, pageName: 1 }).lean();`
);
modifiedBody = modifiedBody.replace(
    `await executeSafeBulkWrite(bulkOps);\n        \n        // Update settings`,
    `await executeSafeBulkWrite(bulkOps);
        try { _diag.pages.push({ name: 'DB Bulk Write', duration: Date.now() - _dbStart, rows: bulkOps.length }); } catch(e) {}
        
        // Update settings`
);

// LocalDB Single Page / Bundle per page
modifiedBody = modifiedBody.replace(
    `          const newRows = processedPageRows[pageName] || [];\n          sendProgress`,
    `          let _pgStart = 0; try { _pgStart = Date.now(); } catch(e) {}
          const newRows = processedPageRows[pageName] || [];
          sendProgress`
);
modifiedBody = modifiedBody.replace(
    `            db.pages.push(newPageData);
          }
        }
        await saveLocalDB(db);`,
    `            db.pages.push(newPageData);
          }
          try { _diag.pages.push({ name: pageName, duration: Date.now() - _pgStart, rows: newRows.length }); } catch(e) {}
        }
        await saveLocalDB(db);`
);

// LocalDB Full Backup per page
modifiedBody = modifiedBody.replace(
    `            pages: newState.pages.map((name: string) => ({`,
    `            pages: newState.pages.map((name: string) => {
              let _s = 0; try { _s = Date.now(); } catch(e) {}
              const res = {`
);
modifiedBody = modifiedBody.replace(
    `              rows: processedPageRows[name] || []
            })),
            settings: {`,
    `              rows: processedPageRows[name] || []
              };
              try { _diag.pages.push({ name, duration: Date.now() - _s, rows: res.rows.length }); } catch(e) {}
              return res;
            }),
            settings: {`
);


// And finally at the very end of success flow:
const reportLogic = `
    // DIAGNOSTIC REPORT
    try {
      const totalTime = Date.now() - _diag.start;
      const imgTime = _diag.imgEnd ? (_diag.imgEnd - _diag.imgStart) / 1000 : 0;
      const jsonTime = _diag.jsonEnd ? (_diag.jsonEnd - _diag.jsonStart) / 1000 : 0;
      const orphanTime = _diag.orphanEnd ? (_diag.orphanEnd - _diag.orphanStart) / 1000 : 0;
      
      let phases: {name: string, time: number}[] = [
        {name: 'Image extraction', time: imgTime},
        {name: 'data.json parse', time: jsonTime},
        {name: 'Orphan cleanup', time: orphanTime}
      ];
      
      console.log('=== IMPORT TIMING SUMMARY ===');
      console.log(\`Image extraction: \${imgTime.toFixed(1)}s (\${_diag.imgCount} files)\`);
      console.log(\`data.json parse: \${jsonTime.toFixed(1)}s\`);
      
      _diag.pages.forEach(p => {
         const pTime = p.duration / 1000;
         phases.push({name: \`Page "\${p.name}"\`, time: pTime});
         console.log(\`Page "\${p.name}": \${pTime.toFixed(1)}s (\${p.rows} rows)\`);
      });
      
      if (_diag.orphanEnd) {
         console.log(\`Orphan cleanup: \${orphanTime.toFixed(1)}s\`);
      }
      console.log(\`TOTAL IMPORT TIME: \${(totalTime / 1000).toFixed(1)}s\`);
      
      phases.sort((a, b) => b.time - a.time);
      if (phases.length > 0) {
         console.log(\`Slowest phase: \${phases[0].name} (\${phases[0].time.toFixed(1)}s)\`);
      }
      console.log('=============================');
    } catch(e) {
      console.error('Error generating timing report:', e);
    }
`;

modifiedBody = modifiedBody.replace(
    `imageProcessingCache.clear();\n      \n    res.json({ success: true });`,
    `imageProcessingCache.clear();\n      ${reportLogic}\n    res.json({ success: true });`
);

let newCode = code.substring(0, functionBodyStart) + modifiedBody + code.substring(endIndex);
fs.writeFileSync('server.ts', newCode);
