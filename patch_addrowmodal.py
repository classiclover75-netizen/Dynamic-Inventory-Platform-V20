import re

with open('src/components/AddRowModal.tsx', 'r') as f:
    code = f.read()

import_statement = "import { generateUniqueSourceColor, collectUsedSourceColors, getSourceChipStyle } from '../lib/sourceColorUtils';\n"
if "generateUniqueSourceColor" not in code:
    last_import_index = code.rfind('import ')
    end_of_last_import = code.find('\n', last_import_index) + 1
    code = code[:end_of_last_import] + import_statement + code[end_of_last_import:]

search = r"""                                  <Input
                                    type="number"
                                    onWheel=\{\(e\) => e\.currentTarget\.blur\(\)\}
                                    placeholder="Qty"
                                    className="w-\[70px\] shrink-0 h-8 text-\[14px\] px-1 \[appearance:textfield\] \[&::-webkit-outer-spin-button\]:appearance-none \[&::-webkit-inner-spin-button\]:appearance-none"
                                    value=\{newSourceInput\.qty\}
                                    onChange=\{\(e\) =>
                                      setNewSourceInputs\(\{
                                        \.\.\.newSourceInputs,
                                        \[i\]: \{
                                          \.\.\.newSourceInput,
                                          qty: e\.target\.value,
                                        \},
                                      \}\)
                                    \}
                                  />
                                  <Button"""

replace = """                                  <Input
                                    type="number"
                                    onWheel={(e) => e.currentTarget.blur()}
                                    placeholder="Qty"
                                    className="w-[70px] shrink-0 h-8 text-[14px] px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={newSourceInput.qty}
                                    onChange={(e) =>
                                      setNewSourceInputs({
                                        ...newSourceInputs,
                                        [i]: {
                                          ...newSourceInput,
                                          qty: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                  <Input
                                    type="text"
                                    placeholder="Hex"
                                    className="w-[90px] shrink-0 h-8 text-[14px] px-2 font-mono"
                                    value={newSourceInput.hex || ""}
                                    onChange={(e) =>
                                      setNewSourceInputs({
                                        ...newSourceInputs,
                                        [i]: {
                                          ...newSourceInput,
                                          hex: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                  <Button"""

if re.search(search, code):
    code = re.sub(search, replace, code)
    print("SUCCESS 1")
else:
    print("FAILED 1")

search2 = r"""                                        let existingColor = null;
                                        if \(allRows\) \{
                                          for \(const r of allRows\) \{
                                            try \{
                                              const val = r\[col\.key\]; // col\.key is the active column being edited
                                              if \(!val\) continue;
                                              const arr = typeof val === 'string' \? JSON\.parse\(val\) : val;
                                              if \(Array\.isArray\(arr\)\) \{
                                                const match = arr\.find\(\(item: any\) => item\.source\?\.trim\(\)\.toLowerCase\(\) === newSourceInput\.source\.trim\(\)\.toLowerCase\(\)\);
                                                if \(match && match\.color\) \{
                                                  existingColor = match\.color;
                                                  break;
                                                \}
                                              \}
                                            \} catch\(e\) \{\} // ignore parsing errors for flat values
                                          \}
                                        \}
                                        const usedColors = currentSources\.map\(\(item: any\) => item\.color\);
                                        const availableColors = RANDOM_COLORS\.filter\(c => !usedColors\.includes\(c\)\);
                                        const randomColor = availableColors\.length > 0 \? availableColors\[Math\.floor\(Math\.random\(\) \* availableColors\.length\)\] : RANDOM_COLORS\[Math\.floor\(Math\.random\(\) \* RANDOM_COLORS\.length\)\];
                                        const newColor = existingColor || randomColor;"""

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

if re.search(search2, code):
    code = re.sub(search2, replace2, code)
    print("SUCCESS 2")
else:
    print("FAILED 2")

with open('src/components/AddRowModal.tsx', 'w') as f:
    f.write(code)
