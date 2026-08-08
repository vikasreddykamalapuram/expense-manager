import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import { computeEmi, loanStatus } from '../../../shared/utils/loanCalculator';

interface LoanCalculatorProps {
  /** Called when the user applies the computed values to the account form. */
  onApply: (result: { outstanding: number; interestRate: number }) => void;
}

/**
 * "Compute, don't ask" loan helper: the user enters original amount, rate, tenure
 * and start date; we derive EMI, outstanding, and repaid via reducing-balance
 * amortization, then let them apply outstanding + rate to the account.
 */
export function LoanCalculator({ onApply }: LoanCalculatorProps) {
  const { state } = useAppContext();
  const { settings } = state;

  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const [startDate, setStartDate] = useState('');

  const inputs = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const n = parseInt(tenure, 10);
    if (!p || p <= 0 || isNaN(r) || r < 0 || !n || n <= 0) return null;
    return { principal: p, annualRatePct: r, tenureMonths: n };
  }, [principal, rate, tenure]);

  const result = useMemo(() => {
    if (!inputs) return null;
    const emi = computeEmi(inputs);
    const status = loanStatus(inputs, { startDate: startDate || undefined });
    return { emi, status };
  }, [inputs, startDate]);

  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Calculator size={16} />
        Compute from loan details
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Enter what you know — we'll work out the EMI, how much you've repaid, and the current outstanding.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Original amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="1000000"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />
        <Input
          label="Interest rate (% p.a.)"
          type="number"
          min="0"
          step="0.01"
          placeholder="8.5"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <Input
          label="Tenure (months)"
          type="number"
          min="1"
          step="1"
          placeholder="120"
          value={tenure}
          onChange={(e) => setTenure(e.target.value)}
        />
        <Input
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          helperText="Optional"
        />
      </div>

      {result && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-sm space-y-1.5">
          <Row label="Monthly EMI" value={formatCurrency(result.emi, settings)} strong />
          <Row label="EMIs paid" value={`${result.status.emisPaid} of ${result.status.totalEmis}`} />
          <Row label="Principal repaid" value={formatCurrency(result.status.principalRepaid, settings)} />
          <Row
            label="Outstanding"
            value={formatCurrency(result.status.outstandingPrincipal, settings)}
            strong
          />
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() =>
                onApply({
                  outstanding: Math.round(result.status.outstandingPrincipal),
                  interestRate: inputs!.annualRatePct,
                })
              }
            >
              Use these values
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={strong ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}>
        {value}
      </span>
    </div>
  );
}
