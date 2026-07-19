const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');

const target = `                            return (
                              <div className="border border-purple-200 bg-purple-50 p-2 rounded flex flex-col h-full min-h-[100px]">
                                <div className="flex flex-col gap-2 mb-2">
                                  {currentSources.map(
                                    (src: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex flex-wrap sm:flex-nowrap w-full box-border gap-2 items-center bg-white p-2 rounded shadow-sm border border-purple-100"
                                      >
                                        <SourceAutocompleteInput`;

const replacement = `                            return (
                              <div className="border border-purple-200 bg-purple-50 p-2 rounded flex flex-col h-full min-h-[100px]">
                                <div className="flex justify-between items-center mb-2 px-1">
                                  <span className="text-xs text-purple-700 font-bold uppercase">Sources</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                                    onClick={() => {
                                      const sorted = sortSourcesAZ(currentSources);
                                      handleUpdateField(i, col.key, JSON.stringify(sorted));
                                    }}
                                  >
                                    <ArrowDownAZ className="w-3 h-3 mr-1" />
                                    Sort A-Z
                                  </Button>
                                </div>
                                <DragDropContext
                                  onDragEnd={(result: DropResult) => {
                                    if (!result.destination) return;
                                    const reordered = reorderSources(currentSources, result.source.index, result.destination.index);
                                    handleUpdateField(i, col.key, JSON.stringify(reordered));
                                  }}
                                >
                                  <Droppable droppableId={\`droppable-\${i}-\${col.key}\`}>
                                    {(provided) => (
                                      <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="flex flex-col gap-2 mb-2"
                                      >
                                        {currentSources.map((src: any, idx: number) => (
                                          <Draggable key={\`\${i}-\${col.key}-\${idx}\`} draggableId={\`\${i}-\${col.key}-\${idx}\`} index={idx}>
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={\`flex flex-wrap sm:flex-nowrap w-full box-border gap-2 items-center bg-white p-2 rounded shadow-sm border \${snapshot.isDragging ? 'border-purple-400 shadow-md ring-1 ring-purple-200' : 'border-purple-100'}\`}
                                                style={provided.draggableProps.style}
                                              >
                                                <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing px-1 shrink-0">
                                                  <GripVertical className="h-4 w-4" />
                                                </div>
                                                <div className="shrink-0 text-xs font-mono text-gray-500 w-5 flex justify-center">
                                                  {formatSourceNumber(idx)}
                                                </div>
                                                <SourceAutocompleteInput`;

code = code.replace(target, replacement);

const target2 = `                                            handleUpdateField(
                                              i,
                                              col.key,
                                              copy.length > 0
                                                ? JSON.stringify(copy)
                                                : "",
                                            );
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        {i === 0 && blocks.length > 1 && (
                                          <button
                                            type="button"
                                            title="Apply this source & qty to all rows"
                                            className="text-purple-500 font-bold px-1 hover:text-purple-700 ml-1 flex-shrink-0"
                                            onClick={() => {
                                              const newBlocks = [...blocks];
                                              for (let r = 1; r < newBlocks.length; r++) {
                                                const existing = parseMultiSource(newBlocks[r][col.key]);
                                                const exists = existing.findIndex((e: any) => e.source.trim().toLowerCase() === src.source.trim().toLowerCase());
                                                if (exists >= 0) {
                                                  existing[exists].qty = src.qty;
                                                  existing[exists].color = src.color || existing[exists].color;
                                                } else {
                                                  existing.push({ ...src });
                                                }
                                                handleUpdateField(r, col.key, JSON.stringify(existing));
                                              }
                                            }}
                                          >
                                            <Layers3 className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>`;

const replacement2 = `                                            handleUpdateField(
                                              i,
                                              col.key,
                                              copy.length > 0
                                                ? JSON.stringify(copy)
                                                : "",
                                            );
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        {i === 0 && blocks.length > 1 && (
                                          <button
                                            type="button"
                                            title="Apply this source & qty to all rows"
                                            className="text-purple-500 font-bold px-1 hover:text-purple-700 ml-1 flex-shrink-0"
                                            onClick={() => {
                                              const newBlocks = [...blocks];
                                              for (let r = 1; r < newBlocks.length; r++) {
                                                const existing = parseMultiSource(newBlocks[r][col.key]);
                                                const exists = existing.findIndex((e: any) => e.source.trim().toLowerCase() === src.source.trim().toLowerCase());
                                                if (exists >= 0) {
                                                  existing[exists].qty = src.qty;
                                                  existing[exists].color = src.color || existing[exists].color;
                                                } else {
                                                  existing.push({ ...src });
                                                }
                                                handleUpdateField(r, col.key, JSON.stringify(existing));
                                              }
                                            }}
                                          >
                                            <Layers3 className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                            )}
                                          </Draggable>
                                        ))}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                </DragDropContext>`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/components/AddRowModal.tsx', code);
