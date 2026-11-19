'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { Users, FileCheck, DollarSign, AlertCircle, ArrowUpRight, TrendingUp } from 'lucide-react';
import { getCreditAssessments, CreditAssessmentItem } from '@/lib/credit-assessment-store';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './dashboard.module.css';

export default function AdminDashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = getCreditAssessments();

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
      } catch {}

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
    .filter(a => a.status === 'pending_admin').length;

  const stats = [
    { title: 'Total Disbursed', value: `₱ ${totalDisbursed.toLocaleString('en-PH')}`, change: 'Current portfolio', isUp: true, icon: DollarSign, color: '#B91C1C' },
    { title: 'Active Borrowers', value: activeBorrowersCount.toString(), change: 'Members in portfolio', isUp: true, icon: Users, color: '#DC2626' },
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
    <div className={`${theme.adminThemeRoot} ${theme.adminPageShell}`}>
      <Sidebar
        role="admin"
        userName="Administrator"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.adminMainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
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
                <div className={styles.statMetaRow}>
                  <span className={s.isUp ? styles.statMetaTrend : styles.statMetaWarn}>
                    {s.change}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Applications Board */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeaderRow}>
            <div>
              <h2 className={styles.tableTitle}>
                Recent Cooperative Loan Applications
              </h2>
              <p className={styles.tableSub}>
                {recentApplications.length} Active Records
              </p>
            </div>
            <Link href="/admin/loans" className={styles.viewAllLink}>
              View All Loans <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className={styles.desktopTableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Borrower</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
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
                    <tr key={app.id}>
                      <td className={styles.appIdCell}>{app.id}</td>
                      <td className={styles.borrowerCell}>{app.borrower}</td>
                      <td>{app.product}</td>
                      <td className={styles.amountCell}>{app.amount}</td>
                      <td>
                        <span className={getStatusClass(app.status)}>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href="/admin/loans"
                          className={styles.actionLink}
                        >
                          Review <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Application Cards (<= 768px) */}
          <div className={styles.mobileCardsWrap}>
            {recentApplications.length === 0 ? (
              <div className={styles.emptyState}>
                No loan applications in record yet. New applications from the onboarding desk will appear here dynamically.
              </div>
            ) : (
              recentApplications.map((app) => (
                <div key={`mob-${app.id}`} className={styles.mobileAppCard}>
                  <div className={styles.mobileAppHeader}>
                    <div>
                      <div className={styles.mobileAppBorrower}>{app.borrower}</div>
                      <span className={styles.mobileAppId}>{app.id}</span>
                    </div>
                    <span className={getStatusClass(app.status)}>
                      {app.status}
                    </span>
                  </div>
                  <div className={styles.mobileAppDetails}>
                    <span>{app.product}</span>
                    <strong className={styles.amountCell}>{app.amount}</strong>
                  </div>
                  <Link
                    href="/admin/loans"
                    className={styles.mobileActionBtn}
                  >
                    Review Application <ArrowUpRight size={14} />
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
