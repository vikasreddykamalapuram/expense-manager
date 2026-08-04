import { useState, useRef, type ChangeEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Wallet, Plus, Trash2, Pencil, Building2, CalendarClock, FileUp, Loader2 } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useSalaryProfile, computeSalaryTotals } from '../../../shared/hooks/useSalaryProfile';
import { parsePayslipPdf } from '../../../shared/services/payslipParser';
import type { SalaryComponent, SalaryComponentKind } from '../../../shared/types';

const seedComponents = (): SalaryComponent[] => [
  { id: uuidv4(), label: 'Basic', amount: 0, kind: 'earning' },
  { id: uuidv4(), label: 'HRA', amount: 0, kind: 'earning' },
  { id: uuidv4(), label: 'Special Allowance', amount: 0, kind: 'earning' },
  { id: uuidv4(), label: 'Provident Fund (PF)', amount: 0, kind: 'deduction' },
  { id: uuidv4(), label: 'Professional Tax', amount: 0, kind: 'deduction' },
  { id: uuidv4(), label: 'TDS (Income Tax)', amount: 0, kind: 'deduction' },
];

export function SalaryPage() {
  const { state } = useAppContext();
  const sym = state.settings.currencySymbol;
  const profileId = state.activeProfileId;
  const { profile, loading, save } = useSalaryProfile(profileId);

  const [editing, setEditing] = useState(false);
  const [employer, setEmployer] = useState('');
  const [payDay, setPayDay] = useState('');
  const [components, setComponents] = useState<SalaryComponent[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pwd, setPwd] = useState('');
  const [needsPwd, setNeedsPwd] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const runImport = async (file: File, password?: string) => {
    setImporting(true);
    setImportMsg('');
    const res = await parsePayslipPdf(file, password);
    setImporting(false);
    if (res.needsPassword) { setPendingFile(file); setNeedsPwd(true); return; }
    if (res.wrongPassword) { setImportMsg('Incorrect password. Try again.'); return; }
    if (res.error) { setImportMsg(res.error); setNeedsPwd(false); setPendingFile(null); return; }
    setEmployer(profile?.employer || '');
    setPayDay(profile?.payDay ? String(profile.payDay) : '');
    setComponents(res.components.length ? res.components : seedComponents());
    setEditing(true);
    setNeedsPwd(false);
    setPendingFile(null);
    setPwd('');
    setImportMsg(`Imported ${res.components.length} component${res.components.length === 1 ? '' : 's'} — review & save.`);
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setNeedsPwd(false);
    setPwd('');
    setImportMsg('');
    void runImport(f);
  };

  const importControls = (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onPickFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {importing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        {importing ? 'Reading…' : 'Import payslip PDF'}
      </button>
      {needsPwd && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="PDF password"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button type="button" onClick={() => pendingFile && runImport(pendingFile, pwd)} disabled={importing || !pwd}
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Unlock</button>
        </div>
      )}
      {importMsg && <p className="text-xs text-gray-500 dark:text-gray-400">{importMsg}</p>}
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Parsed on your device — the file is never uploaded.</p>
    </div>
  );

  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString(undefined)}`;

  const startEdit = () => {
    setEmployer(profile?.employer || '');
    setPayDay(profile?.payDay ? String(profile.payDay) : '');
    setComponents(profile?.components?.length ? profile.components.map((c) => ({ ...c })) : seedComponents());
    setEditing(true);
  };

  const setComp = (id: string, patch: Partial<SalaryComponent>) =>
    setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addComp = (kind: SalaryComponentKind) =>
    setComponents((cs) => [...cs, { id: uuidv4(), label: '', amount: 0, kind }]);
  const removeComp = (id: string) => setComponents((cs) => cs.filter((c) => c.id !== id));

  const handleSave = async () => {
    const cleaned = components.filter((c) => c.label.trim() !== '');
    await save({
      employer: employer.trim() || undefined,
      payDay: payDay ? Math.min(31, Math.max(1, Number(payDay))) : undefined,
      components: cleaned,
      effectiveFrom: profile?.effectiveFrom,
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────
  if (editing) {
    const earnings = components.filter((c) => c.kind === 'earning');
    const deductions = components.filter((c) => c.kind === 'deduction');
    const live = computeSalaryTotals(components);

    const Row = (c: SalaryComponent) => (
      <div key={c.id} className="flex items-center gap-2">
        <input
          value={c.label}
          onChange={(e) => setComp(c.id, { label: e.target.value })}
          placeholder="Component"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <input
          type="number"
          min="0"
          value={c.amount || ''}
          onChange={(e) => setComp(c.id, { amount: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <button type="button" onClick={() => removeComp(c.id)} aria-label="Remove" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700">
          <Trash2 size={16} />
        </button>
      </div>
    );

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salary breakdown</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter your monthly salary components</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {importControls}
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Employer</span>
              <input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Company name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Pay day (1–31)</span>
              <input type="number" min="1" max="31" value={payDay} onChange={(e) => setPayDay(e.target.value)} placeholder="e.g. 1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-success-700 dark:text-success-400">Earnings</p>
            <div className="space-y-2">{earnings.map(Row)}</div>
            <button type="button" onClick={() => addComp('earning')} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              <Plus size={14} /> Add earning
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-danger-700 dark:text-danger-400">Deductions</p>
            <div className="space-y-2">{deductions.map(Row)}</div>
            <button type="button" onClick={() => addComp('deduction')} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              <Plus size={14} /> Add deduction
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40">
            <span className="text-gray-500 dark:text-gray-400">Net in-hand / month</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">{fmt(live.net)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={handleSave} className="flex-1 rounded-xl bg-primary-600 py-3 font-semibold text-white shadow-sm hover:bg-primary-700">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-gray-100 px-5 py-3 font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salary</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Understand your pay: CTC, deductions &amp; real take-home</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-600">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
            <Wallet size={26} />
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">No salary details yet</p>
          <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            <Plus size={16} /> Add salary breakdown
          </button>
          <div className="w-full max-w-xs pt-2">{importControls}</div>
        </div>
      </div>
    );
  }

  // ── View mode ─────────────────────────────────────────
  const totals = computeSalaryTotals(profile.components);
  const earnings = profile.components.filter((c) => c.kind === 'earning');
  const deductions = profile.components.filter((c) => c.kind === 'deduction');

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salary</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {profile.employer && <span className="inline-flex items-center gap-1"><Building2 size={13} />{profile.employer}</span>}
            {profile.payDay && <span className="inline-flex items-center gap-1"><CalendarClock size={13} />Paid on the {profile.payDay}</span>}
          </div>
        </div>
        <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
          <Pencil size={14} /> Edit
        </button>
      </div>

      {/* Headline */}
      <div className="rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 p-5 text-white shadow-sm">
        <p className="text-xs uppercase tracking-wide text-white/70">Net in-hand / month</p>
        <p className="text-3xl font-bold">{fmt(totals.net)}</p>
        <p className="mt-1 text-sm text-white/80">{totals.inHandPct}% of gross · {fmt(totals.annualNet)} / year</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Gross / month</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmt(totals.gross)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Deductions / month</p>
          <p className="text-lg font-bold text-danger-600">{fmt(totals.deductions)}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Approx. annual CTC (gross × 12)</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmt(totals.annualGross)}</p>
        </div>
      </div>

      {/* In-hand vs deductions bar */}
      {totals.gross > 0 && (
        <div>
          <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div className="bg-success-500" style={{ width: `${(totals.net / totals.gross) * 100}%` }} />
            <div className="bg-danger-500" style={{ width: `${(totals.deductions / totals.gross) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>In-hand {totals.inHandPct}%</span>
            <span>Deductions {Math.round((totals.deductions / totals.gross) * 100)}%</span>
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div>
          <p className="mb-2 text-sm font-semibold text-success-700 dark:text-success-400">Earnings</p>
          <ul className="space-y-1.5">
            {earnings.map((c) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{c.label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
          <p className="mb-2 text-sm font-semibold text-danger-700 dark:text-danger-400">Deductions</p>
          <ul className="space-y-1.5">
            {deductions.map((c) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{c.label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">−{fmt(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Estimates from your entered components — not financial or tax advice.
      </p>
    </div>
  );
}
