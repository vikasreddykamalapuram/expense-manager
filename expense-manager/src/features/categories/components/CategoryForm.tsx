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
  defaultParentId?: string;
  onClose: () => void;
  onCreated?: (categoryId: string) => void;
}

export function CategoryForm({ editCategory, defaultType, defaultParentId, onClose, onCreated }: CategoryFormProps) {
  const { state, actions } = useAppContext();
  const { categories } = state;
  const isEditing = !!editCategory;

  const [name, setName] = useState(editCategory?.name || '');
  const [type, setType] = useState<'income' | 'expense'>(editCategory?.type || defaultType || 'expense');
  const [parentId, setParentId] = useState(editCategory?.parentId || defaultParentId || '');
  const [icon, setIcon] = useState(editCategory?.icon || CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState(editCategory?.color || CATEGORY_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get parent categories of current type (excluding the one being edited)
  const availableParents = categories.filter(
    (c) => c.type === type && !c.parentId && c.id !== editCategory?.id
  );

  // If parentId is set, inherit type and color from parent
  const parentCat = parentId ? categories.find((c) => c.id === parentId) : null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Category name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const effectiveColor = parentCat ? parentCat.color : color;

    if (isEditing && editCategory) {
      await actions.updateCategory(editCategory.id, {
        name: name.trim(),
        type,
        icon,
        color: effectiveColor,
        parentId: parentId || undefined,
      });
    } else {
      const newId = uuidv4();
      const category: Category = {
        id: newId,
        name: name.trim(),
        type,
        icon,
        color: effectiveColor,
        isCustom: true,
        parentId: parentId || undefined,
      };
      await actions.addCategory(category);
      if (onCreated) {
        onCreated(newId);
        return;
      }
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Category Type */}
      {!defaultParentId && (
        <Select
          label="Category Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as 'income' | 'expense');
            setParentId('');
          }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
      )}

      {/* Parent Category (optional — makes this a subcategory) */}
      {availableParents.length > 0 && (
        <Select
          label={defaultParentId ? 'Parent Category' : 'Parent Category (optional — creates a subcategory)'}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          options={[
            ...(defaultParentId ? [] : [{ value: '', label: 'None (top-level category)' }]),
            ...availableParents.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      )}

      {/* Category Name */}
      <Input
        label={parentId ? 'Subcategory Name' : 'Category Name'}
        placeholder={parentId ? 'e.g., Medical, Shopping, Food...' : 'e.g., Gym, Pet Care, Charity...'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      {/* Icon Selection */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Icon</label>
        <div className="grid grid-cols-10 gap-1.5 max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2">
          {CATEGORY_ICON_OPTIONS.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => setIcon(iconName)}
              className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                icon === iconName
                  ? 'bg-primary-100 ring-2 ring-primary-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title={iconName}
            >
              <CategoryIcon icon={iconName} color={icon === iconName ? (parentCat?.color || color) : '#6b7280'} size={18} className="!p-0 !bg-transparent" />
            </button>
          ))}
        </div>
      </div>

      {/* Color Selection (only for top-level categories) */}
      {!parentId && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-all ${
                  color === c ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-primary-500 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      {parentId && parentCat && (
        <p className="text-xs text-gray-400 dark:text-gray-500">Color inherited from parent: {parentCat.name}</p>
      )}

      {/* Preview */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${parentCat?.color || color}20` }}
          >
            <CategoryIcon icon={icon} color={parentCat?.color || color} size={16} className="!p-0 !bg-transparent" />
          </div>
          <div>
            {parentCat && <span className="text-xs text-gray-400 dark:text-gray-500">{parentCat.name} › </span>}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{name || 'Category Name'}</span>
          </div>
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
          {isEditing ? 'Update' : parentId ? 'Add Subcategory' : 'Add Category'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
