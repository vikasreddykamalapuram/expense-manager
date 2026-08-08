import { AccountType, BankSubtype, LoanSubtype } from '../types';
import { ACCOUNT_COLORS } from './accounts';

/**
 * Preset "tap-to-add" account catalog for seamless onboarding.
 *
 * Each preset carries just enough metadata (name, type, institution, icon, colour,
 * and sensible defaults) so a user can add a real account in one tap and then only
 * fill the numbers that matter (balance / limit / outstanding). No sensitive data
 * lives here — it is a static, local catalogue of popular Indian institutions.
 */
export interface AccountPreset {
  /** Stable key, used for de-dup and selection state. */
  key: string;
  /** Human label shown on the tile. */
  label: string;
  type: AccountType;
  subtype?: BankSubtype | LoanSubtype;
  /** Institution/brand to pre-fill (matches POPULAR_INSTITUTIONS where possible). */
  institution?: string;
  /** Lucide icon name. */
  icon: string;
  /** Tile accent colour (defaults per group when omitted). */
  color?: string;
  /** Which field the user still needs to enter, for a helpful hint. */
  needs?: 'balance' | 'limit' | 'outstanding';
}

export interface AccountPresetGroup {
  id: string;
  label: string;
  /** Short helper shown under the group heading. */
  hint?: string;
  presets: AccountPreset[];
}

const BANK = ACCOUNT_COLORS[0]; // blue
const CARD = ACCOUNT_COLORS[1]; // red
const WALLET = ACCOUNT_COLORS[4]; // purple
const BNPL = ACCOUNT_COLORS[9]; // orange
const LOAN = ACCOUNT_COLORS[5]; // cyan
const CASH = ACCOUNT_COLORS[2]; // green

export const ACCOUNT_CATALOG: AccountPresetGroup[] = [
  {
    id: 'banks',
    label: 'Bank accounts',
    hint: 'Salary, savings or current accounts',
    presets: [
      { key: 'bank-hdfc', label: 'HDFC Bank', type: 'bank', subtype: 'savings', institution: 'HDFC Bank', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-icici', label: 'ICICI Bank', type: 'bank', subtype: 'savings', institution: 'ICICI Bank', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-sbi', label: 'SBI', type: 'bank', subtype: 'savings', institution: 'SBI', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-axis', label: 'Axis Bank', type: 'bank', subtype: 'savings', institution: 'Axis Bank', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-kotak', label: 'Kotak Mahindra', type: 'bank', subtype: 'savings', institution: 'Kotak Mahindra', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-idfc', label: 'IDFC First', type: 'bank', subtype: 'savings', institution: 'IDFC First Bank', icon: 'Landmark', color: BANK, needs: 'balance' },
      { key: 'bank-salary', label: 'Salary account', type: 'bank', subtype: 'salary', icon: 'Landmark', color: BANK, needs: 'balance' },
    ],
  },
  {
    id: 'cards',
    label: 'Credit cards',
    hint: 'Enter your credit limit; outstanding updates as you spend',
    presets: [
      { key: 'cc-hdfc', label: 'HDFC Card', type: 'credit_card', institution: 'HDFC', icon: 'CreditCard', color: CARD, needs: 'limit' },
      { key: 'cc-icici', label: 'ICICI Card', type: 'credit_card', institution: 'ICICI', icon: 'CreditCard', color: CARD, needs: 'limit' },
      { key: 'cc-sbi', label: 'SBI Card', type: 'credit_card', institution: 'SBI Card', icon: 'CreditCard', color: CARD, needs: 'limit' },
      { key: 'cc-axis', label: 'Axis Card', type: 'credit_card', institution: 'Axis Bank', icon: 'CreditCard', color: CARD, needs: 'limit' },
      { key: 'cc-amex', label: 'Amex', type: 'credit_card', institution: 'Amex', icon: 'CreditCard', color: CARD, needs: 'limit' },
      { key: 'cc-amazon', label: 'Amazon Pay ICICI', type: 'credit_card', institution: 'ICICI', icon: 'CreditCard', color: CARD, needs: 'limit' },
    ],
  },
  {
    id: 'wallets',
    label: 'Wallets & UPI',
    hint: 'Prepaid balance in digital wallets',
    presets: [
      { key: 'wallet-paytm', label: 'Paytm', type: 'wallet', institution: 'Paytm', icon: 'Smartphone', color: WALLET, needs: 'balance' },
      { key: 'wallet-phonepe', label: 'PhonePe', type: 'wallet', institution: 'PhonePe', icon: 'Smartphone', color: WALLET, needs: 'balance' },
      { key: 'wallet-gpay', label: 'Google Pay', type: 'wallet', institution: 'Google Pay', icon: 'Smartphone', color: WALLET, needs: 'balance' },
      { key: 'wallet-amazonpay', label: 'Amazon Pay', type: 'wallet', institution: 'Amazon Pay', icon: 'Smartphone', color: WALLET, needs: 'balance' },
    ],
  },
  {
    id: 'bnpl',
    label: 'Pay later / BNPL',
    hint: 'Buy-now-pay-later credit lines — tracked as a liability',
    presets: [
      { key: 'bnpl-lazypay', label: 'LazyPay', type: 'credit_card', institution: 'LazyPay', icon: 'CreditCard', color: BNPL, needs: 'limit' },
      { key: 'bnpl-simpl', label: 'Simpl', type: 'credit_card', institution: 'Simpl', icon: 'CreditCard', color: BNPL, needs: 'limit' },
      { key: 'bnpl-paytm-postpaid', label: 'Paytm Postpaid', type: 'credit_card', institution: 'Paytm Postpaid', icon: 'CreditCard', color: BNPL, needs: 'limit' },
      { key: 'bnpl-amazon-later', label: 'Amazon Pay Later', type: 'credit_card', institution: 'Amazon Pay Later', icon: 'CreditCard', color: BNPL, needs: 'limit' },
    ],
  },
  {
    id: 'loans',
    label: 'Loans',
    hint: 'Add original amount, rate & tenure — we compute EMI and outstanding',
    presets: [
      { key: 'loan-home', label: 'Home loan', type: 'loan', subtype: 'home', icon: 'HandCoins', color: LOAN, needs: 'outstanding' },
      { key: 'loan-personal', label: 'Personal loan', type: 'loan', subtype: 'personal', icon: 'HandCoins', color: LOAN, needs: 'outstanding' },
      { key: 'loan-car', label: 'Car / vehicle loan', type: 'loan', subtype: 'car', icon: 'HandCoins', color: LOAN, needs: 'outstanding' },
      { key: 'loan-education', label: 'Education loan', type: 'loan', subtype: 'education', icon: 'HandCoins', color: LOAN, needs: 'outstanding' },
    ],
  },
  {
    id: 'cash',
    label: 'Cash',
    presets: [
      { key: 'cash-wallet', label: 'Cash in hand', type: 'cash', icon: 'Banknote', color: CASH, needs: 'balance' },
    ],
  },
];

/** Flat lookup of every preset by key. */
export const ACCOUNT_PRESET_BY_KEY: Record<string, AccountPreset> = Object.fromEntries(
  ACCOUNT_CATALOG.flatMap((g) => g.presets).map((p) => [p.key, p])
);
