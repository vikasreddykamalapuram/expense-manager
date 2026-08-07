import { Landmark, CreditCard, Smartphone, HandCoins, Banknote, Check, LucideIcon } from 'lucide-react';
import { ACCOUNT_CATALOG, AccountPreset } from '../../../shared/constants/onboardingCatalog';

const iconMap: Record<string, LucideIcon> = {
  Landmark,
  CreditCard,
  Smartphone,
  HandCoins,
  Banknote,
};

interface AccountCatalogProps {
  onPick: (preset: AccountPreset) => void;
  /** Preset keys already added, shown with a check. */
  addedKeys?: Set<string>;
  /** Restrict to specific group ids (e.g. onboarding). */
  groupIds?: string[];
}

/**
 * Tap-to-add preset account catalog. Picking a tile hands the preset back to the
 * parent, which opens the account form pre-filled so the user only enters the number.
 */
export function AccountCatalog({ onPick, addedKeys, groupIds }: AccountCatalogProps) {
  const groups = groupIds ? ACCOUNT_CATALOG.filter((g) => groupIds.includes(g.id)) : ACCOUNT_CATALOG;

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id}>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{group.label}</h3>
            {group.hint && <p className="text-xs text-gray-500 dark:text-gray-400">{group.hint}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.presets.map((preset) => {
              const Icon = iconMap[preset.icon] || Landmark;
              const added = addedKeys?.has(preset.key);
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onPick(preset)}
                  className="group relative flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left transition-all hover:border-primary-400 hover:shadow-sm active:scale-[0.98]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${preset.color}18` }}
                  >
                    <Icon size={18} style={{ color: preset.color }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {preset.label}
                  </span>
                  {added && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-100 text-success-600">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
