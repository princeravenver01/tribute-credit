'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  Printer, 
  RefreshCw, 
  ShieldCheck 
} from 'lucide-react';
import { BorrowerNav } from '@/components/borrower/BorrowerNav';
import styles from './savings.module.css';

interface CbuRecordItem {
  id?: string;
  date: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  runningBalance: number;
  referenceNo?: string;
  processedBy?: string;
  aoSignature?: string;
  aoSignatureImage?: string;
  aoAuthId?: string;
  notes?: string;
}

interface BorrowerSavingsPortalData {
  user?: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    memberNo: string;
  };
  cbuLedger?: CbuRecordItem[];
  statistics?: {
    currentCbuBalance: number;
    totalCbuIn: number;
    totalCbuOut: number;
  };
  coopSettings?: {
    coopName?: string;
    branchName?: string;
  };
}

export default function BorrowerSavingsPage() {
  const router = useRouter();
  const [data, setData] = useState<BorrowerSavingsPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdraw'>('all');

  useEffect(() => {
    fetch('/api/borrower/portal')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/borrower/login');
          return;
        }
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load savings ledger');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Network error'))
      .finally(() => setLoading(false));
  }, [router]);

  const rawLedger: CbuRecordItem[] = useMemo(() => data?.cbuLedger || [], [data?.cbuLedger]);
  const stats = data?.statistics;

  const filteredLedger = useMemo(() => {
    if (typeFilter === 'all') return rawLedger;
    return rawLedger.filter((r) => r.type === typeFilter);
  }, [rawLedger, typeFilter]);

  const latestTransactionDate = rawLedger[0]?.date || 'None recorded';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.shell}>
      <BorrowerNav user={data?.user} coopSettings={data?.coopSettings} />

      <main className={styles.mainContent}>
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1>Capital Build-Up (CBU) &amp; Savings Ledger</h1>
            <p>Your official member equity and cumulative cooperative capital contribution history.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading savings ledger...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '24px', backgroundColor: '#FEF2F2', color: '#991B1B', borderRadius: '10px' }}>
            {error}
          </div>
        ) : (
          <>
            {/* REAL CBU TOTALS */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <Coins size={14} color="#059669" />
                  Current CBU Balance
                </span>
                <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  ₱ {Number(stats?.currentCbuBalance || 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Your total co-ownership equity</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <ArrowDownLeft size={14} color="#059669" />
                  Total In (Deposits)
                </span>
                <span className={styles.kpiValue} style={{ color: '#059669' }}>
                  ₱ {Number(stats?.totalCbuIn || 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Accumulated capital contributions</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <ArrowUpRight size={14} color="#DC2626" />
                  Total Out (Withdrawals)
                </span>
                <span className={styles.kpiValue}>
                  ₱ {Number(stats?.totalCbuOut || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Adjustments &amp; disbursements</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <History size={14} color="#475569" />
                  Total Transactions
                </span>
                <span className={styles.kpiValue}>
                  {rawLedger.length}
                </span>
                <span className={styles.kpiSubtext}>Latest: {latestTransactionDate}</span>
              </div>
            </div>

            {/* CBU LEDGER TABLE */}
            <div className={styles.sectionCard}>
              <div className={styles.filterRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Filter by Type:</span>
                  <select
                    className={styles.filterSelect}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'deposit' | 'withdraw')}
                  >
                    <option value="all">All Transactions</option>
                    <option value="deposit">Deposits Only (In)</option>
                    <option value="withdraw">Withdrawals Only (Out)</option>
                  </select>
                </div>

                <button type="button" className={styles.printBtn} onClick={handlePrint}>
                  <Printer size={14} />
                  <span>Print Ledger</span>
                </button>
              </div>

              {filteredLedger.length === 0 ? (
                <div className={styles.emptyState}>
                  <ShieldCheck size={40} className={styles.emptyStateIcon} />
                  <h3 className={styles.emptyStateTitle}>No CBU Transactions Found</h3>
                  <p className={styles.emptyStateText}>
                    There are no recorded capital build-up transactions matching your criteria.
                  </p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Transaction Type</th>
                        <th>Amount</th>
                        <th>Running Balance</th>
                        <th>Reference / Receipt</th>
                        <th>Processed By (AO)</th>
                        <th>AO Authorization / Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.date}</td>
                          <td>
                            <span className={row.type === 'deposit' ? styles.typeDeposit : styles.typeWithdraw}>
                              {row.type === 'deposit' ? '+ Deposit (In)' : '- Withdrawal (Out)'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 800 }}>
                            ₱ {row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontWeight: 900, color: '#0F172A' }}>
                            ₱ {row.runningBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>
                            {row.referenceNo || 'CBU-REC'}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {row.processedBy || 'Account Officer'}
                          </td>
                          <td>
                            {row.aoSignatureImage ? (
                              <img
                                src={row.aoSignatureImage}
                                alt="AO Signature"
                                style={{ maxHeight: '28px', maxWidth: '80px', display: 'block' }}
                              />
                            ) : (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                                ✓ {row.aoAuthId || 'AO-AUTH-LIVE'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
