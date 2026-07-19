const fs = require('fs');
let code = fs.readFileSync('src/components/AddRowModal.tsx', 'utf8');
code = code.replace(
  'import { RichDropdownSelect }',
  'import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";\nimport { reorderSources, formatSourceNumber, sortSourcesAZ } from "../lib/multiSourceHelpers";\nimport { GripVertical, ArrowDownAZ } from "lucide-react";\nimport { RichDropdownSelect }'
);
fs.writeFileSync('src/components/AddRowModal.tsx', code);
