import React from 'react';
import { Button, Input } from './ui';
import { Trash2, Plus } from 'lucide-react';

interface DropdownOptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

export const DropdownOptionsEditor: React.FC<DropdownOptionsEditorProps> = ({
  options = [],
  onChange
}) => {
  const handleAddOption = () => {
    onChange([...options, '']);
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    onChange(newOptions);
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <label className="block text-xs font-bold text-gray-600 mb-2">Dropdown Options</label>
      <div className="space-y-2 mb-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt}
              onChange={e => handleUpdateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1"
            />
            <Button variant="red" onClick={() => handleRemoveOption(i)} className="px-2 py-1">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" onClick={handleAddOption} className="w-full text-xs py-1.5 flex justify-center items-center gap-1 border-dashed">
        <Plus size={14} /> Add option
      </Button>
    </div>
  );
};
