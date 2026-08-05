with open('src/components/AddRowModal.tsx', 'r') as f:
    lines = f.readlines()

# keep up to line 1161 (index 1161)
lines = lines[:1161]

new_code = """                                        let finalColor = "";
                                        const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
                                        if (newSourceInput.hex && hexRegex.test(newSourceInput.hex.trim())) {
                                          finalColor = newSourceInput.hex.trim().toUpperCase();
                                        } else {
                                          let existingColor = null;
                                          if (allRows) {
                                            for (const r of allRows) {
                                              try {
                                                const relevantCols = columns.filter((c: any) => c.type === 'multi_source' || c.type === 'sale_tracker' || c.key === 'total_qty');
                                                for (const checkCol of relevantCols) {
                                                  const val = r[checkCol.key];
                                                  if (!val) continue;
                                                  const arr = typeof val === 'string' ? JSON.parse(val) : val;
                                                  if (Array.isArray(arr)) {
                                                    const match = arr.find((item: any) => item.source?.trim().toLowerCase() === newSourceInput.source.trim().toLowerCase());
                                                    if (match && match.color) {
                                                      existingColor = match.color;
                                                      break;
                                                    }
                                                  }
                                                }
                                              } catch(e) {}
                                              if (existingColor) break;
                                            }
                                          }
                                          if (existingColor) {
                                            finalColor = existingColor;
                                          } else {
                                            finalColor = generateUniqueSourceColor(collectUsedSourceColors(allRows || [], columns));
                                          }
                                        }
                                        const newColor = finalColor;
                                        const updated = [
                                          ...currentSources,
                                          {
                                            source: newSourceInput.source,
                                            qty:
                                              parseFloat(newSourceInput.qty) ||
                                              0,
                                            color: newColor,
                                          },
                                        ];
                                        handleUpdateField(
                                          i,
                                          col.key,
                                          JSON.stringify(updated),
                                        );
                                        setNewSourceInputs({
                                          ...newSourceInputs,
                                          [i]: { source: "", qty: "" },
                                        });
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
              <Button onClick={onClose} variant="secondary">Cancel</Button>
              <Button onClick={() => {
                if (allRows && allRows[editingRowIndex] && onSave) {
                  onSave(allRows[editingRowIndex]);
                }
              }} variant="primary">Save Changes</Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
);
"""

with open('src/components/AddRowModal.tsx', 'w') as f:
    f.writelines(lines)
    f.write(new_code)
