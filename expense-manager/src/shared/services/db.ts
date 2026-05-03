import Dexie, { Table } from 'dexie';
import { Transaction, Category, Account, Budget, Settings, Profile, RecurringRule, StockTransaction } from '../types';

// Extended types with profileId for scoping
export interface DbTransaction extends Transaction {
  profileId: string;
}

export interface DbCategory extends Category {
  profileId: string;
}

export interface DbAccount extends Account {
  profileId: string;
}

export interface DbBudget extends Budget {
  profileId: string;
}

export interface DbSettings {
  profileId: string;
  data: Settings;
}

export interface DbCustomInstitutions {
  profileId: string;
  data: Record<string, string[]>;
}

export interface DbMigration {
  key: string;
  completedAt: string;
  version: number;
}

export interface DbRecurringRule extends RecurringRule {
  profileId: string;
}

export interface DbReceipt {
  id: string;
  profileId: string;
  transactionId: string;
  data: Blob;
  mimeType: string;
  fileName: string;
  fileSize: number;
  thumbnailData?: Blob;
  createdAt: string;
}

export interface DbStockTransaction extends StockTransaction {
  profileId: string;
}

export class ExpenseDatabase extends Dexie {
  transactions!: Table<DbTransaction, string>;
  categories!: Table<DbCategory, string>;
  accounts!: Table<DbAccount, string>;
  budgets!: Table<DbBudget, string>;
  settings!: Table<DbSettings, string>;
  customInstitutions!: Table<DbCustomInstitutions, string>;
  profiles!: Table<Profile, string>;
  migrations!: Table<DbMigration, string>;
  recurringRules!: Table<DbRecurringRule, string>;
  receipts!: Table<DbReceipt, string>;
  stockTransactions!: Table<DbStockTransaction, string>;

  constructor() {
    super('ExpenseIQDatabase');

    this.version(1).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
    });

    this.version(2).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
    });

    this.version(3).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
      receipts: 'id, profileId, transactionId',
    });

    this.version(4).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
      receipts: 'id, profileId, transactionId',
      stockTransactions: 'id, profileId, [profileId+date], [profileId+symbol], [profileId+type], [profileId+broker]',
    });
  }
}

export const db = new ExpenseDatabase();
