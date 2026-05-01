import { useState } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Modal } from '../../../shared/components/ui/Modal';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { CategoryIcon } from '../../../shared/components/ui/CategoryIcon';
import { CategoryForm } from './CategoryForm';
import { Category } from '../../../shared/types';

export function CategoriesPage() {
  const { state, dispatch } = useAppContext();
  const { categories, transactions } = state;
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredCategories = filterType === 'all'
    ? categories
    : categories.filter((c) => c.type === filterType);

  const expenseCategories = filteredCategories.filter((c) => c.type === 'expense');
  const incomeCategories = filteredCategories.filter((c) => c.type === 'income');

  const getCategoryUsageCount = (categoryId: string) =>
    transactions.filter((t) => t.categoryId === categoryId).length;

  const handleEdit = (category: Category) => {
    if (!category.isCustom) return;
    setEditCategory(category);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      dispatch({ type: 'DELETE_CATEGORY', payload: deleteTarget.id });
      setDeleteTarget(null);
    }
  };

  const renderCategoryCard = (category: Category) => {
    const usageCount = getCategoryUsageCount(category.id);
    return (
      <div
        key={category.id}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${category.color}20` }}
        >
          <CategoryIcon icon={category.icon} color={category.color} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{category.name}</p>
          <p className="text-xs text-gray-500">
            {usageCount} transaction{usageCount !== 1 ? 's' : ''}
            {category.isCustom && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                Custom
              </span>
            )}
          </p>
        </div>
        {category.isCustom && (
          <div className="flex gap-1">
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
            Manage your income &amp; expense categories
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setEditCategory(undefined); setShowForm(true); }}>
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

      {filteredCategories.length === 0 ? (
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
          {(filterType === 'all' || filterType === 'expense') && expenseCategories.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-danger-600">
                <span className="h-2 w-2 rounded-full bg-danger-500" />
                Expense Categories ({expenseCategories.length})
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {expenseCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}

          {/* Income Categories */}
          {(filterType === 'all' || filterType === 'income') && incomeCategories.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-success-600">
                <span className="h-2 w-2 rounded-full bg-success-500" />
                Income Categories ({incomeCategories.length})
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {incomeCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditCategory(undefined); }}
        title={editCategory ? 'Edit Category' : 'Add Category'}
      >
        <CategoryForm
          editCategory={editCategory}
          onClose={() => { setShowForm(false); setEditCategory(undefined); }}
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
            {getCategoryUsageCount(deleteTarget.id) > 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠ This category is used in {getCategoryUsageCount(deleteTarget.id)} transaction(s).
                Those transactions will keep their category reference but it won&apos;t appear in the list.
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
