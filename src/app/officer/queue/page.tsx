'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { AppHeader } from '@/components/common/AppHeader';
import { getCreditAssessments } from '@/lib/credit-assessment-store';
import {
  FileText,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  UserCheck,
  PlusCircle,
  FileEdit,
  Building2,
  Calendar,
  DollarSign,
  Menu,
  ShieldCheck
} from 'lucide-react';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './queue.module.css';

export interface BorrowerApplicationItem {
  id: string;
  applicantName: string;
  productName: string;
  requestedAmount: number;
  approvedAmount?: number;
  termMonths: number;
  paymentMode: string;
  currentStep: number;
  status: 'draft' | 'pending_ai' | 'pending_admin' | 'approved' | 'rejected' | 'completed';
  updatedAt: string;
  policyNo?: string;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'drafts' | 'pending' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [applications, setApplications] = useState<BorrowerApplicationItem[]>([]);

  // Load drafts and applications from storage and database
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadQueue = async () => {
      const list: BorrowerApplicationItem[] = [];
      let draftItem: BorrowerApplicationItem | null = null;

      // 1. Check if there is an active local draft from the onboarding desk
      try {
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const d = JSON.parse(draftRaw);
          const name = d.step1?.firstName || d.step1?.lastName
            ? `${d.step1?.firstName || ''} ${d.step1?.lastName || ''}`.trim()
            : 'Draft Applicant (Unnamed)';

          draftItem = {
            id: d.applicationId || 'DRAFT-ACTIVE',
            applicantName: name,
            productName: d.step5?.loanProduct || 'Regular Loan',
            requestedAmount: Number(d.step5?.requestedAmount) || 10000,
            termMonths: Number(d.step5?.termMonths) || 3,
            paymentMode: d.step5?.repaymentFrequency || 'Daily',
            currentStep: d.currentStep || 1,
            status: d.adminSimulationStatus === 'approved' ? 'approved' : d.isSubmittedToAdmin ? 'pending_admin' : 'draft',
            updatedAt: d.savedAt ? `Today at ${d.savedAt}` : 'Recent draft',
            policyNo: d.step1?.tgswsPolicyNumber || 'LCAP-',
          };
        }
      } catch (e) {
        console.error(e);
      }

