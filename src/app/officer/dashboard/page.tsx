'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { AppHeader } from '@/components/common/AppHeader';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  UserPlus,
  TrendingUp,
  FileText,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Menu,
  Sparkles
} from 'lucide-react';

import { getCreditAssessments, reconcileAssessmentsWithServer } from '@/lib/credit-assessment-store';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './dashboard.module.css';

export default function OfficerDashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assessments, setAssessments] = useState<any[]>([]);

  React.useEffect(() => {
    let hasSyncedLocalToServer = false;

    const load = async () => {
      let list = getCreditAssessments();

      try {
        const res = await fetch('/api/assessments');
        if (res.ok) {
          const json = await res.json();
          const serverItems: any[] = (json.data && Array.isArray(json.data)) ? json.data : [];

          // 1. One-time sync: if client has local records not yet in server/MySQL, upload them
          if (!hasSyncedLocalToServer && list.length > 0) {
            hasSyncedLocalToServer = true;
            const unsynced = list.filter(local => 
              !serverItems.some(s => s.id === local.id || s.applicationId === local.applicationId)
            );
            if (unsynced.length > 0) {
              fetch('/api/assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_batch', items: unsynced })
              }).catch(() => {});
            }
          }

          // 2. Reconcile local list with authoritative server items (preserves pendingSync offline records)
          list = reconcileAssessmentsWithServer(list, serverItems);
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

  const stats = [
    { label: 'Active Pipeline', value: assessments.length.toString(), change: 'Live pipeline', color: '#16a34a', bg: '#f0fdf4' },
    { 
      label: 'Total Recommended', 
      value: `₱ ${assessments.reduce((sum, a) => sum + (a.officerAdjustedAmount || a.aiPreApprovedAmount || a.requestedAmount || 0), 0).toLocaleString('en-PH')}`, 
      change: 'Active volume', 
      color: '#0f172a', 
      bg: '#f8fafc' 
    },
    { 
      label: 'Pending CI / Verification', 
      value: assessments.filter(a => a.status === 'pending_assessment').length.toString(), 
      change: 'Pending CI', 
      color: '#d97706', 
      bg: '#fffbeb' 
    },
    { 
      label: 'Ready for Signature', 
      value: assessments.filter(a => a.status === 'admin_approved').length.toString(), 
      change: 'Approved by Admin', 
      color: '#2563eb', 
      bg: '#eff6ff' 
    },
  ];

  const queue = assessments.map(a => ({
    id: a.applicationId || a.id,
    borrowerId: a.id || a.applicationId,
    member: a.borrowerName,
    product: a.productName || 'Regular Loan',
    amount: `₱ ${(a.officerAdjustedAmount || a.aiPreApprovedAmount || a.requestedAmount || 0).toLocaleString('en-PH')}`,
    term: `${a.termMonths || 3} mos`,
    date: a.evaluatedAt || 'Today',
    status: a.status === 'admin_approved'
      ? 'Approved'
      : a.status === 'contract_ready'
      ? 'Contract Executed'
      : a.status === 'pending_ao_disbursement'
      ? 'Released by Admin — Awaiting AO Confirmation'
      : a.status === 'disbursed'
      ? 'Disbursed'
      : 'Pending Admin',
    score: a.fiveCs?.riskGrade || 'Class A'
  }));

  const filteredQueue = queue.filter(q =>
    q.member.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar
        userName="Officer Juan"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className={`officer-main-content ${theme.main}`}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Field Underwriting Desk"
          pageTitle="Account Officer Loan Desk"
          pageSubtitle="Live field underwriting, member loan approvals tracking, and cash collection monitoring."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <Link
              href="/officer/borrowers/new"
              className={styles.primaryHeaderAction}
            >
              <UserPlus size={15} /> New Onboarding
            </Link>
          }
        />

        {/* Quick Stat Cards / Pipeline Summary Strip */}
        <div className={styles.summaryStrip}>
          {stats.map((s, idx) => (
            <div
              key={idx}
              className={`${styles.statCard} ${idx === 1 ? styles.statCardPrimary : ''}`}
            >
              {idx !== 1 && (
                <div
                  className={`${styles.statAccentBar} ${
                    s.color === '#d97706'
                      ? styles.statAccentBarAmber
                      : s.color === '#2563eb'
                      ? styles.statAccentBarBlue
                      : ''
                  }`}
                />
              )}
              <span className={styles.statLabel}>
                {s.label}
              </span>
              <p className={styles.statValue}>
                {s.value}
              </p>
              <span
                className={`${styles.statMeta} ${
                  s.color === '#d97706'
                    ? styles.statMetaAmber
                    : s.color === '#2563eb'
                    ? styles.statMetaBlue
                    : ''
                }`}
              >
                {s.change}
              </span>
            </div>
          ))}
        </div>

        {/* Evaluation Queue Card (Pipeline Board) */}
        <div className={styles.pipelineBoardCard}>
          <div className={styles.pipelineToolbar}>
            <div className={styles.pipelineHeadingGroup}>
              <h2 className={styles.pipelineTitle}>
                Active Evaluation & Underwriting Queue
              </h2>
              <p className={styles.pipelineSubtitle}>
                Verify applicant livelihood, check risk scoring, and endorse to admin.
              </p>
            </div>

            <div className={styles.searchContainer}>
              <Search size={16} color="#526b5c" className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search borrower or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={28} color="#15803d" style={{ margin: '0 auto' }} />
              <p className={styles.emptyStateTitle}>No active applications in the pipeline</p>
              <p className={styles.emptyStateDesc}>Start a new borrower onboarding or adjust your search filter.</p>
            </div>
          ) : (
            <>
              {/* Pipeline Cards View */}
              <div className={styles.pipelineCardsGrid}>
                {filteredQueue.map((item) => {
                  const isApproved = item.status === 'Approved' || item.status === 'Contract Executed' || item.status === 'Disbursed';
                  return (
                    <div key={item.id} className={styles.applicationCard}>
                      <div className={styles.cardTopRow}>
                        <div className={styles.borrowerIdentity}>
                          <div className={styles.borrowerAvatar}>
                            {(item.member || 'B').charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.borrowerTextCol}>
                            <h3 className={styles.borrowerName}>{item.member}</h3>
                            <div className={styles.loanRefLine}>
                              {item.id} &bull; {item.product} ({item.term})
                            </div>
                          </div>
                        </div>

                        <span className={`${styles.statusBadge} ${isApproved ? styles.statusApproved : styles.statusPending}`}>
                          {isApproved ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {item.status}
                        </span>
                      </div>

                      <div className={styles.cardMetricsGrid}>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel}>Recommended Principal</span>
                          <span className={styles.metricValue}>{item.amount}</span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricLabel}>Capacity & Risk Grade</span>
                          <span className={styles.riskBadge}>
                            <ShieldCheck size={12} /> {item.score}
                          </span>
                        </div>
                      </div>

                      <div className={styles.cardFooterRow}>
                        <span className={styles.contextText}>
                          Updated: {item.date}
                        </span>
                        <Link
                          href={`/officer/borrowers?viewPassbook=${encodeURIComponent(item.borrowerId || item.id)}`}
                          className={styles.cardActionLink}
                        >
                          <Eye size={14} /> View File
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Responsive Desktop Table Summary */}
              <div className={styles.desktopTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableTh}>Loan Ref</th>
                      <th className={styles.tableTh}>Member / Borrower</th>
                      <th className={styles.tableTh}>Loan Product</th>
                      <th className={styles.tableTh}>Principal</th>
                      <th className={styles.tableTh}>Capacity Rating</th>
                      <th className={styles.tableTh}>Status</th>
                      <th className={styles.tableThRight}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((item) => (
                      <tr key={item.id} className={styles.tableRow}>
                        <td className={styles.tableTdRef}>
                          {item.id}
                        </td>
                        <td className={styles.tableTdMember}>
                          {item.member}
                        </td>
                        <td className={styles.tableTdProduct}>
                          {item.product} ({item.term})
                        </td>
                        <td className={styles.tableTdAmount}>
                          {item.amount}
                        </td>
                        <td className={styles.tableTdCell}>
                          <span className={styles.riskBadge}>
                            {item.score}
                          </span>
                        </td>
                        <td className={styles.tableTdCell}>
                          <span className={`${styles.statusBadge} ${item.status === 'Approved' ? styles.statusApproved : styles.statusPending}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className={styles.tableTdRight}>
                          <Link
                            href={`/officer/borrowers?viewPassbook=${encodeURIComponent(item.borrowerId || item.id)}`}
                            className={styles.cardActionLink}
                          >
                            <Eye size={13} /> View File
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Floating Bottom App Navigation on mobile */}
      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
