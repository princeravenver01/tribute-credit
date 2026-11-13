'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { syncOfflineData } from '@/lib/sync-manager';
import { offlineDB } from '@/lib/offline-db';
import { clearCreditAssessments } from '@/lib/credit-assessment-store';
import styles from '@/components/officer/OfficerChrome.module.css';

export const SyncStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const checkPendingQueue = async () => {
    try {
      const pendingApps = await offlineDB.applications.where('syncStatus').equals('pending').count();
      const pendingCols = await offlineDB.collections.where('syncStatus').equals('pending').count();
      setPendingCount(pendingApps + pendingCols);
    } catch {
      // IndexedDB might not be available during SSR
    }
  };

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOfflineData();
      await checkPendingQueue();
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    checkPendingQueue();

    const handleOnline = () => {
      setIsOnline(true);
      handleManualSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkPendingQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`${styles.syncBar} ${isOnline ? styles.syncBarOnline : styles.syncBarOffline}`}>
      <div className={styles.syncStatusIndicator}>
        {isOnline ? <Wifi size={14} color="#15803d" /> : <WifiOff size={14} color="#b45309" />}
        <span>{isOnline ? 'Online' : 'Offline Mode (APK)'}</span>
      </div>

      {pendingCount > 0 && (
        <span className={styles.syncPendingBadge}>
          {pendingCount} queued
        </span>
      )}

      {isOnline && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className={styles.syncActionBtn}
          title="Sync now with MySQL"
        >
          <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isSyncing ? 'Syncing...' : pendingCount > 0 ? 'Sync Now' : 'Synced'}</span>
        </button>
      )}

      {/* Clear Database & Drafts Button (Preserves admin/officer login) */}
      <button
        type="button"
        onClick={async () => {
          if (confirm('Are you sure you want to clear all borrower applications, credit assessments, and drafts? (Login accounts will be preserved)')) {
            clearCreditAssessments();
            try {
              offlineDB.applications.clear();
              offlineDB.collections.clear();
            } catch (e) {}
            try {
              await fetch('/api/assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear_all' }),
              });
            } catch (e) {}
            window.dispatchEvent(new Event('storage'));
            window.location.reload();
          }
        }}
        className={styles.syncClearBtn}
        title="Reset all test borrowers, assessments and drafts (keeps login accounts)"
      >
        Clear Data
      </button>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
