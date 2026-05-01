import { Account, AccountType, AccountKind, BankSubtype, LoanSubtype, PaymentMethod } from '../types';

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; kind: AccountKind; icon: string; description: string }> = {
  bank: { label: 'Bank Account', kind: 'asset', icon: 'Landmark', description: 'Savings, current, or salary accounts' },
  credit_card: { label: 'Credit Card', kind: 'liability', icon: 'CreditCard', description: 'Visa, Mastercard, Rupay, etc.' },
  loan: { label: 'Loan', kind: 'liability', icon: 'HandCoins', description: 'Home loan, personal loan, car loan, etc.' },
  wallet: { label: 'Digital Wallet', kind: 'asset', icon: 'Smartphone', description: 'Paytm, PhonePe, Google Pay, etc.' },
  cash: { label: 'Cash', kind: 'asset', icon: 'Banknote', description: 'Physical cash in hand' },
};

export const BANK_SUBTYPES: { value: BankSubtype; label: string }[] = [
  { value: 'savings', label: 'Savings Account' },
  { value: 'current', label: 'Current Account' },
  { value: 'salary', label: 'Salary Account' },
  { value: 'fd', label: 'Fixed Deposit' },
  { value: 'rd', label: 'Recurring Deposit' },
];

export const LOAN_SUBTYPES: { value: LoanSubtype; label: string }[] = [
  { value: 'home', label: 'Home Loan' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'car', label: 'Car / Vehicle Loan' },
  { value: 'education', label: 'Education Loan' },
  { value: 'gold', label: 'Gold Loan' },
  { value: 'business', label: 'Business Loan' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (Debit/Credit)' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'auto_debit', label: 'Auto Debit / Standing Instruction' },
  { value: 'other', label: 'Other' },
];

export const ACCOUNT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#ea580c',
  '#6d28d9', '#0d9488',
];

export const POPULAR_INSTITUTIONS: Record<AccountType, string[]> = {
  bank: ['ICICI Bank', 'HDFC Bank', 'SBI', 'Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank', 'Yes Bank', 'IndusInd Bank', 'IDFC First Bank', 'Federal Bank', 'Other'],
  credit_card: ['ICICI', 'HDFC', 'SBI Card', 'Axis Bank', 'Kotak', 'Amex', 'RBL Bank', 'IDFC First', 'Yes Bank', 'IndusInd', 'Other'],
  loan: ['ICICI Bank', 'HDFC Bank', 'SBI', 'Axis Bank', 'Bajaj Finance', 'Tata Capital', 'LIC HFL', 'PNB Housing', 'Other'],
  wallet: ['Paytm', 'PhonePe', 'Google Pay', 'Amazon Pay', 'Freecharge', 'MobiKwik', 'Other'],
  cash: [],
};

/** Compute the current balance of an account from its opening balance and all transactions */
export function computeAccountBalance(
  account: Account,
  transactions: { type: string; amount: number; accountId?: string; toAccountId?: string }[]
): number {
  let balance = account.openingBalance;

  for (const tx of transactions) {
    if (account.kind === 'asset') {
      // Asset: income/transfer-in increases, expense/transfer-out decreases
      if (tx.accountId === account.id && tx.type === 'expense') balance -= tx.amount;
      if (tx.accountId === account.id && tx.type === 'income') balance += tx.amount;
      if (tx.accountId === account.id && tx.type === 'transfer') balance -= tx.amount;
      if (tx.toAccountId === account.id && tx.type === 'transfer') balance += tx.amount;
    } else {
      // Liability: expense increases outstanding, income (refund) decreases, payment decreases
      if (tx.accountId === account.id && tx.type === 'expense') balance += tx.amount;
      if (tx.accountId === account.id && tx.type === 'income') balance -= tx.amount;
      if (tx.toAccountId === account.id && tx.type === 'transfer') balance -= tx.amount; // payment received reduces outstanding
      if (tx.accountId === account.id && tx.type === 'transfer') balance += tx.amount; // shouldn't happen often
    }
  }

  return balance;
}

export function getAccountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_META[type].label;
}

export function getAccountKind(type: AccountType): AccountKind {
  return ACCOUNT_TYPE_META[type].kind;
}
