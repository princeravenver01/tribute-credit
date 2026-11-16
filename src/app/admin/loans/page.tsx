'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import {
  getCreditAssessments,
  saveCreditAssessment,
  updateAssessmentStatus,
  CreditAssessmentItem
} from '@/lib/credit-assessment-store';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Sliders,
  Building,
  UserCheck,
  FileText,
  AlertCircle,
  TrendingUp,
  Scale,
  PenTool,
  RotateCcw
} from 'lucide-react';
import { SignaturePad } from '@/components/common/SignaturePad';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './loans.module.css';

export default function AdminLoanApprovalsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<CreditAssessmentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  
  // Admin Decision Form state
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [adminSignatures, setAdminSignatures] = useState<
    { signature: string; authId: string; timestamp: string }[]
  >([]);
  const [activeAdminSigSlot, setActiveAdminSigSlot] = useState<number>(0);

  useEffect(() => {
    const refreshAssessments = async () => {
      let list = getCreditAssessments();

      // Check if there is an active onboarding application draft submitted to admin in this tab's localStorage
      try {
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          const fullName = `${draft.step1?.firstName || ''} ${draft.step1?.middleName || ''} ${draft.step1?.lastName || ''}`.trim() || 'Active Onboarding Applicant';
          
          if (draft.isSubmittedToAdmin || draft.aiResult || draft.currentStep >= 6) {
            const appId = draft.applicationId || 'NBR-ACTIVE';
            const caId = `CA-${appId.replace('NBR-', '')}`;
            const existingIndex = list.findIndex(a => 
              a.id === caId || 
              a.applicationId === appId || 
              (draft.step1?.tgswsPolicyNumber && draft.step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === draft.step1.tgswsPolicyNumber) ||
              (fullName !== 'Active Onboarding Applicant' && a.borrowerName.toLowerCase() === fullName.toLowerCase())
            );

            // Determine correct status:
            // If the officer submitted a reconsideration (draft.adminSimulationStatus === 'pending'), return status to pending_admin!
            let resolvedStatus: CreditAssessmentItem['status'] = draft.adminSimulationStatus === 'pending'
              ? 'pending_admin'
              : draft.adminSimulationStatus === 'approved'
              ? 'admin_approved'
              : draft.adminSimulationStatus === 'rejected'
              ? 'admin_rejected'
              : 'pending_admin';
            let resolvedApprovedAmount = draft.adminSimulationStatus === 'pending' ? undefined : (draft.adminApprovedAmount || 10000);

            if (existingIndex >= 0) {
              const currentItem = list[existingIndex];
              if (draft.adminSimulationStatus === 'pending') {
                resolvedStatus = 'pending_admin';
                resolvedApprovedAmount = undefined;
              } else if (currentItem.status === 'contract_ready' || currentItem.status === 'disbursed') {
                resolvedStatus = currentItem.status;
                resolvedApprovedAmount = currentItem.adminApprovedAmount || resolvedApprovedAmount;
              } else if (draft.adminSimulationStatus === 'approved' || currentItem.status === 'admin_approved') {
                resolvedStatus = 'admin_approved';
                resolvedApprovedAmount = currentItem.adminApprovedAmount || draft.adminApprovedAmount || resolvedApprovedAmount;
              } else if (draft.adminSimulationStatus === 'rejected' || currentItem.status === 'admin_rejected') {
                resolvedStatus = 'admin_rejected';
              }
            }

            const activeItem: CreditAssessmentItem = {
              id: caId,
              applicationId: appId,
              borrowerName: fullName,
              policyNo: draft.step1?.tgswsPolicyNumber || 'LCAP-NEW',
              contactNumber: `${draft.step2?.countryCode || '+63'} ${draft.step2?.mobileNumber || ''}`,
              location: `${draft.step2?.barangay || 'Batasan Hills'}, ${draft.step2?.city || 'Quezon City'}, ${draft.step2?.province || 'Metro Manila'}`,
              livelihood: draft.step4?.occupation || 'Microenterprise Member',
              yearsInBusiness: Number(draft.step4?.yearsInLivelihood) || 3,
              monthlyNetIncome: Number(draft.step4?.monthlyNetIncome) || 25000,
              existingDebts: 0,
              netDisposableIncome: 20000,
              requestedAmount: Number(draft.step5?.requestedAmount) || 10000,
              productName: draft.step5?.loanProduct || 'Regular Loan',
              termMonths: Number(draft.step5?.termMonths) || 3,
              paymentMode: draft.step5?.repaymentFrequency || 'Daily',
              aiPreApprovedAmount: draft.aiResult?.preApprovedAmount || 10000,
              aiRiskRating: draft.aiResult?.riskRating || 'Class A (Low Risk)',
              aiDsr: draft.aiResult?.debtServiceRatio || 30,
              aiConfidenceScore: 94.2,
              aiRecommendationNote: draft.aiResult?.recommendationNote || 'AI pre-approved based on cash flow evaluation.',
              fiveCs: {
                characterScore: 19,
                characterNotes: `Barangay residency verified in ${draft.step2?.city || 'Quezon City'}. Clean record.`,
                capacityScore: 22,
                capacityNotes: `DSR well within limit. Cash flow verified.`,
                capitalScore: 17,
                capitalNotes: `Equipment and inventory verified on-site.`,
                collateralScore: 15,
                collateralNotes: `Personal co-maker undertaking verified.`,
                conditionsScore: 14,
                conditionsNotes: `Prime microfinance location.`,
                totalScore: 87,
                riskGrade: 'Class A (Prime / Low Risk)',
              },
              officerAdjustedAmount: draft.officerAdjustedAmount || draft.aiResult?.preApprovedAmount || 10000,
              officerRecommendation: 'recommend_approve',
              officerNotes: draft.officerAdjustmentNote || 'Endorsed for Committee approval.',
              evaluatedByOfficer: 'Officer Juan (AO-001)',
              evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              status: resolvedStatus,
              adminApprovedAmount: resolvedApprovedAmount,
              adjustmentCount: Number(draft.adjustmentCount) || 0,
              maxAdjustmentsReached: Number(draft.adjustmentCount) >= 3,
            };

            if (existingIndex >= 0) {
              list[existingIndex] = { ...list[existingIndex], ...activeItem };
            } else {
              list.unshift(activeItem);
            }

            localStorage.setItem('tribute_credit_assessments_db', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.error('Error integrating draft in admin loans page:', e);
      }

      // Merge with server-side assessments store (so regular and Incognito windows share data seamlessly)
      try {
        const res = await fetch('/api/assessments');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            for (const serverItem of json.data) {
              const localIdx = list.findIndex(a => 
                a.id === serverItem.id || 
                (serverItem.applicationId && a.applicationId === serverItem.applicationId)
              );
              if (localIdx >= 0) {
                // If serverItem is pending_admin (e.g. from reconsideration request), respect pending_admin
                const existing = list[localIdx];
                let finalStatus = serverItem.status;
                if (serverItem.status === 'pending_admin' || existing.status === 'pending_admin') {
                  finalStatus = 'pending_admin';
                } else if (serverItem.status === 'contract_ready' || serverItem.status === 'disbursed') {
                  finalStatus = serverItem.status;
                } else if (serverItem.status === 'admin_approved' || existing.status === 'admin_approved') {
                  finalStatus = 'admin_approved';
                }
                list[localIdx] = { ...existing, ...serverItem, status: finalStatus };
              } else {
                list.unshift(serverItem);
              }
            }
          }
        }
      } catch (e) {}

      setAssessments([...list]);
      setSelectedApp(prev => {
        if (!prev) {
          return list.find(a => a.status === 'pending_admin') || list[0] || null;
        }
        const updatedCurrent = list.find(a => a.id === prev.id);
        return updatedCurrent || prev;
      });
    };

    refreshAssessments();

    // Listen for cross-tab or in-page storage changes
    window.addEventListener('storage', refreshAssessments);
    const poller = setInterval(refreshAssessments, 1500);

    return () => {
      window.removeEventListener('storage', refreshAssessments);
      clearInterval(poller);
    };
  }, []);

  const selectApplication = (app: CreditAssessmentItem) => {
    setSelectedApp(app);
    setApprovedAmount(app.officerAdjustedAmount || app.aiPreApprovedAmount || app.requestedAmount);
    setAdminNotes(app.adminNotes || `Approved by Credit Committee based on Officer recommendations.`);
    setActionSuccessMsg('');
    if (app.adminSignatures && app.adminSignatures.length > 0) {
      setAdminSignatures(app.adminSignatures);
      setActiveAdminSigSlot(app.adminSignatures.length >= 3 ? 2 : app.adminSignatures.length);
    } else {
      setAdminSignatures([]);
      setActiveAdminSigSlot(0);
    }
  };

  const handleAdminSignatureSave = (dataUrl: string) => {
    const now = new Date();
    const timeFormatted = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const slotNum = activeAdminSigSlot + 1;
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    const newAuthId = `AUTH-ADM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-S${slotNum}-${randomHex}`;

    const newSigItem = {
      signature: dataUrl,
      authId: newAuthId,
      timestamp: timeFormatted
    };

    setAdminSignatures(prev => {
      const updated = [...prev];
      updated[activeAdminSigSlot] = newSigItem;
      return updated;
    });

    if (activeAdminSigSlot < 2) {
      setActiveAdminSigSlot(activeAdminSigSlot + 1);
    }
  };

  const handleAdminDecision = (status: 'admin_approved' | 'admin_rejected') => {
    if (!selectedApp) return;

    if (status === 'admin_approved' && adminSignatures.length < 3) {
      alert(`⚠️ Admin Committee Approval requires all 3 signatures with unique Auth IDs and timestamps. (${adminSignatures.length}/3 signed)`);
      return;
    }

    const updatedList = updateAssessmentStatus(
      selectedApp.id,
      status,
      {
        adminApprovedAmount: status === 'admin_approved' ? approvedAmount : 0,
        adminNotes: adminNotes,
        adminActionAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        adminSignatures: status === 'admin_approved' ? adminSignatures : undefined,
        adjustmentCount: selectedApp.adjustmentCount || 0,
        maxAdjustmentsReached: (selectedApp.adjustmentCount || 0) >= 3,
      }
    );

    // Explicitly push updated decision to server API so all tabs/incognito windows receive it immediately
    try {
      fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedApp.id,
          applicationId: selectedApp.applicationId,
          policyNo: selectedApp.policyNo,
          borrowerName: selectedApp.borrowerName,
          status: status,
          adminApprovedAmount: status === 'admin_approved' ? approvedAmount : 0,
          adminNotes: adminNotes,
          adminActionAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          adminSignatures: status === 'admin_approved' ? adminSignatures : undefined,
          adjustmentCount: selectedApp.adjustmentCount || 0,
          maxAdjustmentsReached: (selectedApp.adjustmentCount || 0) >= 3,
        })
      }).catch(() => {});
    } catch (e) {}

    // Also update current active onboarding draft if it matches or has an active intake
    try {
      const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        draft.adminSimulationStatus = status === 'admin_approved' ? 'approved' : 'rejected';
        if (status === 'admin_approved') {
          draft.adminApprovedAmount = approvedAmount;
          draft.adminSignatures = adminSignatures;
        }
        draft.adminAssessmentId = selectedApp.id;
        draft.adjustmentCount = selectedApp.adjustmentCount || 0;
        draft.savedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem('tribute_new_borrower_draft', JSON.stringify(draft));
      }
    } catch (e) {
      console.error('Failed to sync to borrower draft:', e);
    }

    // Trigger storage event so open Officer tabs instantly react
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setAssessments(updatedList);
    const refreshed = updatedList.find(a => a.id === selectedApp.id);
    if (refreshed) setSelectedApp(refreshed);

    setActionSuccessMsg(status === 'admin_approved' 
      ? `✓ Loan application approved at ₱${approvedAmount.toLocaleString('en-PH')}! Account Officer screen has been unlocked in real-time.`
      : `✗ Loan application marked Disapproved/Rejected.`
    );

    setTimeout(() => setActionSuccessMsg(''), 5000);
  };

  const pendingCount = assessments.filter(a => a.status === 'pending_admin' || a.status === 'pending_assessment').length;
  const approvedCount = assessments.filter(a => a.status === 'admin_approved' || a.status === 'contract_ready' || a.status === 'disbursed').length;
  const rejectedCount = assessments.filter(a => a.status === 'admin_rejected').length;
  const totalCount = assessments.length;

  const filteredApps = assessments.filter(a => {
    const matchesSearch = 
      a.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.policyNo.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === 'pending') return a.status === 'pending_admin' || a.status === 'pending_assessment';
    if (filterTab === 'approved') return a.status === 'admin_approved' || a.status === 'contract_ready' || a.status === 'disbursed';
    if (filterTab === 'rejected') return a.status === 'admin_rejected';
    return true;
  });

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
          badgeLabel="Credit Committee Portal"
          pageTitle="Loan Approvals & Underwriting Review"
          pageSubtitle="Dual-control governance, credit adjustments, and final disbursement authorizations."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('🚨 Reset everything back to a completely blank database? (All borrowers, assessments, and active drafts will be cleared. Login accounts will remain intact).')) {
                    localStorage.removeItem('tribute_credit_assessments_db');
                    localStorage.removeItem('tribute_new_borrower_draft');
                    sessionStorage.clear();
                    try {
                      await fetch('/api/assessments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'clear_all' }),
                      });
                    } catch (e) {}
                    try {
                      window.dispatchEvent(new Event('storage'));
                    } catch (e) {}
                    window.location.reload();
                  }
                }}
                style={{
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  border: '1.5px solid #FECACA',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                title="Clear all records"
              >
                🗑️ Clear All Records
              </button>

              <Link
                href="/admin/dashboard"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#B91C1C',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #FECACA',
                  fontWeight: '700',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Back to Dashboard
              </Link>
            </>
          }
        />

        {/* Action Alert */}
        {actionSuccessMsg && (
          <div className={styles.actionSuccessBanner}>
            <CheckCircle2 size={18} />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* 2-Column Split Layout */}
        <div className={styles.loansLayout}>
          {/* LEFT: Applications Awaiting Decision */}
          <div className={styles.leftColumn}>
            {/* Filter Tabs */}
            <div className={styles.filterTabs}>
              {[
                { key: 'pending', label: 'Pending Review', count: pendingCount, color: '#f59e0b' },
                { key: 'approved', label: 'Approved', count: approvedCount, color: '#16a34a' },
                { key: 'rejected', label: 'Rejected', count: rejectedCount, color: '#dc2626' },
                { key: 'all', label: 'All', count: totalCount, color: '#64748b' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key as any)}
                  className={`${styles.filterTabBtn} ${filterTab === tab.key ? styles.filterTabBtnActive : ''}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`${styles.tabBadge} ${filterTab === tab.key ? styles.tabBadgeActive : ''}`}
                    style={filterTab !== tab.key ? { color: tab.color } : {}}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search borrower or policy no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* Application Cards List */}
            <div className={styles.cardsList}>
              {filteredApps.length === 0 ? (
                <div className={styles.emptyState}>
                  <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                    No {filterTab} applications found
                  </div>
                  {filterTab === 'pending' && approvedCount > 0 ? (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>
                        All {approvedCount} applications have already been approved by Admin!
                      </span>
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setFilterTab('approved')}
                          style={{
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          View Approved Applications ({approvedCount}) →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Try selecting the &quot;All&quot; tab or clearing your search filter.
                    </span>
                  )}
                </div>
              ) : (
                filteredApps.map(app => {
                  const isSelected = selectedApp?.id === app.id;
                  const isApproved = app.status === 'admin_approved';

                  return (
                    <div
                      key={app.id}
                      onClick={() => selectApplication(app)}
                      className={`${styles.appCard} ${isSelected ? styles.appCardSelected : ''}`}
                    >
                      <div className={styles.appCardHeader}>
                        <div>
                          <h4 className={styles.borrowerName}>
                            {app.borrowerName}
                          </h4>
                          <span className={styles.policyBadge}>
                            {app.policyNo} • {app.id}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {(app.adjustmentCount || 0) > 0 && (
                            <span className={`${styles.reconsiderationBadge} ${(app.adjustmentCount || 0) >= 3 ? styles.reconsiderationBadgeFinal : ''}`}>
                              {(app.adjustmentCount || 0) >= 3 ? 'Final (3/3 Adjustments)' : `Reconsideration #${app.adjustmentCount} (${app.adjustmentCount}/3)`}
                            </span>
                          )}
                          <span className={`${styles.statusPill} ${isApproved ? styles.statusPillApproved : app.status === 'admin_rejected' ? styles.statusPillRejected : styles.statusPillPending}`}>
                            {isApproved ? 'Approved' : app.status === 'admin_rejected' ? 'Rejected' : 'Needs Admin Action'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.appCardFooter}>
                        <span style={{ color: '#64748b' }}>Requested: <strong>₱{(Number(app.requestedAmount) || 0).toLocaleString('en-PH')}</strong></span>
                        <span style={{ color: '#15803d', fontWeight: '800' }}>
                          AO Endorsed: ₱{(Number(app.officerAdjustedAmount || app.aiPreApprovedAmount || app.requestedAmount) || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Detailed Admin Review & Decision Form */}
          {selectedApp ? (
            <div className={styles.detailCard}>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.titleArea}>
                    <h2 className={styles.applicantTitle}>
                      {selectedApp.borrowerName}
                    </h2>
                    <span style={{ backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: '#B91C1C', fontWeight: '700', fontFamily: 'monospace', border: '1px solid #FECACA' }}>
                      {selectedApp.policyNo}
                    </span>
                    {(selectedApp.adjustmentCount || 0) > 0 && (
                      <span className={`${styles.reconsiderationBadge} ${(selectedApp.adjustmentCount || 0) >= 3 ? styles.reconsiderationBadgeFinal : ''}`}>
                        ⚠️ {(selectedApp.adjustmentCount || 0) >= 3 ? 'Final Round (3/3 Adjustments Reached)' : `Reconsideration Round ${selectedApp.adjustmentCount} of 3`}
                      </span>
                    )}
                  </div>
                  <p className={styles.subDetailText}>
                    {selectedApp.location} • <strong>{selectedApp.livelihood}</strong> ({selectedApp.yearsInBusiness} yrs)
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Current Governance State</span>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: selectedApp.status === 'admin_approved' ? '#15803D' : selectedApp.status === 'admin_rejected' ? '#DC2626' : '#B45309',
                    backgroundColor: selectedApp.status === 'admin_approved' ? '#DCFCE7' : selectedApp.status === 'admin_rejected' ? '#FEE2E2' : '#FEF3C7',
                    border: '1px solid ' + (selectedApp.status === 'admin_approved' ? '#86EFAC' : selectedApp.status === 'admin_rejected' ? '#FCA5A5' : '#FDE68A'),
                    padding: '5px 12px',
                    borderRadius: '8px',
                    marginTop: '4px'
                  }}>
                    {selectedApp.status === 'admin_approved' 
                      ? `Approved at ₱${(Number(selectedApp.adminApprovedAmount || selectedApp.officerAdjustedAmount || selectedApp.requestedAmount) || 0).toLocaleString('en-PH')}` 
                      : selectedApp.status === 'admin_rejected' 
                      ? 'Disapproved / Rejected' 
                      : (selectedApp.adjustmentCount || 0) > 0
                      ? `Reconsideration Pending Approval (${selectedApp.adjustmentCount}/3)`
                      : 'Pending Admin Decision'}
                  </div>
                </div>
              </div>

              {/* Cashflow & 5 Cs Evaluation Summary */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Borrower Requested</span>
                  <p className={styles.metricValue}>
                    ₱ {(Number(selectedApp.requestedAmount) || 0).toLocaleString('en-PH')}
                  </p>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>AI Algorithmic Ceiling</span>
                  <p className={`${styles.metricValue} ${styles.metricValueAccent}`}>
                    ₱ {(Number(selectedApp.aiPreApprovedAmount || selectedApp.requestedAmount) || 0).toLocaleString('en-PH')}
                  </p>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>AO Endorsed Amount</span>
                  <p className={`${styles.metricValue} ${styles.metricValueAccent}`}>
                    ₱ {(Number(selectedApp.officerAdjustedAmount || selectedApp.aiPreApprovedAmount || selectedApp.requestedAmount) || 0).toLocaleString('en-PH')}
                  </p>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>5 Cs Scorecard</span>
                  <p className={`${styles.metricValue} ${styles.metricValueGold}`}>
                    {selectedApp.fiveCs?.totalScore || 82}/100 ({selectedApp.fiveCs?.riskGrade?.split(' ')[0] || 'Class A'})
                  </p>
                </div>
              </div>

              {/* Account Officer CI Notes */}
              <div className={styles.officerNotesBox}>
                <span className={styles.officerNotesLabel}>
                  Account Officer Endorsement Justification ({selectedApp.evaluatedByOfficer || 'AO-001'})
                </span>
                <p className={styles.officerNotesQuote}>
                  &ldquo;{selectedApp.officerNotes || 'Verified during live applicant intake interview.'}&rdquo;
                </p>
                {selectedApp.fiveCs && (
                  <div className={styles.fiveCsRow}>
                    <div><strong>Character:</strong> {selectedApp.fiveCs.characterScore}/20 ({selectedApp.fiveCs.characterNotes})</div>
                    <div><strong>Capacity:</strong> {selectedApp.fiveCs.capacityScore}/25 ({selectedApp.fiveCs.capacityNotes})</div>
                    <div><strong>Capital:</strong> {selectedApp.fiveCs.capitalScore}/20 ({selectedApp.fiveCs.capitalNotes})</div>
                    <div><strong>Collateral:</strong> {selectedApp.fiveCs.collateralScore}/20 ({selectedApp.fiveCs.collateralNotes})</div>
                  </div>
                )}
              </div>

              {/* ADMIN DECISION BOX */}
              <div className={styles.decisionBox}>
                <h3 className={styles.decisionBoxTitle}>
                  <ShieldCheck size={20} color="#B91C1C" /> Admin Credit Committee Official Action
                </h3>

                {/* Locked State if Already Approved / Executed */}
                {(selectedApp.status === 'admin_approved' || selectedApp.status === 'contract_ready' || selectedApp.status === 'disbursed') ? (
                  <div>
                    <div className={styles.lockedBanner}>
                      <CheckCircle2 size={24} color="#15803D" />
                      <div>
                        <strong style={{ fontSize: '14px', color: '#15803D' }}>
                          ✓ Application Formally Approved by Credit Committee (Locked)
                        </strong>
                        <p style={{ fontSize: '12.5px', color: '#334155', margin: '2px 0 0 0' }}>
                          Approved Loan Principal: <strong>₱{(Number(selectedApp.adminApprovedAmount || selectedApp.officerAdjustedAmount || selectedApp.aiPreApprovedAmount || selectedApp.requestedAmount) || 0).toLocaleString('en-PH')}</strong> • Status: <strong>{selectedApp.status === 'disbursed' ? 'Funds Disbursed' : selectedApp.status === 'contract_ready' ? 'Contract Executed & Dispatched' : 'Approved (Awaiting Officer Execution)'}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Admin 3 Signatures with Auth IDs & Timestamps Display if approved */}
                    {selectedApp.adminSignatures && selectedApp.adminSignatures.length > 0 && (
                      <div className={styles.signaturesContainer}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', margin: 0, textTransform: 'uppercase' }}>
                            Admin Committee Signatures (3 Specimen with Auth IDs):
                          </h4>
                          <span style={{ fontSize: '11px', color: '#15803D', fontWeight: '800' }}>✓ 3/3 Affixed &amp; Timestamped</span>
                        </div>
                        <div className={styles.signaturesGrid}>
                          {selectedApp.adminSignatures.map((sig, idx) => (
                            <div key={idx} className={styles.sigSpecimenSlot}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7pt', fontWeight: '800', color: '#B91C1C' }}>
                                <span>Admin Sign #{idx + 1}</span>
                                <span style={{ color: '#991B1B', fontFamily: 'monospace', fontSize: '6.5pt' }}>{sig.authId}</span>
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                <img src={sig.signature} alt={`Admin Sig ${idx + 1}`} style={{ maxHeight: '38px', maxWidth: '95%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ fontSize: '6.5pt', color: '#64748B', borderTop: '1px dashed #E2E8F0', paddingTop: '2px' }}>
                                {sig.timestamp}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin View of Executed Contract, Signatures, and Biometrics if available */}
                    {selectedApp.applicantSignature && (
                      <div style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '16px',
                        marginTop: '12px'
                      }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', marginBottom: '10px' }}>
                          Executed Contract Documents &amp; Member Verification:
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>Affixed Stylus Signature:</span>
                            <div style={{ marginTop: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px', backgroundColor: '#ffffff' }}>
                              <img src={selectedApp.applicantSignature} alt="Borrower Signature" style={{ height: '60px', display: 'block' }} />
                            </div>
                          </div>
                          {selectedApp.applicantFacePhoto && (
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>Biometric Face Photo:</span>
                              <div style={{ marginTop: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px', backgroundColor: '#ffffff', display: 'inline-block' }}>
                                <img src={selectedApp.applicantFacePhoto} alt="Live Face Photo" style={{ height: '60px', borderRadius: '4px', display: 'block' }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '12px', color: '#475569' }}>
                          Disbursement Preference: <strong style={{ color: '#111827' }}>{selectedApp.disbursementMode === 'online' ? `Online (${selectedApp.disbursementChannel} - ${selectedApp.disbursementAccountNumber})` : 'Cash (Cashier Window)'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '4px' }}>
                          Final Approved Loan Principal (₱)
                        </label>
                        <input
                          type="number"
                          step="500"
                          min="1000"
                          value={approvedAmount}
                          onChange={(e) => setApprovedAmount(Number(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #B91C1C',
                            fontWeight: '800',
                            fontSize: '17px',
                            color: '#111827',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                          (Admin can accept AO amount or set higher / lower)
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Credit Committee Review Decision
                        </label>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleAdminDecision('admin_approved')}
                            disabled={adminSignatures.length < 3}
                            className={styles.approveBtn}
                            title={adminSignatures.length === 3 ? 'Approve application and dispatch to officer' : `Complete all 3 signatures below to enable approval (${adminSignatures.length}/3 completed)`}
                          >
                            <CheckCircle2 size={16} /> {adminSignatures.length === 3 ? 'Approve Loan' : `Sign Below to Approve (${adminSignatures.length}/3)`}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAdminDecision('admin_rejected')}
                            className={styles.rejectBtn}
                          >
                            <XCircle size={16} /> Disapprove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Admin Mandatory 3 Signatures with Auth IDs & Timestamps */}
                    <div style={{
                      backgroundColor: '#FEF2F2',
                      border: '1.5px solid #FECACA',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '18px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Administrator Digital Signatures (3 Specimen Required)
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                            Affix your 3 signature specimens as the authorized Administrator. Each signature generates a distinct Auth ID and timestamp.
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          backgroundColor: adminSignatures.length === 3 ? '#DCFCE7' : '#FEF3C7',
                          color: adminSignatures.length === 3 ? '#15803D' : '#B45309',
                          border: adminSignatures.length === 3 ? '1px solid #86EFAC' : '1px solid #FDE68A'
                        }}>
                          {adminSignatures.length === 3 ? '✓ Complete (3/3 Signed)' : `Progress: ${adminSignatures.length}/3 Signed`}
                        </span>
                      </div>

                      {/* 3 Signatures Slots Tabs */}
                      <div className={styles.sigSlotsSelectGrid}>
                        {[0, 1, 2].map((slotIdx) => {
                          const sigObj = adminSignatures[slotIdx];
                          const isCurrent = activeAdminSigSlot === slotIdx;

                          return (
                            <div
                              key={slotIdx}
                              onClick={() => setActiveAdminSigSlot(slotIdx)}
                              className={`${styles.sigSlotSelectCard} ${isCurrent ? styles.sigSlotSelectCardActive : sigObj ? styles.sigSlotSelectCardDone : ''}`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '800' }}>
                                <span style={{ color: isCurrent ? '#B91C1C' : '#111827' }}>
                                  Signature #{slotIdx + 1}
                                </span>
                                {sigObj ? (
                                  <span style={{ color: '#16A34A', fontSize: '10px' }}>✓ Captured</span>
                                ) : (
                                  <span style={{ color: '#94A3B8', fontSize: '10px' }}>Pending</span>
                                )}
                              </div>

                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                {sigObj?.signature ? (
                                  <img src={sigObj.signature} alt={`Admin Sig ${slotIdx + 1}`} style={{ maxHeight: '40px', maxWidth: '95%', objectFit: 'contain' }} />
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                                    Click to Sign #{slotIdx + 1}
                                  </span>
                                )}
                              </div>

                              {sigObj && (
                                <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '3px', fontSize: '8.5px', color: '#64748B' }}>
                                  <span style={{ color: '#B91C1C', fontFamily: 'monospace', display: 'block', fontWeight: '700' }}>
                                    {sigObj.authId}
                                  </span>
                                  <span>{sigObj.timestamp}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Interactive Signature Pad for Current Slot */}
                      <div className={styles.sigPadWrapper}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PenTool size={14} color="#B91C1C" />
                            Sign for Signature #{activeAdminSigSlot + 1}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                            Draw your signature using stylus or mouse &amp; click Save
                          </span>
                        </div>

                        <SignaturePad
                          key={`admin-sig-${activeAdminSigSlot}`}
                          onSave={handleAdminSignatureSave}
                          height={120}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '4px' }}>
                        Credit Committee Resolution Notes (Sent to Account Officer)
                      </label>
                      <textarea
                        rows={2}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Enter approval conditions or reasons for adjustment/disapproval..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #D1D5DB',
                          backgroundColor: '#FFFFFF',
                          color: '#111827',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '16px', border: '1px solid #E5E7EB', textAlign: 'center', color: '#64748B' }}>
              Select an application from the left list to review and set final approval.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
