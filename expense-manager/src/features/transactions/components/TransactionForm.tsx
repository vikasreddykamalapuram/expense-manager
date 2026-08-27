import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Lightbulb } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { Modal } from '../../../shared/components/ui/Modal';
import { CategoryForm } from '../../categories/components/CategoryForm';
import { AccountForm } from '../../accounts/components/AccountForm';
import { ReceiptCapture } from '../../../shared/components/ReceiptCapture';
import { receiptService } from '../../../shared/services/receiptService';
import { PAYMENT_METHODS } from '../../../shared/constants/accounts';
import { getToday, classNames } from '../../../shared/utils/helpers';
import { Transaction, Account, PaymentMethod } from '../../../shared/types';
import { suggestCategories, type CategorySuggestion } from '../../../shared/services/autoCategorize';
import { haptic } from '../../../shared/services/haptics';

/** Add whole months to a YYYY-MM-DD string using local date math (no timezone shift). */
function addMonthsToISODate(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

interface TransactionFormProps {
  editTransaction?: Transaction;
  initialType?: 'income' | 'expense' | 'transfer';
  prefillAmount?: string;
  prefillNote?: string;
  prefillDate?: string;
  prefillPaymentMethod?: PaymentMethod;
  /** Category/account resolved upstream (e.g. by voice input). */
  prefillCategoryId?: string;
  prefillAccountId?: string;
  prefillToAccountId?: string;
  /** Receipt image to attach once the transaction has an id (e.g. from a scan). */
  prefillReceiptFile?: File | null;
  onClose?: () => void;
}

export function TransactionForm({
  editTransaction,
  initialType,
  prefillAmount,
  prefillNote,
  prefillDate,
  prefillPaymentMethod,
  prefillCategoryId,
  prefillAccountId,
  prefillToAccountId,
  prefillReceiptFile,
  onClose,
}: TransactionFormProps) {
  const { state, actions } = useAppContext();
  const navigate = useNavigate();
  const isEditing = !!editTransaction;
  const { accounts, categories } = state;

  // Prefills arrive in a URL, so they are untrusted. Drop any id that does not
  // resolve — a dangling id would pass validation and save a transaction
  // pointing at a category or account that does not exist.
  const seedCategoryId = categories.some((c) => c.id === prefillCategoryId) ? prefillCategoryId : undefined;
  const seedAccountId = accounts.some((a) => a.id === prefillAccountId) ? prefillAccountId : undefined;
  const seedToAccountId = accounts.some((a) => a.id === prefillToAccountId) ? prefillToAccountId : undefined;

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(editTransaction?.type || initialType || 'expense');
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || prefillAmount || '');
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || seedCategoryId || '');
  const [date, setDate] = useState(editTransaction?.date || prefillDate || getToday());
  const [notes, setNotes] = useState(editTransaction?.notes || prefillNote || '');
  const [accountId, setAccountId] = useState(editTransaction?.accountId || seedAccountId || '');
  const [toAccountId, setToAccountId] = useState(editTransaction?.toAccountId || seedToAccountId || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(
    editTransaction?.paymentMethod || prefillPaymentMethod || ''
  );
  const [isRecurring, setIsRecurring] = useState(editTransaction?.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState(
    editTransaction?.recurringFrequency || 'monthly'
  );
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('3');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | undefined>();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountFormTarget, setAccountFormTarget] = useState<'source' | 'destination'>('source');
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(prefillReceiptFile ?? null);
  const [receiptId, setReceiptId] = useState<string | undefined>(editTransaction?.receiptId);
  const pendingReceiptRef = useRef<File | null>(prefillReceiptFile ?? null);

  // Auto-categorization state
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  // A prefilled category counts as a deliberate choice: without this the
  // auto-categoriser would fire on the prefilled note and overwrite it.
  const [userPickedCategory, setUserPickedCategory] = useState(!!editTransaction?.categoryId || !!seedCategoryId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSuggestions = useCallback(
    (currentNotes: string, currentAmount: string, currentType: 'income' | 'expense' | 'transfer', currentDate: string) => {
      if (currentType === 'transfer') {
        setSuggestions([]);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const amt = parseFloat(currentAmount) || 0;
        const results = suggestCategories(
          currentNotes, amt, currentType, currentDate,
          state.transactions, categories,
        );
        setSuggestions(results);

        // Auto-select high-confidence suggestion if user hasn't picked a category
        if (!userPickedCategory && results.length > 0 && results[0].confidence > 85) {
          setCategoryId(results[0].categoryId);
        }
      }, 300);
    },
    [state.transactions, categories, userPickedCategory],
  );

  // Trigger suggestions when notes or amount change
  useEffect(() => {
    if (!isEditing) {
      triggerSuggestions(notes, amount, type, date);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [notes, amount, type, date, triggerSuggestions, isEditing]);

  const handleSuggestionClick = useCallback((suggestion: CategorySuggestion) => {
    setCategoryId(suggestion.categoryId);
    setUserPickedCategory(true);
  }, []);

  // Two-level category picker: parent categories + subcategories
  const parentCategories = type === 'transfer'
    ? []
    : categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense') && !c.parentId);

  // Determine selected parent from categoryId
  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedParentId = selectedCat?.parentId || (selectedCat && !selectedCat.parentId ? selectedCat.id : '');

  const subcategories = selectedParentId
    ? categories.filter((c) => c.parentId === selectedParentId)
    : [];

  const activeAccounts = accounts.filter((a) => a.isActive);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (type !== 'transfer' && !categoryId) newErrors.categoryId = 'Please select a category';
    if (!date) newErrors.date = 'Please select a date';
    if (type === 'transfer') {
      if (!accountId) newErrors.accountId = 'Select source account';
      if (!toAccountId) newErrors.toAccountId = 'Select destination account';
      if (accountId && toAccountId && accountId === toAccountId) {
        newErrors.toAccountId = 'Source and destination must be different';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { haptic.error(); return; }

    const now = new Date().toISOString();

    // Installment plan: generate N linked monthly transactions instead of one.
    if (isInstallment && !isEditing && type !== 'transfer') {
      const groupId = uuidv4();
      const total = parseFloat(amount);
      const n = Math.min(120, Math.max(2, parseInt(installmentCount, 10) || 2));
      const per = Math.round((total / n) * 100) / 100;
      let allocated = 0;
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        const instAmount = isLast ? Math.round((total - allocated) * 100) / 100 : per;
        if (!isLast) allocated += per;
        actions.addTransaction({
          id: uuidv4(),
          type,
          amount: instAmount,
          categoryId,
          date: addMonthsToISODate(date, i),
          notes: notes ? `${notes} (${i + 1}/${n})` : `Installment ${i + 1}/${n}`,
          accountId: accountId || undefined,
          paymentMethod: paymentMethod || undefined,
          isRecurring: false,
          installmentGroupId: groupId,
          installmentNumber: i + 1,
          installmentCount: n,
          createdAt: now,
          updatedAt: now,
        });
      }
      haptic.success();
      if (onClose) onClose(); else navigate('/transactions');
      return;
    }

    const txId = isEditing && editTransaction ? editTransaction.id : uuidv4();
    const txData = {
      type,
      amount: parseFloat(amount),
      categoryId: type === 'transfer' ? 'transfer' : categoryId,
      date,
      notes,
      accountId: accountId || undefined,
      toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
      paymentMethod: paymentMethod || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency as Transaction['recurringFrequency'] : undefined,
      receiptId,
    };

    if (isEditing && editTransaction) {
      actions.updateTransaction(editTransaction.id, txData);
    } else {
      actions.addTransaction({ id: txId, ...txData, createdAt: now, updatedAt: now });
    }
    haptic.success();

    // Save pending receipt file after transaction is persisted
    const fileToSave = pendingReceiptRef.current;
    if (fileToSave) {
      try {
        const newReceiptId = await receiptService.saveReceipt(state.activeProfileId, txId, fileToSave);
        actions.updateTransaction(txId, { receiptId: newReceiptId });
      } catch {
        // Receipt save failed but transaction was saved — acceptable
      }
    }

    if (onClose) {
      onClose();
    } else {
      navigate('/transactions');
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type Toggle */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
        <button
          type="button"
          onClick={() => { setType('expense'); setCategoryId(''); setUserPickedCategory(false); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'expense'
              ? 'bg-danger-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <ArrowUpCircle size={16} />
          Expense
        </button>
        <button
          type="button"
          onClick={() => { setType('income'); setCategoryId(''); setUserPickedCategory(false); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'income'
              ? 'bg-success-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <ArrowDownCircle size={16} />
          Income
        </button>
        <button
          type="button"
          onClick={() => { setType('transfer'); setCategoryId(''); setUserPickedCategory(false); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'transfer'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <ArrowLeftRight size={16} />
          Transfer
        </button>
      </div>

      {/* Amount */}
      <Input
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
        className="text-2xl font-bold"
      />

      {/* Account Selection */}
      <div className={type === 'transfer' ? 'grid grid-cols-2 gap-4' : ''}>
        <Select
          label={type === 'transfer' ? 'From Account' : type === 'income' ? 'Credit To' : 'Debit From'}
          value={accountId}
          onChange={(e) => {
            if (e.target.value === '__new__') {
              setAccountFormTarget('source');
              setShowAccountForm(true);
              return;
            }
            setAccountId(e.target.value);
          }}
          error={errors.accountId}
          options={[
            { value: '', label: type === 'transfer' ? 'Select source...' : 'Select account (optional)...' },
            ...activeAccounts.map((a) => ({
              value: a.id,
              label: `${a.name}${a.institution ? ` (${a.institution})` : ''}`,
            })),
            { value: '__new__', label: '＋ Add Account...' },
          ]}
        />
        {type === 'transfer' && (
          <Select
            label="To Account"
            value={toAccountId}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setAccountFormTarget('destination');
                setShowAccountForm(true);
                return;
              }
              setToAccountId(e.target.value);
            }}
            error={errors.toAccountId}
            options={[
              { value: '', label: 'Select destination...' },
              ...activeAccounts
                .filter((a) => a.id !== accountId)
                .map((a) => ({
                  value: a.id,
                  label: `${a.name}${a.institution ? ` (${a.institution})` : ''}`,
                })),
              { value: '__new__', label: '＋ Add Account...' },
            ]}
          />
        )}
      </div>

      {/* Category (not for transfers) — Two-level picker */}
      {type !== 'transfer' && (
        <div className="space-y-3">
          <div>
            <Select
              label="Category"
              value={selectedParentId}
              onChange={(e) => {
                const pid = e.target.value;
                if (pid === '__new__') {
                  setNewCategoryParentId(undefined);
                  setShowCategoryForm(true);
                  return;
                }
                setCategoryId(pid);
                setUserPickedCategory(true);
              }}
              error={errors.categoryId}
              options={[
                { value: '', label: 'Select a category...' },
                ...parentCategories.map((c) => ({ value: c.id, label: c.name })),
                { value: '__new__', label: '＋ Create New Category...' },
              ]}
            />
          </div>
          {subcategories.length > 0 && (
            <div>
              <Select
                label="Subcategory"
                value={selectedCat?.parentId ? categoryId : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new_sub__') {
                    setNewCategoryParentId(selectedParentId);
                    setShowCategoryForm(true);
                    return;
                  }
                  setCategoryId(val || selectedParentId);
                  setUserPickedCategory(true);
                }}
                options={[
                  { value: '', label: `General ${categories.find((c) => c.id === selectedParentId)?.name || ''}` },
                  ...subcategories.map((c) => ({ value: c.id, label: c.name })),
                  { value: '__new_sub__', label: '＋ Add Subcategory...' },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* Payment Method */}
      <Select
        label="Payment Method"
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        options={[
          { value: '', label: 'Select payment method (optional)...' },
          ...PAYMENT_METHODS.map((pm) => ({ value: pm.value, label: pm.label })),
        ]}
      />

      {/* Date */}
      <Input
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={errors.date}
      />

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder={type === 'transfer' ? 'e.g., CC bill payment, EMI...' : 'Add a description...'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {/* Auto-categorization suggestion chips */}
        {suggestions.length > 0 && type !== 'transfer' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Lightbulb size={12} className="text-amber-500" />
              Suggested:
            </span>
            {suggestions.map((s) => {
              const cat = categories.find((c) => c.id === s.categoryId);
              const isSelected = categoryId === s.categoryId;
              return (
                <button
                  key={s.categoryId}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  title={s.reason}
                  className={classNames(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-1 ring-primary-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20',
                  )}
                >
                  {cat?.icon && <span className="text-xs">{cat.icon.length <= 2 ? cat.icon : '📂'}</span>}
                  {s.categoryName}
                  <span className="text-[10px] opacity-70">({s.confidence}%)</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Receipt */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Receipt (optional)
        </label>
        {isEditing && editTransaction ? (
          <ReceiptCapture
            transactionId={editTransaction.id}
            receiptId={receiptId}
            onReceiptSaved={(newId) => {
              setReceiptId(newId);
              actions.updateTransaction(editTransaction.id, { receiptId: newId });
            }}
            onReceiptDeleted={() => {
              setReceiptId(undefined);
              actions.updateTransaction(editTransaction.id, { receiptId: undefined });
            }}
          />
        ) : (
          // No transaction id yet, so the file is held here and saved after the
          // insert. Defer mode keeps the same camera/gallery UI without writing
          // a blob that nothing could ever reference.
          <ReceiptCapture
            deferSave
            pendingFile={pendingReceiptFile}
            onFileSelected={(file) => {
              setPendingReceiptFile(file);
              pendingReceiptRef.current = file;
            }}
          />
        )}
      </div>

      {/* Recurring */}
      {type !== 'transfer' && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => { setIsRecurring(e.target.checked); if (e.target.checked) setIsInstallment(false); }}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring transaction</span>
          </label>
          {isRecurring && (
            <Select
              value={recurringFrequency}
              onChange={(e) => setRecurringFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
              className="w-32"
            />
          )}
        </div>
      )}

      {/* Installments */}
      {type !== 'transfer' && !isEditing && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isInstallment}
              onChange={(e) => { setIsInstallment(e.target.checked); if (e.target.checked) setIsRecurring(false); }}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Split into installments</span>
          </label>
          {isInstallment && (
            <div className="flex items-end gap-3 pl-6">
              <Input
                label="Months"
                type="number"
                min="2"
                max="120"
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
                className="w-24"
              />
              {parseFloat(amount) > 0 && parseInt(installmentCount, 10) >= 2 && (
                <p className="pb-2 text-xs text-gray-500 dark:text-gray-400">
                  {installmentCount} monthly payments of{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {state.settings.currencySymbol}{(parseFloat(amount) / parseInt(installmentCount, 10)).toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Update Transaction' : type === 'transfer' ? 'Transfer' : 'Add Transaction'}
        </Button>
        {onClose && (
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </form>

    {/* Inline Category Creation Modal — outside form to prevent submit bubbling */}
    <Modal
      isOpen={showCategoryForm}
      onClose={() => setShowCategoryForm(false)}
      title={newCategoryParentId ? 'New Subcategory' : 'New Category'}
    >
      <CategoryForm
        defaultType={type === 'income' ? 'income' : 'expense'}
        defaultParentId={newCategoryParentId}
        onClose={() => setShowCategoryForm(false)}
        onCreated={(newCatId) => {
          setCategoryId(newCatId);
          setShowCategoryForm(false);
        }}
      />
    </Modal>

    {/* Inline Account Creation Modal — outside form to prevent submit bubbling */}
    <Modal
      isOpen={showAccountForm}
      onClose={() => setShowAccountForm(false)}
      title="New Account"
    >
      <AccountForm
        onClose={() => setShowAccountForm(false)}
        onCreated={(account: Account) => {
          if (accountFormTarget === 'destination') {
            setToAccountId(account.id);
          } else {
            setAccountId(account.id);
          }
          setShowAccountForm(false);
        }}
      />
    </Modal>
    </>
  );
}
