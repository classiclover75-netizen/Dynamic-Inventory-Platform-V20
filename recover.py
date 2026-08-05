import os

with open('src/components/AddRowModal.tsx', 'r') as f:
    data = f.read()

# We know data = replace2 + c1 + replace2 + c2 + ...
# Let's find the exact length of replace2.
# replace2 is the string we inserted. I can get it from my patch script.
replace2 = """                                        let finalColor = "";
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
                                              } catch(e) {} // ignore parsing errors for flat values
                                              if (existingColor) break;
                                            }
                                          }
                                          if (existingColor) {
                                            finalColor = existingColor;
                                          } else {
                                            finalColor = generateUniqueSourceColor(collectUsedSourceColors(allRows || [], columns));
                                          }
                                        }
                                        const newColor = finalColor;"""

L = len(replace2)

# Verify
if data[:L] == replace2:
    print("Match found!")
    # Recover characters
    # There's a char at L, then replace2 at L+1 to L+1+L, char at L+1+L...
    # So indices of chars are L, 2L+1, 3L+2, etc.
    recovered = []
    i = L
    while i < len(data):
        recovered.append(data[i])
        i += L + 1
    
    orig = "".join(recovered)
    with open('src/components/AddRowModal.tsx', 'w') as f:
        f.write(orig)
    print("Recovered file size:", len(orig))
else:
    print("Replace2 doesn't match start of file!")
    print(repr(data[:L]))
