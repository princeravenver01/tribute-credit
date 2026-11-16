'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { Users, FileCheck, DollarSign, AlertCircle, ArrowUpRight, TrendingUp } from 'lucide-react';
import { getCreditAssessments, CreditAssessmentItem } from '@/lib/credit-assessment-store';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './dashboard.module.css';

export default function AdminDashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);

  useEffect(() => {
    const load = async () => {
      let list = getCreditAssessments();

      try {
        const res = await fetch('/api/assessments');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            for (const serverItem of json.data) {
              const localIdx = list.findIndex(a => 
                a.id === serverItem.id || 
                (serverItem.applicationId && a.applicationId === serverItem.applicationId) ||
                (serverItem.policyNo && serverItem.policyNo !== 'LCAP-' && a.policyNo === serverItem.policyNo) ||
                (serverItem.borrowerName && a.borrowerName.toLowerCase() === serverItem.borrowerName.toLowerCase())
              );
              if (localIdx >= 0) {
                list[localIdx] = { ...list[localIdx], ...serverItem };
              } else {
                list.unshift(serverItem);
              }
            }
          }
        }
      } catch (e) {}

      setAssessments([...list]);
    };

    load();
    window.addEventListener('storage', load);
    const poller = setInterval(load, 2000);

    return () => {
      window.removeEventListener('storage', load);
      clearInterval(poller);
    };
  }, []);

  const totalDisbursed = assessments
    .filter(a => a.status === 'disbursed')
    .reduce((sum, a) => sum + (a.finalContractAmount || a.adminApprovedAmount || 0), 0);

  const activeBorrowersCount = assessments
    .filter(a => a.status === 'disbursed' || a.status === 'contract_ready').length;

  const pendingApprovalsCount = assessments
    .filter(a => a.status === 'pending_admin' || a.status === 'pending_assessment').length;

  const stats = [
    { title: 'Total Disbursed', value: `₱ ${totalDisbursed.toLocaleString('en-PH')}`, change: 'Current portfolio', isUp: true, icon: DollarSign, color: '#15803d' },
    { title: 'Active Borrowers', value: activeBorrowersCount.toString(), change: 'Members in portfolio', isUp: true, icon: Users, color: '#16a34a' },
    { title: 'Pending Applications', value: pendingApprovalsCount.toString(), change: 'Requires committee review', isUp: false, icon: FileCheck, color: '#d97706' },
    { title: 'Overdue Accounts', value: '0', change: 'Clean aging report', isUp: true, icon: AlertCircle, color: '#15803d' },
  ];

  const recentApplications = assessments.map(a => ({
    id: a.applicationId || a.id,
    borrower: a.borrowerName,
    product: a.productName || 'Regular Loan',
    amount: `₱ ${(a.adminApprovedAmount || a.officerAdjustedAmount || a.requestedAmount || 0).toLocaleString('en-PH')}`,
    status: a.status === 'admin_approved' ? 'Approved' : a.status === 'disbursed' ? 'Disbursed' : a.status === 'contract_ready' ? 'Contract Executed' : a.status === 'admin_rejected' ? 'Declined' : 'Pending Review'
  }));

  const getStatusClass = (status: string) => {
    if (status === 'Approved' || status === 'Contract Executed') return styles.badgeApproved;
    if (status === 'Disbursed') return styles.badgeDisbursed;
    if (status === 'Declined') return styles.badgeDeclined;
    return styles.badgePending;
  };

  return (
    <div className={`${theme.themeRoot} ${theme.pageShell}`}>
      <Sidebar
        role="admin"
        userName="Administrator"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.mainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="admin"
          userName="Administrator"
          badgeLabel="Super Admin Portal"
          pageTitle="Admin Executive Dashboard"
          pageSubtitle="Cooperative portfolio overview, liquidity status, and loan monitoring."
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
          actions={
            <button type="button" className={styles.auditBtn}>
              <TrendingUp size={15} /> Generate Audit Report
            </button>
          }
        />

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className={styles.statCard}
                style={{ borderTopColor: s.color }}
              >
                <div className={styles.statCardTop}>
                  <span className={styles.statTitle}>{s.title}</span>
                  <div className={styles.statIconWrap}>
                    <Icon size={19} color={s.color} />
                  </div>
                </div>
                <div className={styles.statValue}>
                  {s.value}
                </div>
                <span className={s.isUp ? styles.statChangeUp : styles.statChangeWarn}>
                  {s.change}
                </span>
              </div>
            );
          })}
        </div>

        {/* Recent Applications Board */}
        <div className={styles.boardCard}>
          <div className={styles.boardHeader}>
            <h2 className={styles.boardTitle}>
              Recent Cooperative Loan Applications
            </h2>
            <span className={styles.boardSubtitle}>
              {recentApplications.length} Active Records
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>Loan ID</th>
                  <th className={styles.th}>Borrower</th>
                  <th className={styles.th}>Product</th>
                  <th className={styles.th}>Amount</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyState}>
                      No loan applications in record yet. New applications from the onboarding desk will appear here dynamically.
                    </td>
                  </tr>
                ) : (
                  recentApplications.map((app) => (
                    <tr key={app.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.loanId}`}>{app.id}</td>
                      <td className={`${styles.td} ${styles.borrowerName}`}>{app.borrower}</td>
                      <td className={`${styles.td} ${styles.productCell}`}>{app.product}</td>
                      <td className={`${styles.td} ${styles.amountCell}`}>{app.amount}</td>
                      <td className={styles.td}>
                        <span className={getStatusClass(app.status)}>
                          {app.status}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <Link
                          href="/admin/loans"
                          className={styles.reviewLink}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Application Cards (< 768px) */}
          <div className={styles.mobileList}>
            {recentApplications.length === 0 ? (
              <div className={styles.emptyState}>
                No loan applications in record yet. New applications from the onboarding desk will appear here dynamically.
              </div>
            ) : (
              recentApplications.map((app) => (
                <div key={`mob-${app.id}`} className={styles.mobileItem}>
                  <div className={styles.mobileItemHeader}>
                    <div>
                      <div className={styles.borrowerName}>{app.borrower}</div>
                      <span className={styles.loanId}>{app.id}</span>
                    </div>
                    <span className={getStatusClass(app.status)}>
                      {app.status}
                    </span>
                  </div>
                  <div className={styles.mobileItemMeta}>
                    <span>{app.product}</span>
                    <strong className={styles.amountCell}>{app.amount}</strong>
                  </div>
                  <Link
                    href="/admin/loans"
                    className={`${styles.reviewLink} ${styles.mobileReviewBtn}`}
                  >
                    Review Application
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
