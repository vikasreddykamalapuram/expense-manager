import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Input, Select } from '../../../shared/components/ui/Input';
import { formatCurrency } from '../../../shared/utils/helpers';
import { computeTakeHome } from '../../../shared/utils/takeHome';
import { FY_OPTIONS } from '../../../shared/constants/taxConfig';

export function TakeHomeCalculator() {
  const { state } = useAppContext();
  const { settings } = state;
  const [ctc, setCtc] = useState('');
  const [basicPct, setBasicPct] = useState('50');
  const [regime, setRegime] = useState<'old' | 'new'>('new');
  const [fy, setFy] = useState('2025-26');

  const result = useMemo(() => {
    const annualCtc = parseFloat(ctc.replace(/,/g, ''));
    if (!annualCtc || annualCtc <= 0) return null;
    return computeTakeHome({
      annualCtc,
      basicPct: (parseFloat(basicPct) || 50) / 100,
      regime,
      fy,
    });
  }, [ctc, basicPct, regime, fy]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-primary-600" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Take-home calculator</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Annual CTC"
          type="number"
          min="0"
          placeholder="1200000"
          value={ctc}
          onChange={(e) => setCtc(e.target.value)}
        />
        <Input
          label="Basic (% of CTC)"
          type="number"
          min="10"
          max="100"
          value={basicPct}
          onChange={(e) => setBasicPct(e.target.value)}
          helperText="Usually 40–50%"
        />
        <Select
          label="Regime"
          value={regime}
          onChange={(e) => setRegime(e.target.value as 'old' | 'new')}
          options={[{ value: 'new', label: 'New regime' }, { value: 'old', label: 'Old regime' }]}
        />
        <Select label="Financial year" value={fy} onChange={(e) => setFy(e.target.value)} options={FY_OPTIONS} />
      </div>

      {result && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-4">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Monthly take-home</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(result.monthlyTakeHome, settings)}
            </span>
          </div>
          <div className="space-y-1 border-t border-gray-100 dark:border-gray-600 pt-2 text-xs">
            <Row label="Annual CTC" value={formatCurrency(result.annualCtc, settings)} />
            <Row label="Employer PF (in CTC)" value={`- ${formatCurrency(result.employerPf, settings)}`} />
            <Row label="Gross salary" value={formatCurrency(result.gross, settings)} />
            <Row label="Employee PF" value={`- ${formatCurrency(result.employeePf, settings)}`} />
            <Row label="Professional tax" value={`- ${formatCurrency(result.professionalTax, settings)}`} />
            <Row label="Income tax" value={`- ${formatCurrency(result.incomeTax, settings)}`} />
            <Row label="Annual take-home" value={formatCurrency(result.annualTakeHome, settings)} strong />
            <Row label="In-hand of CTC" value={`${(result.inHandPct * 100).toFixed(1)}%`} />
          </div>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            Estimate for planning — actual payslips vary by employer structure and state.
          </p>
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
