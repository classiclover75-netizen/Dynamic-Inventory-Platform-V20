const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');
code = code.replace(
`                                        {currentSources.map((src: any, idx: number) => (
                                          <Draggable key={\`\${i}-\${col.key}-\${idx}\`} draggableId={\`\${i}-\${col.key}-\${idx}\`} index={idx}>`,
`                                        {currentSources.map((src: any, idx: number) => (
                                          // @ts-ignore
                                          <Draggable key={\`\${i}-\${col.key}-\${idx}\`} draggableId={\`\${i}-\${col.key}-\${idx}\`} index={idx}>`
);
fs.writeFileSync('src/components/AddRowModal.tsx', code);
