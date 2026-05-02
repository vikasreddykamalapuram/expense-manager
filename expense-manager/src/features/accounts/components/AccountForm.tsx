import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { Account, AccountType, BankSubtype, LoanSubtype } from '../../../shared/types';
import { ACCOUNT_TYPE_META, ACCOUNT_COLORS, POPULAR_INSTITUTIONS, BANK_SUBTYPES, LOAN_SUBTYPES, getAccountKind } from '../../../shared/constants/accounts';

interface AccountFormProps {
  editAccount?: Account;
  onClose: () => void;
}

export function AccountForm({ editAccount, onClose }: AccountFormProps) {
  const { actions } = useAppContext();
  const isEditing = !!editAccount;

  const [name, setName] = useState(editAccount?.name || '');
  const [type, setType] = useState<AccountType>(editAccount?.type || 'bank');
  const [subtype, setSubtype] = useState(editAccount?.subtype || '');
  const [institution, setInstitution] = useState(editAccount?.institution || '');
  const [customInstitution, setCustomInstitution] = useState('');
  const [openingBalance, setOpeningBalance] = useState(editAccount?.openingBalance.toString() || '0');
  const [creditLimit, setCreditLimit] = useState(editAccount?.creditLimit?.toString() || '');
  const [interestRate, setInterestRate] = useState(editAccount?.interestRate?.toString() || '');
  const [color, setColor] = useState(editAccount?.color || ACCOUNT_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Merge popular + custom institutions
  const [customInstitutions, setCustomInstitutions] = useState<Record<string, string[]>>({});
  useEffect(() => {
    actions.getCustomInstitutions().then(setCustomInstitutions);
  }, []);
  const allInstitutions = [
    ...POPULAR_INSTITUTIONS[type].filter((i) => i !== 'Other'),
    ...(customInstitutions[type] || []),
    'Other',
  ];
  // Deduplicate
  const institutions = [...new Set(allInstitutions)];

  const kind = getAccountKind(type);
  const meta = ACCOUNT_TYPE_META[type];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Account name is required';
    if (openingBalance === '' || isNaN(parseFloat(openingBalance))) {
      newErrors.openingBalance = 'Please enter a valid amount';
    }
    if (type === 'credit_card' && (!creditLimit || parseFloat(creditLimit) <= 0)) {
      newErrors.creditLimit = 'Credit limit is required for credit cards';
    }
    if (institution === 'Other' && !customInstitution.trim()) {
      newErrors.customInstitution = 'Enter the institution name';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resolveInstitution = async (): Promise<string | undefined> => {
    if (institution === 'Other') {
      const trimmed = customInstitution.trim();
      if (trimmed) {
        await actions.addCustomInstitution(type, trimmed);
        return trimmed;
      }
      return undefined;
    }
    return institution || undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date().toISOString();
    const resolvedInstitution = await resolveInstitution();
    const resolvedSubtype = (subtype || undefined) as Account['subtype'];

    if (isEditing && editAccount) {
      await actions.updateAccount(editAccount.id, {
        name: name.trim(),
        type,
        kind,
        subtype: resolvedSubtype,
        institution: resolvedInstitution,
        openingBalance: parseFloat(openingBalance),
        creditLimit: type === 'credit_card' ? parseFloat(creditLimit) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        color,
      });
    } else {
      const account: Account = {
        id: uuidv4(),
        name: name.trim(),
        type,
        kind,
        subtype: resolvedSubtype,
        institution: resolvedInstitution,
        openingBalance: parseFloat(openingBalance),
        creditLimit: type === 'credit_card' ? parseFloat(creditLimit) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        color,
        icon: meta.icon,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await actions.addAccount(account);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Account Type */}
      <Select
        label="Account Type"
        value={type}
        onChange={(e) => {
          setType(e.target.value as AccountType);
          setInstitution('');
          setCustomInstitution('');
          setSubtype('');
        }}
        options={Object.entries(ACCOUNT_TYPE_META).map(([value, m]) => ({
          value,
          label: m.label,
        }))}
      />
      <p className="text-xs text-gray-500 -mt-4">{meta.description}</p>

      {/* Account Subtype (Bank / Loan) */}
      {type === 'bank' && (
        <Select
          label="Account Subtype"
          value={subtype}
          onChange={(e) => setSubtype(e.target.value as BankSubtype)}
          options={[
            { value: '', label: 'Select subtype...' },
            ...BANK_SUBTYPES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
      )}
      {type === 'loan' && (
        <Select
          label="Loan Type"
          value={subtype}
          onChange={(e) => setSubtype(e.target.value as LoanSubtype)}
          options={[
            { value: '', label: 'Select loan type...' },
            ...LOAN_SUBTYPES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
      )}

      {/* Account Name */}
      <Input
        label="Account Name"
        placeholder={type === 'bank' ? 'e.g., HDFC Salary Account' : 'e.g., ICICI Amazon Pay Card'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      {/* Institution */}
      {institutions.length > 0 && (
        <>
          <Select
            label="Institution"
            value={institution}
            onChange={(e) => {
              setInstitution(e.target.value);
              if (e.target.value !== 'Other') setCustomInstitution('');
            }}
            options={[
              { value: '', label: 'Select institution...' },
              ...institutions.map((i) => ({ value: i, label: i })),
            ]}
          />
          {institution === 'Other' && (
            <Input
              label="Custom Institution Name"
              placeholder="Enter institution name..."
              value={customInstitution}
              onChange={(e) => setCustomInstitution(e.target.value)}
              error={errors.customInstitution}
              helperText="This will be saved for future use"
            />
          )}
        </>
      )}

      {/* Opening Balance / Outstanding */}
      <Input
        label={kind === 'liability' ? 'Current Outstanding Amount' : 'Current Balance'}
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={openingBalance}
        onChange={(e) => setOpeningBalance(e.target.value)}
        error={errors.openingBalance}
        helperText={kind === 'liability' ? 'Amount currently owed' : 'Current balance in this account'}
      />

      {/* Credit Limit (CC only) */}
      {type === 'credit_card' && (
        <Input
          label="Credit Limit"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          error={errors.creditLimit}
        />
      )}

      {/* Interest Rate (Loan/CC) */}
      {(type === 'loan' || type === 'credit_card') && (
        <Input
          label="Interest Rate (% per annum)"
          type="number"
          step="0.01"
          min="0"
          max="100"
          placeholder="0.00"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
          helperText="Optional"
        />
      )}

      {/* Color Picker */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Update Account' : 'Add Account'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
