import { useState } from 'react';
import { Plus, Landmark, CreditCard, HandCoins, Smartphone, Banknote, LucideIcon } from 'lucide-react';
import { useAppContext } from '../../../../context/AppContext';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { AccountForm, AccountFormInitial } from '../../../accounts/components/AccountForm';
import { AccountCatalog } from '../../../accounts/components/AccountCatalog';
import { AccountPreset } from '../../../../shared/constants/onboardingCatalog';
import { computeAccountBalance } from '../../../../shared/constants/accounts';
import { formatCurrency } from '../../../../shared/utils/helpers';

const iconMap: Record<string, LucideIcon> = { Landmark, CreditCard, HandCoins, Smartphone, Banknote };

/** Onboarding step: add real accounts fast via the preset catalog. */
export function AccountsStep() {
  const { state } = useAppContext();
  const { accounts, transactions, settings } = state;
  const [showForm, setShowForm] = useState(false);
  const [presetInitial, setPresetInitial] = useState<AccountFormInitial | null>(null);

  const openBlank = () => {
    setPresetInitial(null);
    setShowForm(true);
  };

  const pick = (preset: AccountPreset) => {
    setPresetInitial({
      name: preset.label,
      type: preset.type,
      subtype: preset.subtype,
      institution: preset.institution,
      color: preset.color,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add your accounts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tap the banks, cards, wallets and loans you use. You'll only enter the balance — for loans we
          compute the outstanding for you. You can always add more later.
        </p>
      </div>

      <AccountCatalog onPick={pick} />

      <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {accounts.length} account{accounts.length === 1 ? '' : 's'} so far
        </span>
        <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={openBlank}>
          Add manually
        </Button>
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => {
            const Icon = iconMap[acc.icon] || Landmark;
            const bal = computeAccountBalance(acc, transactions);
            return (
              <span
                key={acc.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs"
              >
                <Icon size={13} style={{ color: acc.color }} />
                <span className="font-medium text-gray-800 dark:text-gray-200">{acc.name}</span>
                <span className="text-gray-400 dark:text-gray-500">{formatCurrency(Math.abs(bal), settings)}</span>
              </span>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setPresetInitial(null); }}
        title="Add account"
        size="md"
      >
        <AccountForm
          initial={presetInitial || undefined}
          onClose={() => { setShowForm(false); setPresetInitial(null); }}
        />
      </Modal>
    </div>
  );
}
