import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, ArrowLeft, ArrowRight, Check, FileText, ReceiptText,
  Landmark, Tags, Sparkles, ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { AccountsStep } from './steps/AccountsStep';
import { CategoriesStep } from './steps/CategoriesStep';
import { markSetupComplete } from '../setupStatus';

const STEPS = ['Welcome', 'Accounts', 'Categories', 'Import'] as const;

export function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Guard against the browser/back gestures leaving a half-finished flag state:
  // we only mark complete on explicit finish/skip.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const finish = (to = '/') => {
    markSetupComplete();
    navigate(to, { replace: true });
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Wallet size={18} />
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">MoneyIQ</span>
        </div>
        <button
          type="button"
          onClick={() => finish()}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Skip setup
        </button>
      </header>

      {/* Progress */}
      <div className="px-4 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  i <= step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            </div>
          ))}
        </div>
        <p className="mx-auto mt-2 max-w-lg text-xs text-gray-400 dark:text-gray-500">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>

      {/* Body */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <AccountsStep />}
          {step === 2 && <CategoriesStep />}
          {step === 3 && <ImportStep onImport={(path) => finish(path)} />}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Button
            variant="ghost"
            icon={<ArrowLeft size={18} />}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {isLast ? (
            <Button icon={<Check size={18} />} onClick={() => finish()}>
              Finish setup
            </Button>
          ) : (
            <Button icon={<ArrowRight size={18} />} onClick={() => setStep((s) => s + 1)}>
              {step === 0 ? 'Get started' : 'Next'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function WelcomeStep() {
  const items = [
    { icon: <Landmark size={18} />, title: 'Add your accounts', desc: 'Banks, cards, wallets & loans — one tap each.' },
    { icon: <Tags size={18} />, title: 'Pick your categories', desc: 'Start from sensible defaults, add your own.' },
    { icon: <FileText size={18} />, title: 'Import existing data', desc: 'Bring in statements or a payslip (optional).' },
    { icon: <ShieldCheck size={18} />, title: 'Private by design', desc: 'Your data stays on your device.' },
  ];
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
          <Sparkles size={30} />
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to MoneyIQ</h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          Let's set things up in under a minute so your dashboard is useful from day one.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              {it.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{it.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportStep({ onImport }: { onImport: (path: string) => void }) {
  const options = [
    {
      icon: <FileText size={20} />,
      title: 'Import a bank / card statement',
      desc: 'PDF or CSV — we detect transactions automatically.',
      path: '/import',
    },
    {
      icon: <ReceiptText size={20} />,
      title: 'Import a salary slip',
      desc: 'Parse your payslip to prefill salary & deductions.',
      path: '/salary',
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import existing data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Optional — bring in your history so you start with a full picture. Everything is parsed on your device.
        </p>
      </div>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.path}
            type="button"
            onClick={() => onImport(opt.path)}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left transition-all hover:border-primary-400 hover:shadow-sm active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              {opt.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200">{opt.title}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.desc}</span>
            </span>
            <ArrowRight size={18} className="text-gray-400" />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        You can import anytime later from the Import and Salary screens.
      </p>
    </div>
  );
}
