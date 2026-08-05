import re

with open('src/components/TableView.tsx', 'r') as f:
    code = f.read()

search = r"""                                                      onClick=\{async \(e\) => \{
                                                        e\.stopPropagation\(\);
                                                        if \(patchRow\) \{
                                                           const newTotalQty = toggleLockInTotalQty\(rawVal, s\.source\);
                                                           await patchRow\(row\.id, "total_qty", newTotalQty\);
                                                        \}
                                                      \}\}"""

replace = """                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newTotalQty = toggleLockInTotalQty(rawVal, s.source);
                                                        handleSaveInlineEdit(activePage!, row.id, "total_qty", newTotalQty);
                                                      }}"""

if re.search(search, code):
    code = re.sub(search, replace, code)
    print("SUCCESS 1")
else:
    print("FAILED 1")

with open('src/components/TableView.tsx', 'w') as f:
    f.write(code)

