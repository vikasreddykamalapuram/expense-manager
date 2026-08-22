import { useMemo, useState } from 'react';
import {
  Plus, Edit2, Trash2, Wallet, TrendingUp, TrendingDown, PieChart,
  Landmark, PiggyBank, ShieldCheck, Repeat, LineChart, Coins, Home, Shield, LucideIcon,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useHoldings } from '../../../shared/hooks/useHoldings';
import { Button } from '../../../shared/components/ui/Button';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { Modal } from '../../../shared/components/ui/Modal';
import { HoldingForm } from './HoldingForm';
import { TakeHomeCalculator } from './TakeHomeCalculator';
import { Holding } from '../../../shared/types';
import { computeAccountBalance } from '../../../shared/constants/accounts';
import { HOLDING_TYPE_META, HOLDING_CATEGORY_LABEL, HoldingCategory } from '../../../shared/constants/holdings';
import { calculateHoldings, calculatePortfolioStats } from '../../../shared/services/stockService';
import { formatCurrency } from '../../../shared/utils/helpers';

const iconMap: Record<string, LucideIcon> = {
  Landmark, PiggyBank, ShieldCheck, Repeat, TrendingUp, LineChart, Coins, Home, Shield, Wallet,
};

const CATEGORY_ORDER: HoldingCategory[] = ['retirement', 'investment', 'other'];

export function NetWorthPage() {
  const { state } = useAppContext();
  const { accounts, transactions, stockTransactions, settings } = state;
  const { holdings, addHolding, updateHolding, deleteHolding } = useHoldings(state.activeProfileId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const accountTotals = useMemo(() => {
    let liquid = 0;
    let liabilities = 0;
    accounts.forEach((acc) => {
      const bal = computeAccountBalance(acc, transactions);
      if (acc.kind === 'asset') liquid += bal;
      else liabilities += Math.max(0, bal);
    });
    return { liquid, liabilities };
  }, [accounts, transactions]);

  const stocksInvested = useMemo(() => {
    if (!stockTransactions.length) return 0;
    return calculatePortfolioStats(calculateHoldings(stockTransactions)).totalInvested;
  }, [stockTransactions]);

  const holdingsByCategory = useMemo(() => {
    const map: Record<HoldingCategory, Holding[]> = { retirement: [], investment: [], other: [] };
    holdings.forEach((h) => map[HOLDING_TYPE_META[h.type].category].push(h));
    return map;
  }, [holdings]);

  const categorySum = (cat: HoldingCategory) =>
    holdingsByCategory[cat].reduce((s, h) => s + h.currentValue, 0);

  const retirement = categorySum('retirement');
  const investmentHoldings = categorySum('investment');
  const otherAssets = categorySum('other');
  const investments = stocksInvested + investmentHoldings;

  const totalAssets = accountTotals.liquid + investments + retirement + otherAssets;
  const netWorth = totalAssets - accountTotals.liabilities;

  const composition = [
    { label: 'Liquid (accounts)', value: accountTotals.liquid, color: '#2563eb' },
    { label: 'Investments', value: investments, color: '#7c3aed' },
    { label: 'Retirement', value: retirement, color: '#0891b2' },
    { label: 'Other assets', value: otherAssets, color: '#64748b' },
  ].filter((c) => c.value !== 0);

  const openAdd = () => { setEditing(null); setShowForm(true); };
  const openEdit = (h: Holding) => { setEditing(h); setShowForm(true); };
  const handleSave = async (data: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) await updateHolding(editing.id, data);
    else await addHolding(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <PieChart size={24} /> Net worth
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your full picture — accounts, investments, and retirement savings.
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAdd}>Add holding</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Net worth" value={formatCurrency(netWorth, settings)} icon={<Wallet size={24} />} variant={netWorth >= 0 ? 'balance' : 'expense'} />
        <StatCard title="Total assets" value={formatCurrency(totalAssets, settings)} icon={<TrendingUp size={24} />} variant="income" />
        <StatCard title="Total liabilities" value={formatCurrency(accountTotals.liabilities, settings)} icon={<TrendingDown size={24} />} variant="expense" />
      </div>

      {/* Composition */}
      {totalAssets > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Asset composition</h3>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full">
            {composition.map((c) => (
              <div key={c.label} style={{ width: `${(c.value / totalAssets) * 100}%`, backgroundColor: c.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {composition.map((c) => (
              <div key={c.label} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-gray-500 dark:text-gray-400">{c.label}</span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(c.value, settings)}</p>
              </div>
            ))}
          </div>
          {stocksInvested > 0 && (
            <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
              Stocks shown at invested value; see Portfolio for live market value.
            </p>
          )}
        </div>
      )}

      {/* Holdings by category */}
      {CATEGORY_ORDER.map((cat) => {
        const list = holdingsByCategory[cat];
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {HOLDING_CATEGORY_LABEL[cat]}
              </h2>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {formatCurrency(categorySum(cat), settings)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((h) => {
                const meta = HOLDING_TYPE_META[h.type];
                const Icon = iconMap[meta.icon] || Wallet;
                return (
                  <div key={h.id} className="group flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}15` }}>
                        <Icon size={18} style={{ color: meta.color }} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{h.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {meta.label}{h.interestRate ? ` · ${h.interestRate}% p.a.` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(h.currentValue, settings)}</span>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(h)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600" aria-label="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(h.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600" aria-label="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {holdings.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add your EPF, PPF, NPS, mutual funds, gold and other assets to see your complete net worth.
          </p>
          <Button className="mt-3" icon={<Plus size={16} />} onClick={openAdd}>Add your first holding</Button>
        </div>
      )}

      <TakeHomeCalculator />

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit holding' : 'Add holding'} size="md">
        <HoldingForm editHolding={editing || undefined} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete holding" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400">Remove this holding from your net worth?</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { if (deleteId) deleteHolding(deleteId); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
