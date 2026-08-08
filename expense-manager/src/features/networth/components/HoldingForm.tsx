import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { Holding, HoldingType } from '../../../shared/types';
import { HOLDING_TYPE_META, HOLDING_TYPE_OPTIONS } from '../../../shared/constants/holdings';

interface HoldingFormProps {
  editHolding?: Holding;
  onSave: (data: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
  onClose: () => void;
}

export function HoldingForm({ editHolding, onSave, onClose }: HoldingFormProps) {
  const [type, setType] = useState<HoldingType>(editHolding?.type || 'epf');
  const [name, setName] = useState(editHolding?.name || '');
  const [currentValue, setCurrentValue] = useState(editHolding?.currentValue?.toString() || '');
  const [annualContribution, setAnnualContribution] = useState(editHolding?.annualContribution?.toString() || '');
  const [interestRate, setInterestRate] = useState(editHolding?.interestRate?.toString() || '');
  const [maturityDate, setMaturityDate] = useState(editHolding?.maturityDate || '');
  const [notes, setNotes] = useState(editHolding?.notes || '');
  const [error, setError] = useState('');

  const meta = HOLDING_TYPE_META[type];
  const isRetirement = meta.category === 'retirement';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(currentValue);
    if (isNaN(value) || value < 0) { setError('Enter a valid current value'); return; }
    const displayName = name.trim() || meta.label;
    await onSave({
      name: displayName,
      type,
      currentValue: value,
      annualContribution: annualContribution ? parseFloat(annualContribution) : undefined,
      interestRate: interestRate ? parseFloat(interestRate) : undefined,
      maturityDate: maturityDate || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Select
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as HoldingType)}
        options={HOLDING_TYPE_OPTIONS}
      />
      {meta.hint && <p className="-mt-3 text-xs text-gray-500 dark:text-gray-400">{meta.hint}</p>}

      <Input
        label="Name (optional)"
        placeholder={meta.label}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        label="Current value"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        error={error}
      />

      {isRetirement && (
        <Input
          label="Annual contribution (optional)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={annualContribution}
          onChange={(e) => setAnnualContribution(e.target.value)}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Interest rate % (optional)"
          type="number"
          min="0"
          step="0.01"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
        />
        <Input
          label="Maturity date (optional)"
          type="date"
          value={maturityDate}
          onChange={(e) => setMaturityDate(e.target.value)}
        />
      </div>

      <Input
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">{editHolding ? 'Update' : 'Add'} holding</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
