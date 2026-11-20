import Dexie, { Table } from 'dexie';

export interface OfflineLoanApplication {
  id?: number;
  localId: string; // UUID generated locally
  borrowerId: number;
  borrowerName?: string;
  productId: number;
  amountRequested: number;
  termMonths: number;
  purpose: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface OfflinePaymentCollection {
  id?: number;
  localId: string;
  loanId: number;
  loanCode: string;
  borrowerId: number;
  borrowerName: string;
  officerId: number;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque';
  referenceNo: string;
  paymentDate: string;
  notes?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface CachedBorrower {
  id: number;
  memberNo: string;
  name: string;
  contactNumber: string;
  activeLoanCode?: string;
  outstandingBalance?: number;
}

export class TributeOfflineDB extends Dexie {
  applications!: Table<OfflineLoanApplication, number>;
  collections!: Table<OfflinePaymentCollection, number>;
  cachedBorrowers!: Table<CachedBorrower, number>;

  constructor() {
    super('TributeCoopOfflineDB');
    this.version(1).stores({
      applications: '++id, localId, borrowerId, syncStatus, createdAt',
      collections: '++id, localId, loanId, officerId, syncStatus, createdAt',
      cachedBorrowers: 'id, memberNo, name',
    });
  }
}

export const offlineDB = new TributeOfflineDB();
