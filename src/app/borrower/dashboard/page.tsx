'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Coins, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  History,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { BorrowerNav } from '@/components/borrower/BorrowerNav';
import { CreditAssessmentItem } from '@/lib/credit-assessment-store';
import styles from './dashboard.module.css';

interface PortalStatistics {
  totalLoaned: number;
  totalPaid: number;
  totalInterest: number;
  currentCbuBalance: number;
  totalCbuIn: number;
  totalCbuOut: number;
  totalDaysLoaned: number;
  activeLoansCount: number;
  fullyPaidLoansCount: number;
}

interface BorrowerPortalResponse {
  success: boolean;
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    memberNo: string;
  };
  activeLoan: CreditAssessmentItem | null;
  historyLoans: CreditAssessmentItem[];
  allLoans: CreditAssessmentItem[];
  totalLoansCount: number;
  statistics: PortalStatistics;
  coopSettings: {
    coopName?: string;
    branchName?: string;
  } | null;
}

export default function BorrowerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<BorrowerPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/borrower/portal')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/borrower/login');
          return;
        }
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load borrower dashboard summary');
        }
        setData(json);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Network error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const user = data?.user;
  const stats = data?.statistics;
  const activeLoan = data?.activeLoan;
  const coopSettings = data?.coopSettings;
  const allLoans = data?.allLoans || [];
  const topThreeLoans = allLoans.slice(0, 3);

  // Derive next due information if active loan exists
  const nextPayment = (() => {
    if (!activeLoan || activeLoan.status !== 'disbursed') return null;
    if (Array.isArray(activeLoan.paymentLedgerRecords)) {
      const pendingRecord = activeLoan.paymentLedgerRecords.find((r) => r.status === 'Pending' || r.status === 'Overdue');
      if (pendingRecord) {
        return {
          dueDate: pendingRecord.paymentSchedule,
          amount: pendingRecord.payment,
          isOverdue: pendingRecord.status === 'Overdue',
        };
      }
    }
    return {
      dueDate: activeLoan.nextDueDate || activeLoan.firstDueDate || 'Scheduled',
      amount: activeLoan.requestedAmount ? Math.round(activeLoan.requestedAmount / 12) : 0,
      isOverdue: false,
    };
  })();

  return (
    <div className={styles.shell}>
      <BorrowerNav user={user} coopSettings={coopSettings} />

      <main className={styles.mainContent}>
        {/* SUMMARY HEADER */}
        <div className={styles.summaryHeader}>
          <div>
            <p className={styles.summaryGreeting}>
              {coopSettings?.coopName || 'TRIBUTE CREDIT COOPERATIVE'} &bull; MEMBER PORTAL
            </p>
            <h1 className={styles.summaryName}>Welcome back, {user?.name || 'Member'}</h1>
            <div className={styles.summaryMeta}>
              <span className={styles.metaPill}>MCID: {user?.memberNo || 'TCID-MEM'}</span>
              <span>Branch: {coopSettings?.branchName || 'Main Operations'}</span>
              <span>• Account Status: Active Member</span>
            </div>
          </div>
          <Link href="/borrower/loans" className={styles.headerActionBtn}>
            <CreditCard size={18} />
            <span>Manage My Loans</span>
          </Link>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <RefreshCw size={36} className={`${styles.emptyStateIcon} spin`} />
            <h3 className={styles.emptyStateTitle}>Loading Member Statistics...</h3>
            <p className={styles.emptyStateText}>Fetching your verified cooperative loan records and savings ledger.</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <AlertCircle size={36} color="#DC2626" className={styles.emptyStateIcon} />
            <h3 className={styles.emptyStateTitle}>Failed to Load Summary</h3>
            <p className={styles.emptyStateText}>{error}</p>
          </div>
        ) : (
          <>
            {/* CANONICAL STATISTIC CARDS */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <CreditCard size={14} color="#059669" />
                  Total Paid
                </span>
                <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  ₱ {Number(stats?.totalPaid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Total repayments settled</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <TrendingUp size={14} color="#2563EB" />
                  Total Loaned
                </span>
                <span className={styles.kpiValue}>
                  ₱ {Number(stats?.totalLoaned || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Cumulative principal released</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <Coins size={14} color="#D97706" />
                  Current CBU Balance
                </span>
                <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  ₱ {Number(stats?.currentCbuBalance || 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Member equity &amp; capital</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <Clock size={14} color="#7C3AED" />
                  Total Contractual Interest
                </span>
                <span className={styles.kpiValue}>
                  ₱ {Number(stats?.totalInterest || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.kpiSubtext}>Interest across all contracts</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <Calendar size={14} color="#0D9488" />
                  Total Days Loaned
                </span>
                <span className={styles.kpiValue}>
                  {stats?.totalDaysLoaned || 0} <span style={{ fontSize: '14px', fontWeight: 600 }}>days</span>
                </span>
                <span className={styles.kpiSubtext}>Active duration across releases</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <History size={14} color="#E11D48" />
                  Active/Unpaid Loans
                </span>
                <span className={styles.kpiValue}>
                  {stats?.activeLoansCount || 0}
                </span>
                <span className={styles.kpiSubtext}>Currently outstanding loans</span>
              </div>

              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>
                  <CheckCircle size={14} color="#059669" />
                  Fully Paid Loans
                </span>
                <span className={styles.kpiValue}>
                  {stats?.fullyPaidLoansCount || 0}
                </span>
                <span className={styles.kpiSubtext}>Settled loan cycles</span>
              </div>

              {nextPayment && (
                <div className={styles.kpiCard} style={{ borderColor: nextPayment.isOverdue ? '#FCA5A5' : '#A7F3D0' }}>
                  <span className={styles.kpiLabel} style={{ color: nextPayment.isOverdue ? '#DC2626' : '#059669' }}>
                    <AlertCircle size={14} />
                    Next Due Amount &bull; {nextPayment.dueDate}
                  </span>
                  <span className={styles.kpiValue} style={{ color: nextPayment.isOverdue ? '#DC2626' : '#0F172A' }}>
                    ₱ {Number(nextPayment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={styles.kpiSubtext}>
                    {nextPayment.isOverdue ? '⚠️ Payment is overdue' : 'Upcoming scheduled due'}
                  </span>
                </div>
              )}
            </div>

            {/* TOP 3 RECENT LOAN HISTORY */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <History size={18} color="#059669" />
                  Recent Loan History
                </h2>
                <Link href="/borrower/loans" className={styles.viewAllLink}>
                  <span>View All Loans</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              {topThreeLoans.length === 0 ? (
                <div className={styles.emptyState}>
                  <ShieldCheck size={36} className={styles.emptyStateIcon} />
                  <h3 className={styles.emptyStateTitle}>No Loan Records Found</h3>
                  <p className={styles.emptyStateText}>
                    You do not have any loan applications or active loans recorded under your member profile.
                  </p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Loan Reference</th>
                        <th>Product</th>
                        <th>Principal</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Paid</th>
                        <th>Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topThreeLoans.map((loan) => {
                        const principal = Number(loan.finalContractAmount ?? loan.adminApprovedAmount ?? loan.requestedAmount ?? 0);
                        const paid = Number(loan.totalCollected ?? (loan.status === 'completed' ? principal : 0));
                        const remaining = Number(loan.remainingBalance ?? (loan.status === 'completed' ? 0 : principal - paid));

                        return (
                          <tr key={loan.id}>
                            <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              {loan.applicationId || loan.id}
                            </td>
                            <td>{loan.productName || 'Regular Loan'}</td>
                            <td style={{ fontWeight: 700 }}>₱ {principal.toLocaleString('en-PH')}</td>
                            <td>{loan.disbursedAt || loan.contractExecutedAt || loan.evaluatedAt?.split('T')[0] || '—'}</td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${
                                  loan.status === 'completed'
                                    ? styles.badgeCompleted
                                    : loan.status === 'disbursed'
                                    ? styles.badgeDisbursed
                                    : styles.badgePending
                                }`}
                              >
                                {loan.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ color: '#059669', fontWeight: 700 }}>
                              ₱ {paid.toLocaleString('en-PH')}
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              ₱ {remaining.toLocaleString('en-PH')}
                            </td>
                          </tr>
                        );
                      })}
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
