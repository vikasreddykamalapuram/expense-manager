/**
 * AddTradeModal — manual entry for a single stock/MF/ETF trade
 * (buy / sell / dividend / bonus / split / ipo). Complements the CSV
 * import flow with a form for on-the-fly additions.
 */
import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../../context/AppContext';
import { Modal } from '../../../shared/components/ui/Modal';
import { Button } from '../../../shared/components/ui/Button';
import { AssetClass, StockExchange, StockTransaction, TradeType } from '../../../shared/types';
import { haptic } from '../../../shared/services/haptics';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const TRADE_TYPES: { value: TradeType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'split', label: 'Split' },
  { value: 'ipo', label: 'IPO' },
];

const EXCHANGES: StockExchange[] = ['NSE', 'BSE', 'MCX', 'OTHER'];
const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: 'equity', label: 'Equity' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bond' },
  { value: 'gold', label: 'Gold' },
  { value: 'other', label: 'Other' },
];

export function AddTradeModal({ open, onClose, onSaved }: Props) {
  const { actions, state } = useAppContext();

  // Distinct broker list from prior trades (best-effort autofill).
  const knownBrokers = useMemo(() => {
    const s = new Set<string>();
    for (const t of state.stockTransactions) if (t.broker) s.add(t.broker);
    return [...s].sort();
  }, [state.stockTransactions]);

  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<TradeType>('buy');
  const [date, setDate] = useState(today);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState<StockExchange>('NSE');
  const [assetClass, setAssetClass] = useState<AssetClass>('equity');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [broker, setBroker] = useState(knownBrokers[0] || '');
  const [charges, setCharges] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isDividend = type === 'dividend';
  const isBonusOrSplit = type === 'bonus' || type === 'split';

  const qNum = parseFloat(quantity) || 0;
  const pNum = parseFloat(price) || 0;
  // For dividends we treat `price` as total dividend amount (qty defaults to 1).
  const totalValue = isDividend ? pNum : qNum * pNum;

  const reset = () => {
    setType('buy');
    setDate(today);
    setSymbol('');
    setName('');
    setExchange('NSE');
    setAssetClass('equity');
    setQuantity('');
    setPrice('');
    setBroker(knownBrokers[0] || '');
    setCharges('');
    setNotes('');
  };

  const handleClose = () => { if (!saving) { reset(); onClose(); } };

  const handleSave = async () => {
    if (!symbol.trim()) return;
    if (!isBonusOrSplit && !isDividend && qNum <= 0) return;
    if (!isBonusOrSplit && pNum <= 0) return;

    setSaving(true);
    try {
      const chargesTotal = parseFloat(charges) || 0;
      const now = new Date().toISOString();
      const tx: StockTransaction = {
        id: uuidv4(),
        date,
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || symbol.trim().toUpperCase(),
        exchange,
        assetClass,
        type,
        quantity: isDividend ? 1 : qNum,
        price: isDividend ? pNum : pNum,
        totalValue,
        charges: {
          brokerage: 0, stt: 0, gst: 0, stampDuty: 0,
          exchangeCharges: 0, sebiCharges: 0,
          otherCharges: chargesTotal,
          total: chargesTotal,
        },
        broker: broker.trim() || 'Manual',
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await actions.addStockTransaction(tx);
      haptic.success();
      onSaved?.();
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Add Trade" size="md">
      <div className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {TRADE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={
                  'rounded-lg px-2 py-2 text-xs font-medium transition-colors ' +
                  (type === t.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Symbol + Name */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol">
            <input
              type="text"
              placeholder="RELIANCE"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={inputCls}
            />
          </Field>
          <Field label="Name">
            <input
              type="text"
              placeholder="Reliance Industries"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Exchange + Asset class */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Exchange">
            <select value={exchange} onChange={(e) => setExchange(e.target.value as StockExchange)} className={inputCls}>
              {EXCHANGES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Asset class">
            <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)} className={inputCls}>
              {ASSET_CLASSES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Quantity + Price OR Dividend amount */}
        {isDividend ? (
          <Field label="Dividend amount">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={isBonusOrSplit ? 'Ratio numerator (qty received)' : 'Quantity'}>
              <input
                type="number"
                inputMode="decimal"
                step="0.0001"
                min="0"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={isBonusOrSplit ? 'Reference price (optional)' : 'Price per unit'}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {/* Broker + Charges */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Broker">
            <input
              type="text"
              list="known-brokers"
              placeholder="Zerodha"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className={inputCls}
            />
            <datalist id="known-brokers">
              {knownBrokers.map((b) => <option key={b} value={b} />)}
            </datalist>
          </Field>
          <Field label="Charges (optional)">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={charges}
              onChange={(e) => setCharges(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Notes */}
        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Total preview */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total value:</span>{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !symbol.trim()}>
            {saving ? 'Saving…' : 'Add trade'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}
