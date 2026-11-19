'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Filter, 
  TrendingUp, 
  Users, 
  Coins, 
  CreditCard,
  FileText
} from 'lucide-react';
import { calculatePortfolioMetrics, generateLoanCsv, type PortfolioMetrics } from '@/lib/report-engine';
import type { CreditAssessmentItem } from '@/lib/credit-assessment-store';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './reports.module.css';

export default function AdminReportsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [records, setRecords] = useState<CreditAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [productFilter, setProductFilter] = useState('all');
  const [aoFilter, setAoFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/assessments');
        const data = await res.json();
        if (data.success && Array.isArray(data.assessments)) {
          setRecords(data.assessments);
        }
      } catch (e) {
        console.error('Failed to load assessments for reports:', e);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchProduct = productFilter === 'all' || r.productName === productFilter;
      const matchAo = aoFilter === 'all' || r.evaluatedByOfficer === aoFilter;
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchProduct && matchAo && matchStatus;
    });
  }, [records, productFilter, aoFilter, statusFilter]);

  // Aggregate metrics using pure calculation engine
  const metrics: PortfolioMetrics = useMemo(() => {
    return calculatePortfolioMetrics(filteredRecords);
  }, [filteredRecords]);

  // Distinct filter options
  const productOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.productName) set.add(r.productName);
    });
    return Array.from(set);
  }, [records]);

  const aoOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.evaluatedByOfficer) set.add(r.evaluatedByOfficer);
    });
    return Array.from(set);
  }, [records]);

  // CSV Export Action
  const handleExportCsv = () => {
    const csvContent = generateLoanCsv(filteredRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tribute-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${theme.adminThemeRoot} ${theme.adminPageShell}`}>
      <Sidebar
        role="admin"
        userName="Super Admin"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.adminMainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="admin"
          userName="Dennis Yuan"
          badgeLabel="Portfolio & Performance Reporting"
          pageTitle="Reports & Portfolio Analytics"
          pageSubtitle="Live financial metrics, disbursement reconciliation, product distribution, and officer productivity."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
          actions={
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleExportCsv}
                className={styles.actionBtnOutline}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className={styles.actionBtnOutline}
              >
                <Printer size={14} /> Print Report
              </button>
            </div>
          }
        />

        <div className={styles.reportsWrap} style={{ marginTop: '20px' }}>
          {/* Filter Bar */}
          <div className={styles.filterCard}>
            <div className={styles.filterGroup}>
              <Filter size={16} color="#B91C1C" />
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>FILTER DATASET:</span>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Products</option>
                {productOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={aoFilter}
                onChange={(e) => setAoFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Account Officers</option>
                {aoOptions.map((ao) => (
                  <option key={ao} value={ao}>{ao}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Statuses</option>
                <option value="disbursed">Disbursed (Active)</option>
                <option value="pending_ao_disbursement">Released by Admin (Pending AO)</option>
                <option value="contract_ready">Contract Ready</option>
                <option value="pending_admin">Pending Admin Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Displaying {filteredRecords.length} of {records.length} total loan records
            </span>
          </div>

          {/* Key Metric KPIs */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total Applications</span>
              <span className={styles.kpiValue}>{metrics.totalApplications}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Active Disbursed Volume</span>
              <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                ₱ {metrics.disbursedVolume.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total Collections</span>
              <span className={styles.kpiValue}>
                ₱ {metrics.totalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Outstanding Principal</span>
              <span className={styles.kpiValue}>
                ₱ {metrics.totalRemainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Member CBU Equity</span>
              <span className={styles.kpiValue}>
                ₱ {metrics.totalCbuSavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Approval Rate</span>
              <span className={styles.kpiValue}>{metrics.approvalRatePct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Status Funnel & Breakdown */}
          <div className={styles.dualGrid}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Portfolio Distribution &amp; Status Funnel</h3>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    <th>Lifecycle Stage</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Disbursed / Active Repayment</td>
                    <td style={{ fontWeight: '800', color: '#166534' }}>{metrics.disbursedCount}</td>
                    <td>{metrics.totalApplications > 0 ? ((metrics.disbursedCount / metrics.totalApplications) * 100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Released by Admin (Awaiting AO)</td>
                    <td style={{ fontWeight: '800', color: '#B45309' }}>{metrics.awaitingAoReleaseCount}</td>
                    <td>{metrics.totalApplications > 0 ? ((metrics.awaitingAoReleaseCount / metrics.totalApplications) * 100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Contract Executed (Ready for Release)</td>
                    <td style={{ fontWeight: '800', color: '#1E40AF' }}>{metrics.contractReadyCount}</td>
                    <td>{metrics.totalApplications > 0 ? ((metrics.contractReadyCount / metrics.totalApplications) * 100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Pending Admin Decision</td>
                    <td>{metrics.pendingAdminCount}</td>
                    <td>{metrics.totalApplications > 0 ? ((metrics.pendingAdminCount / metrics.totalApplications) * 100).toFixed(1) : 0}%</td>
                  </tr>
                  <tr>
                    <td>Rejected Applications</td>
                    <td style={{ color: '#DC2626' }}>{metrics.rejectedCount}</td>
                    <td>{metrics.totalApplications > 0 ? ((metrics.rejectedCount / metrics.totalApplications) * 100).toFixed(1) : 0}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Loan Product Mix &amp; Volume</h3>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Applications</th>
                    <th>Disbursed Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.productMix.map((p) => (
                    <tr key={p.name}>
                      <td style={{ fontWeight: '700' }}>{p.name}</td>
                      <td>{p.count}</td>
                      <td style={{ fontWeight: '800', color: '#B91C1C' }}>
                        ₱ {p.volume.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down Loan Details Table */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Filtered Loan Transaction Register</h3>
            <div className={styles.tableWrap}>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    <th>Loan Ref</th>
                    <th>Borrower Name</th>
                    <th>Product</th>
                    <th>Principal</th>
                    <th>Status</th>
                    <th>Collected</th>
                    <th>Balance</th>
                    <th>Account Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        {loading ? 'Compiling portfolio register...' : 'No loans matched the active filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const principal = Number(r.finalContractAmount ?? r.adminApprovedAmount ?? 0);
                      return (
                        <tr key={r.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{r.applicationId || r.id}</td>
                          <td style={{ fontWeight: '800', color: '#0F172A' }}>{r.borrowerName}</td>
                          <td>{r.productName}</td>
                          <td style={{ fontWeight: '700' }}>₱ {principal.toLocaleString('en-PH')}</td>
                          <td>
                            {r.status === 'disbursed' ? (
                              <span className={`${styles.statusPill} ${styles.statusDisbursed}`}>Disbursed</span>
                            ) : r.status === 'pending_ao_disbursement' ? (
                              <span className={`${styles.statusPill} ${styles.statusPendingAo}`}>Released by Admin</span>
                            ) : r.status === 'contract_ready' ? (
                              <span className={`${styles.statusPill} ${styles.statusContractReady}`}>Contract Ready</span>
                            ) : (
                              <span className={`${styles.statusPill} ${styles.statusOther}`}>{r.status}</span>
                            )}
                          </td>
                          <td>₱ {Number(r.totalCollected || 0).toLocaleString('en-PH')}</td>
                          <td>₱ {Number(r.remainingBalance || 0).toLocaleString('en-PH')}</td>
                          <td>{r.evaluatedByOfficer || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
