app.post('/api/import-zip', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No zip file uploaded' });
    }

    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();
    
    // Extract uploads if existing
    zipEntries.forEach((entry: any) => {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        zip.extractEntryTo(entry.entryName, UPLOADS_DIR, false, true);
      }
    });

    const dataEntry = zipEntries.find((entry: any) => entry.entryName === 'data.json');
    if (!dataEntry) {
      return res.status(400).json({ error: 'data.json not found in zip archive' });
    }

    const payload = JSON.parse(dataEntry.getData().toString('utf8'));
    const isBundle = !!payload.isBundle;
    const isSinglePage = !!(payload.name && Array.isArray(payload.rows) && !payload.pages) && !isBundle;
    console.log(`Import ZIP detected: ${isBundle ? 'Bundle' : isSinglePage ? 'Single Page' : 'Full Backup'}`);
    
    let newState: any = {};

    // Smart Fallback: Normalize different backup formats into a single robust structure
    if (isBundle) {
      newState = {
        pages: payload.pages,
        pageConfigs: payload.pageConfigs,
        pageRows: payload.pageRows,
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    } else if (isSinglePage) {
      newState = {
        pages: [payload.name],
        pageConfigs: { [payload.name]: payload.config || {} },
        pageRows: { [payload.name]: Array.isArray(payload.rows) ? payload.rows : [] },
        globalCopyBoxes: null,
        globalRowNoWidth: 100,
        maxSearchHistory: 10
      };
    } else if (payload.pages && payload.pages.length > 0 && typeof payload.pages[0] === 'object') {
      // LocalDB legacy full backup format: { pages: [{ name, config, rows }] }
      const pageConfigs: any = {};
      const pageRows: any = {};
      const pageNames: string[] = [];
      payload.pages.forEach((p: any) => {
        if (p && p.name) {
          pageNames.push(p.name);
          pageConfigs[p.name] = p.config || {};
          pageRows[p.name] = p.rows || [];
        }
      });
      newState = {
        pages: pageNames,
        pageConfigs,
        pageRows,
        globalCopyBoxes: payload.settings?.globalCopyBoxes ?? null,
        globalRowNoWidth: payload.settings?.globalRowNoWidth ?? 100,
        maxSearchHistory: payload.settings?.maxSearchHistory ?? 10
      };
    } else {
      // Standard full backup format
      newState = payload;
      // Ensure fields exist so we don't crash from undefined reads
      newState.pageConfigs = newState.pageConfigs || {};
      newState.pageRows = newState.pageRows || {};
      newState.pages = Array.isArray(newState.pages) ? newState.pages : [];
    }

    // Fix duplicate IDs across all pages first
    if (newState.pageRows) {
      for (const pageName in newState.pageRows) {
        const seenIds = new Set<string>();
        newState.pageRows[pageName] = (newState.pageRows[pageName] || []).map((row: any) => {
          if (!row.id || seenIds.has(String(row.id))) {
            row.id = uuidv4();
          }
          seenIds.add(String(row.id));
          return row;
        });
      }
    }

    // Repair tracker rows from source pages before processing
    if (newState.pageConfigs && newState.pageRows) {
      for (const [trackerName, trackerConfig] of Object.entries(newState.pageConfigs)) {
        const config = trackerConfig as any;
        if (config.linkedSourcePage && newState.pageRows[config.linkedSourcePage]) {
          const sourceRows = newState.pageRows[config.linkedSourcePage];
          
          if (!newState.pageRows[trackerName]) {
            newState.pageRows[trackerName] = [];
          }
          
          const trackerRowsMap = new Map();
          for (const tr of newState.pageRows[trackerName]) {
            if (tr.id) trackerRowsMap.set(String(tr.id), tr);
          }
          
          const repairedTrackerRows = sourceRows.map((sr: any) => {
            const existingTr = trackerRowsMap.get(String(sr.id));
            if (existingTr) {
              const trackerKeysToKeep = [
                "total_qty",
                "remaining_qty"
              ];
              if (Array.isArray(config.columns)) {
                config.columns.forEach((c: any) => {
                  if (c.type === "sale_tracker" && c.key) {
                    trackerKeysToKeep.push(c.key);
                  }
                });
              }
              const preservedData: any = {};
              for (const k of trackerKeysToKeep) {
                if (k in existingTr) preservedData[k] = existingTr[k];
              }
              return { ...sr, ...preservedData };
            } else {
              return { ...sr, total_qty: "0" };
            }
          });
          
          newState.pageRows[trackerName] = repairedTrackerRows;
        }
      }
    }

    // We do NOT process base64 images here because they are already extracted physical files.
    const processedPageRows = newState.pageRows || {};

    if (isUsingMongoDB) {
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (const pageName of pagesToUpdate) {
          // Upsert page config
          await Page.findOneAndUpdate(
            { name: pageName },
            { name: pageName, config: newState.pageConfigs[pageName] || {} },
            { upsert: true }
          );

          // Delete only the rows belonging to that specific page
          await PageRow.deleteMany({ pageName });

          // Insert only the new rows for that page
          const rows = processedPageRows[pageName] || [];
          const rowsToInsert = rows.map((row: any) => ({ pageName, data: row }));
          if (rowsToInsert.length > 0) {
            await PageRow.insertMany(rowsToInsert);
          }
        }
      } else {
        // Fetch all existing rows to cleanup images
        const allOldPageRows = await getSortedPageRows({});
        const allOldRows = allOldPageRows.map((r: any) => r.data);
        
        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        // Clear existing data
        await Page.deleteMany({});
        await PageRow.deleteMany({});
        await AppSettings.deleteMany({});
        
        // Insert new pages (without rows)
        const pagesToInsert = newState.pages.map((name: string) => ({
          name,
          config: newState.pageConfigs[name] || {}
        }));
        
        if (pagesToInsert.length > 0) {
          await Page.insertMany(pagesToInsert);
        }

        // Insert all rows
        const allRowsToInsert: any[] = [];
        newState.pages.forEach((pageName: string) => {
          const rows = processedPageRows[pageName] || [];
          rows.forEach((row: any) => {
            allRowsToInsert.push({ pageName, data: row });
          });
        });

        if (allRowsToInsert.length > 0) {
          await PageRow.insertMany(allRowsToInsert);
        }
        
        // Update settings
        await AppSettings.findOneAndUpdate({}, {
          globalCopyBoxes: newState.globalCopyBoxes,
          globalRowNoWidth: newState.globalRowNoWidth,
          maxSearchHistory: newState.maxSearchHistory
        }, { upsert: true });
      }
      await triggerLocalBackup();
    } else {
      const db = await getLocalDB();
      if (isSinglePage || isBundle) {
        const pagesToUpdate = isBundle ? newState.pages : [payload.name];
        for (const pageName of pagesToUpdate) {
          const pageIdx = db.pages.findIndex((p: any) => p.name === pageName);
          const newPageData = {
            name: pageName,
            config: newState.pageConfigs[pageName] || {},
            rows: processedPageRows[pageName] || []
          };

          if (pageIdx >= 0) {
            db.pages[pageIdx] = newPageData;
          } else {
            db.pages.push(newPageData);
          }
        }
        await saveLocalDB(db);
      } else {
        const allOldRows: any[] = [];
        db.pages.forEach((p: any) => {
          if (p.rows) allOldRows.push(...p.rows);
        });

        const allNewRows: any[] = [];
        for (const pageName in processedPageRows) {
          allNewRows.push(...processedPageRows[pageName]);
        }
        await cleanupOrphanImages(allOldRows, allNewRows, true);
        await diskSweepOrphans(allNewRows);

        const newDb = {
          pages: newState.pages.map((name: string) => ({
            name,
            config: newState.pageConfigs[name] || {},
            rows: processedPageRows[name] || []
          })),
          settings: {
            globalCopyBoxes: newState.globalCopyBoxes,
            globalRowNoWidth: newState.globalRowNoWidth,
            maxSearchHistory: newState.maxSearchHistory
          }
        };
        await saveLocalDB(newDb);
      }
    }

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Import zip error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ error: err.message || 'Failed to import zip state' });
  }
});