      // 2. Read real applications from Credit Assessment store & server
      try {
        let assessments = getCreditAssessments();

        try {
          const res = await fetch('/api/assessments');
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
              for (const serverItem of json.data) {
                const localIdx = assessments.findIndex(a => 
                  a.id === serverItem.id || 
                  (serverItem.applicationId && a.applicationId === serverItem.applicationId)
                );
                if (localIdx >= 0) {
                  assessments[localIdx] = { ...assessments[localIdx], ...serverItem };
                } else {
                  assessments.unshift(serverItem);
                }
              }
            }
          }
        } catch (e) {}

        // Add submitted & approved assessment records
        assessments.forEach(a => {
          list.push({
            id: a.applicationId || a.id,
            applicantName: a.borrowerName,
            productName: a.productName || 'Regular Loan',
            requestedAmount: a.requestedAmount,
            approvedAmount: a.adminApprovedAmount || a.officerAdjustedAmount || a.aiPreApprovedAmount,
            termMonths: a.termMonths || 3,
            paymentMode: a.paymentMode || 'Daily',
            currentStep: a.status === 'contract_ready' || a.status === 'disbursed' ? 7 : a.status === 'admin_approved' ? 6 : 5,
            status: a.status === 'admin_approved' || a.status === 'contract_ready' || a.status === 'disbursed' ? 'approved' : a.status === 'admin_rejected' ? 'rejected' : 'pending_admin',
            updatedAt: a.evaluatedAt || 'Recent',
            policyNo: a.policyNo || 'LCAP-',
          });
        });

        // Only include the draft if it has NOT been registered as an assessment yet
        if (draftItem) {
          const alreadyInList = list.some(item => 
            (draftItem!.id !== 'DRAFT-ACTIVE' && item.id === draftItem!.id) ||
            (draftItem!.policyNo && draftItem!.policyNo !== 'LCAP-' && item.policyNo === draftItem!.policyNo) ||
            (item.applicantName.toLowerCase() === draftItem!.applicantName.toLowerCase())
          );
          if (!alreadyInList) {
            list.unshift(draftItem);
          }
        }
      } catch (e) {
        console.error('Error loading assessments in queue:', e);
        if (draftItem) list.push(draftItem);
      }

      setApplications(list);
    };

    loadQueue();
    window.addEventListener('storage', loadQueue);
    const poller = setInterval(loadQueue, 2000);

    return () => {
      window.removeEventListener('storage', loadQueue);
      clearInterval(poller);
    };
  }, []);

  const handleDeleteDraft = (id: string) => {
    if (confirm('Discard this saved draft permanently?')) {
      if (id === 'DRAFT-ACTIVE') {
        localStorage.removeItem('tribute_new_borrower_draft');
      }
      setApplications(applications.filter((a) => a.id !== id));
    }
  };

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.policyNo && app.policyNo.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'drafts') return app.status === 'draft';
    if (activeTab === 'pending') return app.status === 'pending_admin' || app.status === 'pending_ai';
    if (activeTab === 'approved') return app.status === 'approved' || app.status === 'completed';
    return true;
  });

  const getStatusBadge = (status: BorrowerApplicationItem['status'], step: number) => {
    switch (status) {
      case 'draft':
        return (
          <span className={styles.badgeDraft}>
            <Clock size={12} /> Draft (Step {step}/7)
          </span>
        );
      case 'pending_admin':
        return (
          <span className={styles.badgePendingAdmin}>
            <Building2 size={12} /> Pending Admin
          </span>
        );
      case 'approved':
        return (
          <span className={styles.badgeApproved}>
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      default:
        return (
          <span className={styles.badgeDefault}>
            {status}
          </span>
        );
    }
  };

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <main className={`officer-main-content ${theme.main}`}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Applications Registry"
          pageTitle="Loan Applications & Draft Vault"
          pageSubtitle={`Archived member loan files, live underwriting pipeline, and draft records (${applications.length} In Pipeline).`}
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
          actions={
            <Link
              href="/officer/borrowers/new"
              className={styles.primaryHeaderAction}
            >
              <PlusCircle size={15} /> New Application
            </Link>
          }
        />

        {/* Filter Bar & Search */}
        <div className={styles.filterBar}>
          {/* Tabs */}
          <div className={styles.stageTabs}>
            {[
              { id: 'all', label: 'All Applications' },
              { id: 'drafts', label: 'Draft Applicants' },
              { id: 'pending', label: 'Pending Decisions' },
              { id: 'approved', label: 'Approved & Active' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${styles.stageTabBtn} ${isActive ? styles.stageTabBtnActive : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className={styles.searchBox}>
            <Search size={16} color="#526b5c" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by name, ID, or policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Mobile & Tablet Pipeline Cards (< 1024px) */}
        <div className={styles.mobileCardList}>
          {filtered.length === 0 ? (
            <div className={styles.queueCard}>
              <div className={styles.emptyCell}>
                <FileText size={32} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f291a' }}>No applications found in this view.</p>
                <p style={{ fontSize: '12px' }}>Try switching tabs or adjusting search criteria.</p>
              </div>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className={styles.queueCard}>
                <div className={styles.queueCardHeader}>
                  <div>
                    <h3 className={styles.queueApplicantName}>{item.applicantName}</h3>
                    <div className={`${styles.queueRefRow} ${item.status === 'draft' ? styles.queueRefDraft : ''}`}>
                      {item.id}
                      {item.policyNo && item.policyNo !== 'LCAP-' ? ` • ${item.policyNo}` : ''}
                    </div>
                  </div>
                  {getStatusBadge(item.status, item.currentStep)}
                </div>

                <div className={styles.queueMetricsGrid}>
                  <div>
                    <span className={styles.queueMetricLabel}>Amount</span>
                    <span className={styles.queueMetricVal}>
                      ₱ {item.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                    {item.approvedAmount && item.approvedAmount !== item.requestedAmount && (
                      <span className={styles.queueApprovedSub}>
                        Appr: ₱ {item.approvedAmount.toLocaleString('en-PH')}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={styles.queueMetricLabel}>Product & Term</span>
                    <span className={styles.queueMetricVal}>{item.productName}</span>
                    <span className={styles.policySub}>{item.termMonths} mos • {item.paymentMode}</span>
                  </div>
                </div>

                <div className={styles.queueCardFooter}>
                  <span className={styles.queueUpdatedText}>{item.updatedAt}</span>
                  <div className={styles.actionGroup}>
                    {item.status === 'draft' ? (
                      <>
                        <Link
                          href={`/officer/borrowers/new?id=${encodeURIComponent(item.id)}`}
                          className={styles.resumeBtn}
                        >
                          <FileEdit size={13} /> Resume
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(item.id)}
                          className={styles.deleteBtn}
                          title="Discard Draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : item.status === 'approved' || item.status === 'completed' ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/officer/borrowers?viewDetails=${encodeURIComponent(item.id)}`)}
                        className={styles.viewBorrowerBtn}
                      >
                        <UserCheck size={14} /> View Borrower
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push(`/officer/borrowers/new?id=${encodeURIComponent(item.id)}`)}
                        className={styles.reviewBtn}
                      >
                        <Eye size={13} /> Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Applications Table Card (>= 1024px) */}
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableTh}>Ref / App ID</th>
                  <th className={styles.tableTh}>Applicant Name</th>
                  <th className={styles.tableTh}>Product</th>
                  <th className={styles.tableTh}>Amount</th>
                  <th className={styles.tableTh}>Term & Mode</th>
                  <th className={styles.tableTh}>Status</th>
                  <th className={styles.tableTh}>Last Updated</th>
                  <th className={styles.tableThRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>
                      <FileText size={32} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                      <p style={{ fontSize: '14px', fontWeight: '600' }}>No applications found in this view.</p>
                      <p style={{ fontSize: '12px' }}>Try switching tabs or adjusting search criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className={styles.tableRow}>
                      <td className={`${styles.tableTdRef} ${item.status === 'draft' ? styles.tableTdRefDraft : ''}`}>
                        {item.id}
                        {item.policyNo && item.policyNo !== 'LCAP-' && (
                          <span className={styles.policySub}>
                            {item.policyNo}
                          </span>
                        )}
                      </td>
                      <td className={styles.tableTdName}>
                        {item.applicantName}
                      </td>
                      <td className={styles.tableTdProduct}>
                        {item.productName}
                      </td>
                      <td className={styles.tableTdAmount}>
                        ₱ {item.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        {item.approvedAmount && item.approvedAmount !== item.requestedAmount && (
                          <span className={styles.queueApprovedSub}>
                            Appr: ₱ {item.approvedAmount.toLocaleString('en-PH')}
                          </span>
                        )}
                      </td>
                      <td className={styles.tableTdMeta}>
                        {item.termMonths} mos • {item.paymentMode}
                      </td>
                      <td className={styles.tableTdMeta}>
                        {getStatusBadge(item.status, item.currentStep)}
                      </td>
                      <td className={styles.tableTdUpdated}>
                        {item.updatedAt}
                      </td>
                      <td className={styles.tableTdRight}>
                        <div className={styles.actionGroup}>
                          {item.status === 'draft' ? (
                            <>
                              <Link
                                href={`/officer/borrowers/new?id=${encodeURIComponent(item.id)}`}
                                className={styles.resumeBtn}
                              >
                                <FileEdit size={13} /> Resume
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDeleteDraft(item.id)}
                                className={styles.deleteBtn}
                                title="Discard Draft"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : item.status === 'approved' || item.status === 'completed' ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/officer/borrowers?viewDetails=${encodeURIComponent(item.id)}`)}
                              className={styles.viewBorrowerBtn}
                            >
                              <UserCheck size={14} /> View Borrower
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => router.push(`/officer/borrowers/new?id=${encodeURIComponent(item.id)}`)}
                              className={styles.reviewBtn}
                            >
                              <Eye size={13} /> Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Floating Bottom App Navigation on mobile */}
      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
