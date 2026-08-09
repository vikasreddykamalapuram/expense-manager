import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Landmark, CreditCard, HandCoins, Smartphone, Banknote, Briefcase, Laptop, GraduationCap, Users, LucideIcon } from 'lucide-react';
import { useAppContext } from '../../../../context/AppContext';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { AccountForm, AccountFormInitial } from '../../../accounts/components/AccountForm';
import { AccountCatalog } from '../../../accounts/components/AccountCatalog';
import {
  AccountPreset, ONBOARDING_PERSONAS, ACCOUNT_PRESET_BY_KEY, presetToAccount,
} from '../../../../shared/constants/onboardingCatalog';
import { computeAccountBalance, getAccountKind, ACCOUNT_TYPE_META } from '../../../../shared/constants/accounts';
import { formatCurrency } from '../../../../shared/utils/helpers';

const iconMap: Record<string, LucideIcon> = { Landmark, CreditCard, HandCoins, Smartphone, Banknote };
const personaIcon: Record<string, LucideIcon> = { Briefcase, Laptop, GraduationCap, Users };

/** Onboarding step: pick a persona and batch-add accounts, or add one with a balance. */
export function AccountsStep() {
  const { state, actions } = useAppContext();
  const { accounts, transactions, settings } = state;
  const [showForm, setShowForm] = useState(false);
  const [presetInitial, setPresetInitial] = useState<AccountFormInitial | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [persona, setPersona] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const openBlank = () => { setPresetInitial(null); setShowForm(true); };

  const toggle = (preset: AccountPreset) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(preset.key)) next.delete(preset.key); else next.add(preset.key);
      return next;
    });
  };

  const applyPersona = (id: string, accountKeys: string[]) => {
    setPersona(id);
    setSelected(new Set(accountKeys));
  };

  const addSelected = async () => {
    setAdding(true);
    const now = new Date().toISOString();
    for (const key of selected) {
      const preset = ACCOUNT_PRESET_BY_KEY[key];
      if (!preset) continue;
      const kind = getAccountKind(preset.type);
      const account = presetToAccount(preset, { id: uuidv4(), kind, icon: ACCOUNT_TYPE_META[preset.type].icon, now });
      await actions.addAccount(account);
    }
    setSelected(new Set());
    setPersona(null);
    setAdding(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add your accounts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pick a quick-start below, or tap the accounts you use. Add several at once — you can set balances later.
        </p>
      </div>

      {/* Persona quick-start */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Quick start</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ONBOARDING_PERSONAS.map((p) => {
            const Icon = personaIcon[p.icon] || Briefcase;
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPersona(p.id, p.accountKeys)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                  active ? 'border-primary-500 ring-1 ring-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                }`}
              >
                <Icon size={18} className="text-primary-600" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.label}</span>
                <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-select catalog */}
      <AccountCatalog onToggle={toggle} selectedKeys={selected} />

      {/* Batch add bar */}
      <div className="sticky bottom-16 flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {selected.size > 0 ? `${selected.size} selected` : `${accounts.length} account${accounts.length === 1 ? '' : 's'} so far`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={openBlank}>Add with balance</Button>
          <Button size="sm" disabled={selected.size === 0 || adding} onClick={addSelected}>
            {adding ? 'Adding…' : `Add ${selected.size || ''} account${selected.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => {
            const Icon = iconMap[acc.icon] || Landmark;
            const bal = computeAccountBalance(acc, transactions);
            return (
              <span key={acc.id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs">
                <Icon size={13} style={{ color: acc.color }} />
                <span className="font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                <span className="text-gray-400 dark:text-gray-500">{formatCurrency(Math.abs(bal), settings)}</span>
              </span>
            );
          })}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setPresetInitial(null); }} title="Add account" size="md">
        <AccountForm initial={presetInitial || undefined} onClose={() => { setShowForm(false); setPresetInitial(null); }} />
      </Modal>
    </div>
  );
}
