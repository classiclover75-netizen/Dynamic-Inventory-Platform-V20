const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');

const target2 = `                                            handleUpdateField(
                                              i,
                                              col.key,
                                              copy.length > 0
                                                ? JSON.stringify(copy)
                                                : "",
                                            );
                                          }}
                                          title="Delete Option"
                                        >
                                          X
                                        </button>
                                        {onApplySourceToAll && (
                                          <button
                                            type="button"
                                            className="ml-auto text-blue-600 hover:text-blue-800 flex items-center justify-center p-1 rounded hover:bg-blue-50 transition-colors shrink-0"
                                            onClick={() => onApplySourceToAll(activePage, col.key, src.source, src.color)}
                                            title="Apply this source and zero quantity to all rows"
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
                                          title="Delete Option"
                                        >
                                          X
                                        </button>
                                        {onApplySourceToAll && (
                                          <button
                                            type="button"
                                            className="ml-auto text-blue-600 hover:text-blue-800 flex items-center justify-center p-1 rounded hover:bg-blue-50 transition-colors shrink-0"
                                            onClick={() => onApplySourceToAll(activePage, col.key, src.source, src.color)}
                                            title="Apply this source and zero quantity to all rows"
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
                                </DragDropContext>
                                </div>`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/components/AddRowModal.tsx', code);
