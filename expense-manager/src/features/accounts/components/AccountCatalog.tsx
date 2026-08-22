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
  /** Single-pick handler (opens the form). Used when onToggle is not provided. */
  onPick?: (preset: AccountPreset) => void;
  /** Multi-select toggle handler. When provided, tiles become selectable. */
  onToggle?: (preset: AccountPreset) => void;
  /** Currently selected preset keys (multi-select mode). */
  selectedKeys?: Set<string>;
  /** Preset keys already added, shown with a check. */
  addedKeys?: Set<string>;
  /** Restrict to specific group ids (e.g. onboarding). */
  groupIds?: string[];
}

/**
 * Preset account catalog. Two modes:
 *  - single-pick (onPick): tapping a tile opens the pre-filled account form.
 *  - multi-select (onToggle + selectedKeys): tapping toggles selection for a batch add.
 */
export function AccountCatalog({ onPick, onToggle, selectedKeys, addedKeys, groupIds }: AccountCatalogProps) {
  const groups = groupIds ? ACCOUNT_CATALOG.filter((g) => groupIds.includes(g.id)) : ACCOUNT_CATALOG;
  const selectable = !!onToggle;

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
              const selected = selectedKeys?.has(preset.key);
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => (selectable ? onToggle!(preset) : onPick?.(preset))}
                  aria-pressed={selectable ? !!selected : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-xl border bg-white dark:bg-gray-800 p-3 text-left transition-all hover:shadow-sm active:scale-[0.98] ${
                    selected
                      ? 'border-primary-500 ring-1 ring-primary-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                  }`}
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
                  {(added || selected) && (
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${selected ? 'bg-primary-500 text-white' : 'bg-success-100 text-success-600'}`}>
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
