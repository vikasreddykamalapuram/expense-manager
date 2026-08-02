import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Delete, Plus } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { CategoryIcon } from '../../../shared/components/ui/CategoryIcon';
import { Modal } from '../../../shared/components/ui/Modal';
import { CategoryForm } from '../../categories/components/CategoryForm';
import { AccountForm } from '../../accounts/components/AccountForm';
import { getToday, classNames } from '../../../shared/utils/helpers';
import { haptic } from '../../../shared/services/haptics';
import type { Account } from '../../../shared/types';

type TxType = 'income' | 'expense' | 'transfer';

/** Evaluate a simple calculator expression left-to-right with + - × ÷ (no eval). */
function evalExpr(expr: string): number {
  const tokens = expr.replace(/×/g, '*').replace(/÷/g, '/').match(/(\d+\.?\d*|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return 0;
  let acc = parseFloat(tokens[0]) || 0;
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const op = tokens[i];
    const next = parseFloat(tokens[i + 1]);
    if (isNaN(next)) break;
    if (op === '+') acc += next;
    else if (op === '-') acc -= next;
    else if (op === '*') acc *= next;
    else if (op === '/') acc = next === 0 ? acc : acc / next;
  }
  return Math.round(acc * 100) / 100;
}

interface QuickAddProps {
  initialType?: TxType;
  prefillAmount?: string;
  prefillNote?: string;
  onClose?: () => void;
}

const TYPE_META: Record<TxType, { label: string; icon: typeof ArrowUpCircle; active: string; text: string }> = {
  expense: { label: 'Expense', icon: ArrowUpCircle, active: 'bg-danger-600 text-white shadow-sm', text: 'text-danger-600' },
  income: { label: 'Income', icon: ArrowDownCircle, active: 'bg-success-600 text-white shadow-sm', text: 'text-success-600' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, active: 'bg-primary-600 text-white shadow-sm', text: 'text-primary-600' },
};

export function QuickAddTransaction({ initialType, prefillAmount, prefillNote, onClose }: QuickAddProps) {
  const { state, actions } = useAppContext();
  const navigate = useNavigate();
  const { categories, accounts, settings } = state;
  const sym = settings.currencySymbol;

  const [type, setType] = useState<TxType>(initialType || 'expense');
  const [expr, setExpr] = useState(prefillAmount || '');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(getToday());
  const [note, setNote] = useState(prefillNote || '');
  const [error, setError] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCatParentId, setNewCatParentId] = useState<string | undefined>(undefined);
  const [showAccountForm, setShowAccountForm] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const parentCategories = useMemo(
    () => (type === 'transfer' ? [] : categories.filter((c) => c.type === type && !c.parentId)),
    [categories, type],
  );
  const selectedCat = categories.find((c) => c.id === categoryId);
  const parentId = selectedCat?.parentId || (selectedCat && !selectedCat.parentId ? selectedCat.id : '');
  const subcategories = parentId ? categories.filter((c) => c.parentId === parentId) : [];
  const amountValue = useMemo(() => evalExpr(expr), [expr]);
  const showExpr = /[+\-×÷]/.test(expr);

  const press = (key: string) => {
    setError('');
    if (key === 'back') { setExpr((e) => e.slice(0, -1)); return; }
    setExpr((e) => {
      const isOp = (c: string) => '+-×÷'.includes(c);
      const last = e.slice(-1);
      if (isOp(key)) {
        if (e === '') return e;              // no leading operator
        if (isOp(last)) return e.slice(0, -1) + key; // replace trailing operator
        return e + key;
      }
      if (key === '.') {
        const seg = e.split(/[+\-×÷]/).pop() || '';
        if (seg.includes('.')) return e;
        return e === '' ? '0.' : e + '.';
      }
      return e + key;
    });
  };

  const changeType = (t: TxType) => { setType(t); setCategoryId(''); setError(''); };

  const handleSave = () => {
    const amt = evalExpr(expr);
    if (!amt || amt <= 0) { setError('Enter an amount'); haptic.error(); return; }
    if (type !== 'transfer' && !categoryId) { setError('Pick a category'); haptic.error(); return; }
    if (type === 'transfer') {
      if (!accountId || !toAccountId) { setError('Pick both accounts'); haptic.error(); return; }
      if (accountId === toAccountId) { setError('Accounts must be different'); haptic.error(); return; }
    }
    const now = new Date().toISOString();
    actions.addTransaction({
      id: uuidv4(),
      type,
      amount: amt,
      categoryId: type === 'transfer' ? 'transfer' : categoryId,
      date,
      notes: note,
      accountId: accountId || undefined,
      toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
      isRecurring: false,
      createdAt: now,
      updatedAt: now,
    });
    haptic.success();
    if (onClose) onClose(); else navigate('/transactions');
  };

  const chipCls = (active: boolean) =>
    classNames(
      'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
      active
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
    );

  const keys: Array<{ label: string; val: string; kind: 'num' | 'op' | 'back' }> = [
    { label: '7', val: '7', kind: 'num' }, { label: '8', val: '8', kind: 'num' }, { label: '9', val: '9', kind: 'num' }, { label: '÷', val: '÷', kind: 'op' },
    { label: '4', val: '4', kind: 'num' }, { label: '5', val: '5', kind: 'num' }, { label: '6', val: '6', kind: 'num' }, { label: '×', val: '×', kind: 'op' },
    { label: '1', val: '1', kind: 'num' }, { label: '2', val: '2', kind: 'num' }, { label: '3', val: '3', kind: 'num' }, { label: '−', val: '-', kind: 'op' },
    { label: '.', val: '.', kind: 'num' }, { label: '0', val: '0', kind: 'num' }, { label: '⌫', val: 'back', kind: 'back' }, { label: '+', val: '+', kind: 'op' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Type */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
        {(Object.keys(TYPE_META) as TxType[]).map((t) => {
          const M = TYPE_META[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={classNames(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
                type === t ? M.active : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
              )}
            >
              <M.icon size={16} />
              {M.label}
            </button>
          );
        })}
      </div>

      {/* Amount display */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-right">
        <div className="text-xs text-gray-400 dark:text-gray-500 h-4">{showExpr ? expr : 'Amount'}</div>
        <div className={classNames('text-3xl font-bold tabular-nums', TYPE_META[type].text)}>
          {sym}{amountValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </div>
      {error && <p className="-mt-2 text-xs font-medium text-danger-600">{error}</p>}

      {/* Category grid (income/expense) */}
      {type !== 'transfer' ? (
        <div>
          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
            {parentCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={classNames(
                  'flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-colors',
                  parentId === c.id ? 'bg-primary-50 ring-2 ring-primary-500 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <CategoryIcon icon={c.icon} color={c.color} size={20} />
                <span className="line-clamp-2 text-[11px] leading-tight text-gray-600 dark:text-gray-300">{c.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setNewCatParentId(undefined); setShowCategoryForm(true); }}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 p-2 text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-gray-600 dark:text-gray-400"
            >
              <Plus size={20} />
              <span className="text-[11px] leading-tight">New</span>
            </button>
          </div>
          {subcategories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCategoryId(parentId)} className={chipCls(categoryId === parentId)}>General</button>
              {subcategories.map((s) => (
                <button key={s.id} type="button" onClick={() => setCategoryId(s.id)} className={chipCls(categoryId === s.id)}>{s.name}</button>
              ))}
              <button type="button" onClick={() => { setNewCatParentId(parentId); setShowCategoryForm(true); }} className={chipCls(false)}>+ Sub</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">From account</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {activeAccounts.map((a) => (
                <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={chipCls(accountId === a.id)}>{a.name}</button>
              ))}
              <button type="button" onClick={() => setShowAccountForm(true)} className={chipCls(false)}>+ Add</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">To account</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {activeAccounts.filter((a) => a.id !== accountId).map((a) => (
                <button key={a.id} type="button" onClick={() => setToAccountId(a.id)} className={chipCls(toAccountId === a.id)}>{a.name}</button>
              ))}
              <button type="button" onClick={() => setShowAccountForm(true)} className={chipCls(false)}>+ Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Account chips (income/expense) */}
      {type !== 'transfer' && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" onClick={() => setAccountId('')} className={chipCls(accountId === '')}>No account</button>
          {activeAccounts.map((a) => (
            <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={chipCls(accountId === a.id)}>{a.name}</button>
          ))}
          <button type="button" onClick={() => setShowAccountForm(true)} className={chipCls(false)}>+ Add</button>
        </div>
      )}

      {/* Date + note */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
        />
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => press(k.val)}
            className={classNames(
              'flex items-center justify-center rounded-xl py-3.5 text-xl font-semibold transition-colors active:scale-95',
              k.kind === 'op'
                ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300'
                : k.kind === 'back'
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100',
            )}
            aria-label={k.kind === 'back' ? 'Backspace' : k.label}
          >
            {k.kind === 'back' ? <Delete size={20} /> : k.label}
          </button>
        ))}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        className="w-full rounded-xl bg-primary-600 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
      >
        Save
      </button>

      {/* Inline creation modals — unlimited custom categories & accounts */}
      <Modal
        isOpen={showCategoryForm}
        onClose={() => setShowCategoryForm(false)}
        title={newCatParentId ? 'New Subcategory' : 'New Category'}
      >
        <CategoryForm
          defaultType={type === 'income' ? 'income' : 'expense'}
          defaultParentId={newCatParentId}
          onClose={() => setShowCategoryForm(false)}
          onCreated={(newCatId) => { setCategoryId(newCatId); setShowCategoryForm(false); }}
        />
      </Modal>
      <Modal isOpen={showAccountForm} onClose={() => setShowAccountForm(false)} title="New Account">
        <AccountForm
          onClose={() => setShowAccountForm(false)}
          onCreated={(account: Account) => { setAccountId(account.id); setShowAccountForm(false); }}
        />
      </Modal>
    </div>
  );
}
