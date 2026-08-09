import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Check } from 'lucide-react';
import { useAppContext } from '../../../../context/AppContext';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { CategoryForm } from '../../../categories/components/CategoryForm';
import { CategoryIcon } from '../../../../shared/components/ui/CategoryIcon';
import { Category } from '../../../../shared/types';
import { SUGGESTED_CATEGORIES } from '../../../../shared/constants/onboardingSuggestions';

/** Onboarding step: review default categories and create custom categories / subcategories. */
export function CategoriesStep() {
  const { state, actions } = useAppContext();
  const { categories } = state;
  const [showForm, setShowForm] = useState(false);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

  const exists = (name: string, parentId?: string) =>
    categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && (c.parentId || '') === (parentId || '')
    );

  const availableSuggestions = useMemo(
    () => SUGGESTED_CATEGORIES.filter((s) => !exists(s.name, s.parentId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories]
  );

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(SUGGESTED_CATEGORIES.filter((s) => s.defaultChecked).map((s) => s.key))
  );
  const [addingSuggested, setAddingSuggested] = useState(false);

  const toggleSuggestion = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const addSuggested = async () => {
    setAddingSuggested(true);
    const now = new Date().toISOString();
    for (const s of availableSuggestions) {
      if (!picked.has(s.key)) continue;
      await actions.addCategory({
        id: uuidv4(),
        name: s.name,
        type: s.type,
        icon: s.icon,
        color: s.color,
        isCustom: true,
        parentId: s.parentId,
        createdAt: now,
        updatedAt: now,
      });
    }
    setAddingSuggested(false);
  };


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

      {/* Suggested categories & subcategories — curated popular extras */}
      {availableSuggestions.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Suggested for you</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Popular categories — tap to include, then add.</p>
            </div>
            <Button
              size="sm"
              disabled={picked.size === 0 || addingSuggested}
              onClick={addSuggested}
            >
              {addingSuggested ? 'Adding…' : 'Add selected'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((s) => {
              const on = picked.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSuggestion(s.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    on
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {on && <Check size={12} />}
                  {s.name}
                  {s.parentId && <span className="text-gray-400">· sub</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
