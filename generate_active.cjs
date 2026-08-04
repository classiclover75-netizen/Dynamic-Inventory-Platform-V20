const fs = require('fs');

// 1. Generate activeOverviewUtils.ts
let utils = fs.readFileSync('src/lib/retiredOverviewUtils.ts', 'utf8');
utils = utils.replace(/RetiredItemInfo/g, 'ActiveItemInfo');
utils = utils.replace(/RetiredSourceOverview/g, 'ActiveSourceOverview');
utils = utils.replace(/buildRetiredOverview/g, 'buildActiveOverview');
utils = utils.replace(/retiredQty/g, 'activeQty');
utils = utils.replace(/totalRetiredQty/g, 'totalActiveQty');
utils = utils.replace(/lastRetiredAt/g, 'lastActiveAt');
utils = utils.replace(/retiredSources/g, 'activeSources');
utils = utils.replace(/FlatRetiredRow/g, 'FlatActiveRow');
utils = utils.replace(/buildFlatRetiredRows/g, 'buildFlatActiveRows');
utils = utils.replace(/_retiredSourceName/g, '_activeSourceName');
utils = utils.replace(/_retiredQty/g, '_activeQty');

// Fix the filter:
utils = utils.replace(/multiSource\.filter\(isRetired\)/g, 'multiSource.filter(s => !isRetired(s))');

fs.writeFileSync('src/lib/activeOverviewUtils.ts', utils);

// 2. Generate ActiveSourcesOverviewModal.tsx
let modal = fs.readFileSync('src/components/RetiredSourcesOverviewModal.tsx', 'utf8');

modal = modal.replace(/RetiredSourcesOverviewModal/g, 'ActiveSourcesOverviewModal');
modal = modal.replace(/RetiredItemInfo/g, 'ActiveItemInfo');
modal = modal.replace(/RetiredSourceOverview/g, 'ActiveSourceOverview');
modal = modal.replace(/buildRetiredOverview/g, 'buildActiveOverview');
modal = modal.replace(/buildFlatRetiredRows/g, 'buildFlatActiveRows');
modal = modal.replace(/FlatRetiredRow/g, 'FlatActiveRow');
modal = modal.replace(/retiredOverviewUtils/g, 'activeOverviewUtils');
modal = modal.replace(/retiredQty/g, 'activeQty');
modal = modal.replace(/totalRetiredQty/g, 'totalActiveQty');
modal = modal.replace(/_retiredSourceName/g, '_activeSourceName');
modal = modal.replace(/_retiredQty/g, '_activeQty');
modal = modal.replace(/Retired Sources Overview/g, 'Active Sources Overview');
modal = modal.replace(/Retired sources/g, 'Active sources');
modal = modal.replace(/retired source/g, 'active source');
modal = modal.replace(/retired items/g, 'active items');

fs.writeFileSync('src/components/ActiveSourcesOverviewModal.tsx', modal);

// 3. Update App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');

const importSearch = `import { RetiredSourcesOverviewModal } from './components/RetiredSourcesOverviewModal';`;
const importReplace = `import { RetiredSourcesOverviewModal } from './components/RetiredSourcesOverviewModal';
import { ActiveSourcesOverviewModal } from './components/ActiveSourcesOverviewModal';`;
app = app.replace(importSearch, importReplace);

const stateSearch = `  const [isRetiredSourcesOverviewOpen, setRetiredSourcesOverviewOpen] = useState(false);
  const [retiredOverviewFilterSources, setRetiredOverviewFilterSources] = useState<string[] | null>(null);`;
const stateReplace = `  const [isRetiredSourcesOverviewOpen, setRetiredSourcesOverviewOpen] = useState(false);
  const [retiredOverviewFilterSources, setRetiredOverviewFilterSources] = useState<string[] | null>(null);
  const [isActiveSourcesOverviewOpen, setActiveSourcesOverviewOpen] = useState(false);
  const [activeOverviewFilterSources, setActiveOverviewFilterSources] = useState<string[] | null>(null);`;
