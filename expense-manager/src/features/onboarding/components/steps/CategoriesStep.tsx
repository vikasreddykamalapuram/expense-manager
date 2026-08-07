import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAppContext } from '../../../../context/AppContext';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { CategoryForm } from '../../../categories/components/CategoryForm';
import { CategoryIcon } from '../../../../shared/components/ui/CategoryIcon';
import { Category } from '../../../../shared/types';

/** Onboarding step: review default categories and create custom categories / subcategories. */
export function CategoriesStep() {
  const { state } = useAppContext();
  const { categories } = state;
  const [showForm, setShowForm] = useState(false);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

  const parents = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );
  const subsByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((c) => {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    });
    return map;
  }, [categories]);

  const openAddCategory = (type: 'income' | 'expense') => {
    setDefaultType(type);
    setDefaultParentId(undefined);
    setShowForm(true);
  };
  const openAddSub = (parent: Category) => {
    setDefaultType(parent.type);
    setDefaultParentId(parent.id);
    setShowForm(true);
  };

  const renderGroup = (type: 'income' | 'expense') => {
    const groupParents = parents.filter((p) => p.type === type);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">{type} categories</h3>
          <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={() => openAddCategory(type)}>
            Add
          </Button>
        </div>
        <div className="space-y-1.5">
          {groupParents.map((cat) => {
            const subs = subsByParent.get(cat.id) || [];
            return (
              <div key={cat.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5">
                <div className="flex items-center gap-2">
                  <CategoryIcon icon={cat.icon} color={cat.color} size={16} className="!p-1.5" />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                  {cat.isCustom && (
                    <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600">custom</span>
                  )}
                  <button
                    type="button"
                    onClick={() => openAddSub(cat)}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-700"
                    aria-label={`Add subcategory to ${cat.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {subs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-8">
                    {subs.map((s) => (
                      <span key={s.id} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Set up categories</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          We've added common categories to get you going. Add your own, or tap
          <span className="mx-1 inline-flex"><Plus size={13} /></span>
          on any category to create a subcategory.
        </p>
      </div>

      {renderGroup('expense')}
      {renderGroup('income')}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={defaultParentId ? 'Add subcategory' : 'Add category'}
        size="md"
      >
        <CategoryForm
          defaultType={defaultType}
          defaultParentId={defaultParentId}
          onClose={() => setShowForm(false)}
          onCreated={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
