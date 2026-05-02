import { useState } from 'react';
import { Plus, Edit2, Trash2, Tag, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { CategoryIcon } from '../../../shared/components/ui/CategoryIcon';
import { CategoryForm } from './CategoryForm';
import { Category } from '../../../shared/types';

export function CategoriesPage() {
  const { state, actions } = useAppContext();
  const { categories, transactions } = state;
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | undefined>();
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [defaultType, setDefaultType] = useState<'income' | 'expense' | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Get parent categories (no parentId)
  const allParents = categories.filter((c) => !c.parentId);
  const filteredParents = filterType === 'all'
    ? allParents
    : allParents.filter((c) => c.type === filterType);

  const expenseParents = filteredParents.filter((c) => c.type === 'expense');
  const incomeParents = filteredParents.filter((c) => c.type === 'income');

  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId);

  const getCategoryUsageCount = (categoryId: string) => {
    // Count transactions using this category OR any of its subcategories
    const childIds = getSubcategories(categoryId).map((c) => c.id);
    return transactions.filter(
      (t) => t.categoryId === categoryId || childIds.includes(t.categoryId)
    ).length;
  };

  const getDirectUsageCount = (categoryId: string) =>
    transactions.filter((t) => t.categoryId === categoryId).length;

  const toggleExpand = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const handleEdit = (category: Category) => {
    if (!category.isCustom) return;
    setEditCategory(category);
    setDefaultParentId(category.parentId);
    setShowForm(true);
  };

  const handleAddSubcategory = (parent: Category) => {
    setEditCategory(undefined);
    setDefaultParentId(parent.id);
    setDefaultType(parent.type);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      const children = getSubcategories(deleteTarget.id);
      children.forEach((child) => {
        if (child.isCustom) {
          actions.deleteCategory(child.id);
        }
      });
      actions.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const renderSubcategory = (sub: Category) => {
    const usageCount = getDirectUsageCount(sub.id);
    return (
      <div
        key={sub.id}
        className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 ml-6 border-l-2"
        style={{ borderLeftColor: sub.color }}
      >
        <CategoryIcon icon={sub.icon} color={sub.color} size={14} className="!p-1.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 truncate">{sub.name}</p>
          <p className="text-[10px] text-gray-400">
            {usageCount} txn{usageCount !== 1 ? 's' : ''}
            {sub.isCustom && (
              <span className="ml-1.5 text-primary-600">Custom</span>
            )}
          </p>
        </div>
        {sub.isCustom && (
          <div className="flex gap-0.5">
            <button
              onClick={() => handleEdit(sub)}
              className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => setDeleteTarget(sub)}
              className="rounded p-1 text-gray-400 hover:bg-danger-50 hover:text-danger-600"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderParentCard = (category: Category) => {
    const subcats = getSubcategories(category.id);
    const totalUsage = getCategoryUsageCount(category.id);
    const isExpanded = expandedParents.has(category.id);

    return (
      <div key={category.id} className="space-y-1">
        <div
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
          onClick={() => subcats.length > 0 && toggleExpand(category.id)}
        >
          {/* Expand/Collapse arrow */}
          <div className="w-5 flex items-center justify-center">
            {subcats.length > 0 ? (
              isExpanded ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )
            ) : null}
          </div>

          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <CategoryIcon icon={category.icon} color={category.color} size={20} className="!p-0 !bg-transparent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{category.name}</p>
            <p className="text-xs text-gray-500">
              {totalUsage} transaction{totalUsage !== 1 ? 's' : ''}
              {subcats.length > 0 && ` · ${subcats.length} subcategories`}
              {category.isCustom && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                  Custom
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleAddSubcategory(category)}
              className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
              title="Add subcategory"
            >
              <Plus size={14} />
            </button>
            {category.isCustom && (
              <>
                <button
                  onClick={() => handleEdit(category)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Edit category"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(category)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"
                  title="Delete category"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subcategories */}
        {isExpanded && subcats.length > 0 && (
          <div className="space-y-1 pb-2">
            {subcats.map(renderSubcategory)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">
            Manage your income &amp; expense categories and subcategories
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            setEditCategory(undefined);
            setDefaultParentId(undefined);
            setDefaultType(undefined);
            setShowForm(true);
          }}
        >
          Add Category
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 max-w-sm">
        {(['all', 'expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              filterType === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'all' ? 'All' : t === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      {filteredParents.length === 0 ? (
        <EmptyState
          icon={<Tag size={40} />}
          title="No categories found"
          description="Add custom categories to organize your transactions"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
              Add Category
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Expense Categories */}
          {(filterType === 'all' || filterType === 'expense') && expenseParents.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-danger-600">
                  <span className="h-2 w-2 rounded-full bg-danger-500" />
                  Expense Categories ({expenseParents.length})
                </h2>
                <button
                  onClick={() => {
                    const allIds = expenseParents.map((c) => c.id);
                    const allExpanded = allIds.every((id) => expandedParents.has(id));
                    setExpandedParents((prev) => {
                      const next = new Set(prev);
                      allIds.forEach((id) => allExpanded ? next.delete(id) : next.add(id));
                      return next;
                    });
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {expenseParents.every((c) => expandedParents.has(c.id)) ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              <div className="space-y-2">
                {expenseParents.map(renderParentCard)}
              </div>
            </div>
          )}

          {/* Income Categories */}
          {(filterType === 'all' || filterType === 'income') && incomeParents.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-success-600">
                  <span className="h-2 w-2 rounded-full bg-success-500" />
                  Income Categories ({incomeParents.length})
                </h2>
                <button
                  onClick={() => {
                    const allIds = incomeParents.map((c) => c.id);
                    const allExpanded = allIds.every((id) => expandedParents.has(id));
                    setExpandedParents((prev) => {
                      const next = new Set(prev);
                      allIds.forEach((id) => allExpanded ? next.delete(id) : next.add(id));
                      return next;
                    });
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {incomeParents.every((c) => expandedParents.has(c.id)) ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              <div className="space-y-2">
                {incomeParents.map(renderParentCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditCategory(undefined);
          setDefaultParentId(undefined);
          setDefaultType(undefined);
        }}
        title={editCategory ? 'Edit Category' : defaultParentId ? 'Add Subcategory' : 'Add Category'}
      >
        <CategoryForm
          editCategory={editCategory}
          defaultType={defaultType}
          defaultParentId={defaultParentId}
          onClose={() => {
            setShowForm(false);
            setEditCategory(undefined);
            setDefaultParentId(undefined);
            setDefaultType(undefined);
          }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
        size="sm"
      >
        {deleteTarget && (
          <>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {!deleteTarget.parentId && getSubcategories(deleteTarget.id).filter((c) => c.isCustom).length > 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠ This will also delete {getSubcategories(deleteTarget.id).filter((c) => c.isCustom).length} custom subcategorie(s).
              </p>
            )}
            {getCategoryUsageCount(deleteTarget.id) > 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠ This category is used in {getCategoryUsageCount(deleteTarget.id)} transaction(s).
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
