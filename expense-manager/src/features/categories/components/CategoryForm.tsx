import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { Category } from '../../../shared/types';
import { CATEGORY_ICON_OPTIONS, CATEGORY_COLORS } from '../../../shared/constants/categories';
import { CategoryIcon } from '../../../shared/components/ui/CategoryIcon';

interface CategoryFormProps {
  editCategory?: Category;
  defaultType?: 'income' | 'expense';
  onClose: () => void;
}

export function CategoryForm({ editCategory, defaultType, onClose }: CategoryFormProps) {
  const { dispatch } = useAppContext();
  const isEditing = !!editCategory;

  const [name, setName] = useState(editCategory?.name || '');
  const [type, setType] = useState<'income' | 'expense'>(editCategory?.type || defaultType || 'expense');
  const [icon, setIcon] = useState(editCategory?.icon || CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState(editCategory?.color || CATEGORY_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Category name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && editCategory) {
      dispatch({
        type: 'UPDATE_CATEGORY',
        payload: {
          id: editCategory.id,
          updates: { name: name.trim(), type, icon, color },
        },
      });
    } else {
      const category: Category = {
        id: uuidv4(),
        name: name.trim(),
        type,
        icon,
        color,
        isCustom: true,
      };
      dispatch({ type: 'ADD_CATEGORY', payload: category });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Category Type */}
      <Select
        label="Category Type"
        value={type}
        onChange={(e) => setType(e.target.value as 'income' | 'expense')}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />

      {/* Category Name */}
      <Input
        label="Category Name"
        placeholder="e.g., Gym, Pet Care, Charity..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      {/* Icon Selection */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Icon</label>
        <div className="grid grid-cols-10 gap-1.5 max-h-36 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {CATEGORY_ICON_OPTIONS.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => setIcon(iconName)}
              className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                icon === iconName
                  ? 'bg-primary-100 ring-2 ring-primary-500'
                  : 'hover:bg-gray-100'
              }`}
              title={iconName}
            >
              <CategoryIcon icon={iconName} color={icon === iconName ? color : '#6b7280'} size={18} />
            </button>
          ))}
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <CategoryIcon icon={icon} color={color} size={16} />
          </div>
          <span className="text-sm font-medium text-gray-900">{name || 'Category Name'}</span>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            type === 'income' ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
          }`}>
            {type}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Update Category' : 'Add Category'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