app = app.replace(stateSearch, stateReplace);

const tablePropsSearch = `            onOpenRetiredOverview={(sources?: string[]) => {
              setRetiredOverviewFilterSources(sources || null);
              setIsRetiredOverviewStandalone(true);
              setRetiredSourcesOverviewOpen(true);
            }}`;
const tablePropsReplace = `            onOpenRetiredOverview={(sources?: string[]) => {
              setRetiredOverviewFilterSources(sources || null);
              setIsRetiredOverviewStandalone(true);
              setRetiredSourcesOverviewOpen(true);
            }}
            onOpenActiveSourceOverview={(sources?: string[]) => {
              setActiveOverviewFilterSources(sources || null);
              setActiveSourcesOverviewOpen(true);
            }}`;
app = app.replace(tablePropsSearch, tablePropsReplace);

const modalRenderSearch = `      <RetiredSourcesOverviewModal
        pageName={state.activePage}
        isOpen={isRetiredSourcesOverviewOpen}
        initialSelectedSources={retiredOverviewFilterSources}
        onClose={() => {
          setRetiredSourcesOverviewOpen(false);
          if (!isRetiredOverviewStandalone) {
            setIsArchiveModalOpen(true);
          } else {
            setIsRetiredOverviewStandalone(false);
          }
        }}
        rows={state.rows}
        columns={config.columns}
        initialColWidths={config.colWidths}
        onSaveColWidths={(w) => updateConfig({ colWidths: w })}
      />`;
const modalRenderReplace = `      <RetiredSourcesOverviewModal
        pageName={state.activePage}
        isOpen={isRetiredSourcesOverviewOpen}
        initialSelectedSources={retiredOverviewFilterSources}
        onClose={() => {
          setRetiredSourcesOverviewOpen(false);
          if (!isRetiredOverviewStandalone) {
            setIsArchiveModalOpen(true);
          } else {
            setIsRetiredOverviewStandalone(false);
          }
        }}
        rows={state.rows}
        columns={config.columns}
        initialColWidths={config.colWidths}
        onSaveColWidths={(w) => updateConfig({ colWidths: w })}
      />
      <ActiveSourcesOverviewModal
        pageName={state.activePage}
        isOpen={isActiveSourcesOverviewOpen}
        initialSelectedSources={activeOverviewFilterSources}
        onClose={() => {
          setActiveSourcesOverviewOpen(false);
        }}
        rows={state.rows}
        columns={config.columns}
        initialColWidths={config.colWidths}
        onSaveColWidths={(w) => updateConfig({ colWidths: w })}
      />`;
app = app.replace(modalRenderSearch, modalRenderReplace);

fs.writeFileSync('src/App.tsx', app);

// 4. Update TableView.tsx
let table = fs.readFileSync('src/components/TableView.tsx', 'utf8');

const tableSearch1 = `  onOpenRetiredOverview?: (sources?: string[]) => void;`;
const tableReplace1 = `  onOpenRetiredOverview?: (sources?: string[]) => void;
  onOpenActiveSourceOverview?: (sources?: string[]) => void;`;
table = table.replace(tableSearch1, tableReplace1);

const tableSearch2 = `  onOpenRetiredOverview,`;
const tableReplace2 = `  onOpenRetiredOverview,
  onOpenActiveSourceOverview,`;
table = table.replace(tableSearch2, tableReplace2);

const tableSearch3 = `{active.map(
                                              (s: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className={\`px-2 py-0.5 rounded text-[14px] font-bold border flex items-center gap-1 \${s.color}\`}
                                                >`;
const tableReplace3 = `{active.map(
                                              (s: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onOpenActiveSourceOverview) onOpenActiveSourceOverview([s.source]);
                                                  }}
                                                  className={\`px-2 py-0.5 rounded text-[14px] font-bold border flex items-center gap-1 \${s.color} cursor-pointer hover:opacity-80 transition-opacity\`}
                                                >`;
table = table.replace(tableSearch3, tableReplace3);

fs.writeFileSync('src/components/TableView.tsx', table);
