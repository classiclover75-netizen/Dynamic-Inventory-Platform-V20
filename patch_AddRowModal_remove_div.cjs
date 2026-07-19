const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');
code = code.replace(
`                                  </Droppable>
                                </DragDropContext>
                                </div>
                                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full box-border pt-2 border-t border-purple-200 mt-auto">`,
`                                  </Droppable>
                                </DragDropContext>
                                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full box-border pt-2 border-t border-purple-200 mt-auto">`
);
fs.writeFileSync('src/components/AddRowModal.tsx', code);
