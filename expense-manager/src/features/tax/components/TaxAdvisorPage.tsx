import { useMemo } from 'react';
import { Scale, Info, TrendingDown, Wallet, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useSalaryProfile, computeSalaryTotals } from '../../../shared/hooks/useSalaryProfile';
import { useTaxInputs } from '../../../shared/hooks/useTaxInputs';
import { Input, Select } from '../../../shared/components/ui/Input';
import { formatCurrency, classNames } from '../../../shared/utils/helpers';
import { compareRegimes, RegimeResult, TaxDeductions } from '../../../shared/utils/taxEngine';
import { FY_OPTIONS, TAX_CONFIGS } from '../../../shared/constants/taxConfig';

const num = (v: string): number => {
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
};

export function TaxAdvisorPage() {
  const { state } = useAppContext();
  const { settings } = state;
  const profileId = state.activeProfileId;
  const { profile } = useSalaryProfile(profileId);
  const { inputs, setFy, setGrossIncome, setDeduction } = useTaxInputs(profileId);

  const salaryTotals = useMemo(
    () => (profile ? computeSalaryTotals(profile.components) : null),
    [profile]
  );

  const comparison = useMemo(
    () => compareRegimes(inputs.grossIncome, inputs.deductions, inputs.fy),
    [inputs.grossIncome, inputs.deductions, inputs.fy]
  );

  const caps = TAX_CONFIGS[inputs.fy]?.caps ?? TAX_CONFIGS['2025-26'].caps;
  const c80cUsed = Math.min(inputs.deductions.section80C, caps.section80C);
  const c80cPct = Math.min(100, (c80cUsed / caps.section80C) * 100);

  const deductionFields: { key: keyof TaxDeductions; label: string; cap?: number; hint?: string }[] = [
    { key: 'section80C', label: '80C (PF, ELSS, LIC, PPF…)', cap: caps.section80C },
    { key: 'section80CCD1B', label: '80CCD(1B) — extra NPS', cap: caps.section80CCD1B },
    { key: 'section80D', label: '80D — health insurance' },
    { key: 'hraExemption', label: 'HRA exemption' },
    { key: 'homeLoanInterest', label: 'Home-loan interest', cap: caps.homeLoanInterest },
    { key: 'otherDeductions', label: 'Other (80E, 80G…)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Scale size={24} /> Tax Regime Advisor
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compare the old and new regimes for your income and see which saves you more.
        </p>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Financial year"
            value={inputs.fy}
            onChange={(e) => setFy(e.target.value)}
            options={FY_OPTIONS}
          />
          <div>
            <Input
              label="Annual gross income"
              type="number"
              min="0"
              placeholder="0"
              value={inputs.grossIncome ? String(inputs.grossIncome) : ''}
              onChange={(e) => setGrossIncome(num(e.target.value))}
            />
            {salaryTotals && salaryTotals.annualGross > 0 && (
              <button
                type="button"
                onClick={() => setGrossIncome(Math.round(salaryTotals.annualGross))}
                className="mt-1 text-xs font-medium text-primary-600 hover:underline"
              >
                Use my salary ({formatCurrency(salaryTotals.annualGross, settings)}/yr)
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Deductions (used by the old regime)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {deductionFields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type="number"
                min="0"
                placeholder="0"
                value={inputs.deductions[f.key] ? String(inputs.deductions[f.key]) : ''}
                onChange={(e) => setDeduction(f.key, num(e.target.value))}
                helperText={f.cap ? `Cap ${formatCurrency(f.cap, settings)}` : undefined}
              />
            ))}
          </div>
        </div>

        {/* 80C tracker */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>80C used</span>
            <span>{formatCurrency(c80cUsed, settings)} / {formatCurrency(caps.section80C, settings)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${c80cPct}%` }}
            />
          </div>
          {c80cUsed < caps.section80C && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              You can still invest {formatCurrency(caps.section80C - c80cUsed, settings)} under 80C.
            </p>
          )}
        </div>
      </div>

      {/* Recommendation banner */}
      {inputs.grossIncome > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 p-4">
          <CheckCircle2 className="text-success-600 shrink-0" size={22} />
          <div className="text-sm">
            <span className="font-semibold text-success-800 dark:text-success-300">
              {comparison.recommended === 'new' ? 'New regime' : 'Old regime'} is better for you.
            </span>{' '}
            {comparison.savings > 0 ? (
              <span className="text-success-700 dark:text-success-400">
                You save {formatCurrency(comparison.savings, settings)} vs the other regime.
              </span>
            ) : (
              <span className="text-success-700 dark:text-success-400">Both regimes cost the same.</span>
            )}
          </div>
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RegimeCard title="Old regime" result={comparison.old} recommended={comparison.recommended === 'old'} settings={settings} />
        <RegimeCard title="New regime" result={comparison.new} recommended={comparison.recommended === 'new'} settings={settings} />
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-500 dark:text-gray-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          This is a simplified estimate for planning, <strong>not tax advice</strong>. It doesn't cover every
          exemption, surcharge marginal relief, or your full situation. Consult a tax professional before filing.
        </span>
      </div>
    </div>
  );
}

function RegimeCard({
  title,
  result,
  recommended,
  settings,
}: {
  title: string;
  result: RegimeResult;
  recommended: boolean;
  settings: ReturnType<typeof useAppContext>['state']['settings'];
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Gross income', value: formatCurrency(result.grossIncome, settings) },
    { label: 'Standard deduction', value: `- ${formatCurrency(result.standardDeduction, settings)}` },
    { label: 'Other deductions', value: `- ${formatCurrency(result.appliedDeductions, settings)}` },
    { label: 'Taxable income', value: formatCurrency(result.taxableIncome, settings) },
    { label: 'Tax before rebate', value: formatCurrency(result.taxBeforeRebate, settings) },
    { label: 'Rebate (87A)', value: `- ${formatCurrency(result.rebate, settings)}` },
    { label: 'Surcharge', value: formatCurrency(result.surcharge, settings) },
    { label: 'Cess (4%)', value: formatCurrency(result.cess, settings) },
  ];
  return (
    <div
      className={classNames(
        'rounded-xl border p-5 shadow-sm',
        recommended
          ? 'border-success-300 dark:border-success-700 bg-success-50/40 dark:bg-success-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-100 dark:bg-success-800 px-2 py-0.5 text-xs font-medium text-success-700 dark:text-success-300">
            <TrendingDown size={12} /> Recommended
          </span>
        )}
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Total tax</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(result.totalTax, settings)}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Effective rate {(result.effectiveRate * 100).toFixed(1)}%
        </p>
      </div>

      <div className="space-y-1 border-t border-gray-100 dark:border-gray-700 pt-3">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
            <span className="text-gray-700 dark:text-gray-300">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
