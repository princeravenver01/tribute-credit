'use client';

import { offlineDB, OfflineLoanApplication, OfflinePaymentCollection } from './offline-db';

export interface SyncResult {
  syncedAppsCount: number;
  syncedCollectionsCount: number;
  errors: string[];
}

export async function syncOfflineData(): Promise<SyncResult> {
  const result: SyncResult = {
    syncedAppsCount: 0,
    syncedCollectionsCount: 0,
    errors: [],
  };

  if (typeof window === 'undefined' || !navigator.onLine) {
    return result;
  }

  try {
    // 1. Get pending records
    const pendingApps = await offlineDB.applications
      .where('syncStatus')
      .equals('pending')
      .toArray();

    const pendingCollections = await offlineDB.collections
      .where('syncStatus')
      .equals('pending')
      .toArray();

    if (pendingApps.length === 0 && pendingCollections.length === 0) {
      return result;
    }

    // 2. Mark as syncing
    await offlineDB.applications
      .where('syncStatus')
      .equals('pending')
      .modify({ syncStatus: 'syncing' });

    await offlineDB.collections
      .where('syncStatus')
      .equals('pending')
      .modify({ syncStatus: 'syncing' });

    // 3. Send payload to server
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applications: pendingApps,
        collections: pendingCollections,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with HTTP ${response.status}`);
    }

    const data = await response.json();

    // 4. Mark successful apps
    if (data.syncedApplications && data.syncedApplications.length > 0) {
      await offlineDB.applications
        .where('localId')
        .anyOf(data.syncedApplications)
        .modify({ syncStatus: 'synced' });
      result.syncedAppsCount = data.syncedApplications.length;
    }

    // 5. Mark successful collections
    if (data.syncedCollections && data.syncedCollections.length > 0) {
      await offlineDB.collections
        .where('localId')
        .anyOf(data.syncedCollections)
        .modify({ syncStatus: 'synced' });
      result.syncedCollectionsCount = data.syncedCollections.length;
    }

    // 6. Handle failures
    if (data.failedApplications) {
      for (const f of data.failedApplications) {
        await offlineDB.applications
          .where('localId')
          .equals(f.localId)
          .modify({ syncStatus: 'failed', errorMessage: f.error });
        result.errors.push(`App ${f.localId}: ${f.error}`);
      }
    }

    if (data.failedCollections) {
      for (const f of data.failedCollections) {
        await offlineDB.collections
          .where('localId')
          .equals(f.localId)
          .modify({ syncStatus: 'failed', errorMessage: f.error });
        result.errors.push(`Collection ${f.localId}: ${f.error}`);
      }
    }
  } catch (error: any) {
    console.error('Error during offline data sync:', error);
    result.errors.push(error.message);

    // Rollback syncing items to pending
    await offlineDB.applications
      .where('syncStatus')
      .equals('syncing')
      .modify({ syncStatus: 'pending' });

    await offlineDB.collections
      .where('syncStatus')
      .equals('syncing')
      .modify({ syncStatus: 'pending' });
  }

  return result;
}

// Helper to save a new loan application offline
export async function queueOfflineLoanApplication(appData: Omit<OfflineLoanApplication, 'localId' | 'syncStatus' | 'createdAt'>) {
  const localId = `APP-OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record: OfflineLoanApplication = {
    ...appData,
    localId,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  await offlineDB.applications.add(record);

  // If online right now, immediately attempt to flush
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncOfflineData();
  }

  return localId;
}

// Helper to save a field collection payment offline
export async function queueOfflinePayment(paymentData: Omit<OfflinePaymentCollection, 'localId' | 'syncStatus' | 'createdAt'>) {
  const localId = `PAY-OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record: OfflinePaymentCollection = {
    ...paymentData,
    localId,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  await offlineDB.collections.add(record);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncOfflineData();
  }

  return localId;
}
