import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, MessageSquare, Bell, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { prefs } from '../../../shared/services/preferences';
import { AUTODETECT_ENABLED_KEY } from '../detection';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function AutoDetectSettings() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    prefs.getBool(AUTODETECT_ENABLED_KEY, false).then(setEnabled);
  }, []);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    await prefs.setBool(AUTODETECT_ENABLED_KEY, v);
  };

  const sources = [
    { icon: <MessageSquare size={16} />, title: 'Shared messages', desc: 'Share a bank SMS or payment message into MoneyIQ from any app.', status: 'active' as const },
    { icon: <Bell size={16} />, title: 'Bank notifications', desc: 'Read transaction alerts on-device (requires notification access).', status: 'soon' as const },
    { icon: <Mail size={16} />, title: 'Gmail (read-only)', desc: 'Scan bank/payment emails for transactions.', status: 'soon' as const },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScanLine size={18} className="text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Auto-detect transactions</h3>
        </div>
        <Toggle checked={enabled} onChange={toggle} />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/10 p-3 text-xs text-gray-600 dark:text-gray-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" />
        <span>
          <strong>Privacy first.</strong> Detection runs entirely on your device. Detected transactions go to a
          review queue and are <strong>never saved until you confirm</strong> them. Nothing is uploaded.
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.title} className="flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.title}</p>
                {s.status === 'active' ? (
                  <span className="rounded-full bg-success-100 px-1.5 py-0.5 text-[10px] font-medium text-success-700">Active</span>
                ) : (
                  <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">Coming soon</span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/detected')}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
      >
        Open review queue <ArrowRight size={14} />
      </button>
    </div>
  );
}
