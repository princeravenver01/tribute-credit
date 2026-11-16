'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { AppHeader } from '@/components/common/AppHeader';
import {
  getCreditAssessments,
  saveCreditAssessment,
  updateAssessmentStatus,
  calculate5CsGrade,
  CreditAssessmentItem,
  FiveCsScorecard
} from '@/lib/credit-assessment-store';
import {
  BadgeCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  FileText,
  UserCheck,
  Building,
  Scale,
  Sparkles,
  ChevronRight,
  Menu,
  ShieldCheck,
  Sliders,
  Printer,
  ChevronDown,
  Info,
  DollarSign
} from 'lucide-react';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './assessments.module.css';

export default function CreditAssessmentsPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<CreditAssessmentItem | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'admin_queue' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Assessment Modal / Drawer State
  const [editingScorecard, setEditingScorecard] = useState<FiveCsScorecard | null>(null);
  const [officerAmount, setOfficerAmount] = useState<number>(0);
  const [officerNote, setOfficerNote] = useState<string>('');
  const [recommendation, setRecommendation] = useState<'recommend_approve' | 'recommend_adjust' | 'recommend_reject'>('recommend_approve');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    const refreshAssessments = async () => {
      let list = getCreditAssessments();

      // Check if there is an active onboarding application draft
      try {
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          const fullName = `${draft.step1?.firstName || ''} ${draft.step1?.middleName || ''} ${draft.step1?.lastName || ''}`.trim();
          
          if (draft.isSubmittedToAdmin || draft.aiResult) {
            const appId = draft.applicationId || 'NBR-ACTIVE';
            const caId = `CA-${appId.replace('NBR-', '')}`;
            const existingIndex = list.findIndex(a => 
              a.id === caId || 
              a.applicationId === appId || 
              (draft.step1?.tgswsPolicyNumber && draft.step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === draft.step1.tgswsPolicyNumber) ||
              (fullName && a.borrowerName.toLowerCase() === fullName.toLowerCase())
            );

            const determinedStatus: CreditAssessmentItem['status'] = 
              draft.isContractFinalized ? 'contract_ready' :
              draft.adminSimulationStatus === 'approved' ? 'admin_approved' :
              draft.adminSimulationStatus === 'rejected' ? 'admin_rejected' :
              draft.isSubmittedToAdmin ? 'pending_admin' : 'pending_assessment';

            if (existingIndex >= 0) {
              list[existingIndex] = {
                ...list[existingIndex],
                status: determinedStatus,
                adminApprovedAmount: draft.adminApprovedAmount || list[existingIndex].adminApprovedAmount,
                officerAdjustedAmount: draft.officerAdjustedAmount || list[existingIndex].officerAdjustedAmount,
              };
            }
          }
        }
      } catch (e) {
        console.error('Error integrating draft in credit assessments page:', e);
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
      setSelectedAssessment(prev => {
        if (!prev) {
          if (list.length > 0) {
            initScorecardForm(list[0]);
            return list[0];
          }
          return null;
        }
        const updatedCurrent = list.find(a => a.id === prev.id);
        if (updatedCurrent) {
          return updatedCurrent;
        }
        return prev;
      });
    };

    refreshAssessments();

    // Listen for storage changes across tabs
    window.addEventListener('storage', refreshAssessments);
    const poller = setInterval(refreshAssessments, 1500);

    return () => {
      window.removeEventListener('storage', refreshAssessments);
      clearInterval(poller);
    };
  }, []);

  const initScorecardForm = (item: CreditAssessmentItem) => {
    setEditingScorecard({ ...item.fiveCs });
    setOfficerAmount(item.officerAdjustedAmount || item.aiPreApprovedAmount || item.requestedAmount);
    setOfficerNote(item.officerNotes || '');
    setRecommendation(item.officerRecommendation || 'recommend_approve');
  };

  const handleSelectApplicant = (item: CreditAssessmentItem) => {
    setSelectedAssessment(item);
    initScorecardForm(item);
    setSaveSuccessMsg('');
  };

  // Recalculate 5 Cs Score total dynamically
  const handleScoreChange = (key: keyof Omit<FiveCsScorecard, 'characterNotes' | 'capacityNotes' | 'capitalNotes' | 'collateralNotes' | 'conditionsNotes' | 'totalScore' | 'riskGrade'>, val: number) => {
    if (!editingScorecard) return;
    const updated = { ...editingScorecard, [key]: Number(val) || 0 };
    const total = updated.characterScore + updated.capacityScore + updated.capitalScore + updated.collateralScore + updated.conditionsScore;
    updated.totalScore = total;
    updated.riskGrade = calculate5CsGrade(total);
    setEditingScorecard(updated);
  };

  // Save changes & optionally endorse to Admin
  const handleSaveAssessment = (submitToAdmin: boolean = false) => {
    if (!selectedAssessment || !editingScorecard) return;

    const updatedItem: CreditAssessmentItem = {
      ...selectedAssessment,
      fiveCs: editingScorecard,
      officerAdjustedAmount: officerAmount,
      officerRecommendation: recommendation,
      officerNotes: officerNote,
      evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: submitToAdmin ? 'pending_admin' : selectedAssessment.status
    };

    const updatedList = saveCreditAssessment(updatedItem);
    setAssessments(updatedList);
    setSelectedAssessment(updatedItem);

    setSaveSuccessMsg(submitToAdmin 
      ? '✓ Assessment endorsed to Admin Approval Queue!' 
      : '✓ Credit assessment score & notes saved successfully.');
    
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Simulate Admin Decision right from officer test bench
  const handleSimulateAdminAction = (action: 'approve' | 'reject') => {
    if (!selectedAssessment) return;
    const finalAmount = officerAmount || selectedAssessment.aiPreApprovedAmount;
    const updatedList = updateAssessmentStatus(
      selectedAssessment.id,
      action === 'approve' ? 'admin_approved' : 'admin_rejected',
      {
        adminApprovedAmount: action === 'approve' ? finalAmount : 0,
        adminNotes: action === 'approve' 
          ? `Approved by Credit Committee Chairman at ₱${finalAmount.toLocaleString('en-PH')}.`
          : 'Application rejected due to high credit risk / lack of co-maker.',
        adminActionAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      }
    );
    setAssessments(updatedList);
    const refreshed = updatedList.find(a => a.id === selectedAssessment.id);
    if (refreshed) setSelectedAssessment(refreshed);
  };

  const filteredList = assessments.filter(a => {
    const matchesSearch = 
      a.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.policyNo.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === 'pending') return a.status === 'pending_assessment';
    if (filterTab === 'admin_queue') return a.status === 'pending_admin';
    if (filterTab === 'approved') return a.status === 'admin_approved' || a.status === 'contract_ready' || a.status === 'disbursed';
    return true;
  });

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <main className={`officer-main-content ${theme.main}`}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Credit Underwriting Desk"
          pageTitle="Credit Assessments & Risk Scoring"
          pageSubtitle="5 Cs analysis, capacity validation, and dual-control adjustment workflow."
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  if (confirm('🚨 Reset everything back to a completely blank database? (All borrowers, assessments, and active drafts will be cleared. Login accounts will remain intact).')) {
                    localStorage.removeItem('tribute_credit_assessments_db');
                    localStorage.removeItem('tribute_new_borrower_draft');
                    sessionStorage.clear();
                    try {
                      window.dispatchEvent(new Event('storage'));
                    } catch (e) {}
                    window.location.reload();
                  }
                }}
                className={styles.clearRecordsBtn}
                title="Clear all borrower and assessment records"
              >
                🗑️ Clear All Records
              </button>
              <Link
                href="/officer/borrowers/new"
                className={styles.primaryHeaderAction}
              >
                <UserCheck size={15} /> New Assessment Intake
              </Link>
            </>
          }
        />

        {/* Success Alert */}
        {saveSuccessMsg && (
          <div className={styles.successBanner}>
            <CheckCircle2 size={18} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* 2-Column Responsive Split Layout (List + Interactive Scorecard) */}
        <div className={styles.assessmentLayout}>

          {/* LEFT: Applications List to Assess */}
          <div className={styles.queueColumn}>
            {/* Filter Tabs */}
            <div className={styles.filterTabs}>
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending CI' },
                { key: 'admin_queue', label: 'In Admin' },
                { key: 'approved', label: 'Approved' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key as any)}
                  className={`${styles.filterTabBtn} ${filterTab === tab.key ? styles.filterTabBtnActive : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className={styles.searchWrap}>
              <Search size={16} color="#526b5c" className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search borrower or policy no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* List Cards */}
            <div className={styles.applicantList}>
              {filteredList.length === 0 ? (
                <div className={styles.emptyListBox}>
                  No applicants matching filter.
                </div>
              ) : (
                filteredList.map(item => {
                  const isSelected = selectedAssessment?.id === item.id;
                  const grade = item.fiveCs?.riskGrade || 'Class B';
                  const isApproved = item.status === 'admin_approved';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectApplicant(item)}
                      className={`${styles.applicantCard} ${isSelected ? styles.applicantCardSelected : ''}`}
                    >
                      <div className={styles.applicantCardTop}>
                        <div>
                          <h4 className={styles.applicantName}>
                            {item.borrowerName}
                          </h4>
                          <span className={styles.applicantRef}>
                            {item.policyNo} • {item.id}
                          </span>
                        </div>
                        <span
                          className={styles.statusPill}
                          style={{
                            backgroundColor: 
                              item.status === 'contract_ready' || item.status === 'disbursed' ? '#dbeafe' :
                              item.status === 'admin_approved' ? '#dcfce7' :
                              item.status === 'admin_rejected' ? '#fee2e2' :
                              item.status === 'pending_admin' ? '#fef3c7' : '#dcfce7',
                            color: 
                              item.status === 'contract_ready' || item.status === 'disbursed' ? '#1e40af' :
                              item.status === 'admin_approved' ? '#15803d' :
                              item.status === 'admin_rejected' ? '#dc2626' :
                              item.status === 'pending_admin' ? '#b45309' : '#15803d'
                          }}
                        >
                          {item.status === 'contract_ready' ? 'Contract Executed' :
                           item.status === 'disbursed' ? 'Funds Disbursed' :
                           item.status === 'admin_approved' ? 'Admin Approved' :
                           item.status === 'admin_rejected' ? 'Declined' :
                           item.status === 'pending_admin' ? 'In Admin Committee' : 'Pending Underwriting CI'}
                        </span>
                      </div>

                      <div className={styles.applicantCardBottom}>
                        <span style={{ color: '#526b5c' }}>Requested: <strong>₱{item.requestedAmount.toLocaleString('en-PH')}</strong></span>
                        <span style={{
                          color: item.fiveCs?.totalScore >= 80 ? '#15803d' : '#b45309',
                          fontWeight: '800',
                          fontSize: '12px'
                        }}>
                          Score: {item.fiveCs?.totalScore || 75}/100
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Selected Applicant 5 Cs Assessment Worksheet */}
          {selectedAssessment && editingScorecard ? (
            <div className={`officer-card ${styles.worksheetCard}`}>
              {/* Header Details of Borrower */}
              <div className={styles.borrowerHeader}>
                <div>
                  <div className={styles.borrowerTitleRow}>
                    <h2 className={styles.borrowerTitle}>
                      {selectedAssessment.borrowerName}
                    </h2>
                    <span className={styles.policyBadge}>
                      {selectedAssessment.policyNo}
                    </span>
                  </div>
                  <p className={styles.borrowerSubtitle}>
                    {selectedAssessment.location} • <strong>{selectedAssessment.livelihood}</strong> ({selectedAssessment.yearsInBusiness} yrs)
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    className={styles.gradeBadge}
                    style={{
                      color: editingScorecard.totalScore >= 80 ? '#15803d' : '#b45309',
                      backgroundColor: editingScorecard.totalScore >= 80 ? '#dcfce7' : '#fef3c7',
                      border: editingScorecard.totalScore >= 80 ? '1px solid #86efac' : '1px solid #fde68a'
                    }}
                  >
                    <Scale size={15} /> 5 Cs Grade: {editingScorecard.riskGrade} ({editingScorecard.totalScore}/100)
                  </div>
                </div>
              </div>

              {/* Cashflow & AI Verification Insight Bar */}
              <div className={`step-form-grid ${styles.insightBar}`}>
                <div>
                  <span className={styles.insightLabel}>Declared Monthly Net</span>
                  <p className={styles.insightValWhite}>
                    ₱ {selectedAssessment.monthlyNetIncome.toLocaleString('en-PH')}
                  </p>
                </div>
                <div>
                  <span className={styles.insightLabel}>Existing Debt Obligations</span>
                  <p className={styles.insightValAmber}>
                    - ₱ {selectedAssessment.existingDebts.toLocaleString('en-PH')}
                  </p>
                </div>
                <div>
                  <span className={styles.insightLabel}>Net Disposable Monthly</span>
                  <p className={styles.insightValGreen}>
                    ₱ {selectedAssessment.netDisposableIncome.toLocaleString('en-PH')}
                  </p>
                </div>
                <div>
                  <span className={styles.insightLabel}>AI Algorithmic Ceiling</span>
                  <p className={styles.insightValWhite}>
                    ₱ {selectedAssessment.aiPreApprovedAmount.toLocaleString('en-PH')}
                  </p>
                </div>
              </div>

              {/* The 5 Cs Credit Assessment Scorecard */}
              <h3 className={styles.sectionHeading}>
                <ShieldCheck size={18} color="#15803d" /> 5 Cs Credit Investigation (CI) Breakdown
              </h3>

              <div className={styles.fiveCsStack}>
                {/* 1. Character */}
                <div className={styles.fiveCsCard}>
                  <div className={styles.fiveCsHeader}>
                    <div>
                      <strong className={styles.fiveCsTitle}>1. Character (0 to 20 pts)</strong>
                      <p className={styles.fiveCsDesc}>Barangay clearance, community standing, residence stability, honesty during interview.</p>
                    </div>
                    <div className={styles.scoreInputGroup}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editingScorecard.characterScore}
                        onChange={(e) => handleScoreChange('characterScore', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                      <span style={{ fontSize: '12px', color: '#526b5c', fontWeight: '700' }}>/ 20</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editingScorecard.characterNotes}
                    onChange={(e) => setEditingScorecard({ ...editingScorecard, characterNotes: e.target.value })}
                    placeholder="Officer CI notes on borrower reputation and barangay residency..."
                    className={styles.notesInput}
                  />
                </div>

                {/* 2. Capacity */}
                <div className={styles.fiveCsCard}>
                  <div className={styles.fiveCsHeader}>
                    <div>
                      <strong className={styles.fiveCsTitle}>2. Capacity (0 to 25 pts)</strong>
                      <p className={styles.fiveCsDesc}>Debt Service Coverage Ratio (DSCR), daily/monthly cashflow, secondary earnings.</p>
                    </div>
                    <div className={styles.scoreInputGroup}>
                      <input
                        type="number"
                        min="0"
                        max="25"
                        value={editingScorecard.capacityScore}
                        onChange={(e) => handleScoreChange('capacityScore', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                      <span style={{ fontSize: '12px', color: '#526b5c', fontWeight: '700' }}>/ 25</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editingScorecard.capacityNotes}
                    onChange={(e) => setEditingScorecard({ ...editingScorecard, capacityNotes: e.target.value })}
                    placeholder="Officer observations on daily sales ledger and household expense buffer..."
                    className={styles.notesInput}
                  />
                </div>

                {/* 3. Capital */}
                <div className={styles.fiveCsCard}>
                  <div className={styles.fiveCsHeader}>
                    <div>
                      <strong className={styles.fiveCsTitle}>3. Capital (0 to 20 pts)</strong>
                      <p className={styles.fiveCsDesc}>Borrower personal investment in business, equity, inventory value, coop CBU savings.</p>
                    </div>
                    <div className={styles.scoreInputGroup}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editingScorecard.capitalScore}
                        onChange={(e) => handleScoreChange('capitalScore', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                      <span style={{ fontSize: '12px', color: '#526b5c', fontWeight: '700' }}>/ 20</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editingScorecard.capitalNotes}
                    onChange={(e) => setEditingScorecard({ ...editingScorecard, capitalNotes: e.target.value })}
                    placeholder="Physical inventory assessment and equipment equity notes..."
                    className={styles.notesInput}
                  />
                </div>

                {/* 4. Collateral */}
                <div className={styles.fiveCsCard}>
                  <div className={styles.fiveCsHeader}>
                    <div>
                      <strong className={styles.fiveCsTitle}>4. Collateral & Security (0 to 20 pts)</strong>
                      <p className={styles.fiveCsDesc}>Real estate improvement, vehicle OR/CR, co-maker commitment letter, appliance chattel.</p>
                    </div>
                    <div className={styles.scoreInputGroup}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editingScorecard.collateralScore}
                        onChange={(e) => handleScoreChange('collateralScore', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                      <span style={{ fontSize: '12px', color: '#526b5c', fontWeight: '700' }}>/ 20</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editingScorecard.collateralNotes}
                    onChange={(e) => setEditingScorecard({ ...editingScorecard, collateralNotes: e.target.value })}
                    placeholder="Valuation of pledged assets and co-maker employment status..."
                    className={styles.notesInput}
                  />
                </div>

                {/* 5. Conditions */}
                <div className={styles.fiveCsCard}>
                  <div className={styles.fiveCsHeader}>
                    <div>
                      <strong className={styles.fiveCsTitle}>5. Conditions & Market Health (0 to 15 pts)</strong>
                      <p className={styles.fiveCsDesc}>Market competition, seasonal vulnerability, weather impact on micro-enterprise.</p>
                    </div>
                    <div className={styles.scoreInputGroup}>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={editingScorecard.conditionsScore}
                        onChange={(e) => handleScoreChange('conditionsScore', Number(e.target.value))}
                        className={styles.scoreInput}
                      />
                      <span style={{ fontSize: '12px', color: '#526b5c', fontWeight: '700' }}>/ 15</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editingScorecard.conditionsNotes}
                    onChange={(e) => setEditingScorecard({ ...editingScorecard, conditionsNotes: e.target.value })}
                    placeholder="Foot traffic, supplier stability, and seasonal risks..."
                    className={styles.notesInput}
                  />
                </div>
              </div>

              {/* Officer Recommendation & Loan Adjustment Box */}
              <div className={styles.recommendationPanel}>
                <h4 className={styles.recommendationTitle}>
                  <Sliders size={18} color="#15803d" /> Officer Final Loan Recommendation & Adjustment
                </h4>

                <div className={`step-form-grid ${styles.recommendationGrid}`}>
                  <div>
                    <label className={styles.fieldLabel}>
                      Officer Recommended Loan Limit (₱)
                    </label>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      value={officerAmount}
                      onChange={(e) => setOfficerAmount(Number(e.target.value) || 0)}
                      className={styles.amountInput}
                    />
                    <span style={{ fontSize: '11.5px', color: '#526b5c', display: 'block', marginTop: '4px' }}>
                      (AI recommended: ₱{selectedAssessment.aiPreApprovedAmount.toLocaleString('en-PH')})
                    </span>
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>
                      Officer Verdict / Recommendation
                    </label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value as any)}
                      className={styles.verdictSelect}
                    >
                      <option value="recommend_approve">✓ Endorse for Full Approval</option>
                      <option value="recommend_adjust">⚡ Endorse with Adjusted Amount</option>
                      <option value="recommend_reject">✗ Recommend Disapproval</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={styles.fieldLabel}>
                    Officer Endorsement Justification to Admin
                  </label>
                  <textarea
                    rows={2}
                    value={officerNote}
                    onChange={(e) => setOfficerNote(e.target.value)}
                    placeholder="Provide specific notes regarding capacity and CI findings to support the requested amount..."
                    className={styles.justificationTextarea}
                  />
                </div>
              </div>

              {/* Admin Committee Governance Simulation Status */}
              <div style={{
                backgroundColor: selectedAssessment.status === 'admin_approved' ? '#f0fdf4' : selectedAssessment.status === 'admin_rejected' ? '#fef2f2' : '#fffbeb',
                borderRadius: '14px',
                padding: '20px',
                border: selectedAssessment.status === 'admin_approved' ? '1.5px solid #86efac' : selectedAssessment.status === 'admin_rejected' ? '1.5px solid #fca5a5' : '1.5px solid #fde68a',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={18} color={selectedAssessment.status === 'admin_approved' ? '#15803d' : '#b45309'} />
                    <strong style={{ fontSize: '14px', color: '#0f291a' }}>Admin Governance Status:</strong>
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      backgroundColor: selectedAssessment.status === 'admin_approved' ? '#dcfce7' : selectedAssessment.status === 'admin_rejected' ? '#fee2e2' : '#fef3c7',
                      color: selectedAssessment.status === 'admin_approved' ? '#15803d' : selectedAssessment.status === 'admin_rejected' ? '#dc2626' : '#b45309'
                    }}>
                      {selectedAssessment.status === 'admin_approved'
                        ? `Approved at ₱${(selectedAssessment.adminApprovedAmount || officerAmount).toLocaleString('en-PH')}`
                        : selectedAssessment.status === 'admin_rejected'
                          ? 'Rejected'
                          : selectedAssessment.status === 'pending_admin'
                            ? 'Pending Admin Committee Action'
                            : 'Assessment in Draft'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#526b5c', marginTop: '4px' }}>
                    {selectedAssessment.adminNotes || 'Admin must review officer 5 Cs scorecard before Step 7 contract issuance.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className={styles.actionFooter}>
                <button
                  type="button"
                  onClick={() => handleSaveAssessment(false)}
                  className={styles.saveDraftBtn}
                >
                  Save Assessment Draft
                </button>

                <div className={styles.primaryActionGroup}>
                  <button
                    type="button"
                    onClick={() => handleSaveAssessment(true)}
                    className={styles.endorseAdminBtn}
                  >
                    <Building size={16} /> Submit & Endorse to Admin
                  </button>

                  {selectedAssessment.status === 'admin_approved' && (
                    <Link
                      href="/officer/borrowers/new"
                      className={styles.proceedContractLink}
                    >
                      Proceed to Step 7 Contract <ChevronRight size={16} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.emptyWorksheet}>
              Select an applicant from the left list to conduct credit assessment.
            </div>
          )}

        </div>
      </main>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
